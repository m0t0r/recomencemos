/**
 * `@repo/storage/photos` — the five things anything outside this package may do
 * to a photo object, and nothing else.
 *
 * **The five map onto DD6's five steps**, which is why they are these five and
 * not a general-purpose object-store facade: presign the quarantine PUT (step
 * 2), read a quarantined object back so an Admin can decide, promote it into
 * the public prefix through the re-encode (step 4), discard it (step 5), and
 * remove a published one when a profile is taken down or purged. Step 1 is the
 * browser's and step 3 is a row, so neither is here.
 *
 * **Nothing in this module knows what a CapabilityProfile is**, and that is the
 * split that makes it a seam: `@repo/domain` owns the rows and the states and
 * calls these; this owns bytes and keys and calls nothing back. A key carries no
 * Account id for the same reason.
 */

import { AppError } from "@repo/errors/app-error";
import { photoStore } from "#client";
import { publicBase, type StorageEnv, transformationsEnabled } from "#config";
import { isPublicKey, isQuarantineKey } from "#key-shapes";
import { mintPublicKey, mintQuarantineKey } from "#keys";
import { MAX_UPLOAD_BYTES, PUBLIC_FORMAT } from "#limits";
import { photoUrl } from "#photo-url";
import { reencodeForPublic } from "#reencode";
import { assertServerOnly } from "#server-only";
import { PHOTO_TOO_LARGE, PHOTO_UNAVAILABLE } from "#user-messages";

assertServerOnly("photos");

export { missingConfig } from "#config";
/**
 * Re-exported so a caller validating a key it received from a browser does not
 * have to reach for a second subpath — `@repo/domain`'s `attachPhoto` is the
 * one that needs it, and the key it checks round-trips through the client
 * between `createPhotoUpload` and the attach.
 */
export { isPublicKey, isQuarantineKey } from "#key-shapes";

/**
 * How long a presigned PUT is good for.
 *
 * **Short, because the URL is a write capability and it travels to a browser.**
 * Five minutes is long enough for a 2 MB upload on a poor mobile connection —
 * DD6's premise — and short enough that a URL captured from a shared device's
 * history is worthless. She has as long as she likes to pick a photo; the clock
 * starts when she has picked one.
 */
export const UPLOAD_URL_TTL_SECONDS = 5 * 60;

/**
 * How long an Admin's read of a quarantined object is good for.
 *
 * **One minute, and the shortness is the point.** This is the only signed read
 * of an unreviewed photo that exists, so it is the one URL that, if it leaked,
 * would make NFR6's count non-zero. It is minted per render of the queue and
 * needs to survive exactly one image request.
 */
export const REVIEW_URL_TTL_SECONDS = 60;

export interface PresignedUpload {
  /** The URL the browser PUTs to. A write capability: never logged, never stored. */
  readonly uploadUrl: string;
  /** The key the row records. Opaque, server-generated, and safe on a log line. */
  readonly photoKey: string;
  readonly expiresInSeconds: number;
}

export interface PresignUploadInput {
  /**
   * The exact byte length the browser will send.
   *
   * **It is signed into the URL**, which is what makes DD6's 2 MB ceiling a
   * property of the bucket rather than of our code: the signature covers
   * `Content-Length`, so a client that sends more bytes than it declared has
   * produced a request the store rejects. A ceiling enforced only in the action
   * would be a ceiling the presigned URL let anyone walk past.
   */
  readonly byteLength: number;
  /**
   * What the browser says it is sending.
   *
   * **Signed for the same reason and trusted for none.** It bounds what may be
   * PUT and it is never read again: the re-encode decides the format from the
   * bytes, because this value is a header on a request the browser composed.
   */
  readonly contentType: string;
}

/**
 * A URL the browser may PUT one photo to, and the key that will name it.
 *
 * **The refusal is returned as a throw and the caller turns it into a returned
 * refusal**, which is the division CLAUDE.md draws: a photo over the ceiling is
 * an ordinary answer to an ordinary form, so `createPhotoUpload` in
 * `@repo/domain` catches this and answers with a value. What is thrown here is
 * the operator-facing half.
 */
