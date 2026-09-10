/**
 * Seam 2 over the Worker's half of the Offer aggregate — what she has received,
 * and the two answers she can give.
 *
 * **Ownership is the thing under test on every read.** An Offer has two owners
 * and each read scopes by whichever the caller is (Core entities, "Ownership
 * edges"), so every case that finds an Offer has a twin in which somebody else
 * asks for it — the Hirer who wrote it included, because he is the likeliest
 * person to hold its id.
 *
 * **What this seam can prove about DD9's double accept, stated precisely.**
 * PGlite is one connection, so two accepts cannot truly interleave here. What
 * is observable is the discipline that makes the interleaving harmless on two
 * connections — the Offer row is locked by the **first** statement of the
 * transaction and its state is read beneath that lock — and the backstop behind
 * it: `UNIQUE (offer_id)` refuses a second exchange whatever the code above it
 * does. Both are asserted, and so is the outcome of two accepts issued at once.
 *
 * Offers are written through `sendOffer`, the module that owns them. Moving one
 * to `delivered` is the Admin's act and is reached through `runAdminAction` in
 * production; here the fixture writes the state directly, which is the same
 * reach for the handle `offers.integration.test.ts` makes when it backdates an
 * arrival — the aggregate's promise is about the functions it publishes, and
 * the case at the foot of that file counts them.
 */

import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { CURRENT_CONSENT_VERSIONS } from "#consent/index";
import {
  acceptOffer,
  declineOffer,
  findReceivedOfferSender,
  findReceivedOfferTerms,
  listReceivedOffers,
  sendOffer,
} from "#offers";
import type { OfferState } from "#policy/offer-states";
import { publishProfile } from "#profiles";
import * as schema from "#schema";
import { signedInAccountId } from "#testing/auth-stack";
import { test } from "#testing/fixtures";
import type { TestDatabase } from "#testing/fixtures";

/** Distinct values for everything NFR11 holds back until she accepts. */
const WORKER = {
  email: "ana.sentinel@recomencemos.test",
  fullName: "Ana María Restrepo Gómez",
  phoneDigits: "3001234567",
} as const;

const HIRER = {
  email: "carlos.sentinel@recomencemos.test",
  name: "Carlos Restrepo",
  phoneDigits: "3105558899",
} as const;

const TERMS = {
  workDescription: "Necesito que cocines almuerzos para ocho personas el sábado",
  payTerms: "$120.000 por el día, pagados el mismo sábado",
  whenText: "Sábado 12 de septiembre, desde las 7 de la mañana",
} as const;

/** A published Worker, through the module that owns publishing. */
async function aWorker(database: TestDatabase, email: string = WORKER.email) {
  const accountId = await signedInAccountId(database, email);

  const published = await publishProfile(database.db, accountId, {
    fullName: WORKER.fullName,
    firstName: "Ana María",
    lastInitial: "R",
    city: "pereira",
    headline: "Cocino almuerzos y comida casera para eventos pequeños",
    about: "Catorce años cocinando para familias y oficinas.",
    phone: `+57${WORKER.phoneDigits}`,
    skillSlugs: ["home-cooking"],
    workHistory: ["Cocina de un restaurante en el centro de Pereira"],
    consentVersions: CURRENT_CONSENT_VERSIONS,
  });

  if (!published.ok) throw new Error("the fixture profile did not publish");

  return { accountId, slug: published.slug };
}

async function aHirer(database: TestDatabase, email: string = HIRER.email) {
  return signedInAccountId(database, email);
}

/** One Offer from `hirer` to `slug`, left in `state` — its id. */
async function anOfferIn(
  database: TestDatabase,
  hirer: string,
  slug: string,
  state: OfferState = "delivered",
  workDescription: string = TERMS.workDescription,
): Promise<string> {
  const sent = await sendOffer(database.db, hirer, {
    ...TERMS,
    workDescription,
    profileSlug: slug,
    identity: { hirerName: HIRER.name, hirerPhone: HIRER.phoneDigits },
    consentVersions: CURRENT_CONSENT_VERSIONS,
  });

  if (!sent.ok) throw new Error(`the fixture Offer did not send: ${sent.reason}`);

  if (state !== "pending_review") {
    await database.db
      .update(schema.offer)
      .set({
        state,
        deliveredAt: state === "on_hold" || state === "rejected_by_admin" ? null : new Date(),
      })
      .where(eq(schema.offer.id, sent.offerId));
  }

  return sent.offerId;
}

