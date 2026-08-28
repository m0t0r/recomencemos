/**
 * Better Auth's configuration, and the eleven places its defaults are wrong for
 * this product.
 *
 * DD5's table is the authority and every row of it that belongs to story 1 is
 * here. Three of those rows would ship as security holes rather than rough edges
 * if left alone — an in-memory limiter that resets on every deploy, an unread
 * `x-forwarded-for` that collapses every per-IP ceiling into one global one, and
 * a session cookie cache that makes every revocation in NFR13 and NFR15 lag by
 * its TTL.
 *
 * **What is deliberately absent**, because it belongs to a later story rather
 * than because it was forgotten: `emailAndPassword` and the `twoFactor` plugin
 * (story 7's Admin), `user.changeEmail` (story 12), `user.deleteUser`
 * (story 13). Each is a row of DD5's table and each arrives with the surface
 * that uses it.
 */

import { createHash } from "node:crypto";
import { AppError } from "@repo/errors/app-error";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins/magic-link";
import {
  readSignInAttempt,
  sessionExpiryFor,
  SHARED_DEVICE_COOKIE,
  SHARED_DEVICE_COOKIE_MAX_AGE_SECONDS,
  SHARED_DEVICE_HEADER,
  sharedDeviceFromHeader,
  SIGN_IN_ATTEMPT_KEY,
  type SignInAttempt,
  signInMethodForPath,
} from "#auth/sign-in-attempt";
import type { DomainDatabase } from "#database";
import { chargeCeiling } from "#rate-limit";
import * as schema from "#schema";
import { SIGN_IN_FAILED } from "#user-messages";

/**
 * The options type, named through `typeof magicLink` rather than inferred.
 *
 * A bare `BetterAuthOptions` annotation widens `plugins` to the base type, and
 * `betterAuth()` derives `auth.api` from what it is given — so the magic-link
 * plugin's endpoints would vanish and `auth.api.signInMagicLink` would not
 * exist. Leaving the return type inferred does not work either: the plugin's
 * endpoint types reach into `zod`'s internals, which TypeScript cannot name from
 * outside this package. Naming the plugin through the import that already
 * brought it in satisfies both.
 */
export type AuthOptions = BetterAuthOptions & { plugins: [ReturnType<typeof magicLink>] };

/** Read as a plain record, so seam 1 can hand it one. Matches `#config`'s shape. */
export type AuthEnv = Readonly<Record<string, string | undefined>>;

export const SECRET_VARIABLE = "BETTER_AUTH_SECRET";
export const BASE_URL_VARIABLE = "BETTER_AUTH_URL";
export const GOOGLE_CLIENT_ID_VARIABLE = "GOOGLE_CLIENT_ID";
export const GOOGLE_CLIENT_SECRET_VARIABLE = "GOOGLE_CLIENT_SECRET";

/**
 * The value `apps/web/.env.example` ships so a fresh clone can run the whole
 * sign-in loop, and the one value this configuration refuses in production.
 *
 * A committed development secret is a real trade-off and it is taken knowingly:
 * without one, the first thing anybody does with this repository — sign in —
 * fails on a variable they have to generate. What makes it safe is the refusal
 * below rather than a note asking people to remember. Better Auth rejects its
 * *own* placeholder secrets in production; this is the same idea applied to
 * ours, because Better Auth has never heard of this string.
 */
export const DEVELOPMENT_SECRET = "development-only-secret-do-not-deploy-3f9a2c";

/**
 * **The magic link is single-use with a fifteen-minute TTL** (DD5).
 *
 * Fifteen rather than Better Auth's five-minute default: she may be on a slow
 * connection, on a borrowed phone, switching to a mail app that takes its time
 * syncing. Fifteen rather than an hour: a `GET` verify URL is fetched by
 * corporate link scanners, WhatsApp previews and Outlook Safe Links, and every
 * minute the token stays live is a minute one of them can consume it.
 *
 * The consumption case is *not* handled by making the window longer — it is
 * handled by the consumed-link surface offering an immediate resend, because a
 * single-use token eaten by a scanner otherwise locks a Worker out with no
 * password to fall back on.
 */
export const MAGIC_LINK_TTL_MINUTES = 15;

