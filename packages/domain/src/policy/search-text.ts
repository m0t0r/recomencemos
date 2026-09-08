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

/**
 * What a Hirer typed, as the patterns the stored column is compared against.
 *
 * **The query is folded by the function above**, so the comparison is between
 * two already-folded strings and neither side of it calls `unaccent()`. That is
 * what makes the match work in both directions: the accented spelling of a word
 * and its unaccented spelling fold to the same characters, whichever of the two
 * a person typed and whichever of the two she wrote.
 *
 * **One pattern per word, and the caller `AND`s them.** A single `%a b%` would
 * match only a profile whose stored text happens to hold those two words
 * adjacent and in that order — and `searchText` is her name, her city, her
 * headline and her Skill labels run together, so that order is an artefact of
 * how the column is built rather than anything a Hirer could know. Two words are
 * two predicates, and the engine answers each from the same index.
 *
 * **`%`, `_` and `\` are escaped rather than stripped**: they are ordinary
 * characters in a headline, and a Hirer typing `100%` is looking for a string
 * rather than for every row. Backslash is `LIKE`'s own default escape character,
 * so no `ESCAPE` clause is needed — but it has to escape itself, which is why
 * this is one character class and not three replacements.
 *
 * **A word shorter than three characters cannot be answered from the trigram
 * index**, because there is no whole trigram in it to look up; it stays in the
 * predicate and is applied to the rows the other words returned. A query made of
 * nothing but such words is the one case that reaches every published row —
 * bounded by the partial index's own predicate. It is named here rather than
 * quietly dropped, because deciding that `de` is noise and `pan` is not is a
 * judgement about Spanish that this function is in no position to make.
 *
 * Pure, and seam 1's, exactly as the normalizer above it.
 */
export function toSearchPatterns(query: string): readonly string[] {
  const folded = normalizeSearchText(query);
  if (folded.length === 0) return [];

  return folded.split(" ").map((word) => `%${word.replace(/[\\%_]/g, "\\$&")}%`);
}
