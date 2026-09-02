/**
 * Seam 2 over `publishProfile`: **profile, Skills, work history and the Worker
 * Consent row are written in one transaction, and a failure leaves none of
 * them.**
 *
 * The commit case is the easy half. The half that matters is the rollback —
 * asserted from the end of the sequence, where the consent write is what fails,
 * because a profile that survived alone is the one nobody would look at again.
 * The stale-version refusal is the one failure `recordConsent` throws by
 * design, so it is the lever that makes the rollback observable without a mock.
 */

import { eq } from "drizzle-orm";
import { CURRENT_CONSENT_VERSIONS } from "#consent/registry";
import { findOwnProfile, hasProfile, publishProfile, readPublishPrefill } from "#profiles";
import { SLUG_PATTERN } from "#profiles/slug";
import * as schema from "#schema";
import { signIn, signInStack } from "#testing/auth-stack";
import { test } from "#testing/fixtures";
import type { TestDatabase } from "#testing/fixtures";

const WORKER = "ana@recomencemos.test";

async function anAccount(database: TestDatabase, email = WORKER): Promise<string> {
  const stack = signInStack(database);
  await signIn(stack, email);

  const [account] = await database.db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, email));

  return (account as { id: string }).id;
}

const INPUT = {
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

async function rowCounts(database: TestDatabase) {
  const [profiles, skills, history, consents] = await Promise.all([
    database.db.select({ id: schema.capabilityProfile.id }).from(schema.capabilityProfile),
    database.db.select({ id: schema.profileSkill.skillId }).from(schema.profileSkill),
    database.db.select({ id: schema.workHistoryEntry.id }).from(schema.workHistoryEntry),
    database.db.select({ id: schema.consent.id }).from(schema.consent),
  ]);

  return {
    profiles: profiles.length,
    skills: skills.length,
    history: history.length,
    consents: consents.length,
  };
}

describe("publishing a profile", () => {
  test("writes the profile, its Skills, its work history and the consent together", async ({
    database,
  }) => {
    const accountId = await anAccount(database);

    const outcome = await publishProfile(database.db, accountId, INPUT);

    expect(outcome.ok).toBe(true);
    expect(await rowCounts(database)).toEqual({ profiles: 1, skills: 2, history: 2, consents: 1 });
  });

  test("is published on commit, with nothing waiting on a person", async ({ database }) => {
    const accountId = await anAccount(database);
    await publishProfile(database.db, accountId, INPUT);

    const [row] = await database.db
      .select({
        state: schema.capabilityProfile.state,
        photoState: schema.capabilityProfile.photoState,
        publishedAt: schema.capabilityProfile.publishedAt,
      })
      .from(schema.capabilityProfile);

    expect(row?.state).toBe("published");
    expect(row?.photoState).toBe("absent");
    expect(row?.publishedAt).toBeInstanceOf(Date);
  });

  test("stores the phone in one shape and the search text folded", async ({ database }) => {
    const accountId = await anAccount(database);
    await publishProfile(database.db, accountId, { ...INPUT, phone: "+57 (300) 123-4567" });

    const [row] = await database.db
      .select({
        phone: schema.capabilityProfile.phone,
        searchText: schema.capabilityProfile.searchText,
      })
      .from(schema.capabilityProfile);

    expect(row?.phone).toBe("+573001234567");
    expect(row?.searchText).toContain("ana maria");
    expect(row?.searchText).toContain("panaderia y reposteria");
    expect(row?.searchText).not.toMatch(/[A-ZÁÉÍÓÚÑ]/);
  });

  test("keeps the work history in the order she wrote it", async ({ database }) => {
    const accountId = await anAccount(database);
    await publishProfile(database.db, accountId, INPUT);

    const own = await findOwnProfile(database.db, accountId);

    expect(own?.workHistory).toEqual([...INPUT.workHistory]);
  });

  test("drops empty work-history lines rather than storing them", async ({ database }) => {
    const accountId = await anAccount(database);
    await publishProfile(database.db, accountId, {
      ...INPUT,
      workHistory: ["", "  ", "Una sola línea"],
    });

    const own = await findOwnProfile(database.db, accountId);

    expect(own?.workHistory).toEqual(["Una sola línea"]);
  });
});

describe("the slug", () => {
  test("is opaque and carries nothing of her name, city or Skills", async ({ database }) => {
    const accountId = await anAccount(database);
    const outcome = await publishProfile(database.db, accountId, INPUT);

    if (!outcome.ok) throw new Error("expected a published profile");

    expect(outcome.slug).toMatch(SLUG_PATTERN);
    for (const piece of ["ana", "restrepo", "dosquebradas", "cooking", "cocin"]) {
      expect(outcome.slug).not.toContain(piece);
    }
  });

  test("is what her own profile reads back", async ({ database }) => {
    const accountId = await anAccount(database);
    const outcome = await publishProfile(database.db, accountId, INPUT);
    const own = await findOwnProfile(database.db, accountId);

    expect(own?.slug).toBe(outcome.ok ? outcome.slug : undefined);
  });
});

describe("a refused submission", () => {
  test("leaves no rows when the consent version is stale", async ({ database }) => {
    const accountId = await anAccount(database);

    await expect(
      publishProfile(database.db, accountId, {
        ...INPUT,
        consentVersions: { notice: "1999-01-01", authorization: "1999-01-01" },
      }),
    ).rejects.toMatchObject({ code: "consent_version_stale" });

    expect(await rowCounts(database)).toEqual({ profiles: 0, skills: 0, history: 0, consents: 0 });
    expect(await hasProfile(database.db, accountId)).toBe(false);
  });

  test("names the fragment when the headline carries a phone number, and writes nothing", async ({
    database,
  }) => {
    const accountId = await anAccount(database);

    const outcome = await publishProfile(database.db, accountId, {
      ...INPUT,
      headline: "Cocino almuerzos, llámame al 300 123 4567",
    });

    expect(outcome).toEqual({
      ok: false,
      reason: "refused",
      refusals: [
        { field: "headline", code: "contact_detail", kind: "phone", fragment: "300 123 4567" },
      ],
    });
    expect(await rowCounts(database)).toEqual({ profiles: 0, skills: 0, history: 0, consents: 0 });
  });

  test("names which work-history line carried the contact detail", async ({ database }) => {
    const accountId = await anAccount(database);

    const outcome = await publishProfile(database.db, accountId, {
      ...INPUT,
      workHistory: ["Panadería La Espiga", "Escríbeme a ana@example.co"],
    });

    expect(outcome).toMatchObject({
      ok: false,
      refusals: [{ field: "workHistory", index: 1, kind: "email", fragment: "ana@example.co" }],
    });
  });

  test("refuses a Skill that is not in the active vocabulary, by slug", async ({ database }) => {
    const accountId = await anAccount(database);

    const outcome = await publishProfile(database.db, accountId, {
      ...INPUT,
      skillSlugs: ["home-cooking", "rocket-science"],
    });

    expect(outcome).toEqual({
      ok: false,
      reason: "refused",
      refusals: [{ field: "skillSlugs", code: "unknown_skill", slugs: ["rocket-science"] }],
    });
    expect(await rowCounts(database)).toEqual({ profiles: 0, skills: 0, history: 0, consents: 0 });
  });

  test("refuses no Skill at all, an unreadable phone, and an unknown city, together", async ({
    database,
  }) => {
    const accountId = await anAccount(database);

    const outcome = await publishProfile(database.db, accountId, {
      ...INPUT,
      skillSlugs: [],
      phone: "123",
      city: "bogota",
    });

    expect(outcome).toMatchObject({
      ok: false,
      refusals: [
        { field: "skillSlugs", code: "no_skill" },
        { field: "phone", code: "phone_unrecognised" },
        { field: "city", code: "city_unknown" },
      ],
    });
  });
});

describe("one profile per Account", () => {
  test("refuses a second publish by value rather than by constraint error", async ({
    database,
  }) => {
    const accountId = await anAccount(database);
    await publishProfile(database.db, accountId, INPUT);

    const second = await publishProfile(database.db, accountId, {
      ...INPUT,
      headline: "Otra cosa",
    });

    expect(second).toEqual({ ok: false, reason: "already_has_profile" });
    expect(await rowCounts(database)).toEqual({ profiles: 1, skills: 2, history: 2, consents: 1 });
  });

  test("is said by the engine too", async ({ database }) => {
    const accountId = await anAccount(database);
    await publishProfile(database.db, accountId, INPUT);

    // Drizzle wraps the driver's error; the constraint's name is on the cause.
    const failure = await database.db
      .insert(schema.capabilityProfile)
      .values({
        accountId,
        slug: "zzzzzzzzzzzzzzzz",
        fullName: "x",
        firstName: "x",
        lastInitial: "X",
        city: "pereira",
        headline: "x",
        phone: "+573001234567",
        searchText: "x",
      })
      .then(
        () => null,
        (error: unknown) => error,
      );

    expect(failure).toBeInstanceOf(Error);
    const cause = (failure as Error & { cause?: unknown }).cause;
    expect(String(cause instanceof Error ? cause.message : failure)).toContain(
      "capability_profile_account_id_key",
    );
  });
});

describe("her own profile", () => {
  test("is null before she publishes", async ({ database }) => {
    const accountId = await anAccount(database);

    expect(await findOwnProfile(database.db, accountId)).toBeNull();
  });

  test("carries the held fields, her email, the Skills by label and the photo state", async ({
    database,
  }) => {
    const accountId = await anAccount(database);
    await publishProfile(database.db, accountId, INPUT);

    const own = await findOwnProfile(database.db, accountId);

    expect(own).toMatchObject({
      fullName: INPUT.fullName,
      firstName: INPUT.firstName,
      lastInitial: "R",
      city: "dosquebradas",
      headline: INPUT.headline,
      about: INPUT.about,
      phone: "+573001234567",
      email: WORKER,
      photoState: "absent",
      photoUrl: null,
    });
    // In label order: _Cocinar…_ sorts before _Panadería…_.
    expect(own?.skills.map((skill) => skill.slug)).toEqual(["home-cooking", "baking-and-pastry"]);
  });

  test("is scoped to the Account: another Account reads nothing", async ({ database }) => {
    const ana = await anAccount(database);
    const carlos = await anAccount(database, "carlos@recomencemos.test");
    await publishProfile(database.db, ana, INPUT);

    expect(await findOwnProfile(database.db, carlos)).toBeNull();
    expect(await hasProfile(database.db, carlos)).toBe(false);
  });
});

describe("the prefill", () => {
  test("is the Account's name, which a magic-link Account leaves empty", async ({ database }) => {
    const accountId = await anAccount(database);

    expect(await readPublishPrefill(database.db, accountId)).toEqual({ fullName: "" });
  });

  test("is the Google-door name when there is one", async ({ database }) => {
    const accountId = await anAccount(database);
    await database.db
      .update(schema.user)
      .set({ name: "Ana María Restrepo" })
      .where(eq(schema.user.id, accountId));

    expect(await readPublishPrefill(database.db, accountId)).toEqual({
      fullName: "Ana María Restrepo",
    });
  });
});
