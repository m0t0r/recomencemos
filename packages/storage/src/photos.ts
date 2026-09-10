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
import { bucketFor, photoStore } from "#client";
import { publicBase, type StorageEnv, transformationsEnabled } from "#config";
import { isPublicKey, isQuarantineKey } from "#key-shapes";
import { mintPublicKey, mintQuarantineKey } from "#keys";
import {
  isUploadableContentType,
  MAX_UPLOAD_BYTES,
  PUBLIC_FORMAT,
  UPLOADABLE_CONTENT_TYPES,
} from "#limits";
import { photoUrl } from "#photo-url";
import { reencodeForPublic } from "#reencode";
import { assertServerOnly } from "#server-only";
import { PHOTO_TOO_LARGE, PHOTO_UNAVAILABLE, PHOTO_UNREADABLE } from "#user-messages";

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
   * **Bounded by two things, and it took both** (#251). It is checked against
   * {@link UPLOADABLE_CONTENT_TYPES} before anything is signed, so the set of
   * types that may be declared is closed; and `content-type` is named in
   * `signableHeaders` below, so the PUT that arrives has to carry the type that
   * was declared. Either half alone leaves a hole — a closed set the store does
   * not enforce, or an enforced declaration that may say anything.
   *
   * **And it is still trusted for none.** It is never read again: the re-encode
   * decides the format from the bytes, because this value is a header on a
   * request the browser composed.
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

  if (!isUploadableContentType(contentType)) {
    throw new AppError({
      code: "photo_content_type_not_allowed",
      status: 415,
      message:
        `createPhotoUpload was asked to sign a PUT declaring "${contentType}", which is not one ` +
        `of ${UPLOADABLE_CONTENT_TYPES.join(", ")}. No URL was signed. The type is signed into ` +
        "the URL, so a declaration the store will hold the request to is also a declaration " +
        "that decides what the stored object is served as — which is why the set it may come " +
        "from is closed here rather than left to the re-encode to notice afterwards.",
      userMessage: PHOTO_UNREADABLE,
      // The declared type, which is a header the browser composed rather than
      // anything about a person. It is the value a caller probing this would be
      // varying, and it is what an operator needs to see.
      context: { content_type: contentType },
    });
  }

  const [{ PutObjectCommand }, { getSignedUrl }, { client, quarantineBucket }] = await Promise.all([
    import("@aws-sdk/client-s3"),
    import("@aws-sdk/s3-request-presigner"),
    photoStore(env),
  ]);

  const photoKey = mintQuarantineKey();

  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: quarantineBucket,
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
      // human ever saw published to the anonymously-readable bucket. Same
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
    {
      expiresIn: UPLOAD_URL_TTL_SECONDS,
      // **`ContentType` on the command above does not sign anything, and this
      // is what makes it a control rather than a claim** (#251).
      //
      // `@aws-sdk/s3-request-presigner` adds `content-type` to
      // `unsignableHeaders` *unconditionally* — there is no branch above the
      // line and both presign paths reach it — so the type lands in the
      // canonical request and then never appears in `X-Amz-SignedHeaders`. The
      // store therefore checks nothing about it, and a holder of the URL could
      // declare `image/webp` to us and PUT `text/html` of the declared length.
      // `@smithy/signature-v4` lets `signableHeaders` override that list, and
      // `getSignedUrl` forwards the option through; this is the whole of the
      // fix.
      //
      // Measured against the MinIO in `docker-compose.yaml` rather than read
      // off a changelog: without the option the signed headers are
      // `content-length;host;if-none-match` and the mismatched PUT answers 200;
      // with it they are `content-length;content-type;host;if-none-match`, the
      // mismatched PUT answers 403, and the matching one still answers 200.
      // `photos.store.test.ts` holds all three.
      //
      // It binds the request to its own declaration and bounds nothing by
      // itself — the closed set the declaration comes from is
      // `UPLOADABLE_CONTENT_TYPES`, checked above.
      signableHeaders: new Set(["content-type"]),
    },
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

  const [{ GetObjectCommand }, { getSignedUrl }, { client, quarantineBucket }] = await Promise.all([
    import("@aws-sdk/client-s3"),
    import("@aws-sdk/s3-request-presigner"),
    photoStore(env),
  ]);

  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: quarantineBucket, Key: quarantineKey }),
    { expiresIn: REVIEW_URL_TTL_SECONDS },
  );
}

