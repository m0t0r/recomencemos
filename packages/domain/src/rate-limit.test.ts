/**
 * Seam 1 for `./rate-limit`: everything that is a pure function over values.
 *
 * `chargeCeiling` itself is seam 2 — `rate-limit.integration.test.ts` — because the
 * upsert *is* the mechanism and a test that mocked it would assert on the shape
 * of a guard clause rather than on behaviour.
 */

import {
  CEILING_REFUSALS,
  CEILINGS,
  principalKey,
  retryAfterFor,
  retryPhrase,
  windowStartFor,
} from "#rate-limit";

describe("CEILINGS", () => {
  // NFR26 states both halves in one sentence, and either alone leaves the
  // obvious way round it.
  it("bounds requestMagicLink at five per address and twenty per IP in an hour", () => {
    expect(CEILINGS.requestMagicLink.address).toEqual({ max: 5, windowSeconds: 3600 });
    expect(CEILINGS.requestMagicLink.ip).toEqual({ max: 20, windowSeconds: 3600 });
  });

  /**
   * **Per Account, and the assertion is that there is no other scope.** DD5 says
   * a per-IP bound is not an acceptable substitute here and must not be shipped
   * as one, so this checks the whole object rather than one key — an `ip` scope
   * added beside `account` would pass a `toEqual` on `account` alone.
   */
  it.each(["verifyAdminTotp", "verifyAdminBackupCode"] as const)(
    "bounds %s per Account and by nothing else",
    (action) => {
      expect(CEILINGS[action]).toEqual({ account: { max: 10, windowSeconds: 900 } });
    },
  );

  /**
   * The two code ceilings count separately, which is the property that lets the
   * door say a printed code still works while the six-digit path is locked. One
   * shared counter would make that sentence false.
   */
  it("counts the two code ceilings as two actions", () => {
    expect(Object.keys(CEILINGS)).toContain("verifyAdminTotp");
    expect(Object.keys(CEILINGS)).toContain("verifyAdminBackupCode");
  });

  /**
   * **Five a day, per Account and per IP, and the whole object is asserted.**
   * NFR26 names both scopes for this action and either alone leaves the obvious
   * way round: an Account-only bound is defeated by a second address, an IP-only
   * one by mobile data. The window is a calendar day rather than a rolling one,
   * which is what lets the refusal say when it reopens.
   */
  it("bounds requestSkill at five a day per Account and per IP", () => {
    expect(CEILINGS.requestSkill).toEqual({
      account: { max: 5, windowSeconds: 86_400 },
      ip: { max: 5, windowSeconds: 86_400 },
    });
  });

  /**
   * **Ten a day, and deliberately not publishing's three.** Both scopes are
   * asserted for the reason every other row here asserts both: an Account-only
   * bound is defeated by a second address and an IP-only one by mobile data.
   *
   * The number is the assertion. Editing is a repeated act by the same person
   * on the row she already owns, so a bound chosen to fit a one-off would lock
   * a Worker out of her own profile for a day for correcting her wording three
   * times.
   */
  it("bounds updateProfile at ten a day per Account and per IP", () => {
    expect(CEILINGS.updateProfile).toEqual({
      account: { max: 10, windowSeconds: 86_400 },
      ip: { max: 10, windowSeconds: 86_400 },
    });
  });

  // The two profile write paths do not share an allowance: a Worker who has
  // published once must not find her first correction already charged.
  it("counts publishing and editing as two actions", () => {
    expect(CEILINGS.publishProfile).not.toBe(CEILINGS.updateProfile);
    expect(CEILINGS.publishProfile.account?.max).not.toBe(CEILINGS.updateProfile.account.max);
  });

  /**
   * **NFR26's two numbers for the gated read, and the per-IP pair that is
   * Build's choice rather than the requirement's.** The requirement states
   * ≤ 60/hour and ≤ 300/day per Account and says only "a higher per-IP bound
   * above it"; the whole object is asserted so that the invented half is a
   * number somebody has to change on purpose.
   */
  it("bounds the gated read at sixty an hour per Account, five times that per IP", () => {
    expect(CEILINGS.readProfileHourly).toEqual({
      account: { max: 60, windowSeconds: 3600 },
      ip: { max: 300, windowSeconds: 3600 },
    });
  });

  it("bounds it at three hundred a day per Account, five times that per IP", () => {
    expect(CEILINGS.readProfileDaily).toEqual({
      account: { max: 300, windowSeconds: 86_400 },
      ip: { max: 1500, windowSeconds: 86_400 },
    });
  });

  /**
   * **The reason the gated read is two actions rather than one.**
   * `rate_counter` is `UNIQUE (principal, action, window_start)` and window
   * starts are aligned to the epoch, so at midnight the hour-aligned and the
   * day-aligned start are the *same instant*. Two windows under one action
   * would charge one row there, and the day's 300 would silently become the
   * hour's 60 — once a day, at the hour a nightly job is most likely to run.
   *
   * This is the arithmetic behind that sentence, asserted rather than recalled.
   */
  it("would have collided at midnight had the two windows shared an action", () => {
    const midnight = new Date("2026-09-08T00:00:00.000Z");

    expect(windowStartFor(midnight, CEILINGS.readProfileHourly.account.windowSeconds)).toEqual(
      windowStartFor(midnight, CEILINGS.readProfileDaily.account.windowSeconds),
    );
    expect(Object.keys(CEILINGS)).toContain("readProfileHourly");
    expect(Object.keys(CEILINGS)).toContain("readProfileDaily");
  });

  /**
   * And the other half of that argument: away from midnight the two windows
   * open at different instants, so nothing about the split is load-bearing at
   * any other hour.
   */
  it("puts the two windows on different rows at every other hour", () => {
    const midMorning = new Date("2026-09-08T09:17:04.000Z");

    expect(
      windowStartFor(midMorning, CEILINGS.readProfileHourly.account.windowSeconds),
    ).not.toEqual(windowStartFor(midMorning, CEILINGS.readProfileDaily.account.windowSeconds));
  });
});

