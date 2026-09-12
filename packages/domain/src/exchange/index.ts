/**
 * `@repo/domain/exchange` — the Contact Exchange: what crosses when she accepts,
 * who may read it afterwards, and where each side's copy by email is.
 *
 * **The crossing is written here and nowhere else.** `acceptOffer` calls
 * {@link writeExchange} inside its own transaction, beneath the lock on the
 * Offer, so the state change and the snapshot commit together or not at all —
 * and nothing in this module sends anything. The spec's ordering is "the
 * transaction commits first, then enqueues both sends", and a send inside a
 * transaction is a send that can happen and then be rolled back. The enqueue is
 * the `pending` copy state the row is born with; the Server Action sends after
 * the commit and records each outcome through {@link recordCopy}.
 *
 * **Read by either party and by nobody else.** {@link listExchangesForParty}
 * scopes by her profile or by his Account in the one statement that reads the
 * row, and answers everyone else with an empty list — the same shape as a party
 * to no exchange at all, so the read cannot say that one exists.
 *
 * **Every function takes the handle first and the principal second**, the shape
 * `#database` fixes, and the `exchanges` object at the foot binds the pooled
 * connection for `apps/web`.
 */

import { desc, eq, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db as pooledDatabase } from "#connection";
import type { DomainDatabase, DomainTransaction } from "#database";
import { asCopyState, type CopyState, type ExchangeSide } from "#policy/exchange-states";
import { type ContactExchange, type ExchangedParty, toContactExchange } from "#projections";
import * as schema from "#schema";

/**
 * What the accept action needs in order to send the two copies, and nothing it
 * may put on a page.
 *
 * **Server-side only, and the addresses are why.** The action takes this
 * straight to the notification seam and returns a redirect; the page reads the
 * exchange back through {@link listExchangesForParty}, whose projection decides
 * what each party sees. Nothing here is shaped for a browser.
 */
export interface ExchangeDelivery {
  /** The exchange's key as text — the send's `entityId` and the log line's `exchange_id`. */
  readonly exchangeId: string;
  readonly offerId: string;
  readonly worker: { readonly accountId: string; readonly contact: ExchangedParty };
  readonly hirer: { readonly accountId: string; readonly contact: ExchangedParty };
}

const workerAccount = alias(schema.user, "worker_account");
const hirerAccount = alias(schema.user, "hirer_account");

/**
 * Write the exchange for one Offer, inside the caller's transaction.
 *
 * **One read of both parties, then the insert**, both beneath the lock
 * `acceptOffer` already holds on the Offer row. Her name and number come from
 * her profile, her address from her Account; his three from his Account. What
 * is written is exactly what is returned, so the copies carry the same details
 * the pages will show.
 *
 * `UNIQUE (offer_id)` is the backstop behind the lock: a second exchange for
 * one Offer is a constraint violation rather than a second disclosure.
 */
export async function writeExchange(
  tx: DomainTransaction,
  offerId: string,
): Promise<ExchangeDelivery> {
  const [parties] = await tx
    .select({
      workerAccountId: schema.capabilityProfile.accountId,
      workerFullName: schema.capabilityProfile.fullName,
      workerPhone: schema.capabilityProfile.phone,
      workerEmail: workerAccount.email,
      hirerAccountId: schema.offer.hirerAccountId,
      hirerName: hirerAccount.hirerName,
      hirerPhone: hirerAccount.hirerPhone,
      hirerEmail: hirerAccount.email,
    })
    .from(schema.offer)
    .innerJoin(
      schema.capabilityProfile,
      eq(schema.capabilityProfile.id, schema.offer.capabilityProfileId),
    )
    .innerJoin(workerAccount, eq(workerAccount.id, schema.capabilityProfile.accountId))
    .innerJoin(hirerAccount, eq(hirerAccount.id, schema.offer.hirerAccountId))
    .where(eq(schema.offer.id, offerId))
    .limit(1);

  if (!parties) {
    // Unreachable: the caller found this Offer, through this join, beneath its
    // lock, one statement ago. Thrown so the transaction rolls back whole.
    throw new Error(
      "An accepted Offer has no profile or no sender Account behind it, so there is " +
        "nothing to exchange. The accept transaction is rolled back.",
    );
  }

  const worker: ExchangedParty = {
    fullName: parties.workerFullName,
    phone: parties.workerPhone,
    email: parties.workerEmail,
  };
  const hirer: ExchangedParty = {
    fullName: parties.hirerName,
    phone: parties.hirerPhone,
    email: parties.hirerEmail,
  };

  const [written] = await tx
    .insert(schema.contactExchange)
    .values({
      offerId,
      workerFullName: parties.workerFullName,
      workerPhone: parties.workerPhone,
      workerEmail: parties.workerEmail,
      hirerName: parties.hirerName,
      hirerPhone: parties.hirerPhone,
      hirerEmail: parties.hirerEmail,
    })
    .returning({ id: schema.contactExchange.id });

  if (!written) throw new Error("The exchange insert returned no row.");

  return {
    exchangeId: String(written.id),
    offerId,
    worker: { accountId: parties.workerAccountId, contact: worker },
    hirer: { accountId: parties.hirerAccountId, contact: hirer },
  };
}

