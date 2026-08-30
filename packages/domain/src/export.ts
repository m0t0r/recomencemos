/**
 * `@repo/domain/export` — NFR16's subject-access export: everything held about
 * one person, in one function.
 *
 * **It exists now because story 14 needs it to.** The consent record has to be
 * inside the export a *consulta* is answered from — a Consent row nobody can read
 * back is a proof of authorization that cannot be produced — and this module did
 * not exist. So it ships carrying what the schema actually holds today: the
 * Account, and its Consent rows. It grows by one entry per `personal` column that
 * lands, and story 13 is what makes it reachable by the person it is about.
 *
 * **Built field by field from a whitelist, and no `toJSON` anywhere near it**
 * ([ADR-0003](../../../docs/adr/0003-no-tojson-on-cross-boundary-types.md)). Both
 * halves are load-bearing: the absent serialisation hook stops a field being
 * published implicitly, and never handing a row whole to anything that
 * serialises is what stops the rest of it leaking. The mechanism is the same one
 * the three profile projections use, deliberately, so that a new `personal`
 * column omitted from here fails the same class of sentinel test — which is the
 * only thing that keeps an export honest as a schema grows.
 *
 * **Session and Verification are excluded, and that is a decision rather than an
 * omission.** Both are classified `secret` (C28): a session token and a
 * magic-link token are credentials, and handing a *titular* her own session token
 * is a credential disclosure, not habeas data. `export.test.ts` asserts their
 * absence, because an exclusion nobody tests is an exclusion the next person
 * deletes as an oversight.
 *
 * **The clocks are not here.** A *consulta* is answered within 10 business days
 * and a *reclamo* within 15, and neither is something a diff advances — Colombia
 * has around eighteen public holidays and `America/Bogota` is UTC−5, so the
 * calendar is real work and it lives in the go-live runbook (C53). This module is
 * the half a diff can satisfy.
 */

import { asc, eq } from "drizzle-orm";
import type { ConsentSide } from "#consent/registry";
import type { DomainDatabase } from "#database";
import * as schema from "#schema";

/**
 * One Consent row as it appears in the export.
 *
 * Every field is what a *reclamo* asks for: which side, which two documents, that
 * the international transmission was expressly authorized, and when. The row's
 * `id` is not here — it is a `BIGINT` primary key that reaches no URL and means
 * nothing to the person reading her own export.
 */
export interface ExportedConsent {
  readonly side: ConsentSide;
  readonly noticeVersion: string;
  readonly authorizationVersion: string;
  readonly transmissionAcknowledged: boolean;
  readonly consentedAt: Date;
}

/**
 * The Account's own `personal` columns.
 *
 * `isAdmin` is absent: the grant is `internal` rather than `personal`, and it is
 * a fact about the platform's staffing rather than about her. `image` is Google's
 * avatar URL, which is hers and is held here, so it crosses.
 */
export interface ExportedAccount {
  readonly email: string;
  readonly name: string;
  readonly emailVerified: boolean;
  readonly imageUrl: string | null;
  readonly registeredAt: Date;
}

/** Everything this platform holds about one person, as of today's schema. */
export interface SubjectAccessExport {
  readonly account: ExportedAccount;
  readonly consents: readonly ExportedConsent[];
}

/**
 * Build the subject-access export for one Account, or `null` where there is no
 * such Account.
 *
 * **`null` rather than a throw**, because "no Account with that address" is an
 * ordinary answer to a *consulta* and not a fault — somebody asking about an
 * address that never registered here is entitled to be told so plainly.
 *
 * The handle is the first parameter, which is `#database`'s rule and what lets
 * seam 2 exercise this against the committed migrations rather than a mock.
 */
export async function buildSubjectAccessExport(
  db: DomainDatabase,
  accountId: string,
): Promise<SubjectAccessExport | null> {
  const accounts = await db
    .select({
      email: schema.user.email,
      name: schema.user.name,
      emailVerified: schema.user.emailVerified,
      image: schema.user.image,
      createdAt: schema.user.createdAt,
    })
    .from(schema.user)
    .where(eq(schema.user.id, accountId))
    .limit(1);

  const row = accounts[0];
  if (!row) return null;

  const consents = await db
    .select({
      side: schema.consent.side,
      noticeVersion: schema.consent.noticeVersion,
      authorizationVersion: schema.consent.authorizationVersion,
      transmissionAcknowledged: schema.consent.transmissionAcknowledged,
      createdAt: schema.consent.createdAt,
    })
    .from(schema.consent)
    .where(eq(schema.consent.accountId, accountId))
    // Oldest first: an export read by a person is a history, and a history reads
    // forwards. It is also the order the index already holds them in.
    .orderBy(asc(schema.consent.createdAt));

  return {
    account: {
      email: row.email,
      name: row.name,
      emailVerified: row.emailVerified,
      imageUrl: row.image,
      registeredAt: row.createdAt,
    },
    // Field by field, and the `side` cast is the one place the database's `TEXT`
    // meets the registry's union. It is safe because `consent_side_known` refuses
    // anything else at write time — the `CHECK` is what makes the cast a reading
    // of a constraint rather than an assumption about the data.
    consents: consents.map((consent) => ({
      side: consent.side as ConsentSide,
      noticeVersion: consent.noticeVersion,
      authorizationVersion: consent.authorizationVersion,
      transmissionAcknowledged: consent.transmissionAcknowledged,
      consentedAt: consent.createdAt,
    })),
  };
}

/**
 * **The pooled binding: what a Server Action calls.** Same mechanism and same
 * reason as `ceilings`, `admin` and `consent` — see `./consent` for why the
 * dynamic import is not optional here.
 */
export const subjectAccess = {
  async build(accountId: string): Promise<SubjectAccessExport | null> {
    const { db } = await import("#connection");
    return buildSubjectAccessExport(db(), accountId);
  },
};
