/**
 * Seam 2 over story 25: **her Pause, what it reaches, and what it must leave
 * alone.**
 *
 * A pause is one nullable column, and the whole of its value is in the reads
 * that carry it. So most of this file is about *other* modules: every read that
 * serves somebody who is not her — the Wall, the browsable list under each
 * filter, both halves of the gated read, and the send — has to answer for a
 * paused profile exactly as it answers for one that does not exist. That is the
 * answer C22 already gives for a profile that is not published, so a pause opens
 * no new oracle.
 *
 * The other half is what a pause does **not** reach, and each is asserted
 * rather than assumed:
 *
 * - an Offer already sent is still reviewed and delivered, and one already
 *   delivered can still be accepted — no Offer state is added or reused;
 * - resuming leaves `published_at` alone, so pause-then-resume is not a free
 *   bump to the top of the Wall (#139's reason, by a second route);
 * - while the profile is taken down neither action writes anything, so whatever
 *   later reverses a takedown restores her exactly as she left it (DD8);
 * - no `AdminAction` is written — a pause is her act on her own row.
 *
 * **The takedown is written into the fixture directly.** No action takes a
 * profile down yet (#28 brings it), so setting `state` by hand is the only way
 * to reach that state today — and what is under test is what *these* two
 * functions do in it, not how it was reached.
 */

import { eq } from "drizzle-orm";
import type { AdminActor } from "#admin/actor";
import { runAdminAction } from "#admin/index";
import { CURRENT_CONSENT_VERSIONS } from "#consent/registry";
import { acceptOffer, pendingOffers, sendOffer } from "#offers";
import { findOwnProfile, pauseProfile, publishProfile, resumeProfile } from "#profiles";
import { findGatedIdentity, findGatedWorkHistory } from "#profiles/gated";
import { listBrowse, listWall } from "#profiles/listing";
import * as schema from "#schema";
import { signedInAccountId } from "#testing/auth-stack";
import { test } from "#testing/fixtures";
import type { TestDatabase } from "#testing/fixtures";

const PROFILE = {
  fullName: "Ana María Restrepo Gómez",
  firstName: "Ana María",
  lastInitial: "R",
  city: "pereira",
  headline: "Cocino almuerzos y comida casera para eventos pequeños",
  about: "Catorce años cocinando para familias y oficinas.",
  phone: "300 123 4567",
  skillSlugs: ["home-cooking"],
  workHistory: ["Cocina de un restaurante en el centro de Pereira"],
  consentVersions: CURRENT_CONSENT_VERSIONS,
} as const;

const TERMS = {
  workDescription: "Necesito que cocines almuerzos para ocho personas el sábado",
  payTerms: "$120.000 por el día, pagados el mismo sábado",
  whenText: "Sábado 12 de septiembre, desde las 7 de la mañana",
} as const;

const PAUSED_AT = new Date("2026-09-11T14:00:00Z");
const LATER = new Date("2026-09-11T18:30:00Z");

/** A published Worker, through the module that owns publishing. */
async function aWorker(database: TestDatabase, email = "ana@recomencemos.test") {
  const accountId = await signedInAccountId(database, email);
  const published = await publishProfile(database.db, accountId, PROFILE);

  if (!published.ok) throw new Error("the fixture profile did not publish");

  return { accountId, slug: published.slug };
}

/** One Offer from a Hirer to `slug`, left where `sendOffer` leaves it — its id. */
async function aPendingOffer(database: TestDatabase, slug: string): Promise<string> {
  const hirer = await signedInAccountId(database, "carlos@recomencemos.test");
  const sent = await sendOffer(database.db, hirer, {
    ...TERMS,
    profileSlug: slug,
    identity: { hirerName: "Carlos Restrepo", hirerPhone: "3105558899" },
    consentVersions: CURRENT_CONSENT_VERSIONS,
  });

  if (!sent.ok) throw new Error(`the fixture Offer did not send: ${sent.reason}`);

  return sent.offerId;
}

