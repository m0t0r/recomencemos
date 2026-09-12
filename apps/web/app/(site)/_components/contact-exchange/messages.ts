/**
 * Every `es-CO` string the Contact Exchange renders, on her received row and on
 * his sent one, in one module under `docs/policy/voice.md`.
 *
 * Tone is the tone matrix's **Contact Exchange** row: Energy 2→3, Directness 5
 * unchanged — it names exactly which fields crossed, and it says the email is a
 * **copy** of what is already on screen. That second clause is why every copy
 * line below says where the details are before it says anything about a mail.
 *
 * **The product does not gender either party.** _Quien te envió la propuesta_
 * and _la persona a quien le escribiste_ carry the role; _sus datos_ and
 * _aceptó_ carry nothing a pronoun would have to guess (voice.md, "Grammatical
 * gender is handled by rephrasing").
 */

import type { CopyState, ExchangeSide, ExchangedParty } from "@repo/domain/exchange";
import { formatColombianPhone } from "@repo/domain/policy";

/** The region's heading, per reader: whose details these are. */
export const EXCHANGE_HEADING: Readonly<Record<ExchangeSide, string>> = {
  worker: "Los datos de quien te envió la propuesta",
  hirer: "Los datos de la persona a quien le escribiste",
};

/**
 * The card's last sentence: the platform's part is over. Principle 1 —
 * _introduce, then leave_ — said plainly, so nobody waits for a next step here.
 */
export const EXCHANGE_LEAD = "Desde aquí, lo que sigue es entre ustedes dos.";

/** The three labels. The Worker's name is her full one; his is whatever he wrote. */
export const EXCHANGE_LABELS: Readonly<
  Record<ExchangeSide, { readonly name: string; readonly phone: string; readonly email: string }>
> = {
  worker: { name: "Nombre", phone: "Teléfono", email: "Correo" },
  hirer: { name: "Nombre completo", phone: "Teléfono", email: "Correo" },
};

/**
 * The control beside each detail, and what it says for a moment after it
 * worked. The detail it copies is added for a screen reader, not shown.
 */
export const COPY_DETAIL = "Copiar";
export const COPIED = "Copiado";

/**
 * The control's accessible name for that moment — _Correo copiado_, the order
 * Spanish says it in. It still contains the visible word (WCAG 2.5.3).
 */
export function copiedName(label: string): string {
  return `${label} copiado`;
}

/**
 * The disclosure the terms fold into under the card, per reader: she agreed to
 * them, he wrote them. A control, so five words at most; the three labels
 * inside it name what opening it shows.
 */
export const FOLDED_TERMS: Readonly<Record<ExchangeSide, string>> = {
  worker: "Lo que aceptaste",
  hirer: "Lo que propusiste",
};

/** What stands in for a Hirer who gave no name or number (C4). Only he can be absent. */
export const NO_NAME = "No escribió su nombre.";
export const NO_PHONE = "No dejó un teléfono.";

/**
 * **His name and number are his own claim**, and she reads that beside them
 * rather than in a notice she may not have opened — the standing notice's own
 * words, cut to the one clause that bears on what is in front of her.
 */
export const EXCHANGE_CLAIM: Readonly<Record<ExchangeSide, string>> = {
  worker: "Aquí no verificamos a nadie. Su nombre y su teléfono los escribió esa misma persona.",
  hirer: "Aquí no verificamos a nadie. Estos datos los escribió esa misma persona.",
};

/**
 * **Both sides' details, once** — the success state. What the reader gave is
 * said here, in one sentence, so she knows exactly what the other person now
 * holds. A missing name or number is left out of the list rather than named as
 * missing: this is what crossed, and nothing else did.
 */
export function ownGiven(side: ExchangeSide, own: ExchangedParty): string {
  const details = [
    own.fullName,
    own.phone ? formatColombianPhone(own.phone) : null,
    own.email,
  ].filter((detail): detail is string => detail !== null);
  const listed =
    details.length > 1 ? `${details.slice(0, -1).join(", ")} y ${details.at(-1)}` : details[0];

  return side === "worker"
    ? `Quien te envió la propuesta recibió los tuyos: ${listed}.`
    : `Esa persona recibió los tuyos: ${listed}.`;
}

/**
 * The copy line, per state. **Every one says the page is where the details are
 * before it says anything about the mail** — the voice guide's Contact Exchange
 * row, and the brief's third criterion — so a failed copy reads as what it is: a
 * copy that did not go out, of something she already has.
 *
 * _Tu correo_ rather than the address: the sentence below already names it,
 * and the success state asks for each detail once. _En esta página_ rather than
 * _aquí_, which the voice guide keeps for nothing — a bare _aquí_ is the empty
 * link text it bans.
 */
export const COPY_LINES: Readonly<Record<CopyState, string>> = {
  sent: "Es solo una copia de lo que ves en esta página: te la enviamos a tu correo.",
  pending: "Es solo una copia de lo que ves en esta página: te la estamos enviando a tu correo.",
  failed: "Los datos siguen en esta página. No pudimos enviarte la copia por correo.",
};
