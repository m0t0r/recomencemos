/**
 * Seam 2 over the two public lists: the orderings, the keyset page, and the one
 * thing a paginated list gets wrong by default — a query per card.
 *
 * **The rows here are inserted directly, and that is the exception rather than
 * the habit.** A test needing a row normally creates it through the domain
 * module that owns it, so fixtures cannot drift from the schema. These cases are
 * about `publishedAt`, `deliveredOfferCount`, `rotationKey` and `state` — four
 * columns no publish path writes a chosen value into, three of which nothing
 * writes at all yet. Publishing twenty-five profiles through the real path would
 * also give every one of them the same second and defeat the ordering under test.
 * `publishProfile` still owns the shape: `profiles.integration.test.ts` is what
 * holds these columns to it.
 */

import { drizzle } from "drizzle-orm/pglite";
import { asc, eq, inArray } from "drizzle-orm";
import { CURRENT_CONSENT_VERSIONS } from "#consent/registry";
import { compareByAttentionSpread, compareByNewest } from "#policy/listing";
import { normalizeSearchText } from "#policy/search-text";
import { publishProfile } from "#profiles";
import { listBrowse, listWall } from "#profiles/listing";
import * as schema from "#schema";
import { signIn, signInStack } from "#testing/auth-stack";
import { test } from "#testing/fixtures";
import type { TestDatabase } from "#testing/fixtures";

interface Seed {
  readonly slug: string;
  readonly publishedAt: Date;
  readonly deliveredOfferCount?: number;
  readonly rotationKey?: number;
  readonly state?: "published" | "taken_down";
  readonly skills?: readonly string[];
  readonly photoState?: "absent" | "pending" | "approved" | "rejected";
  /**
   * Left out of every case that is not about the photo. `listing.ts` requires
   * *both* the state and the key before it resolves a URL, so a seed that sets
   * only `photoState: "approved"` cannot reach the approved leg at all — which
   * is why the approved leg had no test until one was written.
   */
  readonly photoKey?: string;
  readonly firstName?: string;
  readonly city?: "pereira" | "dosquebradas" | "santa_rosa_de_cabal";
  readonly headline?: string;
}

const DAY = 86_400_000;

/**
 * Inserts an Account and its profile, and returns the profile's `BIGINT` id.
 *
 * Sequential on purpose throughout this file: `BIGINT IDENTITY` ids are handed
 * out in insertion order and both orderings break ties on the id, so seeding in
 * parallel would produce a fixture whose expected order nothing could state.
 *
 * **`searchText` is folded here rather than written literally**, so a row seeded
 * for a filter case holds what the write path would have put there for the same
 * name, city, headline and Skills. That the *real* path produces it this way is
 * held elsewhere — by `profiles.integration.test.ts` for the column, and by the
 * vocabulary case below, which publishes through `publishProfile` and never
 * touches this helper.
 */
async function seed(database: TestDatabase, entry: Seed): Promise<bigint> {
  await database.db.insert(schema.user).values({
    id: `account-${entry.slug}`,
    name: "",
    email: `${entry.slug}@recomencemos.test`,
    emailVerified: true,
  });

  const wanted = entry.skills ?? [];
  const skills =
    wanted.length > 0
      ? await database.db
          .select({ id: schema.skill.id, labelEs: schema.skill.labelEs })
          .from(schema.skill)
          .where(inArray(schema.skill.slug, [...wanted]))
      : [];

  if (skills.length !== wanted.length) {
    throw new Error(`The seed vocabulary is missing one of: ${wanted.join(", ")}.`);
  }

  const firstName = entry.firstName ?? "Ana María";
  const city = entry.city ?? "pereira";
  const headline = entry.headline ?? "Cocino almuerzos y comida casera para eventos pequeños";

  const [profile] = await database.db
    .insert(schema.capabilityProfile)
    .values({
      accountId: `account-${entry.slug}`,
      slug: entry.slug,
      fullName: "Ana María Restrepo Gómez",
      firstName,
      lastInitial: "R",
      city,
      headline,
      about: "Diez años cocinando para familias y para fiestas de barrio.",
      phone: "+573001234567",
      photoState: entry.photoState ?? "absent",
      photoKey: entry.photoKey,
      state: entry.state ?? "published",
      publishedAt: entry.publishedAt,
      deliveredOfferCount: entry.deliveredOfferCount ?? 0,
      rotationKey: entry.rotationKey ?? 0,
      searchText: normalizeSearchText(
        firstName,
        city,
        headline,
        ...skills.map((skill) => skill.labelEs),
      ),
    })
    .returning({ id: schema.capabilityProfile.id });

  if (!profile) throw new Error("The insert above returns its row.");

  if (skills.length > 0) {
    await database.db
      .insert(schema.profileSkill)
      .values(skills.map((skill) => ({ capabilityProfileId: profile.id, skillId: skill.id })));
  }

  return profile.id;
}

