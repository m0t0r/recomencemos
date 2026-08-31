/**
 * `@repo/domain/auth-handler` — the only door `apps/web` has onto Better Auth.
 *
 * **The Better Auth instance never leaves this package**, which is what
 * `## Modules and workspaces` means by _"not exported, therefore unreachable
 * from `apps/web`: the Drizzle schema, the connection, and the Better Auth
 * instance"_. What escapes is the calls a Next.js app actually needs — a request
 * handler, a session read, one call per door in, three ways out, and (with #17)
 * the Admin's three-step credential door — so the boundary is a **narrower
 * interface**, not a re-export wearing a different name.
 * `apps/web/domain-boundary.test.ts` asserts both halves against Node's own
 * resolver.
 *
 * **No browser holds an auth client any more, and that is the point of
 * `startGoogleSignIn`.** DD5 gave `better-auth/react` to `apps/web` as its own
 * dependency, and until the server-side rework the Google door really was a
 * `createAuthClient().signIn.social` call from a Client Component. Both doors are
 * now Server Actions calling this interface, so the browser holds no auth
 * client, no auth transport, and no knowledge that Better Auth exists.
 *
 * **`@next-safe-action/adapter-better-auth` cannot be used here**, and this is
 * the reason a later session should not reach for it: its signature is
 * `betterAuth<O>(auth: Auth<O>)` — it takes the Better Auth *instance* and calls
 * `auth.api.getSession()` on it. That instance is exactly what ADR-0010
 * withholds, so adopting the adapter means widening this package's `exports` map
 * and failing `domain-boundary.test.ts`. Its whole body is eighteen lines and
 * every one of them is satisfiable through `getSession` below, which `apps/web`
 * already holds.
 */

import { AppError } from "@repo/errors/app-error";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import {
  type AuthDependencies,
  type AuthOptions,
  authOptions,
  googleSignInAvailable,
  MAGIC_LINK_TTL_MINUTES,
} from "#auth/config";
import { ADMIN_CODE_RATE_LIMITED_CODE } from "#auth/admin-door";
import { safeReturnPath } from "#auth/return-path";
import type { DomainDatabase } from "#database";
import { type AccountSession, listAccountSessions } from "#auth/sessions";
import { SHARED_DEVICE_HEADER } from "#auth/sign-in-attempt";
import {
  ADMIN_SECOND_FACTOR_REFUSED,
  SESSION_REQUIRED,
  SIGN_IN_FAILED,
  SIGN_OUT_EVERYWHERE_FAILED,
  SIGN_OUT_FAILED,
} from "#user-messages";

/**
 * Where a failed verification lands. Owned here rather than by `apps/web`,
 * because it is Better Auth that performs the redirect and the value has to
 * travel in the emailed URL.
 */
export const SIGN_IN_PATH = "/sign-in";

export interface RequestMagicLinkInput {
  readonly email: string;
  /** Her answer to _"este no es mi teléfono"_. */
  readonly sharedDevice: boolean;
  /** Where to land afterwards. Validated — see `#auth/return-path`. */
  readonly returnPath?: string | undefined;
  /** The caller's request headers, so Better Auth can read origin and IP. */
  readonly headers: Headers;
}

/**
 * What `requestMagicLink` answers.
 *
 * **`{ ok: true }` whatever happened to the address**, which is the API
 * contract's word and the reason this endpoint cannot enumerate: an address that
 * has an Account and one that does not produce the same reply, the same timing
 * class, and the same sentence on screen. "Revisa tu correo" is said either way,
 * because the honest reply and the enumeration-safe reply are the same one.
 *
 * **`{ ok: false }` is not the exception to that**, and the distinction is worth
 * being precise about because it is the one a reviewer should check. A transport
 * failure — Resend unreachable, the kill switch engaged — happens *identically*
 * for an address that exists and one that does not, so reporting it leaks
 * nothing about the address while telling her the true thing: the mail did not
 * go, and trying again is worth doing. What would leak is an answer that
 * *differs* by address, and there is no path here that produces one.
 */
export type RequestMagicLinkOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: AppError };

