/**
 * NFR33 at seam 2: **100%** of Admin actions write an `AdminAction`, and **0** can
 * commit unaudited.
 *
 * **The completeness half is table-driven over the registry**, which is what the
 * requirement asks for in as many words — _"asserted by a table-driven test over
 * the action registry … which is red for an action added without one"_. So the
 * suite below does not name `revokeSessions` in its audit cases at all: it
 * enumerates `ADMIN_ACTION_NAMES` and drives every member through the same
 * assertions, from one table of inputs. A twelfth action is covered the moment its
 * name and its input exist, and an action added with neither is red here rather
 * than silently uncovered.
 */

import { AppError } from "@repo/errors/app-error";
import { eq } from "drizzle-orm";
import { type AdminActionInput, runAdminAction } from "#admin/index";
import type { AdminActor } from "#admin/actor";
import { ADMIN_ACTION_NAMES, type AdminActionName } from "#admin/names";
import * as schema from "#schema";
import { signIn, signInStack } from "#testing/auth-stack";
import { test } from "#testing/fixtures";
import type { TestDatabase } from "#testing/fixtures";

const ADMIN_ID = "the-admin";
const TARGET = "ana@recomencemos.test";

/**
 * The `SkillRequest` `promoteSkill` acts on, pinned rather than read back.
 *
 * The column is `GENERATED ALWAYS AS IDENTITY`, so the seed writes this value
 * with `OVERRIDING SYSTEM VALUE` — which is what lets {@link INPUTS} be a
 * constant. Reading the key back would mean building the inputs per case, and the
 * completeness table's whole shape is one static input per registered action.
 *
 * It is also the id used by the refusal case, which runs with **nothing** seeded:
 * a request that is not there is `promoteSkill`'s "act that did not happen".
 */
const REQUEST_ID = "4242";
const PROFILE_ID = "77";
/**
 * Keys shaped exactly as `@repo/storage` mints them — 21 characters of its
 * alphabet under each prefix. Written out rather than minted so a fixture
 * cannot drift into something the shape predicate would refuse without anyone
 * noticing which half broke.
 */
const QUARANTINE_KEY = "quarantine/aaaaaaaaaaaaaaaaaaaaa";
const PUBLIC_KEY = "photos/aaaaaaaaaaaaaaaaaaaaa.webp";

/**
 * The Offer both Offer decisions act on, pinned for the same reason.
 *
 * An Offer's key is a UUIDv7 minted in the application rather than a generated
 * identity, so pinning it needs no `OVERRIDING SYSTEM VALUE` — the seed simply
 * writes this value. It is a real v7 rather than an arbitrary UUID so that
 * anything ordering by key sees what production would.
 *
 * The refusal case runs with nothing seeded, which is either decision's "act that
 * did not happen": an Offer id no row carries.
 */
const OFFER_ID = "0199a1f0-2b3c-7def-8000-0123456789ab";

/**
 * The actor, forged for the test.
 *
 * **The cast is the only one in this suite and it is deliberate**: `AdminActor`'s
 * brand is what stops production code constructing one, and `actor.test.ts` plus
 * `admin-door.integration.test.ts` are what prove `requireAdminSession` hands one
 * out only to a session that presented both factors. Re-establishing that here
 * would cost a full sign-in per case to re-assert something already proven, and
 * would make this file about authentication rather than about the audit.
 */
const actor = { accountId: ADMIN_ID } as AdminActor;

/**
 * One valid input per registered action, so the completeness table has something
 * to drive each member with.
 *
 * **The `satisfies` is the second half of the completeness check.** A name added
 * to `ADMIN_ACTION_NAMES` with no entry here fails to compile, so "every action is
 * covered" is not a claim this file makes about itself — it is a condition of the
 * file type-checking at all.
 */
const INPUTS = {
  revokeSessions: { email: TARGET },
  promoteSkill: {
    requestId: REQUEST_ID,
    slug: "sewing-machine-repair",
    labelEs: "Arreglo máquinas de coser",
  },
  deliverOffer: { offerId: OFFER_ID },
  rejectOffer: { offerId: OFFER_ID },
  approvePhoto: { profileId: PROFILE_ID, publicKey: PUBLIC_KEY },
  rejectPhoto: { profileId: PROFILE_ID },
} satisfies { [K in AdminActionName]: AdminActionInput<K> };

