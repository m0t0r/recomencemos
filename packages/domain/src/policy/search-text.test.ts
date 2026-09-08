import { normalizeSearchText, toSearchPatterns } from "#policy/search-text";

describe("normalizeSearchText", () => {
  // Accented and unaccented pairs fold to the same text, which is the whole of
  // NFR21's "including when I type without accents".
  it.each([
    ["Panadería y repostería", "panaderia y reposteria"],
    ["Cuidar niños por horas", "cuidar ninos por horas"],
    ["Albañilería", "albanileria"],
    ["Ana María", "ana maria"],
    ["PEREIRA", "pereira"],
  ])("folds %o to %o", (typed, folded) => {
    expect(normalizeSearchText(typed)).toBe(folded);
  });

  it("joins its parts with one space and collapses the rest", () => {
    expect(normalizeSearchText("  Cocinar  ", "Pereira", "Panadería\n y  repostería")).toBe(
      "cocinar pereira panaderia y reposteria",
    );
  });

  it("gives an unaccented query the same text as the accented original", () => {
    expect(normalizeSearchText("Cuidar niños")).toBe(normalizeSearchText("cuidar ninos"));
  });
});

describe("toSearchPatterns", () => {
  it("wraps one word as one contains-pattern", () => {
    expect(toSearchPatterns("Panadería")).toEqual(["%panaderia%"]);
  });

  // One per word rather than one for the phrase: `searchText` runs her name, her
  // city, her headline and her Skill labels together, so their order is an
  // artefact of the column rather than anything a Hirer could type towards.
  it("gives each word its own pattern", () => {
    expect(toSearchPatterns("Panadería  Pereira")).toEqual(["%panaderia%", "%pereira%"]);
  });

  it("folds the query the same way the column was written", () => {
    expect(toSearchPatterns("NIÑOS")).toEqual(toSearchPatterns("ninos"));
  });

  it.each([
    ["a query with no words in it", "   "],
    ["nothing typed at all", ""],
  ])("asks for no pattern given %s", (_case, typed) => {
    expect(toSearchPatterns(typed)).toEqual([]);
  });

  // Ordinary characters in a headline, and a Hirer typing one is looking for a
  // string. Unescaped, `100%` would match every published row.
  it.each([
    ["100%", "%100\\%%"],
    ["a_b", "%a\\_b%"],
    ["c\\d", "%c\\\\d%"],
  ])("escapes the wildcard in %o", (typed, pattern) => {
    expect(toSearchPatterns(typed)).toEqual([pattern]);
  });

  it("escapes a backslash before the wildcard it precedes, not after it", () => {
    expect(toSearchPatterns("\\%")).toEqual(["%\\\\\\%%"]);
  });
});
