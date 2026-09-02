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

/** The three tiers, as headings. */
export const PUBLIC_HEADING = "Lo que ve todo el mundo";
export const GATED_HEADING = "Lo que ve quien abra tu perfil";
export const HELD_HEADING = "Lo que ve solo quien tú aceptes";
export const HELD_EXPLANATION =
  "Tu nombre completo, tu teléfono y tu correo cruzan solo cuando aceptas una propuesta.";

/** The ledger's three visibility words, five words or fewer each. */
export const VISIBILITY_PUBLIC = "Todo el mundo";
export const VISIBILITY_GATED = "Quien abra tu perfil";
export const VISIBILITY_HELD = "Solo quien tú aceptes";

/** Terms for the field ledger. */
export const NAME_TERM = "Nombre que se muestra";
export const CITY_TERM = "Ciudad";
export const SKILLS_TERM = "Capacidades";
export const HEADLINE_TERM = "Una línea sobre tu trabajo";
export const ABOUT_TERM = "Más sobre tu trabajo";
export const WORK_HISTORY_TERM = "Dónde has trabajado";
export const FULL_NAME_TERM = "Nombre completo";
export const PHONE_TERM = "Teléfono";
export const EMAIL_TERM = "Correo";
export const PHOTO_TERM = "Foto";

/** When an optional field is empty: said plainly, and it is fine. */
export const NOTHING_MORE = "No escribiste nada más. Está bien así.";

/**
 * The photo, described rather than badged (intent Q3). `absent` is the only
 * state reachable on this ticket; the other two are written now so the shape
 * is designed rather than invented at 5pm.
 */
export const PHOTO_ABSENT = "Todavía no tienes foto. En su lugar se muestra tu inicial.";
export const PHOTO_PENDING =
  "Una persona está mirando tu foto. Mientras tanto se muestra tu inicial.";
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

export const MY_PROFILE_COPY = {
  MY_PROFILE_TITLE,
  PUBLISHED_CONFIRMATION,
  PUBLISHED_EXPLANATION,
  PUBLIC_HEADING,
  GATED_HEADING,
  HELD_HEADING,
  HELD_EXPLANATION,
  NOTHING_MORE,
  PHOTO_ABSENT,
  PHOTO_PENDING,
  PHOTO_REJECTED,
} as const;

export const MY_PROFILE_LABELS = {
  WALL_LINK,
  VISIBILITY_PUBLIC,
  VISIBILITY_GATED,
  VISIBILITY_HELD,
  NAME_TERM,
  CITY_TERM,
  SKILLS_TERM,
  HEADLINE_TERM,
  ABOUT_TERM,
  WORK_HISTORY_TERM,
  FULL_NAME_TERM,
  PHONE_TERM,
  EMAIL_TERM,
  PHOTO_TERM,
} as const;
