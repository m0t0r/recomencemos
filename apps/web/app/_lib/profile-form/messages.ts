/**
 * Every `es-CO` string a **profile form** puts in front of a person, in one
 * module so the same fact reads the same way wherever it appears.
 *
 * Since #142 that is two forms rather than one — `/publish` and
 * `/my-profile/edit` write the same nine fields, so a field that renamed itself
 * between publishing and editing would be a different field to the person
 * reading it. Each surface keeps only what is genuinely its own: the consent
 * step, the button's verb, and where the form goes on success.
 *
 * The authority is [`docs/policy/voice.md`](../../../../../docs/policy/voice.md);
 * `publish-copy.test.ts` enforces its countable rules over every string here.
 * The tone matrix's row for this form: Energy 2→3, everything else unchanged —
 * _"she is doing work, not being processed. Field help is one line saying what
 * the field is **for**, never what it must contain."_ And for every refusal
 * below: _"the refusal is our rule, never her mistake"_ — which is why no error
 * here says *inválido*.
 *
 * **Nothing here describes her.** Every legend, label and line is about what
 * she can do, what she is typing, and who will see it. That is ADR-0009 applied
 * to a form, and it is the rule most easily broken by a well-meant sentence.
 */

/** The page's `<title>` and its one `<h1>`. A verb and the capability, not a noun for her. */
export const PUBLISH_PAGE_TITLE = "Publica lo que sabes hacer — Recomencemos";
export const PUBLISH_TITLE = "Publica lo que sabes hacer";

/** What happens when she presses the button, said before she starts. */
export const PUBLISH_INTRO = "Llena esto una vez y queda publicado al instante.";

/**
 * The group legends, and beside each the sentence that says **who sees it**.
 * The groups are the disclosure rule made visible: public, held, optional.
 */
export const CAPABILITY_LEGEND = "Lo que sabes hacer";
export const CAPABILITY_VISIBILITY = "Esto lo ve todo el mundo.";

export const IDENTITY_LEGEND = "Cómo te van a ver";
export const IDENTITY_VISIBILITY =
  "Tu primer nombre, tu inicial y tu ciudad los ve todo el mundo. Tu nombre completo no.";

export const CONTACT_LEGEND = "Cómo te contactan";
/** ADR-0009's promise, in the voice guide's own words, beside the field it applies to. */
export const CONTACT_VISIBILITY = "Tu teléfono no sale de aquí hasta que tú aceptes una propuesta.";

export const MORE_LEGEND = "Si quieres contar más";
export const MORE_VISIBILITY = "Lo ve quien abra tu perfil completo. Es opcional.";

/** The Skill picker. */
export const SKILLS_LABEL = "Tus capacidades";
export const SKILLS_HELP = "Escoge hasta seis. Es lo primero que ve quien busca a alguien.";
export const SKILL_FILTER_LABEL = "Busca en la lista";
export const SKILL_NOT_LISTED_LABEL = "No está en la lista";

/**
 * What the option does, said before she opens it.
 *
 * **The second sentence is the whole promise of this control**: she is mid-form
 * with everything typed, and the fear a request naturally raises is that asking
 * costs her the page. Saying it does not is what makes the option usable at the
 * moment she meets it.
 */
export const SKILL_NOT_LISTED_HELP =
  "Escríbela y la revisamos. No sales de este formulario ni pierdes lo que llevas.";

/** The field itself. Its help says what we do with it, not what it must contain. */
export const SKILL_REQUEST_LABEL = "¿Qué sabes hacer?";
export const SKILL_REQUEST_HELP = "En tus palabras, como se lo dirías a alguien.";
export const SKILL_REQUEST_BUTTON = "Pedir que la agreguen";

/**
 * Sent.
 *
 * **It says what happens next and what to do now**, in that order, because both
 * are true and only the second is hers to act on: an Admin reads it, and
 * meanwhile the form she is standing in still needs a Skill on it. Optimism 4 in
 * the tone matrix, and no exclamation mark — she asked for something ordinary and
 * got it.
 *
 * **It stops at "escoge la más parecida" and does not say *y publica*.** Since
 * #142 the picker is on the edit form too, and a Worker changing a profile she
 * published weeks ago cannot publish it again — a sentence telling her to would
 * name an act she has no way to take. What the clause was for, leaving her the
 * form she is standing in rather than sending her away from it, the sentence
 * still does.
 */