/** An Account with two live sessions, so `revokeSessions` has something to revoke. */
async function targetWithSessions(database: TestDatabase): Promise<string> {
  const stack = signInStack(database);
  await signIn(stack, TARGET, { userAgent: "one" });
  await signIn(stack, TARGET, { userAgent: "two" });

  const [account] = await database.db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, TARGET));

  return (account as { id: string }).id;
}

/** A pending request for `promoteSkill` to resolve, under a key the table can name. */
async function pendingRequest(database: TestDatabase): Promise<void> {
  await database.db.insert(schema.user).values({
    id: "the-worker",
    name: "Ana",
    email: "worker@recomencemos.test",
    emailVerified: true,
  });

  await database.db
    .insert(schema.skillRequest)
    .overridingSystemValue()
    .values({ id: BigInt(REQUEST_ID), accountId: "the-worker", text: "Arreglo máquinas de coser" });
}

/**
 * An Offer waiting for a person to read it, under a key the table can name.
 *
 * Inserted directly rather than sent through `sendOffer`: what is under test
 * here is the audit, and driving the whole send would make this fixture depend
 * on that aggregate's own refusals. `offers.integration.test.ts` is where the
 * send is exercised.
 */
async function pendingOffer(database: TestDatabase): Promise<void> {
  await database.db.insert(schema.user).values([
    { id: "the-worker", name: "Ana", email: "worker@recomencemos.test", emailVerified: true },
    { id: "the-hirer", name: "", email: "hirer@recomencemos.test", emailVerified: true },
  ]);

  const [profile] = await database.db
    .insert(schema.capabilityProfile)
    .values({
      accountId: "the-worker",
      slug: "k7m2qx6vb4tn5rzc",
      fullName: "Ana María Restrepo Gómez",
      firstName: "Ana María",
      lastInitial: "R",
      city: "pereira",
      headline: "Cocino almuerzos y comida casera",
      phone: "+573001234567",
      searchText: "ana maria pereira cocino",
    })
    .returning({ id: schema.capabilityProfile.id });

  await database.db.insert(schema.offer).values({
    id: OFFER_ID,
    capabilityProfileId: (profile as { id: bigint }).id,
    hirerAccountId: "the-hirer",
    workDescription: "Cocinar almuerzos para ocho personas",
    payTerms: "$120.000 por el día",
    whenText: "Sábado desde las 7 de la mañana",
  });
}

/**
 * A published profile with a photo waiting, for the two photo actions.
 *
 * **No object is written anywhere, and neither handler needs one**: both are the
 * *row* halves of DD6 steps 4 and 5, and the object work belongs to `#photos`,
 * outside the transaction, for the reason `#admin/handlers` records at length.
 * That split is what makes these two auditable at seam 2 with no bucket in
 * sight — which is also the argument for the split.
 */
async function profileWithPendingPhoto(database: TestDatabase): Promise<void> {
  await database.db.insert(schema.user).values({
    id: "the-photo-worker",
    name: "Luz",
    email: "luz@recomencemos.test",
    emailVerified: true,
  });

  await database.db
    .insert(schema.capabilityProfile)
    .overridingSystemValue()
    .values({
      id: BigInt(PROFILE_ID),
      accountId: "the-photo-worker",
      slug: "aaaaaaaaaaaaaaaa",
      fullName: "Luz Mery Ramírez",
      firstName: "Luz",
      lastInitial: "R",
      city: "pereira",
      headline: "Arreglo máquinas de coser",
      phone: "+573001112233",
      searchText: "arreglo maquinas de coser",
      photoState: "pending",
      photoKey: QUARANTINE_KEY,
      photoAttachedAt: new Date(),
    });
}

/** Everything each registered action needs to exist before it can run. */
async function seedFor(database: TestDatabase, action: AdminActionName): Promise<void> {
  if (action === "revokeSessions") await targetWithSessions(database);
  if (action === "promoteSkill") await pendingRequest(database);
  if (action === "deliverOffer") await pendingOffer(database);
  if (action === "rejectOffer") await pendingOffer(database);
  if (action === "approvePhoto" || action === "rejectPhoto") {
    await profileWithPendingPhoto(database);
  }
}

