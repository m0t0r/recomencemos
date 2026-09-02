/**
 * The Wall's copy — `/`, the public homepage list of the most recently published
 * profiles.
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
 * here would give them a second source.
 */

/** The `<h1>`. Says what the list is, without a word from an _Avoid_ list. */
export const WALL_TITLE = "Lo que la gente sabe hacer";

/** One line under the title: who is on the list, and what a reader can do about it. */
export const WALL_LEAD =
  "Personas de Pereira, Dosquebradas y Santa Rosa de Cabal publican aquí su trabajo. " +
  "Quien quiera pagarles las encuentra sin registrarse.";

/** The way into the full list, named by its destination rather than by "ver más". */
export const WALL_TO_BROWSE = "Ver todos los perfiles";

/** Why there is a second list at all, said once, under the link. */
export const WALL_TO_BROWSE_HINT = "El muro solo muestra los perfiles más recientes.";
