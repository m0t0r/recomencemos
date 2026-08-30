/**
 * NFR14 against a real Better Auth instance and a real database — the half seam 1
 * structurally cannot reach.
 *
 * `actor.test.ts` proves that a session carrying certain field values is refused
 * or admitted. This proves the values: that opening a magic link for an
 * Admin-granted Account creates **no** session at all, that a password alone
 * produces one the gate refuses, and that only password-then-code produces one it
 * admits. The two together are the requirement; either alone is an assertion about
 * something nobody reaches.
 *
 * Everything here runs against the **committed migrations** replayed into PGlite,
 * so the `CHECK` on `session.sign_in_method` is the one production has — which
 * matters more than usual on this file, since the widened constraint is what the
 * new members depend on.
 */

import { eq } from "drizzle-orm";
import { requireAdminSession } from "#admin/actor";
import * as schema from "#schema";
import {
  BASE_URL,
  cookiesFrom,
  enrolSecondFactor,
  grantedAdmin,
  signIn,
  signInStack,
  totpCode,
} from "#testing/auth-stack";
import { test } from "#testing/fixtures";
import type { TestDatabase } from "#testing/fixtures";

const EMAIL = "admin@recomencemos.test";
// Sixteen characters is the floor DD5 sets, and a fixture below it would fail on
// the configuration rather than on the thing under test.
const PASSWORD = "una-contrasena-larga-de-verdad";

/** The session row, read the way `requireAdminSession`'s caller reads it. */
async function sessionFor(database: TestDatabase, accountId: string) {
  const [row] = await database.db
    .select({
      accountId: schema.session.userId,
      signInMethod: schema.session.signInMethod,
      expiresAt: schema.session.expiresAt,
      createdAt: schema.session.createdAt,
    })
    .from(schema.session)
    .where(eq(schema.session.userId, accountId));

  return row;
}

describe("a passwordless door on an Admin-granted Account", () => {
  /**
   * **The requirement's first half, and the case the whole mechanism exists for.**
   * `twoFactorEnabled` on this user is irrelevant — the point is that the session
   * is never created, so there is nothing for a later code path to trust.
   */
  test("creates no session when the magic link is opened", async ({ database }) => {
    const { accountId } = await grantedAdmin(database, { email: EMAIL, password: PASSWORD });
    const stack = signInStack(database);

    await stack.auth.api.signInMagicLink({
      body: { email: EMAIL, callbackURL: "/", metadata: { sharedDevice: false } },
      headers: new Headers({ origin: BASE_URL }),
    });

    const link = stack.links.at(-1)?.url;
    expect(link, "the link was never sent").toBeDefined();

    await stack.auth.handler(new Request(link as string));

    expect(await sessionFor(database, accountId)).toBeUndefined();
  });

  /**
   * **The refusal is at session creation, not at the request** — which is what
   * keeps `/sign-in/magic-link` from becoming an oracle for _"which address is the
   * Admin's"_. The link is sent and the response is the same one every address
   * gets; only opening it fails.
   */
  test("still answers the request identically, so the address is not disclosed", async ({
    database,
  }) => {
    await grantedAdmin(database, { email: EMAIL, password: PASSWORD });
    const stack = signInStack(database);

    const asked = await stack.auth.api.signInMagicLink({
      body: { email: EMAIL, callbackURL: "/", metadata: { sharedDevice: false } },
      headers: new Headers({ origin: BASE_URL }),
    });

    expect(asked).toMatchObject({ status: true });
    expect(stack.links).toHaveLength(1);
  });

  /** The same door, on an Account with no grant, still works. */
  test("leaves an ordinary Account's magic link alone", async ({ database }) => {
    const stack = signInStack(database);
    const { cookie } = await signIn(stack, "ana@recomencemos.test");

    expect(cookie).not.toBe("");
  });
});

