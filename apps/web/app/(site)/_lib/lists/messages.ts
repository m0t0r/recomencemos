/**
 * The strings the two public lists share — the Wall's and `/profiles`'.
 *
 * **In `_lib` rather than beside the components that render them**: `_lib` holds
 * what a surface knows, including its Spanish, and `_components` holds what it
 * renders. These two surfaces share a `_lib` for the same reason they share a
 * grid — they are one pair, and a sentence with two owners drifts.
 *
 * Register is `tú` and the copy names capabilities rather than people, per
 * `docs/policy/voice.md`. Nobody on either page is named by what happened to
 * them, and neither page uses a word from a `CONTEXT.md` _Avoid_ list — no
 * _directorio_, no _listado_, no _categoría_ for a Skill.
 */

/**
 * What the live region says when the grid resolves — a count, once, rather than
 * one announcement per card.
 *
 * Singular and plural rather than "1 perfiles". `es-CO` has no other special
 * case here, and zero is never announced: an empty list renders its own state
 * with its own heading, which a screen reader reaches as content.
 */
export function announcedCount(count: number): string {
  return count === 1 ? "1 perfil" : `${count} perfiles`;
}

/** The `alt` for a photo. Says what it shows and nothing about her circumstances. */
export function photoAlt(displayName: string): string {
  return `Foto de ${displayName}`;
}

/**
 * Nobody has published yet — the same fact on both lists, so one string.
 *
 * The Wall and `/profiles` differ in how they are *narrowed*, not in what an
 * unpublished platform is, and two copies of this sentence would be two things
 * to keep in step for no gain. The narrowed case is `/profiles`' own.
 *
 * **It says nothing about what publishing does or does not check.** Open
 * enrolment and its published absence are story 11's standing notice, and a
 * half-version in an empty state would give that notice a second source.
 */
export const NOBODY_PUBLISHED_TITLE = "Todavía no hay perfiles publicados";

export const NOBODY_PUBLISHED_BODY =
  "Sé la primera persona en publicar. Toma unos minutos desde el teléfono.";

/** The verb, not a noun that classifies her. */
export const TO_PUBLISH = "Publicar lo que sabes hacer";

/**
 * The way into the full list. One string, because the Wall links there under the
 * grid and `/profiles` offers the same link when a page of it is empty or failed
 * — the same destination, so the same words.
 */
export const TO_BROWSE = "Ver todos los perfiles";

export const GRID_ERROR_TITLE = "No pudimos cargar los perfiles";

/** Says what happened and what to do next, in one breath — and never blames her. */
export const GRID_ERROR_EXPLANATION =
  "Algo falló de nuestro lado al buscar los perfiles. Vuelve a intentarlo.";

export const GRID_ERROR_RETRY = "Volver a intentar";
export const GRID_ERROR_RETRYING = "Cargando…";