/** What a caller must give this package so it can send the one email it sends. */
export interface MagicLinkRequest {
  readonly email: string;
  /** Server-minted, absolute, and never built from anything a person typed. */
  readonly url: string;
  readonly expiresInMinutes: number;
  /** NFR27's correlator. The notification's idempotency key is built from it. */
  readonly signInAttemptId: string;
}

/**
 * The logging port, and the reason it is a port.
 *
 * The spec's dependency graph draws `@repo/domain → @repo/errors,
 * @repo/observability`, so importing the logger would be fine — but it draws
 * `@repo/notifications` as `apps/web`'s dependency and **not** this package's.
 * The sender therefore has to be injected, and once one dependency is a
 * parameter the logger may as well be the same shape rather than half the
 * configuration arriving one way and half the other. `pino`'s `Logger` satisfies
 * this structurally.
 */
export interface AuthLogger {
  info(fields: Record<string, unknown>, message: string): void;
  warn(fields: Record<string, unknown>, message: string): void;
}

export interface AuthDependencies {
  /**
   * **Injected rather than imported**, because the spec's module graph gives
   * `@repo/notifications` to `apps/web` and not to this package — see
   * `## Modules and workspaces`. It is also the seam that lets seam 2 exercise
   * the whole flow without sending anything.
   */
  readonly sendMagicLink: (request: MagicLinkRequest) => Promise<void>;
  readonly logger: AuthLogger;
  /**
   * The database handle. **Optional here and required everywhere else in this
   * package**, because ADR-0010 withholds `#connection` and `apps/web` therefore
   * has no handle to pass. Absent, `createAuthHandler` resolves the pooled one
   * itself; present, nothing touches the pooled path — which is what lets a test
   * build these options without a database.
   */
  readonly db?: DomainDatabase | undefined;
  readonly env?: AuthEnv;
}

function required(env: AuthEnv, variable: string): string {
  const value = env[variable]?.trim();
  if (value) return value;

  throw new AppError({
    code: "auth_config_missing",
    status: 503,
    message:
      `${variable} is unset or empty, so authentication cannot be configured. ` +
      "Locally: `cp apps/web/.env.example apps/web/.env.local`. In production it comes " +
      "from `fly secrets` (NFR24 — it reaches no turbo task).",
    userMessage: SIGN_IN_FAILED,
    context: { variable },
  });
}

/**
 * `BETTER_AUTH_SECRET` is load-bearing beyond sessions — it will encrypt the
 * Admin's TOTP secrets and backup codes at rest (DD5) — so the one thing worth
 * refusing outright is the development value reaching a deploy.
 */
export function authSecret(env: AuthEnv): string {
  const secret = required(env, SECRET_VARIABLE);

  if (secret === DEVELOPMENT_SECRET && env.NODE_ENV === "production") {
    throw new AppError({
      code: "auth_secret_is_the_development_one",
      status: 503,
      message:
        `${SECRET_VARIABLE} is still the value committed in apps/web/.env.example, which ` +
        "every clone of this repository knows. It signs session cookies and will encrypt " +
        "the Admin's second factor. Generate one with `openssl rand -base64 32` and set it " +
        "with `fly secrets set`.",
      userMessage: SIGN_IN_FAILED,
      context: { variable: SECRET_VARIABLE },
    });
  }

  return secret;
}

/**
 * Google ships only when both halves are configured.
 *
 * A fresh clone has neither — they are credentials, so NFR24 keeps them out of
 * the committed `.env.example` exactly as it keeps `RESEND_API_KEY` out — and a
 * button that posts to an unconfigured provider is a dead end, which is the one
 * thing the spec's surface table says this page must never be. So the door is
 * absent rather than broken, and `/sign-in` renders what is actually available.
 */
export function googleCredentials(
  env: AuthEnv,
): { readonly clientId: string; readonly clientSecret: string } | undefined {
  const clientId = env[GOOGLE_CLIENT_ID_VARIABLE]?.trim();
  const clientSecret = env[GOOGLE_CLIENT_SECRET_VARIABLE]?.trim();

  if (!clientId || !clientSecret) return undefined;
  return { clientId, clientSecret };
}

