/**
 * `@repo/domain/auth-handler` — the only door `apps/web` has onto Better Auth.
 *
 * **The Better Auth instance never leaves this package**, which is what
 * `## Modules and workspaces` means by _"not exported, therefore unreachable
 * from `apps/web`: the Drizzle schema, the connection, and the Better Auth
 * instance"_. What escapes is the three things a Next.js app actually needs —
 * a request handler, a session read, and the one call `requestMagicLink` makes —
 * so the boundary is a **narrower interface**, not a re-export wearing a
 * different name. `apps/web/domain-boundary.test.ts` asserts both halves against
 * Node's own resolver.
 *
 * **`better-auth/react` is `apps/web`'s own dependency and is imported there
 * directly** (DD5). That is what removes the draft's contradiction of a
 * server-only package carrying a browser-reachable subpath: nothing here is
 * client-safe and nothing here needs to be.
 */

import { AppError } from "@repo/errors/app-error";
import { betterAuth } from "better-auth";
import {
  type AuthDependencies,
  authOptions,
  googleSignInAvailable,
  MAGIC_LINK_TTL_MINUTES,
} from "#auth/config";
import { safeReturnPath } from "#auth/return-path";
import { SIGN_IN_FAILED } from "#user-messages";

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
 * Build the handler. **Memoised on first call**, because Better Auth opens no
 * connection at construction but does resolve its whole plugin and endpoint
 * graph, and one process wants one of those.
 */
let built: AuthHandler | undefined;

export function createAuthHandler(dependencies: AuthDependencies): AuthHandler {
  if (built) return built;

  const auth = betterAuth(authOptions(dependencies));

  built = {
    handler: (request) => auth.handler(request),

    async getSession(headers) {
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
        await auth.api.signInMagicLink({
          body: {
            email,
            callbackURL: safeReturnPath(returnPath),
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
            // No address, no token, no URL — NFR18.
            context: { sharedDevice },
            cause,
          }),
        };
      }
    },
  };

  return built;
}

/**
 * Forget the memoised handler. For a test with a lifecycle, mirroring
 * `closeDatabase` in `#connection`. A request path never calls it.
 */
export function resetAuthHandler(): void {
  built = undefined;
}

export { googleSignInAvailable, MAGIC_LINK_TTL_MINUTES };
export type { AuthDependencies, MagicLinkRequest, AuthLogger, AuthEnv } from "#auth/config";
export { DEFAULT_RETURN_PATH, safeReturnPath } from "#auth/return-path";
