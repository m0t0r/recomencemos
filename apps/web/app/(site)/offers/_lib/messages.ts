/**
 * Every `es-CO` string `/offers` and `/offers/[id]` render, in one module under
 * `docs/policy/voice.md`.
 *
 * Tone is the voice guide's **Reading an Offer (Worker)** row, unchanged:
 * everything in front of her, nothing nudging. No _¡Nueva propuesta!_, no
 * countdown, no default-highlighted Accept — and so no exclamation mark
 * anywhere, the success lines included. Accepting is the one place the
 * **Contact Exchange** row reaches back into this page: the confirmation names
 * exactly which fields cross and that it cannot be undone.
 *
 * **The product does not name her**, and it does not gender him: the Hirer is
 * _quien envía la propuesta_ wherever a pronoun would otherwise have to guess
 * (voice.md, "Grammatical gender is handled by rephrasing").
 */

import type { OfferState } from "@repo/domain/offers";

export const RECEIVED_OFFERS_TITLE = "Propuestas que recibiste";
export const RECEIVED_OFFERS_HEADING = "Propuestas que recibiste";

/** The lead: the human review, and the one fact about her number, before any row. */
export const RECEIVED_OFFERS_LEAD =
  "Una persona lee cada propuesta antes de que te llegue. Tu teléfono no sale de aquí hasta que aceptes una.";

/**
 * Nothing has reached her. **What makes one arrive, and that a person reads it
 * first** — the spec's own `empty` cell, both clauses. A good state rather than
 * an error: nobody has failed at anything.
 */
export const RECEIVED_OFFERS_EMPTY_HEADING = "Todavía no te ha llegado ninguna propuesta";
export const RECEIVED_OFFERS_EMPTY_BODY =
  "Te llega una cuando alguien lee tu perfil y te escribe qué trabajo necesita, cuánto paga y cuándo. Antes de que te llegue, una persona la lee.";
export const RECEIVED_OFFERS_EMPTY_LINK = "Ver tu perfil";

/** The same state, for an Account with no profile yet: an Offer is addressed to a profile. */
export const RECEIVED_OFFERS_NO_PROFILE_BODY =
  "Las propuestas llegan a un perfil. Cuando publiques el tuyo, quien lo lea puede escribirte.";
export const RECEIVED_OFFERS_NO_PROFILE_LINK = "Publica lo que sabes hacer";

/**
 * The `error` cell. **The last clause is the point**: a failed read is not a
 * lost decision, and a Worker who answered one a minute ago needs to know which
 * of the two just happened.
 */
export const RECEIVED_OFFERS_FAILED_TITLE = "No pudimos cargar tus propuestas";
export const RECEIVED_OFFERS_FAILED_EXPLANATION =
  "Falló la carga. Nada de lo que respondiste cambió. Vuelve a intentarlo.";
export const RECEIVED_OFFER_FAILED_TITLE = "No pudimos cargar esta propuesta";
export const OFFERS_FAILED_RETRY = "Volver a cargar";
export const OFFERS_FAILED_RETRYING = "Cargando…";

/** Announced once when the list resolves, rather than per row. */
export function receivedOffersCount(count: number): string {
  return count === 1 ? "1 propuesta" : `${count} propuestas`;
}

/**
 * The label a row's state carries — for the scan — and the sentence beside it,
 * for the answer. `/sent-offers` settled both halves: text rather than colour,
 * and never red.
 */
export const RECEIVED_STATE_LABELS = {
  delivered: "Por responder",
  accepted: "Aceptada",
  declined: "No aceptada",
  expired: "Vencida",
} as const satisfies Partial<Record<OfferState, string>>;

export const RECEIVED_STATE_SENTENCES = {
  delivered: "Espera tu respuesta.",
  accepted: "La aceptaste.",
  declined: "No la aceptaste. Quien la envió no recibió ninguno de tus datos.",
  expired: "Se venció sin respuesta.",
} as const satisfies Partial<Record<OfferState, string>>;

export type ReceivedState = keyof typeof RECEIVED_STATE_LABELS;

