"use server";

/**
 * The Admin's door, as three Server Actions.
 *
 * **All three authorize for themselves**, which on this surface means something
 * more specific than the standing rule: none of them may be reachable in a state
 * the previous step did not put the caller in, and none of them checks a *page*
 * for that. Better Auth's own cookies are what carry the state — the 2FA challenge
 * cookie for `verifyAdminCode`, a `password` session for `enrolAdminCode` — so a
 * caller posting straight to the compiled endpoint out of order is refused by the
 * library rather than by a step counter this surface would have to keep.
 *
 * **`setCookie` is the half none of them may drop.** Better Auth writes the
 * challenge cookie and, later, the session cookie onto the response of a call
 * `@repo/domain` makes internally, and a Server Action does not return that to the
 * browser on its own. Skipping the loop produces `INVALID_TWO_FACTOR_COOKIE` on the
 * very next request, which reads to the Admin as "my code is wrong".
 *
 * **There is no NFR26 ceiling here and that is not an omission.** Every member of
 * `CEILINGS` is an action a Worker or a Hirer takes, and a row for an Admin
 * sign-in would mean a `rate_counter.action` constraint change for a path Better
 * Auth's own limiter already sees. `/sign-in/email` carries an explicit
 * `customRules` entry, `/two-factor/*` carries the plugin's, and the plugin's
 * per-account lockout — ten consecutive failures, fifteen minutes — is a stronger
 * bound than any per-IP counter because it survives an attacker rotating
 * addresses. The argument is at the option in `#auth/config`.
 */

import type { AdminSignInStage } from "@repo/domain/auth-handler";
import { projectClientError } from "@repo/errors/app-error";
import { logRequestError } from "@repo/observability/log-request-error";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { actionClient, returnActionError } from "@/lib/safe-action";
import { parseSetCookie } from "@/lib/set-cookie";
import {
  adminSignInSchema,
  enrolSchema,
  secondFactorKindArg,
  secondFactorSchema,
} from "./_lib/schema";

/**
 * Where the door lands after a correct password: at the code field, or at
 * enrolment. Never at `/admin` — a password alone is not an Admin session, which
 * is the whole of NFR14.
 */
export interface PasswordAccepted {
  readonly stage: AdminSignInStage;
}

/** The two values that are shown once and never again. */
export interface Enrolled {
  readonly totpUri: string;
  readonly backupCodes: readonly string[];
}

/**
 * Put every cookie the domain handed back onto this response.
 *
 * `parseSetCookie` is tested in its own module — it is the piece of this flow a
 * machine with no TOTP device can verify, and a review found it functionally
 * broken when it was an inline loop in `/sign-in`'s Google door.
 */
async function writeCookies(setCookie: readonly string[]): Promise<void> {
  const store = await cookies();
  for (const line of setCookie) {
    const cookie = parseSetCookie(line);
    if (cookie) store.set(cookie);
  }
}

export const signInAdmin = actionClient
  .inputSchema(adminSignInSchema)
  .stateAction<PasswordAccepted>(async ({ parsedInput: { email, password } }) => {
    const outcome = await auth().signInWithPassword({
      email,
      password,
      headers: await headers(),
    });

    if (!outcome.ok) {
      // Returned, not thrown — one `warn` line, no Sentry event. A wrong password
      // is an ordinary event on a public door and must not be able to spend the
      // month's 5,000-event allowance.
      logRequestError(outcome.error, { level: "warn" });
      return returnActionError(projectClientError(outcome.error));
    }

    await writeCookies(outcome.setCookie);
    return { stage: outcome.stage };
  });

export const verifyAdminCode = actionClient
  .bindArgsSchemas([secondFactorKindArg])
  .inputSchema(secondFactorSchema)
  .stateAction(async ({ parsedInput: { code }, bindArgsParsedInputs: [kind] }) => {
    const outcome = await auth().verifySecondFactor({ code, kind, headers: await headers() });

    if (!outcome.ok) {
      logRequestError(outcome.error, { level: "warn" });
      return returnActionError(projectClientError(outcome.error));
    }

    await writeCookies(outcome.setCookie);

    /**
     * **The only path in this file that reaches `/admin`.** `redirect` throws a
     * framework error, which next-safe-action re-throws rather than routing
     * through `handleServerError` — a navigation and not a swallowed failure.
     * Nothing after it runs.
     */
    redirect("/admin");
  });

export const enrolAdminCode = actionClient
  .inputSchema(enrolSchema)
  .stateAction<Enrolled>(async ({ parsedInput: { password } }) => {
    const outcome = await auth().enrolSecondFactor({ password, headers: await headers() });

    if (!outcome.ok) {
      logRequestError(outcome.error, { level: "warn" });
      return returnActionError(projectClientError(outcome.error));
    }

    /**
     * **These two values cross the boundary exactly once and are never readable
     * again.** Better Auth encrypts both at rest with `BETTER_AUTH_SECRET` and
     * nothing here decrypts them, so the surface rendering them is the only copy
     * the Admin will ever be offered — which is why runbook §6's "print them and
     * store them offline" is on the screen and not only in the runbook.
     *
     * They are returned rather than logged, obviously, and they are the reason
     * `enrolSecondFactor`'s failure path carries an empty `context`: every value
     * in this call is a credential (NFR18, C28).
     */
    return { totpUri: outcome.totpUri, backupCodes: outcome.backupCodes };
  });