describe("the Admin's credential door", () => {
  /**
   * The bootstrap window runbook §6 walks: granted, no second factor yet. The
   * session exists — the plugin only diverts once `twoFactorEnabled` is true — and
   * the gate refuses it, which is what confines it to the enrolment surface.
   */
  test("gives an unenrolled Admin a password session the gate refuses", async ({ database }) => {
    const { accountId } = await grantedAdmin(database, { email: EMAIL, password: PASSWORD });
    const stack = signInStack(database);

    await stack.auth.api.signInEmail({
      body: { email: EMAIL, password: PASSWORD },
      headers: new Headers({ origin: BASE_URL }),
    });

    const row = await sessionFor(database, accountId);
    expect(row?.signInMethod).toBe("password");
    expect(requireAdminSession({ ...row!, isAdmin: true })).toBeNull();
  });

  /**
   * **The whole loop**, and the only path that produces an Admin session: password,
   * enrol, code. `enrolSecondFactor` captures the secret at the one moment it is in
   * the clear, exactly as a person captures it by scanning the QR.
   */
  test("gives an enrolled Admin a two-factor session the gate admits", async ({ database }) => {
    const { accountId } = await grantedAdmin(database, { email: EMAIL, password: PASSWORD });
    const stack = signInStack(database);

    const first = await stack.auth.api.signInEmail({
      body: { email: EMAIL, password: PASSWORD },
      headers: new Headers({ origin: BASE_URL }),
      returnHeaders: true,
    });

    const { secret } = await enrolSecondFactor(stack, cookiesFrom(first.headers), PASSWORD);

    const verified = await stack.auth.api.verifyTOTP({
      body: { code: await totpCode(stack, secret) },
      headers: new Headers({ origin: BASE_URL, cookie: cookiesFrom(first.headers) }),
      returnHeaders: true,
    });

    expect(cookiesFrom(verified.headers)).not.toBe("");

    const row = await sessionFor(database, accountId);
    expect(row?.signInMethod).toBe("password_totp");
    expect(requireAdminSession({ ...row!, isAdmin: true })).toEqual({ accountId });
  });

  /**
   * NFR13's third lifetime. **Eight hours on her own machine**, with no
   * shared-device answer given — which is the case the method-first ordering in
   * `sessionSecondsFor` exists for, and the one an attempt-first reading would
   * have given thirty days.
   */
  test("holds the Admin session to eight hours", async ({ database }) => {
    const { accountId } = await grantedAdmin(database, { email: EMAIL, password: PASSWORD });
    const stack = signInStack(database);

    const first = await stack.auth.api.signInEmail({
      body: { email: EMAIL, password: PASSWORD },
      headers: new Headers({ origin: BASE_URL }),
      returnHeaders: true,
    });
    const { secret } = await enrolSecondFactor(stack, cookiesFrom(first.headers), PASSWORD);
    await stack.auth.api.verifyTOTP({
      body: { code: await totpCode(stack, secret) },
      headers: new Headers({ origin: BASE_URL, cookie: cookiesFrom(first.headers) }),
    });

    const row = await sessionFor(database, accountId);
    const hours = (row!.expiresAt.getTime() - row!.createdAt.getTime()) / 3_600_000;

    expect(Math.round(hours)).toBe(8);
  });

  /**
   * **C44, verified rather than agreed.** `trustDevice` is a *body field* at
   * 1.7.1, so "trusted devices are disabled outright" is only true if something
   * removes it — and the thing that removes it is a `before` middleware, on the
   * door an attacker reaches directly rather than in a caller this package
   * controls. Passing `trustDevice: true` here is the test: no trust-device
   * verification row may be written, or the next sign-in skips the second factor
   * for thirty days against NFR13's eight non-rolling hours.
   */
  test("strips trustDevice, so no thirty-day trust record is written", async ({ database }) => {
    await grantedAdmin(database, { email: EMAIL, password: PASSWORD });
    const stack = signInStack(database);

    const first = await stack.auth.api.signInEmail({
      body: { email: EMAIL, password: PASSWORD },
      headers: new Headers({ origin: BASE_URL }),
      returnHeaders: true,
    });
    const { secret } = await enrolSecondFactor(stack, cookiesFrom(first.headers), PASSWORD);

    /**
     * Through `auth.handler` rather than `auth.api`, deliberately: the middleware
     * guards the HTTP door, which is the one a client can post to without going
     * through any method on `AuthHandler`.
     */
    await stack.auth.handler(
      new Request(`${BASE_URL}/api/auth/two-factor/verify-totp`, {
        method: "POST",
        headers: {
          origin: BASE_URL,
          cookie: cookiesFrom(first.headers),
          "content-type": "application/json",
        },
        body: JSON.stringify({ code: await totpCode(stack, secret), trustDevice: true }),
      }),
    );

    const trustRecords = await database.db
      .select({ identifier: schema.verification.identifier })
      .from(schema.verification);

    expect(trustRecords.filter((row) => row.identifier.startsWith("trust-device-"))).toEqual([]);
  });

  /**
   * A backup code is the second factor, not a lesser one — DD5 makes the ten
   * printed codes a required recovery path, and a session they establish has to be
   * able to moderate or losing the phone leaves every reported Hirer frozen (C43).
   */
  test("treats a backup code as the second factor", async ({ database }) => {
    const { accountId } = await grantedAdmin(database, { email: EMAIL, password: PASSWORD });
    const stack = signInStack(database);

    const first = await stack.auth.api.signInEmail({
      body: { email: EMAIL, password: PASSWORD },
      headers: new Headers({ origin: BASE_URL }),
      returnHeaders: true,
    });
    const { secret, backupCodes } = await enrolSecondFactor(
      stack,
      cookiesFrom(first.headers),
      PASSWORD,
    );
    expect(backupCodes).toHaveLength(10);

    // Enrolment has to complete before a backup code is accepted at sign-in, which
    // is the plugin refusing an unverified secret — a half-finished enrolment must
    // not become a second factor nobody holds.
    await stack.auth.api.verifyTOTP({
      body: { code: await totpCode(stack, secret) },
      headers: new Headers({ origin: BASE_URL, cookie: cookiesFrom(first.headers) }),
    });
    await database.db.delete(schema.session).where(eq(schema.session.userId, accountId));

    const second = await stack.auth.api.signInEmail({
      body: { email: EMAIL, password: PASSWORD },
      headers: new Headers({ origin: BASE_URL }),
      returnHeaders: true,
    });

    await stack.auth.api.verifyBackupCode({
      body: { code: backupCodes[0] as string },
      headers: new Headers({ origin: BASE_URL, cookie: cookiesFrom(second.headers) }),
    });

    const row = await sessionFor(database, accountId);
    expect(row?.signInMethod).toBe("password_totp");
  });
});
