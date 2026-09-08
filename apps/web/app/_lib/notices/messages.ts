/**
 * The three standing notices — the product's honesty surface, in one module.
 *
 * **Every string here is quoted from somewhere else, and that is the design.**
 * This module is a placement decision, not a copywriting one:
 *
 * - The non-verification notice is `docs/policy/voice.md`'s own Before/After #1,
 *   taken as the approved sentence rather than re-derived. The clause about a
 *   Hirer's declared name and phone is C4's, added by this ticket.
 * - The no-money notice is `docs/adr/0007-the-platform-never-handles-money.md`,
 *   including the half it refuses to soften: we hold nothing, so we can recover
 *   nothing.
 * - The Block notice is `CONTEXT.md`'s amended Block entry (C3), which is
 *   deliberately narrow and whose _Avoid_ list bans not only the words *ban*,
 *   *mute* and *hide* but the description — *"avoid describing it as making her
 *   invisible, which it never was."*
 *
 * A builder who finds a better sentence has found a change to one of those three
 * files, not a change to this one.
 *
 * **It lives here rather than in `_lib/wall/` or `_lib/lists/`**, and that is
 * enforced from the other side: `testing/list-copy.ts` asserts that neither
 * list's own copy module makes any claim about verification or money, so that
 * these three have exactly one source. A half-version elsewhere is the one thing
 * worse than an absent notice.
 *
 * Register per `voice.md`'s tone matrix, which has a row for precisely this copy:
 * **Warmth 5→3, Directness 5 unchanged** — the absence leads, and warmth here
 * reads as softening. `tú` throughout, no exclamation mark, every sentence inside
 * the twenty-word ceiling, and `notices-copy.test.ts` counts all of it.
 */

/**
 * The region's accessible name, and the only heading above the three.
 *
 * It names the platform rather than "this page", because the same component
 * renders on three routes and will render on more — a heading that said *esta
 * página* would be quietly false on the second one a reader met.
 */
export const NOTICES_HEADING = "Tres cosas claras sobre Recomencemos";

/**
 * One statement: a heading that carries the absence on its own, and a body that
 * says what we do instead without ever replacing it.
 *
 * **The heading is not a label and not a summary — it is the sentence that has
 * to survive being skimmed.** `voice.md`'s Do 2 is *"put the absence first when
 * there is one"*, and a reader who reads only the three headings has been told
 * the three things this component exists to tell them.
 */
export interface StandingNotice {
  /** Stable, English, and the `id` a heading is addressed by. ADR-0012: identifiers are English. */
  readonly key: "verification" | "money" | "block";
  readonly heading: string;
  /**
   * Two paragraphs, in this order on all three: **what is absent**, then **what
   * follows from it**. The symmetry is deliberate — it is `voice.md`'s Do 2 and
   * Do 3 as a shape rather than as a habit, so the second paragraph can never
   * grow into a replacement for the first.
   */
  readonly body: readonly [string, string];
}

/**
 * **Nobody is verified**, and a Hirer's own details are self-asserted too.
 *
 * The first five sentences are `voice.md`'s approved rendering, in its order.
 * The sixth is C4's clause and is this ticket's third acceptance criterion: he
 * types his name and phone at first send, and nothing checks either — so hers
 * are no more and no less trustworthy than his, and the copy says so rather than
 * leaving her to assume the asymmetry runs the other way.
 *
 * **The heading says *no verificamos* and never *no verificado*.** The past
 * participle is on `voice.md`'s Never-say list in any construction implying that
 * we verify, and a heading built from it would trip `testing/voice.ts` as well —
 * which is the machine noticing what the guide already said.
 */
const VERIFICATION: StandingNotice = {
  key: "verification",
  heading: "Aquí no verificamos a nadie",
  body: [
    "No comprobamos que quien publica haya perdido su trabajo. Tampoco que quien envía una propuesta sea quien dice ser. El nombre y el teléfono de quien envía una propuesta los escribió esa misma persona, igual que los tuyos.",
    "Lo que sí hacemos: una persona lee cada propuesta antes de que te llegue. Y tu teléfono no sale de aquí hasta que tú aceptes.",
  ],
};

/**
 * **The platform holds no money**, and the third sentence is the one that costs
 * something to write down.
 *
 * ADR-0007: *"We hold nothing, so we can refund nothing and withhold nothing.
 * The site says so plainly rather than implying a protection that does not
 * exist — an implied guarantee is worse than none, because it is relied upon."*
 * That last clause is why the sentence is here and not softened into *el pago es
 * entre ustedes*, which is true and says nothing about what happens when it goes
 * wrong.
 *
 * *Comisión* rather than *tarifa* and *pago* rather than *transacción*: the
 * `Say` list's words, in the register a person uses about being paid.
 */
const MONEY: StandingNotice = {
  key: "money",
  heading: "Por aquí no pasa el dinero",
  body: [
    "No cobramos comisión y no guardamos ni un peso. El pago lo arreglan ustedes dos, por fuera de esta página.",
    "Si no te pagan, no podemos devolverte nada ni retenerle nada a nadie.",
  ],
};

/**
 * **What a Block reaches, and what it does not** — the statement the ticket calls
 * the one most easily lost.
 *
 * Three things about its shape are deliberate.
 *
 * **It defines a Block before it bounds one.** No Offer surface exists yet, so a
 * reader meeting this on the Wall has never seen the thing being described, and
 * `voice.md` refuses a sentence only somebody who already knows the product can
 * parse. That is why it opens on *si alguien te incomoda* rather than on
 * *bloquear*.
 *
 * **It never says she becomes invisible**, because she does not.
 * `CONTEXT.md`'s Block entry bans that description by name, and C3 accepted the
 * cost out loud: the person she refused keeps reading her `about` and her work
 * history for as long as the profile is up. The third sentence is that cost,
 * stated rather than implied.
 *
 * **The verb is rephrased around gender, not slashed.** *Bloquear a esa persona*
 * rather than *bloquearlo*, which is `voice.md`'s own worked example of this rule
 * and costs a screen-reader user nothing.
 */
const BLOCK: StandingNotice = {
  key: "block",
  heading: "Bloquear detiene las propuestas y nada más",
  body: [
    "Si alguien te incomoda, puedes bloquear a esa persona sin dar razones. Entonces deja de poder enviarte propuestas, y eso es todo lo que alcanza.",
    "Tu perfil sigue en el muro y esa persona puede seguir leyéndolo.",
  ],
};

/**
 * The three, in the order they are read.
 *
 * **The order is not arbitrary and is not open.** Verification first because it
 * is the claim every other product in this category makes and this one refuses;
 * money second because it is what a reader assumes a platform holds; the Block
 * third because it is the only one that needs the first two to make sense — she
 * is deciding what protection she has, and the answer is bounded by both.
 */
export const STANDING_NOTICES: readonly StandingNotice[] = [VERIFICATION, MONEY, BLOCK];