/**
 * The store's own name for the bytes that are under a key **now**.
 *
 * **What it is for is a comparison later, not a check now.** An object in
 * quarantine is written by a browser holding a presigned URL and read again, by
 * us, at approval — two moments with a person's decision between them. Recording
 * the identity at the first moment is what lets the second one refuse bytes
 * nobody looked at; there is nothing this answer is useful for on its own.
 *
 * **The value is opaque and is never parsed.** S3 returns the ETag quoted, and
 * that quoted form is what is stored and what is compared — an unwrapped one
 * would have to be re-wrapped before it could be sent back as `If-Match`, and a
 * value that is normalised in one place and not the other is how a comparison
 * silently starts answering `false`. What produces it is the store's business:
 * a single `PutObject` makes it a content digest and a multipart upload does
 * not, and neither this function nor its caller has an opinion about which.
 *
 * **An ETag the *client* reported would be worthless here**, which is why this
 * is a request of our own rather than a value carried up from the PUT the
 * browser performed. A holder who means to swap the object reports the second
 * object's identity from the start, and the comparison then passes on exactly
 * the bytes it exists to refuse.
 */
export async function quarantinedEtag(
  quarantineKey: string,
  env: StorageEnv = process.env,
): Promise<string> {
  if (!isQuarantineKey(quarantineKey)) {
    throw new AppError({
      code: "photo_key_not_quarantined",
      status: 422,
      message:
        "quarantinedEtag was given a key that is not a quarantine key. Nothing was read. The " +
        "key round-trips through a browser before it reaches here, so a traversal has to be " +
        "refused before it becomes part of a request rather than after.",
      userMessage: PHOTO_UNAVAILABLE,
      context: {},
    });
  }

  const [{ HeadObjectCommand }, { client, quarantineBucket }] = await Promise.all([
    import("@aws-sdk/client-s3"),
    photoStore(env),
  ]);

  const head = await client
    .send(new HeadObjectCommand({ Bucket: quarantineBucket, Key: quarantineKey }))
    .catch((cause: unknown) => {
      throw objectMissing("quarantinedEtag", cause);
    });

  if (!head.ETag) {
    throw new AppError({
      code: "photo_store_returned_no_etag",
      status: 502,
      message:
        "The object store answered a HEAD without an ETag, so there is nothing to record as " +
        "the identity of these bytes and nothing to compare at approval. Nothing was written. " +
        "Every store this runs against returns one; an answer without it is a store this code " +
        "has not met, and guessing an identity would be worse than refusing to have one.",
      userMessage: PHOTO_UNAVAILABLE,
      context: {},
    });
  }

  return head.ETag;
}

/**
 * The one refusal both object reads share, so a caller cannot tell a missing
 * object from an unreadable one — and neither can a log line pretend to.
 */
function objectMissing(caller: string, cause?: unknown): AppError {
  return new AppError({
    code: "photo_object_missing",
    status: 404,
    message:
      `${caller} could not read the quarantined object it was given a key for, so it did ` +
      "nothing. Either the object was collected by a lifecycle rule, or the browser's upload " +
      "never completed, or the database and the object store have diverged — which is what " +
      "restoring one of them without the other does.",
    userMessage: PHOTO_UNAVAILABLE,
    context: {},
    ...(cause === undefined ? {} : { cause }),
  });
}

/**
 * Whether the store refused a conditional read because the condition did not
 * hold, rather than for any other reason.
 *
 * **Read off the HTTP status and not off the name.** `PreconditionFailed` is
 * what the AWS SDK models and what MinIO answers with, but the error a caller
 * gets back is shaped by whichever store is behind the endpoint — and a
 * mismatch that fell through to the missing-object refusal would be reported to
 * an operator as divergence between the two stores, which is the wrong incident
 * entirely.
 */
function isPreconditionFailed(cause: unknown): boolean {
  const status = (cause as { $metadata?: { httpStatusCode?: number } } | null)?.$metadata
    ?.httpStatusCode;

  return status === 412 || (cause as { name?: string } | null)?.name === "PreconditionFailed";
}

/**
 * The object under this key is not the object whose identity was recorded.
 *
 * **It is a refusal rather than a fault**, and the caller returns it rather than
 * letting it escape: a person decided on bytes, the bytes are different, and
 * nothing about that is broken. The `code` is what an operator alerts on — this
 * is reachable only by overwriting a quarantined object between an attach and an
 * Admin's decision, which is either an attempt at the swap or a Worker replacing
 * her photo, and the second one does not exist yet.
 */