export interface SignOutInput {
  /** The caller's request headers, carrying the session cookie to revoke. */
  readonly headers: Headers;
}

/**
 * What `signOut` answers.
 *
 * **`setCookie` is the half a caller must not drop**, for exactly the reason
 * {@link StartGoogleSignInOutcome} says it: Better Auth writes the *clearing*
 * `Set-Cookie` onto the response of a call this package makes internally, and a
 * Server Action does not return that to the browser on its own. A caller that
 * revokes the row and forgets these leaves the browser holding a cookie that no
 * longer works but does not go away, so every later request carries a dead
 * credential until it expires on its own — 8 hours on the shared device this is
 * most used from.
 *
 * **This is single-session, and deliberately so.** `signOutEverywhere` is story
 * 12's ([#13](https://github.com/m0t0r/recomencemos/issues/13)); it arrives as a
 * second method on this interface rather than as a flag on this one, so that
 * ending *this* session can never become ending *every* session by way of a
 * default someone changed.
 */
export type SignOutOutcome =
  | { readonly ok: true; readonly setCookie: readonly string[] }
  | { readonly ok: false; readonly error: AppError };

export interface StartGoogleSignInInput {
  /** Her answer to _"este no es mi teléfono"_. */
  readonly sharedDevice: boolean;
  /** Where to land afterwards. Validated — see `#auth/return-path`. */
  readonly returnPath?: string | undefined;
  /** The caller's request headers, so Better Auth can read origin and IP. */
  readonly headers: Headers;
}

/**
 * What `startGoogleSignIn` answers.
 *
 * **`setCookie` is the half a caller must not drop.** Better Auth writes its
 * OAuth state cookie — and this package writes the shared-device cookie beside
 * it — onto the *response* of the call, which a Server Action does not
 * automatically return to the browser. So the header values come back here and
 * `apps/web` is responsible for putting them on its own response. A caller that
 * redirects to `url` without writing these gets a `state_mismatch` from the
 * provider's callback, which is the failure this field exists to prevent.
 *
 * Returned rather than written through Better Auth's `nextCookies()` plugin on
 * purpose: that plugin reaches for `next/headers`, and this package takes no
 * dependency on the framework — `apps/web` binds it, the same way it binds the
 * request handler.
 */
export type StartGoogleSignInOutcome =
  | { readonly ok: true; readonly url: string; readonly setCookie: readonly string[] }
  | { readonly ok: false; readonly error: AppError };

/**
 * What `signOutEverywhere` answers.
 *
 * **`revoked` is a count and the API contract says `{ ok }`.** The extra field
 * is deliberate: `/account`'s success state quotes the number back at her —
 * _"Cerramos 2 sesiones"_ — which is voice guide Do 4, and a refusal she can
 * check is a refusal she can trust. It names no session, carries no token and
 * carries no device string, so it discloses nothing the caller did not already
 * have on screen.
 *
 * **A missing session is `ok: false`, not an empty success.** This method
 * authorizes independently, because Next compiles the action calling it to a
 * directly reachable POST endpoint and a page-level check never extends to it.
 */
export type SignOutEverywhereOutcome =
  | { readonly ok: true; readonly revoked: number }
  | { readonly ok: false; readonly error: AppError };

/**
 * The narrow interface `apps/web` holds.
 *
 * Deliberately eleven named methods rather than the Better Auth instance: a
 * route handler, a session read, one call per door in, three ways out, and the
 * Admin's doors. Anything a later story needs is a method added here on purpose,
 * which is a review conversation, rather than a capability that arrived because
 * the whole library was in scope.
 *
 * **The Admin's door is one method here and that is not the same as one
 * factor.** Her first factor is the ordinary magic link, so it is
 * `requestMagicLink` above and Better Auth's own verify endpoint — no method of
 * ours spends it, because there is nothing of ours to spend. What is left is the
 * second factor, below, which is the only call that can produce a session
 * `requireAdminSession` admits.
 *
 * **The three exits are three methods, not one with a flag**, and that is the
 * shape to keep. `signOut` (#80) ends *this* session; `signOutEverywhere` (#13)
 * ends every *other* one; `listSessions` is what makes the second an informed
 * act rather than a blind one. Collapsing the first two into a boolean would put
 * "end every session I have" one changed default away from "end this one".
 */