/**
 * An Admin to deliver with. The brand is forged, for the reason
 * `run-admin-action.integration.test.ts` gives at length; the Account is real,
 * so the audit row it writes points at somebody.
 */
async function anAdmin(database: TestDatabase): Promise<AdminActor> {
  const accountId = await signedInAccountId(database, "admin@recomencemos.test");
  return { accountId } as AdminActor;
}

async function rowOf(database: TestDatabase, accountId: string) {
  const [row] = await database.db
    .select({
      pausedAt: schema.capabilityProfile.pausedAt,
      publishedAt: schema.capabilityProfile.publishedAt,
      state: schema.capabilityProfile.state,
    })
    .from(schema.capabilityProfile)
    .where(eq(schema.capabilityProfile.accountId, accountId));

  if (!row) throw new Error("the fixture profile is gone");
  return row;
}

/** See the file comment: no action takes a profile down yet. */
async function takeDown(database: TestDatabase, accountId: string): Promise<void> {
  await database.db
    .update(schema.capabilityProfile)
    .set({ state: "taken_down" })
    .where(eq(schema.capabilityProfile.accountId, accountId));
}

async function offerStateOf(database: TestDatabase, offerId: string) {
  const [row] = await database.db
    .select({ state: schema.offer.state })
    .from(schema.offer)
    .where(eq(schema.offer.id, offerId));

  return row?.state;
}

const slugsOf = (page: { readonly items: readonly { readonly slug: string }[] }) =>
  page.items.map((item) => item.slug);

describe("pausing and resuming", () => {
  test("stamps when she paused, and clears it when she resumes", async ({ database }) => {
    const ana = await aWorker(database);

    expect(await pauseProfile(database.db, ana.accountId, PAUSED_AT)).toEqual({ ok: true });
    expect((await rowOf(database, ana.accountId)).pausedAt).toEqual(PAUSED_AT);

    expect(await resumeProfile(database.db, ana.accountId)).toEqual({ ok: true });
    expect((await rowOf(database, ana.accountId)).pausedAt).toBeNull();
  });

  test("a second pause is a no-op that keeps the first one's time", async ({ database }) => {
    const ana = await aWorker(database);

    await pauseProfile(database.db, ana.accountId, PAUSED_AT);
    expect(await pauseProfile(database.db, ana.accountId, LATER)).toEqual({ ok: true });

    // "Since when" is the first tap, not the last one.
    expect((await rowOf(database, ana.accountId)).pausedAt).toEqual(PAUSED_AT);
  });

  test("resuming a profile that is not paused is a no-op, not an error", async ({ database }) => {
    const ana = await aWorker(database);

    expect(await resumeProfile(database.db, ana.accountId)).toEqual({ ok: true });
    expect((await rowOf(database, ana.accountId)).pausedAt).toBeNull();
  });

  test("answers no_profile to an Account that never published", async ({ database }) => {
    const nobody = await signedInAccountId(database, "sin-perfil@recomencemos.test");

    expect(await pauseProfile(database.db, nobody, PAUSED_AT)).toEqual({
      ok: false,
      reason: "no_profile",
    });
    expect(await resumeProfile(database.db, nobody)).toEqual({ ok: false, reason: "no_profile" });
  });

  test("touches only her own profile", async ({ database }) => {
    const ana = await aWorker(database);
    const other = await aWorker(database, "otra@recomencemos.test");

    await pauseProfile(database.db, ana.accountId, PAUSED_AT);

    expect((await rowOf(database, other.accountId)).pausedAt).toBeNull();
  });

  test("writes no audit row, because a pause is hers and not an Admin's", async ({ database }) => {
    const ana = await aWorker(database);

    await pauseProfile(database.db, ana.accountId, PAUSED_AT);
    await resumeProfile(database.db, ana.accountId);

    const audit = await database.db.select().from(schema.adminAction);
    expect(audit).toEqual([]);
  });
});

