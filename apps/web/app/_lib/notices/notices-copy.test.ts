/**
 * The three standing notices against `docs/policy/voice.md`.
 *
 * **This is the copy where getting the register wrong does the most damage**, in
 * the ticket's own words, so it runs the countable rules every other surface runs
 * and then adds the cases that are true of this copy and of nothing else: that
 * each statement leads with its absence, that none of the three has quietly gone
 * missing, and that the sentence banning invisibility has not been softened back
 * into implying it.
 *
 * `describeSurfaceCopy` rather than `describeListCopy`: that one asserts a
 * surface makes **no** claim about verification or money, which is exactly the
 * rule this module is the single exception to. Running it here would assert the
 * notices say nothing.
 *
 * What is **not** here is the half no test reaches — whether the care is aimed at
 * the process rather than at the person. That is `voice.md`'s boundary rule, it
 * is the load-bearing one, and it is a reading a person does.
 */

import { describeSurfaceCopy } from "@/testing/surface-copy";
import { NOTICES_HEADING, STANDING_NOTICES } from "./messages";

describeSurfaceCopy({
  copy: [
    ["NOTICES_HEADING", NOTICES_HEADING],
    ...STANDING_NOTICES.flatMap(
      (notice) =>
        [
          [`${notice.key}.heading`, notice.heading],
          [`${notice.key}.body[0]`, notice.body[0]],
          [`${notice.key}.body[1]`, notice.body[1]],
        ] as const,
    ),
  ],
  // Nothing here is a link or a button. The notices carry no action, by decision:
  // routing them into a click is the small-print shape the brief refuses.
  labels: [],
});

describe("the three statements", () => {
  it("are three, and are the three the product owes", () => {
    expect(STANDING_NOTICES.map((notice) => notice.key)).toEqual([
      "verification",
      "money",
      "block",
    ]);
  });

  /**
   * The absence leads — `voice.md`'s Do 2 — and the heading is where it has to
   * lead, because a reader who skims reads three headings and nothing else.
   *
   * Asserted as "the heading contains a negation" rather than by matching the
   * three sentences, so that rewording one still has to keep the shape.
   */
  it.each(STANDING_NOTICES)("$key opens on what is absent", ({ heading }) => {
    expect(heading.toLowerCase()).toMatch(/\bno\b|\bnada más\b/);
  });

  /**
   * Two paragraphs each: what is absent, then what follows from it. The second
   * may never replace the first, and a statement that grew a third paragraph is
   * one where that has started to happen.
   */
  it.each(STANDING_NOTICES)("$key says what is absent and then what follows", ({ body }) => {
    expect(body).toHaveLength(2);
  });
});

describe("the non-verification notice", () => {
  const [notice] = STANDING_NOTICES;

  /**
   * The heading says *no verificamos* and never *verificado*. `voice.md` bans the
   * past participle in any construction implying that we verify, and
   * `testing/voice.ts` already refuses it — this names the surface, so the failure
   * says which sentence rather than which list.
   */
  it("never uses the word that implies we verify", () => {
    const everything = [notice?.heading, ...(notice?.body ?? [])].join(" ").toLowerCase();
    expect(everything).not.toContain("verificad");
  });

  /**
   * C4's clause, and the ticket's third acceptance criterion: a Hirer types his
   * own name and phone at first send and nothing checks either, so hers are no
   * more and no less trustworthy than his. Without *igual que los tuyos* the
   * sentence is a fact about him; with it, it is the symmetry she needs.
   */
  it("names a Hirer's own name and phone as self-asserted, like everyone else's", () => {
    const body = notice?.body.join(" ") ?? "";

    expect(body).toContain("El nombre y el teléfono de quien envía una propuesta");
    expect(body).toContain("igual que los tuyos");
  });

  /** What we do instead follows the absence and never replaces it. */
  it("says what we do instead, after saying what we do not", () => {
    expect(notice?.body[1]).toContain("una persona lee cada propuesta");
    expect(notice?.body[1]).toContain("tu teléfono no sale de aquí");
  });
});

describe("the no-money notice", () => {
  const notice = STANDING_NOTICES[1];

  /**
   * ADR-0007's uncomfortable half. *El pago es entre ustedes* would be true and
   * would say nothing about what happens when it goes wrong, and the ADR is
   * explicit that an implied guarantee is worse than none because it is relied
   * upon.
   */
  it("says plainly that we can recover nothing", () => {
    expect(notice?.body[1]).toContain("no podemos devolverte nada");
  });

  it("says we take no commission and hold nothing", () => {
    expect(notice?.body[0]).toContain("No cobramos comisión");
    expect(notice?.body[0]).toContain("no guardamos ni un peso");
  });
});

describe("the Block notice", () => {
  const notice = STANDING_NOTICES[2];

  /**
   * **The statement the ticket calls the one most easily lost**, and the
   * assertion is on the half that is easy to drop rather than the half that is
   * easy to write. Anybody can write "you can block someone"; C3's whole point is
   * the sentence after it.
   */
  it("says her card stays public and his reading stays open", () => {
    expect(notice?.body[1]).toContain("Tu perfil sigue en el muro");
    expect(notice?.body[1]).toContain("puede seguir leyéndolo");
  });

  it("bounds what a Block reaches, in the same breath as offering it", () => {
    expect(notice?.body[0]).toContain("deja de poder enviarte propuestas");
    expect(notice?.body[0]).toContain("eso es todo lo que alcanza");
  });

  /**
   * `CONTEXT.md`'s Block entry bans the words *ban*, *mute* and *hide* **and the
   * description** — "avoid describing it as making her invisible, which it never
   * was". Copy that says *ya no te verá* is false, and it is the kind of false a
   * person relies on.
   */
  it("never implies she becomes invisible", () => {
    const everything = [notice?.heading, ...(notice?.body ?? [])].join(" ").toLowerCase();

    expect(everything).not.toMatch(/invisible/);
    expect(everything).not.toMatch(/ya no te ver/);
    expect(everything).not.toMatch(/\bocultar\b|\bsilenciar\b/);
  });

  /**
   * Grammatical gender is handled by rephrasing, not by a slash and not by an
   * `-e` form — and `bloquearlo` would assume every Hirer is a man.
   */
  it("names the person rather than gendering the pronoun", () => {
    const everything = [notice?.heading, ...(notice?.body ?? [])].join(" ");

    expect(everything).toContain("bloquear a esa persona");
    expect(everything).not.toMatch(/bloquear[lL][oa]/);
  });
});