const audit = (database: TestDatabase) =>
  database.db
    .select({
      actorAccountId: schema.adminAction.actorAccountId,
      action: schema.adminAction.action,
      targetId: schema.adminAction.targetId,
      createdAt: schema.adminAction.createdAt,
    })
    .from(schema.adminAction);

describe.each(ADMIN_ACTION_NAMES)("every Admin action: %s", (action) => {
  test("leaves exactly one AdminAction when it succeeds", async ({ database }) => {
    await seedFor(database, action);

    const outcome = await runAdminAction(database.db, actor, action, INPUTS[action]);
    expect(outcome.ok, `${action} refused: ${outcome.ok ? "" : outcome.error.message}`).toBe(true);

    const rows = await audit(database);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actorAccountId: ADMIN_ID, action });
    expect(rows[0]?.targetId).toBeTruthy();
  });

  /**
   * **The other direction, and the one an insert-at-the-end-of-each-handler
   * implementation gets wrong.** An act that did not happen must leave no record
   * that it did; the shared transaction is what makes that true, and this is what
   * says the transaction is really shared.
   */
  test("leaves no AdminAction when it refuses", async ({ database }) => {
    const outcome = await runAdminAction(database.db, actor, action, INPUTS[action]);

    expect(outcome.ok).toBe(false);
    expect(await audit(database)).toEqual([]);
  });

  /**
   * NFR33 and the Core entities rule: _"ids and enum values only"_. Asserted as a
   * **column list** rather than by inspecting values, because the failure this
   * guards is a later column — `targetEmail`, `reason`, `note` — added to a table
   * retained 24 months, which is the longest retention in the system.
   */
  test("records ids and enum values and nothing else", async ({ database }) => {
    await seedFor(database, action);
    await runAdminAction(database.db, actor, action, INPUTS[action]);

    const [row] = await database.db.select().from(schema.adminAction);
    expect(Object.keys(row ?? {}).toSorted()).toEqual([
      "action",
      "actorAccountId",
      "createdAt",
      "id",
      "targetId",
    ]);
  });

  /**
   * **NFR18's other half, over the values rather than the shape.** An email
   * address, a phrase somebody typed, or any other input value reaching a
   * 24-month table is exactly the "second copy of the thing NFR11 counts" NFR33
   * refuses. The row may name the target by id and by nothing else.
   *
   * **The target id is the exception, and it is the one this table has to make
   * explicit.** `revokeSessions` takes an address and audits an Account id, so no
   * input value can legitimately appear; `promoteSkill` takes the request's own
   * id, and that id *is* the target — the row's whole job is to name what was
   * acted on. Skipping the value that equals `targetId` keeps the assertion about
   * what it is about: every **other** input value, whatever the action, stays out.
   */
  test("puts no input value in the row but the id it acted on", async ({ database }) => {
    await seedFor(database, action);
    await runAdminAction(database.db, actor, action, INPUTS[action]);

    const [row] = await database.db.select().from(schema.adminAction);
    const written = JSON.stringify({ ...row, id: undefined });

    for (const value of Object.values(INPUTS[action] as Record<string, unknown>)) {
      if (String(value) === row?.targetId) continue;
      expect(written).not.toContain(String(value));
    }
  });
});

describe("the audit survives what it audits", () => {
  /**
   * **AC4, and the reason `admin_action` has no foreign keys.** The Account this
   * action was taken against is deleted — story 13's habeas data path, or a
   * moderation ban — and the record of the act stays. A `REFERENCES … ON DELETE
   * CASCADE` would have removed it at the moment it started to matter.
   */
  test("keeps the row when the target Account is deleted", async ({ database }) => {
    const targetId = await targetWithSessions(database);
    await runAdminAction(database.db, actor, "revokeSessions", { email: TARGET });

    await database.db.delete(schema.user).where(eq(schema.user.id, targetId));

    const rows = await audit(database);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.targetId).toBe(targetId);
  });

  /** The same for the Admin, whose Account is no more permanent than anyone's. */
  test("keeps the row when the acting Admin's Account is deleted", async ({ database }) => {
    await targetWithSessions(database);
    await runAdminAction(database.db, actor, "revokeSessions", { email: TARGET });

    const rows = await audit(database);
    expect(rows[0]?.actorAccountId).toBe(ADMIN_ID);
    // The actor id is not a foreign key, so it need not name a row that exists —
    // which is the property under test, stated as the fact that this insert
    // succeeded at all against an id no `user` row carries.
    expect(
      await database.db.select().from(schema.user).where(eq(schema.user.id, ADMIN_ID)),
    ).toEqual([]);
  });
});

