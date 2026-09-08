/**
 * What each Admin action actually does — and **nothing here is exported past this
 * package**, which is the whole of NFR33's mechanism.
 *
 * The requirement is that _"**100%** of the eleven `/admin` actions write an
 * `AdminAction` row in the same transaction as the action itself, so **0** of them
 * can commit unaudited"_. The obvious implementation is an insert at the end of
 * every handler, and its failure mode is the twelfth handler somebody writes at
 * the end of a long day. So the insert is not in a handler at all: `runAdminAction`
 * opens the transaction, calls the handler, and writes the row — and since
 * `#admin/index` publishes the executor and not this map, there is no way to reach
 * a handler that skips it.
 *
 * **A handler takes the transaction, not a connection.** That is the shape
 * `#database` already argues for in as many words: _"NFR33 requires an
 * `AdminAction` insert to share the transaction of the action it records"_, which
 * means a domain function has to be callable inside a caller's transaction.
 *
 * **A handler throws to refuse.** Returning a refusal would commit the transaction
 * — including the audit row — for an action that did not happen. Throwing rolls
 * both back together, and `runAdminAction` catches and returns the `AppError`, so
 * the refusal still costs one `warn` line and no Sentry event (CLAUDE.md: "thrown
 * is reported; returned is logged" is about what escapes the *request*, and
 * nothing escapes here).
 */

import { AppError } from "@repo/errors/app-error";
import { eq, sql } from "drizzle-orm";
import type { AdminActionName } from "#admin/names";
import type { DomainDatabase } from "#database";
import { asOfferState, mayTransitionOffer } from "#policy/offer-states";
import * as schema from "#schema";
import {
  ADMIN_ACCOUNT_NOT_FOUND,
  ADMIN_OFFER_GONE,
  ADMIN_OFFER_RESOLVED,
  ADMIN_PHOTO_ALREADY_REVIEWED,
  ADMIN_PHOTO_GONE,
  ADMIN_SKILL_REQUEST_GONE,
  ADMIN_SKILL_REQUEST_RESOLVED,
  ADMIN_SKILL_SLUG_TAKEN,
} from "#user-messages";

/** The input and result of each action, as one table two types are derived from. */
export interface AdminActionShapes {
  /**
   * Ends every session of one Account.
   *
   * **NFR13 names it**: _"a Worker ends all her sessions from any device she
   * holds; **an Admin ends a reported Hirer's while handling the Report**"_. It is
   * the one of the spec's eleven actions that needs no entity a later story
   * creates, which is why it is the registry's first member rather than a fixture.
   *
   * **It is keyed by address and audited by id.** An Admin has an address in front
   * of them — it is what a Report or an incident report carries — and an id is
   * what NFR18 permits the audit row to hold. Resolving one to the other is this
   * handler's first act, and the address goes no further.
   */
  revokeSessions: { input: { readonly email: string }; result: { readonly revoked: number } };

  /**
   * Turns a Worker's request into vocabulary.
   *
   * **The Admin writes both names, and neither is her sentence.** `slug` is the
   * English identifier a browse filter carries in a query parameter (ADR-0012)
   * and `labelEs` is the `es-CO` phrase the picker renders — which DD12 argues
   * has to be *translated* rather than copied, since the whole reason the seed is
   * a translation of CUOC is that a labour statistician's register is not the
   * register of the person reading the form. Her request is the evidence for the
   * entry, not the entry.
   *
   * **`cuocCode` is optional here and nullable in the table.** An entry that
   * arrived this way may correspond to no CUOC *Ocupación* at all — that is
   * frequently why she had to ask — and a column recording provenance must be
   * allowed to record that it has none.
   *
   * **The result carries the entry rather than a bare `ok`**, because the Admin
   * has just typed two strings that are about to be read by everyone, and the
   * screen saying which pair landed is the only confirmation available.
   */
  /**
   * Lets one Offer through to the person it is addressed to.
   *
   * **The one act on this list with a deadline attached.** NFR7 bounds the age
   * of the oldest undelivered Offer at 24 hours, which is why `/admin` leads with
   * that section — and why the Offer aggregate ships this action with the story
   * that writes the Offers rather than with the section that renders them. An
   * Offer nobody can deliver is an Offer that only accumulates.
   *
   * **The result carries what the send needs and the browser never sees.** The
   * notification is not sent from inside the handler: the transaction is
   * rollback-able and a delivered email is not, so the send happens in the
   * Server Action **after** this commits, and a transport that fails leaves the
   * Offer delivered — DD9's rule for `acceptOffer`, which is the same trade in
   * the same direction. That is why her address is on this result: it is the one
   * value the caller cannot look up without a second door into the database, and
   * `apps/web`'s action declares a return type that does not carry it.
   */
  deliverOffer: {
    input: { readonly offerId: string };
    result: {
      /** What the queue tells the Admin: who it went to, in the terms NFR11 permits. */
      readonly workerFirstName: string;
      /** For the send, and for nothing that reaches a browser. */
      readonly recipientEmail: string;
      readonly recipientAccountId: string;
      readonly offerId: string;
    };
  };

