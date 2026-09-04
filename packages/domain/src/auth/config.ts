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
 * **The Admin's door is `adminDoor` below and nothing else** (#17, then #104 and
 * the contract half that followed it). There was an `emailAndPassword` block here
 * and a `twoFactor` plugin beside it, and DD5's configuration table now records
 * their **absence**: four settings whose only job was to make a credential door
 * safe that one person opened, and a plugin whose sign-in interception matches
 * `/sign-in/email`, `/sign-in/username` and `/sign-in/phone-number` and therefore
 * could never have challenged a passwordless first factor at all.
 *
 * What is still deliberately absent, because it belongs to a later story rather
 * than because it was forgotten: `user.changeEmail` (story 12) and
 * `user.deleteUser` (story 13). Each is a row of DD5's table and each arrives
 * with the surface that uses it.
 */

import { createHash } from "node:crypto";
import { AppError } from "@repo/errors/app-error";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins/magic-link";
import { eq } from "drizzle-orm";
import {
  ADMIN_CHALLENGE_TTL_SECONDS,
  SECOND_FACTOR_ROUTE,
  secureCookies,
  SIGN_IN_CHALLENGE_COOKIE,
  SIGN_IN_CHALLENGE_COOKIE_ATTRIBUTES,
  signSignInChallenge,
} from "#admin/challenge";
import { adminDoor } from "#auth/admin-door";
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
import { ADMIN_SIGN_IN_ONLY, SIGN_IN_FAILED } from "#user-messages";

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
export type AuthOptions = BetterAuthOptions & {
  plugins: [ReturnType<typeof magicLink>, ReturnType<typeof adminDoor>];
};

/** Read as a plain record, so seam 1 can hand it one. Matches `#config`'s shape. */
export type AuthEnv = Readonly<Record<string, string | undefined>>;

export const SECRET_VARIABLE = "BETTER_AUTH_SECRET";
export const BASE_URL_VARIABLE = "BETTER_AUTH_URL";
export const GOOGLE_CLIENT_ID_VARIABLE = "GOOGLE_CLIENT_ID";
export const GOOGLE_CLIENT_SECRET_VARIABLE = "GOOGLE_CLIENT_SECRET";

/**
 * Written by the named local proxy that fronts `next dev`, and read by nothing
 * in a deployed environment — see {@link authBaseUrl}.
 */
export const PROXY_URL_VARIABLE = "PORTLESS_URL";

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

// Every variable this reads is a runtime credential, which is NFR24's reason
// for it reaching no turbo task: `.env*` is a `build` input, so declaring one
// on a task would hash it into the cache key.
function required(env: AuthEnv, variable: string): string {
  const value = env[variable]?.trim();
  if (value) return value;

  throw new AppError({
    code: "auth_config_missing",
    status: 503,
    message:
      `${variable} is unset or empty, so authentication cannot be configured. ` +
      "Locally: `cp apps/web/.env.example apps/web/.env.local`. In production it comes " +
      "from `fly secrets`, and it reaches no turbo task.",
    userMessage: SIGN_IN_FAILED,
    context: { variable },
  });
}

/**
 * `BETTER_AUTH_SECRET` is load-bearing beyond sessions — it will encrypt the
 * Admin's TOTP secrets and backup codes at rest (DD5) — so the one thing worth
 * refusing outright is the development value reaching a deploy.
 */
