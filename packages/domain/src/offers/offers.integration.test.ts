/**
 * Seam 2 over the Offer aggregate — the transaction, the lock discipline, and
 * the two things that are only true if a rollback reaches everything.
 *
 * **What this seam can and cannot prove about NFR15, stated precisely.** PGlite
 * is single-connection and in-process, so the interleaving DD9 describes cannot
 * be staged here and the spec says so: _"NFR15's race-freedom is the one
 * requirement this seam structurally cannot exercise"_. What is observable, and
 * what the two cases under **the lock, and the order beneath it** assert, is the
 * discipline that makes the race impossible when there are two connections: the
 * state and the Block edge are read from the **row inside the transaction**
 * rather than from anything a caller read earlier, and the `SELECT … FOR UPDATE`
 * is the **first** statement in that transaction rather than one taken after the
 * value it protects has already been read.
 *
 * The second of those is asserted from the statement log rather than by reading
 * the source, which is the only form of it a refactor cannot quietly break.
 *
 * Rows are created through the modules that own them wherever one exists — a
 * hand-inserted profile drifts from the schema on its first added column. The
 * Block edge is the exception and has to be: `blockFromOffer` is story 10's, so
 * the only honest way to cover the refusal before its writer exists is to insert
 * the edge the read is about.
 */

import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { CURRENT_CONSENT_VERSIONS, recordConsent } from "#consent/index";
import { listSentOffers, pendingOffers, sendOffer, type SendOfferInput } from "#offers";
import { publishProfile } from "#profiles";
import * as schema from "#schema";
import { signedInAccountId } from "#testing/auth-stack";
import { test } from "#testing/fixtures";
import type { TestDatabase } from "#testing/fixtures";

const NOW = new Date("2026-09-08T12:00:00.000Z");

const TERMS = {
  workDescription: "Necesito que cocines almuerzos para ocho personas el sábado",
  payTerms: "$120.000 por el día, pagados el mismo sábado",
  whenText: "Sábado 12 de septiembre, desde las 7 de la mañana",
} as const;

const IDENTITY = { hirerName: "Carlos Restrepo", hirerPhone: "3105558899" } as const;

function anOffer(profileSlug: string, overrides: Partial<SendOfferInput> = {}): SendOfferInput {
  return {
    ...TERMS,
    profileSlug,
    identity: IDENTITY,
    consentVersions: CURRENT_CONSENT_VERSIONS,
    ...overrides,
  };
}

/** A published Worker, through the module that owns publishing. */
async function aWorker(database: TestDatabase, email = "ana@recomencemos.test") {
  const accountId = await signedInAccountId(database, email);

  const published = await publishProfile(database.db, accountId, {
    fullName: "Ana María Restrepo Gómez",
    firstName: "Ana María",
    lastInitial: "R",
    city: "pereira",
    headline: "Cocino almuerzos y comida casera para eventos pequeños",
    about: "Catorce años cocinando para familias y oficinas.",
    phone: "+573001234567",
    skillSlugs: ["home-cooking"],
    workHistory: ["Cocina de un restaurante en el centro de Pereira"],
    consentVersions: CURRENT_CONSENT_VERSIONS,
  });

  if (!published.ok) throw new Error("the fixture profile did not publish");

  const [profile] = await database.db
    .select({ id: schema.capabilityProfile.id })
    .from(schema.capabilityProfile)
    .where(eq(schema.capabilityProfile.slug, published.slug));

  if (!profile) throw new Error("the fixture profile is not readable");

  return { accountId, slug: published.slug, profileId: profile.id };
}

async function aHirer(database: TestDatabase, email = "carlos@recomencemos.test") {
  return signedInAccountId(database, email);
}