async function stateOf(database: TestDatabase, offerId: string): Promise<string | undefined> {
  const [row] = await database.db
    .select({ state: schema.offer.state })
    .from(schema.offer)
    .where(eq(schema.offer.id, offerId));

  return row?.state;
}

async function exchangesFor(database: TestDatabase, offerId: string): Promise<number> {
  const rows = await database.db
    .select({ id: schema.contactExchange.id })
    .from(schema.contactExchange)
    .where(eq(schema.contactExchange.offerId, offerId));

  return rows.length;
}

/** An id no row carries, shaped exactly like one that does. */
const NOBODYS_OFFER = "0199a1f0-2b3c-7def-8000-0123456789ab";

describe("the Offers she has received", () => {
  test("lists the Offers addressed to her own profile and nobody else's", async ({ database }) => {
    const ana = await aWorker(database);
    const other = await aWorker(database, "otra@recomencemos.test");
    const hirer = await aHirer(database);

    const hers = await anOfferIn(database, hirer, ana.slug);
    await anOfferIn(database, hirer, other.slug);

    const received = await listReceivedOffers(database.db, ana.accountId);

    expect(received.map((offer) => offer.id)).toEqual([hers]);
  });

  /**
   * The three states before delivery never reached her, and a Reported one is
   * hidden from her. Each is written here so the list is asked about all of
   * them rather than about the one somebody remembered.
   */
  test("lists only what a person has let through to her", async ({ database }) => {
    const ana = await aWorker(database);
    const hirer = await aHirer(database);

    const reachedHer: string[] = [];
    for (const state of ["delivered", "accepted", "declined", "expired"] as const) {
      // oxlint-disable-next-line no-await-in-loop -- one Hirer, one row lock at a time.
      reachedHer.push(await anOfferIn(database, hirer, ana.slug, state));
    }
    for (const state of ["pending_review", "on_hold", "rejected_by_admin", "reported"] as const) {
      // oxlint-disable-next-line no-await-in-loop -- same.
      await anOfferIn(database, hirer, ana.slug, state);
    }

    const received = await listReceivedOffers(database.db, ana.accountId);

    expect(received.map((offer) => offer.id).toSorted()).toEqual(reachedHer.toSorted());
  });

  test("puts the newest first", async ({ database }) => {
    const ana = await aWorker(database);
    const hirer = await aHirer(database);

    const older = await anOfferIn(database, hirer, ana.slug);
    const newer = await anOfferIn(database, hirer, ana.slug);

    await database.db
      .update(schema.offer)
      .set({ createdAt: new Date("2026-09-01T12:00:00Z") })
      .where(eq(schema.offer.id, older));

    const received = await listReceivedOffers(database.db, ana.accountId);

    expect(received.map((offer) => offer.id)).toEqual([newer, older]);
  });

  test("carries the name he gave, and the terms he wrote", async ({ database }) => {
    const ana = await aWorker(database);
    const hirer = await aHirer(database);
    await anOfferIn(database, hirer, ana.slug);

    const [received] = await listReceivedOffers(database.db, ana.accountId);

    expect(received).toMatchObject({ ...TERMS, hirerName: HIRER.name, state: "delivered" });
  });

  test("is empty for an Account that holds no profile", async ({ database }) => {
    const hirer = await aHirer(database);

    expect(await listReceivedOffers(database.db, hirer)).toEqual([]);
  });
});

