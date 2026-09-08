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
 * One statement, in three parts, and the split is a **requirement rather than a
 * layout convenience**.
 *
 * The disclosure treatment puts `detail` behind a tap. That is only honest if
 * what stays on screen is complete enough to satisfy the ticket on its own — and
 * the first cut of this file failed exactly there: `/code-review`'s Spec axis
 * found that the clause naming a Hirer's details as self-asserted, and the clause
 * saying a Block does **not** remove her from the Wall, were both collapsed by
 * default on the two surfaces where they matter most. The ticket singles the
 * second one out as _"the one most easily lost"_, and hiding it by default is one
 * way of losing it.
 *
 * So each statement now carries:
 *
 * - `heading` — the absence, stated whole. `voice.md`'s Do 2, *"put the absence
 *   first when there is one"*.
 * - `lead` — **one sentence, always on screen in both treatments**: what this
 *   absence costs the reader. Never behind a disclosure, and every clause an
 *   acceptance criterion names by hand lives here.
 * - `detail` — what we do instead, and how the thing works. The elaboration, and
 *   the only part a tap reveals.
 *
 * A reader who reads only the headings and the leads has been told the three
 * things this component exists to tell them, including the parts that cost
 * something to learn.
 */
export interface StandingNotice {
  /** Stable, English, and the `id` a heading is addressed by. ADR-0012: identifiers are English. */
  readonly key: "verification" | "money" | "block";
  readonly heading: string;
  /** Always visible. What the absence in the heading costs the reader. */
  readonly lead: string;
  /** Behind the disclosure where there is one. What we do instead, and how it works. */
  readonly detail: readonly string[];
}

/**
 * **Nobody is verified**, and a Hirer's own details are self-asserted too.
 *
 * The heading and the `detail` are `voice.md`'s approved rendering, in its order.
 * The `lead` is C4's clause and is this ticket's third acceptance criterion: he
 * types his name and phone at first send, and nothing checks either — so hers
 * are no more and no less trustworthy than his, and the copy says so rather than
 * leaving her to assume the asymmetry runs the other way.
 *
 * **It is the lead rather than the third sentence of the detail, and that is the
 * review's finding.** The criterion asks that his details be *named* as
 * self-asserted; collapsed inside a disclosure on the two surfaces an anonymous
 * Hirer actually meets, they were named to nobody who did not tap. Promoting it
 * reorders `voice.md`'s sequence by one clause and keeps every sentence of it.
 *
 * **The heading says *no verificamos* and never *no verificado*.** The past
 * participle is on `voice.md`'s Never-say list in any construction implying that
 * we verify, and a heading built from it would trip `testing/voice.ts` as well —
 * which is the machine noticing what the guide already said.
 */
const VERIFICATION: StandingNotice = {
  key: "verification",
  heading: "Aquí no verificamos a nadie",
  lead: "El nombre y el teléfono de quien te escribe los escribió esa misma persona, igual que los tuyos.",
  detail: [
    "No comprobamos que quien publica haya perdido su trabajo. Tampoco que quien envía una propuesta sea quien dice ser.",
    "Lo que sí hacemos: una persona lee cada propuesta antes de que te llegue. Y tu teléfono no sale de aquí hasta que tú aceptes.",
  ],
};

/**
 * **The platform holds no money**, and the lead is the sentence that costs
 * something to write down.
 *
 * ADR-0007: *"We hold nothing, so we can refund nothing and withhold nothing.
 * The site says so plainly rather than implying a protection that does not
 * exist — an implied guarantee is worse than none, because it is relied upon."*
 * That last clause is why the sentence is the **lead** and not the detail: an
 * implied guarantee that is relied upon is not corrected by a paragraph nobody
 * opened, and *el pago es entre ustedes* is true while saying nothing at all
 * about what happens when it goes wrong.
 *
 * *Comisión* rather than *tarifa* and *pago* rather than *transacción*: the
 * `Say` list's words, in the register a person uses about being paid.
 */
const MONEY: StandingNotice = {
  key: "money",
  heading: "Por aquí no pasa el dinero",
  lead: "Si no te pagan, no podemos devolverte nada ni retenerle nada a nadie.",
  detail: [
    "No cobramos comisión y no guardamos ni un peso. El pago lo arreglan ustedes dos, por fuera de esta página.",
  ],
};

/**
 * **What a Block reaches, and what it does not** — the statement the ticket calls
 * the one most easily lost.
 *
 * Four things about its shape are deliberate.
 *
 * **The cost is the lead, and this is the statement that most needed it.** The
 * ticket calls this one _"the one most easily lost"_ and says what losing it
 * looks like — *a Block does not remove her from the public Wall*. In the first
 * cut that sentence sat in the second paragraph, behind a tap, on both public
 * surfaces. A protection somebody relies on because they did not open a
 * disclosure is the failure this whole component exists to prevent.
 *
 * **The heading defines a Block before the lead bounds one.** No Offer surface
 * exists yet, so a reader meeting this on the Wall has never seen the thing being
 * described, and `voice.md` refuses a sentence only somebody who already knows
 * the product can parse. *Bloquear detiene las propuestas* is the definition, and
 * *y nada más* is what the lead then makes concrete.
 *
 * **It never says she becomes invisible**, because she does not.
 * `CONTEXT.md`'s Block entry bans that description by name, and C3 accepted the
 * cost out loud: the person she refused keeps reading her `about` and her work
 * history for as long as the profile is up. The lead is that cost, stated rather
 * than implied.
 *
 * **The verb is rephrased around gender, not slashed.** *Bloquear a esa persona*
 * rather than *bloquearlo*, which is `voice.md`'s own worked example of this rule
 * and costs a screen-reader user nothing.
 */
const BLOCK: StandingNotice = {
  key: "block",
  heading: "Bloquear detiene las propuestas y nada más",
  lead: "Tu perfil sigue en el muro y esa persona puede seguir leyéndolo.",
  detail: [
    "Si alguien te incomoda, puedes bloquear a esa persona sin dar razones. Entonces deja de poder enviarte propuestas, y eso es todo lo que alcanza.",
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
