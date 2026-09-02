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
import { eq, inArray } from "drizzle-orm";
import { compareByAttentionSpread, compareByNewest } from "#policy/listing";
import { listBrowse, listWall } from "#profiles/listing";
import * as schema from "#schema";
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
}

const DAY = 86_400_000;

/**
 * Inserts an Account and its profile, and returns the profile's `BIGINT` id.
 *
 * Sequential on purpose throughout this file: `BIGINT IDENTITY` ids are handed
 * out in insertion order and both orderings break ties on the id, so seeding in
 * parallel would produce a fixture whose expected order nothing could state.
 */
async function seed(database: TestDatabase, entry: Seed): Promise<bigint> {
  await database.db.insert(schema.user).values({
    id: `account-${entry.slug}`,
    name: "",
    email: `${entry.slug}@recomencemos.test`,
    emailVerified: true,
  });

  const [profile] = await database.db
    .insert(schema.capabilityProfile)
    .values({
      accountId: `account-${entry.slug}`,
      slug: entry.slug,
      fullName: "Ana María Restrepo Gómez",
      firstName: "Ana María",
      lastInitial: "R",
      city: "pereira",
      headline: "Cocino almuerzos y comida casera para eventos pequeños",
      about: "Diez años cocinando para familias y para fiestas de barrio.",
      phone: "+573001234567",
      photoState: entry.photoState ?? "absent",
      state: entry.state ?? "published",
      publishedAt: entry.publishedAt,
      deliveredOfferCount: entry.deliveredOfferCount ?? 0,
      rotationKey: entry.rotationKey ?? 0,
      searchText: "ana maria pereira cocino",
    })
    .returning({ id: schema.capabilityProfile.id });

  if (!profile) throw new Error("The insert above returns its row.");

  const wanted = entry.skills ?? [];

  if (wanted.length > 0) {
    const skills = await database.db
      .select({ id: schema.skill.id })
      .from(schema.skill)
      .where(inArray(schema.skill.slug, [...wanted]));

    if (skills.length !== wanted.length) {
      throw new Error(`The seed vocabulary is missing one of: ${wanted.join(", ")}.`);
    }

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
