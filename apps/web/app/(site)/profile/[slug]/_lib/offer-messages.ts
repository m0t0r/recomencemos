/**
 * Every `es-CO` string the Offer form renders, in one module under
 * `docs/policy/voice.md`.
 *
 * **The tone matrix has a row for exactly this surface** — *Writing an Offer*,
 * Warmth 5→3, Confidence 4→5, and the rule that the human review and the
 * immutability are stated **before he writes, not after he submits**. He is not
 * the person this voice protects, and the copy here is shorter, flatter and more
 * certain than anything a Worker reads.
 *
 * **The refusals are the exception, and they keep Warmth 5.** A refusal is our
 * rule and never his mistake, whoever is reading it — so each says what happened,
 * what he can do about it, and that nothing he typed was lost.
 *
 * The contact-detail sentences are this surface's own rather than the publishing
 * form's, because the publishing form's are addressed to her about her own
 * number. His reason for not putting a number in the body is a different reason:
 * she has not decided yet, and a number in the text is a way around the decision.
 */

/** The heading over the form. A verb about what he is doing. */
export const OFFER_HEADING = "Escríbele una propuesta";

/**
 * The two facts, before the first field.
 *
 * This is the acceptance criterion and it is also the tone row: a Hirer who
 * learns after submitting that a person reads it first has learned it too late
 * to have written differently. Present tense, actor visible (Do 1).
 */
export const OFFER_REVIEW_NOTICE = "Una persona lee cada propuesta antes de que le llegue.";
export const OFFER_REVIEW_WINDOW = "Normalmente toma menos de un día.";
export const OFFER_IMMUTABLE_NOTICE = "No vas a poder cambiarla después de enviarla.";

/** The three fields, in the order the story names them: the work, the pay, the when. */
export const WORK_LABEL = "El trabajo";
export const WORK_HELP = "Qué necesitas que haga, en concreto.";

export const PAY_LABEL = "El pago";
export const PAY_HELP = "Cuánto pagas y cuándo lo pagas.";

export const WHEN_LABEL = "Cuándo";
export const WHEN_HELP = "Qué día y a qué hora lo necesitas.";

/**
 * The two identity fields, shown only on his first Offer.
 *
 * **Both help lines say nobody verifies them**, which is ADR-0008 read from the
 * side that usually goes unsaid: story 11's standing notice tells *her* that a
 * Hirer's name and phone are self-asserted, and this tells *him* that what he
 * writes is what she reads, unchecked. It is the same fact and he is the one who
 * can act on it.
 */
export const HIRER_NAME_LABEL = "Tu nombre";
export const HIRER_NAME_HELP = "Ella lee el nombre que escribas. Nadie lo comprueba.";

export const HIRER_PHONE_LABEL = "Tu teléfono";
export const HIRER_PHONE_HELP = "Se lo damos solo si ella acepta. Nadie lo comprueba.";

/** The submit control: the verb of its action, and never *Enviar* alone. */
export const SEND_OFFER_BUTTON = "Enviar la propuesta";
export const SEND_OFFER_PENDING = "Enviando…";

/*
  **The confirmation is not here, and its absence is the fix.** Four constants
  sat in this module — a heading, the review sentence, the immutability sentence
  and a link — written for a confirmation this surface never renders: the send
  redirects, so what a person actually reads afterwards is `/sent-offers`. They
  were copy-tested and rendered nowhere, which is the worst of both, and the
  review of this change is what found them. The three clauses now live in that
  route's own messages module, beside the page that says them.
*/

/** The form-level summary, where focus lands on a failed submit. */
export function offerSummaryHeading(count: number): string {
  return count === 1 ? "Hay una cosa por corregir" : `Hay ${count} cosas por corregir`;
}

export const OFFER_SUMMARY_KEPT = "Todo lo que escribiste sigue en el formulario.";
export const OFFER_SUMMARY_LABEL = "Qué falta por corregir";

/**
 * The *autorización* left unticked on his first Offer.
 *
 * **This surface's own sentence rather than the publishing form's**, because the
 * verb is the act he took: she publishes, he sends. It keeps a refusal's Warmth
 * 5 by saying what to do and nothing about him — the rule is ours, and leaving
 * a box unticked is not a mistake.
 */
