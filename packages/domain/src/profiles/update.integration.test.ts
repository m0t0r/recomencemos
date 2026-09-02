/**
 * Seam 2 over `updateProfile`: **what an edit rewrites, and what it must leave
 * alone.**
 *
 * The rewrite half is ordinary. The half this file exists for is the second
 * one, and it is two properties that are invisible in the code and expensive
 * to lose:
 *
 * - **`published_at` is not stamped.** It orders the Wall
 *   (`published_at DESC, id DESC`), so an edit that touched it would make
 *   editing a free bump to the top of the site's most-linked surface, and
 *   story 20's attention-spread measurement would go on reporting a fairness
 *   property the site no longer had. `updated_at` is a separate column and no
 *   index reads it, so the Wall is safe today only by accident. These tests are
 *   what make it safe on purpose.
 * - **The slug is untouched** (NFR9), so an address a Hirer already holds keeps
 *   resolving after she corrects her wording.
 *
 * The Wall's order is written out here as the ordering rather than imported
 * from a query, because the Wall itself is another ticket's. Restating it is
 * the point: if the index and this file ever disagree, one of them is wrong and
 * the disagreement is visible.
 */

import { desc, eq } from "drizzle-orm";
import { CURRENT_CONSENT_VERSIONS } from "#consent/registry";
import { findOwnProfile, publishProfile, updateProfile } from "#profiles";
import * as schema from "#schema";
import { signIn, signInStack } from "#testing/auth-stack";
import { test } from "#testing/fixtures";
import type { TestDatabase } from "#testing/fixtures";

async function anAccount(database: TestDatabase, email: string): Promise<string> {
  const stack = signInStack(database);
  await signIn(stack, email);

  const [account] = await database.db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, email));

  return (account as { id: string }).id;
}

const PUBLISHED = {
  fullName: "Ana María Restrepo Gómez",
  firstName: "Ana María",
  lastInitial: "R",
  city: "dosquebradas",
  headline: "Cocino almuerzos y comida casera para eventos pequeños",
  about: "Diez años cocinando para familias y para fiestas de barrio.",
  phone: "300 123 4567",
  skillSlugs: ["home-cooking", "baking-and-pastry"],
  workHistory: ["Panadería La Espiga, ocho años", "Almuerzos por encargo, dos años"],
  consentVersions: CURRENT_CONSENT_VERSIONS,
} as const;

/** The edited shape: the published field set minus the consent versions. */
const EDITED = {
  fullName: "Ana María Restrepo Gómez",
  firstName: "Ana",
  lastInitial: "R",
  city: "pereira",
  headline: "Almuerzos caseros por encargo, entrego en la mañana",
  about: "Cocino para familias, para oficinas y para fiestas de barrio.",
  phone: "301 987 6543",
  skillSlugs: ["home-cooking"],
  workHistory: ["Almuerzos por encargo, tres años"],
} as const;

/** A published profile for `email`, and the account that holds it. */
async function published(database: TestDatabase, email: string) {
  const accountId = await anAccount(database, email);
  const outcome = await publishProfile(database.db, accountId, PUBLISHED);

  if (!outcome.ok) throw new Error("the fixture failed to publish");

  return { accountId, slug: outcome.slug };
}

/** The row, in the columns these tests are about. */
async function profileRow(database: TestDatabase, accountId: string) {
  const [row] = await database.db
    .select({
      id: schema.capabilityProfile.id,
      slug: schema.capabilityProfile.slug,
      city: schema.capabilityProfile.city,
      phone: schema.capabilityProfile.phone,
      searchText: schema.capabilityProfile.searchText,
      state: schema.capabilityProfile.state,
      publishedAt: schema.capabilityProfile.publishedAt,
      updatedAt: schema.capabilityProfile.updatedAt,
    })
    .from(schema.capabilityProfile)
    .where(eq(schema.capabilityProfile.accountId, accountId));

  if (!row) throw new Error("no profile row");
  return row;
}

/** Retire a Skill, which is what an Admin does to one the vocabulary drops. */
async function retire(database: TestDatabase, slug: string) {
  await database.db.update(schema.skill).set({ active: false }).where(eq(schema.skill.slug, slug));
}

/**
 * The Wall's own order, restated: newest published first, id breaking the tie,
 * `published` only. Returns slugs, because a slug is the thing a Hirer holds.
 */
async function wallOrder(database: TestDatabase): Promise<string[]> {
  const rows = await database.db
    .select({ slug: schema.capabilityProfile.slug })
    .from(schema.capabilityProfile)
    .where(eq(schema.capabilityProfile.state, "published"))
    .orderBy(desc(schema.capabilityProfile.publishedAt), desc(schema.capabilityProfile.id));

  return rows.map((row) => row.slug);
}

