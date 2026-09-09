/**
 * `@repo/domain/photos` — the photo's life, as rows, and the ordering between a
 * row and an object that is DD6's whole correction.
 *
 * **Two stores, and only one of them can be rolled back.** `@repo/storage` owns
 * bytes and keys and knows nothing about a CapabilityProfile; this module owns
 * `photo_state` and `photo_key` and decides, for each of the four acts, which
 * store is written first. That decision is not a detail — it is the difference
 * between an orphaned object nothing references and a row pointing at bytes that
 * are gone, and only one of those is recoverable.
 *
 * The rule applied throughout: **the irreversible act goes on the side where
 * failing leaves the recoverable state.**
 *
 * | Act            | First                         | Then                  | If the second half fails                              |
 * | -------------- | ----------------------------- | --------------------- | ----------------------------------------------------- |
 * | `createUpload` | charge the ceiling            | sign a URL            | A spent charge. She retries; nine left                |
 * | `attach`       | (the object is already there) | write the row         | An orphan in quarantine, collected by the bucket      |
 * | `approve`      | re-encode into `photos/`      | write the row + audit | An orphan in `photos/`, unreachable — no row names it |
 * | `reject`       | write the row + audit         | delete the object     | An orphan in quarantine; the row already says refused |
 *
 * **`approve` and `reject` are opposite ways round, and that is the rule rather
 * than an inconsistency.** Approving writes the object first because a row
 * saying `approved` whose bytes were never written is a broken image on
 * somebody's profile; rejecting writes the row first because a row still saying
 * `pending` whose bytes are gone is a queue card an Admin can never clear.
 *
 * **Nothing here opens a transaction around an object-store call.** A network
 * round trip plus a libvips decode inside an open Postgres transaction holds one
 * of ten pooled connections (`POOL_MAX`) for the length of both.
 */

import { AppError } from "@repo/errors/app-error";
import type { AdminActor } from "#admin/actor";
import type { AdminActionOutcome } from "#admin/index";
import { and, asc, count, eq, isNotNull, lt, min } from "drizzle-orm";
import type { DomainDatabase } from "#database";
import * as schema from "#schema";
import { ADMIN_PHOTO_ALREADY_REVIEWED, PHOTO_NOT_PENDING, PHOTO_NO_PROFILE } from "#user-messages";

/** What `createUpload` hands the browser: where to PUT, and what to call it afterwards. */
export interface PhotoUploadTicket {
  readonly uploadUrl: string;
  readonly photoKey: string;
  readonly expiresInSeconds: number;
}

/** One profile waiting on a person, as the Admin queue renders it. */
export interface PendingPhoto {
  readonly profileId: string;
  readonly photoKey: string;
  readonly attachedAt: Date;
}

/** The branch, capped for display but counted and aged over the whole of it (C55). */
export interface PendingPhotoBranch {
  readonly items: readonly PendingPhoto[];
  readonly total: number;
  readonly oldestAttachedAt: Date | null;
}

/**
 * Every profile whose photo is waiting, oldest first.
 *
 * **The cap is on the rendering and never on the two figures**, which is C55
 * stated as a query rather than as a comment: the count and the age of the
 * oldest are computed over the whole predicate in a second statement, so a
 * branch of four hundred does not report a depth of twenty. That is NFR7's
 * detector silently disabled, and the queue's own class comment names it as the
 * mistake the first person to add a source would make.
 */
export async function pendingPhotos(
  db: DomainDatabase,
  displayCap: number,
): Promise<PendingPhotoBranch> {
  const waiting = and(
    eq(schema.capabilityProfile.photoState, "pending"),
    isNotNull(schema.capabilityProfile.photoAttachedAt),
  );

  const items = await db
    .select({
      id: schema.capabilityProfile.id,
      photoKey: schema.capabilityProfile.photoKey,
      attachedAt: schema.capabilityProfile.photoAttachedAt,
    })
    .from(schema.capabilityProfile)
    .where(waiting)
    .orderBy(asc(schema.capabilityProfile.photoAttachedAt), asc(schema.capabilityProfile.id))
    .limit(displayCap);

  const [totals] = await db
    .select({
      total: count(),
      oldestAttachedAt: min(schema.capabilityProfile.photoAttachedAt),
    })
    .from(schema.capabilityProfile)
    .where(waiting);

  return {
    // The two `as` reads are the `WHERE` clause read back: `photoKey` is
    // non-null whenever the state is `pending` (only `attach` writes that pair)
    // and `photoAttachedAt` is asserted non-null by the predicate itself.
    items: items.map((row) => ({
      // A `bigint` crosses as a string, for the reason `#skills` gives about
      // its own ids: it becomes a React prop and JSON has no bigint.
      profileId: String(row.id),
      photoKey: row.photoKey as string,
      attachedAt: row.attachedAt as Date,
    })),
    total: totals?.total ?? 0,
    oldestAttachedAt: totals?.oldestAttachedAt ?? null,
  };
}

