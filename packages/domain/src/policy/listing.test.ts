/**
 * Seam 1: the two orderings and the keyset page, as functions of stored columns
 * and nothing else.
 *
 * The ordering matters here rather than only in SQL because the requirement it
 * carries is a fairness property, and a property nothing can evaluate outside a
 * database is a property nobody checks. These comparators are the specification
 * the engine is then asserted against at seam 2 — the reason they exist is that
 * the browse ordering is a pure function of `deliveredOfferCount`, `rotationKey`
 * and `id`, which is exactly what a stored `rotationKey` bought.
 */

import {
  type AttentionSpreadOrder,
  compareByAttentionSpread,
  compareByNewest,
  type NewestOrder,
  pageOf,
} from "#policy/listing";

/** A deterministic population: no clock, no `Math.random`, and reproducible on failure. */
function generatePopulation(count: number): (NewestOrder & AttentionSpreadOrder)[] {
  return Array.from({ length: count }, (_, index) => ({
    id: BigInt(index + 1),
    // Deliberately coarse, so ties are common rather than exotic — a tie is
    // where an ordering with a missing tiebreaker stops being a total order.
    publishedAt: new Date(Date.UTC(2026, 8, 1 + (index % 5))),
    deliveredOfferCount: index % 4,
    rotationKey: (index * 7) % 3,
  }));
}

describe("compareByNewest", () => {
  it("puts the most recently published first", () => {
    const older = { id: 1n, publishedAt: new Date("2026-09-01T00:00:00Z") };
    const newer = { id: 2n, publishedAt: new Date("2026-09-02T00:00:00Z") };

    expect([older, newer].toSorted(compareByNewest)).toEqual([newer, older]);
  });

  it("breaks a tie on the higher id, so two profiles published in the same instant still order", () => {
    const instant = new Date("2026-09-01T00:00:00Z");
    const first = { id: 1n, publishedAt: instant };
    const second = { id: 2n, publishedAt: instant };

    expect([first, second].toSorted(compareByNewest)).toEqual([second, first]);
  });

  it("is a total order over a generated population", () => {
    const population = generatePopulation(60);
    const sorted = [...population].toSorted(compareByNewest);

    for (const [index, row] of sorted.slice(1).entries()) {
      const previous = sorted[index];
      if (!previous) throw new Error("The slice above guarantees a predecessor.");
      expect(compareByNewest(previous, row)).toBeLessThan(0);
    }
  });
});

describe("compareByAttentionSpread", () => {
  it("puts the fewest delivered Offers first", () => {
    const contacted = { id: 1n, deliveredOfferCount: 3, rotationKey: 0 };
    const uncontacted = { id: 2n, deliveredOfferCount: 0, rotationKey: 0 };

    expect([contacted, uncontacted].toSorted(compareByAttentionSpread)).toEqual([
      uncontacted,
      contacted,
    ]);
  });

  it("breaks a tie on the rotation key before the id, which is what spreads attention day to day", () => {
    const low = { id: 9n, deliveredOfferCount: 0, rotationKey: 1 };
    const high = { id: 1n, deliveredOfferCount: 0, rotationKey: 2 };

    // The lower id loses to the lower rotation key: without the middle term the
    // same profiles would sit in the same order every day forever.
    expect([high, low].toSorted(compareByAttentionSpread)).toEqual([low, high]);
  });

  it("is a total order over a generated population", () => {
    const population = generatePopulation(60);
    const sorted = [...population].toSorted(compareByAttentionSpread);

    for (const [index, row] of sorted.slice(1).entries()) {
      const previous = sorted[index];
      if (!previous) throw new Error("The slice above guarantees a predecessor.");
      expect(compareByAttentionSpread(previous, row)).toBeLessThan(0);
    }
  });

  it("reorders when the rotation key is rewritten, with no other column changing", () => {
    const before = [
      { id: 1n, deliveredOfferCount: 0, rotationKey: 0 },
      { id: 2n, deliveredOfferCount: 0, rotationKey: 1 },
    ];
    const after = [
      { id: 1n, deliveredOfferCount: 0, rotationKey: 1 },
      { id: 2n, deliveredOfferCount: 0, rotationKey: 0 },
    ];

    expect([...before].toSorted(compareByAttentionSpread).map((row) => row.id)).toEqual([1n, 2n]);
    expect([...after].toSorted(compareByAttentionSpread).map((row) => row.id)).toEqual([2n, 1n]);
  });
});

function rows(count: number) {
  return Array.from({ length: count }, (_, index) => ({ slug: `slug-${index}` }));
}

describe("pageOf", () => {
  it("hands back a short page with no cursor, because there is nothing after it", () => {
    expect(pageOf(rows(3), 5)).toEqual({ items: rows(3), nextCursor: null });
  });

  it("hands back an empty page with no cursor", () => {
    expect(pageOf([], 5)).toEqual({ items: [], nextCursor: null });
  });

  it("trims the probe row and returns the last kept slug as the cursor", () => {
    const page = pageOf(rows(6), 5);

    expect(page.items).toHaveLength(5);
    expect(page.nextCursor).toBe("slug-4");
  });

  it("offers no cursor for an exactly-full page, which is why the caller reads one extra row", () => {
    // The mistake this pins: returning a cursor whenever the page is full sends
    // the reader to an empty page every time the list divides by the page size.
    expect(pageOf(rows(5), 5).nextCursor).toBeNull();
  });
});