  promoteSkill: {
    input: {
      /** The `SkillRequest` row, as digits — see `#skills` for why it crosses as a string. */
      readonly requestId: string;
      readonly slug: string;
      readonly labelEs: string;
      readonly cuocCode?: string | undefined;
    };
    result: { readonly slug: string; readonly labelEs: string };
  };

  /**
   * Publishes one photo — the row half of DD6 step 4.
   *
   * **The object was already re-encoded and written before this transaction
   * opened**, and `#photos`'s `approvePhoto` is what did it. That ordering is
   * deliberate and is the one place this registry's shape needed thinking
   * about: a network round trip to object storage plus a libvips decode inside
   * an open Postgres transaction holds one of ten pooled connections
   * (`POOL_MAX`) for the length of both, and ten Admins would be the whole
   * pool. So the handler receives a key naming an object that exists.
   *
   * **What that costs is an orphan rather than a dangling row, and that is the
   * right way round.** If this transaction rolls back, a re-encoded object sits
   * in the public prefix that nothing references — unreachable, since a URL is
   * only ever derived from a row, and collected by the bucket's lifecycle rule.
   * The other ordering would leave a row pointing at bytes that were never
   * written, which is a broken image on somebody's profile.
   *
   * **It re-reads and locks the row rather than trusting the queue.** Two
   * Admins working the same branch is the case this exists for, exactly as
   * `promoteSkill` documents — and here the second one would otherwise publish
   * a photo the first had already rejected and deleted.
   */
  approvePhoto: {
    input: {
      /** The CapabilityProfile whose photo this is. */
      readonly profileId: string;
      /** Where the re-encoded object was written. Server-derived, never from a form. */
      readonly publicKey: string;
    };
    result: { readonly photoState: "approved" };
  };

  /**
   * Refuses one photo — the row half of DD6 step 5.
   *
   * **The object is deleted by `#photos`'s `rejectPhoto` after this commits**,
   * which is the mirror of the ordering above and chosen on the same argument:
   * the irreversible act goes on the side where failing leaves the recoverable
   * state. Rolling back after a delete would leave a `pending` row pointing at
   * bytes that are gone, and an Admin would meet a broken review card forever;
   * failing to delete after a commit leaves an orphan the lifecycle rule
   * collects, and the row already says `rejected`.
   *
   * **`photoKey` is cleared to `NULL`**, so the row stops naming an object at
   * all. That is what makes `rejected` and `absent` render identically on every
   * public surface without either one being a special case at the reader.
   */
  rejectPhoto: {
    input: { readonly profileId: string };
    result: {
      readonly photoState: "rejected";
      /** The object the caller must now delete. Never rendered. */
      readonly discardedKey: string;
    };
  };
}

export type AdminActionInput<K extends AdminActionName> = AdminActionShapes[K]["input"];
export type AdminActionResult<K extends AdminActionName> = AdminActionShapes[K]["result"];

/**
 * What a **handler** answers: the id the audit row names, and whatever the surface
 * renders. Distinct from `AdminActionOutcome` in `#admin/index`, which is what the
 * *executor* answers — the two were briefly one name for two things.
 *
 * **`targetId` is separate from `result` rather than dug out of it**, because the
 * executor needs it and the surface does not. Reading it out of an arbitrary
 * result shape would make the audit's completeness depend on every future handler
 * happening to put an id in the same place.
 */
export interface AdminActionHandlerResult<K extends AdminActionName> {
  readonly targetId: string;
  readonly result: AdminActionResult<K>;
}