/** Whether the Google door exists in this environment. Read by `/sign-in`. */
export function googleSignInAvailable(env: AuthEnv = process.env): boolean {
  return googleCredentials(env) !== undefined;
}

/**
 * How the magic-link token is stored, and why it is not stored as it is sent.
 *
 * Better Auth's default is `"plain"`: the token that mints a session sits in
 * `verification.identifier` in the clear, so a single read of that table is
 * account takeover for every outstanding link — on a product where the magic
 * link is one of only two doors and there is no password to fall back on. C28
 * classifies Verification `secret`; this is what that classification costs to
 * honour, which is one hash.
 *
 * Exported because the `before` hook that reads a row back has to hash the token
 * the same way, and two spellings of one hash is a bug that presents as "the
 * shared-device box does nothing".
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Better Auth's options, assembled.
 *
 * A function of its dependencies rather than a module-level instance: the
 * instance is built once inside `createAuthHandler`, and keeping the options
 * pure means seam 1 can read them — which is what `auth-schema.test.ts` does to
 * pin the Drizzle tables to what Better Auth actually expects.
 */
export function authOptions({
  sendMagicLink,
  logger,
  db,
  env = process.env,
}: AuthDependencies & { db: DomainDatabase }): AuthOptions {
  const google = googleCredentials(env);

  return {
    appName: "Recomencemos",
    baseURL: required(env, BASE_URL_VARIABLE),
    secret: authSecret(env),

    database: drizzleAdapter(db, { provider: "pg", schema }),

    /**
     * **Set explicitly**, which the API contract asks for in those words even
     * though `baseURL`'s own origin is trusted automatically. The difference is
     * that an implicit list changes silently when `baseURL` does; this one is a
     * line somebody has to edit.
     *
     * It guards a different hop from `safeReturnPath`: this validates
     * `callbackURL`, `redirectTo`, `errorCallbackURL` and `newUserCallbackURL`
     * against the origins we named and answers 403, while `safeReturnPath`
     * guards *our* post-sign-in redirect. DD5 says both are needed and names the
     * confusion between them.
     */
    trustedOrigins: [new URL(required(env, BASE_URL_VARIABLE)).origin],

    /**
     * **`session.expiresIn` is one number and NFR13 needs two**, so this is the
     * fallback rather than the answer: `databaseHooks.session.create.before`
     * writes the real expiry per device class. It is set to the own-device
     * figure so that a path which somehow skipped the hook errs toward the
     * ordinary case rather than toward a week-long session on a borrowed phone.
     */
    session: {
      expiresIn: 60 * 60 * 24 * 30,

      /**
       * **Off, and NFR13's shared-device promise is what depends on it.**
       *
       * Better Auth infers how old a session is by subtracting the *configured*
       * `expiresIn` from the **row's** `expiresAt`
       * (`dist/api/routes/session.mjs`):
       *
       * ```js
       * const shouldBeUpdated =
       *   session.session.expiresAt.valueOf() - expiresIn * 1e3 + updateAge * 1e3 <= Date.now();
       * ```
       *
       * That inference is only sound while the row agrees with the option, and
       * here it deliberately does not: `databaseHooks.session.create.before`
       * writes **8 hours** for a shared device while `expiresIn` above stays at
       * the own-device 30 days. The subtraction then lands about 29 days in the
       * past, so the predicate is true on the **first** `/get-session` — and the
       * refresh writes `expiresAt = now + 30 days` and re-issues the cookie with
       * `Max-Age = 2592000`, undoing **both** halves of the promise, the row as
       * well as the cookie.
       *
       * **The arithmetic is inverted**, which is what makes it dangerous: the
       * shorter the session was meant to be, the sooner it is extended. An
       * own-device row is not touched, so nothing looks wrong until you check
       * the one case that matters.
       *
       * **A `session.update.before` clamp cannot do this job.** That hook is
       * called as `toRun(data, context)` — the partial update only, with no
       * `where`, no token and no existing row — so it cannot read the row's
       * device class or `createdAt` to clamp against. Refusing the refresh is
       * the mechanism that is actually available, and it makes the row the one
       * authority on when a session ends, which is what DD5 says it should be.
       *
       * **What it costs, stated plainly:** an own-device session is now an
       * absolute 30 days rather than a rolling one, so a Worker who uses the
       * product every day is signed out on day 30. That is the price of the
       * shared-device guarantee being real, and it is the right side to err on
       * for a product whose own copy asks _"¿este no es tu teléfono?"_.
       *
       * `updateAge` is gone with it: the expression above is its only reader
       * outside the cookie-cache path, which is off below. **Turning this back
       * on means first making the row and `expiresIn` agree** — otherwise the
       * defect returns exactly as it was.
       */
      disableSessionRefresh: true,

      /**
       * **Off, and this is one of DD5's three security-relevant rows.** With a
       * cookie cache on, every revocation in NFR13 and NFR15's "0 further
       * requests" lags by its TTL — and NFR15's freeze is what stops a reported
       * Hirer sending. Better Auth's default is already off; it is written
       * explicitly because the failure of turning it on is silent.
       */
      cookieCache: { enabled: false },

      /** NFR14's mechanism, written by the hook below. See `#auth-schema`. */
      additionalFields: {
        signInMethod: { type: "string", required: true, input: false },
      },
    },

    /**
     * The shared-device answer, carried where the round trip cannot lose it.
     * Declared here rather than added as a column by hand, which is DD5's rule
     * and the reason `auth-schema.test.ts` can check the two against each other.
     */
    verification: {
      additionalFields: {
        sharedDevice: { type: "boolean", required: false, input: false, defaultValue: false },
        signInAttemptId: { type: "string", required: false, input: false },
      },
    },

    account: {
      /**
       * **Linking on a verified email match only** (DD5). Better Auth 1.7's
       * defaults are already the safe ones — implicit linking requires a
       * verified local user — and `trustedProviders` is left **empty** on
       * purpose, because naming Google there is precisely what would let a
       * Google identity link into an unverified local row and hand an attacker
       * who pre-registered her address her profile.
       *
       * Not linking at all is also wrong here and was considered: it produces
       * two Accounts for one person, one holding her CapabilityProfile and one
       * not, and "why is my profile gone" arriving at a single unpaid operator.
       */
      accountLinking: { enabled: true, trustedProviders: [] },

      /** The OAuth state row is a verification row, which is what carries the answer. */
      storeStateStrategy: "database",
    },

    socialProviders: google
      ? {
          google: {
            ...google,
            /**
             * **The borrowed-Android hazard, as a mechanism rather than as
             * copy** (DD5). On a shared phone the Google account is already
             * signed in, so "Sign in with Google" otherwise completes in one tap
             * with no prompt at all — and she may enter an account under the
             * phone owner's identity without ever seeing a login screen.
             * `select_account` forces the chooser, which is what makes the
             * sentence on `/sign-in` true rather than hopeful.
             */
            prompt: "select_account",

            /**
             * Google reports `email_verified` reliably, and the whole reason
             * this door exists is an identity assertion. A session on an
             * unverified provider email would undo the linking rule above.
             */
            requireEmailVerification: true,
          },
        }
      : {},

    plugins: [
      magicLink({
        expiresIn: MAGIC_LINK_TTL_MINUTES * 60,
        storeToken: { type: "custom-hasher", hash: async (token) => hashToken(token) },
        sendMagicLink: async ({ email, url }, ctx) => {
          const attempt = readSignInAttempt(ctx);
          const signInAttemptId = attempt.signInAttemptId ?? crypto.randomUUID();

          await sendMagicLink({
            email,
            url,
            expiresInMinutes: MAGIC_LINK_TTL_MINUTES,
            signInAttemptId,
          });

          /**
           * NFR27's first line. Ids only — no address, no token, no URL — which
           * is what lets a completion rate be measured without NFR18 being
           * touched. `magic_link.requested` is already one of DD11's closed
           * fourteen, so nothing here widens that vocabulary.
           */
          logger.info(
            {
              event: "magic_link.requested",
              sign_in_attempt_id: signInAttemptId,
              shared_device: attempt.sharedDevice,
            },
            "Magic link requested",
          );
        },
      }),
    ],

    rateLimit: {
      /**
       * **`/api/auth/*` is a second door and NFR26 does not reach it.** A ceiling
       * on the `requestMagicLink` Server Action does nothing for a client posting
       * straight to `/api/auth/sign-in/magic-link`, so Better Auth's own limiter
       * guards that one — pointed at the database, because its default keeps
       * counters in memory and deploys here are continuous, which is the exact
       * defect NFR26 already rejects for our own counter.
       */
      enabled: true,
      storage: "database",
      customRules: {
        /**
         * Explicit rather than inherited. The default for a sensitive endpoint
         * is 3 per 10 seconds, which would leave the one credential in this
         * system on a number nobody chose. These mirror `CEILINGS` in
         * `./rate-limit` — the Server Action's per-address bound is the real
         * one; this is the same bound on the door that bypasses it.
         */
        "/sign-in/magic-link": { window: 60 * 60, max: 20 },
        "/magic-link/verify": { window: 60 * 60, max: 40 },
      },
    },

    advanced: {
      /**
       * **`fly-client-ip` first, and `x-forwarded-for` alone is not enough.**
       * Verified against `@better-auth/core`'s `utils/ip.mjs` at 1.7.1: with no
       * `trustedProxies` configured, a forwarded header is trusted **only when
       * it holds exactly one entry** — and Fly *appends* to a caller-sent
       * `X-Forwarded-For`, so any request whose caller set that header arrives
       * multi-entry, resolves to `null`, and lands in the limiter's one shared
       * `no-trusted-ip` bucket. That collapse is caller-selectable, and it also
       * hits a legitimate user behind a chained corporate proxy.
       *
       * `Fly-Client-IP` is set by Fly's proxy to the address it actually
       * observed, always a single value, so it resolves on every request.
       * `x-forwarded-for` stays as the fallback for an environment with no Fly
       * in front; development and test fall back to localhost inside `getIP`
       * before either is consulted.
       */
      ipAddress: { ipAddressHeaders: ["fly-client-ip", "x-forwarded-for"] },
    },

    hooks: {
      before: createAuthMiddleware(async (ctx) => beforeSignIn(ctx, db)),
      after: createAuthMiddleware(async (ctx) => afterSignIn(ctx, logger)),
    },

    databaseHooks: {
      verification: {
        create: {
          /**
           * **Where the shared-device answer is written**, and the one place
           * DD5's mechanism differs from its prose. DD5 says the choice travels
           * as an `additionalFields` value on the verification record, which is
           * exactly what happens — but the magic-link plugin writes that row
           * itself, with `value` fixed at `JSON.stringify({ email, name })`, so
           * a caller cannot supply the field. This hook is how the declared
           * field gets its value.
           */
          before: async (verification, context) => {
            const attempt = readSignInAttempt(context);

            return {
              data: {
                ...verification,
                sharedDevice: attempt.sharedDevice,
                signInAttemptId: attempt.signInAttemptId ?? null,
              },
            };
          },
        },
      },

      session: {
        create: {
          /**
           * NFR13's lifetime and NFR14's method, written together because they
           * are the two facts about a session that no later code can recover.
           */
          before: async (session, context) => {
            const path = context?.path;
            const attempt = readSignInAttempt(context);

            return {
              data: {
                ...session,
                signInMethod: signInMethodForPath(path ?? ""),
                expiresAt: sessionExpiryFor(attempt, new Date()),
              },
            };
          },
        },
      },

      account: {
        /**
         * **Provider tokens are not stored** (DD5). This design never acts on
         * Google's API on her behalf — it wants an identity assertion and
         * nothing else — so there is no access token worth keeping, and the
         * safest handling of a credential is not to hold one.
         *
         * The columns still exist, because Better Auth's schema declares them
         * and the adapter writes through them; what these two hooks do is make
         * sure what lands in them is `null`. Both halves are needed: `create`
         * for the first sign-in and `update` for every one after it, since
         * `updateAccountOnSignIn` refreshes tokens by default.
         */
        create: {
          before: async (account) => ({ data: { ...account, ...NO_PROVIDER_TOKENS } }),
        },
        update: {
          before: async (account) => ({ data: { ...account, ...NO_PROVIDER_TOKENS } }),
        },
      },
    },
  };
}