/**
 * A slug of the shape the minter produces — sixteen characters from the same
 * lowercase base32 alphabet — that still sorts by its index, so a test can say
 * what order it expects without holding a table of random strings.
 */
function slugFor(prefix: string, index: number): string {
  const letters =
    String.fromCharCode(97 + Math.floor(index / 26)) + String.fromCharCode(97 + (index % 26));
  return `${prefix}${letters}`.padEnd(16, "a");
}

/** One filtered page, as sorted slugs — the ordering is asserted by its own case. */
async function slugsOf(
  database: TestDatabase,
  filters: Parameters<typeof listBrowse>[1],
): Promise<string[]> {
  const page = await listBrowse(database.db, { limit: 10, ...filters });
  return page.items.map((profile) => profile.slug).toSorted();
}

/**
 * A spelling with its accents removed, written as an expression a reader can
 * check on the page rather than as a call into the normalizer under test — so
 * the two sides of an accent comparison do not share an implementation.
 */
function withoutAccents(text: string): string {
  return text.normalize("NFD").replace(/\p{M}+/gu, "");
}

/**
 * The plan the engine chose for a filtered read, as text.
 *
 * The statement is taken from Drizzle's own logger rather than re-typed, so this
 * asks the planner about the read the app actually issues; the parameters are
 * substituted as literals because `EXPLAIN` on a `$1` would be a question about
 * a generic plan rather than about this one.
 */
async function planFor(
  database: TestDatabase,
  filters: Parameters<typeof listBrowse>[1],
): Promise<string> {
  const statements: string[] = [];
  const logged = drizzle(database.client, {
    schema,
    logger: {
      logQuery(query, parameters) {
        statements.push(
          query.replaceAll(/\$(\d+)/g, (_whole, index: string) =>
            typeof parameters[Number(index) - 1] === "number"
              ? String(parameters[Number(index) - 1])
              : `'${String(parameters[Number(index) - 1]).replaceAll("'", "''")}'`,
          ),
        );
      },
    },
  });

  await listBrowse(logged, { limit: 24, ...filters });

  const explained = await database.client.query<{ "QUERY PLAN": string }>(
    `explain ${statements[0] ?? ""}`,
  );

  return explained.rows.map((row) => row["QUERY PLAN"]).join("\n");
}

/** A run of profiles, each published a day after the last. */
async function seedRun(database: TestDatabase, count: number): Promise<void> {
  const base = Date.UTC(2026, 8, 1);

  for (let index = 0; index < count; index += 1) {
    // oxlint-disable-next-line no-await-in-loop -- ids in insertion order, see above.
    await seed(database, {
      slug: slugFor("profile", index),
      publishedAt: new Date(base + index * DAY),
      deliveredOfferCount: index % 3,
      rotationKey: (index * 7) % 5,
    });
  }
}