export type AdminActionHandler<K extends AdminActionName> = (
  tx: DomainDatabase,
  input: AdminActionInput<K>,
) => Promise<AdminActionHandlerResult<K>>;

/**
 * The registry.
 *
 * **`satisfies` rather than an annotation, and that is the completeness check.**
 * It refuses a name in `ADMIN_ACTION_NAMES` with no handler *and* a handler with
 * no name — both directions, at compile time. Together with the `CHECK` on
 * `admin_action.action`, which `#schema` writes from the same list, a new action
 * has exactly one way to exist: a name, a handler, and a migration. Miss any of
 * the three and something is red before it runs.
 */
export const ADMIN_ACTION_HANDLERS = {
  async revokeSessions(tx, { email }) {
    const [account] = await tx
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.email, email.trim()))
      .limit(1);

    if (!account) {
      throw new AppError({
        code: "admin_target_account_not_found",
        status: 404,
        message:
          "revokeSessions was given an address with no Account. Nothing was revoked and no " +
          "AdminAction was written, because nothing happened — an audit row for an act that " +
          "did not occur is worse than none.",
        userMessage: ADMIN_ACCOUNT_NOT_FOUND,
        // No address: `context` reaches the log line and an email is `personal`
        // (NFR18). There is no id to name, because that is what was not found.
        context: {},
      });
    }

    /**
     * **Every session, including any the target is holding right now.** This is
     * not `signOutEverywhere`, which spares the caller's own — the caller here is
     * the Admin and the rows are somebody else's, so there is nothing to spare.
     *
     * A direct delete rather than Better Auth's `revokeSessions` endpoint,
     * because that endpoint authorizes as the *session holder* and there is no
     * such session here; the Admin is acting on an Account, not from it.
     * `internalAdapter.deleteSession` is the seam a secondary session store would
     * sit behind, and this product has none — noted, because the day one is added
     * this delete is what silently stops being sufficient.
     */
    const revoked = await tx
      .delete(schema.session)
      .where(eq(schema.session.userId, account.id))
      .returning({ id: schema.session.id });

    return { targetId: account.id, result: { revoked: revoked.length } };
  },

  async approvePhoto(tx, { profileId, publicKey }) {
    const photo = await lockPendingPhoto(tx, profileId, "approvePhoto");

    await tx
      .update(schema.capabilityProfile)
      .set({
        photoState: "approved",
        photoKey: publicKey,
        // Cleared, because it answers "how long has this been waiting" and
        // nothing is waiting any more. A stale value here would age a branch
        // this row has left.
        photoAttachedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.capabilityProfile.id, photo.id));

    return { targetId: profileId, result: { photoState: "approved" } };
  },

  async rejectPhoto(tx, { profileId }) {
    const photo = await lockPendingPhoto(tx, profileId, "rejectPhoto");

    await tx
      .update(schema.capabilityProfile)
      .set({
        photoState: "rejected",
        // `NULL`, so the row stops naming an object. The caller deletes the
        // bytes after this commits; the key travels back in the result for
        // exactly that and is never rendered.
        photoKey: null,
        photoAttachedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.capabilityProfile.id, photo.id));

    return {
      targetId: profileId,
      result: { photoState: "rejected", discardedKey: photo.photoKey },
    };
  },

  async promoteSkill(tx, { requestId, slug, labelEs, cuocCode }) {
    /**
     * **Locked, because two Admins are the case this exists for.** NFR33's
     * eleven actions are performed by whoever is on the queue, and the spec is
     * explicit that there is more than one Admin — so the same request being
     * open in two browsers is ordinary rather than exotic. Reading the state
     * without a lock leaves both reads seeing `pending`, both inserts racing on
     * `skill_slug_key`, and one of them producing a second `AdminAction` for an
     * act that did not happen.
     *
     * `FOR UPDATE` rather than an `UPDATE … WHERE state = 'pending'` returning a
     * count, because the refusals below want to tell the two cases apart: a
     * request that never existed and one somebody has already resolved are
     * different sentences to the person reading them.
     */
    const [request] = await tx
      .select({ id: schema.skillRequest.id, state: schema.skillRequest.state })
      .from(schema.skillRequest)
      .where(eq(schema.skillRequest.id, BigInt(requestId)))
      .for("update")
      .limit(1);

    if (!request) {
      throw new AppError({
        code: "admin_skill_request_not_found",
        status: 404,
        message:
          "promoteSkill was given a request id no row carries. Nothing was promoted and no " +
          "AdminAction was written, because nothing happened.",
        userMessage: ADMIN_SKILL_REQUEST_GONE,
        // The id is an identifier and carries nothing of hers (NFR18).
        context: { request_id: requestId },
      });
    }

    /**
     * **Promoting the same request twice.** The second Admin is refused here
     * rather than by the unique constraint below, which matters because the two
     * failures mean different things: a resolved request is somebody else's
     * finished work, and a taken slug is a name collision with an entry that may
     * have nothing to do with this request.
     */
    if (request.state !== "pending") {
      throw new AppError({
        code: "admin_skill_request_resolved",
        status: 409,
        message:
          `promoteSkill was asked to promote a request already in state "${request.state}". ` +
          "Nothing was promoted; the transaction rolls back with no AdminAction row.",
        userMessage: ADMIN_SKILL_REQUEST_RESOLVED,
        context: { request_id: requestId, state: request.state },
      });
    }

    /**
     * `ON CONFLICT DO NOTHING` returns no row when the slug is taken, which is
     * the check rather than a way of ignoring one: a slug already in the
     * vocabulary is refused out loud, because silently pointing this request at
     * somebody else's entry would resolve her request with something she did not
     * ask for.
     */
    const [promoted] = await tx
      .insert(schema.skill)
      .values({ slug, labelEs, cuocCode: cuocCode ?? null })
      .onConflictDoNothing({ target: schema.skill.slug })
      .returning({ slug: schema.skill.slug, labelEs: schema.skill.labelEs });

    if (!promoted) {
      throw new AppError({
        code: "admin_skill_slug_taken",
        status: 409,
        message:
          `promoteSkill was given the slug "${slug}", which the vocabulary already holds. ` +
          "Nothing was promoted and the request is still pending.",
        userMessage: ADMIN_SKILL_SLUG_TAKEN,
        // The slug is an English identifier, not anything a person typed about
        // themselves — the label beside it is deliberately absent.
        context: { request_id: requestId, slug },
      });
    }

    await tx
      .update(schema.skillRequest)
      .set({ state: "promoted", resolvedAt: new Date() })
      .where(eq(schema.skillRequest.id, request.id));

    return {
      targetId: String(request.id),
      result: { slug: promoted.slug, labelEs: promoted.labelEs },
    };
  },

  async deliverOffer(tx, { offerId }) {
    /**
     * **Locked, for `promoteSkill`'s reason and one of its own.** Two Admins
     * working the same queue is ordinary rather than exotic, and here a second
     * delivery would not merely write a second `AdminAction` — it would
     * increment `delivered_offer_count` twice, and that column is NFR22's
     * ordering input. A double delivery would push her *down* the browsable
     * list for work she was contacted about once.
     *
     * `FOR UPDATE` rather than a conditional `UPDATE` returning a count, because
     * the two refusals below are different sentences: an Offer that is not there
     * and one somebody else has already handled are different facts about the
     * queue in front of them.
     */
    const [offer] = await tx
      .select({
        id: schema.offer.id,
        state: schema.offer.state,
        capabilityProfileId: schema.offer.capabilityProfileId,
      })
      .from(schema.offer)
      .where(eq(schema.offer.id, offerId))
      .for("update")
      .limit(1);

    if (!offer) {
      throw new AppError({
        code: "admin_offer_not_found",
        status: 404,
        message:
          "deliverOffer was given an Offer id no row carries. Nothing was delivered and no " +
          "AdminAction was written, because nothing happened.",
        // The id is an identifier and carries nothing either party wrote (NFR18).
        userMessage: ADMIN_OFFER_GONE,
        context: { offer_id: offerId },
      });
    }

    const state = asOfferState(offer.state);

    if (!state || !mayTransitionOffer(state, "delivered")) {
      throw new AppError({
        code: "admin_offer_not_deliverable",
        status: 409,
        message:
          `deliverOffer was asked to deliver an Offer in state "${offer.state}", which is not a ` +
          "state it can be delivered from. Nothing was delivered; the transaction rolls back " +
          "with no AdminAction row and the counter untouched.",
        userMessage: ADMIN_OFFER_RESOLVED,
        context: { offer_id: offerId, state: offer.state },
      });
    }

    await tx
      .update(schema.offer)
      .set({ state: "delivered", deliveredAt: new Date() })
      .where(eq(schema.offer.id, offer.id));

    /**
     * **NFR22's ordering input, incremented here and nowhere else.** The
     * browsable list orders by delivered-Offer count ascending, so this is the
     * write that moves her down it — which is the fairness mechanism working,
     * and the reason the read that feeds it is a stored column rather than a
     * count over `state` (that count would fall back the moment she accepts).
     *
     * `+ 1` in SQL rather than read-then-write: the lock above is on the Offer
     * row and not on her profile, and two Offers to one Worker delivered at once
     * would otherwise lose an increment.
     */
    await tx
      .update(schema.capabilityProfile)
      .set({ deliveredOfferCount: sql`${schema.capabilityProfile.deliveredOfferCount} + 1` })
      .where(eq(schema.capabilityProfile.id, offer.capabilityProfileId));

    /**
     * Who to write to. Read after the writes rather than before, so a refusal
     * above never touches her address at all.
     */
    const [recipient] = await tx
      .select({
        accountId: schema.user.id,
        email: schema.user.email,
        firstName: schema.capabilityProfile.firstName,
      })
      .from(schema.capabilityProfile)
      .innerJoin(schema.user, eq(schema.user.id, schema.capabilityProfile.accountId))
      .where(eq(schema.capabilityProfile.id, offer.capabilityProfileId))
      .limit(1);

    // The Offer's foreign key guarantees the profile, and the profile's
    // guarantees the Account; a missing row here means something this code does
    // not model, and throwing rolls the delivery back rather than sending
    // nothing and reporting success.
    if (!recipient) {
      throw new Error("The delivered Offer names a profile with no Account; nothing commits.");
    }

    return {
      targetId: offer.id,
      result: {
        workerFirstName: recipient.firstName,
        recipientEmail: recipient.email,
        recipientAccountId: recipient.accountId,
        offerId: offer.id,
      },
    };
  },
} as const satisfies { [K in AdminActionName]: AdminActionHandler<K> };

