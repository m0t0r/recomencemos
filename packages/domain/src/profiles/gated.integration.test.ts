/**
 * Seam 2 over the gated read: what `/profile/[slug]` gets back, and what it
 * cannot get back however it asks.
 *
 * **The row is created through `publishProfile`**, which is the rule this seam
 * works to — a fixture written by hand cannot drift out of agreement with the
 * schema, and every column these two statements read is one the publish path
 * writes. The one exception is `state`, which nothing writes a chosen value into
 * yet; that case updates the row after publishing rather than inserting one.
 *
 * The projection is already counted at seam 1. What is here is everything seam 1
 * cannot see: that the statements read the columns they claim to, in the order
 * they claim to, and that a profile which is not `published` is as absent as one
 * that never existed.
 */

import { eq } from "drizzle-orm";
import { CURRENT_CONSENT_VERSIONS } from "#consent/registry";
import { type PublishProfileInput, publishProfile } from "#profiles";
import { findGatedIdentity, findGatedWorkHistory } from "#profiles/gated";
import * as schema from "#schema";
import { signIn, signInStack } from "#testing/auth-stack";
import { test } from "#testing/fixtures";
import type { TestDatabase } from "#testing/fixtures";

const WORKER = "ana@recomencemos.test";

const INPUT = {
  fullName: "Ana María Restrepo Gómez",
  firstName: "Ana María",
  lastInitial: "R",
  city: "dosquebradas",
  headline: "Cocino almuerzos y comida casera para eventos pequeños",
  about: "Diez años cocinando para familias y para fiestas de barrio.",
  phone: "300 123 4567",
  skillSlugs: ["home-cooking", "baking-and-pastry"],
  workHistory: [
    "Panadería La Espiga, ocho años",
    "Almuerzos por encargo, dos años",
    "Eventos y primeras comuniones, por temporadas",
  ],
  consentVersions: CURRENT_CONSENT_VERSIONS,
} as const;

async function anAccount(database: TestDatabase, email = WORKER): Promise<string> {
  const stack = signInStack(database);
  await signIn(stack, email);

  const [account] = await database.db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, email));

  return (account as { id: string }).id;
}

/** Publishes `INPUT` and returns the slug the minter gave it. */
async function aPublishedProfile(
  database: TestDatabase,
  overrides: Partial<PublishProfileInput> = {},
): Promise<string> {
  const accountId = await anAccount(database);
  const outcome = await publishProfile(database.db, accountId, { ...INPUT, ...overrides });

  if (!outcome.ok) throw new Error(`the fixture failed to publish: ${outcome.reason}`);
  return outcome.slug;
}

describe("reading a published profile by its slug", () => {
  test("carries her self-description and everything the public list already showed", async ({
    database,
  }) => {
    const slug = await aPublishedProfile(database);

    const identity = await findGatedIdentity(database.db, slug);

    expect(identity).toMatchObject({
      slug,
      firstName: INPUT.firstName,
      lastInitial: INPUT.lastInitial,
      city: INPUT.city,
      headline: INPUT.headline,
      about: INPUT.about,
    });
    expect(identity?.skills.map((skill) => skill.slug).toSorted()).toEqual(
      [...INPUT.skillSlugs].toSorted(),
    );
  });

  /**
   * NFR10 is counted at seam 1 over the projection. This is the other end of the
   * same claim and the one seam 1 cannot make: that the **statement** never puts
   * the three held fields into the object at all, whatever the projection would
   * have done with them. `fullName` is the one to watch — it is on the same row,
   * one column over from `about`.
   */
  test("carries none of the three fields that cross only at exchange", async ({ database }) => {
    const slug = await aPublishedProfile(database);

    const identity = await findGatedIdentity(database.db, slug);
    const serialised = JSON.stringify(identity);

    expect(serialised).not.toContain(INPUT.fullName);
    expect(serialised).not.toContain(WORKER);
    // The stored phone is E.164; neither spelling may appear.
    expect(serialised).not.toContain("3001234567");
    expect(serialised).not.toContain("+573001234567");
  });

  test("returns nothing for a slug no profile holds", async ({ database }) => {
    await aPublishedProfile(database);

    expect(await findGatedIdentity(database.db, "k7m2p9q4w3x8y1z6")).toBeNull();
    expect(await findGatedWorkHistory(database.db, "k7m2p9q4w3x8y1z6")).toEqual([]);
  });

  /**
   * A moderation takedown makes the profile as absent as one that never
   * existed — which is what makes a takedown actually remove something, and
   * what lets the route answer both with one response.
   */
  test("returns nothing for a profile that has been taken down", async ({ database }) => {
    const slug = await aPublishedProfile(database);

    await database.db
      .update(schema.capabilityProfile)
      .set({ state: "taken_down" })
      .where(eq(schema.capabilityProfile.slug, slug));

    expect(await findGatedIdentity(database.db, slug)).toBeNull();
    expect(await findGatedWorkHistory(database.db, slug)).toEqual([]);
  });
});

describe("her work history", () => {
  /**
   * `position` is why that column exists: "ordered" with no ordering column
   * means an edit silently reorders her history, and this is the read that
   * would show it. Asserted against the array she typed rather than against a
   * sorted copy, so a statement that happened to return insertion order would
   * not pass by luck.
   */
  test("comes back in the order she wrote it", async ({ database }) => {
    const slug = await aPublishedProfile(database);

    expect(await findGatedWorkHistory(database.db, slug)).toEqual(INPUT.workHistory);
  });

  test("is empty, not absent, for a profile that listed none", async ({ database }) => {
    const slug = await aPublishedProfile(database, { workHistory: [] });

    expect(await findGatedIdentity(database.db, slug)).not.toBeNull();
    expect(await findGatedWorkHistory(database.db, slug)).toEqual([]);
  });

  /**
   * Two profiles, so the join predicate is doing work. Without it the second
   * profile's history would be indistinguishable from the first's — which is
   * the shape of bug a single-fixture test cannot see.
   */
  test("belongs to the profile that was asked for", async ({ database }) => {
    const hers = await aPublishedProfile(database);

    const otherAccountId = await anAccount(database, "luisa@recomencemos.test");
    const other = await publishProfile(database.db, otherAccountId, {
      ...INPUT,
      firstName: "Luisa",
      workHistory: ["Aseo por días, cinco años"],
    });
    if (!other.ok) throw new Error(`the second fixture failed to publish: ${other.reason}`);

    expect(await findGatedWorkHistory(database.db, hers)).toEqual(INPUT.workHistory);
    expect(await findGatedWorkHistory(database.db, other.slug)).toEqual([
      "Aseo por días, cinco años",
    ]);
  });
});
