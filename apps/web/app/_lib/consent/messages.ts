/**
 * Every `es-CO` string the *aviso de privacidad* and the *autorización* put in
 * front of a person, in one module.
 *
 * **It is not under a route folder, because two surfaces read it.** `/privacy`
 * publishes the text, and `/publish` and the Offer form render the *autorización*
 * above their first field. One *autorización* with two spellings is the failure
 * this whole ticket exists to prevent — a Consent row records a version, and a
 * version that names two different texts records nothing.
 *
 * The authority is [`docs/policy/voice.md`](../../../../../docs/policy/voice.md),
 * and `consent-copy.test.ts` enforces its countable rules over every string here.
 * The half no test reaches — whether the care is aimed at the process rather than
 * at the person — is a reading, and it is the load-bearing one.
 *
 * **This is legal text held to the same sentence rules as everything else**, and
 * that is deliberate rather than an oversight. Sophistication is 2, and the guide
 * names its own exception: _"the only permitted exceptions are the terms Ley 1581
 * requires by name — responsable del tratamiento, autorización, consulta,
 * reclamo"_. Those four appear; nothing else does. A notice a person cannot read
 * is not a notice, and this one is read on a phone by someone deciding whether to
 * type her phone number in.
 *
 * **It says nothing about verification.** That absence is ADR-0008's standing
 * notice, which is story 11's and is rendered on the Wall, on every profile and
 * on every Offer surface. A half-version here would give it a second source, and
 * the one thing worse than an absent notice is two that disagree.
 */

/** The page's one `h1`. */
export const NOTICE_TITLE = "Aviso de privacidad";

/**
 * The date a version string names, as a person reads it.
 *
 * **Formatted in `UTC`, not in `America/Bogota`** — the version is a calendar
 * date rather than an instant, and rendering `2026-08-30` in a UTC−5 zone moves
 * it to the twenty-ninth. That would put one date in the database row and a
 * different one on the page it points at.
 */
