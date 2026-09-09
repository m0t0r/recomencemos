/**
 * Where the bucket is, and who this process is to it.
 *
 * Pure over an environment record, for the reason `@repo/domain/src/config.ts`
 * and `@repo/notifications/src/config.ts` both give: a decision checked once and
 * then trusted forever belongs at seam 1, with a test, rather than inside the
 * module that acts on it. Nothing here opens a connection or signs anything.
 *
 * **The names follow `UI_PROOF_S3_*`**, which is the repository's existing
 * spelling for "an S3-compatible store, addressed by endpoint". They are a
 * different store with a different lifetime and a different key, so they are
 * more variables rather than a reuse of those.
 */

import { AppError } from "@repo/errors/app-error";
import { PHOTO_UNAVAILABLE } from "#user-messages";

/** The account endpoint. R2 has no regions, so the endpoint is the whole address. */
export const ENDPOINT_VARIABLE = "PHOTO_S3_ENDPOINT";

/**
 * The bucket approved photos live in, and the one that is publicly readable.
 *
 * Public access on R2 is a **bucket-level switch** — there is no per-prefix ACL
 * and no S3-style bucket policy behind it — so "publicly readable" is a property
 * this bucket has in whole, and anything that must not be readable cannot be in
 * it. That is the sentence {@link QUARANTINE_BUCKET_VARIABLE} exists for.
 */
export const BUCKET_VARIABLE = "PHOTO_S3_BUCKET";

/**
 * The bucket unreviewed photos live in, whose public access is never turned on.
 *
 * **A second bucket rather than a second prefix, and the difference is what
 * NFR6 rests on** (#251). _"0 unmoderated photo objects are retrievable by an
 * unauthenticated request"_ used to be stated as a policy on the `quarantine/`
 * prefix — which MinIO can express and R2 cannot. Since `PHOTO_PUBLIC_BASE` is
 * a bucket root and a key carries its own prefix, `${base}/quarantine/<key>`
 * was a URL anybody could construct, and whether it served bytes turned on a
 * per-prefix rule with no R2 mechanism under it. Keys still carry their
 * prefixes — they are how a caller tells the two apart, and how one bucket is
 * chosen over the other — but the refusal is now the absence of the object
 * rather than a rule about its name.
 *
 * It is **required**, not optional. A deploy that leaves it unset would have
 * nowhere to put an unreviewed photo, and the fallback nobody wants is the one
 * that quietly puts it in the readable bucket.
 */
export const QUARANTINE_BUCKET_VARIABLE = "PHOTO_S3_QUARANTINE_BUCKET";

/** The credential. `fly secrets` in production (NFR24), never a `.env` in this repo. */
export const ACCESS_KEY_VARIABLE = "PHOTO_S3_ACCESS_KEY_ID";
export const SECRET_KEY_VARIABLE = "PHOTO_S3_SECRET_ACCESS_KEY";

/**
 * The origin an approved photo is read through — a Cloudflare zone with image
 * transformations enabled, **not** the bucket's own endpoint.
 *
 * DD6 is explicit that this is what NFR3's image clause actually turns on:
 * resizing happens at Cloudflare's edge and _"never on the Fly machine — the
 * same CPU and memory that DD7 already names as a saturating resource"_. The
 * variable exists rather than being derived from the endpoint because the two
 * are genuinely different hosts, and because a deploy whose zone is not yet
 * configured (runbook §3) has to be able to say so.
 */
export const PUBLIC_BASE_VARIABLE = "PHOTO_PUBLIC_BASE";

/**
 * Whether the origin above is a Cloudflare zone with image transformations
 * **explicitly enabled** — DD6's first precondition, and a dashboard step
 * rather than a code change (NFR28, runbook §3).
 *
 * **A variable rather than an inference from the origin.** No pattern
 * distinguishes a zone with transformations on from one with them off, and
 * guessing is the shape [ADR-0006](../../../docs/adr/0006-name-the-exposure-rather-than-ship-a-heuristic.md)
 * refuses: guess wrong one way and every visitor gets a 404 where a face should
 * be, guess wrong the other and 1600 px images go into a phone grid and NFR3 is
 * missed with nothing saying so.
 *
 * **It is off unless it is on**, which is the same direction
 * `NOTIFICATIONS_KILL_SWITCH` is read in and for a related reason: the harm of
 * being wrong is asymmetric. Off serves a correct photo slowly; on serves
 * nothing at all.
 */
export const TRANSFORMATIONS_VARIABLE = "PHOTO_TRANSFORMATIONS";