/**
 * The row both photo handlers act on, locked, or a refusal that says which of
 * the two things went wrong.
 *
 * **`FOR UPDATE` for `promoteSkill`'s reason, one entity over.** There is more
 * than one Admin and they work the same branch, so the same photo open in two
 * browsers is ordinary rather than exotic. Without the lock both reads see
 * `pending`, both updates apply, and the second one writes an `AdminAction` for
 * an act that had already happened — or worse, publishes a photo the first
 * Admin had just rejected and deleted.
 *
 * **The two refusals are different sentences because they are different
 * facts.** A profile with nothing waiting is a stale queue row an Admin should
 * reload past; a photo already `approved` or `rejected` is somebody else's
 * finished work. Neither is a fault, and both throw rather than return so the
 * transaction — and its audit row — rolls back with them.
 */
async function lockPendingPhoto(
  tx: DomainDatabase,
  profileId: string,
  action: "approvePhoto" | "rejectPhoto",
): Promise<{ readonly id: bigint; readonly photoKey: string }> {
  const [row] = await tx
    .select({
      id: schema.capabilityProfile.id,
      photoState: schema.capabilityProfile.photoState,
      photoKey: schema.capabilityProfile.photoKey,
    })
    .from(schema.capabilityProfile)
    .where(eq(schema.capabilityProfile.id, BigInt(profileId)))
    .for("update")
    .limit(1);

  if (!row) {
    throw new AppError({
      code: "admin_photo_profile_not_found",
      status: 404,
      message:
        `${action} was given a profile id no row carries. Nothing changed and no AdminAction ` +
        "was written, because nothing happened.",
      userMessage: ADMIN_PHOTO_GONE,
      // An id is an identifier and carries nothing of hers (NFR18).
      context: { profile_id: profileId },
    });
  }

  if (row.photoState !== "pending" || !row.photoKey) {
    throw new AppError({
      code: "admin_photo_already_reviewed",
      status: 409,
      message:
        `${action} was asked to act on a photo in state "${row.photoState}". Only a pending ` +
        "photo can be approved or rejected; the transaction rolls back with no AdminAction row.",
      userMessage: ADMIN_PHOTO_ALREADY_REVIEWED,
      context: { profile_id: profileId, photo_state: row.photoState },
    });
  }

  return { id: row.id, photoKey: row.photoKey };
}
