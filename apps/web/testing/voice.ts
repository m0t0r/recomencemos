/**
 * The countable half of [`docs/policy/voice.md`](../../../docs/policy/voice.md),
 * as one set of rules every surface's copy suite runs.
 *
 * **It exists because the copy of it had already drifted.** `/sign-in` wrote
 * these checks first and `/privacy` copied them, and the two banned-word lists
 * came out different within one change — the second had `servicio`, `directorio`
 * and `listado`, the first did not. Neither was wrong; there is simply no way for
 * two hand-kept mirrors of one policy file to stay in step, and `/publish`,
 * `/profiles` and the Wall are three more copies waiting to be made.
 *
 * The guide says the rules are testable — _"a rule you cannot fail is not a
 * rule"_ — so what is mechanical lives here. What is **not** here is the half no
 * test can reach: whether the care is aimed at the process rather than at the
 * person. That is the boundary rule, it is the load-bearing one, and it is a
 * reading a person does.
 *
 * It sits in `testing/` beside `matchers.ts` rather than in `app/`, because it is
 * test apparatus and nothing renders it.
 */

/**
 * `CONTEXT.md`'s per-term _Avoid_ lists, plus the voice guide's **Never say**.
 *
 * Every entry names a person by an event or by a category rather than by a
 * capability, or promises something this platform does not hold. Stems rather
 * than whole words (`damnificad`, `afectad`) so a gendered or plural form cannot
 * slip past the one that was written down.
 *
 * **`CONTEXT.md`'s scoping is not reproducible here, and that is the known
 * limit.** Its lists are per-term — Account's reads _"Avoid: User, member,
 * profile, registration"_, which bans _perfil_ as a word for an Account and not
 * the word _perfil_, prescribed two lines below for a CapabilityProfile. A
 * substring scan cannot read the concept being named, so only the terms that are
 * banned **everywhere** are listed. The scoped ones stay a reviewer's job.
 */
export const NEVER_SAY = [
  "damnificad",
  "víctima",
  "afectad",
  "beneficiari",
  "necesitad",
  "donación",
  "donar",
  "causa",
  "tu historia",
  "candidat",
  "aspirante",
  "hoja de vida",
  "vacante",
  "empleo",
  "oferta laboral",
  "empleador",
  "usuari",
  "verificado",
  "servicio",
  "directorio",
  "listado",
];

/**
 * Link text that names no destination.
 *
 * Both a voice rule and an accessibility one: a screen reader can list a page's
 * links on their own, and _aquí_ in that list is a link to nowhere.
 */
export const EMPTY_LINK_TEXT = ["haz clic aquí", "clic aquí", "más información", "aquí."];

/**
 * The register the guide's Sophistication 2 refuses, with its own exception
 * carved out: _"the only permitted exceptions are the terms Ley 1581 requires by
 * name — responsable del tratamiento, autorización, consulta, reclamo"_. Those
 * four are absent from this list on purpose; what is here is the institutional
 * voice that is nobody's obligation.
 */
export const STATUTE_REGISTER = [
  "le informamos",
  "por medio del presente",
  "el titular de los datos podrá",
  "en cumplimiento de lo dispuesto",
  "de conformidad con",
];

/** Words shouted in capitals — some screen readers spell them out. */
export function shoutedWords(value: string): string[] {
  return value.split(/\s+/).filter((word) => /^[A-ZÁÉÍÓÚÑ]{2,}$/.test(word));
}

/**
 * The sentences of one string, for the twenty-word ceiling.
 *
 * Split on the full stop alone. A colon introduces a list or an apposition rather
 * than ending a thought, and treating it as a boundary would let a long sentence
 * pass by being punctuated more.
 */
export function sentencesOf(value: string): string[] {
  return value
    .split(/[.]/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function wordCount(value: string): number {
  return value.split(/\s+/).length;
}

/** Body copy: 20 words or fewer per sentence, not counting the items of a list. */
export const SENTENCE_WORD_CEILING = 20;

/** Labels and buttons: 5 or fewer. */
export const LABEL_WORD_CEILING = 5;