function objectChanged(cause?: unknown): AppError {
  return new AppError({
    code: "photo_object_changed",
    status: 409,
    message:
      "The quarantined object is not the one that was recorded when this photo was attached, " +
      "so the bytes an Admin looked at are not the bytes this would publish. Nothing was " +
      "decoded and nothing was written under the public prefix. A presigned PUT authorises one " +
      "write, so reaching this means either that condition was not honoured or the object was " +
      "written by something else holding the store's credential.",
    userMessage: PHOTO_UNAVAILABLE,
    // No ETag and no key. Both are identifiers rather than anything of hers, but
    // what an operator needs is that this happened and to which profile — and
    // the profile is named by the caller, which is the layer that knows there is
    // one.
    context: {},
    ...(cause === undefined ? {} : { cause }),
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
 *
 * **`expectedEtag` is what binds the bytes an Admin decided on to the bytes this
 * publishes.** The object under a quarantine key is mutable: the queue renders
 * it once and this reads it again, so without an identity recorded at attach
 * time the two are reads of a *key* rather than of an object, and whatever is
 * under it at this instant reaches the anonymously-readable bucket. That is the
 * one thing the review gate exists to prevent.
 *
 * **Two mechanisms, and the second is the one that is load-bearing.** `If-Match`
 * on the read makes the refusal the store's, so mismatched bytes never cross the
 * wire; the comparison below is what holds when the store does not honour a
 * conditional read. That is not a hypothetical distrust — the single-write
 * property of the presigned PUT rests on a conditional `PutObject` that has been
 * measured against the local store and is an open question against the
 * production one, so a control that assumes the same class of behaviour would
 * fail in the same weather.
 *
 * **Either way it refuses before `reencodeForPublic` is reached**, so nothing is
 * decoded, nothing is written under the public prefix, and the caller's
 * transaction never opens.
 */
export async function promoteToPublic(
  quarantineKey: string,
  expectedEtag: string,
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

  if (!expectedEtag) {
    throw new AppError({
      code: "photo_object_unidentified",
      status: 422,
      message:
        "promoteToPublic was given no identity to hold the object to. Nothing was read and " +
        "nothing was written. An empty expectation cannot be checked, and treating an " +
        "unanswerable check as a passed one would publish whatever is under the key at this " +
        "instant — so it refuses instead.",
      userMessage: PHOTO_UNAVAILABLE,
      context: {},
    });
  }

  // Minted fresh rather than derived. See `mintPublicKey`: a derived public key
  // is an oracle for the private one, published on every Wall card.
  const publicKey = mintPublicKey();

  const [{ GetObjectCommand, PutObjectCommand }, { client, publicBucket, quarantineBucket }] =
    await Promise.all([import("@aws-sdk/client-s3"), photoStore(env)]);

  // The one operation that crosses. Everything the review gate is for happens
  // between these two lines: bytes leave the bucket nobody can read, are decoded
  // and re-encoded here, and what is written to the readable one is a different
  // object in a format this repository produced.
  const object = await client
    .send(
      new GetObjectCommand({
        Bucket: quarantineBucket,
        Key: quarantineKey,
        IfMatch: expectedEtag,
      }),
    )
    .catch((cause: unknown) => {
      if (isPreconditionFailed(cause)) throw objectChanged(cause);

      throw objectMissing("promoteToPublic", cause);
    });

  /**
   * **The same refusal a second time, and the repetition is the point.** The
   * condition above is enforced by the store; this is enforced here. A store
   * that quietly ignored `If-Match` — the failure mode the conditional PUT is
   * an open question about — would answer 200 with the swapped bytes, and this
   * is the line that still refuses them.
   */
  if (object.ETag !== expectedEtag) throw objectChanged();

  if (!object.Body) {
    throw objectMissing("promoteToPublic");
  }

  const { bytes, width, height } = await reencodeForPublic(
    Buffer.from(await object.Body.transformToByteArray()),
  );

  await client.send(
    new PutObjectCommand({
      Bucket: publicBucket,
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

  const [{ DeleteObjectCommand }, store] = await Promise.all([
    import("@aws-sdk/client-s3"),
    photoStore(env),
  ]);

  // Either prefix arrives here, so the bucket is read off the key rather than
  // chosen — `bucketFor` is the one place that decides, and the shape check
  // above is what guarantees it is deciding between two known answers.
  const bucket = bucketFor(store, key);

  // S3 delete is idempotent — a key that is already gone is a 204, not a 404 —
  // so a retried rejection and a rejection of an object a lifecycle rule already
  // collected both succeed. That is what lets the caller treat this as part of
  // an act that must complete rather than as one that might have to be undone.
  await store.client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
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