export const SKILL_REQUEST_SENT =
  "Lista, ya la tenemos. Mientras la revisamos, escoge la más parecida.";

/**
 * The request is empty or longer than a capability is.
 *
 * Neither says *inválido* and neither calls it hers: the first says what is
 * missing, the second says what our rule is.
 */
export const SKILL_REQUEST_REQUIRED = "Escribe la capacidad que quieres pedir.";
export const SKILL_REQUEST_TOO_LONG = "Escríbela más corta: hasta 80 caracteres.";

/**
 * The request did not reach us.
 *
 * **It says what is still true**, which on this surface is the thing she needs:
 * nothing about the form changed, so the sentence sends her back to publishing
 * rather than to worrying about a page she has spent ten minutes on.
 */
export const SKILL_REQUEST_FAILED =
  "No pudimos enviar tu solicitud. Tu formulario sigue completo; intenta de nuevo.";

/**
 * The one place this surface renders a refusal that came from JavaScript being
 * unavailable rather than from a rule.
 *
 * NFR4 binds publishing, not this — a request travels through a Server Action
 * this page dispatches, and with no script there is nothing to dispatch it. So
 * the option stays reachable and says the true thing rather than showing a button
 * that would post her whole draft to the wrong place.
 */
export const SKILL_NOT_LISTED_NO_SCRIPT =
  "Aquí puedes pedirla cuando la página termine de cargar. Ahora escoge la más parecida.";

export function skillsNoneMatch(query: string): string {
  return `Ninguna capacidad tiene «${query}». Prueba con otra palabra.`;
}

export function skillsChosen(count: number): string {
  if (count === 0) return "Todavía no has escogido ninguna.";
  if (count === 1) return "Escogiste una capacidad.";
  return `Escogiste ${count} capacidades.`;
}

export const SKILLS_AT_MAXIMUM = "Ya escogiste seis. Quita una para escoger otra.";

/** The fields. Help says what the field is for, never what it must contain. */
export const HEADLINE_LABEL = "Una línea sobre tu trabajo";
export const HEADLINE_HELP = "En tus palabras: qué haces y para quién.";

export const FIRST_NAME_LABEL = "Tu primer nombre";
export const FIRST_NAME_HELP = "Como quieres que te llamen.";

export const LAST_INITIAL_LABEL = "Inicial de tu apellido";
export const LAST_INITIAL_HELP = "Para que te reconozcan sin mostrar tu apellido.";

export const CITY_LEGEND = "Tu ciudad";

export const FULL_NAME_LABEL = "Tu nombre completo";
export const FULL_NAME_HELP = "Se lo damos solo a quien tú aceptes, junto con tu teléfono.";

export const PHONE_LABEL = "Tu teléfono";
export const PHONE_HELP = "Donde te llama quien tú aceptes.";

export const ABOUT_LABEL = "Más sobre tu trabajo";
export const ABOUT_HELP = "Lo que quieras contar: años, lugares, lo que mejor te sale.";

export const WORK_HISTORY_LABEL = "Dónde has trabajado";
export const WORK_HISTORY_HELP = "Los lugares donde has trabajado, uno por línea.";
export function workHistoryLineLabel(number: number): string {
  return `Lugar ${number}`;
}
export const ADD_WORK_HISTORY_BUTTON = "Agregar otro lugar";
export const REMOVE_WORK_HISTORY_BUTTON = "Quitar";

/**
 * The photo's place on this form, which is a sentence rather than a control:
 * the photo ships in its own ticket, and NFR4 names it as the one thing this
 * form may not do without JavaScript — so it is also the one thing this form
 * does not do at all.
 */
export const PHOTO_NOTE =
  "La foto la subes después de publicar. Tu perfil queda publicado sin ella.";

/** Variant B's card heading: what a stranger sees, as she types it. */
export const PREVIEW_HEADING = "Así te ve todo el mundo";

/** The button says the verb of its action. Three words. */
export const PUBLISH_BUTTON = "Publicar mi perfil";

/**
 * Refusals. Each names what happened and what to do (voice guide, the
 * accessibility rules that are voice rules). None calls her input *inválido*.
 */
