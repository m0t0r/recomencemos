/**
 * Every `es-CO` string `/my-profile` puts in front of a person. The authority
 * is [`docs/policy/voice.md`](../../../../../docs/policy/voice.md);
 * `my-profile-copy.test.ts` enforces its countable rules over every string here.
 *
 * The page answers one question — what is public, what is held, and what
 * happens to the held part — so nearly every string here names **who sees**
 * something. None says *seguro* or *verificado*: the platform holds her phone
 * until she accepts, and that is a fact about the process, not a promise about
 * the world.
 */

export const MY_PROFILE_PAGE_TITLE = "Tu perfil — Recomencemos";
export const MY_PROFILE_TITLE = "Tu perfil";

/**
 * The confirmation on arrival from `/publish`. One exclamation mark is the
 * voice guide's allowance for a success state; this one does without it,
 * because the sentence after it is the fact she came for.
 */
export const PUBLISHED_CONFIRMATION = "Tu perfil ya está publicado.";
export const PUBLISHED_EXPLANATION =
  "Desde ahora, quien busque a alguien para un trabajo puede encontrarte.";
/** Link text names its destination. */
export const WALL_LINK = "Ver el muro";

/**
 * Arrival from a saved edit — the spec's `success` cell for this surface, and
 * the reason the edit form redirects here rather than confirming in place: the
 * proof that a change took is the page showing what people can see.
 *
 * Two sentences, and neither mentions the Wall. An edit does not move her
 * position on it, and saying so would teach her that moving up is something
 * this site does.
 */
export const SAVED_CONFIRMATION = "Guardamos tus cambios.";
export const SAVED_EXPLANATION = "Así queda tu perfil desde ahora.";

/** The way to the edit form. The verb is hers, and it names what it changes. */
export const EDIT_LINK = "Cambiar mi perfil";

/** The three tiers, as headings. */
export const PUBLIC_HEADING = "Lo que ve todo el mundo";
export const GATED_HEADING = "Lo que ve quien abra tu perfil";
export const HELD_HEADING = "Lo que ve solo quien tú aceptes";
export const HELD_EXPLANATION =
  "Tu nombre completo, tu teléfono y tu correo se los damos solo a quien tú aceptes.";

/** Terms for the gated and held sections. */
export const ABOUT_TERM = "Más sobre tu trabajo";
export const WORK_HISTORY_TERM = "Dónde has trabajado";
export const FULL_NAME_TERM = "Nombre completo";
export const PHONE_TERM = "Teléfono";
export const EMAIL_TERM = "Correo";

/** When an optional field is empty: said plainly, and it is fine. */
export const NOTHING_MORE = "No escribiste nada más. Está bien así.";

/**
 * The `alt` on her own photo.
 *
 * **What the image shows, and nothing about her.** The voice guide's rule for
 * every meaningful image, applied to the one image in this product that is a
 * person: it names the thing, never the circumstances of whoever is in it.
 */
export const OWN_PHOTO_ALT = "Tu foto de perfil";

/**
 * The photo, **described rather than badged** (intent Q3), and this is the one
 * surface where the description and the picture disagree with every other one.
 *
 * `absent` and `rejected` render her initial, because there is no object: the
 * one was never attached and the other was deleted when it was refused. Both
 * say so as a fact rather than as a to-do.
 *
 * **`pending` renders her own photo**, and the sentence had to change with it.
 * It used to say _"mientras tanto se muestra tu inicial"_, which was true when
 * no photo path existed and became false the moment one did — the spec's cell
 * for this surface is her own photo shown, dignified, described as under review
 * and not flagged. A sentence describing a screen the reader is not looking at
 * is worse than no sentence.
 *
 * **What it must never say is that her *profile* is in review.**
 * `docs/policy/voice.md` bans that construction by name — _"nothing about her
 * profile is in review; her photo is"_ — and this ticket is the one where the
 * two facts are most easily confused: publishing waited for nobody, and the
 * photo is with a person.
 */
export const PHOTO_ABSENT = "Todavía no tienes foto. En su lugar se muestra tu inicial.";
export const PHOTO_PENDING =
  "Una persona está mirando tu foto. Tu perfil ya está publicado; la foto aparece cuando la revisen.";
/** The load failed: what failed, and that reloading helps. */
export const LOAD_FAILED_TITLE = "No pudimos cargar tu perfil";
export const LOAD_FAILED_EXPLANATION = "Tu perfil sigue publicado. Recarga la página para verlo.";
export const LOAD_FAILED_RETRY = "Recargar";
export const LOAD_FAILED_RETRYING = "Recargando";

export const PHOTO_REJECTED =
  "No pudimos publicar esa foto. Se muestra tu inicial; puedes subir otra.";

/** `10 de agosto de 2026` — never `10/08/2026`. */
const publishedDateFormat = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function publishedOn(date: Date): string {
  return `Publicado el ${publishedDateFormat.format(date)}.`;
}

/**
 * **Her Pause** (story 25). `CONTEXT.md` fixes the words: _Pausar mi perfil_,
 * and the state reads _en pausa_. Never _ocultar_, which is on the voice guide's
 * never-say list, and never _retirar_, which reads as a takedown — the one thing
 * she must not mistake her own choice for.
 *
 * **The state line is the first thing on the page**, so it says the fact and
 * what it means for her in two short sentences rather than a label. There is no
 * "since" on the visible line: nothing records when a pause ended, and the date
 * she published is not when she came back.
 */
