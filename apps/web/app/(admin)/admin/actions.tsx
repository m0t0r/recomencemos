"use server";

/**
 * The Admin's actions. Three today; eight more arrive with the stories that create
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
import { authBaseUrl } from "@repo/domain/auth-handler";
import { projectClientError } from "@repo/errors/app-error";
import { createNotifierFromEnv } from "@repo/notifications/send";
import {
  OFFER_DELIVERED_SUBJECT,
  OfferDeliveredEmail,
} from "@repo/notifications/templates/offer-delivered";
import { logger } from "@repo/observability/logger";
import { logRequestError } from "@repo/observability/log-request-error";
import { adminActionClient } from "@/lib/admin";
import { returnActionError } from "@/lib/safe-action";
import {
  deliverOfferArg,
  deliverOfferSchema,
  promoteSkillRequestArg,
  promoteSkillSchema,
  revokeSessionsSchema,
} from "./_lib/schema";

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
  /**
   * **The request id is bound, not hidden** (ADR-0015): it travels with the
   * submit and nobody types it, so React encodes it into the action reference and
   * this validates it on arrival. The row's markup then carries no mirror of it —
   * which matters here beyond tidiness, because this row is the shape the four
   * remaining queue sections will copy.
   */
  .bindArgsSchemas([promoteSkillRequestArg])
  .inputSchema(promoteSkillSchema)
  .stateAction<SkillPromoted>(
    async ({ parsedInput, bindArgsParsedInputs: [requestId], ctx: { actor } }) => {
      const outcome = await admin.run(actor, "promoteSkill", { ...parsedInput, requestId });

      if (!outcome.ok) {
        // Returned, not thrown. A request somebody else already resolved and a
        // slug already taken are both ordinary answers on a shared queue.
        logRequestError(outcome.error, { level: "warn" });
        return returnActionError(projectClientError(outcome.error));
      }

      /**
       * **The label, and not the slug beside it.** The Admin has just typed both,
       * and only one of them is the thing every Worker will read on the
       * publishing form — quoting that back is the confirmation. The request's
       * own text is deliberately absent: it is on screen already, in the row this
       * came from.
       */
      return { labelEs: outcome.result.labelEs };
    },
  );

/** What the queue tells the Admin afterwards: which row moved, and where it went. */
export interface OfferDelivered {
  readonly workerFirstName: string;
}

/**
 * Let one Offer through to the person it is addressed to.
 *
 * **The whole act is `@repo/domain/admin`'s**: `runAdminAction` opens the
 * transaction, locks the Offer, moves its state, stamps `deliveredAt`,
 * increments the delivered-Offer count the browsable list orders by, and writes
 * the `AdminAction` — all of it, or none of it.
 *
 * **The notification is sent here, after the commit, and that ordering is the
 * design.** A transaction can roll back and a delivered email cannot, so a send
 * inside the handler would put an irreversible act inside a reversible scope. It
 * also means a transport failure leaves the Offer delivered rather than undoing
 * it: DD9's rule for `acceptOffer` — the on-site record is the durable channel
 * and the mail is a copy — applied one story earlier.
 *
 * **Her address never reaches a browser.** It comes back on the domain result
 * because the alternative is a second door into the database, and this action's
 * declared return type is the whitelist: one first name, which the Admin is
 * already looking at.
 */
export const deliverOffer = adminActionClient
  .bindArgsSchemas([deliverOfferArg])
  .inputSchema(deliverOfferSchema)
  .stateAction<OfferDelivered>(async ({ bindArgsParsedInputs: [offerId], ctx: { actor } }) => {
    const outcome = await admin.run(actor, "deliverOffer", { offerId });

    if (!outcome.ok) {
      // Returned, not thrown. An Offer somebody else already handled and one
      // that expired underneath the page are both ordinary answers on a shared
      // queue.
      logRequestError(outcome.error, { level: "warn" });
      return returnActionError(projectClientError(outcome.error));
    }

    const {
      workerFirstName,
      recipientEmail,
      recipientAccountId,
      offerId: delivered,
    } = outcome.result;

    /**
     * **A failed send does not undo the delivery**, and it does not fail the
     * action either: she can read the Offer on the site, which is why the site
     * is the durable channel. It is reported rather than swallowed —
     * `notifier.send` throws on a transport fault by contract, so this is a
     * real incident and has earned its event.
     */
    try {
      const notifier = createNotifierFromEnv(logger);

      await notifier.send({
        kind: "offer-delivered",
        to: recipientEmail,
        // The identifier a log line may carry (NFR18). Her address is not it.
        recipientId: recipientAccountId,
        // `<kind>/<entity-id>`: two sends about one Offer are one delivery, so
        // a retry after a timeout returns the original response rather than
        // writing to her twice.
        entityId: delivered,
        subject: OFFER_DELIVERED_SUBJECT,
        body: (
          <OfferDeliveredEmail
            firstName={workerFirstName}
            url={new URL(`/offers/${delivered}`, authBaseUrl(process.env)).toString()}
          />
        ),
      });
    } catch (cause) {
      logRequestError(cause);
    }

    /**
     * **A first name, and nothing else.** The Admin has the row on screen; her
     * address and her Account id are on the domain result because the send
     * needed them, and neither belongs in an RSC payload (NFR11, NFR18).
     */
    return { workerFirstName };
  });
