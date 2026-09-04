/**
 * The Wall's copy — `/`, the public homepage: the cover, the ruled page of the
 * most recently published profiles, and how the product works.
 *
 * **The page speaks to someone already here**; the root layout's `description`
 * speaks to someone reading a search result. Two audiences, two strings, and one
 * string with two owners is how they drift.
 *
 * The empty state's sentences are **not** here: nobody-has-published-yet is the
 * same fact on `/profiles`, so it lives once, in the grid's own messages.
 *
 * Register is `tú`, sentences stay under twenty words, and the copy names what
 * people can do rather than what happened to them. It makes **no** claim about
 * verification or money: those are the two standing notices, and a half-version
 * here would give them a second source. The three steps below say what the
 * platform does — a person reads every Offer, each side receives the other's
 * contact — and stop there.
 */

/**
 * The cover's headline. It names the three municipalities because they are the
 * whole geography of the product, and it says what the list is without a word
 * from an _Avoid_ list.
 */
export const COVER_TITLE =
  "Lo que la gente de Pereira, Dosquebradas y Santa Rosa de Cabal sabe hacer";

/**
 * Under the headline: who wrote what is on this page, and what a reader can do
 * about it. _Pagarle_ rather than a gendered noun, per the voice guide.
 */
export const COVER_LEAD =
  "Cada persona escribió aquí, con sus palabras, el trabajo que hace. " +
  "Quien quiera pagarle la encuentra sin registrarse.";

/** The way down the page for a Hirer. Names its destination: the profiles, on this page. */
export const COVER_TO_PROFILES = "Ver los perfiles";

/**
 * The accessible name of the drifting strip. It is the platform's own Skill
 * vocabulary, read from the database — real capabilities, not an illustration.
 */
export const VOCABULARY_LABEL = "Algunas de las cosas que la gente sabe hacer";

/** The `<h2>` over the ruled page. `WALL_TITLE` is kept for the document title. */
export const WALL_TITLE = "Lo que la gente sabe hacer";
export const RECENT_HEADING = "Los perfiles más recientes";

/**
 * A real count, shown only when it is above zero: how many people published in
 * the last seven days. It is read from the database at request time, so it is
 * never a claim about the platform's use that the platform cannot back.
 *
 * "En los últimos siete días" rather than "esta semana", because the window is
 * seven days back from now and not a calendar week.
 */
export function publishedRecently(count: number): string {
  return count === 1
    ? "En los últimos siete días publicó 1 persona."
    : `En los últimos siete días publicaron ${count} personas.`;
}

/** Why there is a second list at all, said once, under the link. */
export const WALL_TO_BROWSE_HINT = "El muro solo muestra los perfiles más recientes.";

/** The `<h2>` over the three steps. */
export const HOW_HEADING = "Cómo funciona";

/**
 * The three steps, in the order they happen. A sequence, which is why the page
 * may number them. Each names what the platform actually does in the present
 * tense with the actor visible, and the third stops where the platform stops.
 */
export const HOW_STEPS: readonly { readonly title: string; readonly body: string }[] = [
  {
    title: "Publicas lo que sabes hacer",
    body: "Desde el teléfono, en una sentada, sin ningún documento.",
  },
  {
    title: "Alguien te envía una propuesta",
    body: "Dice el trabajo, el pago y cuándo. Una persona la lee antes de que te llegue.",
  },
  {
    title: "Tú decides",
    body: "Si aceptas, cada lado recibe el contacto del otro. Hasta ahí llegamos.",
  },
];
