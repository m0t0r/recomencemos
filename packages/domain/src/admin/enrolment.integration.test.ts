/**
 * Seam 2 for `#admin/enrolment`, against the **committed migrations**.
 *
 * The property this file exists for is an ordering: **the grant is the last
 * step**. Everything else here is in service of it — that minting leaves no
 * Admin, that a link opened and abandoned leaves no Admin, that a wrong code
 * leaves no Admin, and that the one path which does grant also writes the factor
 * and closes the token, in one transaction, or does none of the three.
 *
 * It is seam 2 rather than seam 1 because that atomicity **is** the mechanism. A
 * test with the database mocked out would assert on the shape of a guard clause;
 * this one asserts on what the rows say afterwards.
 */

import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
import { eq } from "drizzle-orm";
import {
  ADMIN_SETUP_TOKEN_TTL_MINUTES,
  completeAdminEnrolment,
  mintAdminEnrolment,
  readAdminEnrolment,
} from "#admin/enrolment";
import { BACKUP_CODE_COUNT, decryptTotpSecret, verifyTotpCode } from "#admin/second-factor";
import { adminEnrolment, adminSecondFactor, user } from "#schema";
import { test, type TestDatabase } from "#testing/fixtures";

const KEY = "a-secret-long-enough-for-the-configuration-to-build";
const ANA = "ana@example.co";
const noon = new Date("2026-08-27T12:00:00.000Z");

/** After the token has expired, whatever the window is set to. */
const tooLate = new Date(noon.getTime() + (ADMIN_SETUP_TOKEN_TTL_MINUTES + 1) * 60_000);

/**
 * The six digits the authenticator would be showing for this enrolment.
 *
 * **Derived from what the screen renders, not from the row.** The manual-entry
 * secret is exactly what a person types into an authenticator when the camera
 * fails, so decoding it back is the closest a test gets to standing where they
 * stand — and it means these cases would fail if the value on the screen and the
 * value the door checks against ever came apart.
 */
async function currentCode(database: TestDatabase, token: string): Promise<string> {
  const rendered = await readAdminEnrolment(database.db, { token, key: KEY, now: noon });
  const secret = new TextDecoder().decode(base32.decode(rendered?.manualSecret as string));
  return createOTP(secret).totp();
}

async function accountFor(database: TestDatabase, email: string) {
  const [row] = await database.db
    .select({ id: user.id, isAdmin: user.isAdmin, emailVerified: user.emailVerified })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  return row;
}

describe("mintAdminEnrolment", () => {
  test("creates the Account when the address has none", async ({ database }) => {
    await mintAdminEnrolment(database.db, { email: ANA, key: KEY, now: noon });

    expect(await accountFor(database, ANA)).toBeDefined();
  });

  /**
   * **The whole point of the ordering.** The command has printed a link and is
   * waiting at a prompt; nothing has proved an authenticator works, so nothing
   * may hold Admin authority.
   */
  test("grants nothing", async ({ database }) => {
    await mintAdminEnrolment(database.db, { email: ANA, key: KEY, now: noon });

    expect((await accountFor(database, ANA))?.isAdmin).toBe(false);
  });

  test("reuses an Account that already exists, whatever its case", async ({ database }) => {
    const first = await mintAdminEnrolment(database.db, { email: ANA, key: KEY, now: noon });
    const second = await mintAdminEnrolment(database.db, {
      email: "Ana@Example.co",
      key: KEY,
      now: noon,
    });

    expect(second.accountId).toBe(first.accountId);
  });

  /**
   * Running the command twice is a person starting over, not a person holding
   * two live links. The earlier one stops working at the moment the later one is
   * printed, which is what "single-use setup link" has to mean when the first
   * attempt was abandoned rather than finished.
   */
  test("replaces an earlier link for the same Account", async ({ database }) => {
    const first = await mintAdminEnrolment(database.db, { email: ANA, key: KEY, now: noon });
    await mintAdminEnrolment(database.db, { email: ANA, key: KEY, now: noon });

    expect(
      await readAdminEnrolment(database.db, { token: first.token, key: KEY, now: noon }),
    ).toBeNull();
  });

  test("holds exactly one live link per Account", async ({ database }) => {
    await mintAdminEnrolment(database.db, { email: ANA, key: KEY, now: noon });
    await mintAdminEnrolment(database.db, { email: ANA, key: KEY, now: noon });

    expect(await database.db.select().from(adminEnrolment)).toHaveLength(1);
  });

  /** Two credentials, and neither is in the clear on the row that carries it. */
  test("stores neither the secret nor the codes in the clear", async ({ database }) => {
    const { token } = await mintAdminEnrolment(database.db, { email: ANA, key: KEY, now: noon });
    const rendered = await readAdminEnrolment(database.db, { token, key: KEY, now: noon });
    const [row] = await database.db.select().from(adminEnrolment);

    expect(row?.secret).not.toContain(rendered?.manualSecret);
    for (const code of rendered?.backupCodes ?? []) expect(row?.backupCodes).not.toContain(code);
  });

  /** The token is what the browser carries; the row carries a hash of it. */
  test("stores no token a reader of the table could use", async ({ database }) => {
    const { token } = await mintAdminEnrolment(database.db, { email: ANA, key: KEY, now: noon });
    const [row] = await database.db.select().from(adminEnrolment);

    expect(row?.tokenHash).not.toBe(token);
    expect(row?.tokenHash).not.toContain(token);
  });
});