describe("editing a published profile", () => {
  test("rewrites the fields she changed", async ({ database }) => {
    const { accountId } = await published(database, "ana@recomencemos.test");

    const outcome = await updateProfile(database.db, accountId, EDITED);

    expect(outcome.ok).toBe(true);

    const own = await findOwnProfile(database.db, accountId);
    expect(own?.firstName).toBe("Ana");
    expect(own?.city).toBe("pereira");
    expect(own?.headline).toBe(EDITED.headline);
    expect(own?.about).toBe(EDITED.about);
  });

  test("stores the new phone in one shape, as publishing does", async ({ database }) => {
    const { accountId } = await published(database, "ana@recomencemos.test");

    await updateProfile(database.db, accountId, { ...EDITED, phone: "+57 (301) 987-6543" });

    expect((await profileRow(database, accountId)).phone).toBe("+573019876543");
  });

  test("rewrites the search text from the new values", async ({ database }) => {
    const { accountId } = await published(database, "ana@recomencemos.test");

    await updateProfile(database.db, accountId, EDITED);

    const { searchText } = await profileRow(database, accountId);
    expect(searchText).toContain("pereira");
    expect(searchText).not.toContain("dosquebradas");
    // The Skill she dropped goes with it; the one she kept stays.
    expect(searchText).not.toContain("panaderia y reposteria");
    expect(searchText).not.toMatch(/[A-ZÁÉÍÓÚÑ]/);
  });

  test("replaces her Skills and her work history rather than adding to them", async ({
    database,
  }) => {
    const { accountId } = await published(database, "ana@recomencemos.test");

    await updateProfile(database.db, accountId, EDITED);

    const own = await findOwnProfile(database.db, accountId);
    expect(own?.skills.map((skill) => skill.slug)).toEqual(["home-cooking"]);
    expect(own?.workHistory).toEqual([...EDITED.workHistory]);
  });

  test("drops empty work-history lines, as publishing does", async ({ database }) => {
    const { accountId } = await published(database, "ana@recomencemos.test");

    await updateProfile(database.db, accountId, {
      ...EDITED,
      workHistory: ["", "   ", "Una sola línea"],
    });

    expect((await findOwnProfile(database.db, accountId))?.workHistory).toEqual(["Una sola línea"]);
  });

  test("writes no Consent row: an edit is not a fresh collection", async ({ database }) => {
    const { accountId } = await published(database, "ana@recomencemos.test");

    const before = await database.db.select({ id: schema.consent.id }).from(schema.consent);
    await updateProfile(database.db, accountId, EDITED);
    const after = await database.db.select({ id: schema.consent.id }).from(schema.consent);

    expect(after.length).toBe(before.length);
  });

  test("refuses an Account that holds no profile, and does not create one", async ({
    database,
  }) => {
    const accountId = await anAccount(database, "nadie@recomencemos.test");

    const outcome = await updateProfile(database.db, accountId, EDITED);

    expect(outcome).toEqual({ ok: false, reason: "no_profile" });
    expect(await findOwnProfile(database.db, accountId)).toBeNull();
  });
});

describe("what an edit must leave alone", () => {
  test("keeps the slug, so an address a Hirer already holds keeps resolving", async ({
    database,
  }) => {
    const { accountId, slug } = await published(database, "ana@recomencemos.test");

    await updateProfile(database.db, accountId, EDITED);

    expect((await profileRow(database, accountId)).slug).toBe(slug);
    expect((await findOwnProfile(database.db, accountId))?.slug).toBe(slug);
  });

  test("does not stamp published_at, so the Wall's order is unmoved", async ({ database }) => {
    // Two profiles, published in order. Ana is the older, so she is second.
    const ana = await published(database, "ana@recomencemos.test");
    const beatriz = await published(database, "beatriz@recomencemos.test");

    const before = await wallOrder(database);
    expect(before).toEqual([beatriz.slug, ana.slug]);

    const wasPublishedAt = (await profileRow(database, ana.accountId)).publishedAt;

    await updateProfile(database.db, ana.accountId, EDITED);

    expect((await profileRow(database, ana.accountId)).publishedAt).toEqual(wasPublishedAt);
    expect(await wallOrder(database)).toEqual(before);
  });

  test("stamps updated_at, which is the column that does move", async ({ database }) => {
    const { accountId } = await published(database, "ana@recomencemos.test");
    const before = await profileRow(database, accountId);

    await updateProfile(database.db, accountId, EDITED);

    const after = await profileRow(database, accountId);
    expect(after.updatedAt.getTime()).toBeGreaterThanOrEqual(before.updatedAt.getTime());
    expect(after.updatedAt.getTime()).toBeGreaterThanOrEqual(after.publishedAt.getTime());
  });

  test("leaves the profile published, and edits nobody else's", async ({ database }) => {
    const ana = await published(database, "ana@recomencemos.test");
    const beatriz = await published(database, "beatriz@recomencemos.test");

    await updateProfile(database.db, ana.accountId, EDITED);

    expect((await profileRow(database, ana.accountId)).state).toBe("published");

    const hers = await findOwnProfile(database.db, beatriz.accountId);
    expect(hers?.headline).toBe(PUBLISHED.headline);
    expect(hers?.city).toBe("dosquebradas");
  });
});