export const FULL_NAME_REQUIRED = "Escribe tu nombre completo.";
export const FULL_NAME_TOO_LONG = "Tu nombre completo cabe en 80 letras. Acórtalo un poco.";
export const FIRST_NAME_REQUIRED = "Escribe tu primer nombre.";
export const FIRST_NAME_TOO_LONG = "Tu primer nombre cabe en 40 letras. Acórtalo un poco.";
export const LAST_INITIAL_REQUIRED = "Escribe la primera letra de tu apellido.";
export const LAST_INITIAL_ONE_LETTER = "Solo una letra: la primera de tu apellido.";
export const CITY_REQUIRED = "Escoge tu ciudad.";
export const HEADLINE_REQUIRED = "Escribe una línea sobre tu trabajo.";
export const HEADLINE_TOO_LONG = "Esa línea cabe en 120 letras. Acórtala un poco.";
export const ABOUT_TOO_LONG = "Este texto cabe en 600 letras. Acórtalo un poco.";
export const PHONE_REQUIRED = "Escribe tu teléfono.";
export const PHONE_LOOKS_WRONG =
  "Ese número no parece un teléfono colombiano. Revísalo: son diez dígitos, como 300 123 4567.";
export const SKILL_REQUIRED = "Escoge al menos una capacidad.";
export const SKILLS_TOO_MANY = "Escoge seis capacidades como máximo.";
export const SKILL_NO_LONGER_LISTED =
  "Una de las capacidades que escogiste ya no está en la lista. Escoge otra.";
export const WORK_HISTORY_LINE_TOO_LONG = "Cada lugar cabe en 120 letras. Acórtalo un poco.";
export const WORK_HISTORY_TOO_MANY = "Hasta cinco lugares. Quita uno.";
export const CONSENT_REQUIRED = "Para publicar, marca la autorización.";
/** The bound versions arrived malformed — a tampered or very stale page. Reloading is the fix. */
export const PAGE_STALE = "Esta página quedó vieja. Recárgala e inténtalo de nuevo.";

/**
 * The contact-detail rejector's sentence (NFR12), voice guide example 3: it
 * names the fragment in guillemets so she can find it in her own text, says
 * what to do, and says **why** — the care is aimed at the consent step, never
 * at her judgment.
 */
export function contactDetailRefusal(
  kind: "phone" | "email" | "messaging_url",
  fragment: string,
): string {
  switch (kind) {
    case "phone":
      return (
        `Esta línea tiene un número de teléfono: «${fragment}». Quítalo e inténtalo de nuevo. ` +
        "Tu teléfono se lo damos nosotros a quien tú aceptes, para que nadie pueda pedírtelo antes."
      );
    case "email":
      return (
        `Esta línea tiene un correo: «${fragment}». Quítalo e inténtalo de nuevo. ` +
        "Tu correo se lo damos nosotros a quien tú aceptes."
      );
    case "messaging_url":
      return (
        `Esta línea tiene un enlace: «${fragment}». Quítalo e inténtalo de nuevo. ` +
        "Tus datos de contacto los damos nosotros, y solo a quien tú aceptes."
      );
  }
}

/**
 * The form-level summary, which is where focus lands on a failed submit: a
 * screen-reader user hears **how many** things are wrong before being dropped
 * into one (spec, Keyboard and announcement).
 */
export function summaryHeading(count: number): string {
  return count === 1 ? "Hay una cosa por corregir" : `Hay ${count} cosas por corregir`;
}
/** The sentence the seventh state and every refusal here share: nothing was lost. */
export const SUMMARY_KEPT = "Todo lo que escribiste sigue en el formulario.";

/** The accessible name of the region focus lands on. The same word `/account` uses. */
export const FEEDBACK_REGION_LABEL = "Resultado";

/** A transport fault, not a refusal: what failed, that nothing was lost, and that retrying helps. */
export const PUBLISH_FAILED =
  "No pudimos publicar tu perfil. Nada de lo que escribiste se perdió. Inténtalo de nuevo en un momento.";