describe("the Wall", () => {
  test("returns published profiles newest first", async ({ database }) => {
    await seedRun(database, 6);

    const page = await listWall(database.db, { limit: 10 });

    expect(page.items.map((profile) => profile.slug)).toEqual([
      slugFor("profile", 5),
      slugFor("profile", 4),
      slugFor("profile", 3),
      slugFor("profile", 2),
      slugFor("profile", 1),
      slugFor("profile", 0),
    ]);
  });

  test("orders exactly as the ordering rule says, including on a tie", async ({ database }) => {
    const instant = new Date(Date.UTC(2026, 8, 1));
    const ids = new Map<string, bigint>();

    for (const slug of ["tiedaaaaaaaaaaaa", "tiedbbbbbbbbbbbb", "tiedcccccccccccc"]) {
      // oxlint-disable-next-line no-await-in-loop -- the tie breaks on the id.
      ids.set(slug, await seed(database, { slug, publishedAt: instant }));
    }

    const page = await listWall(database.db, { limit: 10 });
    const expected = [...ids.entries()]
      .map(([slug, id]) => ({ slug, id, publishedAt: instant }))
      .toSorted(compareByNewest)
      .map((row) => row.slug);

    expect(page.items.map((profile) => profile.slug)).toEqual(expected);
  });

  test("leaves a taken-down profile out", async ({ database }) => {
    await seed(database, { slug: "livedaaaaaaaaaaa", publishedAt: new Date(Date.UTC(2026, 8, 1)) });
    await seed(database, {
      slug: "downaaaaaaaaaaaa",
      publishedAt: new Date(Date.UTC(2026, 8, 2)),
      state: "taken_down",
    });

    const page = await listWall(database.db, { limit: 10 });

    expect(page.items.map((profile) => profile.slug)).toEqual(["livedaaaaaaaaaaa"]);
  });

  test("carries the public projection and none of the gated fields", async ({ database }) => {
    await seed(database, {
      slug: "publicaaaaaaaaaa",
      publishedAt: new Date(Date.UTC(2026, 8, 1)),
      skills: ["home-cooking"],
    });

    const [profile] = (await listWall(database.db, { limit: 10 })).items;

    expect(Object.keys(profile ?? {}).toSorted()).toEqual([
      "city",
      "firstName",
      "headline",
      "lastInitial",
      "photoUrl",
      "publishedAt",
      "skills",
      "slug",
    ]);
  });

  test("withholds a photo that has not been approved", async ({ database }) => {
    await seed(database, {
      slug: "pendingaaaaaaaaa",
      publishedAt: new Date(Date.UTC(2026, 8, 1)),
      photoState: "pending",
    });

    expect((await listWall(database.db, { limit: 10 })).items[0]?.photoUrl).toBeNull();
  });

  /**
   * **The leg the ticket's own first comment warned about, and the one that had
   * no test.**
   *
   * _"When the photo path lands, the Wall and `/profiles` will keep rendering
   * initials only, and **nothing will fail** — no compile error, no red test."_
   * That was true right up to this case: the withholding leg above passes
   * whether or not the URL is ever resolved, and `projections.test.ts` covers
   * `toPublicProfile`, which is the *pure* projection — hand it a `null` and it
   * faithfully carries one. Hardcoding `photoUrl: null` back into `listing.ts`
   * left the whole suite green.
   *
   * `PHOTO_PUBLIC_BASE` has to be stubbed or this asserts nothing: with no base
   * configured `photoUrl` returns `null` by design (DD6's "photos serve at full
   * size until the zone is done"), which is the same answer the regression
   * gives. That is the shape of a case that models only the helpful state.
   */
  test("resolves an approved photo's URL, on both public lists", async ({ database }) => {
    vi.stubEnv("PHOTO_PUBLIC_BASE", "https://photos.recomencemos.test");
    vi.stubEnv("PHOTO_TRANSFORMATIONS", "off");

    await seed(database, {
      slug: "approvedaaaaaaaa",
      publishedAt: new Date(Date.UTC(2026, 8, 1)),
      photoState: "approved",
      photoKey: `photos/${"a".repeat(21)}.webp`,
    });

    const wall = (await listWall(database.db, { limit: 10 })).items[0]?.photoUrl;
    const browse = (await listBrowse(database.db, {})).items[0]?.photoUrl;

    expect(wall).toContain("https://photos.recomencemos.test");
    expect(wall).toContain("a".repeat(21));
    // Both lists go through `toPublic`, and a regression in either is a
    // different surface losing her face.
    expect(browse).toBe(wall);
  });

  /**
   * The third state, which had no case either. `rejected` is not `pending`, and
   * a predicate written as `!== "pending"` would pass the case above and publish
   * a photo a person refused.
   */
  test("withholds a photo that was rejected, even with a key still on the row", async ({
    database,
  }) => {
    vi.stubEnv("PHOTO_PUBLIC_BASE", "https://photos.recomencemos.test");

    await seed(database, {
      slug: "rejectedaaaaaaaa",
      publishedAt: new Date(Date.UTC(2026, 8, 1)),
      photoState: "rejected",
      photoKey: `photos/${"b".repeat(21)}.webp`,
    });

    expect((await listWall(database.db, { limit: 10 })).items[0]?.photoUrl).toBeNull();
  });
});

