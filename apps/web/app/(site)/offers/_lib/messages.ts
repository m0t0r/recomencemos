/**
 * Every `es-CO` string the ledger renders — at `/offers`, and at `/offers/[id]`,
 * which is the same ledger with one row open — in one module under
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

import type { ReceivedOfferState } from "@repo/domain/offers";

export const RECEIVED_OFFERS_TITLE = "Propuestas que recibiste";
export const RECEIVED_OFFERS_HEADING = "Propuestas que recibiste";

/** The lead: the human review, and the one fact about her number, before any row. */
export const RECEIVED_OFFERS_LEAD =
  "Una persona lee cada propuesta antes de que te llegue. Tu teléfono no sale de aquí hasta que aceptes una.";

/**
 * How many still wait on her, under the heading (#271). A count in words and
 * nothing more — no colour, no badge, no word that means hurry — which is the
 * voice guide's row for reading an Offer applied to a number.
 */
export function waitingCount(count: number): string {
  if (count === 0) return "Ninguna espera tu respuesta.";

  return count === 1 ? "1 espera tu respuesta." : `${count} esperan tu respuesta.`;
}

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
 * The `error` cell. **The middle clause is the point**: a failed read is not a
 * lost decision, and a Worker who answered one a minute ago needs to know which
 * of the two just happened.
 */
export const RECEIVED_OFFERS_FAILED_TITLE = "No pudimos cargar tus propuestas";
export const RECEIVED_OFFERS_FAILED_EXPLANATION =
  "Falló la carga. Nada de lo que respondiste cambió. Vuelve a intentarlo.";
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
 *
 * **Keyed on the domain's own list of received states**, so a state added there
 * is a type error here rather than a row that silently stops rendering.
 */
export const RECEIVED_STATE_LABELS: Readonly<Record<ReceivedOfferState, string>> = {
  delivered: "Por responder",
  accepted: "Aceptada",
  declined: "No aceptada",
  expired: "Vencida",
};

export const RECEIVED_STATE_SENTENCES: Readonly<Record<ReceivedOfferState, string>> = {
  delivered: "Espera tu respuesta.",
  accepted: "La aceptaste.",
  declined: "No la aceptaste. Quien la envió no recibió ninguno de tus datos.",
  expired: "Se venció sin respuesta.",
};

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

const HOUR_MS = 60 * 60 * 1000;
const RELATIVE = new Intl.RelativeTimeFormat("es-CO", { numeric: "always" });

/**
 * How long ago he sent it, on the row's first line — the moment `offerSentOn`
 * names in full once the row is open. The projection carries no delivery time,
 * and adding one would be a domain change this surface does not need.
 *
 * **Elapsed hours, then elapsed days, and never _ayer_.** Thirty hours ago can be
 * the day before yesterday on the calendar, and a word she can check against her
 * own memory should be true. A clock running ahead of the server's reads as just
 * arrived rather than as a negative count.
 */
export function sentAgo(sentAt: Date, now: Date): string {
  const hours = Math.floor(Math.max(0, now.getTime() - sentAt.getTime()) / HOUR_MS);

  if (hours < 1) return "hace menos de una hora";
  if (hours < 24) return RELATIVE.format(-hours, "hour");

  return RELATIVE.format(-Math.floor(hours / 24), "day");
}

/**
 * The name a row leads with, **said as a signature rather than an identity**.
 * _Firma como_ is true of a person and of a business, and it says the name is
 * what they signed with rather than what we checked; an Offer with no name says
 * so rather than rendering a blank. No full stop: it is the row's heading.
 */
export function rowSignature(hirerName: string | null): string {
  return hirerName === null ? "Firma sin nombre" : `Firma como ${hirerName}`;
}

/**
 * Who claims to be asking, inside an open row. **The absence leads** (Do 2):
 * nothing here verifies anybody, and that sentence is said before the name
 * rather than after it — and whether or not there is a name to say it about.
 */
export const SENDER_LABEL = "Quien la envía";
export const SENDER_ABSENCE = "Aquí no verificamos a nadie.";
export const SENDER_NAMED_NOTE = "Este nombre lo escribió quien envía la propuesta.";
/** An Offer written before the platform asked senders to name themselves (C4). */
export const SENDER_UNNAMED = "Quien envía esta propuesta no escribió su nombre.";

/** The answer region's heading, and the two first-step controls — same words, same weight. */
export const ANSWER_HEADING = "Tu respuesta";
export const ACCEPT = "Aceptar";
export const DECLINE = "No aceptar";
export const CANCEL = "Volver";

/**
 * **The second step of accepting — voice guide pair 4, and the sentence this
 * whole surface is arranged around.** It names the person, the three fields each
 * way, and the asymmetry: _once he has them, he has them_ is the irreversibility
 * said as a fact about people rather than as a UI constraint.
 *
 * The name is his claim and may be absent, in which case the sentence names the
 * role instead of inventing a person — in lower case, because it sits mid-sentence.
 */
export function acceptConsequence(hirerName: string | null): string {
  const who = hirerName ?? "quien envía la propuesta";

  return `Si aceptas, ${who} recibe tu nombre completo, tu teléfono y tu correo. Tú recibes los suyos.`;
}

export const ACCEPT_IRREVERSIBLE =
  "Esto no se puede deshacer: una vez que tiene tus datos, ya los tiene.";

/** The button that commits. The verb of the act, never _Confirmar_ (voice.md, Sentences). */
export const ACCEPT_CONFIRM = "Aceptar y dar mis datos";

/** Busy labels, one per act, so a screen reader hears which one is running. */
export const ACCEPTING = "Aceptando…";
export const DECLINING = "Guardando tu respuesta…";

/**
 * What she lands on after answering, inside the row she answered. **Declined
 * stays confirmed rather than vanishing** — the row's state line says it again
 * on every later visit; this is the sentence announced at the moment it happens.
 */
export const JUST_ACCEPTED = "Aceptaste esta propuesta.";
export const JUST_DECLINED =
  "No aceptaste esta propuesta. Quien la envió no recibió ninguno de tus datos.";

/** Two tabs, or a double tap: the row below already shows the answer she gave. */
export const ALREADY_ANSWERED = "Ya respondiste esta propuesta. Esto es lo que respondiste.";

/**
 * An answer to an Offer that is no longer hers to answer. **What happened, and
 * what she can do next** (Do 3): the rest of her Offers are where they were.
 */
export const OFFER_GONE =
  "Ya no puedes responder esta propuesta. Las demás siguen en tus propuestas recibidas.";
