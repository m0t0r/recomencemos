/**
 * Seam 2 for the Admin's **second** factor, against the committed migrations.
 *
 * The first factor has no tests here because it has no code here: it is the
 * ordinary magic link, minted, hashed, expired and spent by Better Auth exactly
 * as every other Account's is. `auth/admin-door.integration.test.ts` is where
 * that link is followed end to end; what is left for this file is the code.
 *
 * Two properties, and each is a claim about rows rather than about a return
 * value — which is why this is seam 2 and `challenge.test.ts` is seam 1.
 *
 * 1. **One refusal, whichever half failed**, and a backup code that is spent by
 *    being used.
 * 2. **The code is bounded per Account, per factor.** Exhausting the six-digit
 *    ceiling leaves the printed codes working, which is the one thing the door's
 *    lockout copy is allowed to promise.
 */

import { createOTP } from "@better-auth/utils/otp";
import { eq } from "drizzle-orm";
import { verifyAdminCode } from "#admin/door";
import { decryptBackupCodes } from "#admin/second-factor";
import { CEILINGS } from "#rate-limit";
import { adminSecondFactor, user } from "#schema";
import { enrolledAdmin } from "#testing/auth-stack";
import { test, type TestDatabase } from "#testing/fixtures";

const KEY = "a-secret-long-enough-for-the-configuration-to-build";
const ANA = "ana@example.co";
const CARLOS = "carlos@example.co";

const noon = new Date("2026-08-30T12:00:00.000Z");

async function admin(database: TestDatabase) {
  return enrolledAdmin(database, { email: ANA, key: KEY, now: noon });
}

/** An Account with no grant — the overwhelmingly common case. */
async function ordinaryAccount(database: TestDatabase): Promise<void> {
  await database.db
    .insert(user)
    .values({ id: crypto.randomUUID(), name: "", email: CARLOS, emailVerified: true });
}

async function currentCode(secret: string): Promise<string> {
  return createOTP(secret).totp();
}

describe("verifyAdminCode", () => {
  test("accepts the six digits the authenticator is showing", async ({ database }) => {
    const { accountId, secret } = await admin(database);

    const outcome = await verifyAdminCode(database.db, {
      accountId,
      code: await currentCode(secret),
      key: KEY,
      now: noon,
    });

    expect(outcome.ok).toBe(true);
  });

  test("accepts a printed backup code", async ({ database }) => {
    const { accountId, backupCodes } = await admin(database);

    const outcome = await verifyAdminCode(database.db, {
      accountId,
      code: backupCodes[0] as string,
      key: KEY,
      now: noon,
    });

    expect(outcome.ok).toBe(true);
  });

  /**
   * **Each code works once**, and the property is the column rather than a rule
   * a query remembers: the used code is gone from the stored remainder.
   */
  test("consumes a backup code on use", async ({ database }) => {
    const { accountId, backupCodes } = await admin(database);
    const used = backupCodes[0] as string;

    await verifyAdminCode(database.db, { accountId, code: used, key: KEY, now: noon });

    const [row] = await database.db
      .select({ backupCodes: adminSecondFactor.backupCodes })
      .from(adminSecondFactor)
      .where(eq(adminSecondFactor.userId, accountId));

    const remaining = await decryptBackupCodes(row?.backupCodes as string, KEY);
    expect(remaining).not.toContain(used);
    expect(remaining).toHaveLength(backupCodes.length - 1);

    const second = await verifyAdminCode(database.db, {
      accountId,
      code: used,
      key: KEY,
      now: noon,
    });
    expect(second.ok).toBe(false);
  });

  /**
   * **One refusal, whichever half failed.** A caller cannot learn which factor
   * it checked, nor whether the Account was the part that was wrong — which is
   * the whole of what the surface is allowed to say.
   */
  for (const [description, code] of [
    ["six wrong digits", "000000"],
    ["a code that was never printed", "ABCD-2345"],
  ] as const) {
    test(`refuses ${description}`, async ({ database }) => {
      const { accountId } = await admin(database);

      const outcome = await verifyAdminCode(database.db, { accountId, code, key: KEY, now: noon });

      expect(outcome).toEqual({ ok: false, refused: "wrong_code", shape: expect.any(String) });
    });
  }

  test("refuses an Account whose grant has been taken away", async ({ database }) => {
    const { accountId, secret } = await admin(database);
    await database.db.update(user).set({ isAdmin: false }).where(eq(user.id, accountId));

    const outcome = await verifyAdminCode(database.db, {
      accountId,
      code: await currentCode(secret),
      key: KEY,
      now: noon,
    });

    expect(outcome.ok).toBe(false);
  });

  test("refuses an Account with no second factor enrolled", async ({ database }) => {
    await ordinaryAccount(database);
    const [account] = await database.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, CARLOS));
    await database.db
      .update(user)
      .set({ isAdmin: true })
      .where(eq(user.id, account?.id as string));

    const outcome = await verifyAdminCode(database.db, {
      accountId: account?.id as string,
      code: "000000",
      key: KEY,
      now: noon,
    });

    expect(outcome.ok).toBe(false);
  });

  /**
   * **The bound DD5 rebuilt, and the reason it is two rows rather than one.**
   * Ten wrong six-digit codes closes the TOTP path; the printed codes are
   * untouched, which is the only reason the lockout is allowed to say so.
   */
  test("bounds the six-digit path per Account and leaves the printed codes working", async ({
    database,
  }) => {
    const { accountId, backupCodes } = await admin(database);

    let refusal;
    for (let attempt = 0; attempt <= CEILINGS.verifyAdminTotp.account.max; attempt += 1) {
      // Sequential on purpose: the assertion is about the attempt that crosses.
      // oxlint-disable-next-line no-await-in-loop
      refusal = await verifyAdminCode(database.db, {
        accountId,
        code: "000000",
        key: KEY,
        now: noon,
      });
    }

    expect(refusal).toMatchObject({ ok: false, refused: "rate_limited" });

    expect(
      (
        await verifyAdminCode(database.db, {
          accountId,
          code: backupCodes[0] as string,
          key: KEY,
          now: noon,
        })
      ).ok,
    ).toBe(true);
  });

  test("bounds the backup-code path separately", async ({ database }) => {
    const { accountId, secret } = await admin(database);

    let refusal;
    for (let attempt = 0; attempt <= CEILINGS.verifyAdminBackupCode.account.max; attempt += 1) {
      // oxlint-disable-next-line no-await-in-loop
      refusal = await verifyAdminCode(database.db, {
        accountId,
        code: "ZZZZ-2345",
        key: KEY,
        now: noon,
      });
    }

    expect(refusal).toMatchObject({ ok: false, refused: "rate_limited" });

    expect(
      (
        await verifyAdminCode(database.db, {
          accountId,
          code: await currentCode(secret),
          key: KEY,
          now: noon,
        })
      ).ok,
    ).toBe(true);
  });
});