export interface AuthHandler {
  /**
   * Every `/api/auth/*` request. `apps/web` binds it to `GET` and `POST` — the
   * binding is Next's shape and stays in Next, so this package takes no
   * dependency on the framework.
   */
  readonly handler: (request: Request) => Promise<Response>;

  /** The current session and its Account, or `null`. Reads the request headers. */
  readonly getSession: (headers: Headers) => Promise<AuthSession | null>;

  /** The `requestMagicLink` Server Action's one call. */
  readonly requestMagicLink: (input: RequestMagicLinkInput) => Promise<RequestMagicLinkOutcome>;

  /**
   * The `startGoogleSignIn` Server Action's one call.
   *
   * **This method exists so that no browser has to hold an auth client.** It was
   * `better-auth/react`'s `signIn.social` on a Client Component until the
   * server-side rework; moving it here removed `createAuthClient`,
   * `@better-fetch/fetch`, `nanostores` and `defu` from the client graph, and
   * turned the shared-device header from a browser-facing wire contract into an
   * implementation detail of this package.
   */
  readonly startGoogleSignIn: (input: StartGoogleSignInInput) => Promise<StartGoogleSignInOutcome>;

  /**
   * End **this** session, on the server.
   *
   * Added by [#80](https://github.com/m0t0r/recomencemos/issues/80), which is
   * the ticket that first gave a person anywhere to press _Salir_. It is a
   * method on this interface rather than a native `<form>` POST to the mounted
   * `/api/auth/*` catch-all because the shell's Server Action has to authorize
   * independently first, and because the narrow interface is where a later
   * reader looks for the capability — a door that exists only as a URL is a door
   * nobody finds.
   *
   * **It revokes the row.** Better Auth deletes the session record, so a cookie
   * kept from before the call is refused rather than merely absent from the
   * browser that had it. That distinction is the whole point on a shared device:
   * `sign-out.integration.test.ts` replays the old cookie precisely because a
   * cookie-deletion-only implementation passes every other assertion.
   */
  readonly signOut: (input: SignOutInput) => Promise<SignOutOutcome>;

  /**
   * Every session of the caller's Account that has not expired, the caller's
   * own first. `null` where the caller has no session at all — which is a different
   * answer from an empty list and must not be conflated with one, because
   * `/account` redirects on the first and could not reach the second.
   *
   * **This does not go through Better Auth's `/list-sessions`**, and
   * `#auth/sessions` carries the two reasons: that endpoint's freshness gate
   * refuses the six-day-old session this surface exists to serve, and it returns
   * the row's `token`.
   */
  readonly listSessions: (headers: Headers) => Promise<readonly AccountSession[] | null>;

  /**
   * NFR13's revocation. Ends every session of the caller's Account **except the
   * one making the request**, and answers with how many it ended.
   *
   * **The current session survives on purpose.** NFR13 asks that a Worker end
   * all her sessions from any device she holds, and the pair of controls does
   * that — this one plus _salir_. Ending the session she is holding would revoke
   * the one session with no security value to revoke, cost her a fresh sign-in
   * on a connection she pays for, and destroy the feedback: ejected to
   * `/sign-in`, she cannot tell whether the action worked or whether she was
   * merely logged out. The argument is recorded at `.impeccable/briefs/account.md`.
   */
  readonly signOutEverywhere: (headers: Headers) => Promise<SignOutEverywhereOutcome>;

  /**
   * **The Admin's second factor: six digits, or one printed code.**
   *
   * **One method for both**, and unlike the credential door's version there is
   * no `kind` — the shape of what was typed picks the factor. The surface asks
   * for "your code" and does not make her classify her own credential, which is
   * also the only way a person whose phone is gone can use the same field.
   *
   * The challenge travels in `headers`, like every other cookie: this method
   * takes no Account id, because a caller that could name the Account it wanted
   * a session for would be the door.
   */
  readonly verifyAdminSignInCode: (input: AdminCodeInput) => Promise<AdminCodeSignInOutcome>;
}