export async function presignUpload(
  { byteLength, contentType }: PresignUploadInput,
  env: StorageEnv = process.env,
): Promise<PresignedUpload> {
  if (!Number.isInteger(byteLength) || byteLength <= 0 || byteLength > MAX_UPLOAD_BYTES) {
    throw new AppError({
      code: "photo_over_byte_ceiling",
      status: 413,
      message:
        `createPhotoUpload was asked to sign a PUT for ${byteLength} bytes, and the ceiling is ` +
        `${MAX_UPLOAD_BYTES}. No URL was signed. The browser downscales before it asks, so a ` +
        "value outside the range means either the downscale did not run or the caller is not a " +
        "browser of ours.",
      userMessage: PHOTO_TOO_LARGE,
      context: { byte_length: byteLength, ceiling: MAX_UPLOAD_BYTES },
    });
  }

  const [{ PutObjectCommand }, { getSignedUrl }, { client, bucket }] = await Promise.all([
    import("@aws-sdk/client-s3"),
    import("@aws-sdk/s3-request-presigner"),
    photoStore(env),
  ]);

  const photoKey = mintQuarantineKey();

  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: photoKey,
      ContentLength: byteLength,
      ContentType: contentType,
      // **`If-None-Match: *` is what makes this URL a single write rather than a
      // window, and it is load-bearing rather than defensive.**
      //
      // A SigV4 presigned URL is a bearer capability with no replay protection
      // of its own, and `PutObject` overwrites — so without the condition this
      // authorises *N* writes to one key for as long as it lives. That defeats
      // the review gate rather than merely widening it: the Admin's queue reads
      // the object once to render it and `promoteToPublic` reads it *again* on
      // approval, so a holder who overwrites between the two gets bytes no
      // human ever saw published to the anonymously-readable prefix. Same
      // length and same content type, both of which the signature pins, are the
      // holder's own declared values and are trivially matched.
      //
      // The condition is a *signed* header, so it lands in
      // `X-Amz-SignedHeaders` and a client cannot drop it: omitting it
      // invalidates the signature. The browser therefore has to send it, which
      // is why the `fetch` on the publish surface does.
      //
      // Measured against the MinIO in `docker-compose.yaml` rather than read
      // off a changelog: with the condition, the first PUT answers 200 and a
      // replay answers 412; without it, the replay answers 200.
      IfNoneMatch: "*",
    }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS },
  );

  return { uploadUrl, photoKey, expiresInSeconds: UPLOAD_URL_TTL_SECONDS };
}

/**
 * A short-lived URL that may GET one quarantined object.
 *
 * **This is the only way an unreviewed photo is ever fetched, and NFR6 survives
 * it because the capability is the signature rather than the path.** The
 * requirement counts objects retrievable by an *unauthenticated* request; every
 * URL this mints is produced server-side, inside a render that has already
 * established who is asking, and expires in a minute.
 *
 * **There are exactly two callers and they are the two people the spec lets see
 * an unreviewed photo.** The Admin, on `/admin/photos`, because deciding
 * requires looking. And **the Worker herself**, on `/my-profile`, because the
 * spec's own cell for that surface is _"photo pending → **her own photo
 * shown**, dignified, described as under review, not flagged"_ — her face is
 * not a suspect object to her. Both reads are scoped by the caller above:
 * `requireAdminPage` for one, and a key read from her own row for the other.
 */
export async function presignReview(
  quarantineKey: string,
  env: StorageEnv = process.env,
): Promise<string> {
  if (!isQuarantineKey(quarantineKey)) {
    throw new AppError({
      code: "photo_key_not_quarantined",
      status: 422,
      message:
        "presignReview was given a key that is not a quarantine key. It signs a read of an " +
        "unreviewed object, so it will not sign a read of anything else — a public key here " +
        "would be a signed URL for an object that needs none, and any other string is a row " +
        "this repository did not write.",
      userMessage: PHOTO_UNAVAILABLE,
      context: {},
    });
  }

  const [{ GetObjectCommand }, { getSignedUrl }, { client, bucket }] = await Promise.all([
    import("@aws-sdk/client-s3"),
    import("@aws-sdk/s3-request-presigner"),
    photoStore(env),
  ]);

  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: quarantineKey }), {
    expiresIn: REVIEW_URL_TTL_SECONDS,
  });
}

export interface PromotedPhoto {
  readonly publicKey: string;
  readonly width: number;
  readonly height: number;
  readonly byteLength: number;
}