describe("what a pause reaches, for everyone but her", () => {
  test("takes her off the Wall, and resuming puts her back", async ({ database }) => {
    const ana = await aWorker(database);

    await pauseProfile(database.db, ana.accountId, PAUSED_AT);
    expect(slugsOf(await listWall(database.db))).not.toContain(ana.slug);

    await resumeProfile(database.db, ana.accountId);
    expect(slugsOf(await listWall(database.db))).toContain(ana.slug);
  });

  test("takes her off the browsable list under every filter", async ({ database }) => {
    const ana = await aWorker(database);
    // A visible neighbour matching every filter, so an empty page cannot pass
    // for a filtered one.
    const other = await aWorker(database, "otra@recomencemos.test");

    await pauseProfile(database.db, ana.accountId, PAUSED_AT);

    const filters = [
      {},
      { city: "pereira" as const },
      { skill: "home-cooking" },
      { query: "almuerzos" },
      { city: "pereira" as const, skill: "home-cooking", query: "almuerzos" },
    ];
    const pages = await Promise.all(filters.map((options) => listBrowse(database.db, options)));

    pages.forEach((page, index) => {
      const slugs = slugsOf(page);
      expect(slugs, JSON.stringify(filters[index])).toContain(other.slug);
      expect(slugs, JSON.stringify(filters[index])).not.toContain(ana.slug);
    });
  });

  test("answers the gated read as it answers a profile that does not exist", async ({
    database,
  }) => {
    const ana = await aWorker(database);

    await pauseProfile(database.db, ana.accountId, PAUSED_AT);

    expect(await findGatedIdentity(database.db, ana.slug)).toBeNull();
    expect(await findGatedWorkHistory(database.db, ana.slug)).toEqual([]);

    await resumeProfile(database.db, ana.accountId);

    expect(await findGatedIdentity(database.db, ana.slug)).not.toBeNull();
    expect(await findGatedWorkHistory(database.db, ana.slug)).toEqual(PROFILE.workHistory);
  });

  test("refuses a new Offer with the answer a missing profile gets", async ({ database }) => {
    const ana = await aWorker(database);
    const hirer = await signedInAccountId(database, "carlos@recomencemos.test");
    const offer = {
      ...TERMS,
      profileSlug: ana.slug,
      identity: { hirerName: "Carlos Restrepo", hirerPhone: "3105558899" },
      consentVersions: CURRENT_CONSENT_VERSIONS,
    };

    await pauseProfile(database.db, ana.accountId, PAUSED_AT);
    expect(await sendOffer(database.db, hirer, offer)).toEqual({
      ok: false,
      reason: "profile_not_found",
    });

    await resumeProfile(database.db, ana.accountId);
    expect(await sendOffer(database.db, hirer, offer)).toMatchObject({ ok: true });
  });
});

