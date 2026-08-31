/**
 * The Admin's second factor, as one Better Auth endpoint.
 *
 * **A plugin rather than a function, and that is the decision this file exists
 * to record.** Everything the door needs to *decide* is in `#admin/door`, which
 * is pure query code at seam 2; what is left is minting the session, and that
 * cannot be done from outside an endpoint without re-implementing two things the
 * library already owns.
 *
 * - **The session cookie's format.** `setSessionCookie` signs it and applies the
 *   configured prefix, `sameSite`, `secure` and expiry. A hand-written cookie
 *   would agree with Better Auth until the first version that changed any of
 *   them, and the failure would be a session nobody can read back.
 * - **The one place a session row is born.** `databaseHooks.session.create.before`
 *   applies NFR13's lifetime, NFR14's stamp and the refusal of every door that is
 *   not this one for an Admin-granted Account, and it reads `context.path` to know which
 *   door it is answering for. An `INSERT` written here would have to restate all
 *   three, and the first one to drift would drift silently. Running inside an
 *   endpoint means the hook sees a real path and does its job unchanged — the
 *   path below is a row in `SIGN_IN_PATHS`, and that row is what makes this the
 *   only door in the product that produces a `link_totp` session.
 *
 * **The endpoint is mounted under `/api/auth/*` like every other, and it is
 * guarded by the challenge rather than by being hard to find.** It does nothing
 * at all without a live challenge cookie — which only opening a single-use link
 * sent to the Account's own mailbox can produce — and every attempt is charged
 * against an NFR26 ceiling scoped to that Account.
 *
 * **Its path names no route and says no "admin".** Anyone may reach it and
 * nobody may learn anything from it; a path called `/admin/...` would be a sign
 * saying which product has an operator and where its door is, on a design whose
 * whole point is that the door has no page to find.
 */

import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import {
  readSignInChallenge,
  SIGN_IN_CHALLENGE_COOKIE,
  SIGN_IN_CHALLENGE_COOKIE_ATTRIBUTES,
} from "#admin/challenge";
import { verifyAdminCode } from "#admin/door";
import type { AuthLogger } from "#auth/config";
import { ADMIN_SECOND_FACTOR_PATH } from "#auth/sign-in-attempt";
import type { DomainDatabase } from "#database";
import { ADMIN_SECOND_FACTOR_REFUSED } from "#user-messages";

/** What the caller is told, and the only two things it may be told apart on. */
export const ADMIN_CODE_REFUSED_CODE = "ADMIN_CODE_REFUSED";
export const ADMIN_CODE_RATE_LIMITED_CODE = "ADMIN_CODE_RATE_LIMITED";

export interface AdminDoorDependencies {
  readonly db: DomainDatabase;
  /** `BETTER_AUTH_SECRET`: it verifies the challenge and decrypts the factor. */
  readonly key: string;
  readonly logger: AuthLogger;
  /**
   * Whether this origin's cookies carry `Secure`. Passed in from the one place
   * that decides it, so the header that clears the challenge matches the header
   * that set it — `clearSignInChallengeCookie` records why that is a dependency
   * and not a read.
   */
  readonly secure: boolean;
}

/**
 * The plugin.
 *
 * Typed loosely on purpose: Better Auth's `BetterAuthPlugin` is generic over the
 * endpoint record it declares, and naming that type here would restate the
 * library's inference rather than constrain anything. `AuthOptions` in
 * `#auth/config` is where the tuple is pinned, which is the place that inference
 * actually has to survive.
 */