/** Every column a provider token could land in, emptied. See the account hooks. */
const NO_PROVIDER_TOKENS = {
  accessToken: null,
  refreshToken: null,
  idToken: null,
  accessTokenExpiresAt: null,
  refreshTokenExpiresAt: null,
} as const;

/**
 * The `before` middleware: four paths, two of them declaring a shared-device
 * answer and two of them recovering one.
 *
 * A handler returning `{ context }` has that object merged into the endpoint
 * context by `runBeforeHooks`, and `databaseHooks` are handed the merged
 * context — so this is how a value crosses from a middleware to a database hook
 * with no module-level mutable state and nothing shared between concurrent
 * requests.
 */
async function beforeSignIn(
  // oxlint-disable-next-line no-explicit-any -- Better Auth's middleware context
  // is structurally typed per endpoint; the four paths below read four different
  // shapes off it, and narrowing them here would restate the library's own types.
  ctx: any,
  db: DomainDatabase,
): Promise<{ context: Record<string, unknown> } | undefined> {
  const path: string = ctx.path ?? "";

  switch (path) {
    /**
     * The Server Action's own call — and the direct door an attacker posts to.
     * The answer arrives as `metadata` on the body, which is the one field
     * `/sign-in/magic-link`'s schema keeps open.
     */
    case "/sign-in/magic-link": {
      await chargeAddressCeilingAtTheDirectDoor(ctx, db);

      const metadata = ctx.body?.metadata;
      return {
        context: {
          [SIGN_IN_ATTEMPT_KEY]: {
            sharedDevice: metadata?.sharedDevice === true,
            signInAttemptId: crypto.randomUUID(),
          } satisfies SignInAttempt,
        },
      };
    }

    /**
     * The Google door starting. `/sign-in/social`'s body is a closed schema that
     * strips unknown keys, so the answer arrives as a header — and is parked in
     * a short-lived cookie, because the provider redirects back to **this same
     * browser** and a cookie is the cheapest carrier that survives that.
     */
    case "/sign-in/social": {
      const sharedDevice = sharedDeviceFromHeader(ctx.headers?.get(SHARED_DEVICE_HEADER));

      ctx.setCookie(SHARED_DEVICE_COOKIE, sharedDevice ? "1" : "0", {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: SHARED_DEVICE_COOKIE_MAX_AGE_SECONDS,
        secure: ctx.context?.options?.advanced?.useSecureCookies ?? true,
      });

      return { context: { [SIGN_IN_ATTEMPT_KEY]: { sharedDevice } satisfies SignInAttempt } };
    }

    /**
     * The magic link being opened, and the **only** moment the verification row
     * can still be read: the endpoint consumes it — deletes it — before it
     * creates the session, so `databaseHooks.session.create.before` would find
     * nothing.
     */
    case "/magic-link/verify": {
      const token: string | undefined = ctx.query?.token;
      if (!token) return undefined;

      const row = await ctx.context.adapter.findOne({
        model: "verification",
        where: [{ field: "identifier", value: hashToken(token) }],
      });

      if (!row) return undefined;

      return {
        context: {
          [SIGN_IN_ATTEMPT_KEY]: {
            sharedDevice: row.sharedDevice === true,
            signInAttemptId:
              typeof row.signInAttemptId === "string" ? row.signInAttemptId : undefined,
          } satisfies SignInAttempt,
        },
      };
    }

    default: {
      /** The Google door completing. `:id` is the provider, so match the prefix. */
      if (!path.startsWith("/callback/")) return undefined;

      const sharedDevice = ctx.getCookie(SHARED_DEVICE_COOKIE) === "1";
      return { context: { [SIGN_IN_ATTEMPT_KEY]: { sharedDevice } satisfies SignInAttempt } };
    }
  }
}

