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

import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
import { betterAuth } from "better-auth";
import { completeAdminEnrolment, mintAdminEnrolment, readAdminEnrolment } from "#admin/enrolment";
import { type AuthLogger, authOptions } from "#auth/config";
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
export function signInStack(
  database: TestDatabase,
  /**
   * A logger, for the one suite that asserts on lines rather than on rows.
   * Silent by default, because every other caller is testing a row and a `pino`
   * line in the middle of it is noise.
   */
  logger: Partial<AuthLogger> = {},
): AuthStack {
  const links: { url: string }[] = [];

  const auth = betterAuth(
    authOptions({
      db: database.db,
      sendMagicLink: async ({ url }) => {
        links.push({ url });
      },
      logger: { info: () => {}, warn: () => {}, ...logger },
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
  return cookiesFrom(response.headers);
}

/**
 * The same, from the bare `Headers` that `returnHeaders: true` hands back.
 *
 * Better Auth's two ways of answering differ here and the difference is easy to
 * miss: `auth.handler` returns a `Response`, while `auth.api.*({ returnHeaders:
 * true })` returns `{ headers, response }` where `headers` is a `Headers`. A test
 * that passes the second to {@link cookieHeader} fails on `undefined.getSetCookie`
 * — which is how this function came to exist rather than by design.
 */
export function cookiesFrom(headers: Headers): string {
  return headers
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

/**
 * An Account that has been all the way through `pnpm admin:enrol`: the grant, a
 * second factor, and the two credentials in the clear so a test can produce a
 * code the door will accept.
 *
 * **It walks the real enrolment rather than writing three rows**, which is the
 * same argument {@link grantedAdmin} makes one paragraph up and a stronger one
 * here: the stored secret and codes are ciphertext under `BETTER_AUTH_SECRET`,
 * and a fixture that wrote its own would be encrypting with its own idea of the
 * format. Reading the plaintext off the *enrolment screen's* values is also the
 * only place either exists in the clear, which is the property DD5 relies on.
 *
 * The key is the caller's, because the door decrypts with the same one and a
 * test that used two would fail for a reason that is not about the door.
 */
export async function enrolledAdmin(
  database: TestDatabase,
  { email, key, now = new Date() }: { email: string; key: string; now?: Date },
): Promise<{ accountId: string; secret: string; backupCodes: readonly string[] }> {
  const { token } = await mintAdminEnrolment(database.db, { email, key, now });

  const rendered = await readAdminEnrolment(database.db, { token, key, now });

  /**
   * `throw` rather than `expect(...).not.toBeNull()`, because a fixture has to
   * **narrow** and an assertion does not: the version that asserted went on to
   * cast the same value three times, which is the shape that survives a change
   * making it genuinely null.
   */
  if (!rendered) throw new Error("the enrolment screen rendered nothing");

  const secret = new TextDecoder().decode(base32.decode(rendered.manualSecret));

  const outcome = await completeAdminEnrolment(database.db, {
    token,
    code: await createOTP(secret).totp(),
    key,
    now,
  });

  if (!outcome.ok) throw new Error("the enrolment refused the code it had just issued");

  return { accountId: outcome.accountId, secret, backupCodes: rendered.backupCodes };
}
