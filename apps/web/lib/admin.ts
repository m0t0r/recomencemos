import "server-only";

/**
 * NFR14's gate, as `apps/web` uses it — one call for a page and one for an action,
 * because the two refuse differently.
 *
 * The decision itself is `requireAdminSession` in `@repo/domain/admin`, a pure
 * function over a session. What lives here is the framework half: reading the
 * request headers, and turning `null` into the right *shape* of 403 for the
 * caller. Keeping those apart is what lets the rule be table-driven at seam 1
 * rather than costing a real sign-in per case.
 */

import { type AdminActor, requireAdminSession } from "@repo/domain/admin";
import { AppError, projectClientError } from "@repo/errors/app-error";
import { logRequestError } from "@repo/observability/log-request-error";
import { forbidden } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { ADMIN_SESSION_REQUIRED } from "@/app/(admin)/admin/_lib/messages";
import { actionClient, returnActionError } from "@/lib/safe-action";

/**
 * The Admin behind this request, or a 403 page.
 *
 * **`forbidden()` and not `redirect()`** — NFR14 in as many words: _"refused with
 * **403, not a redirect**, because a redirect tells an unauthenticated caller that
 * the route exists and is worth attacking"_. It is also not a thrown `AppError`:
 * a framework interrupt costs no Sentry event, which is C51's rule for every
 * refusal in the UX table.
 *
 * **One answer for four different callers** — signed out, a Worker, an Admin who
 * arrived by magic link, an Admin who typed a password and no code. The domain
 * gate already collapses them to `null` for that reason, and this preserves it:
 * distinguishing them on screen would give back, one level down, exactly what
 * answering 403 rather than redirecting was protecting.
 */
export async function requireAdminPage(): Promise<AdminActor> {
  const actor = requireAdminSession(await auth().getSession(await headers()));
  if (!actor) forbidden();

  return actor;
}

/**
 * **The client every Admin Server Action is built from**, and the reason none of
 * them opens with an authorization call.
 *
 * `use()` rather than `useValidated()`, and the ordering is the finding that put
 * it here. Written as a first statement in each action body, the check ran
 * *after* next-safe-action's boundary parse — observed at seam 3, where an
 * unauthenticated `POST` to the compiled endpoint came back with
 * `validationErrors` rather than a refusal. Nothing leaked, but an anonymous
 * caller was reaching the schema, and "every action remembers to authorize first"
 * is the class of rule this repository keeps replacing with a mechanism. `use()`
 * runs before validation, so the refusal is the first thing that happens.
 *
 * The actor lands in `ctx`, so an action that needs it takes it from there rather
 * than reading the session a second time.
 */
export const adminActionClient = actionClient.use(async ({ next }) => {
  const actor = await requireAdminAction();
  return next({ ctx: { actor } });
});

/**
 * The Admin behind this Server Action, or a returned 403.
 *
 * **Module-private**, because {@link adminActionClient} is the only caller and an
 * export for "a future action built some other way" would be an invitation to
 * build one — which is the thing the client exists to stop.
 *
 * **Returned, not thrown, and not `forbidden()` either.** `returnActionError`
 * bypasses `handleServerError`, so a refusal costs one `warn` line and no event.
 * `forbidden()` would work but would answer a *navigation* to a `fetch` the
 * browser made, which the form has nothing to do with.
 */
async function requireAdminAction(): Promise<AdminActor> {
  const actor = requireAdminSession(await auth().getSession(await headers()));
  if (actor) return actor;

  const refusal = new AppError({
    code: "admin_session_required",
    status: 403,
    message:
      "An Admin Server Action was called by a session that presented no password and no " +
      "second factor. The action authorizes independently rather than trusting the page that " +
      "rendered its form, because Next compiles it to a directly reachable POST endpoint — so " +
      "this is the ordinary answer to an expired session as much as it is to an attack.",
    userMessage: ADMIN_SESSION_REQUIRED,
    // Nothing to name: there may be no session at all, and naming the caller's
    // Account on a refusal would put an id on a line an anonymous request can
    // provoke (NFR18).
    context: {},
  });

  /**
   * Returned, not thrown — so this costs one `warn` line and no Sentry event.
   * The line is not optional: `returnActionError` bypasses `handleServerError`,
   * which is where every *thrown* error gets logged, so a returned one that is
   * not logged here is a refusal nothing records.
   */
  logRequestError(refusal, { level: "warn" });
  return returnActionError(projectClientError(refusal));
}