/**
 * The column's `TEXT`, narrowed. `contact_exchange_*_copy_known` makes an unknown
 * value unreachable through the schema, so this throws rather than guessing: a
 * page telling her a copy was sent when it was not would be the one lie this
 * surface exists to avoid.
 */
function copyStateOf(value: string): CopyState {
  const state = asCopyState(value);

  if (!state) {
    throw new TypeError(
      `A Contact Exchange carries the copy state "${value}", which is not one this product ` +
        "has. The table's CHECK constraints should make that unreachable.",
    );
  }

  return state;
}

/**
 * Every exchange this Account is a party to, newest first — as a Worker, as a
 * Hirer, or both.
 *
 * **Which side the reader is on is decided by which key matched**, in the same
 * row the details come from, so no caller can ask for the other side's view.
 * A reader who is party to none gets an empty list, and so does everybody who
 * is not a party to a given exchange.
 */
export async function listExchangesForParty(
  db: DomainDatabase,
  accountId: string,
): Promise<readonly ContactExchange[]> {
  const rows = await db
    .select({
      offerId: schema.contactExchange.offerId,
      exchangedAt: schema.contactExchange.createdAt,
      workerAccountId: schema.capabilityProfile.accountId,
      workerFullName: schema.contactExchange.workerFullName,
      workerPhone: schema.contactExchange.workerPhone,
      workerEmail: schema.contactExchange.workerEmail,
      hirerName: schema.contactExchange.hirerName,
      hirerPhone: schema.contactExchange.hirerPhone,
      hirerEmail: schema.contactExchange.hirerEmail,
      workerCopy: schema.contactExchange.workerCopy,
      hirerCopy: schema.contactExchange.hirerCopy,
    })
    .from(schema.contactExchange)
    .innerJoin(schema.offer, eq(schema.offer.id, schema.contactExchange.offerId))
    .innerJoin(
      schema.capabilityProfile,
      eq(schema.capabilityProfile.id, schema.offer.capabilityProfileId),
    )
    .where(
      or(
        eq(schema.capabilityProfile.accountId, accountId),
        eq(schema.offer.hirerAccountId, accountId),
      ),
    )
    .orderBy(desc(schema.contactExchange.createdAt));

  return rows.map((row) =>
    toContactExchange(
      {
        offerId: row.offerId,
        exchangedAt: row.exchangedAt,
        worker: { fullName: row.workerFullName, phone: row.workerPhone, email: row.workerEmail },
        hirer: { fullName: row.hirerName, phone: row.hirerPhone, email: row.hirerEmail },
        workerCopy: copyStateOf(row.workerCopy),
        hirerCopy: copyStateOf(row.hirerCopy),
      },
      row.workerAccountId === accountId ? "worker" : "hirer",
    ),
  );
}

/**
 * Record where one side's copy went, after the send has answered.
 *
 * **Outside the exchange's transaction, and that is the point**: it runs after
 * the commit and after the send, so nothing about a failed copy can reach back
 * into what crossed. It writes one column and reads nothing.
 */
export async function recordCopy(
  db: DomainDatabase,
  exchangeId: string,
  side: ExchangeSide,
  outcome: Exclude<CopyState, "pending">,
): Promise<void> {
  await db
    .update(schema.contactExchange)
    .set(side === "worker" ? { workerCopy: outcome } : { hirerCopy: outcome })
    .where(eq(schema.contactExchange.id, BigInt(exchangeId)));
}

/**
 * **The pooled binding: what a Server Component or a Server Action calls.**
 *
 * Writing an exchange has no entry here. It happens inside `acceptOffer`'s
 * transaction or not at all, so a binding would be a second way to cross
 * somebody's details — the unlocked way.
 */
export const exchanges = {
  async listForParty(accountId: string): Promise<readonly ContactExchange[]> {
    return listExchangesForParty(pooledDatabase(), accountId);
  },

  async recordCopy(
    exchangeId: string,
    side: ExchangeSide,
    outcome: Exclude<CopyState, "pending">,
  ): Promise<void> {
    return recordCopy(pooledDatabase(), exchangeId, side, outcome);
  },
};

export type { ContactExchange, ExchangedParty } from "#projections";
// `ExchangeDelivery` is declared above and exported where it is declared.
export type { CopyState, ExchangeSide } from "#policy/exchange-states";
