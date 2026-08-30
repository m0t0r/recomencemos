/**
 * Seam 2 over the Consent row: **there is no state where the data exists without
 * the consent that authorizes it.**
 *
 * That is a claim about a transaction, so it is asserted from both ends. The
 * commit case is easy and is the one a happy-path test would stop at. The two
 * that matter are the rollbacks — a transaction that aborts after the consent row
 * is written, and a consent refused on a stale version — because in both the
 * failure mode is a row surviving alone, and the surviving row is the one nobody
 * looks at again.
 *
 * **The collection is a write to `user.name` here**, standing in for the
 * CapabilityProfile insert story 2 will put in its place. It is not a mock: it is
 * a real `personal` column written in the same transaction, which is the only
 * property under test. When `publishProfile` lands it replaces this line and the
 * assertions are unchanged.
 */

import { AppError } from "@repo/errors/app-error";
import { eq } from "drizzle-orm";
import { CURRENT_CONSENT_VERSIONS, hasConsented, recordConsent } from "#consent/index";
import * as schema from "#schema";
import { signIn, signInStack } from "#testing/auth-stack";
import { test } from "#testing/fixtures";
import type { TestDatabase } from "#testing/fixtures";

const WORKER = "ana@recomencemos.test";

/**
 * A real Account, created through the door that creates Accounts.
 *
 * `## Testing Decisions` asks that a test needing a row create it through the
 * domain module that owns it, and the module that owns an Account is Better
 * Auth's magic-link door. A hand-inserted `user` row would drift from the schema
 * the first time a column is added.
 */
async function anAccount(database: TestDatabase, email = WORKER): Promise<string> {
  const stack = signInStack(database);
  await signIn(stack, email);

  const [account] = await database.db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, email));

  return (account as { id: string }).id;
}

const consentRows = (database: TestDatabase, accountId: string) =>
  database.db
    .select({
      side: schema.consent.side,
      noticeVersion: schema.consent.noticeVersion,
      authorizationVersion: schema.consent.authorizationVersion,
      transmissionAcknowledged: schema.consent.transmissionAcknowledged,
      createdAt: schema.consent.createdAt,
    })
    .from(schema.consent)
    .where(eq(schema.consent.accountId, accountId));

const nameOf = async (database: TestDatabase, accountId: string) => {
  const [row] = await database.db
    .select({ name: schema.user.name })
    .from(schema.user)
    .where(eq(schema.user.id, accountId));

  return (row as { name: string }).name;
};

describe("the collection and its authorization commit together", () => {
  test("writes the row beside the data it authorizes", async ({ database }) => {
    const accountId = await anAccount(database);

    await database.db.transaction(async (tx) => {
      await tx
        .update(schema.user)
        .set({ name: "Ana María Restrepo" })
        .where(eq(schema.user.id, accountId));

      await recordConsent(tx, {
        accountId,
        side: "worker",
        versions: CURRENT_CONSENT_VERSIONS,
      });
    });

    const rows = await consentRows(database, accountId);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      side: "worker",
      noticeVersion: CURRENT_CONSENT_VERSIONS.notice,
      authorizationVersion: CURRENT_CONSENT_VERSIONS.authorization,
      // C15: every processor is outside Colombia, so express transmission consent
      // is part of every authorization this product takes. The module writes it
      // rather than accepting it, so there is no call that records otherwise.
      transmissionAcknowledged: true,
    });

    // The "when" half of the criterion, and it is the row's own clock rather than
    // anything a caller passed.
    expect(rows[0]?.createdAt).toBeInstanceOf(Date);
    expect(await nameOf(database, accountId)).toBe("Ana María Restrepo");
  });
});

describe("the rollback, which is the half a happy path never reaches", () => {
  test("leaves neither row when the transaction aborts after the consent", async ({ database }) => {
    const accountId = await anAccount(database);
    const before = await nameOf(database, accountId);

    await expect(
      database.db.transaction(async (tx) => {
        await tx
          .update(schema.user)
          .set({ name: "Ana María Restrepo" })
          .where(eq(schema.user.id, accountId));

        await recordConsent(tx, {
          accountId,
          side: "worker",
          versions: CURRENT_CONSENT_VERSIONS,
        });

        // Whatever fails after the consent is written — a constraint, a lost
        // connection, the photo step. The point is that the consent row does not
        // survive on its own.
        throw new Error("the collection failed after its consent was recorded");
      }),
    ).rejects.toThrow("the collection failed after its consent was recorded");

    expect(await consentRows(database, accountId)).toHaveLength(0);
    expect(await nameOf(database, accountId)).toBe(before);
  });

  test("rolls the collection back when the consent is refused as stale", async ({ database }) => {
    const accountId = await anAccount(database);
    const before = await nameOf(database, accountId);

    const attempt = database.db.transaction(async (tx) => {
      await tx
        .update(schema.user)
        .set({ name: "Ana María Restrepo" })
        .where(eq(schema.user.id, accountId));

      await recordConsent(tx, {
        accountId,
        side: "worker",
        // She read the text before it changed. Recording the current version
        // against that consent is the row this refusal exists to prevent.
        versions: { notice: "2020-01-01", authorization: "2020-01-01" },
      });
    });

    await expect(attempt).rejects.toBeInstanceOf(AppError);

    // The direction that matters: the refusal did not merely skip the consent
    // row, it took the collection with it.
    expect(await consentRows(database, accountId)).toHaveLength(0);
    expect(await nameOf(database, accountId)).toBe(before);
  });
});

