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

import { betterAuth } from "better-auth";
import { createAuthHandler } from "#auth/index";
import { authOptions } from "#auth/config";
import * as schema from "#schema";
import { test, type TestDatabase } from "#testing/fixtures";

const BASE_URL = "https://recomencemos.test";

const AUTH_ENV = {
  BETTER_AUTH_SECRET: "a-secret-long-enough-for-the-configuration-to-build",
  BETTER_AUTH_URL: BASE_URL,
} as const;

/** A Better Auth instance over the restored engine, plus the link it would have emailed. */
function signInStack(database: TestDatabase) {
  const links: { url: string }[] = [];

  const auth = betterAuth(
    authOptions({
      db: database.db,
      sendMagicLink: async ({ url }) => {
        links.push({ url });
      },
      logger: { info: () => {}, warn: () => {} },
      env: AUTH_ENV,
    }),
  );

  return { auth, links };
}

/** Every cookie a response set, as one `Cookie` header value. */
function cookieHeader(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

/** Sign in through the magic-link door and hand back the cookie the browser now holds. */
async function signIn(
  auth: ReturnType<typeof signInStack>["auth"],
  links: { url: string }[],
  email: string,
  sharedDevice: boolean,
) {
  await auth.api.signInMagicLink({
    body: { email, callbackURL: "/", metadata: { sharedDevice } },
    headers: new Headers({ origin: BASE_URL }),
  });

  const link = links.at(-1)?.url;
  expect(link, "the magic link was never sent").toBeDefined();

  const opened = await auth.handler(new Request(link as string));
  const cookie = cookieHeader(opened);
  expect(cookie, "opening the link set no session cookie").not.toBe("");

  return cookie;
}

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
    const { auth, links } = signInStack(database);
    const cookie = await signIn(auth, links, "worker@example.co", true);

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

  test("leaves the other device signed in, because #13 owns everywhere", async ({ database }) => {
    const { auth, links } = signInStack(database);

    const phone = await signIn(auth, links, "worker@example.co", true);
    const laptop = await signIn(auth, links, "worker@example.co", false);
    expect(await database.db.select().from(schema.session)).toHaveLength(2);

    await auth.api.signOut({ headers: new Headers({ cookie: phone }) });

    // The boundary between this ticket and #13, asserted rather than assumed:
    // `signOut` is single-session. `signOutEverywhere` is story 12's, and if it
    // ever arrives by widening this method instead of adding one, this fails.
    expect(await readSession(auth, phone)).toBeNull();
    expect(await readSession(auth, laptop)).toBe("worker@example.co");
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
