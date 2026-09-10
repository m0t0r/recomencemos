"use server";

/**
 * The Admin's actions. Four today; seven more arrive with the stories that create
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
import { photos } from "@repo/domain/photos";
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
  noPayloadSchema,
  offerIdArg,
  photoKeyArg,
  photoProfileArg,
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

/**
 * One line per safety-relevant transition of an Offer, carrying an id and
 * nothing else.
 *
 * **The two names are on the spec's closed list of logged transitions**, and
 * membership in that list is a spec amendment rather than a judgment made here —
 * which is why this takes the name as a parameter typed to the two it may emit
 * rather than accepting any string.
 *
 * **After the commit, never before.** The transaction is what decides whether the
 * transition happened, so a line written inside it would survive a rollback as a
 * record of something that did not occur — the same argument that puts the
 * delivery mail after the commit one paragraph down.
 *
 * Ids and enum values only, which satisfies NFR18 by construction rather than by
 * discipline: there is nothing else in scope here to leak.
 */
function offerTransition(event: "offer.delivered" | "offer.rejected_by_admin", offerId: string) {
  logger.info({ event, offer_id: offerId }, "An Admin decided an Offer");
}

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
  .bindArgsSchemas([offerIdArg])
  .inputSchema(noPayloadSchema)
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

    offerTransition("offer.delivered", delivered);

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

/** What the queue tells the Admin afterwards: the row that stops here. */
export interface OfferRejected {
  readonly offerId: string;
}

/**
 * Stop one Offer, so it reaches nobody.
 *
 * **The other half of the queue's one decision, and the thinner half by design.**
 * Delivering an Offer is a state change plus a counter plus a mail; refusing one
 * is a state change. There is nobody to write to — the catalogue of sends is a
 * closed list with no entry for this, and the Hirer already reads the outcome on
 * his own list of sent Offers, where story 6 shipped both a badge and a sentence
 * for the state. Adding a mail here would be a new kind of send chosen at Build
 * time by whoever happened to write this action.
 *
 * **It is terminal, and it carries no confirmation step.** That is argued where
 * the schema is: this person is clearing a backlog against a clock, and a dialog
 * on the path they take most is friction the surface's whole brief refuses. The
 * photo queue below reaches the same answer from the other direction — it says
 * *no se puede deshacer* on the row, before the button rather than after it.
 *
 * **The id comes back and nothing else does.** It is what the row already bound,
 * it is an identifier, and it is the only value this act produces — there is no
 * name to quote, because nobody was reached.
 */
export const rejectOffer = adminActionClient
  .bindArgsSchemas([offerIdArg])
  .inputSchema(noPayloadSchema)
  .stateAction<OfferRejected>(async ({ bindArgsParsedInputs: [offerId], ctx: { actor } }) => {
    const outcome = await admin.run(actor, "rejectOffer", { offerId });

    if (!outcome.ok) {
      // Returned, not thrown, for `deliverOffer`'s reason: an Offer somebody else
      // already handled is an ordinary answer on a shared queue.
      logRequestError(outcome.error, { level: "warn" });
      return returnActionError(projectClientError(outcome.error));
    }

    offerTransition("offer.rejected_by_admin", outcome.result.offerId);

    return { offerId: outcome.result.offerId };
  });

/** What the queue tells the Admin afterwards about a photo: that it is decided. */
export interface PhotoDecided {
  readonly photoState: "approved" | "rejected";
}

/**
 * Publish one photo.
 *
 * **The whole act is `@repo/domain/photos`'s**, and the interesting part of it is
 * an ordering rather than a query: the object is re-encoded out of quarantine and
 * into the public prefix *before* the transaction opens, because a network round
 * trip plus an image decode inside an open Postgres transaction would hold one of
 * ten pooled connections for the length of both. The row and its `AdminAction`
 * then commit together, or neither does.
 *
 * **Nothing about the photo crosses back.** The Admin has the image on screen —
 * it is what they were looking at — so the result is the new state and nothing
 * else. A URL here would be an egress of an object that is public anyway, and a
 * key would be an internal locator on the wire for no reason.
 *
 * **`noPayloadSchema` rather than `z.void()`**, because there is nothing typed
 * into this — the profile is a bound argument and the decision is which button
 * was pressed — and because `z.void()` refuses what a form dispatch actually
 * sends. See the schema's own comment; the first version of this failed the
 * boundary parse on every submission and said nothing.
 */
export const approvePhoto = adminActionClient
  /**
   * **Two bound arguments, and the second is the photo.** The profile id names
   * the row; the quarantine key names the object the card was rendered with, so
   * the decision applies to what the Admin actually looked at rather than to
   * whatever the row points at when it commits.
   */
  .bindArgsSchemas([photoProfileArg, photoKeyArg])
  .inputSchema(noPayloadSchema)
  .stateAction<PhotoDecided>(
    async ({ bindArgsParsedInputs: [profileId, reviewedKey], ctx: { actor } }) => {
      const outcome = await photos.approve(actor, profileId, reviewedKey);

      if (!outcome.ok) {
        // Returned, not thrown. A photo somebody else already decided is an
        // ordinary answer on a shared queue, and a caller that could raise an
        // event from it would spend the month's allowance in a day.
        logRequestError(outcome.error, { level: "warn" });
        return returnActionError(projectClientError(outcome.error));
      }

      return { photoState: "approved" };
    },
  );

/**
 * Refuse one photo, **and delete it**.
 *
 * The ordering is the mirror of `approvePhoto`'s and is chosen on the same
 * argument: the row and its audit commit first, then the object is deleted. A
 * rollback after a delete would leave a `pending` row naming bytes that are gone,
 * which is a review card no Admin can ever clear; a delete that fails after the
 * commit leaves an unreachable orphan the bucket's own rule collects.
 *
 * It is irreversible, and the row says so before it is pressed.
 */
export const rejectPhoto = adminActionClient
  // The key is bound here for a sharper reason than above: this act deletes the
  // object, so a decision that named only the row would delete a photo nobody
  // had looked at.
  .bindArgsSchemas([photoProfileArg, photoKeyArg])
  .inputSchema(noPayloadSchema)
  .stateAction<PhotoDecided>(
    async ({ bindArgsParsedInputs: [profileId, reviewedKey], ctx: { actor } }) => {
      const outcome = await photos.reject(actor, profileId, reviewedKey);

      if (!outcome.ok) {
        logRequestError(outcome.error, { level: "warn" });
        return returnActionError(projectClientError(outcome.error));
      }

      return { photoState: "rejected" };
    },
  );