describe("principalKey", () => {
  it("does not store the address", () => {
    const key = principalKey({ scope: "address", id: "ana@example.co" });

    expect(key).not.toContain("ana");
    expect(key).not.toContain("@");
    expect(key).toMatch(/^address:[0-9a-f]{64}$/);
  });

  // The counter and the `citext` column must agree on what one person is, or a
  // capitalised address gets its own allowance.
  it("charges one counter whatever the case or the surrounding space", () => {
    const canonical = principalKey({ scope: "address", id: "ana@example.co" });

    expect(principalKey({ scope: "address", id: "Ana@Example.CO" })).toBe(canonical);
    expect(principalKey({ scope: "address", id: "  ana@example.co  " })).toBe(canonical);
  });

  it("keeps the scopes apart, so an IP cannot spend an address's allowance", () => {
    expect(principalKey({ scope: "ip", id: "x" })).not.toBe(
      principalKey({ scope: "address", id: "x" }),
    );
  });
});

describe("windowStartFor", () => {
  it("aligns to the window, not to the request", () => {
    expect(windowStartFor(new Date("2026-08-27T12:34:56.789Z"), 3600).toISOString()).toBe(
      "2026-08-27T12:00:00.000Z",
    );
  });

  it("puts two instants in one window on the same row", () => {
    const a = windowStartFor(new Date("2026-08-27T12:00:00.000Z"), 3600);
    const b = windowStartFor(new Date("2026-08-27T12:59:59.999Z"), 3600);

    expect(a.getTime()).toBe(b.getTime());
  });

  it("puts the next second in the next window", () => {
    const a = windowStartFor(new Date("2026-08-27T12:59:59.999Z"), 3600);
    const b = windowStartFor(new Date("2026-08-27T13:00:00.000Z"), 3600);

    expect(b.getTime() - a.getTime()).toBe(3600 * 1000);
  });
});

describe("retryAfterFor", () => {
  it("counts the seconds left in the window", () => {
    expect(retryAfterFor(new Date("2026-08-27T12:00:00.000Z"), 3600)).toBe(3600);
    expect(retryAfterFor(new Date("2026-08-27T12:59:00.000Z"), 3600)).toBe(60);
  });

  // "Try again in 0 seconds" is not an answer, and a retry loop reading it as
  // one hammers the endpoint the ceiling exists to protect.
  it("never says zero", () => {
    expect(retryAfterFor(new Date("2026-08-27T12:59:59.999Z"), 3600)).toBe(1);
  });
});

