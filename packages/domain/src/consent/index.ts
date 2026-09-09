/**
 * `@repo/domain/consent` — the record half of "no data without an
 * *autorización*", and the mechanism that makes "in the same transaction" a
 * property of the type rather than a rule a caller remembers.
 *
 * **The criterion is that there is no state where data exists without its
 * consent row.** That is a claim about a transaction boundary, and the only two
 * places it can be enforced are the database and the signature. The database
 * cannot do it — a `CHECK` cannot see another table's row, and a deferred
 * constraint would still need something to have written the row. So it is the
 * signature: {@link recordConsent} takes a `DomainTransaction`, and there is
 * deliberately no overload taking a plain connection.
 *
 * A caller who has only a connection cannot reach this function at all; a caller
 * inside `db.transaction(...)` has the handle in hand. `publishProfile` (story 2)
 * and `sendOffer` (story 6) each open one transaction, write their own rows and
 * call this inside it, and there is no arrangement of those calls that commits
 * the collection without the authorization.
 *
 * **What it deliberately does not do is decide when consent is required.** That
 * lives with the transaction that collects — this module answers "record it",
 * "was it given", and "is the version she is submitting the one she was shown".
 */

import { AppError } from "@repo/errors/app-error";
import { and, eq } from "drizzle-orm";
import {
  type ConsentSide,
  type ConsentVersions,
  CURRENT_CONSENT_VERSIONS,
  versionsAreCurrent,
} from "#consent/registry";
import { db as pooledDatabase } from "#connection";
import type { DomainDatabase, DomainTransaction } from "#database";
import * as schema from "#schema";
import { CONSENT_VERSION_STALE } from "#user-messages";

export {
  CONSENT_AUTHORIZATION_VERSIONS,
  CONSENT_NOTICE_VERSIONS,
  CONSENT_SIDES,
  CURRENT_AUTHORIZATION_VERSION,
  CURRENT_CONSENT_VERSIONS,
  CURRENT_NOTICE_VERSION,
  versionsAreCurrent,
} from "#consent/registry";
export type { ConsentSide, ConsentVersions } from "#consent/registry";

/** What a caller passes: who, which side, and which text she was shown. */
export interface ConsentToRecord {
  readonly accountId: string;
  readonly side: ConsentSide;
  readonly versions: ConsentVersions;
}

/**
 * Write the Consent row for one side, inside the transaction that collects the
 * data it authorizes.
 *
 * **The version is checked before the insert, and a stale one throws.** She
 * opened the form, read the *autorización*, and left the tab open while the text
 * was edited and deployed. Recording the current version against a consent given
 * to the old text produces a row that looks perfectly ordinary and is false, and
 * false in exactly the direction a *reclamo* would expose. Thrown rather than
 * returned because it is genuinely unexpected — the text changes rarely and the
 * window is minutes wide — and because throwing inside the caller's transaction
 * is what rolls the collection back with it.
 *
 * **The transmission acknowledgement is written here rather than taken as a
 * parameter.** There is no *autorización* in this product that does not carry it
 * (C15: every processor is outside Colombia), so a parameter would only ever
 * offer a caller the chance to write a row that misrepresents what was
 * authorized. The column and its `CHECK` are the evidence; this line is where the
 * evidence comes from.
 */
export async function recordConsent(
  tx: DomainTransaction,
  { accountId, side, versions }: ConsentToRecord,
): Promise<void> {
  if (!versionsAreCurrent(versions)) {
    throw new AppError({
      code: "consent_version_stale",
      status: 409,
      message:
        "The consent versions submitted are not the ones currently in force, so the row " +
        "would have recorded an authorization to text this person never read. The " +
        "transaction that collects her data rolls back with this.",
      userMessage: CONSENT_VERSION_STALE,
      // Versions and an enum value. Nothing here is personal.
      context: {
        side,
        submitted_notice_version: versions.notice,
        submitted_authorization_version: versions.authorization,
        current_notice_version: CURRENT_CONSENT_VERSIONS.notice,
        current_authorization_version: CURRENT_CONSENT_VERSIONS.authorization,
      },
    });
  }

  await tx.insert(schema.consent).values({
    accountId,
    side,
    noticeVersion: versions.notice,
    authorizationVersion: versions.authorization,
    transmissionAcknowledged: true,
  });
}

/**
 * Whether this Account has already consented on this side.
 *
 * **What `sendOffer` needs in order to know an Offer is his first.** The Hirer's
 * *autorización* is taken once, before his first Offer takes a field, and the
 * question "is this the first" has to be answered from a row rather than from
 * anything a browser sends.
 *
 * Takes a plain handle rather than a transaction: this is a read, and a caller
 * deciding whether to *show* the consent step is outside any transaction at all.
 */
export async function hasConsented(
  db: DomainDatabase,
  accountId: string,
  side: ConsentSide,
): Promise<boolean> {
  const rows = await db
    .select({ id: schema.consent.id })
    .from(schema.consent)
    .where(and(eq(schema.consent.accountId, accountId), eq(schema.consent.side, side)))
    .limit(1);

  return rows.length > 0;
}

/**
 * **The pooled binding: what a Server Action calls.**
 *
 * ADR-0010 withholds `#connection`, so `apps/web` has no handle to pass and
 * reaches the database through this object or not at all.
 *
 * **Only the read is bound.** {@link recordConsent} has no entry here on purpose:
 * binding it to the pooled connection would hand `apps/web` a way to write a
 * Consent row on its own, outside the transaction of the collection it
 * authorizes, which is the one thing this module's shape exists to prevent.
 */
export const consent = {
  async hasConsented(accountId: string, side: ConsentSide): Promise<boolean> {
    return hasConsented(pooledDatabase(), accountId, side);
  },
};
