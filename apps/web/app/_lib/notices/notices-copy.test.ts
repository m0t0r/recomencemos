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
import { sentencesOf } from "@/testing/voice";
import { NOTICES_HEADING, STANDING_NOTICES } from "./messages";

describeSurfaceCopy({
  copy: [
    ["NOTICES_HEADING", NOTICES_HEADING],
    ...STANDING_NOTICES.flatMap(
      (notice) =>
        [
          [`${notice.key}.heading`, notice.heading],
          [`${notice.key}.lead`, notice.lead],
          ...notice.detail.map(
            (paragraph, index) => [`${notice.key}.detail[${index}]`, paragraph] as const,
          ),
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
   * **One sentence, because the lead is what survives a disclosure.** It is on
   * screen in both treatments and it carries the clause the ticket names by hand;
   * a lead that grew a second sentence is a lead drifting back into being the
   * body, and the collapsed state getting taller is how nobody would notice.
   */
  it.each(STANDING_NOTICES)("$key leads with one sentence and no more", ({ lead }) => {
    expect(sentencesOf(lead)).toHaveLength(1);
  });

  it.each(STANDING_NOTICES)("$key says what follows, after the lead", ({ detail }) => {
    expect(detail.length).toBeGreaterThan(0);
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
    const everything = [notice?.heading, notice?.lead, ...(notice?.detail ?? [])]
      .join(" ")
      .toLowerCase();
    expect(everything).not.toContain("verificad");
  });

  /**
   * C4's clause, and the ticket's third acceptance criterion: a Hirer types his
   * own name and phone at first send and nothing checks either, so hers are no
   * more and no less trustworthy than his. Without *igual que los tuyos* the
   * sentence is a fact about him; with it, it is the symmetry she needs.
   */
  it("names a Hirer's own name and phone as self-asserted, like everyone else's", () => {
    const lead = notice?.lead ?? "";

    expect(lead).toContain("El nombre y el teléfono de quien te escribe");
    expect(lead).toContain("igual que los tuyos");
  });

  /** What we do instead follows the absence and never replaces it. */
  it("says what we do instead, after saying what we do not", () => {
    expect(notice?.detail[1]).toContain("una persona lee cada propuesta");
    expect(notice?.detail[1]).toContain("tu teléfono no sale de aquí");
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
    expect(notice?.lead).toContain("no podemos devolverte nada");
  });

  it("says we take no commission and hold nothing", () => {
    expect(notice?.detail[0]).toContain("No cobramos comisión");
    expect(notice?.detail[0]).toContain("no guardamos ni un peso");
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
    expect(notice?.lead).toContain("Tu perfil sigue en el muro");
    expect(notice?.lead).toContain("puede seguir leyéndolo");
  });

  it("bounds what a Block reaches, in the same breath as offering it", () => {
    expect(notice?.detail[0]).toContain("deja de poder enviarte propuestas");
    expect(notice?.detail[0]).toContain("eso es todo lo que alcanza");
  });

  /**
   * `CONTEXT.md`'s Block entry bans the words *ban*, *mute* and *hide* **and the
   * description** — "avoid describing it as making her invisible, which it never
   * was". Copy that says *ya no te verá* is false, and it is the kind of false a
   * person relies on.
   */
  it("never implies she becomes invisible", () => {
    const everything = [notice?.heading, notice?.lead, ...(notice?.detail ?? [])]
      .join(" ")
      .toLowerCase();

    expect(everything).not.toMatch(/invisible/);
    expect(everything).not.toMatch(/ya no te ver/);
    expect(everything).not.toMatch(/\bocultar\b|\bsilenciar\b/);
  });

  /**
   * Grammatical gender is handled by rephrasing, not by a slash and not by an
   * `-e` form — and `bloquearlo` would assume every Hirer is a man.
   */
  it("names the person rather than gendering the pronoun", () => {
    const everything = [notice?.heading, notice?.lead, ...(notice?.detail ?? [])].join(" ");

    expect(everything).toContain("bloquear a esa persona");
    expect(everything).not.toMatch(/bloquear[lL][oa]/);
  });
});
