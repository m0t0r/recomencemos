"use server";

/**
 * The Admin's actions. Two today; nine more arrive with the stories that create
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
import { promoteSkillSchema, revokeSessionsSchema } from "./_lib/schema";

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

/** What the queue tells the Admin afterwards: the entry that now exists. */
export interface SkillPromoted {
  readonly labelEs: string;
}

/**
 * Promote a requested capability into the vocabulary.
 *
 * **The whole act is `@repo/domain/admin`'s**, which is why this reads as
 * plumbing: `runAdminAction` opens the transaction, locks the request, writes the
 * entry, resolves the row and records the `AdminAction` — all of it, or none of
 * it. There is nothing here to forget.
 *
 * **A promoted Skill is choosable immediately**, and that follows from the read
 * rather than from anything done here: the publishing form asks the database for
 * the active vocabulary when it renders, and no layer between them caches it.
 */
export const promoteSkill = adminActionClient
  .inputSchema(promoteSkillSchema)
  .stateAction<SkillPromoted>(async ({ parsedInput, ctx: { actor } }) => {
    const outcome = await admin.run(actor, "promoteSkill", parsedInput);

    if (!outcome.ok) {
      // Returned, not thrown. A request somebody else already resolved and a
      // slug already taken are both ordinary answers on a shared queue.
      logRequestError(outcome.error, { level: "warn" });
      return returnActionError(projectClientError(outcome.error));
    }

    /**
     * **The label, and not the slug beside it.** The Admin has just typed both,
     * and only one of them is the thing every Worker will read on the publishing
     * form — quoting that back is the confirmation. The request's own text is
     * deliberately absent: it is on screen already, in the row this came from.
     */
    return { labelEs: outcome.result.labelEs };
  });