describe("one Offer she has received", () => {
  test("opens for the person it is addressed to", async ({ database }) => {
    const ana = await aWorker(database);
    const hirer = await aHirer(database);
    const offerId = await anOfferIn(database, hirer, ana.slug);

    expect(await findReceivedOfferTerms(database.db, ana.accountId, offerId)).toMatchObject({
      id: offerId,
      ...TERMS,
    });
    expect(await findReceivedOfferSender(database.db, ana.accountId, offerId)).toEqual({
      hirerName: HIRER.name,
    });
  });

  /**
   * **The Hirer who wrote it is the case that matters most**: he holds the id,
   * and the Worker's view of his Offer is not his to open. Every other caller
   * gets the same answer as an id no row carries, so the read cannot be used to
   * learn whether an Offer exists.
   */
  test("does not open for anybody else, the Hirer who wrote it included", async ({ database }) => {
    const ana = await aWorker(database);
    const other = await aWorker(database, "otra@recomencemos.test");
    const hirer = await aHirer(database);
    const offerId = await anOfferIn(database, hirer, ana.slug);

    for (const caller of [hirer, other.accountId]) {
      // oxlint-disable-next-line no-await-in-loop -- two callers, same question.
      expect(await findReceivedOfferTerms(database.db, caller, offerId)).toBeUndefined();
      // oxlint-disable-next-line no-await-in-loop
      expect(await findReceivedOfferSender(database.db, caller, offerId)).toBeUndefined();
    }
  });

  test("does not open before a person has let it through", async ({ database }) => {
    const ana = await aWorker(database);
    const hirer = await aHirer(database);
    const offerId = await anOfferIn(database, hirer, ana.slug, "pending_review");

    expect(await findReceivedOfferTerms(database.db, ana.accountId, offerId)).toBeUndefined();
  });

  /**
   * **A malformed id is answered, not thrown.** The column is a `uuid`, so
   * handing Postgres `"42"` raises a cast error — an `AppError`-shaped Sentry
   * event per request, and `/offers/1..N` is the cheapest request on the
   * internet to generate (C51).
   */
  // `test.for` rather than `test.each`: only the former hands the case the
  // fixture context, so `database` would otherwise never arrive.
  test.for(["42", "not-an-id", "", "0199a1f0-2b3c-7def-8000-0123456789ab'--"])(
    "answers %j as an Offer that is not there",
    async (malformed, { database }) => {
      const ana = await aWorker(database);

      expect(await findReceivedOfferTerms(database.db, ana.accountId, malformed)).toBeUndefined();
      expect(await findReceivedOfferSender(database.db, ana.accountId, malformed)).toBeUndefined();
      expect(await acceptOffer(database.db, ana.accountId, malformed)).toEqual({
        ok: false,
        reason: "not_found",
      });
    },
  );

  /**
   * **NFR11, counted over what the reads actually return.** Her full name, her
   * phone and her address, and his phone and his address, all sit one join away
   * from these queries, and none of them may cross before she accepts. The
   * projection test counts the record it is handed; this counts what the
   * database handed back, which is the half a wider `select` would break.
   */
  test("returns none of the details that cross only at acceptance", async ({ database }) => {
    const ana = await aWorker(database);
    const hirer = await aHirer(database);
    const offerId = await anOfferIn(database, hirer, ana.slug);

    const everything = JSON.stringify([
      await listReceivedOffers(database.db, ana.accountId),
      await findReceivedOfferTerms(database.db, ana.accountId, offerId),
      await findReceivedOfferSender(database.db, ana.accountId, offerId),
    ]);

    for (const held of [
      WORKER.email,
      WORKER.fullName,
      WORKER.phoneDigits,
      HIRER.email,
      HIRER.phoneDigits,
    ]) {
      expect(everything, `${held} crossed before acceptance`).not.toContain(held);
    }
  });
});