/** The link text the summary uses for each field. Names the field, never its position or colour. */
export const FIELD_LABELS = {
  fullName: FULL_NAME_LABEL,
  firstName: FIRST_NAME_LABEL,
  lastInitial: LAST_INITIAL_LABEL,
  city: CITY_LEGEND,
  headline: HEADLINE_LABEL,
  about: ABOUT_LABEL,
  phone: PHONE_LABEL,
  skillSlugs: SKILLS_LABEL,
  workHistory: WORK_HISTORY_LABEL,
  consent: "La autorización",
} as const;

export type PublishFieldName = keyof typeof FIELD_LABELS;

/** Every string above, for the copy test. Adding one here is what puts it under the rules. */
export const PUBLISH_COPY = {
  PUBLISH_TITLE,
  PUBLISH_INTRO,
  CAPABILITY_LEGEND,
  CAPABILITY_VISIBILITY,
  IDENTITY_LEGEND,
  IDENTITY_VISIBILITY,
  CONTACT_LEGEND,
  CONTACT_VISIBILITY,
  MORE_LEGEND,
  MORE_VISIBILITY,
  SKILLS_LABEL,
  SKILLS_HELP,
  SKILL_FILTER_LABEL,
  SKILL_NOT_LISTED_LABEL,
  SKILL_NOT_LISTED_HELP,
  SKILL_NOT_LISTED_NO_SCRIPT,
  SKILL_REQUEST_LABEL,
  SKILL_REQUEST_HELP,
  SKILL_REQUEST_BUTTON,
  SKILL_REQUEST_SENT,
  SKILL_REQUEST_REQUIRED,
  SKILL_REQUEST_TOO_LONG,
  SKILL_REQUEST_FAILED,
  SKILLS_AT_MAXIMUM,
  HEADLINE_LABEL,
  HEADLINE_HELP,
  FIRST_NAME_LABEL,
  FIRST_NAME_HELP,
  LAST_INITIAL_LABEL,
  LAST_INITIAL_HELP,
  CITY_LEGEND,
  FULL_NAME_LABEL,
  FULL_NAME_HELP,
  PHONE_LABEL,
  PHONE_HELP,
  ABOUT_LABEL,
  ABOUT_HELP,
  WORK_HISTORY_LABEL,
  WORK_HISTORY_HELP,
  ADD_WORK_HISTORY_BUTTON,
  REMOVE_WORK_HISTORY_BUTTON,
  PHOTO_NOTE,
  PREVIEW_HEADING,
  PUBLISH_BUTTON,
  FULL_NAME_REQUIRED,
  FULL_NAME_TOO_LONG,
  FIRST_NAME_REQUIRED,
  FIRST_NAME_TOO_LONG,
  LAST_INITIAL_REQUIRED,
  LAST_INITIAL_ONE_LETTER,
  CITY_REQUIRED,
  HEADLINE_REQUIRED,
  HEADLINE_TOO_LONG,
  ABOUT_TOO_LONG,
  PHONE_REQUIRED,
  PHONE_LOOKS_WRONG,
  SKILL_REQUIRED,
  SKILLS_TOO_MANY,
  SKILL_NO_LONGER_LISTED,
  WORK_HISTORY_LINE_TOO_LONG,
  WORK_HISTORY_TOO_MANY,
  CONSENT_REQUIRED,
  PAGE_STALE,
  SUMMARY_KEPT,
  PUBLISH_FAILED,
} as const;

/** The ones the voice guide holds to five words. */
export const PUBLISH_LABELS = {
  CAPABILITY_LEGEND,
  IDENTITY_LEGEND,
  CONTACT_LEGEND,
  MORE_LEGEND,
  SKILLS_LABEL,
  SKILL_FILTER_LABEL,
  SKILL_NOT_LISTED_LABEL,
  SKILL_REQUEST_LABEL,
  SKILL_REQUEST_BUTTON,
  FEEDBACK_REGION_LABEL,
  HEADLINE_LABEL,
  FIRST_NAME_LABEL,
  LAST_INITIAL_LABEL,
  CITY_LEGEND,
  FULL_NAME_LABEL,
  PHONE_LABEL,
  ABOUT_LABEL,
  WORK_HISTORY_LABEL,
  ADD_WORK_HISTORY_BUTTON,
  REMOVE_WORK_HISTORY_BUTTON,
  PUBLISH_BUTTON,
} as const;