/**
 * Sign one presigned PUT into quarantine — DD6 step 2.
 *
 * **NFR26's ceiling is not charged here, and that is the repository's shape
 * rather than an omission.** `publishProfile`, `updateProfile` and
 * `requestSkill` are all bounded by the `rateLimit` middleware in
 * `apps/web/lib/safe-action.ts`, which charges the Account and the IP before the
 * action body runs; a second charging site inside a domain module would be a
 * second answer to "has she spent one of the ten", and the two would disagree
 * the first time one of them was called from somewhere the other was not.
 *
 * **What that fixes is that the charge is spent whether or not she uploads.**
 * Charging before the body runs is what the middleware does everywhere, and here
 * it is exactly right: what costs is the capability rather than the object.
 * There is no way to learn whether a PUT ever happened, so a ceiling that
 * counted only completed uploads would be defeated by not completing them.
 *
 * **It takes a handle because signing a URL is no longer only an object-store
 * act.** It was a plain function, on the argument that nothing about signing is
 * a row — which was true and was the defect: with nothing written down, the
 * attach had no way to learn whose key it was holding. The row this writes is
 * the other end of that check.
 */
export async function createPhotoUpload(
  db: DomainDatabase,
  accountId: string,
  input: { readonly byteLength: number; readonly contentType: string },
): Promise<PhotoUploadTicket> {
  const { presignUpload } = await import("@repo/storage/photos");

  const ticket = await presignUpload(input);

  /**
   * **The row is what makes the attach an authorized act**, and it is written
   * before the URL crosses to her browser rather than after, so a key can never
   * be in a browser without this table knowing whose it is.
   *
   * Upserted on the Account: she may pick three photos before she likes one, and
   * only the last one she was given a URL for may be attached. `attachPhoto`
   * deletes the row it consumes, so a key is good for exactly one attach.
   */
  await db
    .insert(schema.photoUpload)
    .values({ accountId, photoKey: ticket.photoKey })
    .onConflictDoUpdate({
      target: schema.photoUpload.accountId,
      set: { photoKey: ticket.photoKey, createdAt: new Date() },
    });

  await sweepStalePhotoUploads(db);

  return ticket;
}

/**
 * How long an unattached intent is kept.
 *
 * Longer than the presigned PUT's five minutes on purpose: she uploads the
 * photo and then fills in the rest of the form, and the attach happens at
 * publish. An hour is generous against a Worker doing this in one sitting on a
 * phone, and short enough that the table stays the size of what is in flight.
 */
export const PHOTO_UPLOAD_RETENTION_SECONDS = 60 * 60;

/**
 * Delete intents nobody attached, on the write path.
 *
 * The shape `chargeCeiling` established for `rate_counter`, and for the same
 * reason: nothing else deletes from this table, so without a sweep it accretes
 * one row per Account that ever opened the picker. On the write path rather
 * than in a job, because the write path is the only thing that runs.
 */
async function sweepStalePhotoUploads(db: DomainDatabase): Promise<void> {
  const cutoff = new Date(Date.now() - PHOTO_UPLOAD_RETENTION_SECONDS * 1000);

  await db.delete(schema.photoUpload).where(lt(schema.photoUpload.createdAt, cutoff));
}

/**
 * DD6 step 3: record the key and set `pending`.
 *
 * **The object is already in quarantine by the time this runs** — she PUT it
 * from the browser — so there is nothing to order here beyond the row. A failure
 * leaves an orphan under `quarantine/`, which is unreachable by construction and
 * collected by the bucket's lifecycle rule.
 *
 * **It refuses a key that was not minted for *this Account*, and the emphasis is
 * the fix.** An earlier version checked only that the key had the *shape* of one
 * this repository mints, and its comment claimed that was "what stops one
 * profile's row being pointed at another profile's object". It was not: a shape
 * check cannot tell one valid key from another, and `/security-review` traced
 * the exploit end to end — read an approved photo's public URL off the Wall,
 * derive the quarantine key it was named from, sign up, and publish a profile
 * pointing at somebody else's face.
 *
 * Two things close it and both are needed. `mintPublicKey` in `@repo/storage`
 * stops a public URL being an oracle for the private key; this is the half that
 * does not depend on a secret staying secret. `photo_upload` records which
 * Account each key was minted for, and the row is **consumed** here — so a key
 * is good for one attach, by one person, and a key nobody was given is good for
 * nothing.
 *
 * The shape check stays in front of it. It is no longer load-bearing for
 * authorization, but the value still becomes part of an object-store request,
 * and a traversal must be refused before a lookup rather than after one.
 *
 * **It does not check that the object exists**, and that is deliberate rather
 * than an omission: a HEAD against the store on the publish path costs a round
 * trip to save an Admin from one empty review card, and the review card is where
 * a missing object is cheapest to notice.
 */