describe("the constraints, as the backstop behind the module", () => {
  // Written as raw SQL on purpose: the module cannot produce either row, so the
  // question is whether the engine refuses a writer that is not the module. DD2's
  // enum-shaped-column rule is only worth having if the CHECK is real.
  test("refuses a side the registry does not know", async ({ database }) => {
    const accountId = await anAccount(database);

    await expect(
      database.client.query(
        `INSERT INTO "consent"
           ("account_id", "side", "notice_version", "authorization_version", "transmission_acknowledged")
         VALUES ($1, 'moderator', '2026-08-30', '2026-08-30', true)`,
        [accountId],
      ),
    ).rejects.toThrow(/consent_side_known/);
  });

  test("refuses a row that records consent without the transmission", async ({ database }) => {
    const accountId = await anAccount(database);

    await expect(
      database.client.query(
        `INSERT INTO "consent"
           ("account_id", "side", "notice_version", "authorization_version", "transmission_acknowledged")
         VALUES ($1, 'worker', '2026-08-30', '2026-08-30', false)`,
        [accountId],
      ),
    ).rejects.toThrow(/consent_transmission_acknowledged/);
  });
});

describe("the purge, with no exception", () => {
  // C19: story 13 tells her deletion removes everything from the platform, and
  // that sentence is either true or it is not. The proof row goes with the rest.
  test("takes the Consent rows with the Account", async ({ database }) => {
    const accountId = await anAccount(database);

    await database.db.transaction(async (tx) => {
      await recordConsent(tx, {
        accountId,
        side: "worker",
        versions: CURRENT_CONSENT_VERSIONS,
      });
    });

    expect(await consentRows(database, accountId)).toHaveLength(1);

    await database.db.delete(schema.user).where(eq(schema.user.id, accountId));

    expect(await consentRows(database, accountId)).toHaveLength(0);
  });
});

describe("hasConsented", () => {
  test("is false before, true after, and scoped to the side", async ({ database }) => {
    const accountId = await anAccount(database);

    expect(await hasConsented(database.db, accountId, "worker")).toBe(false);
    expect(await hasConsented(database.db, accountId, "hirer")).toBe(false);

    await database.db.transaction(async (tx) => {
      await recordConsent(tx, {
        accountId,
        side: "worker",
        versions: CURRENT_CONSENT_VERSIONS,
      });
    });

    expect(await hasConsented(database.db, accountId, "worker")).toBe(true);

    // The scoping is the whole reason `sendOffer` can ask this question: an
    // Account that published a profile has not thereby authorized anything about
    // sending Offers, and reading one side for the other would skip his consent
    // step entirely.
    expect(await hasConsented(database.db, accountId, "hirer")).toBe(false);
  });

  test("does not read another Account's consent", async ({ database }) => {
    const hers = await anAccount(database);
    const his = await anAccount(database, "carlos@recomencemos.test");

    await database.db.transaction(async (tx) => {
      await recordConsent(tx, {
        accountId: hers,
        side: "worker",
        versions: CURRENT_CONSENT_VERSIONS,
      });
    });

    expect(await hasConsented(database.db, his, "worker")).toBe(false);
  });
});

describe("the table is append-only", () => {
  // A reclamo asks what she agreed to at the time, so a second consent writes a
  // second row. An upsert would overwrite exactly the fact being asked about, and
  // it would do it silently — which is why there is no UNIQUE (account_id, side).
  test("keeps both rows when consent is given twice on one side", async ({ database }) => {
    const accountId = await anAccount(database);

    await database.db.transaction(async (tx) => {
      await recordConsent(tx, { accountId, side: "worker", versions: CURRENT_CONSENT_VERSIONS });
    });
    await database.db.transaction(async (tx) => {
      await recordConsent(tx, { accountId, side: "worker", versions: CURRENT_CONSENT_VERSIONS });
    });

    expect(await consentRows(database, accountId)).toHaveLength(2);
  });
});
