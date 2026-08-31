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
import { eq } from "drizzle-orm";
import { completeAdminEnrolment, mintAdminEnrolment, readAdminEnrolment } from "#admin/enrolment";
import { ADMIN_MIN_PASSWORD_LENGTH, type AuthLogger, authOptions } from "#auth/config";
import * as schema from "#schema";
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
 * An Account holding the Admin grant, with a password and no second factor —
 * which is the state runbook §6 leaves behind and the state #17's enrolment
 * window exists for.
 *
 * **The row is created through a sign-up-enabled instance rather than by hand**,
 * and that is the fixture's one interesting decision. The shipped configuration
 * sets `disableSignUp: true` (DD5: the credential door is the *Admin's* door, not
 * a second public one), so there is no production path that creates one of these —
 * exactly as intended, since the runbook creates it out of band. Writing the rows
 * with Drizzle instead would mean this fixture owning a copy of Better Auth's
 * credential-account shape: the `credential` provider id, the local issuer, and
 * whichever password hash the installed version uses. All three are the library's
 * to change, and a fixture that guessed them would go green against a schema
 * production does not have — the failure `auth-schema.test.ts` exists to prevent,
 * one level up.
 *
 * So the library writes the row and the test flips the two flags a human would:
 * the grant, and the verified address. That is the manual `UPDATE` of DD7, spelled
 * in Drizzle.
 */
export async function grantedAdmin(
  database: TestDatabase,
  { email, password }: { email: string; password: string },
): Promise<{ accountId: string }> {
  const enrolment = betterAuth({
    ...authOptions({
      db: database.db,
      sendMagicLink: async () => {},
      logger: { info: () => {}, warn: () => {} },
      env: {
        BETTER_AUTH_SECRET: "a-secret-long-enough-for-the-configuration-to-build",
        BETTER_AUTH_URL: BASE_URL,
      },
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: false,
      requireEmailVerification: false,
      /**
       * **Off, or this fixture cannot build anything.** `signUpEmail` signs the
       * new Account in by default, which mints a session from `/sign-up/email` —
       * a path `SIGN_IN_PATHS` does not name, so `signInMethodForPath` throws. It
       * throwing is correct (a door that has not declared itself must not mint a
       * session); what it means here is that the fixture must not ask for one.
       */
      autoSignIn: false,
      minPasswordLength: ADMIN_MIN_PASSWORD_LENGTH,
    },
  });

  await enrolment.api.signUpEmail({
    body: { email, password, name: "" },
    headers: new Headers({ origin: BASE_URL }),
  });

  const [account] = await database.db
    .update(schema.user)
    .set({ isAdmin: true, emailVerified: true })
    .where(eq(schema.user.email, email))
    .returning({ id: schema.user.id });

  expect(account, `no Account was created for ${email}`).toBeDefined();
  return { accountId: (account as { id: string }).id };
}

/**
 * Enrol a second factor and hand back the plain TOTP secret.
 *
 * **The secret is read out of the `otpauth://` URI, which is the only place it
 * exists in the clear.** Better Auth encrypts the stored copy with
 * `BETTER_AUTH_SECRET` and nothing in this repository decrypts it — which is the
 * property DD5 relies on, and it means a test that needs to *generate* a valid
 * code has to capture the secret at the one moment it is handed over. That is the
 * same moment the Admin scans the QR, so the test walks the path a person walks.
 */
export async function enrolSecondFactor(
  { auth }: AuthStack,
  cookie: string,
  password: string,
): Promise<{ secret: string; backupCodes: readonly string[] }> {
  const response = await auth.api.enableTwoFactor({
    body: { password },
    headers: new Headers({ origin: BASE_URL, cookie }),
  });

  const totpUri = (response as { totpURI?: string }).totpURI;
  expect(totpUri, "enableTwoFactor returned no TOTP URI").toBeDefined();

  const secret = new URL(totpUri as string).searchParams.get("secret");
  expect(secret, "the TOTP URI carries no secret").toBeTruthy();

  return {
    secret: secret as string,
    backupCodes: (response as { backupCodes?: string[] }).backupCodes ?? [],
  };
}

/**
 * A currently-valid six-digit code for the secret {@link enrolSecondFactor}
 * captured.
 *
 * **`auth.api.generateTOTP` produces it**, so the code is made by the same
 * implementation that verifies it. A hand-rolled RFC 6238 here would test this
 * file's arithmetic rather than the product's, and would agree with itself while
 * disagreeing with the library.
 *
 * **The one thing this file does implement is base32, and that is forced.** The
 * `otpauth://` URI carries `base32(secret)` — verified in
 * `@better-auth/utils/dist/otp.mjs`, where `generateQRCode` encodes it — while
 * `generateTOTP` takes the raw secret, so the two do not compose without a
 * decode. That codec is `@better-auth/utils/base32`, which is a *transitive*
 * dependency and therefore unresolvable from this package under pnpm's isolated
 * store (checked: `ERR_MODULE_NOT_FOUND`). That refusal is ADR-0013's world
 * working correctly and not something to route around by adding a dependency this
 * package does not otherwise need, so twelve lines live here instead.
 */
export async function totpCode({ auth }: AuthStack, base32Secret: string): Promise<string> {
  const { code } = await auth.api.generateTOTP({ body: { secret: base32Decode(base32Secret) } });
  return code;
}

/** RFC 4648 base32, decode only, unpadded — the shape the `otpauth://` URI uses. */
function base32Decode(input: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes: number[] = [];
  let value = 0;
  let bits = 0;

  for (const character of input.replace(/=+$/, "").toUpperCase()) {
    const index = alphabet.indexOf(character);
    if (index === -1) throw new Error(`"${character}" is not a base32 character`);

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  // Better Auth's secret is `generateRandomString(32)`, so the decoded bytes are
  // the ASCII of that string and this round-trips exactly.
  return new TextDecoder().decode(Uint8Array.from(bytes));
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
