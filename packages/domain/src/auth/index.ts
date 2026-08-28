/**
 * `@repo/domain/auth-handler` — the only door `apps/web` has onto Better Auth.
 *
 * **The Better Auth instance never leaves this package**, which is what
 * `## Modules and workspaces` means by _"not exported, therefore unreachable
 * from `apps/web`: the Drizzle schema, the connection, and the Better Auth
 * instance"_. What escapes is the four things a Next.js app actually needs —
 * a request handler, a session read, and the one call each of the two doors
 * makes — so the boundary is a **narrower interface**, not a re-export wearing a
 * different name. `apps/web/domain-boundary.test.ts` asserts both halves against
 * Node's own resolver.
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
import {
  type AuthDependencies,
  type AuthOptions,
  authOptions,
  googleSignInAvailable,
  MAGIC_LINK_TTL_MINUTES,
} from "#auth/config";
import { safeReturnPath } from "#auth/return-path";
import { SHARED_DEVICE_HEADER } from "#auth/sign-in-attempt";
import { SIGN_IN_FAILED } from "#user-messages";

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
 * The narrow interface `apps/web` holds.
 *
 * Deliberately three methods rather than the Better Auth instance: a route
 * handler, a session read, and one action. Anything a later story needs is a
 * method added here on purpose, which is a review conversation, rather than a
 * capability that arrived because the whole library was in scope.
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
}

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

  let instance: Promise<AuthInstance> | undefined;

  const resolve = () => {
    instance ??= (async () => {
      const db = dependencies.db ?? (await import("#connection")).db();
      return betterAuth(authOptions({ ...dependencies, db }));
    })();
    return instance;
  };

  built = {
    handler: async (request) => (await resolve()).handler(request),

    async getSession(headers) {
      const auth = await resolve();
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
      };
    },

    async requestMagicLink({ email, sharedDevice, returnPath, headers }) {
      try {
        const auth = await resolve();

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
        const auth = await resolve();

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
  };

  return built;
}

export { googleSignInAvailable, MAGIC_LINK_TTL_MINUTES };
export type { AuthDependencies, MagicLinkRequest, AuthLogger, AuthEnv } from "#auth/config";
export { DEFAULT_RETURN_PATH, safeReturnPath } from "#auth/return-path";
/**
 * **`SHARED_DEVICE_HEADER` is deliberately no longer exported.** It was
 * published so `apps/web` had something to pin the browser's spelling against,
 * back when the browser set it. `startGoogleSignIn` sets it now, on a request
 * this package makes to itself, so there is no second speller and nothing to
 * keep in agreement — `apps/web/app/(auth)/sign-in/shared-device-header.ts` and
 * its test were deleted with the export.
 */