describe("retryPhrase", () => {
  it.each([
    [1, "en menos de un minuto"],
    [59, "en menos de un minuto"],
    [60, "en 1 minuto"],
    [61, "en 2 minutos"],
    [720, "en 12 minutos"],
    [3540, "en 59 minutos"],
    // A full window says the hour rather than "en 60 minutos", which is the same
    // fact in the register a person would not use.
    [3600, "en 1 hora"],
    [3660, "en 2 horas"],
  ])("says %o seconds as %o", (seconds, expected) => {
    expect(retryPhrase(seconds)).toBe(expected);
  });

  // Don't 4: "más tarde" is the ambiguity this phrase exists to replace.
  it("never says 'más tarde'", () => {
    for (const seconds of [1, 59, 60, 600, 3600, 7200]) {
      expect(retryPhrase(seconds)).not.toContain("más tarde");
    }
  });
});

describe("CEILING_REFUSALS", () => {
  const message = CEILING_REFUSALS.requestMagicLink({ max: 5, windowSeconds: 3600 }, 720);

  // Do 4 — the product's own evidence, quoted back.
  it("quotes her count back", () => {
    expect(message).toContain("5 enlaces");
  });

  // Do 3 — what she can do next, in the same breath as what failed.
  it("says when she may ask again", () => {
    expect(message).toContain("en 12 minutos");
  });

  // The spec's own requirement for this cell of the rate-limited table: the
  // Google door is still there, so a ceiling is never a dead end.
  it("names the door that is still open", () => {
    expect(message).toContain("Google");
  });

  /**
   * **The one refusal read by somebody in the middle of something else**, and the
   * spec singles it out for that: she is mid-publish when she meets it, which is
   * the moment silence costs the most. Three clauses are named there, so three
   * assertions — the requests already sent are queued and not lost, when she may
   * ask again, and that she can publish now with the closest entry on the list.
   *
   * The fourth clause the criterion names — and change it later — is still
   * absent, but no longer because it would be impossible: editing a published
   * profile has an action and a surface now. It is absent because adding it is a
   * copy decision nobody has taken.
   *
   * What editing did change is the third clause. The Skill picker is rendered by
   * the edit form as well as the publishing one, so the refusal may not end in
   * *y publica*: a Worker changing a profile she published weeks ago cannot
   * publish it again, and a sentence telling her to would name an act she has no
   * way to take.
   */
  describe("the request a Worker meets mid-publish", () => {
    const refused = CEILING_REFUSALS.requestSkill({ max: 5, windowSeconds: 86_400 }, 720);

    it("says the ones she already sent are still there", () => {
      expect(refused).toContain("quedaron en la fila");
      expect(refused).toContain("siguen ahí");
    });

    it("says when she may ask again", () => {
      expect(refused).toContain("en 12 minutos");
    });

    it("leaves her the way forward that does not wait on anybody", () => {
      expect(refused).toContain("más parecida");
    });

    it("names no act that is only available on one of the two forms", () => {
      expect(refused.toLowerCase()).not.toContain("publica");
    });

    it("promises no edit she cannot make", () => {
      expect(refused.toLowerCase()).not.toContain("después");
      expect(refused.toLowerCase()).not.toContain("cambiar");
    });
  });

  /**
   * **The voice rules run over every entry, not over the one that had them
   * first.** C57 asks that the ceilings be checked as a *list* rather than by
   * eye, and a refusal written for a new ceiling is exactly the string nobody
   * re-reads. Driving the table off `CEILING_REFUSALS` itself means a ceiling
   * added without copy that survives these rules is a red test rather than a
   * sentence somebody meets on the worst day they have had.
   */
  describe.each(Object.entries(CEILING_REFUSALS))("%s", (_action, refusal) => {
    const refused = refusal({ max: 10, windowSeconds: 900 }, 720);

    // Do 3 again, over the whole list: a refusal with no next step fails this
    // rule and NFR20 together.
    it("says when it reopens", () => {
      expect(refused).toContain("en 12 minutos");
    });

    // The voice guide's sentence rules, both countable on purpose.
    it("keeps every sentence under twenty words", () => {
      const sentences = refused.split(".").filter((sentence) => sentence.trim());

      expect(sentences.length).toBeGreaterThan(0);
      for (const sentence of sentences) {
        expect(sentence.trim().split(/\s+/).length).toBeLessThanOrEqual(20);
      }
    });

    // No exclamation marks, and never in a refusal.
    it("carries no exclamation mark", () => {
      expect(refused).not.toContain("!");
      expect(refused).not.toContain("¡");
    });

    // A refusal is our rule, not her mistake. These are the words that would
    // make it hers.
    it.each(["inválido", "error", "no puedes", "demasiado"])("does not say %o", (word) => {
      expect(refused.toLowerCase()).not.toContain(word);
    });
  });
});