describe("aggregating Skills", () => {
  test("returns every profile's Skills, in the order they are rendered", async ({ database }) => {
    await seed(database, {
      slug: "skilledaaaaaaaaa",
      publishedAt: new Date(Date.UTC(2026, 8, 1)),
      skills: ["home-cooking", "baking-and-pastry"],
    });

    const [profile] = (await listWall(database.db, { limit: 10 })).items;

    // By the **label**, not by the slug — the card renders labels, and the Skill
    // picker orders the same way, so the two may not disagree. Sorted in the
    // engine, which is also what keeps the vocabulary's index in play.
    expect(profile?.skills.map((skill) => skill.labelEs)).toEqual([
      "Cocinar almuerzos y comida casera",
      "Panadería y repostería",
    ]);
  });

  test("gives a profile with no Skills an empty list rather than dropping it", async ({
    database,
  }) => {
    await seed(database, { slug: "bareaaaaaaaaaaaa", publishedAt: new Date(Date.UTC(2026, 8, 1)) });

    const [profile] = (await listWall(database.db, { limit: 10 })).items;

    expect(profile?.slug).toBe("bareaaaaaaaaaaaa");
    expect(profile?.skills).toEqual([]);
  });

  /**
   * The one that would actually miss the read-latency requirement. A list that
   * looks correct and costs one statement per card degrades with the page size,
   * and nothing about the returned value says which of the two it is — so this
   * counts statements rather than reading them.
   */
  test("costs one statement for the whole page, not one per card", async ({ database }) => {
    await seedRun(database, 12);

    const statements: string[] = [];
    const counted = drizzle(database.client, {
      schema,
      logger: {
        logQuery(query) {
          statements.push(query);
        },
      },
    });

    const page = await listWall(counted, { limit: 12 });

    expect(page.items).toHaveLength(12);
    expect(statements).toHaveLength(1);
  });
});

describe("browsing", () => {
  test("puts the fewest delivered Offers first, then the rotation key, then the id", async ({
    database,
  }) => {
    const rows = [
      { slug: slugFor("browse", 0), deliveredOfferCount: 2, rotationKey: 0 },
      { slug: slugFor("browse", 1), deliveredOfferCount: 0, rotationKey: 3 },
      { slug: slugFor("browse", 2), deliveredOfferCount: 0, rotationKey: 1 },
      { slug: slugFor("browse", 3), deliveredOfferCount: 1, rotationKey: 9 },
      { slug: slugFor("browse", 4), deliveredOfferCount: 0, rotationKey: 1 },
    ];

    const ordering = [];
    for (const row of rows) {
      // oxlint-disable-next-line no-await-in-loop -- as above.
      const id = await seed(database, { ...row, publishedAt: new Date(Date.UTC(2026, 8, 1)) });
      ordering.push({ ...row, id });
    }

    const page = await listBrowse(database.db, { limit: 10 });

    expect(page.items.map((profile) => profile.slug)).toEqual(
      ordering.toSorted(compareByAttentionSpread).map((row) => row.slug),
    );
  });

  test("leaves a taken-down profile out", async ({ database }) => {
    await seed(database, { slug: "livedaaaaaaaaaaa", publishedAt: new Date(Date.UTC(2026, 8, 1)) });
    await seed(database, {
      slug: "downaaaaaaaaaaaa",
      publishedAt: new Date(Date.UTC(2026, 8, 2)),
      state: "taken_down",
    });

    expect((await listBrowse(database.db, { limit: 10 })).items.map((p) => p.slug)).toEqual([
      "livedaaaaaaaaaaa",
    ]);
  });
});