/**
 * DD6 step 4: read the quarantined object, re-encode it, and write the result
 * into the public prefix.
 *
 * **It does not delete the quarantined object**, and that is deliberate rather
 * than an omission. Deleting is `discard`'s job and it is called on the
 * rejection path; on approval the original is what an operator would need if the
 * re-encode ever turned out to be wrong, and the bucket's own lifecycle rule
 * (runbook §3) is what eventually collects it. Two irreversible acts in one
 * function is one more than this needs.
 *
 * **It is called before the audit transaction opens, not inside it.** A network
 * round trip and a libvips decode inside an open Postgres transaction holds a
 * pooled connection for the length of both, and the pool is ten (`POOL_MAX`).
 * The ordering that follows — object first, row second — is what makes a failed
 * transaction leave an orphaned public object rather than a row pointing at
 * nothing, and that is the right way round: an object nothing references is
 * collected, while a row referencing a missing object is a broken image on
 * somebody's profile.
 */
export async function promoteToPublic(
  quarantineKey: string,
  env: StorageEnv = process.env,
): Promise<PromotedPhoto> {
  if (!isQuarantineKey(quarantineKey)) {
    throw new AppError({
      code: "photo_key_not_quarantined",
      status: 422,
      message:
        "promoteToPublic was given a key that is not a quarantine key. Nothing was read and " +
        "nothing was written. The validation used to be implicit in deriving the public key " +
        "from this one; the two are now independent, so it is stated.",
      userMessage: PHOTO_UNAVAILABLE,
      context: {},
    });
  }

  // Minted fresh rather than derived. See `mintPublicKey`: a derived public key
  // is an oracle for the private one, published on every Wall card.
  const publicKey = mintPublicKey();

  const [{ GetObjectCommand, PutObjectCommand }, { client, bucket }] = await Promise.all([
    import("@aws-sdk/client-s3"),
    photoStore(env),
  ]);

  const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: quarantineKey }));

  if (!object.Body) {
    throw new AppError({
      code: "photo_object_missing",
      status: 404,
      message:
        "The quarantined object named by this row is not in the bucket. Nothing was promoted. " +
        "Either it was collected by a lifecycle rule before anyone reviewed it, or the database " +
        "and the object store have diverged — which is what restoring one of them without the " +
        "other does.",
      userMessage: PHOTO_UNAVAILABLE,
      context: {},
    });
  }

  const { bytes, width, height } = await reencodeForPublic(
    Buffer.from(await object.Body.transformToByteArray()),
  );

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: publicKey,
      Body: bytes,
      ContentType: `image/${PUBLIC_FORMAT}`,
      // Immutable because nothing ever writes this key twice: it was minted
      // fresh a few lines above and is written once, and a re-review mints
      // another. (It is *not* derived from the content — deriving it was the
      // defect `mintPublicKey` exists to have removed, so the old wording here
      // named a property this code deliberately no longer has.) Cloudflare
      // caches the transformation on top of this.
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return { publicKey, width, height, byteLength: bytes.byteLength };
}

/**
 * DD6 step 5: **rejection deletes the object**, rather than merely flipping a
 * state.
 *
 * _"Object storage is a second store, and NFR17's 'deleted' covers rows, objects
 * and logs."_ A rejected photo that stays in the bucket is a photo of a person
 * we were asked not to publish, kept indefinitely because a column said
 * `rejected` — which is the exact shape of the retention failure NFR17 is
 * about.
 *
 * It takes either prefix, because the same act is needed on a takedown of an
 * already-published photo and on the purge that follows an erasure request.
 */
export async function discard(key: string, env: StorageEnv = process.env): Promise<void> {
  if (!isQuarantineKey(key) && !isPublicKey(key)) {
    throw new AppError({
      code: "photo_key_unrecognised",
      status: 422,
      message:
        "discard was given a key this repository did not mint. Nothing was deleted. A delete " +
        "built from an unvalidated string is how one row's key reaches another row's object.",
      userMessage: PHOTO_UNAVAILABLE,
      context: {},
    });
  }

  const [{ DeleteObjectCommand }, { client, bucket }] = await Promise.all([
    import("@aws-sdk/client-s3"),
    photoStore(env),
  ]);

  // S3 delete is idempotent — a key that is already gone is a 204, not a 404 —
  // so a retried rejection and a rejection of an object a lifecycle rule already
  // collected both succeed. That is what lets the caller treat this as part of
  // an act that must complete rather than as one that might have to be undone.
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/**
 * Where an approved photo is read, or `null`.
 *
 * A thin pass through `#photo-url` so that a server caller needs only the key
 * and the width — the transformation origin comes from this deploy's
 * environment, which no caller should be reading for itself.
 */
export function publicPhotoUrl(
  key: string,
  width?: number,
  env: StorageEnv = process.env,
): string | null {
  return photoUrl({
    key,
    base: publicBase(env),
    transformations: transformationsEnabled(env),
    ...(width === undefined ? {} : { width }),
  });
}
