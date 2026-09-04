"use server";

/**
 * The second factor, as one Server Action.
 *
 * **It authorizes for itself, and here that means the challenge rather than a
 * principal.** Next compiles this to a directly reachable POST endpoint, so the
 * page that rendered the form guards nothing: anyone may post anything at this
 * URL. What stands in front of it is the cookie — `verifyAdminSignInCode` reads
 * the challenge off the request headers rather than taking an Account id, so a
 * caller cannot name the Account it wants a session for, only present a value
 * only this product's key can produce. A caller with no challenge and a caller
 * with a wrong code get the same refusal, which is what stops this endpoint
 * answering questions about Accounts nobody signed in to.
 *
 * **The ceilings are the door's, not this client's.** NFR26's two rows for the
 * Admin's factors are charged inside `@repo/domain` against the **Account** the
 * challenge names, before the grant or the factor is read. A `rateLimit`
 * middleware here could only charge an IP — which DD5 says outright is not a
 * substitute, because six digits against an attacker who can rotate addresses
 * is a matter of hours — and it would charge it before the challenge had been
 * looked at, so an anonymous caller could spend a real Admin's budget.
 *
 * **`.stateAction()`, so the door works before hydration.** Auto-submit is an
 * accelerator; the button is the mechanism, and next-safe-action's own form
 * guide marks `useAction` and `useStateAction` as not working without
 * JavaScript. See the note in `lib/safe-action.ts`.
 *
 * **It takes no bound argument and no hidden input.** There is nothing to carry:
 * where this lands is fixed, and where it came from is a cookie.
 */

import { projectClientError } from "@repo/errors/app-error";
import { logRequestError } from "@repo/observability/log-request-error";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { actionClient, returnActionError } from "@/lib/safe-action";
import { parseSetCookie } from "@/lib/set-cookie";
import { verifyCodeSchema } from "./_lib/schema";

export const verifyCode = actionClient
  .inputSchema(verifyCodeSchema)
  .stateAction(async ({ parsedInput: { code } }) => {
    const outcome = await auth().verifyAdminSignInCode({ code, headers: await headers() });

    if (!outcome.ok) {
      /**
       * Returned, not thrown, so a wrong code costs one `warn` line and no
       * Sentry event — which is the only quota lever in the design, and it
       * matters most here: a code field is the one input in this product an
       * attacker can drive at whatever rate the ceiling allows. The door has
       * already emitted its own line naming the Account and which ceiling was
       * charged; this one is the surface's half.
       */
      logRequestError(outcome.error, { level: "warn" });
      return returnActionError(projectClientError(outcome.error));
    }

    const cookieStore = await cookies();

    /**
     * **Every `Set-Cookie` the door handed back, not only the session one.** It
     * writes two: the session cookie, and the challenge cleared with `maxAge:
     * 0`. Forwarding the first and dropping the second leaves a live challenge
     * in a browser that has just signed in — and the two arrive on the response
     * of a call this action makes internally, so they reach the browser only if
     * this loop puts them there.
     */
    for (const line of outcome.setCookie) {
      const cookie = parseSetCookie(line);
      if (cookie) cookieStore.set(cookie);
    }

    /**
     * `redirect` throws a framework error, which next-safe-action re-throws
     * rather than routing through `handleServerError` — so this is a navigation
     * and not a swallowed failure. Nothing after it runs.
     *
     * **The success state is a redirect and not a screen**, which is why this
     * action returns nothing. The person has just presented two factors and is
     * two seconds from a queue they already know is waiting; there is nothing
     * to tell them.
     */
    /*
      The literal, and it is the one place in this surface where the queue's
      path may appear. It is a `Location` on the response to a POST that carried
      a correct second factor, made by a browser that has just been given a
      session — not a `GET` a link scanner can consume, which is the disclosure
      `SECOND_FACTOR_ROUTE` exists to close one hop earlier. Nothing this
      surface *renders* names it.
    */
    redirect("/admin");
  });