export interface AdminCodeInput {
  /** Six digits, or one backup code. Trimmed by the door, not by the caller's schema. */
  readonly code: string;
  /** Carries the challenge cookie. Without it this call refuses, whatever the code. */
  readonly headers: Headers;
}

export type AdminCodeSignInOutcome =
  | { readonly ok: true; readonly setCookie: readonly string[] }
  | { readonly ok: false; readonly error: AppError };

/**
 * What a caller learns about a session, which is less than Better Auth returns.
 *
 * `token` is absent by construction: C28 classifies Session `secret`, and a
 * shape that carries the token is a shape from which the token reaches a log
 * line or an RSC payload by accident. `signInMethod` is here because NFR14's
 * `requireAdmin` is the reader that matters and it must not have to go looking.
 */
export interface AuthSession {
  readonly accountId: string;
  readonly email: string;
  readonly signInMethod: string;
  readonly expiresAt: Date;
  /**
   * The Admin grant, from the `user` row (#17).
   *
   * **It is not on its own an answer to "is this an Admin".** NFR14 makes that a
   * property of the session, so this field is one of the two halves
   * `requireAdminSession` in `@repo/domain/admin` reads — `signInMethod` above is
   * the other, and the grant without the method is exactly the magic-link hole
   * that requirement exists to close. It is published rather than kept private
   * because the shell has one legitimate use for it beyond authorization: whether
   * to offer the Admin a route into `/admin` at all.
   */
  readonly isAdmin: boolean;
}

/**
 * Build the handler.
 *
 * **The Better Auth instance is built lazily and memoised**, and both halves are
 * load-bearing rather than tuning. Memoised, because Better Auth resolves its
 * whole plugin and endpoint graph at construction and one process wants one of
 * those. Lazily, because building it needs the pooled connection — and
 * `#connection` carries `import "server-only"`, which throws under plain `node`.
 * A connection resolved at module scope would therefore make this subpath
 * unimportable from `apps/web/domain-boundary.test.ts`, which is the test whose
 * whole job is importing it.
 *
 * **`db` is optional here for the same reason it is required everywhere else in
 * this package.** ADR-0010 withholds `#connection`, so `apps/web` has no handle
 * to pass and must not need one; a test that has one passes it and never touches
 * the pooled path.
 */
let built: AuthHandler | undefined;

/**
 * Named through `AuthOptions` rather than left to `ReturnType<typeof
 * betterAuth>`, which widens to `Auth<BetterAuthOptions>` and drops the
 * magic-link plugin's endpoints — the same inference the options type exists to
 * protect. See `AuthOptions` in `#auth/config`.
 */
type AuthInstance = ReturnType<typeof betterAuth<AuthOptions>>;

