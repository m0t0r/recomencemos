import "server-only";

/**
 * Ending the caller's own session, once, for both shells.
 *
 * **It is here because there are two callers, not because sharing is tidy.** The
 * body lived inside the site header's `signOut` while the header was the only way
 * out of the product; `/admin` has its own chrome (#17) and therefore its own
 * _Salir_, and the two differ in exactly one thing — where a person lands
 * afterwards. Copying thirty lines to change one of them would put the independent
 * authorization, the revocation and the cookie clearing in two places, and those
 * are the three things that must not drift.
 *
 * **It authorizes independently**, which on this path means a real check rather
 * than the "no principal to check" the sign-in doors get: it reads the session
 * before it does anything, and an anonymous caller reaches no domain call at all.
 * Next compiles every Server Action to a directly reachable POST endpoint, so a
 * shell only rendering _Salir_ for a signed-in person is not an authorization —
 * this is.
 *
 * **The refusal for an anonymous caller is a redirect, not an error**, and that is
 * a deliberate reading of "refuse" rather than a softening of it. Ending a session
 * you do not have is idempotent: there is nothing to revoke, nothing is disclosed
 * either way, and the state she asked for is the state she is already in. The case
 * is real — a session can expire between the render that drew the button and the
 * tap that pressed it — and answering it with an error would tell a person who is
 * *already signed out* that signing out failed.
 *
 * **It never returns.** Every path ends in a `redirect` or in `returnActionError`,
 * both of which throw, so a caller writes `return endSession(path)` and has
 * nothing left to handle. That is what keeps the two call sites down to the one
 * thing that genuinely differs between them.
 */

import { projectClientError } from "@repo/errors/app-error";
import { logRequestError } from "@repo/observability/log-request-error";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { returnActionError } from "@/lib/safe-action";
import { parseSetCookie } from "@/lib/set-cookie";

/**
 * @param destination where to land once the session is gone. A route this app
 *   owns, never a value anything typed — the two callers pass a literal, and a
 *   parameter that could carry one would be an open redirect wearing a helper's
 *   name.
 */
export async function endSession(destination: string): Promise<never> {
  const requestHeaders = await headers();
  const handler = auth();

  // The independent authorization. See above for why its refusal is a redirect
  // rather than an error.
  const session = await handler.getSession(requestHeaders);
  if (!session) redirect(destination);

  const outcome = await handler.signOut({ headers: requestHeaders });

  if (!outcome.ok) {
    /**
     * Returned rather than thrown — one `warn` line, no Sentry event — and she
     * stays where she is holding a session that is still live, which is what
     * `SIGN_OUT_FAILED` tells her in those words. Redirecting on a failed
     * revocation would show a signed-out shell over a session that was never
     * revoked, which is the one lie this path must not tell.
     */
    logRequestError(outcome.error, { level: "warn" });
    return returnActionError(projectClientError(outcome.error));
  }

  const cookieStore = await cookies();

  /**
   * **The clearing cookies, or the browser keeps a dead one.** Better Auth writes
   * them onto the response of a call `@repo/domain` makes internally, so they
   * reach the browser only if this loop puts them there. The row is already gone
   * at this point, so skipping them is not a session left open — it is a browser
   * sending a credential that no longer resolves, on every request, for as long
   * as the cookie's own expiry.
   */
  for (const line of outcome.setCookie) {
    const cookie = parseSetCookie(line);
    if (cookie) cookieStore.set(cookie);
  }

  /**
   * `redirect` throws a framework error, which next-safe-action re-throws rather
   * than routing through `handleServerError`. Nothing after it runs, and the
   * navigation is what renders the signed-out shell.
   */
  redirect(destination);
}