describe("the rejector runs again on every edit", () => {
  test("names the fragment when the headline carries a phone number, and writes nothing", async ({
    database,
  }) => {
    const { accountId } = await published(database, "ana@recomencemos.test");

    const outcome = await updateProfile(database.db, accountId, {
      ...EDITED,
      headline: "Almuerzos caseros, llámame al 300 123 4567",
    });

    expect(outcome).toEqual({
      ok: false,
      reason: "refused",
      refusals: [
        { field: "headline", code: "contact_detail", kind: "phone", fragment: "300 123 4567" },
      ],
    });

    // Nothing about the row moved, including the fields the same submission changed.
    expect((await findOwnProfile(database.db, accountId))?.headline).toBe(PUBLISHED.headline);
    expect((await profileRow(database, accountId)).city).toBe("dosquebradas");
  });

  test("refuses a messaging link in the work history, naming the line", async ({ database }) => {
    const { accountId } = await published(database, "ana@recomencemos.test");

    const outcome = await updateProfile(database.db, accountId, {
      ...EDITED,
      workHistory: ["Almuerzos por encargo, tres años", "Escríbeme a wa.me/573001234567"],
    });

    expect(outcome).toMatchObject({
      ok: false,
      reason: "refused",
      refusals: [{ field: "workHistory", code: "contact_detail", index: 1 }],
    });
  });

  test("refuses an unreadable phone and an unknown city, as publishing does", async ({
    database,
  }) => {
    const { accountId } = await published(database, "ana@recomencemos.test");

    const outcome = await updateProfile(database.db, accountId, {
      ...EDITED,
      phone: "12",
      city: "bogota",
    });

    expect(outcome).toMatchObject({
      ok: false,
      reason: "refused",
      refusals: expect.arrayContaining([
        { field: "phone", code: "phone_unrecognised" },
        { field: "city", code: "city_unknown" },
      ]),
    });
  });

  test("refuses a submission with no Skill at all", async ({ database }) => {
    const { accountId } = await published(database, "ana@recomencemos.test");

    const outcome = await updateProfile(database.db, accountId, { ...EDITED, skillSlugs: [] });

    expect(outcome).toMatchObject({
      ok: false,
      reason: "refused",
      refusals: [{ field: "skillSlugs", code: "no_skill" }],
    });
  });
});

describe("a Skill retired since she published", () => {
  test("stays choosable when she already holds it, so one retirement does not freeze her profile", async ({
    database,
  }) => {
    const { accountId } = await published(database, "ana@recomencemos.test");
    await retire(database, "baking-and-pastry");

    // She is correcting her phone number and keeping both Skills.
    const outcome = await updateProfile(database.db, accountId, {
      ...EDITED,
      skillSlugs: ["home-cooking", "baking-and-pastry"],
      phone: "301 987 6543",
    });

    expect(outcome.ok).toBe(true);

    const own = await findOwnProfile(database.db, accountId);
    expect(own?.skills.map((skill) => skill.slug).toSorted()).toEqual([
      "baking-and-pastry",
      "home-cooking",
    ]);
  });

  test("is refused when it is one she does not already hold", async ({ database }) => {
    const { accountId } = await published(database, "ana@recomencemos.test");

    // Retire something she has never held, then try to add it.
    const unheld = "gardening";
    await retire(database, unheld);

    const outcome = await updateProfile(database.db, accountId, {
      ...EDITED,
      skillSlugs: ["home-cooking", unheld],
    });

    expect(outcome).toMatchObject({
      ok: false,
      reason: "refused",
      refusals: [{ field: "skillSlugs", code: "unknown_skill", slugs: [unheld] }],
    });
  });

  test("is dropped from her profile when she deselects it, and cannot come back", async ({
    database,
  }) => {
    const { accountId } = await published(database, "ana@recomencemos.test");
    await retire(database, "baking-and-pastry");

    await updateProfile(database.db, accountId, { ...EDITED, skillSlugs: ["home-cooking"] });

    const outcome = await updateProfile(database.db, accountId, {
      ...EDITED,
      skillSlugs: ["home-cooking", "baking-and-pastry"],
    });

    expect(outcome).toMatchObject({
      ok: false,
      reason: "refused",
      refusals: [{ field: "skillSlugs", code: "unknown_skill", slugs: ["baking-and-pastry"] }],
    });
  });
});