export function createAuthHandler(dependencies: AuthDependencies): AuthHandler {
  if (built) return built;

  /**
   * **The database handle is memoised beside the instance, not re-derived.**
   * `listSessions` reads rows this package owns rather than going through Better
   * Auth's endpoint (see `#auth/sessions`), so it needs the same handle the
   * adapter was built over — resolving `#connection` a second time would open a
   * second pool against the cap DD2 sets at 10 per machine.
   */
  let instance: Promise<{ auth: AuthInstance; db: DomainDatabase }> | undefined;

  const resolve = () => {
    instance ??= (async () => {
      const db = dependencies.db ?? (await import("#connection")).db();
      return { auth: betterAuth(authOptions({ ...dependencies, db })), db };
    })();
    return instance;
  };

  /**
   * The caller's session, with the token — which {@link AuthSession}
   * deliberately withholds and both methods below genuinely need: one to mark a
   * row as the caller's own, the other to know which row to spare.
   *
   * It stays inside this closure, so the token has no path to a caller.
   */
  const currentSession = async (headers: Headers) => {
    const { auth, db } = await resolve();
    const result = await auth.api.getSession({ headers });
    if (!result) return null;
    return { auth, db, accountId: result.user.id, token: result.session.token };
  };

  built = {
    handler: async (request) => (await resolve()).auth.handler(request),

    async getSession(headers) {
      const { auth } = await resolve();
      const result = await auth.api.getSession({ headers });
      if (!result) return null;

      // Field by field from a whitelist, per ADR-0003's discipline: the token is
      // not copied, so no later field added to Better Auth's session type
      // reaches a caller by default.
      return {
        accountId: result.user.id,
        email: result.user.email,
        signInMethod: String((result.session as { signInMethod?: unknown }).signInMethod ?? ""),
        expiresAt: result.session.expiresAt,
        /**
         * **`=== true`, not a truthiness coercion.** This is one of the two
         * fields NFR14's gate reads, and every other value the column could
         * present — `undefined` from a Better Auth version that dropped the
         * additional field, a driver returning `"f"` as a string — must read as
         * *not* an Admin. A `Boolean(...)` cast would turn `"f"` into `true`.
         */
        isAdmin: (result.user as { isAdmin?: unknown }).isAdmin === true,
      };
    },

    async signOut({ headers }) {
      try {
        const { auth } = await resolve();

        /**
         * `returnHeaders` for the same reason `signInSocial` needs it: the
         * clearing `Set-Cookie` is written onto this endpoint's response, and
         * without asking for it the header is built and dropped.
         */
        const { headers: responseHeaders } = await auth.api.signOut({
          headers,
          returnHeaders: true,
        });

        /**
         * **Better Auth reports success even when the row survives, so the
         * revocation is confirmed here rather than assumed.**
         *
         * Read out of `better-auth@1.7.1/dist/api/routes/sign-out.mjs`, not
         * recalled: the endpoint carries **no middleware**, and its delete is
         *
         * ```js
         * if (sessionCookieToken) try {
         *   await ctx.context.internalAdapter.deleteSession(sessionCookieToken);
         * } catch (e) {
         *   ctx.context.logger.error("Failed to delete session from database", e);
         * }
         * deleteSessionCookie(ctx);
         * ```
         *
         * The `catch` logs and does not rethrow, and the cookie is cleared
         * either way. So a database fault mid-sign-out returns `{success:
         * true}` with the session row still live — which is Better Auth
         * degrading to **exactly cookie deletion alone**, the one thing AC 2 of
         * [#80](https://github.com/m0t0r/recomencemos/issues/80) forbids. The
         * browser looks signed out; anyone holding the cookie is not.
         *
         * That matters most in the case this method exists for: a Worker on a
         * borrowed phone, told she is out, handing back a device that is still
         * hers to anyone who kept the cookie.
         *
         * **This read is authoritative because DD5 disables the session cookie
         * cache** (NFR13: _"Any session cookie cache is off, or every revocation
         * here … lags by its TTL"_). With it on, this check would read the same
         * stale cache the revocation was supposed to invalidate and would agree
         * with a lie.
         */
        if (await auth.api.getSession({ headers })) {
          throw new Error(
            "better-auth reported a successful sign-out but the session is still resolvable; " +
              "its deleteSession failure is logged and swallowed, so the row survived",
          );
        }

        return { ok: true, setCookie: responseHeaders.getSetCookie() };
      } catch (cause) {
        return {
          ok: false,
          error: new AppError({
            code: "sign_out_failed",
            status: 502,
            message:
              "Revoking the session failed, so the session row is still live and the caller's " +
              "cookie still works. The surface says so rather than showing her signed out, " +
              "because on a shared device an optimistic sign-out is the failure that matters.",
            userMessage: SIGN_OUT_FAILED,
            // No cookie, no token, no address — NFR18. There is nothing to
            // identify here that is not a credential, so the context is empty
            // rather than padded with something that looks like evidence.
            cause,
          }),
        };
      }
    },

    async requestMagicLink({ email, sharedDevice, returnPath, headers }) {
      try {
        const { auth } = await resolve();

        await auth.api.signInMagicLink({
          body: {
            email,
            callbackURL: safeReturnPath(returnPath),
            /**
             * **Without this the consumed-link state is unreachable.** Better
             * Auth's verify endpoint redirects failures to `errorCallbackURL`
             * and falls back to `callbackURL` — which is where she was *going*,
             * normally `/`. So an expired or already-consumed link would land on
             * the Wall carrying `?error=INVALID_TOKEN`, a parameter only
             * `/sign-in` reads, and the copy offering her an immediate resend
             * would be rendered by code nothing reaches.
             *
             * DD5 is explicit that this case is ordinary rather than exotic: a
             * `GET` verify URL is fetched by corporate link scanners, WhatsApp
             * previews and Outlook Safe Links, and a single-use token consumed by
             * a scanner locks a Worker out with no password to fall back on.
             */
            errorCallbackURL: SIGN_IN_PATH,
            // Read by the `before` middleware and written onto the verification
            // row. `/sign-in/magic-link` is the one endpoint whose body keeps a
            // field open for this.
            metadata: { sharedDevice },
          },
          headers,
        });

        return { ok: true };
      } catch (cause) {
        return {
          ok: false,
          error: new AppError({
            code: "magic_link_send_failed",
            status: 502,
            message:
              "Requesting a magic link failed before the mail was accepted. This is reported " +
              "rather than swallowed because it happens identically for an address that has " +
              "an Account and one that does not, so it discloses nothing about the address.",
            userMessage: SIGN_IN_FAILED,
            // No address, no token, no URL — NFR18. `snake_case` on the line,
            // whatever the source calls it (ADR-0005).
            context: { shared_device: sharedDevice },
            cause,
          }),
        };
      }
    },

    async startGoogleSignIn({ sharedDevice, returnPath, headers }) {
      try {
        const { auth } = await resolve();

        /**
         * **The shared-device answer is set on the headers here, by us.**
         *
         * `/sign-in/social`'s request body is a closed Zod schema that strips
         * unknown keys, so there is no field to put this in — which is why the
         * carrier is a header at all. What changed with the server-side rework
         * is *who sets it*: the browser used to, which made the spelling a wire
         * contract `apps/web` had to pin with a test. Now this package sets it
         * on a request this package makes, so it is an internal detail of the
         * hop between here and `#auth/config`'s `before` middleware, and no
         * caller can supply it.
         */
        const forwarded = new Headers(headers);
        forwarded.set(SHARED_DEVICE_HEADER, sharedDevice ? "1" : "0");

        /**
         * `returnHeaders` is what makes this callable from a Server Action at
         * all. Better Auth's OAuth state cookie and the shared-device cookie the
         * `before` middleware sets are both written onto the endpoint's response
         * headers; without asking for them they are built and dropped, and the
         * provider's callback then fails on a state it never received.
         */
        const { headers: responseHeaders, response } = await auth.api.signInSocial({
          body: {
            provider: "google",
            callbackURL: safeReturnPath(returnPath),
            /**
             * The same reasoning as the magic link's: a refused or abandoned
             * Google sign-in must land back on `/sign-in`, which is the one
             * surface that reads `?error=` and can offer her the other door.
             */
            errorCallbackURL: SIGN_IN_PATH,
          },
          headers: forwarded,
          returnHeaders: true,
        });

        /**
         * `signInSocial` has two branches and only one of them is ours: the
         * `idToken` branch returns a session and no `url`. This product has no
         * id-token path, so a missing `url` is a configuration fault rather than
         * an alternative to handle — and failing loudly here beats redirecting a
         * Worker to `undefined`.
         */
        if (!response.url) {
          throw new Error("signInSocial returned no authorization URL for the google provider");
        }

        return {
          ok: true,
          url: response.url,
          setCookie: responseHeaders.getSetCookie(),
        };
      } catch (cause) {
        return {
          ok: false,
          error: new AppError({
            code: "google_sign_in_start_failed",
            status: 502,
            message:
              "Starting the Google sign-in flow failed before the Worker could be redirected to " +
              "the provider. Nothing was created and no session exists; the surface offers her " +
              "the email door, which does not depend on this provider being reachable.",
            userMessage: SIGN_IN_FAILED,
            // No address and no URL — the authorization URL carries the state
            // token, which is a credential (NFR18).
            context: { shared_device: sharedDevice },
            cause,
          }),
        };
      }
    },

    async verifyAdminSignInCode({ code, headers }) {
      try {
        const { auth } = await resolve();

        /**
         * `returnHeaders` is what makes this callable from a Server Action at
         * all — the session cookie is written onto the endpoint's response, and
         * without asking for it the session row exists and no browser holds it.
         */
        const { headers: responseHeaders } = await auth.api.verifyAdminSignInCode({
          body: { code },
          headers,
          returnHeaders: true,
        });

        return { ok: true, setCookie: responseHeaders.getSetCookie() };
      } catch (cause) {
        /**
         * **Only the endpoint's own refusal becomes a returned error.** Anything
         * else is a fault — the database unreachable, or the endpoint's own
         * `throw` for an Account that vanished mid-request — and CLAUDE.md's
         * "thrown is reported; returned is logged" makes that the difference
         * between one Sentry event and none.
         *
         * A bare `catch` here swallowed both into `admin_code_refused`, so the
         * one failure worth paging on rendered to the Admin as a wrong code and
         * left nothing behind. The credential door's two refusals above still
         * catch broadly; they go with the door.
         */
        if (!(cause instanceof APIError)) throw cause;

        return { ok: false, error: adminCodeRefusal(cause) };
      }
    },

    async listSessions(headers) {
      const current = await currentSession(headers);
      if (!current) return null;

      return listAccountSessions(current.db, {
        accountId: current.accountId,
        currentToken: current.token,
        // Taken here rather than inside the query, so the expiry boundary is one
        // instant for the whole list rather than one per row.
        now: new Date(),
      });
    },

    async signOutEverywhere(headers) {
      const current = await currentSession(headers);

      if (!current) {
        return {
          ok: false,
          error: new AppError({
            code: "session_required",
            status: 401,
            message:
              "signOutEverywhere was called with no session. The action authorizes " +
              "independently rather than trusting the page that rendered the form, so this " +
              "is the ordinary answer to an expired or already-revoked cookie — not an " +
              "attack signal on its own.",
            userMessage: SESSION_REQUIRED,
            // No account id: there is no session, so there is nothing to name.
            context: {},
          }),
        };
      }

      try {
        const others = async () =>
          (
            await listAccountSessions(current.db, {
              accountId: current.accountId,
              currentToken: current.token,
              now: new Date(),
            })
          ).filter((session) => !session.current).length;

        const before = await others();

        /**
         * Better Auth's own endpoint rather than a `DELETE` written here, and
         * the difference matters for one reason: `internalAdapter.deleteSession`
         * is what a secondary session store would be wired behind. This product
         * has none today, so the two are equivalent today — and the day one is
         * added, a hand-written delete is the thing that silently stops working.
         *
         * It sits behind `sensitiveSessionMiddleware`, which re-reads the
         * session authoritatively with the cookie cache disabled. DD5 has that
         * cache off, so **there is no cache in front of this and the revocation
         * lag is zero** rather than bounded by a TTL.
         */
        await current.auth.api.revokeOtherSessions({ headers });

        /**
         * **The rows are read back, and the count is the difference rather than
         * a prediction.** Two reasons, and the second is why this is not
         * belt-and-braces:
         *
         * - A count taken only before the call is a **forecast**. What she is
         *   told — _"Cerramos 2 sesiones"_ — should be an observation, and
         *   `/revoke-other-sessions` answers `{ status: true }` with no number of
         *   its own.
         * - **A library's success is not evidence that the rows are gone.**
         *   Better Auth's `/sign-out` is the worked example of the failure this
         *   guards against: it catches a database fault, logs it, clears the
         *   cookie and still answers success, so the browser looks signed out
         *   while the session lives (found on #80, in
         *   `dist/api/routes/sign-out.mjs`). `/revoke-other-sessions` has no such
         *   catch at 1.7.1 — its deletes run under `Promise.all` and a rejection
         *   propagates — but it is one upgrade away from acquiring one, and this
         *   is the endpoint where that would matter most. What makes the re-read
         *   authoritative rather than theatre is that the cookie cache is off.
         *
         * `Promise.all` also means a **partial** failure is possible: some rows
         * deleted, then a rejection. That path throws into the `catch` below,
         * where the copy must not claim they are all still open.
         */
        const after = await others();

        if (after > 0) {
          throw new Error(
            `revokeOtherSessions reported success but ${after} of ${before} other sessions ` +
              "are still readable",
          );
        }

        return { ok: true, revoked: before - after };
      } catch (cause) {
        return {
          ok: false,
          error: new AppError({
            code: "sign_out_everywhere_failed",
            status: 502,
            message:
              "Revoking the Account's other sessions failed. They are still open, which is " +
              "what the user-facing copy says — a Worker closing a session on a machine she " +
              "no longer controls must not be left assuming it worked.",
            userMessage: SIGN_OUT_EVERYWHERE_FAILED,
            // An id and a count. No token, no device string, no address (NFR18).
            context: { account_id: current.accountId },
            cause,
          }),
        };
      }
    },
  };

  return built;
}