describe("readAdminEnrolment", () => {
  test("renders the QR, the manual secret and the ten codes", async ({ database }) => {
    const { token } = await mintAdminEnrolment(database.db, { email: ANA, key: KEY, now: noon });

    const rendered = await readAdminEnrolment(database.db, { token, key: KEY, now: noon });

    expect(rendered?.totpUri.startsWith("otpauth://totp/")).toBe(true);
    expect(rendered?.manualSecret).toMatch(/^[A-Z2-7]+$/);
    expect(rendered?.backupCodes).toHaveLength(BACKUP_CODE_COUNT);
  });

  /**
   * **A refresh re-renders the same values**, which is the shape decision this
   * table's missing `consumed_at` column carries: rendering reads and does not
   * consume, so a stray reload does not cost ten codes. Verification in the
   * terminal is what closes the token.
   */
  test("renders the same values on a second read", async ({ database }) => {
    const { token } = await mintAdminEnrolment(database.db, { email: ANA, key: KEY, now: noon });

    const first = await readAdminEnrolment(database.db, { token, key: KEY, now: noon });
    const second = await readAdminEnrolment(database.db, { token, key: KEY, now: noon });

    expect(second).toEqual(first);
  });

  /**
   * **Four ways to hold a bad token, one answer.** The surface turns every one
   * of these into a 404 with no message, and it can only do that because this
   * function does not distinguish them either — a richer return type here is an
   * oracle for which tokens existed, one level below where that argument gets
   * made.
   */
  // A `for` loop rather than `test.each`, because seam 2's `test` carries the
  // database as a fixture and `each` passes its case values in place of the
  // context the fixture arrives on.
  for (const token of ["", "not-a-token", "  ", "%%%"]) {
    test(`reads the malformed ${JSON.stringify(token)} as nothing`, async ({ database }) => {
      await mintAdminEnrolment(database.db, { email: ANA, key: KEY, now: noon });

      expect(await readAdminEnrolment(database.db, { token, key: KEY, now: noon })).toBeNull();
    });
  }

  test("reads an expired token as nothing", async ({ database }) => {
    const { token } = await mintAdminEnrolment(database.db, { email: ANA, key: KEY, now: noon });

    expect(await readAdminEnrolment(database.db, { token, key: KEY, now: tooLate })).toBeNull();
  });

  test("reads a spent token as nothing", async ({ database }) => {
    const { token } = await mintAdminEnrolment(database.db, { email: ANA, key: KEY, now: noon });
    const code = await currentCode(database, token);
    await completeAdminEnrolment(database.db, { token, code, key: KEY, now: noon });

    expect(await readAdminEnrolment(database.db, { token, key: KEY, now: noon })).toBeNull();
  });
});

