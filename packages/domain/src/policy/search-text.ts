/**
 * The search normalizer (DD4, NFR21).
 *
 * `unaccent()` is `STABLE`, not `IMMUTABLE`, so Postgres refuses an index over
 * it and a generated column over it; the folklore fix lies to the planner. So
 * normalization happens **here, at write time**, into `capability_profile.search_text`:
 * lowercased, accents folded, whitespace collapsed. A Hirer typing `panaderia`
 * then matches _Panadería_ because both sides were folded the same way, and
 * PGlite and PlanetScale cannot diverge on a text-search configuration they
 * never use.
 *
 * NFKD then stripping the combining marks is the fold: `á` becomes `a` + U+0301
 * and the mark is dropped. `ñ` folds to `n` the same way, which is wanted — a
 * Hirer abroad types `nino` for _niño_ as readily as `nino` for anything else.
 *
 * Pure, and seam 1's.
 */

export function normalizeSearchText(...parts: readonly string[]): string {
  return parts
    .join(" ")
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
