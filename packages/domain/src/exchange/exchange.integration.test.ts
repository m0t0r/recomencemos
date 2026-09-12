/**
 * Seam 2 over the Contact Exchange — what crosses when she accepts, who may read
 * it afterwards, and what a failed copy does to it.
 *
 * **The snapshot is the thing under test.** The spec has the exchange row hold
 * both sides' name, phone and email *as they stood at acceptance*, so a later
 * edit or deletion does not rewrite history two people are already acting on.
 * So every case reads the row back through the module that publishes it rather
 * than trusting what `acceptOffer` returned.
 *
 * **"Commits first, then sends" is the other half**, and this seam can hold the
 * part of it that is a property of the data: the exchange exists, complete,
 * before anything records whether a copy went out — and recording that a copy
 * failed changes nothing about what crossed.
 */

import { eq } from "drizzle-orm";
import { listExchangesForParty, recordCopy } from "#exchange";
import { acceptOffer, declineOffer } from "#offers";
import * as schema from "#schema";
import { test } from "#testing/fixtures";
import type { TestDatabase } from "#testing/fixtures";
import { aHirer, anOfferIn, aWorker, HIRER, WORKER } from "#testing/parties";

/** Her number and his, as each module stored it, rather than a format guessed here. */
async function storedPhones(database: TestDatabase, workerAccountId: string, hirer: string) {
  const [profile] = await database.db
    .select({ phone: schema.capabilityProfile.phone })
    .from(schema.capabilityProfile)
    .where(eq(schema.capabilityProfile.accountId, workerAccountId));
  const [account] = await database.db
    .select({ phone: schema.user.hirerPhone })
    .from(schema.user)
    .where(eq(schema.user.id, hirer));

  return { worker: profile?.phone, hirer: account?.phone };
}

/** A delivered Offer from a Hirer to a Worker, accepted — and the three ids. */
async function anAcceptedOffer(database: TestDatabase) {
  const ana = await aWorker(database);
  const hirer = await aHirer(database);
  const offerId = await anOfferIn(database, hirer, ana.slug);

  const accepted = await acceptOffer(database.db, ana.accountId, offerId);
  if (!accepted.ok) throw new Error(`the fixture Offer was not accepted: ${accepted.reason}`);

  return { ana, hirer, offerId, exchangeId: accepted.exchange.exchangeId };
}

describe("accepting an Offer", () => {
  test("hands back what the two copies need, and nothing is sent from inside it", async ({
    database,
  }) => {
    const ana = await aWorker(database);
    const hirer = await aHirer(database);
    const offerId = await anOfferIn(database, hirer, ana.slug);
    const phones = await storedPhones(database, ana.accountId, hirer);

    const accepted = await acceptOffer(database.db, ana.accountId, offerId);

    expect(accepted).toEqual({
      ok: true,
      exchange: {
        exchangeId: expect.stringMatching(/^\d+$/),
        offerId,
        worker: {
          accountId: ana.accountId,
          contact: { fullName: WORKER.fullName, phone: phones.worker, email: WORKER.email },
        },
        hirer: {
          accountId: hirer,
          contact: { fullName: HIRER.name, phone: phones.hirer, email: HIRER.email },
        },
      },
    });
  });

  test("writes no exchange when she declines", async ({ database }) => {
    const ana = await aWorker(database);
    const hirer = await aHirer(database);
    const offerId = await anOfferIn(database, hirer, ana.slug);

    await declineOffer(database.db, ana.accountId, offerId);

    expect(await listExchangesForParty(database.db, ana.accountId)).toEqual([]);
    expect(await listExchangesForParty(database.db, hirer)).toEqual([]);
  });
});

