/**
 * A real Better Auth instance over a restored PGlite engine, and a real
 * magic-link sign-in through it.
 *
 * **Extracted rather than copied, on #13.** `session-lifetime.integration.test.ts`
 * wrote these three helpers for itself; story 12 needs the same harness to hold
 * *two* sessions at once, and a second copy of a sixty-line sign-in harness is
 * the kind of duplication that drifts silently — the two copies pass different
 * options to `authOptions` and nobody notices until one of them is testing a
 * configuration the product does not ship.
 *
 * It lives under `#testing/` rather than beside a test file because
 * `#testing/fixtures` already established that seam 2's shared machinery is a
 * module, not a copied prologue.
 */

import { betterAuth } from "better-auth";
import { authOptions } from "#auth/config";
import type { TestDatabase } from "#testing/database";

export const BASE_URL = "https://recomencemos.test";

export interface AuthStack {
  readonly auth: ReturnType<typeof betterAuth<ReturnType<typeof authOptions>>>;
  /** Every link `sendMagicLink` was asked to send, in order. */
  readonly links: { url: string }[];
}

/**
 * Build the stack.
 *
 * Google is left unconfigured: every test using this reaches its subject through
 * the magic-link door, and configuring a social provider would add an outbound
 * leg a test has no business having.
 */
export function signInStack(database: TestDatabase): AuthStack {
  const links: { url: string }[] = [];

  const auth = betterAuth(
    authOptions({
      db: database.db,
      sendMagicLink: async ({ url }) => {
        links.push({ url });
      },
      logger: { info: () => {}, warn: () => {} },
      env: {
        BETTER_AUTH_SECRET: "a-secret-long-enough-for-the-configuration-to-build",
        BETTER_AUTH_URL: BASE_URL,
      },
    }),
  );

  return { auth, links };
}

/** Every cookie a response set, as one `Cookie` header value. */
export function cookieHeader(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

/**
 * Sign in through the magic-link door, end to end, and hand back the session
 * cookie the browser would now be holding.
 *
 * The link is opened with `redirect: "manual"` semantics — `auth.handler`
 * returns the 302 rather than following it — which is also the response that
 * carries `Set-Cookie`.
 *
 * **`userAgent` is a parameter because story 12's list renders it.** Passing it
 * through as a request header rather than writing the column directly is what
 * makes the test exercise the path that actually populates it; a fixture that
 * `UPDATE`s the row afterwards would pass even if Better Auth stopped recording
 * the header at all.
 */
export async function signIn(
  { auth, links }: AuthStack,
  email: string,
  {
    sharedDevice = false,
    userAgent,
  }: { sharedDevice?: boolean; userAgent?: string | undefined } = {},
): Promise<{ cookie: string; opened: Response }> {
  await auth.api.signInMagicLink({
    body: { email, callbackURL: "/", metadata: { sharedDevice } },
    headers: new Headers({ origin: BASE_URL }),
  });

  const link = links.at(-1)?.url;
  expect(link, "the magic link was never sent").toBeDefined();

  const opened = await auth.handler(
    new Request(link as string, userAgent ? { headers: { "user-agent": userAgent } } : undefined),
  );

  const cookie = cookieHeader(opened);
  expect(cookie, "opening the link set no session cookie").not.toBe("");

  return { cookie, opened };
}
