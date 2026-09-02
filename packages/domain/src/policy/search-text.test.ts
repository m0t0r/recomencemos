import { normalizeSearchText } from "#policy/search-text";

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
