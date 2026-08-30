"use server";

/**
 * `/account`'s one action.
 *
 * **It authorizes independently, and on this surface that is not a formality.**
 * Next compiles every Server Action to a directly reachable POST endpoint, so
 * the page's own session read does not extend to it — a caller who never
 * rendered the page reaches this the same way the form does. The check is inside
 * `@repo/domain`'s `signOutEverywhere`, which resolves the session from the
 * request headers and answers `session_required` when there is none. Verified at
 * seam 3 by posting to it unauthenticated, which is the only verification that
 * exercises the endpoint an attacker actually reaches.
 *
 * **`.stateAction()`, so NFR4 stays reachable.** next-safe-action's own form
 * guide marks `useAction` and `useStateAction` as not working without
 * JavaScript; a `.stateAction()` is a real server-action reference, so React can
 * emit the no-JS form encoding and this page works unhydrated. See
 * `lib/safe-action.ts`.
 *
 * **No input schema and no bound arguments, and that is the whole shape.** The
 * action takes nothing from the browser — which session is revoking, and which
 * sessions are revoked, are both read from the request's own cookie inside the
 * domain. There is nothing here for a caller to tamper with, which is the
 * strongest form of "the client is not trusted".
 */

import { projectClientError } from "@repo/errors/app-error";
import { logRequestError } from "@repo/observability/log-request-error";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { actionClient, returnActionError } from "@/lib/safe-action";
import { closedOthers } from "./_lib/messages";

/**
 * What the form gets back on success.
 *
 * The count travels as a number **and** as the sentence built from it. The
 * number is what a later surface or a test can assert on; the sentence is what
 * she reads, and building it here rather than in the component keeps the copy in
 * `_lib/messages.ts` where the voice guide can be checked against it.
 */
export interface SessionsClosed {
  readonly revoked: number;
  readonly message: string;
}

export const signOutEverywhere = actionClient.stateAction<SessionsClosed>(async () => {
  const outcome = await auth().signOutEverywhere(await headers());

  if (!outcome.ok) {
    /**
     * Returned, not thrown — one `warn` line and no Sentry event, per
     * CLAUDE.md's "thrown is reported; returned is logged". The line is not
     * optional: `returnActionError` bypasses `handleServerError`, which is where
     * every *thrown* error is logged, so a returned one not logged here is a
     * failure nothing records.
     *
     * Both branches are expected rather than exceptional. An expired cookie is
     * ordinary on this surface especially — she may be looking at exactly this
     * page when a session runs out.
     */
    logRequestError(outcome.error, { level: "warn" });
    return returnActionError(projectClientError(outcome.error));
  }

  /**
   * **The list must not survive its own revocation.** Without this the page's
   * Server Component keeps its rendered rows and she reads a success sentence
   * above two sessions that no longer exist — the exact opposite of the evidence
   * this surface is built on.
   */
  revalidatePath("/account");

  return { revoked: outcome.revoked, message: closedOthers(outcome.revoked) };
});