export function authSecret(env: AuthEnv = process.env): string {
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
 * **The origin this app is configured at, read in one place.**
 *
 * It is the origin Better Auth is configured with, the origin it trusts, and the
 * base the Admin link is built against. Three separate reads would be three
 * chances for those to stop being the same origin, so there is one function and
 * every caller goes through it.
 *
 * **Development is served under a name rather than a port** (ADR-0018), and the
 * name is not knowable when `.env.local` is written: it carries the branch, so
 * each worktree gets `<branch>.web.<project>.localhost` and a static file cannot
 * hold the right answer for all of them at once. The proxy writes the origin it
 * is actually serving into the child's environment, so that is what this reads.
 *
 * **Outside production only, and that is the whole safety argument.** A deployed
 * environment has no proxy and never sets the variable — but "never sets it" is
 * an assumption about an environment rather than a property of this code, and the
 * failure it would cause is the worst kind: `trustedOrigins` and every magic link
 * silently pointing at somewhere else. So the guard is explicit here, the same
 * shape {@link authSecret} uses to refuse the committed development secret and
 * `responsibleParty()` uses to refuse its placeholders. With `PORTLESS=0` there
 * is no proxy and no variable, and the configured value is what stands.
 */
export function authBaseUrl(env: AuthEnv): string {
  const proxied = env[PROXY_URL_VARIABLE]?.trim();
  if (proxied && env.NODE_ENV !== "production") return proxied;

  return required(env, BASE_URL_VARIABLE);
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
 * **It is one hash for one kind of token again.** It moved out to a leaf module
 * for a while, because the Admin door had a second link table that hashed its
 * own token the same way and the two files could not import each other. That
 * table is gone — the Admin's first factor is this very link — so there is one
 * token, one rule, and no cycle to break.
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

  /** Read once, through the one function that decides it. */
  const baseUrl = authBaseUrl(env);

  return {
    appName: "Recomencemos",
    baseURL: baseUrl,
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
    trustedOrigins: [new URL(baseUrl).origin],

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
     * **The Admin grant, declared rather than hand-added** — the rule DD5 states
     * for `verification.sharedDevice` and the reason `auth-schema.test.ts` can
     * pin the column to this declaration.
     *
     * **`input: false` is the security property, not a tidiness one.** It closes
     * the field to every request body Better Auth accepts, on sign-up and on
     * update alike, so there is no endpoint anywhere that can grant Admin. DD7
     * asks for exactly that: _"the first Admin grant is a documented manual
     * `UPDATE` — undocumented, it becomes a self-grant endpoint the first time
     * someone needs it at 2 a.m."_ Runbook §6 is the documented path, and this
     * flag is what stops a second one appearing.
     */
    user: {
      additionalFields: {
        isAdmin: { type: "boolean", required: false, defaultValue: false, input: false },
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

          /**
           * **One URL, for every address.** An Account holding the Admin grant
           * is sent the same link as everybody else and it is spent the same
           * way; what differs is that consuming it produces a challenge instead
           * of a session, which is decided at session creation and not here.
           *
           * The alternative was a second link to a route of its own, and it put
           * `/admin/continue/<token>` in the mail body — the admin surface named
           * in the one place this design cannot control. What is in the mailbox
           * now discloses nothing, because there is nothing in it to differ.
           */
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
           *
           * **It pairs with `magic_link.consumed` for every Account, the Admin's
           * included**, which is the half a second link mechanism could not
           * deliver: her link had no verification row, so her `requested` could
           * never be followed by a `consumed` and NFR27's funnel counted a
           * request that was structurally unable to complete.
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

      /**
       * **The Admin's door** (NFR14, DD5). One endpoint, which mints the only
       * `link_totp` session this product can produce — see `#auth/admin-door`
       * for why it is a plugin rather than a function called from a Server
       * Action, and `#admin/door` for everything it decides.
       */
      adminDoor({ db, key: authSecret(env), logger, secure: secureCookies(baseUrl) }),
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
         * is 3 per 10 seconds, which would leave the only way into this product
         * on a number nobody chose. These mirror `CEILINGS` in `./rate-limit` —
         * the Server Action's per-address bound is the real one; this is the
         * same bound on the door that bypasses it.
         *
         * **`/second-factor/verify` is not here, and its absence is a decision.**
         * The Admin door's own endpoint is bounded per *Account* by two `CEILINGS`
         * rows counted separately, which is a stronger bound than a per-IP number
         * because it survives an attacker rotating addresses. A second bound here
         * would be a number nobody could keep in agreement with those two.
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
           * are the two facts about a session that no later code can recover —
           * and, since #17, NFR14's **refusal** as well, because this is the one
           * place in this package a session is born.
           */
          before: async (session, context) => {
            const path = context?.path;
            const attempt = readSignInAttempt(context);
            const method = signInMethodForPath(path ?? "");

            await refuseDoorThatIsNotTheAdminDoor(
              { db, logger, key: authSecret(env), secure: secureCookies(baseUrl) },
              context,
              session.userId,
              method,
            );

            return {
              data: {
                ...session,
                signInMethod: method,
                expiresAt: sessionExpiryFor(method, attempt, new Date()),
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

/**
 * **NFR14's first half**: every door that is not the Admin door is refused for an
 * account holding the Admin grant.
 *
 * Three things about the shape are load-bearing, and all three were alternatives
 * that looked simpler.
 *
 * **It is written over the class, not over its members — and the class is the
 * complement of one member.** The requirement widened with the amendment that
 * made the Admin door passwordless: it was _"every passwordless door"_ while a
 * password door existed, and it is now _"every door that is **not** the Admin
 * door"_. So the test is inequality against {@link ADMIN_SIGN_IN_METHOD} rather
 * than membership of a list of the doors that happen to be wrong today, which
 * is what makes a door added later refused by **default** instead of admitted
 * until somebody remembers to add it somewhere. `signInMethodForPath` already
 * throws for a door on no list at all, so there is no third state to fall
 * through.
 *
 * **It refuses the credential doors too, and that is the amendment rather than
 * an oversight corrected.** They are not passwordless, so the narrower rule let
 * them through — an Admin could sign in with her password and hold a real
 * session on her own Account: no Admin authority, but her account page, her
 * session list and _salir de todas partes_. The door itself goes with the
 * surface in the slice after this one; until then it is refused here, which is
 * the difference between a door that is dead and a door that still opens
 * something.
 *
 * **It runs at session creation and not at the door.** Refusing inside
 * `beforeSignIn` at `/sign-in/magic-link` is the obvious place and it is the
 * wrong one: that endpoint answers identically for an address that has an Account
 * and one that does not — deliberately, because the honest reply and the
 * enumeration-safe reply are the same one — and a refusal there would make its
 * response differ for exactly one address in the system. That turns the public
 * sign-in form into an oracle for _"which address is the Admin's"_, which is the
 * first thing worth knowing before attacking this product. Refusing here costs
 * one delivered email that opens onto a failure, and the Admin reading it learns
 * something true: somebody tried.
 *
 * **It is a query rather than a value carried along.** The grant lives on the
 * `user` row and this hook has the row's id, so nothing has to thread it through
 * four middleware hops where one of them could drop it.
 *
 * **There is no exemption left to remember.** The old rule had one — a
 * `password` session was outside the passwordless class and therefore silently
 * allowed — and it was load-bearing while the credential door was how an Admin
 * reached enrolment. Enrolment happens over the direct connection now, before
 * the grant exists at all, so there is no window to keep open and nothing this
 * rule has to make an exception for.
 *
 * **It throws Better Auth's `APIError` rather than an `AppError`, and that is a
 * runtime finding rather than a preference.** The first version threw an
 * `AppError` and seam 3 answered **500** — read out of the running server, not
 * predicted. The reason is in `magic-link/index.mjs`: the verify endpoint wraps
 * `createUser` in a `try`/`catch` that redirects, and calls `createSession`
 * **unwrapped**, so a database hook throwing there escapes as an unhandled error.
 * Better Auth logs it as `SERVER_ERROR`, the caller gets a 500, and the
 * `userMessage` written for this refusal reaches nobody. An `APIError` is
 * rendered by better-call's own router instead — a real 403 with a legible body,
 * which is also the status NFR14 asks for.
 *
 * The operator half is not lost with it: the line is emitted here, at `warn`,
 * carrying the id and the door. That is the same split every returned refusal in
 * this repository makes — one `warn` line, no Sentry event.
 */
async function refuseDoorThatIsNotTheAdminDoor(
  {
    db,
    logger,
    key,
    secure,
  }: {
    readonly db: DomainDatabase;
    readonly logger: AuthLogger;
    readonly key: string;
    readonly secure: boolean;
  },
  // oxlint-disable-next-line no-explicit-any -- the endpoint context, as above.
  context: any,
  userId: string,
  method: schema.SignInMethod,
): Promise<void> {
  if (method === schema.ADMIN_SIGN_IN_METHOD) return;

  const [account] = await db
    .select({ isAdmin: schema.user.isAdmin })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);

  if (!account?.isAdmin) return;

  /**
   * **The magic link is factor one, so it is diverted rather than refused.**
   * Every other door is a dead end for this Account and answers 403; this one is
   * halfway through the Admin door, and the difference between the two is the
   * whole of what makes the product's single sign-in form work for her.
   *
   * By the time this runs the token is already spent — `/magic-link/verify`
   * calls `consumeVerificationValue` **before** `createSession` — so the link is
   * single-use without this package implementing single-use. What is left to do
   * is say which Account got this far, which is exactly what the challenge is.
   *
   * **The cookie is set and then the redirect is thrown**, in that order,
   * because a thrown redirect leaves the endpoint immediately. Both travel on
   * the same response: better-call accumulates `Set-Cookie` on the context's
   * response headers, and the redirect carries them.
   */
  if (method === "magic_link") {
    /**
     * **Nothing is logged here, and that is the unification paying out.** The
     * `after` hook on this path emits `magic_link.consumed` already, and it runs
     * on a thrown redirect — measured, because it is the kind of thing that is
     * easy to assume either way. So a granted Account's link produces the same
     * one line, with the same `sign_in_attempt_id` and `shared_device`, as every
     * other Account's, and NFR27's pair closes for her without a field or an
     * event of her own.
     *
     * A line was written here first and it was a **second** `consumed` for the
     * same link, which would have counted her twice in the numerator of the
     * ratio it exists to measure.
     */
    context.setCookie(SIGN_IN_CHALLENGE_COOKIE, signSignInChallenge(userId, key), {
      ...SIGN_IN_CHALLENGE_COOKIE_ATTRIBUTES,
      maxAge: ADMIN_CHALLENGE_TTL_SECONDS,
      secure,
    });

    throw context.redirect(SECOND_FACTOR_ROUTE);
  }

  /**
   * The account id and the door, and no address — this fires on a path whose
   * whole design is that it says nothing about which addresses exist (NFR18).
   * `snake_case` on the line, whatever the source calls it (ADR-0005).
   */
  logger.warn(
    { event: "admin.non_admin_door_refused", account_id: userId, sign_in_method: method },
    "A session was about to be created for an Admin-granted Account through a door other than " +
      "the one that pairs a single-use emailed link with a code from an authenticator. The " +
      "sign_in_method on this line is the door that was refused.",
  );

  throw new APIError(403, { code: "ADMIN_SIGN_IN_ONLY", message: ADMIN_SIGN_IN_ONLY });
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
/**
 * **What this hook may answer, and the one shape it must never use.**
 *
 * `{ context }` is merged into the endpoint context and the endpoint then runs.
 * **Anything else short-circuits and becomes the response** — `runBeforeHooks`
 * in `better-auth@1.7.2/dist/api/dispatch.mjs` returns a hook's object verbatim
 * unless it carries a `context` key — which means the endpoint's body schema,
 * its `use` middlewares and its `requireHeaders` are all skipped.
 *
 * So a short-circuit here is not a shortcut, it is an exemption from every gate
 * the endpoint declares, and on a door whose whole requirement is that one
 * address is indistinguishable from every other it is an oracle. The Admin
 * divert was written this way once; it lives in `sendMagicLink` above now, and
 * the comment there records what it cost.
 *
 * **C44 needed a fourth case here and no longer does, which is the plugin's
 * deletion paying out.** `trustDevice` was a field on the body of
 * `/two-factor/verify-totp` and `/two-factor/verify-backup-code`: passing `true`
 * wrote a signed cookie plus a verification row that skipped the second factor
 * for thirty days, against the eight non-rolling hours NFR13 gives an account
 * that can take down a profile and read every phone number in the system. It was
 * stripped from the request on the way in, because "disabled outright" was not
 * something the plugin's options could express. Both endpoints went with the
 * plugin; the Admin door has one endpoint of its own whose body schema is a
 * single `code`, so there is no field to strip and no case to write.
 */
async function beforeSignIn(
  // oxlint-disable-next-line no-explicit-any -- Better Auth's middleware context
  // is structurally typed per endpoint; the three paths below read three
  // different shapes off it, and narrowing them here would restate the library's
  // own types.
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
