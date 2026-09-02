import { mintSlug, SLUG_PATTERN } from "#profiles/slug";

describe("mintSlug", () => {
  it("is sixteen lowercase base32 characters", () => {
    expect(mintSlug()).toMatch(SLUG_PATTERN);
  });

  it("takes nothing it could derive from", () => {
    // `customAlphabet` returns a function whose one optional argument is a
    // length; nothing about her can reach it.
    expect(mintSlug()).not.toBe(mintSlug());
  });

  it("differs from one mint to the next", () => {
    const slugs = new Set(Array.from({ length: 200 }, () => mintSlug()));

    expect(slugs.size).toBe(200);
  });
});