/**
 * NFR26's per-address half, on the door that bypasses the Server Action.
 *
 * The `requestMagicLink` Server Action charges ≤ 5/hour per address before it
 * calls this package — but a client posting straight to
 * `/api/auth/sign-in/magic-link` never runs the action, and Better Auth's own
 * limiter on that path keys by IP only. Without this charge the per-address
 * bound is 20/hour × the attacker's IPs rather than 5/hour, which defeats the
 * half of NFR26 that protects the *address being flooded*.
 *
 * **`ctx.request` is what tells the two callers apart, and it is verified
 * rather than assumed**: better-call's router puts the incoming `Request` on
 * the endpoint context (`router.mjs`), while the Server Action's
 * `auth.api.signInMagicLink({ body, headers })` passes no such field. So an
 * HTTP hit charges here and the action's own call — already charged, with the
 * refusal rendered in her terms — is not charged twice.
 *
 * The refusal is an `APIError` rather than a returned state because this door
 * has no surface: a 429 with `Retry-After` is the whole conversation. A charge
 * that cannot be counted throws (NFR26 fails closed), exactly as it does in the
 * action's path.
 */
// oxlint-disable-next-line no-explicit-any -- see beforeSignIn.
async function chargeAddressCeilingAtTheDirectDoor(ctx: any, db: DomainDatabase): Promise<void> {
  if (!ctx.request) return;

  const email = ctx.body?.email;
  // Not an allow: the endpoint's own schema refuses a body with no address, so
  // there is nothing to charge a counter against.
  if (typeof email !== "string" || email.trim() === "") return;

  const outcome = await chargeCeiling(db, { scope: "address", id: email }, "requestMagicLink");
  if (outcome.allowed) return;

  throw new APIError(
    429,
    { code: "RATE_LIMITED", message: outcome.error.userMessage },
    { "retry-after": String(outcome.retryAfter) },
  );
}