describe("sending an Offer", () => {
  test("writes the terms, the Consent row and his asserted identity together", async ({
    database,
  }) => {
    const worker = await aWorker(database);
    const hirer = await aHirer(database);

    const outcome = await sendOffer(database.db, hirer, anOffer(worker.slug));
    expect(outcome).toMatchObject({ ok: true });

    const [written] = await database.db
      .select()
      .from(schema.offer)
      .where(eq(schema.offer.hirerAccountId, hirer));

    expect(written).toMatchObject({
      workDescription: TERMS.workDescription,
      payTerms: TERMS.payTerms,
      whenText: TERMS.whenText,
      state: "pending_review",
      deliveredAt: null,
      capabilityProfileId: worker.profileId,
    });

    const consents = await database.db
      .select({ side: schema.consent.side })
      .from(schema.consent)
      .where(eq(schema.consent.accountId, hirer));

    expect(consents.map((row) => row.side)).toEqual(["hirer"]);

    const [account] = await database.db
      .select({ hirerName: schema.user.hirerName, hirerPhone: schema.user.hirerPhone })
      .from(schema.user)
      .where(eq(schema.user.id, hirer));

    // Normalised to E.164 by the same function her own number goes through.
    expect(account).toMatchObject({ hirerName: "Carlos Restrepo", hirerPhone: "+573105558899" });
  });

  /**
   * The rollback, from the end that is hardest to reach any other way. A stale
   * consent version throws inside the transaction, after the Offer and the
   * identity have been written — so if any of the three escaped the rollback,
   * this is where it would show.
   */
  test("leaves no Offer, no identity and no Consent row when the consent is stale", async ({
    database,
  }) => {
    const worker = await aWorker(database);
    const hirer = await aHirer(database);

    await expect(
      sendOffer(
        database.db,
        hirer,
        anOffer(worker.slug, {
          consentVersions: { notice: "1999-01-01", authorization: "1999-01-01" },
        }),
      ),
    ).rejects.toThrow();

    const offers = await database.db.select().from(schema.offer);
    const consents = await database.db.select().from(schema.consent);
    const [account] = await database.db
      .select({ hirerName: schema.user.hirerName })
      .from(schema.user)
      .where(eq(schema.user.id, hirer));

    expect(offers).toHaveLength(0);
    // Only the Worker's, from publishing. His never committed.
    expect(consents.map((row) => row.side)).toEqual(["worker"]);
    expect(account?.hirerName).toBeNull();
  });

  test("asks for a name and a number on the first Offer and refuses without them", async ({
    database,
  }) => {
    const worker = await aWorker(database);
    const hirer = await aHirer(database);

    const outcome = await sendOffer(
      database.db,
      hirer,
      anOffer(worker.slug, { identity: undefined }),
    );

    expect(outcome).toMatchObject({
      ok: false,
      reason: "refused",
      refusals: [{ field: "hirerName", code: "identity_required" }],
    });
    expect(await database.db.select().from(schema.offer)).toHaveLength(0);
  });

  test("refuses a number it cannot read back, and names the field", async ({ database }) => {
    const worker = await aWorker(database);
    const hirer = await aHirer(database);

    const outcome = await sendOffer(
      database.db,
      hirer,
      anOffer(worker.slug, { identity: { hirerName: "Carlos", hirerPhone: "12" } }),
    );

    expect(outcome).toMatchObject({
      ok: false,
      reason: "refused",
      refusals: [{ field: "hirerPhone", code: "phone_unrecognised" }],
    });
  });

  /**
   * **The coupling "is this his first Offer" actually rests on, pinned.**
   *
   * The question is answered from his **Consent row**, not from an Offer count —
   * because the *autorización* is taken once, before his first Offer takes a
   * field, so its presence is the fact. That holds only while `sendOffer` is the
   * sole writer of a `hirer`-side Consent row: a later surface that recorded one
   * somewhere else would make his name unaskable and leave the Admin queue
   * rendering no name at all, silently.
   *
   * So the coupling is asserted rather than assumed. If this goes red, the fix is
   * not here — it is that something else now writes that row, and `sendOffer`
   * needs a different question.
   */
  test("treats an Account that already consented as a Hirer as a repeat sender", async ({
    database,
  }) => {
    const worker = await aWorker(database);
    const hirer = await aHirer(database);

    await database.db.transaction(async (tx) => {
      await recordConsent(tx, {
        accountId: hirer,
        side: "hirer",
        versions: CURRENT_CONSENT_VERSIONS,
      });
    });

    // No identity on the input, and it is not asked for: the row already exists.
    const outcome = await sendOffer(
      database.db,
      hirer,
      anOffer(worker.slug, { identity: undefined }),
    );

    expect(outcome).toMatchObject({ ok: true });

    const [account] = await database.db
      .select({ hirerName: schema.user.hirerName })
      .from(schema.user)
      .where(eq(schema.user.id, hirer));

    // Nothing was written onto the Account, because nothing was collected.
    expect(account?.hirerName).toBeNull();
  });

  /**
   * C4's "collected once": the second Offer neither asks nor overwrites. The
   * name a Worker already read may not change under her, and this is the case
   * that says so.
   */
  test("does not rewrite his name or his number on a later Offer", async ({ database }) => {
    const worker = await aWorker(database);
    const hirer = await aHirer(database);

    await sendOffer(database.db, hirer, anOffer(worker.slug));

    const second = await sendOffer(
      database.db,
      hirer,
      anOffer(worker.slug, {
        identity: { hirerName: "Otro Nombre", hirerPhone: "3009998877" },
      }),
    );

    expect(second).toMatchObject({ ok: true });

    const [account] = await database.db
      .select({ hirerName: schema.user.hirerName, hirerPhone: schema.user.hirerPhone })
      .from(schema.user)
      .where(eq(schema.user.id, hirer));

    expect(account).toMatchObject({ hirerName: "Carlos Restrepo", hirerPhone: "+573105558899" });

    // And his *autorización* is still one row: consent is given once, not per send.
    const consents = await database.db
      .select({ side: schema.consent.side })
      .from(schema.consent)
      .where(eq(schema.consent.accountId, hirer));

    expect(consents).toHaveLength(1);
  });

  /**
   * NFR12, on the Offer body. The refusal names the fragment it objected to, and
   * everything he typed is still his — nothing is written, so nothing is lost.
   */
  test("refuses a phone number in the work description and quotes the fragment back", async ({
    database,
  }) => {
    const worker = await aWorker(database);
    const hirer = await aHirer(database);

    const outcome = await sendOffer(
      database.db,
      hirer,
      anOffer(worker.slug, { workDescription: "Escríbeme al 300 123 4567 y coordinamos" }),
    );

    expect(outcome).toMatchObject({
      ok: false,
      reason: "refused",
      refusals: [{ field: "workDescription", code: "contact_detail", kind: "phone" }],
    });

    const refusals = outcome.ok ? [] : "refusals" in outcome ? outcome.refusals : [];
    expect(refusals[0]).toMatchObject({ fragment: expect.stringContaining("300") });
    expect(await database.db.select().from(schema.offer)).toHaveLength(0);
  });

  test("refuses a messaging link in the pay terms", async ({ database }) => {
    const worker = await aWorker(database);
    const hirer = await aHirer(database);

    const outcome = await sendOffer(
      database.db,
      hirer,
      anOffer(worker.slug, { payTerms: "Hablamos por wa.me/573001234567" }),
    );

    expect(outcome).toMatchObject({
      ok: false,
      reason: "refused",
      refusals: [{ field: "payTerms", code: "contact_detail", kind: "messaging_url" }],
    });
  });

  test("answers a slug naming nobody the same as one naming a taken-down profile", async ({
    database,
  }) => {
    const worker = await aWorker(database);
    const hirer = await aHirer(database);

    const unknown = await sendOffer(database.db, hirer, anOffer("aaaaaaaaaaaaaaaa"));

    await database.db
      .update(schema.capabilityProfile)
      .set({ state: "taken_down" })
      .where(eq(schema.capabilityProfile.slug, worker.slug));

    const takenDown = await sendOffer(database.db, hirer, anOffer(worker.slug));

    expect(unknown).toEqual({ ok: false, reason: "profile_not_found" });
    expect(takenDown).toEqual({ ok: false, reason: "profile_not_found" });
  });

  /**
   * DD9: it inflates `delivered_offer_count`, which is NFR22's ordering input,
   * so the fairness mechanism would be defeatable in one request by the person
   * it exists to protect.
   */
  test("refuses an Offer from a Worker to her own profile", async ({ database }) => {
    const worker = await aWorker(database);

    const outcome = await sendOffer(database.db, worker.accountId, anOffer(worker.slug));

    expect(outcome).toEqual({ ok: false, reason: "own_profile" });
    expect(await database.db.select().from(schema.offer)).toHaveLength(0);
  });
});