describe("completeAdminEnrolment", () => {
  test("sets the grant only once a code has proved the authenticator", async ({ database }) => {
    const { token } = await mintAdminEnrolment(database.db, { email: ANA, key: KEY, now: noon });
    const code = await currentCode(database, token);

    const outcome = await completeAdminEnrolment(database.db, { token, code, key: KEY, now: noon });

    expect(outcome.ok).toBe(true);
    expect((await accountFor(database, ANA))?.isAdmin).toBe(true);
  });

  test("writes the factor the door will check against", async ({ database }) => {
    const { token } = await mintAdminEnrolment(database.db, { email: ANA, key: KEY, now: noon });
    const code = await currentCode(database, token);
    await completeAdminEnrolment(database.db, { token, code, key: KEY, now: noon });

    const [factor] = await database.db.select().from(adminSecondFactor);

    expect(await verifyTotpCode(await decryptTotpSecret(factor?.secret as string, KEY), code)).toBe(
      true,
    );
  });

  test("closes the token", async ({ database }) => {
    const { token } = await mintAdminEnrolment(database.db, { email: ANA, key: KEY, now: noon });
    const code = await currentCode(database, token);
    await completeAdminEnrolment(database.db, { token, code, key: KEY, now: noon });

    expect(await database.db.select().from(adminEnrolment)).toHaveLength(0);
  });

  /**
   * **A wrong code costs nothing and grants nothing.** The person mistyped six
   * digits; the enrolment is still live and the prompt asks again, which is the
   * only behaviour that does not make a fat-fingered digit a reason to start
   * over.
   */
  test("leaves the enrolment open and the Account ungranted on a wrong code", async ({
    database,
  }) => {
    const { token } = await mintAdminEnrolment(database.db, { email: ANA, key: KEY, now: noon });

    const outcome = await completeAdminEnrolment(database.db, {
      token,
      code: "000000",
      key: KEY,
      now: noon,
    });

    expect(outcome.ok).toBe(false);
    expect((await accountFor(database, ANA))?.isAdmin).toBe(false);
    expect(await database.db.select().from(adminEnrolment)).toHaveLength(1);
    expect(await database.db.select().from(adminSecondFactor)).toHaveLength(0);
  });

  test("refuses an expired token and grants nothing", async ({ database }) => {
    const { token } = await mintAdminEnrolment(database.db, { email: ANA, key: KEY, now: noon });
    const code = await currentCode(database, token);

    const outcome = await completeAdminEnrolment(database.db, {
      token,
      code,
      key: KEY,
      now: tooLate,
    });

    expect(outcome.ok).toBe(false);
    expect((await accountFor(database, ANA))?.isAdmin).toBe(false);
  });

  test("refuses a token nothing minted", async ({ database }) => {
    const outcome = await completeAdminEnrolment(database.db, {
      token: "not-a-token",
      code: "000000",
      key: KEY,
      now: noon,
    });

    expect(outcome.ok).toBe(false);
  });

  /**
   * Runbook §6's break-glass, and C43's second recovery path, are the same
   * command run again. Both need the second enrolment to *replace* the first —
   * an Account with two factors is an Account whose lost authenticator still
   * opens the door.
   */
  test("replaces the factor when the command is run a second time", async ({ database }) => {
    const first = await mintAdminEnrolment(database.db, { email: ANA, key: KEY, now: noon });
    await completeAdminEnrolment(database.db, {
      token: first.token,
      code: await currentCode(database, first.token),
      key: KEY,
      now: noon,
    });
    const [before] = await database.db.select().from(adminSecondFactor);

    const second = await mintAdminEnrolment(database.db, { email: ANA, key: KEY, now: noon });
    await completeAdminEnrolment(database.db, {
      token: second.token,
      code: await currentCode(database, second.token),
      key: KEY,
      now: noon,
    });
    const factors = await database.db.select().from(adminSecondFactor);

    expect(factors).toHaveLength(1);
    expect(factors[0]?.secret).not.toBe(before?.secret);
  });

  /** A second address is a second Admin, which is the recovery path C43 asks for. */
  test("enrols a second Admin on a second address", async ({ database }) => {
    for (const email of [ANA, "ana.segunda@example.co"]) {
      // Sequential because each enrolment reads the row the previous one wrote;
      // this is a rehearsal of runbook §6's two commands, in its order.
      // oxlint-disable-next-line no-await-in-loop
      const { token } = await mintAdminEnrolment(database.db, { email, key: KEY, now: noon });
      // oxlint-disable-next-line no-await-in-loop
      await completeAdminEnrolment(database.db, {
        token,
        // oxlint-disable-next-line no-await-in-loop
        code: await currentCode(database, token),
        key: KEY,
        now: noon,
      });
    }

    expect(await database.db.select().from(adminSecondFactor)).toHaveLength(2);
  });
});