/**
 * The `after` middleware: the cookie half of NFR13, and NFR27's second line.
 */
// oxlint-disable-next-line no-explicit-any -- see beforeSignIn.
async function afterSignIn(ctx: any, logger: AuthLogger): Promise<void> {
  const path: string = ctx.path ?? "";
  const completesSignIn = path === "/magic-link/verify" || path.startsWith("/callback/");
  if (!completesSignIn) return;

  const attempt = readSignInAttempt(ctx);

  /**
   * **The cookie half of the shared-device promise.** `setSessionCookie` takes
   * its `Max-Age` from `session.expiresIn`, one fixed number, and the
   * magic-link path passes no `dontRememberMe` — it falls back to reading a
   * `dont_remember` cookie that will not be there when the link is opened from
   * a mail app's webview. So the persistence is corrected here, by dropping
   * `Max-Age` and `Expires` from the cookies this response sets, which is what
   * makes them session cookies.
   *
   * The **row** is still the half that matters (DD5): a cybercafé browser may
   * not close for a week, so this is the lesser of the two promises and is
   * written second on purpose.
   */
  if (attempt.sharedDevice) {
    makeCookiesNonPersistent(ctx);
  }

  if (path === "/magic-link/verify" && attempt.signInAttemptId) {
    /**
     * NFR27's second line, and the pair that makes the ≥ 70% completion rate
     * measurable. Ids only. `magic_link.consumed` is one of DD11's closed
     * fourteen.
     */
    logger.info(
      {
        event: "magic_link.consumed",
        sign_in_attempt_id: attempt.signInAttemptId,
        shared_device: attempt.sharedDevice,
      },
      "Magic link consumed",
    );
  }
}

/**
 * Strip `Max-Age` and `Expires` from every `Set-Cookie` on this response, so the
 * browser drops them when it closes.
 *
 * Rewriting the header rather than re-issuing the cookie, because the session
 * cookie's name, value and remaining attributes are Better Auth's to choose and
 * restating them here would be a second source for all of them.
 */
// oxlint-disable-next-line no-explicit-any -- see beforeSignIn.
function makeCookiesNonPersistent(ctx: any): void {
  const headers: Headers | undefined = ctx.context?.responseHeaders;
  const cookies = headers?.getSetCookie?.() ?? [];
  if (!headers || cookies.length === 0) return;

  headers.delete("set-cookie");

  for (const cookie of cookies) {
    const stripped = cookie
      .split(";")
      .filter((part) => {
        const name = part.trim().toLowerCase();
        return !name.startsWith("max-age=") && !name.startsWith("expires=");
      })
      .join(";");

    headers.append("set-cookie", stripped);
  }
}

export { betterAuth };