describe("the keyset page", () => {
  test("walks the Wall in pages, seeing every profile exactly once", async ({ database }) => {
    await seedRun(database, 7);

    const seen: string[] = [];
    let after: string | null = null;

    do {
      // oxlint-disable-next-line no-await-in-loop -- a keyset walk is sequential.
      const page = await listWall(database.db, { limit: 2, after });
      seen.push(...page.items.map((profile) => profile.slug));
      after = page.nextCursor;
    } while (after);

    expect(seen).toHaveLength(7);
    expect(new Set(seen).size).toBe(7);
    expect(seen).toEqual(seen.toSorted().toReversed());
  });

  test("walks browse in pages, seeing every profile exactly once", async ({ database }) => {
    await seedRun(database, 7);

    const seen: string[] = [];
    let after: string | null = null;

    do {
      // oxlint-disable-next-line no-await-in-loop -- as above.
      const page = await listBrowse(database.db, { limit: 3, after });
      seen.push(...page.items.map((profile) => profile.slug));
      after = page.nextCursor;
    } while (after);

    expect(seen).toHaveLength(7);
    expect(new Set(seen).size).toBe(7);
  });

  test("offers no cursor when the last page is exactly full", async ({ database }) => {
    await seedRun(database, 4);

    const page = await listWall(database.db, { limit: 2 });
    const second = await listWall(database.db, { limit: 2, after: page.nextCursor });

    expect(second.items).toHaveLength(2);
    expect(second.nextCursor).toBeNull();
  });

  /**
   * The realistic stale cursor: a profile is taken down between one page and the
   * next. Its row is still there, so the page it anchors still starts in the
   * right place — the reader loses the taken-down profile and nothing else.
   */
  test("still positions the page when the cursor names a profile taken down since", async ({
    database,
  }) => {
    await seedRun(database, 5);

    const first = await listWall(database.db, { limit: 2 });
    const cursor = first.nextCursor;

    await database.db
      .update(schema.capabilityProfile)
      .set({ state: "taken_down" })
      .where(eq(schema.capabilityProfile.slug, cursor ?? ""));

    const second = await listWall(database.db, { limit: 2, after: cursor });

    expect(second.items.map((profile) => profile.slug)).toEqual([
      slugFor("profile", 2),
      slugFor("profile", 1),
    ]);
  });

  test("answers a cursor naming no profile at all with an empty page", async ({ database }) => {
    await seedRun(database, 3);

    const page = await listWall(database.db, { limit: 2, after: "zzzzzzzzzzzzzzzz" });

    expect(page.items).toEqual([]);
    expect(page.nextCursor).toBeNull();
  });
});

/**
 * The three filters, and the two properties a filter must not break: the
 * ordering the list commits to, and the keyset that pages it.
 */