describe("the lock, and the order beneath it", () => {
  /**
   * **The state is read from the row, not from anything a caller read earlier.**
   * The first send establishes that this Hirer could send; the freeze then writes
   * the row; the second send has to see it. A `sendOffer` that trusted a session,
   * a cached value or a pre-read state would pass the first assertion and fail
   * this one.
   */
  test("refuses a send whose Account was frozen after an earlier one succeeded", async ({
    database,
  }) => {
    const worker = await aWorker(database);
    const hirer = await aHirer(database);

    expect(await sendOffer(database.db, hirer, anOffer(worker.slug))).toMatchObject({ ok: true });

    await database.db
      .update(schema.user)
      .set({ offerSendingState: "frozen" })
      .where(eq(schema.user.id, hirer));

    expect(await sendOffer(database.db, hirer, anOffer(worker.slug))).toEqual({
      ok: false,
      reason: "may_not_send",
      state: "frozen",
    });

    expect(await database.db.select().from(schema.offer)).toHaveLength(1);
  });

  test("refuses a banned Account and says which state it is in", async ({ database }) => {
    const worker = await aWorker(database);
    const hirer = await aHirer(database);

    await database.db
      .update(schema.user)
      .set({ offerSendingState: "banned" })
      .where(eq(schema.user.id, hirer));

    expect(await sendOffer(database.db, hirer, anOffer(worker.slug))).toEqual({
      ok: false,
      reason: "may_not_send",
      state: "banned",
    });
  });

  /**
   * The Block edge, read under the same lock. Story 10 writes it; this inserts
   * it, because a refusal that cannot be reached before its writer exists is a
   * refusal nothing covers.
   */
  test("refuses a Blocked sender, and the edge is read at send time", async ({ database }) => {
    const worker = await aWorker(database);
    const hirer = await aHirer(database);

    expect(await sendOffer(database.db, hirer, anOffer(worker.slug))).toMatchObject({ ok: true });

    await database.db
      .insert(schema.block)
      .values({ workerProfileId: worker.profileId, hirerAccountId: hirer });

    expect(await sendOffer(database.db, hirer, anOffer(worker.slug))).toEqual({
      ok: false,
      reason: "blocked",
    });

    expect(await database.db.select().from(schema.offer)).toHaveLength(1);
  });

  /** A Block is one Worker's decision about one Hirer, and reaches nobody else. */
  test("does not stop him writing to a different Worker", async ({ database }) => {
    const blocked = await aWorker(database, "ana@recomencemos.test");
    const other = await aWorker(database, "luz@recomencemos.test");
    const hirer = await aHirer(database);

    await database.db
      .insert(schema.block)
      .values({ workerProfileId: blocked.profileId, hirerAccountId: hirer });

    expect(await sendOffer(database.db, hirer, anOffer(other.slug))).toMatchObject({ ok: true });
  });

  /**
   * **NFR15's discipline, read off the statement log.**
   *
   * The requirement is not merely that the lock exists — it is that it is taken
   * *before* the value it protects is read, because a lock acquired afterwards
   * protects a value that is already stale. That ordering is invisible to every
   * assertion above and to any test that only looks at outcomes, and it is
   * exactly what a refactor moving one `await` would break.
   *
   * So the send runs through a Drizzle handle carrying a logger over the same
   * engine, and the first statement inside the transaction has to be the
   * `FOR UPDATE` on `"user"` — with the sending-state read part of it, and the
   * Block edge read after it.
   */
  test("takes the row lock as the first statement, ahead of both reads", async ({ database }) => {
    const worker = await aWorker(database);
    const hirer = await aHirer(database);

    const statements: string[] = [];
    const watched = drizzle(database.client, {
      schema,
      logger: { logQuery: (query) => statements.push(query) },
    });

    expect(await sendOffer(watched, hirer, anOffer(worker.slug))).toMatchObject({ ok: true });

    const locks = statements.filter((query) => /for update/i.test(query));
    expect(locks, "sendOffer issued no SELECT ... FOR UPDATE at all").toHaveLength(1);
    expect(locks[0]).toMatch(/from\s+"user"/i);
    expect(locks[0]).toMatch(/offer_sending_state/i);

    const lockAt = statements.findIndex((query) => /for update/i.test(query));
    const blockReadAt = statements.findIndex((query) => /from\s+"block"/i.test(query));

    expect(blockReadAt, "sendOffer never read the Block edge").toBeGreaterThan(-1);
    expect(lockAt).toBeLessThan(blockReadAt);
  });
});

