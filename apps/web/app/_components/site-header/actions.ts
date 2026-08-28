"use server";

/**
 * Ending a session, as a Server Action.
 *
 * **It authorizes independently**, which on this action means a real check
 * rather than the "no principal to check" the sign-in doors get: it reads the
 * session before it does anything, and an anonymous caller reaches no domain
 * call at all. Next compiles every Server Action to a directly reachable POST
 * endpoint, so the header only rendering _Salir_ for a signed-in person is not
 * an authorization — this is.
 *
 * **The refusal for an anonymous caller is a redirect to `/`, not an error**,
 * and that is a deliberate reading of "refuse" rather than a softening of it.
 * Ending a session you do not have is idempotent: there is nothing to revoke,
 * nothing is disclosed either way, and the state she asked for is the state she
 * is already in. The case is real — a session can expire between the render that
 * drew the button and the tap that pressed it — and answering it with an error
 * would tell a person who is *already signed out* that signing out failed.
 *
 * **`.stateAction()`, so the form works before hydration.** next-safe-action's
 * form guide marks `useAction` and `useStateAction` as not working without
 * JavaScript; `useActionState` over a real server-action reference is what lets
 * React emit the no-JS form encoding. That is the whole mechanism behind the
 * `<noscript>` fallback in `site-header.tsx` — the fallback is a second
 * *trigger* on this one form, never a second sign-out path.
 */

import { projectClientError } from "@repo/errors/app-error";
import { logRequestError } from "@repo/observability/log-request-error";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { actionClient, returnActionError } from "@/lib/safe-action";
import { parseSetCookie } from "@/lib/set-cookie";

/**
 * Where a signed-out person lands. The Wall — public, and the one page that
 * makes sense to be on having just left.
 */
const SIGNED_OUT_PATH = "/";

export const signOut = actionClient.stateAction(async () => {
  const requestHeaders = await headers();
  const handler = auth();

  // The independent authorization. See the note above for why its refusal is a
  // redirect rather than an error.
  const session = await handler.getSession(requestHeaders);
  if (!session) redirect(SIGNED_OUT_PATH);

  const outcome = await handler.signOut({ headers: requestHeaders });

  if (!outcome.ok) {
    /**
     * Returned rather than thrown — one `warn` line, no Sentry event — and she
     * stays where she is holding a session that is still live, which is what
     * `SIGN_OUT_FAILED` tells her in those words. Redirecting her to `/` on a
     * failed revocation would show her a signed-out shell over a session that
     * was never revoked, which is the one lie this surface must not tell.
     */
    logRequestError(outcome.error, { level: "warn" });
    return returnActionError(projectClientError(outcome.error));
  }

  const cookieStore = await cookies();

  /**
   * **The clearing cookies, or the browser keeps a dead one.** Better Auth
   * writes them onto the response of a call `@repo/domain` makes internally, so
   * they reach the browser only if this loop puts them there. The row is already
   * gone at this point, so skipping them is not a session left open — it is a
   * browser sending a credential that no longer resolves, on every request, for
   * as long as the cookie's own expiry.
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
  redirect(SIGNED_OUT_PATH);
});