export const OFFER_CONSENT_REQUIRED = "Para enviar tu propuesta, marca la autorización.";

/** The field names the summary links to, as a person reads them. */
export const OFFER_FIELD_LABELS = {
  consent: "La autorización",
  workDescription: WORK_LABEL,
  payTerms: PAY_LABEL,
  whenText: WHEN_LABEL,
  hirerName: HIRER_NAME_LABEL,
  hirerPhone: HIRER_PHONE_LABEL,
} as const;

export type OfferFieldName = keyof typeof OFFER_FIELD_LABELS;

/**
 * What a rejected contact detail says to him (NFR12).
 *
 * Do 4 — the fragment is quoted back so he can find it in his own text — and the
 * second sentence is the reason, aimed at the process rather than at him: the
 * decision is hers, and a number in the body is a way past it. No copy here
 * claims the field is a filter, because it is not: a person reads every Offer,
 * and that is the control.
 */
export function offerContactDetailRefusal(
  kind: "phone" | "email" | "messaging_url",
  fragment: string,
): string {
  const detail =
    kind === "phone" ? "un número de teléfono" : kind === "email" ? "un correo" : "un enlace";

  return (
    `Esto tiene ${detail}: «${fragment}». Quítalo y vuelve a intentarlo. ` +
    "Si ella acepta, nosotros le damos tu teléfono y tu correo."
  );
}

/** A number this product cannot read back. What to do about it is in the sentence. */
export const HIRER_PHONE_LOOKS_WRONG =
  "No pudimos leer ese número. Escríbelo con los diez dígitos, o con el indicativo de tu país.";

/** A first Offer with no name on it. */
export const HIRER_NAME_REQUIRED = "Escribe el nombre que ella va a leer.";

/** Each field's own length bound, said as what to do rather than as a rule. */
export const WORK_TOO_SHORT = "Cuenta un poco más de qué se trata el trabajo.";
export const WORK_TOO_LONG = "Esto es muy largo. Déjalo en 600 caracteres o menos.";
export const PAY_REQUIRED = "Escribe cuánto vas a pagar.";
export const PAY_TOO_LONG = "Esto es muy largo. Déjalo en 120 caracteres o menos.";
export const WHEN_REQUIRED = "Escribe cuándo necesitas el trabajo.";
export const WHEN_TOO_LONG = "Esto es muy largo. Déjalo en 120 caracteres o menos.";
export const HIRER_NAME_TOO_LONG = "Esto es muy largo. Déjalo en 80 caracteres o menos.";

/**
 * The refusals that are about him rather than about a field.
 *
 * **The Blocked sentence is the one this surface argued for**, and
 * `.impeccable/briefs/send-offer.md` carries the argument: it says this person is
 * not receiving Offers from him, and nothing about who decided, when, or why. The
 * alternative — the missing-profile answer a frozen caller gets one route over —
 * is a lie he can catch, because her card is still on the Wall and his reading of
 * her profile is still open (C3).
 */
export const OFFER_BLOCKED =
  "Esta persona no está recibiendo propuestas tuyas. En el muro hay más personas que ofrecen su trabajo.";

/** His own Account is frozen while a person reads a Report about it. */
export const OFFER_SENDING_FROZEN =
  "No puedes enviar propuestas mientras una persona revisa un reporte sobre tu cuenta. Nada de lo que escribiste se perdió.";

/** Terminal, and said as such. */
export const OFFER_SENDING_BANNED = "Tu cuenta ya no puede enviar propuestas.";

/** The profile went away between the page load and the submit. */
export const OFFER_PROFILE_GONE =
  "Este perfil ya no está disponible. En el muro están las personas que ofrecen su trabajo.";

/** He is looking at his own profile. */
export const OFFER_OWN_PROFILE = "Este es tu propio perfil, así que no hay a quién escribirle.";

/**
 * A transport fault, per surface — *no pudimos enviar tu propuesta* names the
 * act he actually took, which a shared sentence could not.
 */
export const OFFER_SEND_FAILED =
  "No pudimos enviar tu propuesta. No se envió nada; vuelve a intentarlo.";

/** The page is older than the *autorización* it displayed. */
export const OFFER_PAGE_STALE =
  "Esta página quedó vieja. Vuelve a cargarla y envía la propuesta otra vez.";