/** Narrow a state to one this surface renders; anything else is not hers to see. */
export function asReceivedState(state: OfferState): ReceivedState | undefined {
  return state in RECEIVED_STATE_LABELS ? (state as ReceivedState) : undefined;
}

/** The terms, under the labels the sender's surface uses for the same three fields. */
export const OFFER_WORK_LABEL = "El trabajo";
export const OFFER_PAY_LABEL = "El pago";
export const OFFER_WHEN_LABEL = "Cuándo";

/** `es-CO`, long form — never `08/10/2026`. */
export function offerSentOn(sentAt: Date): string {
  const date = new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(sentAt);

  return `Enviada el ${date}`;
}

/** A row's link. It names its destination — never _aquí_. */
export const OPEN_OFFER_LINK = "Leer la propuesta";

/**
 * Who claims to be asking. **The absence leads** (Do 2): nothing here verifies
 * anybody, and the name is what that person typed.
 */
export const SENDER_LABEL = "Quien la envía";
export const SENDER_DECLARED =
  "Aquí no verificamos a nadie. Este nombre lo escribió quien envía la propuesta.";
/** An Offer written before the platform asked senders to name themselves (C4). */
export const SENDER_UNNAMED = "Quien envía esta propuesta no escribió su nombre.";

/**
 * The name on a row, **said as a claim**. _Firma como_ rather than _se llama_:
 * it is true of a person and of a business, and it says the name is what they
 * signed with rather than what we checked.
 */
export function senderClaim(hirerName: string | null): string {
  return hirerName === null ? SENDER_UNNAMED : `Firma como ${hirerName}.`;
}

export const RECEIVED_OFFER_TITLE = "Propuesta";
export const RECEIVED_OFFER_HEADING = "Una propuesta de trabajo";
export const BACK_TO_OFFERS = "Volver a tus propuestas";

/** The answer region's heading, and the two first-step controls — same words, same weight. */
export const ANSWER_HEADING = "Tu respuesta";
export const ACCEPT = "Aceptar";
export const DECLINE = "No aceptar";
export const CANCEL = "Volver";

/**
 * **The second step of accepting — voice guide pair 4, and the sentence this
 * whole page is arranged around.** It names the person, the three fields each
 * way, and the asymmetry: _once he has them, he has them_ is the irreversibility
 * said as a fact about people rather than as a UI constraint.
 *
 * The name is his claim and may be absent, in which case the sentence names the
 * role instead of inventing a person.
 */
export function acceptConsequence(hirerName: string | null): string {
  const who = hirerName ?? "Quien envía la propuesta";

  return `Si aceptas, ${who} recibe tu nombre completo, tu teléfono y tu correo. Tú recibes los suyos.`;
}

export const ACCEPT_IRREVERSIBLE =
  "Esto no se puede deshacer: una vez que tiene tus datos, ya los tiene.";

/** The button that commits. The verb of the act, never _Confirmar_ (voice.md, Sentences). */
export const ACCEPT_CONFIRM = "Aceptar y dar mis datos";

/** Declining crosses nothing, and ends the Offer. Both halves are said. */
export const DECLINE_CONSEQUENCE =
  "Si no la aceptas, quien la envió no recibe ninguno de tus datos. Esto no se puede deshacer.";
export const DECLINE_CONFIRM = "No aceptar esta propuesta";

/** Busy labels, one per act, so a screen reader hears which one is running. */
export const ACCEPTING = "Aceptando…";
export const DECLINING = "Guardando tu respuesta…";

/**
 * What she lands on after answering. **Declined stays confirmed rather than
 * vanishing** — this is the state line on every later visit as well, not a toast
 * that is gone by the next one.
 */
export const JUST_ACCEPTED = "Aceptaste esta propuesta.";
export const JUST_DECLINED =
  "No aceptaste esta propuesta. Quien la envió no recibió ninguno de tus datos.";

/** Refusals an answer can meet — two tabs, or an Offer that went away meanwhile. */
export const ALREADY_ANSWERED = "Ya respondiste esta propuesta. Esto es lo que respondiste.";
export const OFFER_GONE = "Esta propuesta ya no está disponible.";