describe("immutability", () => {
  /**
   * **The product's own promise, asserted as an absence.** No `CHECK` can see a
   * previous row, so what makes an Offer immutable is that this package publishes
   * no way to rewrite one — and an absence is only a guarantee while something
   * counts it. A function added here that writes `workDescription`, `payTerms` or
   * `whenText` on an existing row turns this red.
   */
  test("publishes no function that rewrites what he wrote", async () => {
    const module = (await import("#offers")) as Record<string, unknown>;
    const exported = Object.keys(module).filter((key) => typeof module[key] === "function");

    expect(exported.toSorted()).toEqual(["listSentOffers", "pendingOffers", "sendOffer"]);
  });

  test("leaves the terms untouched by anything the queue does to it", async ({ database }) => {
    const worker = await aWorker(database);
    const hirer = await aHirer(database);

    await sendOffer(database.db, hirer, anOffer(worker.slug));

    const before = await database.db.select().from(schema.offer);

    // Everything a later story does to an Offer moves its state and its
    // `delivered_at`, and this is the assertion that the three text columns are
    // not on that list.
    await database.db
      .update(schema.offer)
      .set({ state: "delivered", deliveredAt: NOW })
      .where(eq(schema.offer.state, "pending_review"));

    const after = await database.db.select().from(schema.offer);

    expect(after[0]?.workDescription).toBe(before[0]?.workDescription);
    expect(after[0]?.payTerms).toBe(before[0]?.payTerms);
    expect(after[0]?.whenText).toBe(before[0]?.whenText);
  });
});