describe("filtering the browsable list", () => {
  const ON = new Date(Date.UTC(2026, 8, 1));

  async function aSmallTown(database: TestDatabase): Promise<void> {
    await seed(database, {
      slug: "cookpereiraaaaaa",
      publishedAt: ON,
      city: "pereira",
      skills: ["home-cooking"],
      headline: "Cocino almuerzos para eventos pequeños",
    });
    await seed(database, {
      slug: "bakepereiraaaaaa",
      publishedAt: ON,
      city: "pereira",
      skills: ["baking-and-pastry"],
      headline: "Hago pan y tortas por encargo",
    });
    await seed(database, {
      slug: "bakedosquebradas",
      publishedAt: ON,
      city: "dosquebradas",
      skills: ["baking-and-pastry"],
      headline: "Hago pan y tortas por encargo",
    });
  }

  test("narrows to one city", async ({ database }) => {
    await aSmallTown(database);

    expect(await slugsOf(database, { city: "dosquebradas" })).toEqual(["bakedosquebradas"]);
  });

  test("narrows to one Skill", async ({ database }) => {
    await aSmallTown(database);

    expect(await slugsOf(database, { skill: "baking-and-pastry" })).toEqual([
      "bakedosquebradas",
      "bakepereiraaaaaa",
    ]);
  });

  test("combines the Skill and the city", async ({ database }) => {
    await aSmallTown(database);

    expect(await slugsOf(database, { skill: "baking-and-pastry", city: "pereira" })).toEqual([
      "bakepereiraaaaaa",
    ]);
  });

  /**
   * A slug naming no Skill matches nothing rather than everything. The failure
   * to guard against is the opposite: a subquery returning `NULL` compared with
   * `=` yields `NULL`, which is not true, so no row survives — this pins that
   * the predicate is written the way that produces the empty answer and not one
   * that silently drops the term.
   */
  test("finds nobody for a Skill slug the vocabulary does not hold", async ({ database }) => {
    await aSmallTown(database);

    expect(await slugsOf(database, { skill: "quantum-blacksmithing" })).toEqual([]);
  });

  test("finds a profile by a word from her headline", async ({ database }) => {
    await aSmallTown(database);

    expect(await slugsOf(database, { query: "tortas" })).toEqual([
      "bakedosquebradas",
      "bakepereiraaaaaa",
    ]);
  });

  test("finds a profile by her Skill's label and by her city's name", async ({ database }) => {
    await aSmallTown(database);

    expect(await slugsOf(database, { query: "panadería" })).toEqual([
      "bakedosquebradas",
      "bakepereiraaaaaa",
    ]);
    expect(await slugsOf(database, { query: "dosquebradas" })).toEqual(["bakedosquebradas"]);
  });

  // Every word has to match, and the order they were typed in is not the order
  // they sit in the column — which is the whole reason each word is its own
  // predicate rather than the phrase being one.
  test("requires every word typed, in any order", async ({ database }) => {
    await aSmallTown(database);

    expect(await slugsOf(database, { query: "tortas pan" })).toEqual([
      "bakedosquebradas",
      "bakepereiraaaaaa",
    ]);
    expect(await slugsOf(database, { query: "tortas almuerzos" })).toEqual([]);
  });

  test("treats a wildcard typed into the box as a character", async ({ database }) => {
    await aSmallTown(database);

    expect(await slugsOf(database, { query: "%" })).toEqual([]);
  });

  test("combines the typed words with the Skill and the city", async ({ database }) => {
    await aSmallTown(database);

    expect(
      await slugsOf(database, { query: "pan", skill: "baking-and-pastry", city: "pereira" }),
    ).toEqual(["bakepereiraaaaaa"]);
  });

  test("leaves a taken-down profile out of a filtered list too", async ({ database }) => {
    await seed(database, {
      slug: "downbakeraaaaaaa",
      publishedAt: ON,
      state: "taken_down",
      skills: ["baking-and-pastry"],
      headline: "Hago pan y tortas por encargo",
    });

    expect(await slugsOf(database, { skill: "baking-and-pastry" })).toEqual([]);
    expect(await slugsOf(database, { query: "tortas" })).toEqual([]);
  });

  /**
   * NFR22 inside the filtered set. The population is smaller; the ordering is
   * the same comparison over it, which is what the read achieves by adding
   * predicates and touching nothing else.
   */
  test("keeps the attention-spread ordering inside the filtered set", async ({ database }) => {
    const rows = [
      { slug: slugFor("filter", 0), deliveredOfferCount: 2, rotationKey: 0 },
      { slug: slugFor("filter", 1), deliveredOfferCount: 0, rotationKey: 3 },
      { slug: slugFor("filter", 2), deliveredOfferCount: 0, rotationKey: 1 },
      { slug: slugFor("filter", 3), deliveredOfferCount: 1, rotationKey: 9 },
    ];

    const ordering = [];
    for (const row of rows) {
      // oxlint-disable-next-line no-await-in-loop -- ties break on the id, as above.
      const id = await seed(database, { ...row, publishedAt: ON, skills: ["home-cooking"] });
      ordering.push({ ...row, id });
    }

    // One more profile that the filter must remove, published between them.
    await seed(database, { slug: slugFor("other", 0), publishedAt: ON, skills: ["painting"] });

    const page = await listBrowse(database.db, { limit: 10, skill: "home-cooking" });

    expect(page.items.map((profile) => profile.slug)).toEqual(
      ordering.toSorted(compareByAttentionSpread).map((row) => row.slug),
    );
  });

  /**
   * The cursor names a row's position in an ordering, and an ordering over a
   * different population is a different ordering — so the filters travel with
   * the cursor on every page. This walks a filtered list to its end and asserts
   * it saw the filtered set exactly once, which is the property a page-two that
   * dropped its filters would break.
   */
  test("walks a filtered list in pages, seeing every profile exactly once", async ({
    database,
  }) => {
    for (let index = 0; index < 7; index += 1) {
      // oxlint-disable-next-line no-await-in-loop -- ids in insertion order.
      await seed(database, {
        slug: slugFor("baker", index),
        publishedAt: ON,
        rotationKey: (index * 7) % 5,
        skills: ["baking-and-pastry"],
      });
    }
    await seed(database, { slug: slugFor("cook", 0), publishedAt: ON, skills: ["home-cooking"] });

    const seen: string[] = [];
    let after: string | null = null;

    do {
      // oxlint-disable-next-line no-await-in-loop -- a keyset walk is sequential.
      const page = await listBrowse(database.db, { limit: 3, after, skill: "baking-and-pastry" });
      seen.push(...page.items.map((profile) => profile.slug));
      after = page.nextCursor;
    } while (after);

    expect(seen).toHaveLength(7);
    expect(new Set(seen).size).toBe(7);
    expect(seen).not.toContain(slugFor("cook", 0));
  });
});

