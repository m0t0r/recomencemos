/**
 * Seam 2: sign-out revokes the session **row**, and the cookie a browser is
 * still holding stops working.
 *
 * **The assertion AC 2 asks for is the one a cookie-deletion bug passes.** An
 * implementation that only cleared the cookie would look identical from the
 * browser — she lands on `/` and the header shows her signed out — while the
 * session row lived on for its full 8 or 30 days, reachable by anyone who kept
 * the cookie value. That is the whole failure mode on a shared device, which is
 * the device this ticket exists for. So every test below **keeps the cookie
 * after signing out and presents it again**, which is the only way to tell the
 * two implementations apart.
 *
 * The stack is `session-lifetime.integration.test.ts`'s, for its reasons: a real
 * Better Auth instance over the replayed migrations, and `sendMagicLink`
 * injected so the link is caught in-process and nothing is sent.
 */

import { createAuthHandler } from "#auth/index";
import * as schema from "#schema";
// The stack, the sign-in helper and the cookie reader are `#testing/auth-stack`'s.
// They were a local copy on #80 because that module did not exist on `dev` yet;
// #13 landed it and collapsed the duplicate on rebase, as agreed between the two
// sessions. One harness means the two suites cannot drift into testing different
// configurations of the same product.
import { BASE_URL, cookieHeader, signIn, signInStack } from "#testing/auth-stack";
import { test } from "#testing/fixtures";

const AUTH_ENV = {
  BETTER_AUTH_SECRET: "a-secret-long-enough-for-the-configuration-to-build",
  BETTER_AUTH_URL: BASE_URL,
} as const;

/** What `/get-session` answers for a cookie — the session's email, or `null`. */
async function readSession(
  auth: ReturnType<typeof signInStack>["auth"],
  cookie: string,
): Promise<string | null> {
  const response = await auth.handler(
    new Request(`${BASE_URL}/api/auth/get-session`, { headers: { cookie } }),
  );
  expect(response.status).toBe(200);

  const body: unknown = await response.json();
  if (body === null || typeof body !== "object") return null;
  return (body as { user?: { email?: string } }).user?.email ?? null;
}

describe("signing out", () => {
  test("deletes the session row, so the cookie she was holding is refused", async ({
    database,
  }) => {
    const stack = signInStack(database);
    const { auth } = stack;
    const cookie = (await signIn(stack, "worker@example.co", { sharedDevice: true })).cookie;

    // The session is hers before we touch it — so a later `null` is revocation
    // and not a sign-in that quietly failed.
    expect(await readSession(auth, cookie)).toBe("worker@example.co");
    expect(await database.db.select().from(schema.session)).toHaveLength(1);

    await auth.api.signOut({ headers: new Headers({ cookie }) });

    // **The row, not the cookie.** This is the assertion cookie deletion alone
    // cannot pass.
    expect(await database.db.select().from(schema.session)).toHaveLength(0);

    // And the same cookie, replayed exactly as a thief would replay it.
    expect(await readSession(auth, cookie)).toBeNull();
  });

  /**
   * **The boundary is scope, not hardware**, and the name says so deliberately.
   *
   * It read _"leaves the other device signed in"_ when #80 wrote it, and that
   * conflates the two things story 12 had to pull apart: a session is a
   * **browser**, not a machine. Two browsers on one laptop are two sessions, so
   * signing out of one leaves "the other session" open on the same device — a
   * sentence the old name made unsayable. Renamed on #13 rather than on #80's
   * own branch because this file was being restructured here at the time, and a
   * one-word rename into a file another open PR is rewriting is a guaranteed
   * conflict for nothing.
   *
   * **It also asserts more than it used to.** When it was written
   * `signOutEverywhere` did not exist, so it pinned a boundary against a
   * hypothetical. That method is now real and sits beside this one, which is
   * precisely when a test like this earns its place: if the two ever collapse
   * into one method with a flag, this goes red.
   */
  test("leaves her other session open, because ending every one is #13's", async ({ database }) => {
    const stack = signInStack(database);
    const { auth } = stack;

    // Named for the scenario each sign-in represents — a borrowed phone she
    // ticked the shared-device box for, and her own machine — not for a claim
    // that a session is hardware. See the note above.
    const borrowed = (await signIn(stack, "worker@example.co", { sharedDevice: true })).cookie;
    const own = (await signIn(stack, "worker@example.co", { sharedDevice: false })).cookie;
    expect(await database.db.select().from(schema.session)).toHaveLength(2);

    await auth.api.signOut({ headers: new Headers({ cookie: borrowed }) });

    expect(await readSession(auth, borrowed)).toBeNull();
    expect(await readSession(auth, own)).toBe("worker@example.co");
  });

  /**
   * **The one test that goes through the published method**, rather than through
   * Better Auth directly.
   *
   * It must stay the only `createAuthHandler` call in this file: the factory
   * memoises into a module-level `built`, so a second call here would silently
   * hand back the first test's database. Vitest isolates per file, which is what
   * makes one call safe.
   *
   * What it proves beyond the tests above is the half a caller depends on and
   * cannot see: `setCookie` comes back **populated**. Better Auth writes the
   * clearing `Set-Cookie` onto the response of a call this package makes
   * internally, and a Server Action cannot pass a header through — so an empty
   * array here is a browser that keeps a dead cookie until it expires on its own.
   */
  test("comes back through AuthHandler with the clearing cookies a caller must write", async ({
    database,
  }) => {
    const links: { url: string }[] = [];

    const handler = createAuthHandler({
      db: database.db,
      sendMagicLink: async ({ url }) => {
        links.push({ url });
      },
      logger: { info: () => {}, warn: () => {} },
      env: AUTH_ENV,
    });

    await handler.requestMagicLink({
      email: "worker@example.co",
      sharedDevice: true,
      headers: new Headers({ origin: BASE_URL }),
    });

    const link = links.at(-1)?.url;
    expect(link, "the magic link was never sent").toBeDefined();
    const cookie = cookieHeader(await handler.handler(new Request(link as string)));

    expect(await handler.getSession(new Headers({ cookie }))).toMatchObject({
      email: "worker@example.co",
    });

    const outcome = await handler.signOut({ headers: new Headers({ cookie }) });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.setCookie.length).toBeGreaterThan(0);
    // Cleared, not re-issued: an expiry in the past or an empty value is what
    // tells the browser to drop it.
    expect(outcome.setCookie.some((line) => /max-age=0|expires=/i.test(line))).toBe(true);

    expect(await handler.getSession(new Headers({ cookie }))).toBeNull();
    expect(await database.db.select().from(schema.session)).toHaveLength(0);
  });
});