describe("revokeSessions", () => {
  test("ends every session of the target Account", async ({ database }) => {
    const targetId = await targetWithSessions(database);

    const outcome = await runAdminAction(database.db, actor, "revokeSessions", { email: TARGET });

    expect(outcome).toMatchObject({ ok: true, result: { revoked: 2 } });
    expect(
      await database.db.select().from(schema.session).where(eq(schema.session.userId, targetId)),
    ).toEqual([]);
  });

  /**
   * The address is `citext` (DD2), so one person cannot hold two Accounts by
   * capitalising — and an Admin typing the address off a Report should not have to
   * match its case either.
   */
  test("finds the Account whatever the address's case", async ({ database }) => {
    await targetWithSessions(database);

    const outcome = await runAdminAction(database.db, actor, "revokeSessions", {
      email: "Ana@Recomencemos.Test",
    });

    expect(outcome).toMatchObject({ ok: true, result: { revoked: 2 } });
  });

  /**
   * **The refusal names no address**, because `context` reaches the log line and
   * an address is `personal` (NFR18). What the Admin reads is the address they
   * just typed, which they already had.
   */
  test("refuses an address with no Account, and says nothing about it", async ({ database }) => {
    const outcome = await runAdminAction(database.db, actor, "revokeSessions", {
      email: "nobody@recomencemos.test",
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;

    expect(outcome.error).toBeInstanceOf(AppError);
    expect(outcome.error.status).toBe(404);
    expect(JSON.stringify(outcome.error.context)).not.toContain("nobody@");
    expect(outcome.error.userMessage).not.toContain("nobody@");
  });

  /** An Account with no open sessions is a fine thing to ask about, and is audited. */
  test("is a no-op with a record on an Account holding no sessions", async ({ database }) => {
    const stack = signInStack(database);
    await signIn(stack, TARGET);
    await database.db.delete(schema.session);

    const outcome = await runAdminAction(database.db, actor, "revokeSessions", { email: TARGET });

    expect(outcome).toMatchObject({ ok: true, result: { revoked: 0 } });
    expect(await audit(database)).toHaveLength(1);
  });

  /** Nobody else's sessions move. */
  test("leaves other Accounts' sessions alone", async ({ database }) => {
    await targetWithSessions(database);
    const stack = signInStack(database);
    await signIn(stack, "otra@recomencemos.test");

    await runAdminAction(database.db, actor, "revokeSessions", { email: TARGET });

    const remaining = await database.db.select().from(schema.session);
    expect(remaining).toHaveLength(1);
  });
});

/**
 * The other side of the queue's one decision.
 *
 * **What is asserted here is mostly what does *not* move.** Refusal is a state
 * change and nothing else, and every way it could go wrong is a write that
 * belongs to delivery leaking into it — the fairness counter, the delivery
 * timestamp, the terms he wrote.
 */
describe("rejectOffer", () => {
  const offer = (database: TestDatabase) =>
    database.db.select().from(schema.offer).where(eq(schema.offer.id, OFFER_ID));

  test("stops the Offer and stamps no delivery", async ({ database }) => {
    await pendingOffer(database);

    const outcome = await runAdminAction(database.db, actor, "rejectOffer", { offerId: OFFER_ID });

    expect(outcome).toMatchObject({ ok: true, result: { offerId: OFFER_ID } });
    expect((await offer(database))[0]).toMatchObject({
      state: "rejected_by_admin",
      deliveredAt: null,
    });
  });

  /**
   * **NFR22's ordering input counts Offers that reached a Worker.** One stopped
   * here reached none, so moving her down the browsable list for it would charge
   * her for work she was never shown.
   */
  test("does not move the delivered-Offer count", async ({ database }) => {
    await pendingOffer(database);

    await runAdminAction(database.db, actor, "rejectOffer", { offerId: OFFER_ID });

    const [profile] = await database.db
      .select({ delivered: schema.capabilityProfile.deliveredOfferCount })
      .from(schema.capabilityProfile);

    expect(profile).toMatchObject({ delivered: 0 });
  });

  /**
   * **An Offer held because its sender was frozen is still work somebody owes an
   * answer on** (C22), so it is refusable from where it stands — the transition
   * table says so, and this is that reading exercised end to end rather than at
   * seam 1.
   */
  test("stops an Offer that was held rather than pending", async ({ database }) => {
    await pendingOffer(database);
    await database.db
      .update(schema.offer)
      .set({ state: "on_hold" })
      .where(eq(schema.offer.id, OFFER_ID));

    const outcome = await runAdminAction(database.db, actor, "rejectOffer", { offerId: OFFER_ID });

    expect(outcome.ok).toBe(true);
    expect((await offer(database))[0]).toMatchObject({ state: "rejected_by_admin" });
  });

  /** Two Admins on one queue: the second one meets a state, not a mystery. */
  test("refuses one the other Admin already delivered, and leaves it delivered", async ({
    database,
  }) => {
    await pendingOffer(database);
    await runAdminAction(database.db, actor, "deliverOffer", { offerId: OFFER_ID });

    const outcome = await runAdminAction(database.db, actor, "rejectOffer", { offerId: OFFER_ID });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;

    expect(outcome.error).toBeInstanceOf(AppError);
    expect(outcome.error.status).toBe(409);
    expect((await offer(database))[0]).toMatchObject({ state: "delivered" });
    // The delivery's row, and nothing for the attempt that did not happen.
    expect(await audit(database)).toHaveLength(1);
  });

  test("refuses an Offer id no row carries", async ({ database }) => {
    const outcome = await runAdminAction(database.db, actor, "rejectOffer", {
      offerId: "0199a1f0-2b3c-7def-8000-ffffffffffff",
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;

    expect(outcome.error.status).toBe(404);
    expect(await audit(database)).toEqual([]);
  });

  /**
   * **The row a _reclamo_ is reconstructed from a year later is the row the Admin
   * read.** Refusal moves a state; it never edits what he wrote, and the absence
   * of any function that could is what `#offers` asserts one file over.
   */
  test("leaves the terms exactly as he wrote them", async ({ database }) => {
    await pendingOffer(database);

    await runAdminAction(database.db, actor, "rejectOffer", { offerId: OFFER_ID });

    expect((await offer(database))[0]).toMatchObject({
      workDescription: "Cocinar almuerzos para ocho personas",
      payTerms: "$120.000 por el día",
      whenText: "Sábado desde las 7 de la mañana",
    });
  });
});

describe("the database refuses an action it has not met", () => {
  /**
   * The `CHECK` on `admin_action.action` is written from `ADMIN_ACTION_NAMES`, and
   * this is the engine's half of the completeness argument: the registry's
   * `satisfies` refuses a handler with no name at compile time, and the constraint
   * refuses a *name* the migration has not caught up with at apply time. Together
   * they leave one way for an action to exist.
   */
  test("rejects an AdminAction row naming an unregistered action", async ({ database }) => {
    let thrown: unknown;
    try {
      await database.db
        .insert(schema.adminAction)
        .values({ actorAccountId: ADMIN_ID, action: "deleteEverything", targetId: "x" });
    } catch (error) {
      thrown = error;
    }

    expect(thrown, "the constraint accepted an unregistered action").toBeDefined();
    /**
     * **Asserted on the `cause`, not on the message.** Drizzle's own error says
     * only "Failed query: insert into …", which would pass a
     * `rejects.toThrow(/…/)` against almost any regex and would still pass if the
     * insert failed for a completely unrelated reason. The engine's message —
     * carrying the constraint's name — is one level down, and naming it is the
     * difference between "the write failed" and "the write failed *because of
     * this constraint*".
     */
    expect(String((thrown as { cause?: unknown }).cause)).toContain("admin_action_action_known");
  });

  test("accepts every name the registry declares", async ({ database }) => {
    for (const action of ADMIN_ACTION_NAMES) {
      // Sequential: one statement per action, and the point is that each is
      // accepted rather than how fast they go in.
      // oxlint-disable-next-line no-await-in-loop
      await database.db
        .insert(schema.adminAction)
        .values({ actorAccountId: ADMIN_ID, action, targetId: "x" });
    }

    expect(await audit(database)).toHaveLength(ADMIN_ACTION_NAMES.length);
  });
});