export async function attachPhoto(
  db: DomainDatabase,
  accountId: string,
  photoKey: string,
): Promise<
  | { readonly ok: true; readonly photoState: "pending" }
  | { readonly ok: false; readonly error: AppError }
> {
  const { isQuarantineKey } = await import("@repo/storage/photos");

  if (!isQuarantineKey(photoKey)) {
    return {
      ok: false,
      error: new AppError({
        code: "photo_key_not_quarantined",
        status: 422,
        message:
          "attachPhoto was given a key that is not a quarantine key this repository minted. " +
          "Nothing was written. The key round-trips through the browser between " +
          "createPhotoUpload and here, so it is a caller-controlled value by the time it " +
          "arrives — pointing a row at an unvalidated string is how one profile ends up " +
          "naming another's object.",
        userMessage: PHOTO_NOT_PENDING,
        context: {},
      }),
    };
  }

  /**
   * **Deleted and checked in one statement**, so two submissions racing the same
   * key cannot both find it. `DELETE … RETURNING` is atomic where a `SELECT`
   * then a `DELETE` is two decisions with a gap between them — and that gap is
   * exactly what a caller replaying a key would aim at.
   *
   * Keyed on the Account **and** the key: the row is this Account's intent, and
   * the key has to be the one it holds. Either half alone would admit a key that
   * belongs to somebody else.
   */
  const [intent] = await db
    .delete(schema.photoUpload)
    .where(
      and(eq(schema.photoUpload.accountId, accountId), eq(schema.photoUpload.photoKey, photoKey)),
    )
    .returning({ photoKey: schema.photoUpload.photoKey });

  if (!intent) {
    return {
      ok: false,
      error: new AppError({
        code: "photo_key_not_this_accounts",
        status: 403,
        message:
          "attachPhoto was given a well-formed quarantine key that was not minted for this " +
          "Account, or was already attached, or has been swept. Nothing was written. This is " +
          "the check that makes attaching an authorized act rather than a guess — a shape " +
          "check cannot tell one valid key from another.",
        userMessage: PHOTO_NOT_PENDING,
        // No key on the line. It is an opaque identifier, but it is also the
        // value a caller probing this would be varying, and what an operator
        // needs is the count of refusals rather than the strings tried.
        context: {},
      }),
    };
  }

  const [updated] = await db
    .update(schema.capabilityProfile)
    .set({
      photoState: "pending",
      photoKey,
      photoAttachedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.capabilityProfile.accountId, accountId))
    .returning({ id: schema.capabilityProfile.id });

  if (!updated) {
    return {
      ok: false,
      error: new AppError({
        code: "photo_no_profile",
        status: 404,
        message:
          "attachPhoto was called by an Account that holds no CapabilityProfile. Nothing was " +
          "written. A photo attaches to a row that already exists — publishing never waits " +
          "for one, so this is a caller that skipped the publish rather than a race.",
        userMessage: PHOTO_NO_PROFILE,
        context: {},
      }),
    };
  }

  return { ok: true, photoState: "pending" };
}

/**
 * DD6 step 4, both halves, in the order the table at the head of this file
 * fixes: **the object first, then the row and its audit together.**
 */
export async function approvePhoto(
  db: DomainDatabase,
  actor: AdminActor,
  profileId: string,
): Promise<AdminActionOutcome<"approvePhoto">> {
  const [{ runAdminAction }, { promoteToPublic }] = await Promise.all([
    import("#admin/index"),
    import("@repo/storage/photos"),
  ]);

  const waiting = await readPendingKey(db, profileId);
  if (!waiting.ok) return { ok: false, error: waiting.error };

  // Outside the transaction on purpose — see the class comment. The handler
  // re-reads the row under `FOR UPDATE` and refuses if another Admin has moved
  // it since, so this object may be written for a decision that then loses the
  // race; the loser's bytes are an orphan nothing references.
  const { publicKey } = await promoteToPublic(waiting.photoKey);

  return runAdminAction(db, actor, "approvePhoto", { profileId, publicKey });
}

