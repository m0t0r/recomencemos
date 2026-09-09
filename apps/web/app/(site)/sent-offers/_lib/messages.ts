/**
 * Every `es-CO` string `/sent-offers` renders, in one module under
 * `docs/policy/voice.md`.
 *
 * **This is the only surface where the platform's own delay is visible to the
 * person waiting on it**, which is what the copy here is for: a state per row,
 * the normal window said before it is exceeded, and — past it — a plain sentence
 * rather than a colour or a badge. He cannot act on our queue depth, so an alarm
 * aimed at him would be pressure rather than information.
 *
 * Tone is *Writing an Offer*'s neighbour: Warmth 3, Directness 5, Energy 2. No
 * exclamation mark anywhere but the one success line, and not even there.
 */

export const SENT_OFFERS_TITLE = "Propuestas que enviaste";
export const SENT_OFFERS_HEADING = "Propuestas que enviaste";

/** The one-line explanation under the heading: what this page is for. */
export const SENT_OFFERS_LEAD =
  "Una persona lee cada propuesta antes de que le llegue a quien se la escribiste.";

/** He has sent none. Say what sending one is for, and route into the list. */
export const SENT_OFFERS_EMPTY_HEADING = "Todavía no has enviado ninguna propuesta";
export const SENT_OFFERS_EMPTY_BODY =
  "Una propuesta dice qué trabajo necesitas, cuánto pagas y cuándo. Escríbele a alguien de la lista.";
export const SENT_OFFERS_EMPTY_LINK = "Ver todos los perfiles";

/** The confirmation, when he has just sent one. */
export const OFFER_JUST_SENT = "Tu propuesta va en camino.";

/** The list failed to load. What failed, and that retrying helps. */
export const SENT_OFFERS_FAILED =
  "No pudimos cargar tus propuestas. Vuelve a cargar la página para intentarlo otra vez.";

/** What a row says about where its Offer is. One sentence per state. */
export const OFFER_STATE_SENTENCES = {
  /** Waiting, inside the window. The window is stated here rather than only when missed. */
  pending_review: "Una persona la está leyendo. Normalmente toma menos de un día.",
  /**
   * Also waiting, and he is told the same thing. **Deliberately not "your account
   * is under review"**: an Offer on hold is held because of something on our side
   * and telling him about a Report on this page would be telling him here rather
   * than where his own state belongs.
   */
  on_hold: "Una persona la está leyendo. Normalmente toma menos de un día.",
  delivered: "Ya le llegó. Ahora ella decide.",
  accepted: "Aceptó tu propuesta. Te enviamos sus datos por correo.",
  declined: "No aceptó esta propuesta.",
  expired: "Se venció sin respuesta.",
  rejected_by_admin: "No la dejamos pasar. No le llegó a nadie.",
  reported: "Alguien reportó esta propuesta. La estamos revisando.",
} as const;

/**
 * Past the window, and the sentence C41 asks for: **plainly, that this one is
 * taking longer than usual.**
 *
 * It replaces the waiting sentence rather than sitting beside it, so a row says
 * one thing about where it is. *Seguimos leyéndola* is the actor made visible
 * (Do 1) — the delay is ours and the sentence says so without apologising for a
 * queue one unpaid person is working.
 */
export const OFFER_REVIEW_DELAYED = "Esta se está demorando más de lo normal. Seguimos leyéndola.";

/** The heading over the terms he wrote, per row. */
export const OFFER_TERMS_LABEL = "Lo que escribiste";
export const OFFER_WORK_LABEL = "El trabajo";
export const OFFER_PAY_LABEL = "El pago";
export const OFFER_WHEN_LABEL = "Cuándo";

/** Who it went to, and the link to her profile. */
export function offerRecipient(firstName: string, lastInitial: string): string {
  return `Para ${firstName} ${lastInitial}.`;
}

export const OFFER_PROFILE_LINK = "Ver el perfil";

/** The date a row carries. `es-CO`, long form — never `08/10/2026`. */
export function offerSentOn(sentAt: Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(sentAt);
}

/** Announced once when the list resolves, rather than per row. */
export function sentOffersCount(count: number): string {
  return count === 1 ? "1 propuesta" : `${count} propuestas`;
}