/**
 * **NFR21, against the vocabulary this product actually seeds**, and through the
 * write path that actually fills the column.
 *
 * One profile is published with every `Skill` the seed migration holds — by
 * `publishProfile`, so `searchText` is written by production code and not by
 * this file's helper — and each label is then looked up twice: as it is spelled,
 * and with its accents removed. Both must find her, which is the requirement's
 * "the same results with or without accents, in both directions".
 *
 * The unaccented spelling is produced here by an expression a reader can check
 * on the page rather than by calling the normalizer under test, so the two sides
 * of the comparison do not share an implementation.
 */
describe("searching in Spanish, accents or not", () => {
  test("finds her by every seeded Skill label, spelled either way", async ({ database }) => {
    const vocabulary = await database.db
      .select({ slug: schema.skill.slug, labelEs: schema.skill.labelEs })
      .from(schema.skill)
      .orderBy(asc(schema.skill.slug));

    const stack = signInStack(database);
    await signIn(stack, "ana@recomencemos.test");
    const [account] = await database.db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.email, "ana@recomencemos.test"));

    const outcome = await publishProfile(database.db, (account as { id: string }).id, {
      fullName: "Ana María Restrepo Gómez",
      firstName: "Ana María",
      lastInitial: "R",
      city: "pereira",
      headline: "Cocino almuerzos y comida casera para eventos pequeños",
      about: "",
      phone: "300 123 4567",
      skillSlugs: vocabulary.map((entry) => entry.slug),
      workHistory: [],
      consentVersions: CURRENT_CONSENT_VERSIONS,
    });

    expect(outcome.ok).toBe(true);

    const accented = vocabulary.filter((entry) => withoutAccents(entry.labelEs) !== entry.labelEs);
    // A fixture with no accented labels in it would pass this whole case while
    // measuring nothing, so the population is asserted before it is used.
    expect(accented.length).toBeGreaterThan(20);

    const missed: string[] = [];

    for (const entry of vocabulary) {
      for (const spelling of [entry.labelEs, withoutAccents(entry.labelEs)]) {
        // oxlint-disable-next-line no-await-in-loop -- one read per pair; the count is the requirement.
        const page = await listBrowse(database.db, { limit: 5, query: spelling });
        if (page.items.length !== 1) missed.push(spelling);
      }
    }

    expect(missed).toEqual([]);
  });

  test("finds her by a word from her headline, spelled either way", async ({ database }) => {
    await seed(database, {
      slug: "ninosaaaaaaaaaaa",
      publishedAt: new Date(Date.UTC(2026, 8, 1)),
      headline: "Cuido niños por horas en Pereira",
    });

    for (const spelling of ["niños", "ninos", "NIÑOS", "Niños"]) {
      // oxlint-disable-next-line no-await-in-loop -- one read per spelling.
      const page = await listBrowse(database.db, { limit: 5, query: spelling });
      expect(page.items.map((profile) => profile.slug)).toEqual(["ninosaaaaaaaaaaa"]);
    }
  });
});