/**
 * DD6 step 5, both halves, the other way round: **the row and its audit first,
 * then the delete.**
 *
 * _"Rejection deletes the object, rather than merely flipping a state. Object
 * storage is a second store, and NFR17's 'deleted' covers rows, objects and
 * logs."_
 *
 * **A delete that fails after the commit is logged and not raised**, because the
 * decision has already been recorded and the photo is already unreachable — the
 * row names no object. What is left is bytes under `quarantine/`, which nothing
 * can read and the bucket's lifecycle rule collects. Raising here would tell an
 * Admin their rejection failed when it did not.
 */
export async function rejectPhoto(
  db: DomainDatabase,
  actor: AdminActor,
  profileId: string,
): Promise<AdminActionOutcome<"rejectPhoto">> {
  const [{ runAdminAction }, { discard }, { logger }] = await Promise.all([
    import("#admin/index"),
    import("@repo/storage/photos"),
    import("@repo/observability/logger"),
  ]);

  const outcome = await runAdminAction(db, actor, "rejectPhoto", { profileId });

  if (!outcome.ok) return outcome;

  try {
    await discard(outcome.result.discardedKey);
  } catch (cause) {
    logger.warn(
      {
        event: "photo.object_not_discarded",
        profile_id: profileId,
        error: cause instanceof Error ? cause.message : String(cause),
      },
      "A rejected photo's row committed but its object was not deleted. The photo is already " +
        "unreachable — the row names no object — and the bucket's lifecycle rule collects it.",
    );
  }

  return outcome;
}

async function readPendingKey(
  db: DomainDatabase,
  profileId: string,
): Promise<
  | { readonly ok: true; readonly photoKey: string }
  | { readonly ok: false; readonly error: AppError }
> {
  const [row] = await db
    .select({
      photoState: schema.capabilityProfile.photoState,
      photoKey: schema.capabilityProfile.photoKey,
    })
    .from(schema.capabilityProfile)
    .where(eq(schema.capabilityProfile.id, BigInt(profileId)))
    .limit(1);

  if (!row || row.photoState !== "pending" || !row.photoKey) {
    return {
      ok: false,
      error: new AppError({
        code: "admin_photo_already_reviewed",
        status: 409,
        message:
          "approvePhoto was asked to publish a photo that is not waiting. Nothing was " +
          "re-encoded and no AdminAction was written. This is the read before the object " +
          "work; the handler repeats it under a lock, which is what settles a race between " +
          "two Admins.",
        userMessage: ADMIN_PHOTO_ALREADY_REVIEWED,
        context: { profile_id: profileId, photo_state: row?.photoState ?? null },
      }),
    };
  }

  return { ok: true, photoKey: row.photoKey };
}

/**
 * **The pooled bindings: what a Server Action calls.**
 *
 * ADR-0010 withholds `#connection`, so `apps/web` has no handle to pass. The
 * dynamic import is the mechanism every other public subpath uses, and for the
 * same reason: `#connection` carries `import "server-only"`, which throws under
 * plain `node`, and a static import here would make this module unimportable at
 * seam 1 and seam 2.
 */
export const photos = {
  async createUpload(
    accountId: string,
    input: { readonly byteLength: number; readonly contentType: string },
  ): Promise<PhotoUploadTicket> {
    const { db } = await import("#connection");
    return createPhotoUpload(db(), accountId, input);
  },

  async attach(accountId: string, photoKey: string) {
    const { db } = await import("#connection");
    return attachPhoto(db(), accountId, photoKey);
  },

  async approve(actor: AdminActor, profileId: string) {
    const { db } = await import("#connection");
    return approvePhoto(db(), actor, profileId);
  },

  async reject(actor: AdminActor, profileId: string) {
    const { db } = await import("#connection");
    return rejectPhoto(db(), actor, profileId);
  },

  async pending(displayCap: number): Promise<PendingPhotoBranch> {
    const { db } = await import("#connection");
    return pendingPhotos(db(), displayCap);
  },

  /**
   * A short-lived signed URL an Admin's browser may fetch one quarantined
   * object from — the only way an unreviewed photo is ever read.
   *
   * It takes no principal, and that is not an exception to the ownership rule:
   * the caller is `/admin/photos`, which has already been through
   * `requireAdminPage`, and the key it passes came out of `pending` above. What
   * makes this safe is that nothing else in the app can reach this subpath with
   * a key it did not get from the queue.
   */
  async reviewUrl(quarantineKey: string): Promise<string> {
    const { presignReview } = await import("@repo/storage/photos");
    return presignReview(quarantineKey);
  },
};