describe("accepting an Offer", () => {
  test("moves a delivered Offer to accepted and writes one exchange", async ({ database }) => {
    const ana = await aWorker(database);
    const hirer = await aHirer(database);
    const offerId = await anOfferIn(database, hirer, ana.slug);

    expect(await acceptOffer(database.db, ana.accountId, offerId)).toEqual({ ok: true });
    expect(await stateOf(database, offerId)).toBe("accepted");
    expect(await exchangesFor(database, offerId)).toBe(1);
  });

  test("refuses anybody but the addressee, and changes nothing", async ({ database }) => {
    const ana = await aWorker(database);
    const hirer = await aHirer(database);
    const offerId = await anOfferIn(database, hirer, ana.slug);

    expect(await acceptOffer(database.db, hirer, offerId)).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(await acceptOffer(database.db, ana.accountId, NOBODYS_OFFER)).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(await stateOf(database, offerId)).toBe("delivered");
    expect(await exchangesFor(database, offerId)).toBe(0);
  });

  /** It never reached her, so it is not there — the same answer the page gives. */
  test("answers an Offer nobody has let through as one that is not there", async ({ database }) => {
    const ana = await aWorker(database);
    const hirer = await aHirer(database);
    const offerId = await anOfferIn(database, hirer, ana.slug, "pending_review");

    expect(await acceptOffer(database.db, ana.accountId, offerId)).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(await stateOf(database, offerId)).toBe("pending_review");
  });

  test.for(["accepted", "declined", "expired"] as const)(
    "refuses an Offer she has already seen end in %s, and writes nothing",
    async (state, { database }) => {
      const ana = await aWorker(database);
      const hirer = await aHirer(database);
      const offerId = await anOfferIn(database, hirer, ana.slug, state);

      expect(await acceptOffer(database.db, ana.accountId, offerId)).toEqual({
        ok: false,
        reason: "already_answered",
        state,
      });
      expect(await stateOf(database, offerId)).toBe(state);
      expect(await exchangesFor(database, offerId)).toBe(0);
    },
  );

  /**
   * Two accepts issued at once — a double tap, or two tabs. PGlite runs them one
   * after the other, so this is the outcome rather than the race; the two cases
   * below are what make the outcome hold on two connections.
   */
  test("produces one exchange when accepted twice at once", async ({ database }) => {
    const ana = await aWorker(database);
    const hirer = await aHirer(database);
    const offerId = await anOfferIn(database, hirer, ana.slug);

    const outcomes = await Promise.all([
      acceptOffer(database.db, ana.accountId, offerId),
      acceptOffer(database.db, ana.accountId, offerId),
    ]);

    expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1);
    expect(outcomes).toContainEqual({ ok: false, reason: "already_answered", state: "accepted" });
    expect(await exchangesFor(database, offerId)).toBe(1);
  });

  /**
   * **The backstop, asserted without the code in front of it.** Whatever a
   * later change does to the lock, the engine refuses a second exchange for one
   * Offer — a constraint violation rather than a second set of contact details.
   */
  test("cannot hold two exchanges for one Offer", async ({ database }) => {
    const ana = await aWorker(database);
    const hirer = await aHirer(database);
    const offerId = await anOfferIn(database, hirer, ana.slug);

    await database.db.insert(schema.contactExchange).values({ offerId });

    await expect(database.db.insert(schema.contactExchange).values({ offerId })).rejects.toThrow();
  });

  /**
   * **DD9's third race — accept against a Report — read off the statement log.**
   * The requirement is that the state is read *beneath* the lock rather than
   * before it, because a lock taken after the read protects a value that is
   * already stale. So the first statement inside the transaction has to be the
   * `FOR UPDATE` on the Offer, carrying the state and the ownership scope, and
   * the write has to come after it.
   */
  test("locks the Offer with the first statement, and reads its state beneath the lock", async ({
    database,
  }) => {
    const ana = await aWorker(database);
    const hirer = await aHirer(database);
    const offerId = await anOfferIn(database, hirer, ana.slug);

    const statements: string[] = [];
    const watched = drizzle(database.client, {
      schema,
      logger: { logQuery: (query) => statements.push(query) },
    });

    expect(await acceptOffer(watched, ana.accountId, offerId)).toEqual({ ok: true });

    const inside = statements.slice(statements.findIndex((query) => /^begin/i.test(query)) + 1);
    const [first] = inside;

    expect(first, "acceptOffer's first statement is not a row lock").toMatch(/for update/i);
    expect(first).toMatch(/of\s+"offer"/i);
    expect(first).toMatch(/"offer"\."state"/i);
    expect(first).toMatch(/"capability_profile"\."account_id"/i);

    const writeAt = inside.findIndex((query) => /^update\s+"offer"/i.test(query));
    expect(writeAt, "acceptOffer never wrote the state").toBeGreaterThan(0);
  });
});

describe("declining an Offer", () => {
  /**
   * **Declined stays confirmed rather than vanishing** — the spec's words for
   * the success state. A decision she made is one she can come back and read.
   */
  test("moves a delivered Offer to declined, and keeps it in her list", async ({ database }) => {
    const ana = await aWorker(database);
    const hirer = await aHirer(database);
    const offerId = await anOfferIn(database, hirer, ana.slug);

    expect(await declineOffer(database.db, ana.accountId, offerId)).toEqual({ ok: true });

    const [received] = await listReceivedOffers(database.db, ana.accountId);
    expect(received).toMatchObject({ id: offerId, state: "declined" });
    expect(await exchangesFor(database, offerId)).toBe(0);
  });

  test("refuses anybody but the addressee", async ({ database }) => {
    const ana = await aWorker(database);
    const hirer = await aHirer(database);
    const offerId = await anOfferIn(database, hirer, ana.slug);

    expect(await declineOffer(database.db, hirer, offerId)).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(await stateOf(database, offerId)).toBe("delivered");
  });

  test("refuses an Offer she has already accepted", async ({ database }) => {
    const ana = await aWorker(database);
    const hirer = await aHirer(database);
    const offerId = await anOfferIn(database, hirer, ana.slug);

    await acceptOffer(database.db, ana.accountId, offerId);

    expect(await declineOffer(database.db, ana.accountId, offerId)).toEqual({
      ok: false,
      reason: "already_answered",
      state: "accepted",
    });
    expect(await stateOf(database, offerId)).toBe("accepted");
  });
});
