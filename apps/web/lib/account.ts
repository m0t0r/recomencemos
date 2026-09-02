import "server-only";

/**
 * The gate a signed-in surface calls, in its two shapes — mirroring
 * `lib/admin.ts`, which is the same idea one authority level up.
 *
 * **A page** calls {@link requireAccountPage}, which redirects a signed-out
 * request to `/sign-in` with a `returnPath` so she lands back where she was
 * going. That is the spec's own `permission denied` cell for the Worker
 * surfaces ("signed out → `/sign-in`"), and it is a redirect rather than a 403
 * because there is nothing to tell somebody about a problem they can fix by
 * entering.
 *
 * **A Server Action** is built from {@link accountActionClient}, whose `use()`
 * middleware refuses **before** the boundary parse with a returned `ClientError`
 * — one `warn` line, no Sentry event — and hands the session to the action as
 * `ctx.session`. The API contract's rule that every action authorizes
 * independently is satisfied here for every action built from it, because Next
 * compiles each to a directly reachable POST endpoint and the page's own gate
 * does not extend to it.
 *
 * Neither reads Better Auth directly (ADR-0015): both go through
 * `AuthHandler.getSession`, which is the one door the domain publishes.
 */

import type { AuthSession } from "@repo/domain/auth-handler";
import { AppError, projectClientError } from "@repo/errors/app-error";
import { logRequestError } from "@repo/observability/log-request-error";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_REQUIRED } from "@/app/_lib/session/messages";
import { auth } from "@/lib/auth";
import { actionClient, returnActionError } from "@/lib/safe-action";

/** What every action built from {@link accountActionClient} finds in `ctx`. */
export interface AccountContext {
  readonly session: AuthSession;
}

export async function requireAccountPage(returnPath: string): Promise<AuthSession> {
  const session = await auth().getSession(await headers());
  if (!session) redirect(`/sign-in?returnPath=${encodeURIComponent(returnPath)}`);

  return session;
}

export const accountActionClient = actionClient.use(async ({ next }) => {
  const session = await auth().getSession(await headers());
  if (session) return next({ ctx: { session } satisfies AccountContext });

  const refusal = new AppError({
    code: "session_required",
    status: 401,
    message:
      "A signed-in Server Action was called with no session. The action authorizes " +
      "independently rather than trusting the page that rendered its form, so this is the " +
      "ordinary answer to an expired cookie as much as it is to a direct POST.",
    userMessage: SESSION_REQUIRED,
    // Nothing to name: there is no session, and naming anything else would put
    // an identifier on a line an anonymous request can provoke (NFR18).
    context: {},
  });

  logRequestError(refusal, { level: "warn" });
  return returnActionError(projectClientError(refusal));
});