describe("what a pause does not reach", () => {
  test("an Offer sent before the pause is still delivered to her", async ({ database }) => {
    const ana = await aWorker(database);
    const offerId = await aPendingOffer(database, ana.slug);

    await pauseProfile(database.db, ana.accountId, PAUSED_AT);
    await runAdminAction(database.db, await anAdmin(database), "deliverOffer", { offerId });

    expect(await offerStateOf(database, offerId)).toBe("delivered");
  });

  test("an Offer already delivered can still be accepted while she is paused", async ({
    database,
  }) => {
    const ana = await aWorker(database);
    const offerId = await aPendingOffer(database, ana.slug);
    await runAdminAction(database.db, await anAdmin(database), "deliverOffer", { offerId });

    await pauseProfile(database.db, ana.accountId, PAUSED_AT);

    expect(await acceptOffer(database.db, ana.accountId, offerId)).toMatchObject({ ok: true });
    expect(await offerStateOf(database, offerId)).toBe("accepted");
  });

  /**
   * **An Offer held when she paused is reviewed and delivered as normal.** Held
   * means its sender was frozen by a Report; it goes back to the queue when the
   * Report is cleared, and is delivered from there. No action clears a Report
   * yet, so the fixture writes both states — what is under test is that her
   * pause stops neither step, and that the Admin reading the queue sees she is
   * paused.
   */
  test("an Offer held when she paused stays in the queue, and is delivered once released", async ({
    database,
  }) => {
    const ana = await aWorker(database);
    const offerId = await aPendingOffer(database, ana.slug);
    await database.db
      .update(schema.offer)
      .set({ state: "on_hold" })
      .where(eq(schema.offer.id, offerId));

    await pauseProfile(database.db, ana.accountId, PAUSED_AT);

    const queue = await pendingOffers(database.db, 10);
    expect(queue.items.find((item) => item.id === offerId)).toMatchObject({
      workerPausedAt: PAUSED_AT,
    });

    await database.db
      .update(schema.offer)
      .set({ state: "pending_review" })
      .where(eq(schema.offer.id, offerId));
    await runAdminAction(database.db, await anAdmin(database), "deliverOffer", { offerId });

    expect(await offerStateOf(database, offerId)).toBe("delivered");
  });

  test("resuming leaves her where she was on the Wall", async ({ database }) => {
    // Oldest first, so she is at the bottom — where a stamped `published_at`
    // would visibly lift her from.
    const ana = await aWorker(database);
    await aWorker(database, "segunda@recomencemos.test");
    await aWorker(database, "tercera@recomencemos.test");

    const before = slugsOf(await listWall(database.db));
    const publishedAt = (await rowOf(database, ana.accountId)).publishedAt;

    await pauseProfile(database.db, ana.accountId, PAUSED_AT);
    await resumeProfile(database.db, ana.accountId);

    expect(slugsOf(await listWall(database.db))).toEqual(before);
    expect((await rowOf(database, ana.accountId)).publishedAt).toEqual(publishedAt);
  });
});

describe("while the profile is taken down", () => {
  test("a pause writes nothing", async ({ database }) => {
    const ana = await aWorker(database);
    await takeDown(database, ana.accountId);

    expect(await pauseProfile(database.db, ana.accountId, PAUSED_AT)).toEqual({ ok: true });
    expect((await rowOf(database, ana.accountId)).pausedAt).toBeNull();
  });

  test("a resume writes nothing, and cannot make her visible", async ({ database }) => {
    const ana = await aWorker(database);
    await pauseProfile(database.db, ana.accountId, PAUSED_AT);
    await takeDown(database, ana.accountId);

    expect(await resumeProfile(database.db, ana.accountId)).toEqual({ ok: true });

    const row = await rowOf(database, ana.accountId);
    expect(row.pausedAt).toEqual(PAUSED_AT);
    expect(row.state).toBe("taken_down");
    expect(slugsOf(await listWall(database.db))).not.toContain(ana.slug);
  });

  test("a takedown leaves her pause exactly as it found it", async ({ database }) => {
    const ana = await aWorker(database);
    await pauseProfile(database.db, ana.accountId, PAUSED_AT);

    await takeDown(database, ana.accountId);

    expect((await rowOf(database, ana.accountId)).pausedAt).toEqual(PAUSED_AT);
  });
});

describe("her own page", () => {
  test("carries when she paused, and whether the profile is taken down", async ({ database }) => {
    const ana = await aWorker(database);

    expect(await findOwnProfile(database.db, ana.accountId)).toMatchObject({
      pausedAt: null,
      takenDown: false,
    });

    await pauseProfile(database.db, ana.accountId, PAUSED_AT);
    expect(await findOwnProfile(database.db, ana.accountId)).toMatchObject({
      pausedAt: PAUSED_AT,
      takenDown: false,
    });

    await takeDown(database, ana.accountId);
    expect(await findOwnProfile(database.db, ana.accountId)).toMatchObject({ takenDown: true });
  });
});
