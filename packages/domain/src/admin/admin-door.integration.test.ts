/**
 * NFR14 against a real Better Auth instance and a real database — the half seam 1
 * structurally cannot reach.
 *
 * `actor.test.ts` proves that a session carrying certain field values is refused
 * or admitted. This proves the values: that opening a magic link for an
 * Admin-granted Account creates **no** session at all, and that neither half of
 * the credential door produces a session the gate admits. The two together are
 * the requirement; either alone is an assertion about something nobody reaches.
 *
 * **The door that *does* produce an Admin session is
 * `auth/admin-door.integration.test.ts`.** This file is what the credential door
 * became: a page that still signs somebody in and grants them nothing, which is
 * the state it holds for exactly one slice.
 *
 * Everything here runs against the **committed migrations** replayed into PGlite,
 * so the `CHECK` on `session.sign_in_method` is the one production has — which
 * matters more than usual on this file, since the widened constraint is what the
 * new members depend on.
 */

import { eq } from "drizzle-orm";
import * as schema from "#schema";
import { BASE_URL, grantedAdmin, signIn, signInStack } from "#testing/auth-stack";
import { ADMIN_SIGN_IN_ONLY } from "#user-messages";
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
   * The session is never created, so there is nothing for a later code path to
   * trust.
   *
   * **What makes it true changed twice and the assertion did not**, which is why
   * it is worth keeping. It was a `403` thrown at session creation; then, for one
   * draft, a second link mechanism that never reached this endpoint at all; and
   * it is now a redirect into the second factor. The guarantee under all three is
   * the same — opening a link does not make this Account a session — and a
   * regression in any of them shows up here.
   */
  test("creates no session when the emailed link is opened", async ({ database }) => {
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
   * **Nothing about the request differs** — which is what keeps
   * `/sign-in/magic-link` from becoming an oracle for _"which address is the
   * Admin's"_. One link is sent, and the reply is the one every address gets.
   * Which link it was is asserted in `auth/admin-door.integration.test.ts`,
   * where there is a door to open it with.
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

describe("the credential door, on an Account holding the grant", () => {
  /**
   * **It opens nothing at all, and that is the amendment rather than a
   * regression.** This block used to walk the whole password-then-code loop and
   * assert that the session it produced was refused *by the gate*. That was one
   * rule short: `requireAdminSession` refusing a session is not the same as the
   * session never existing, and a `password_totp` session on the Admin's Account
   * is still her — her account page, her session list, her _salir de todas
   * partes_.
   *
   * NFR14's first half is written over _"every door that is not the Admin
   * door"_, and the credential doors are two of those. So the refusal is at
   * session creation now, and there is nothing left for the gate to be asked
   * about.
   *
   * **The page is still standing**, and it stops working the moment this merges.
   * It goes with the slice that replaces it; a door that half-works is the state
   * worth avoiding, and this is what makes it not half-work.
   */
  test("mints no session for a password, at any stage", async ({ database }) => {
    const { accountId } = await grantedAdmin(database, { email: EMAIL, password: PASSWORD });
    const stack = signInStack(database);

    await expect(
      stack.auth.api.signInEmail({
        body: { email: EMAIL, password: PASSWORD },
        headers: new Headers({ origin: BASE_URL }),
      }),
    ).rejects.toMatchObject({ status: 403 });

    expect(await sessionFor(database, accountId)).toBeUndefined();
  });

  /**
   * **The refusal names no door and no account.** It is reachable by anyone
   * holding a password guess, so the sentence has to be true and useless in
   * their hands.
   *
   * **`password` is asserted and `google` is not, and that is a claim about the
   * code rather than a gap being waved through.** `refuseDoorThatIsNotTheAdminDoor`
   * branches exactly twice — it returns for the Admin door, and it diverts
   * `magic_link`. Every remaining member reaches one unbranched `throw`, so
   * `google` and `password_totp` execute the same statement this case executes;
   * there is no per-door path for a test to cover separately.
   *
   * Driving Google here would mean configuring a social provider on the shared
   * stack, which `#testing/auth-stack` deliberately does not do because it adds
   * an outbound leg no test has business having. The complement itself — that
   * every member but one falls into this bucket — is pinned in
   * `auth/sign-in-attempt.test.ts`.
   */
  test("says the one thing every refused door says", async ({ database }) => {
    await grantedAdmin(database, { email: EMAIL, password: PASSWORD });
    const stack = signInStack(database);

    await expect(
      stack.auth.api.signInEmail({
        body: { email: EMAIL, password: PASSWORD },
        headers: new Headers({ origin: BASE_URL }),
      }),
    ).rejects.toMatchObject({ body: { message: ADMIN_SIGN_IN_ONLY } });
  });

  /**
   * The same door on an Account with no grant is untouched — which is what
   * confines the rule above to the Accounts it is about. Nobody else in this
   * product has a password at all, so this is asserted through the door
   * everybody does use.
   */
  test("leaves every other Account's door alone", async ({ database }) => {
    const stack = signInStack(database);

    expect((await signIn(stack, "carlos@recomencemos.test")).cookie).not.toBe("");
  });
});
