/**
 * What the URL is allowed to say about the browsable list.
 *
 * The two halves are one round trip and are tested as one: what a query string
 * parses to, and what a set of filters serialises back to. A link built from
 * filters that did not parse back to themselves would silently drop somebody's
 * search on the second page.
 */

import { browseFiltersFrom, browseHref, isNarrowed, MAX_QUERY_LENGTH } from "./filters";

describe("reading the filters off the URL", () => {
  it("takes the three terms a person can set", () => {
    expect(
      browseFiltersFrom({ q: "panadería", skill: "baking-and-pastry", city: "pereira" }),
    ).toEqual({ query: "panadería", skill: "baking-and-pastry", city: "pereira" });
  });

  it("reads nothing at all as no filters", () => {
    expect(browseFiltersFrom({})).toEqual({ query: "", skill: null, city: null });
  });

  it("trims what a person typed, so a stray space is not a search", () => {
    expect(browseFiltersFrom({ q: "  panadería  " }).query).toBe("panadería");
    expect(isNarrowed(browseFiltersFrom({ q: "   " }))).toBe(false);
  });

  // Silently, because refusing the search is worse for someone whose keyboard
  // repeated than searching for the first eighty characters of what they meant.
  it("cuts a query longer than the bound rather than refusing it", () => {
    const typed = "a".repeat(MAX_QUERY_LENGTH + 40);

    expect(browseFiltersFrom({ q: typed }).query).toHaveLength(MAX_QUERY_LENGTH);
  });

  /**
   * A hand-edited URL shows the list rather than an error: nobody typed that
   * query string on purpose and there is nothing in it for a reader to correct.
   */
  it.each([
    ["a city that is not one of the three", { city: "bogota" }],
    ["a city in the wrong shape entirely", { city: "../etc" }],
    ["a Skill slug with characters a slug never has", { skill: "Baking And Pastry" }],
    ["an empty Skill", { skill: "" }],
  ])("drops %s", (_case, params) => {
    const filters = browseFiltersFrom(params);

    expect(filters.skill).toBeNull();
    expect(filters.city).toBeNull();
  });

  /**
   * A well-formed slug naming no Skill is **kept**, and that is the one thing
   * that is not dropped: it reaches the read and matches nobody, which is the
   * honest answer to "show me the people who do a thing that does not exist".
   */
  it("keeps a well-formed Skill slug the vocabulary may not hold", () => {
    expect(browseFiltersFrom({ skill: "quantum-blacksmithing" }).skill).toBe(
      "quantum-blacksmithing",
    );
  });

  it("takes the first of a repeated parameter, which is what the form would have sent", () => {
    expect(browseFiltersFrom({ city: ["pereira", "dosquebradas"] }).city).toBe("pereira");
  });

  it("ignores the page cursor, which is where a reader stands rather than a choice", () => {
    const filters = browseFiltersFrom({ after: "abcdefghijklmnop" });

    expect(isNarrowed(filters)).toBe(false);
    expect(filters).toEqual({ query: "", skill: null, city: null });
  });
});

describe("putting the filters back into a link", () => {
  it("writes only what somebody chose", () => {
    expect(browseHref({ query: "pan", skill: null, city: null })).toBe("/profiles?q=pan");
  });

  it("is the bare route when nothing is set", () => {
    expect(browseHref({ query: "", skill: null, city: null })).toBe("/profiles");
  });

  it("carries the cursor beside the filters, which is what page two needs", () => {
    expect(browseHref({ query: "pan", skill: null, city: "pereira" }, "abcdefghijklmnop")).toBe(
      "/profiles?q=pan&city=pereira&after=abcdefghijklmnop",
    );
  });

  it("leaves the cursor out when there is no next page", () => {
    expect(browseHref({ query: "", skill: "home-cooking", city: null }, null)).toBe(
      "/profiles?skill=home-cooking",
    );
  });

  // The round trip. A link that did not parse back to the filters it was built
  // from would drop somebody's search between page one and page two.
  it("round-trips through the reader", () => {
    const filters = {
      query: "panadería & repostería",
      skill: "baking-and-pastry",
      city: "pereira",
    } as const;
    const search = new URL(browseHref(filters), "https://example.test").searchParams;

    expect(browseFiltersFrom(Object.fromEntries(search))).toEqual(filters);
  });
});
