"use server";

/**
 * The Admin's actions. One today; ten more arrive with the stories that create
 * what they act on.
 *
 * **Each authorizes independently, and on this surface that is not a formality.**
 * Next compiles every Server Action to a directly reachable POST endpoint, so
 * `requireAdminPage` on the queue does not extend here — and these are the calls
 * that can end a person's sessions.
 *
 * **The check is the client, not a first statement.** `adminActionClient` puts it
 * in `use()` middleware, which runs *before* the boundary parse — so an action
 * added here without a thought about NFR14 is still refused, and an unauthenticated
 * caller never reaches the schema. Written as a line in each body it ran after
 * validation, which is how seam 3 found it.
 *
 * **The audit is not in this file, and that is the design.** NFR33 asks that the
 * audit *cannot be skipped*, so `runAdminAction` in `@repo/domain/admin` writes the
 * `AdminAction` row inside the transaction of the act itself, and the handlers are
 * unexported. There is nothing an action here could forget to call.
 *
 * **No NFR26 ceiling.** `CEILINGS` bounds what a Worker or a Hirer does; every
 * caller that reaches here has already passed password **and** TOTP, so the
 * ceiling that matters is on the door rather than behind it.
 */

import { admin } from "@repo/domain/admin";
import { projectClientError } from "@repo/errors/app-error";
import { logRequestError } from "@repo/observability/log-request-error";
import { adminActionClient } from "@/lib/admin";
import { returnActionError } from "@/lib/safe-action";
import { revokeSessionsSchema } from "./_lib/schema";

/** What the queue tells the Admin afterwards: a count, and no personal data. */
export interface SessionsRevoked {
  readonly revoked: number;
}

export const revokeSessions = adminActionClient
  .inputSchema(revokeSessionsSchema)
  .stateAction<SessionsRevoked>(async ({ parsedInput: { email }, ctx: { actor } }) => {
    const outcome = await admin.run(actor, "revokeSessions", { email });

    if (!outcome.ok) {
      // Returned, not thrown — one `warn` line, no Sentry event. An address with
      // no Account is an ordinary typo, not an incident.
      logRequestError(outcome.error, { level: "warn" });
      return returnActionError(projectClientError(outcome.error));
    }

    /**
     * **A count, and nothing else.** The Admin already has the address on screen —
     * they typed it — so returning it would put `personal` data on the wire to say
     * something the browser already knows. NFR18's zero is over egresses, and an
     * RSC payload is one.
     */
    return { revoked: outcome.result.revoked };
  });