/**
 * R2 has no regions, but the S3 protocol requires one in the signature, so
 * `auto` is what Cloudflare's own documentation specifies. Not a default this
 * repository chose, and not a value an operator sets — the same sentence
 * `scripts/ui-proof-store.mjs` carries, because it is the same fact.
 */
export const REGION = "auto";

export type StorageEnv = Readonly<Partial<Record<string, string>>>;

export interface StorageConfig {
  readonly endpoint: string;
  /**
   * Named rather than left as `bucket`, because after the split an unqualified
   * name is how a later call site reaches for the wrong store — and the wrong
   * store here is the readable one.
   */
  readonly publicBucket: string;
  readonly quarantineBucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly region: typeof REGION;
}

const REQUIRED = [
  ENDPOINT_VARIABLE,
  BUCKET_VARIABLE,
  QUARANTINE_BUCKET_VARIABLE,
  ACCESS_KEY_VARIABLE,
  SECRET_KEY_VARIABLE,
] as const;

/**
 * The variables this package needs and does not have.
 *
 * **A question a caller can ask before it starts a flow**, which is what
 * `createPhotoUpload` uses it for: a deploy whose bucket is not configured yet
 * refuses at the top of the action with one `warn` line, rather than presenting
 * a picker whose upload fails on a signature it could never have produced.
 */
export function missingConfig(env: StorageEnv = process.env): readonly string[] {
  return REQUIRED.filter((name) => !env[name]);
}

/**
 * The configuration, or an `AppError` that says which half is absent.
 *
 * **It throws rather than returning a refusal, and that is the right way round
 * here.** NFR26's return-don't-throw rule is about a *refusal* — an ordinary
 * answer to an ordinary request, which a crawler could produce at will. An
 * unconfigured bucket is none of those things: it is this deploy being wrong,
 * it happens on every request rather than on a caller's whim, and it has
 * earned its Sentry event. `@repo/domain`'s rate limiter draws the same line in
 * the same place, and for the same reason.
 */
export function storageConfig(env: StorageEnv = process.env): StorageConfig {
  const missing = missingConfig(env);

  if (missing.length > 0) {
    throw new AppError({
      code: "photo_storage_unconfigured",
      status: 503,
      message:
        `The photo store is not configured: ${missing.join(", ")} unset. No object can be ` +
        "written or read until it is. Both buckets are created by hand, once, before a deploy " +
        "can accept a photo.",
      userMessage: PHOTO_UNAVAILABLE,
      // The names of absent variables, never a value: one of the five is a
      // secret, and a line naming which are set is a line naming which are not.
      context: { missing: [...missing] },
    });
  }

  return {
    endpoint: env[ENDPOINT_VARIABLE] as string,
    publicBucket: env[BUCKET_VARIABLE] as string,
    quarantineBucket: env[QUARANTINE_BUCKET_VARIABLE] as string,
    accessKeyId: env[ACCESS_KEY_VARIABLE] as string,
    secretAccessKey: env[SECRET_KEY_VARIABLE] as string,
    region: REGION,
  };
}

/**
 * The transformation origin, without its trailing slash, or `null`.
 *
 * **`null` rather than a throw, because this one is allowed to be absent.**
 * Runbook §3 says the zone and the transformation toggle are a dashboard step,
 * and DD6 says photos _"serve at full size until it is done"_ — so a deploy with
 * a bucket and no zone is a real and intended state, and the reader's answer to
 * it is to fall back rather than to fail. The bucket, which nothing can work
 * without, is the one that throws.
 */
export function publicBase(env: StorageEnv = process.env): string | null {
  const base = env[PUBLIC_BASE_VARIABLE]?.trim();

  if (!base) return null;

  return base.replace(/\/+$/, "");
}

/**
 * The values that turn transformations **on**. Everything else — unset, empty,
 * a typo — leaves them off.
 *
 * The direction is chosen rather than defaulted, and it is the opposite way
 * round from `NOTIFICATIONS_KILL_SWITCH`, which anything engages. The asymmetry
 * is the same argument read against a different harm: a kill switch someone
 * believes is on and isn't costs an irreversible send, while transformations
 * someone believes are on and aren't cost a 404 where every face should be.
 * Each variable fails towards the outcome that is recoverable.
 */
const TRANSFORMATIONS_ON = new Set(["1", "on", "true", "yes"]);

/** Whether this deploy's origin will serve a `/cdn-cgi/image/…` path (runbook §3). */
export function transformationsEnabled(env: StorageEnv = process.env): boolean {
  return TRANSFORMATIONS_ON.has((env[TRANSFORMATIONS_VARIABLE] ?? "").trim().toLowerCase());
}