export function adminDoor({ db, key, logger, secure }: AdminDoorDependencies) {
  return {
    id: "recomencemos-admin-door",

    endpoints: {
      /**
       * Six digits from the authenticator, or one of the ten printed codes,
       * against the Account the challenge names.
       *
       * **The challenge is read from the request rather than taken as an
       * argument**, which is what makes this endpoint safe to expose: a caller
       * cannot name the Account it wants a session for, only present a cookie
       * that names one — and only this product's key can produce one of those.
       */
      verifyAdminSignInCode: createAuthEndpoint(
        ADMIN_SECOND_FACTOR_PATH,
        {
          method: "POST",
          /**
           * **The body's shape is declared and not validated, and the two are
           * different things on purpose.** `$Infer` is `better-call`'s type-only
           * carrier: it tells `auth.api.verifyAdminSignInCode` what to accept
           * and adds no runtime check, which is what lets this package declare
           * an endpoint body without taking a validation library as a runtime
           * dependency for one field.
           *
           * The check that matters is below, and it has to be there regardless:
           * this endpoint is mounted on the public `/api/auth/*` catch-all, so
           * *anyone* may post *anything* at it and a type is a claim about
           * callers who compiled against it.
           */
          metadata: { $Infer: { body: {} as { code: string } } },
        },
        async (ctx) => {
          /**
           * Read defensively, because the declaration above is not a parse. A
           * missing or non-string `code` becomes the empty string and takes the
           * same path a wrong code takes — there is no separate "malformed
           * request" answer, because a caller who could tell the two apart could
           * ask this endpoint whether a challenge was live.
           */
          const body: unknown = ctx.body;
          const typed =
            typeof body === "object" && body !== null && "code" in body
              ? (body as { code?: unknown }).code
              : undefined;
          const code = typeof typed === "string" ? typed : "";

          const accountId = readSignInChallenge(ctx.getCookie(SIGN_IN_CHALLENGE_COOKIE), key);

          /**
           * **No challenge and a wrong code are the same answer**, and this is
           * the first place that has to be true. A distinct reply for "your
           * challenge expired" would tell somebody replaying a captured cookie
           * exactly what they had, and would tell an attacker with neither that
           * the endpoint is worth guessing codes at.
           */
          if (!accountId) throw refusal();

          const outcome = await verifyAdminCode(db, { accountId, code, key });

          if (!outcome.ok) {
            /**
             * The operator half, returned by the door and emitted here — one
             * `warn` line and no Sentry event, which is CLAUDE.md's "thrown is
             * reported; returned is logged" applied at the boundary that has a
             * logger. An id and an enum value, and nothing that is a credential
             * or a code (NFR18).
             */
            logger.warn(
              {
                event: "admin.second_factor_refused",
                account_id: accountId,
                second_factor: outcome.shape,
                refused: outcome.refused,
              },
              outcome.refused === "rate_limited"
                ? outcome.error.message
                : "An Admin second factor was refused. The reply says only that the code was " +
                    "wrong: which factor it checked, whether the Account still holds the grant " +
                    "and how many attempts remain are all things a caller may not learn.",
            );

            if (outcome.refused === "rate_limited") {
              throw new APIError(429, {
                code: ADMIN_CODE_RATE_LIMITED_CODE,
                /**
                 * The ceiling's own sentence, which names the wait. It is the
                 * `userMessage` half of the refusal the door built, so what
                 * crosses here is already the string a person may read.
                 */
                message: outcome.error.userMessage,
                retryAfter: outcome.retryAfter,
              });
            }

            throw refusal();
          }

          /**
           * **`false` for `dontRememberMe`, and the flag is not the mechanism.**
           * It would give a one-day session; NFR13 gives this account eight
           * hours, non-rolling, and `session.create.before` writes that on the
           * row whatever is passed here. Passing `false` keeps this call from
           * asserting a lifetime it does not own.
           */
          const session = await ctx.context.internalAdapter.createSession(accountId, false);
          const user = await ctx.context.internalAdapter.findUserById(accountId);

          if (!user) {
            throw new Error(
              "a session was created for an Account that no longer exists; the second factor " +
                "was verified against rows that were deleted mid-request",
            );
          }

          await setSessionCookie(ctx, { session, user });

          /**
           * **The challenge is cleared on success, which is hygiene and not
           * revocation** — and the difference is worth stating precisely, because
           * an earlier version of this comment claimed the stronger thing.
           *
           * The value is signed rather than stored, so nothing here can
           * invalidate it: it stays cryptographically valid for the rest of its
           * ten minutes and this header is a request to one browser to stop
           * sending it. What bounds the exposure is the window, not this line.
           *
           * The consequence for the surface above: it must write **every**
           * `Set-Cookie` this method hands back, not merely the session one. A
           * caller that forwards the session and drops this leaves a live
           * challenge in the browser it just signed in.
           *
           * **`ctx.setCookie` and not `ctx.setHeader`.** `setHeader` replaces,
           * so clearing that way discarded the session cookie `setSessionCookie`
           * had written one line above — the door minted a session and handed
           * the browser nothing to hold it with. The assertion in this file that
           * the reply carries a session token is what caught it.
           *
           * The attributes and `secure` both come from `#admin/challenge`, which
           * is the module that set them; that comment records what deriving
           * `secure` from a second source cost.
           */
          ctx.setCookie(SIGN_IN_CHALLENGE_COOKIE, "", {
            ...SIGN_IN_CHALLENGE_COOKIE_ATTRIBUTES,
            maxAge: 0,
            secure,
          });

          return ctx.json({ status: true });
        },
      ),
    },
  };
}

/**
 * The one refusal, built in one place so the three paths that reach it cannot
 * drift into three different sentences.
 *
 * **401 and not 403.** There is no principal here to refuse: what is missing is
 * a factor, which is exactly what 401 means.
 */
function refusal(): APIError {
  return new APIError(401, {
    code: ADMIN_CODE_REFUSED_CODE,
    message: ADMIN_SECOND_FACTOR_REFUSED,
  });
}