export const PAUSE_SWITCH_LABEL = "Pausar mi perfil";
export const VISIBLE_LINE = "Tu perfil está en el muro y cualquiera puede encontrarlo.";
export function pausedSince(date: Date): string {
  return `Tu perfil está en pausa desde el ${publishedDateFormat.format(date)}.`;
}
export const PAUSED_EXPLANATION = "Nadie puede encontrarlo ni enviarte propuestas nuevas.";

/**
 * **The two limits she needs before relying on it**, beside the switch — the
 * spec's own sentence for this surface. Offers already sent still reach her,
 * and a pause cannot take back what someone already read. Both are facts about
 * the process, not promises about the world.
 */
export const PAUSE_LIMITS =
  "Las propuestas que ya te enviaron te siguen llegando. Pausar no borra lo que alguien ya leyó.";

/** Arrival after the switch — the same focused region publishing and saving use. */
export const PAUSED_CONFIRMATION = "Pusiste tu perfil en pausa.";
export const RESUMED_CONFIRMATION = "Tu perfil volvió al muro.";
/** Not "at the top": resuming leaves her where she was, and saying so is the point. */
export const RESUMED_EXPLANATION = "Está en el mismo lugar donde estaba antes de la pausa.";
/**
 * After the ceiling's refusal: which state the profile is in now. The spec asks
 * for it so she is never left guessing whether the last tap took, and only the
 * switch knows which way it sits, so the switch says it.
 */
export const STILL_PAUSED = "Tu perfil sigue en pausa.";
export const STILL_VISIBLE = "Tu perfil sigue en el muro.";

/** A transport fault. The ceiling's own refusal carries its own sentence. */
export const PAUSE_FAULT =
  "No pudimos cambiar la pausa. Tu perfil sigue como dice arriba; inténtalo otra vez.";

/**
 * **Her photo, changed in place** (#275, the owner's answer: the photo is the
 * control). The control is named by the verb, and the sentences say what
 * happened to the picture — never that her *profile* is in review.
 */
export const PHOTO_CONTROL_ADD = "Poner una foto";
export const PHOTO_CONTROL_CHANGE = "Cambiar la foto";
export const PHOTO_CONTROL_NOTE = "Para cambiar tu foto necesitas JavaScript.";
export const PHOTO_ATTACHING = "Guardando tu foto…";
export const PHOTO_ATTACHED = "Recibimos tu foto. Una persona la mira antes de que se vea.";
export const PHOTO_ATTACH_FAILED = "No pudimos guardar tu foto. Vuelve a elegirla.";

/**
 * **The Offers that reached her, as a summary** (#275). The count is good news
 * and is said as a sentence, never a badge. The link names the act it leads to.
 */
export const OFFERS_HEADING = "Propuestas";
export function waitingCount(count: number): string {
  return count === 1
    ? "Una propuesta espera tu respuesta."
    : `${count} propuestas esperan tu respuesta.`;
}
export const NONE_WAITING = "Ninguna propuesta espera tu respuesta.";
export const OFFERS_LINK = "Ver y responder";
export const CLOSED_HEADING = "Cerradas";

/** The name he gave, as he gave it; `/offers` badges it as unverified beside the terms. */
export function senderName(hirerName: string | null): string {
  return hirerName ?? "Alguien que no escribió su nombre";
}
export function closedLine(hirerName: string | null, stateLabel: string): string {
  return `${senderName(hirerName)} · ${stateLabel}`;
}
export function offerArrivedOn(date: Date): string {
  return `Llegó el ${publishedDateFormat.format(date)}`;
}

export const MY_PROFILE_COPY = {
  MY_PROFILE_TITLE,
  PUBLISHED_CONFIRMATION,
  PUBLISHED_EXPLANATION,
  SAVED_CONFIRMATION,
  SAVED_EXPLANATION,
  PUBLIC_HEADING,
  GATED_HEADING,
  HELD_HEADING,
  HELD_EXPLANATION,
  NOTHING_MORE,
  OWN_PHOTO_ALT,
  PHOTO_ABSENT,
  PHOTO_PENDING,
  PHOTO_REJECTED,
  LOAD_FAILED_TITLE,
  LOAD_FAILED_EXPLANATION,
  VISIBLE_LINE,
  PAUSED_EXPLANATION,
  PAUSE_LIMITS,
  PAUSED_CONFIRMATION,
  RESUMED_CONFIRMATION,
  RESUMED_EXPLANATION,
  PAUSE_FAULT,
  STILL_PAUSED,
  STILL_VISIBLE,
  PHOTO_CONTROL_NOTE,
  PHOTO_ATTACHING,
  PHOTO_ATTACHED,
  PHOTO_ATTACH_FAILED,
  NONE_WAITING,
} as const;

export const MY_PROFILE_LABELS = {
  WALL_LINK,
  EDIT_LINK,
  ABOUT_TERM,
  WORK_HISTORY_TERM,
  FULL_NAME_TERM,
  PHONE_TERM,
  EMAIL_TERM,
  LOAD_FAILED_RETRY,
  LOAD_FAILED_RETRYING,
  PAUSE_SWITCH_LABEL,
  PHOTO_CONTROL_ADD,
  PHOTO_CONTROL_CHANGE,
  OFFERS_HEADING,
  OFFERS_LINK,
  CLOSED_HEADING,
} as const;