describe("the Offers one Hirer has sent", () => {
  test("carries her public identity, his terms, and no contact detail of hers", async ({
    database,
  }) => {
    const worker = await aWorker(database);
    const hirer = await aHirer(database);

    await sendOffer(database.db, hirer, anOffer(worker.slug));

    const sent = await listSentOffers(database.db, hirer, NOW);

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      state: "pending_review",
      workDescription: TERMS.workDescription,
      reviewDelayed: false,
      worker: { slug: worker.slug, firstName: "Ana María", lastInitial: "R", city: "pereira" },
    });

    // Her gated and exchanged fields, counted at the boundary that publishes them.
    const dump = JSON.stringify(sent);
    expect(dump).not.toContain("Ana María Restrepo Gómez");
    expect(dump).not.toContain("+573001234567");
    expect(dump).not.toContain("ana@recomencemos.test");
  });

  test("carries her Skills without a query per row", async ({ database }) => {
    const worker = await aWorker(database);
    const hirer = await aHirer(database);

    await sendOffer(database.db, hirer, anOffer(worker.slug));

    const sent = await listSentOffers(database.db, hirer, NOW);

    expect(sent[0]?.worker.skills).toEqual([
      { slug: "home-cooking", labelEs: "Cocinar almuerzos y comida casera" },
    ]);
  });

  test("says a review is taking longer than usual once it passes the window", async ({
    database,
  }) => {
    const worker = await aWorker(database);
    const hirer = await aHirer(database);

    await sendOffer(database.db, hirer, anOffer(worker.slug));

    const [row] = await database.db.select({ sentAt: schema.offer.createdAt }).from(schema.offer);
    const dayLater = new Date((row?.sentAt.getTime() ?? 0) + 24 * 60 * 60 * 1000);

    expect((await listSentOffers(database.db, hirer, dayLater))[0]?.reviewDelayed).toBe(true);
  });

  test("shows him nothing anybody else sent", async ({ database }) => {
    const worker = await aWorker(database);
    const hirer = await aHirer(database);
    const other = await aHirer(database, "otro@recomencemos.test");

    await sendOffer(database.db, hirer, anOffer(worker.slug));
    await sendOffer(database.db, other, anOffer(worker.slug));

    expect(await listSentOffers(database.db, hirer, NOW)).toHaveLength(1);
    expect(await listSentOffers(database.db, other, NOW)).toHaveLength(1);
  });

  test("is empty for an Account that has sent none", async ({ database }) => {
    const hirer = await aHirer(database);

    expect(await listSentOffers(database.db, hirer, NOW)).toEqual([]);
  });
});

