/**
 * Seam 1 for `./rate-limit`: everything that is a pure function over values.
 *
 * `chargeCeiling` itself is seam 2 — `rate-limit.integration.test.ts` — because the
 * upsert *is* the mechanism and a test that mocked it would assert on the shape
 * of a guard clause rather than on behaviour.
 */

import {
  CEILINGS,
  ceilingUserMessage,
  principalKey,
  retryAfterFor,
  retryPhrase,
  windowStartFor,
} from "#rate-limit";

describe("CEILINGS", () => {
  // NFR26 states both halves in one sentence, and either alone leaves the
  // obvious way round it.
  it("bounds requestMagicLink per address and per IP at NFR26's numbers", () => {
    expect(CEILINGS.requestMagicLink.address).toEqual({ max: 5, windowSeconds: 3600 });
    expect(CEILINGS.requestMagicLink.ip).toEqual({ max: 20, windowSeconds: 3600 });
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

describe("ceilingUserMessage", () => {
  const message = ceilingUserMessage({ max: 5, windowSeconds: 3600 }, 720);

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

  // The voice guide's sentence rules, both countable on purpose.
  it("keeps every sentence under twenty words", () => {
    const sentences = message.split(".").filter((sentence) => sentence.trim());

    expect(sentences.length).toBeGreaterThan(0);
    for (const sentence of sentences) {
      expect(sentence.trim().split(/\s+/).length).toBeLessThanOrEqual(20);
    }
  });

  // No exclamation marks, and never in a refusal.
  it("carries no exclamation mark", () => {
    expect(message).not.toContain("!");
    expect(message).not.toContain("¡");
  });

  // A refusal is our rule, not her mistake. These are the words that would make
  // it hers.
  it.each(["inválido", "error", "no puedes", "demasiado"])("does not say %o", (word) => {
    expect(message.toLowerCase()).not.toContain(word);
  });
});