describe("what each party reads afterwards", () => {
  test("she reads his details as hers crossed, and her own as she gave them", async ({
    database,
  }) => {
    const { ana, hirer, offerId } = await anAcceptedOffer(database);
    const phones = await storedPhones(database, ana.accountId, hirer);

    expect(await listExchangesForParty(database.db, ana.accountId)).toEqual([
      {
        offerId,
        exchangedAt: expect.any(Date),
        side: "worker",
        counterpart: { fullName: HIRER.name, phone: phones.hirer, email: HIRER.email },
        own: { fullName: WORKER.fullName, phone: phones.worker, email: WORKER.email },
        copy: "pending",
      },
    ]);
  });

  test("he reads hers, and his own as he gave them", async ({ database }) => {
    const { ana, hirer, offerId } = await anAcceptedOffer(database);
    const phones = await storedPhones(database, ana.accountId, hirer);

    expect(await listExchangesForParty(database.db, hirer)).toEqual([
      {
        offerId,
        exchangedAt: expect.any(Date),
        side: "hirer",
        counterpart: { fullName: WORKER.fullName, phone: phones.worker, email: WORKER.email },
        own: { fullName: HIRER.name, phone: phones.hirer, email: HIRER.email },
        copy: "pending",
      },
    ]);
  });

  /**
   * **Nobody else is a party**, and they are answered exactly as a party to no
   * exchange is — an empty list, never a refusal that says one exists.
   */
  test("nobody else reads it", async ({ database }) => {
    await anAcceptedOffer(database);
    const otherWorker = await aWorker(database, "otra@recomencemos.test");
    const otherHirer = await aHirer(database, "otro@recomencemos.test");

    expect(await listExchangesForParty(database.db, otherWorker.accountId)).toEqual([]);
    expect(await listExchangesForParty(database.db, otherHirer)).toEqual([]);
  });

  test("nothing crosses before she accepts", async ({ database }) => {
    const ana = await aWorker(database);
    const hirer = await aHirer(database);
    await anOfferIn(database, hirer, ana.slug);

    expect(await listExchangesForParty(database.db, ana.accountId)).toEqual([]);
    expect(await listExchangesForParty(database.db, hirer)).toEqual([]);
  });

  /**
   * **The snapshot is history, not a live join.** She corrects her number after
   * accepting; he already has the one she gave, and the page must not pretend
   * otherwise by showing him a number he was never sent.
   */
  test("a later edit does not rewrite what crossed", async ({ database }) => {
    const { ana, hirer } = await anAcceptedOffer(database);
    const phones = await storedPhones(database, ana.accountId, hirer);

    await database.db
      .update(schema.capabilityProfile)
      .set({ phone: "+573009998877", fullName: "Otro Nombre" })
      .where(eq(schema.capabilityProfile.accountId, ana.accountId));
    await database.db
      .update(schema.user)
      .set({ hirerPhone: "+573118887766" })
      .where(eq(schema.user.id, hirer));

    const [his] = await listExchangesForParty(database.db, hirer);
    const [hers] = await listExchangesForParty(database.db, ana.accountId);

    expect(his?.counterpart).toMatchObject({ fullName: WORKER.fullName, phone: phones.worker });
    expect(hers?.counterpart).toMatchObject({ phone: phones.hirer });
  });
});

describe("the copy by email", () => {
  /**
   * The ticket's own sentence: a send failure after commit leaves the exchange
   * intact. What changes is one side's copy line, and only that side's.
   */
  test("a failed copy leaves the exchange intact, and is told only to its side", async ({
    database,
  }) => {
    const { ana, hirer, offerId, exchangeId } = await anAcceptedOffer(database);

    await recordCopy(database.db, exchangeId, "worker", "failed");

    const [hers] = await listExchangesForParty(database.db, ana.accountId);
    const [his] = await listExchangesForParty(database.db, hirer);

    expect(hers).toMatchObject({ offerId, copy: "failed", own: { email: WORKER.email } });
    expect(his).toMatchObject({ offerId, copy: "pending", counterpart: { email: WORKER.email } });
  });

  test("a sent copy is recorded against its own side", async ({ database }) => {
    const { ana, hirer, exchangeId } = await anAcceptedOffer(database);

    await recordCopy(database.db, exchangeId, "hirer", "sent");

    expect((await listExchangesForParty(database.db, hirer))[0]?.copy).toBe("sent");
    expect((await listExchangesForParty(database.db, ana.accountId))[0]?.copy).toBe("pending");
  });

  /** The registry is the `CHECK`, so a state nobody listed is refused by the engine. */
  test("refuses a copy state nobody listed", async ({ database }) => {
    const { exchangeId } = await anAcceptedOffer(database);

    await expect(
      database.db
        .update(schema.contactExchange)
        .set({ workerCopy: "bounced" })
        .where(eq(schema.contactExchange.id, BigInt(exchangeId))),
    ).rejects.toThrow();
  });
});