const versionDateFormat = new Intl.DateTimeFormat("es-CO", {
  timeZone: "UTC",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** _30 de agosto de 2026_ — never `30/08/2026`, which reads as August in one country. */
export function versionDate(version: string): string {
  return versionDateFormat.format(new Date(`${version}T00:00:00Z`));
}

/** Which text is on the page, so a Consent row's version can be matched to it. */
export function noticeVersionLine(version: string): string {
  return `Esta versión es del ${versionDate(version)}.`;
}

/**
 * Interpolated rather than fixed, because the *responsable* is deployment
 * configuration — see `lib/responsible-party.ts` for why a person's legal
 * identity is not committed to a public repository.
 */
export function responsibleLine(name: string): string {
  return `El responsable del tratamiento es ${name}.`;
}

export function contactLine(email: string): string {
  return `Escribe a ${email} para hacer una consulta o un reclamo.`;
}

export function rightsHowLine(email: string): string {
  return `Escribe a ${email} y te contestamos: una consulta en diez días hábiles, un reclamo en quince.`;
}

/**
 * The body of the notice, section by section. Every heading is an `h2` and the
 * order is the reading order — who, what, why, to whom, and what she can do.
 */
export const NOTICE_COPY = {
  INTRO: "Aquí te contamos qué datos tuyos guardamos, para qué, y qué puedes hacer con ellos.",

  RESPONSIBLE_HEADING: "Quién responde por tus datos",

  DATA_HEADING: "Qué guardamos",
  DATA_INTRO: "Guardamos lo que tú escribes y lo que hace falta para que esto funcione.",

  PURPOSE_HEADING: "Para qué los usamos",
  PURPOSE_INTRO: "Para una sola cosa: que alguien que quiera pagarte por un trabajo te encuentre.",
  PURPOSE_LIMIT: "No vendemos tus datos. No los usamos para publicidad.",

  PROCESSORS_HEADING: "Empresas fuera de Colombia",
  PROCESSORS_INTRO:
    "Seis empresas guardan o mueven tus datos por nosotros. Todas están fuera de Colombia.",
  PROCESSORS_TRANSMISSION:
    "Por eso te pedimos permiso expreso para sacar tus datos del país, y no solo para guardarlos.",

  RIGHTS_HEADING: "Qué puedes hacer",
  RIGHTS_INTRO: "La ley colombiana te da estos derechos sobre tus datos, y aquí valen todos.",

  AUTHORIZATION_HEADING: "La autorización",
  AUTHORIZATION_INTRO: "Este es el texto exacto que aceptas antes de que te pidamos un dato.",
} as const;

/**
 * What we hold, as a list.
 *
 * A list, so the voice guide's twenty-word ceiling counts each item rather than
 * the whole — and so a person scanning on a phone can find the line about her
 * phone number without reading a paragraph.
 */
export const DATA_ITEMS: readonly string[] = [
  "Tu correo, y tu nombre si entras con Google.",
  "Lo que publicas: lo que sabes hacer, tu ciudad y tu teléfono.",
  "Tu nombre completo, que solo entregamos cuando tú aceptas una propuesta.",
  "Las propuestas que envías o recibes, con el trabajo, el pago y el cuándo.",
  "La foto que subas, después de que una persona la apruebe.",
];

/** The rights Ley 1581 gives her, said in her words rather than the statute's. */
export const RIGHTS_ITEMS: readonly string[] = [
  "Saber qué tenemos tuyo y para qué lo tenemos.",
  "Corregir lo que esté mal o incompleto.",
  "Pedir que lo borremos.",
  "Quitar tu autorización cuando quieras, sin dar razones.",
  "Poner un reclamo si crees que hicimos algo mal.",
];

/**
 * **The *autorización* itself**, and the one block of text on this page that a
 * Consent row points at by version.
 *
 * Three sentences, because express consent has to name what it covers. The
 * second is C15's: every processor is outside Colombia, so the transmission is
 * authorized expressly rather than left to be read into the first. The third is
 * the revocation right, said at the moment she is agreeing rather than only in a
 * section further down — a permission she cannot picture withdrawing is not one
 * she has really given.
 *
 * **The third sentence names the path rather than asserting she knows it.** An
 * earlier draft ended _"y sé cómo hacerlo"_, which is a claim about her and not
 * about the product — and there is no self-serve withdrawal to know about: story
 * 13 builds the deletion surface, and until it lands the only route is writing to
 * the *responsable*. So the sentence says that, which is both true today and the
 * thing she would need.
 *
 * **Editing this array is a version bump** in `CONSENT_AUTHORIZATION_VERSIONS`.
 * Without one, every row already written starts pointing at text nobody consented
 * to, and nothing anywhere would say so.
 */
export const AUTHORIZATION_TEXT: readonly string[] = [
  "Autorizo al responsable del tratamiento a guardar y manejar mis datos personales.",
  "Autorizo también que los envíe a las seis empresas fuera de Colombia que este aviso nombra.",
  "Sé que puedo quitar esta autorización cuando quiera, escribiendo al correo que dice este aviso.",
];

/**
 * The labels and the one link, all five words or fewer.
 *
 * `NOTICE_LINK` names its destination rather than saying _aquí_ or _más
 * información_, which is both a voice rule and the thing that makes it usable
 * from a screen reader's list of links.
 */
export const CONSENT_LABELS = {
  AUTHORIZATION_CHECKBOX: "Autorizo usar mis datos",
  NOTICE_LINK: "Lee el aviso de privacidad",
} as const;

/**
 * What the checkbox covers, as the field's description rather than as more label.
 *
 * It sits in `aria-describedby`, so a screen reader announces the transmission
 * with the checkbox — which is what keeps a four-word label from being a
 * four-word consent.
 */
export const AUTHORIZATION_CHECKBOX_HELP =
  "Incluye enviarlos a las seis empresas fuera de Colombia.";

/**
 * The page could not name the *responsable*, because the deploy has not been told
 * who that is.
 *
 * She reads a refusal, not a stack trace. It says what failed and that trying
 * again is worth it, which is true — the fix is one `fly secrets set` away and
 * needs nothing from her.
 */
export const NOTICE_UNAVAILABLE =
  "No podemos mostrar el aviso de privacidad ahora. Intenta de nuevo en un momento.";