describe("the branch an Admin has to work through", () => {
  /**
   * C55, and the reason it is a case rather than a comment: a page capped at N
   * that also reported a depth of N would be an instrument that goes green
   * exactly when the backlog is at its worst. So the fixture puts **more rows
   * than the cap** in the branch and asserts the two figures against the whole
   * of it.
   */
  test("caps the rows it renders and counts the whole branch", async ({ database }) => {
    const worker = await aWorker(database);
    const hirer = await aHirer(database);

    for (let index = 0; index < 5; index += 1) {
      // Sequential on purpose: each send takes a row lock on the same Account,
      // and the order they arrive in is what the age-of-oldest is about.
      // oxlint-disable-next-line no-await-in-loop
      await sendOffer(database.db, hirer, anOffer(worker.slug));
    }

    const branch = await pendingOffers(database.db, 2);

    expect(branch.items).toHaveLength(2);
    expect(branch.total).toBe(5);
    expect(branch.oldestSentAt).toBeInstanceOf(Date);
  });

  test("counts an Offer held because its sender was frozen", async ({ database }) => {
    const worker = await aWorker(database);
    const hirer = await aHirer(database);

    await sendOffer(database.db, hirer, anOffer(worker.slug));
    await database.db.update(schema.offer).set({ state: "on_hold" });

    const branch = await pendingOffers(database.db, 20);

    expect(branch.total).toBe(1);
  });

  test("counts nothing a person has already read", async ({ database }) => {
    const worker = await aWorker(database);
    const hirer = await aHirer(database);

    await sendOffer(database.db, hirer, anOffer(worker.slug));
    await database.db.update(schema.offer).set({ state: "delivered", deliveredAt: NOW });

    const branch = await pendingOffers(database.db, 20);

    expect(branch).toMatchObject({ total: 0, oldestSentAt: null });
    expect(branch.items).toEqual([]);
  });

  /**
   * NFR11's stated exception, from both sides: Offer review renders the body and
   * her display identity, and **no** phone — hers or his.
   */
  test("renders her display identity and no phone number at all", async ({ database }) => {
    const worker = await aWorker(database);
    const hirer = await aHirer(database);

    await sendOffer(database.db, hirer, anOffer(worker.slug));

    const branch = await pendingOffers(database.db, 20);

    expect(branch.items[0]).toMatchObject({
      workerFirstName: "Ana María",
      workerLastInitial: "R",
      hirerName: "Carlos Restrepo",
      workDescription: TERMS.workDescription,
    });

    const dump = JSON.stringify(branch);
    expect(dump).not.toContain("+573001234567");
    expect(dump).not.toContain("+573105558899");
    expect(dump).not.toContain("Ana María Restrepo Gómez");
  });

  test("is empty and says so with a null age rather than a zero one", async ({ database }) => {
    expect(await pendingOffers(database.db, 20)).toEqual({
      items: [],
      total: 0,
      oldestSentAt: null,
    });
  });
});
