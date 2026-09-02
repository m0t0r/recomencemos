/**
 * The strings the two public lists share.
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
 */
export const NOBODY_PUBLISHED_TITLE = "Todavía no hay perfiles publicados";

export const NOBODY_PUBLISHED_BODY =
  "Sé la primera persona en publicar. Toma unos minutos desde el teléfono y no necesitas ningún documento.";

/** The verb, not a noun that classifies her. */
export const TO_PUBLISH = "Publicar lo que sabes hacer";

export const GRID_ERROR_TITLE = "No pudimos cargar los perfiles";

/** Says what happened and what to do next, in one breath — and never blames her. */
export const GRID_ERROR_EXPLANATION =
  "Algo falló de nuestro lado al buscar los perfiles. Vuelve a intentarlo.";

export const GRID_ERROR_RETRY = "Volver a intentar";
export const GRID_ERROR_RETRYING = "Cargando…";