/**
 * **The plan, not the answer.** Every case above would pass identically against a
 * sequential scan that applied `unaccent()` to every row — which is the design
 * DD4 refuses, and the one thing a returned value cannot tell you about. So this
 * reads what the engine decided to do instead.
 *
 * Three things about the fixture are load-bearing, and each was measured here
 * rather than assumed:
 *
 * - **The population is past the size where a scan is genuinely cheaper.** The
 *   planner chooses on estimated cost, and at the few hundred profiles this
 *   product launches into, reading the whole table is correctly the cheaper
 *   plan. A case built on that population would be asserting that Postgres costs
 *   badly. The index is what keeps this read bounded as the list grows, so the
 *   fixture is the size at which that starts to be true.
 * - **The word searched for is rare in it.** A pattern matching a quarter of the
 *   rows is one the planner is right to answer by walking the ordering and
 *   filtering, because a `LIMIT` lets it stop early — so the seeded trades are
 *   spread thinly enough that a search returns a handful.
 * - **`VACUUM`, and not only `ANALYZE`.** A GIN index's own statistics live in
 *   its metapage and are written by `VACUUM`; `ANALYZE` does not touch them.
 *   Restoring the snapshot brings back a metapage recorded when the table was
 *   empty, so without this the planner costs the index as worthless and the case
 *   fails while the schema is perfectly correct — verified by building the same
 *   index by hand after the restore and watching it be chosen. A real deployment
 *   gets this from autovacuum, which PGlite does not run.
 *
 * `EXPLAIN` and not `EXPLAIN ANALYZE`: the assertion is about the chosen plan,
 * and timings from a WASM engine in CI are the noisiest possible way to say the
 * same thing.
 */
describe("the plan behind a filtered read", () => {
  const A_TOWN = 5_000;
  const TRADES = 2_000;

  async function aPopulation(database: TestDatabase): Promise<void> {
    await database.client.exec(`
      insert into "user" (id, name, email, email_verified)
      select 'account-' || n, '', 'p' || n || '@recomencemos.test', true
      from generate_series(1, ${A_TOWN}) as n;

      insert into capability_profile
        (account_id, slug, full_name, first_name, last_initial, city, headline,
         about, phone, search_text)
      select
        'account-' || n,
        'seeded' || lpad(n::text, 10, '0'),
        'Ana María Restrepo Gómez', 'Ana María', 'R',
        (array['pereira', 'dosquebradas', 'santa_rosa_de_cabal'])[1 + n % 3],
        'Hago trabajos por encargo', '', '+573001234567',
        'ana maria ' || (array['pereira', 'dosquebradas', 'santa rosa de cabal'])[1 + n % 3]
          || ' oficio' || lpad((n % ${TRADES})::text, 4, '0')
      from generate_series(1, ${A_TOWN}) as n;
    `);

    // Its own call: `exec` wraps a multi-statement string in one transaction,
    // and `VACUUM` refuses to run inside one.
    await database.client.exec("vacuum analyze capability_profile;");
  }

  test("looks the typed word up in the trigram index", async ({ database }) => {
    await aPopulation(database);

    const plan = await planFor(database, { query: "oficio0037" });

    expect(plan).toContain("Bitmap Index Scan on capability_profile_search_idx");
    expect(plan).not.toContain("Seq Scan on capability_profile");
  });

  /**
   * The property DD4 is actually about, and the one that holds whichever plan
   * the costs favour on the day: the engine compares a **stored** column. An
   * `unaccent()` in the predicate is the design this schema refused, and it
   * would show up here as a function around the column name.
   */
  test("compares stored columns, and never computes one per row", async ({ database }) => {
    await aPopulation(database);

    const plan = await planFor(database, {
      query: "oficio0037",
      city: "pereira",
      skill: "home-cooking",
    });

    expect(plan).toContain("search_text ~~ ");
    expect(plan).toContain("city = 'pereira'");
    expect(plan).not.toMatch(/unaccent|lower\(/);
    expect(plan).not.toContain("Seq Scan on capability_profile");
  });
});