export { googleSignInAvailable, MAGIC_LINK_TTL_MINUTES };
export type { AuthDependencies, MagicLinkRequest, AuthLogger, AuthEnv } from "#auth/config";
export type { AccountSession } from "#auth/sessions";
export { DEFAULT_RETURN_PATH, safeReturnPath } from "#auth/return-path";
/**
 * **`SHARED_DEVICE_HEADER` is deliberately no longer exported.** It was
 * published so `apps/web` had something to pin the browser's spelling against,
 * back when the browser set it. `startGoogleSignIn` sets it now, on a request
 * this package makes to itself, so there is no second speller and nothing to
 * keep in agreement — `apps/web/app/sign-in/shared-device-header.ts` and
 * its test were deleted with the export.
 */

/**
 * What the Admin is told when the passwordless door refuses her code.
 *
 * **Two outcomes and no third**, which is the whole of what this door may
 * disclose. A wrong code, a challenge that has expired, a challenge that was
 * never signed by us, a grant that has been taken away and an Account with no
 * second factor are one sentence; the ceiling is the other, and it is separate
 * only because a person who is locked out for fifteen minutes needs to be told
 * so rather than left retyping a code that cannot work.
 *
 * **The ceiling's sentence comes back over the wire rather than being rebuilt
 * here**, because it carries her count and her wait — `CEILING_REFUSALS` built
 * it with the numbers the charge actually returned, and a copy assembled a
 * second time from this side would be a second place those numbers live.
 *
 * The operator half names neither, for the reason the reply does not: this
 * function cannot see which it was without asking the endpoint to tell it, and
 * an endpoint that told it would be an endpoint that could tell anyone.
 */
function adminCodeRefusal(cause: unknown): AppError {
  const body = (cause as { body?: { code?: unknown; message?: unknown } } | null)?.body;
  const limited = body?.code === ADMIN_CODE_RATE_LIMITED_CODE;

  return new AppError({
    code: limited ? "admin_code_rate_limited" : "admin_code_refused",
    status: limited ? 429 : 401,
    message: limited
      ? "The Admin door refused a code because the Account has spent one of its two ceilings. " +
        "Which ceiling and how much of it is left are on the door's own warn line; this one is " +
        "the surface's half."
      : "The Admin door refused a code. Whether it was the six digits, a printed code, an " +
        "expired challenge, a challenge this product never signed, or an Account that no " +
        "longer holds the grant is not distinguished — a reply that differed would be a way " +
        "to ask this endpoint questions about an Account nobody signed in to.",
    userMessage:
      limited && typeof body?.message === "string" ? body.message : ADMIN_SECOND_FACTOR_REFUSED,
    // No code, no challenge, no Account id. The code is a credential for the
    // seconds it is live and the challenge is the whole of factor one (NFR18,
    // C28); the door's own line carries the Account id, which is where an
    // operator correlating this pair looks.
    context: {},
    cause,
  });
}
