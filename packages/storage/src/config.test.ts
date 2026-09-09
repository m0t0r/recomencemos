/**
 * The two-bucket split at seam 1 — the half that runs in `pnpm test`, on a
 * machine with no Docker and in CI.
 *
 * **`photos.store.test.ts` proves the store refuses; this proves we ask the
 * right store.** That file needs a running MinIO and is deliberately outside
 * the required checks, so without this one nothing green in CI would exercise
 * the split at all: a build that resolved both buckets to the same string, or
 * dropped the quarantine variable back to optional, would pass every gate.
 *
 * Pure over an environment record, which is the shape `#config` was written in
 * for exactly this reason: nothing here opens a connection or signs anything.
 */

import { bucketFor, type PhotoStore } from "#client";
import { missingConfig, QUARANTINE_BUCKET_VARIABLE, storageConfig } from "#config";
import { mintPublicKey, mintQuarantineKey } from "#keys";
import { UPLOADABLE_CONTENT_TYPES } from "#limits";

const COMPLETE = {
  PHOTO_S3_ENDPOINT: "https://example.r2.cloudflarestorage.com",
  PHOTO_S3_BUCKET: "photos",
  PHOTO_S3_QUARANTINE_BUCKET: "photos-quarantine",
  PHOTO_S3_ACCESS_KEY_ID: "an-id",
  PHOTO_S3_SECRET_ACCESS_KEY: "a-secret",
} as const;

describe("the quarantine bucket variable", () => {
  /**
   * **Required rather than optional, and this is the assertion that keeps it
   * so.** An optional one would need a fallback, and the only fallback
   * available is the bucket that is readable by anybody — so a deploy that
   * forgot to set it would put unreviewed photos exactly where the review gate
   * exists to keep them out of.
   */
  it("is missing from a configuration that does not set it", () => {
    const { PHOTO_S3_QUARANTINE_BUCKET: _absent, ...withoutIt } = COMPLETE;

    expect(missingConfig(withoutIt)).toContain(QUARANTINE_BUCKET_VARIABLE);
  });

  it("leaves nothing missing once every variable is set", () => {
    expect(missingConfig(COMPLETE)).toEqual([]);
  });

  it("refuses to resolve a configuration without it, rather than defaulting", () => {
    const { PHOTO_S3_QUARANTINE_BUCKET: _absent, ...withoutIt } = COMPLETE;

    expect(() => storageConfig(withoutIt)).toThrow();
  });

  it("resolves the two buckets to the two variables, and does not cross them", () => {
    const config = storageConfig(COMPLETE);

    expect(config.publicBucket).toBe(COMPLETE.PHOTO_S3_BUCKET);
    expect(config.quarantineBucket).toBe(COMPLETE.PHOTO_S3_QUARANTINE_BUCKET);
  });

  /**
   * The names of the absent variables reach a log line, so what must never be
   * there is a value — and one of the five is the secret access key.
   */
  it("names the variables it is missing and quotes none of their values", () => {
    const missing = missingConfig({ PHOTO_S3_BUCKET: "photos" });

    expect(missing).not.toContain("photos");
    expect(missing.every((name) => name.startsWith("PHOTO_S3_"))).toBe(true);
  });
});

describe("bucketFor", () => {
  const STORE = {
    client: undefined as unknown as PhotoStore["client"],
    publicBucket: "photos",
    quarantineBucket: "photos-quarantine",
  } satisfies PhotoStore;

  it("sends a public key to the bucket a stranger can read", () => {
    expect(bucketFor(STORE, mintPublicKey())).toBe(STORE.publicBucket);
  });

  it("sends a quarantine key to the bucket nobody can read", () => {
    expect(bucketFor(STORE, mintQuarantineKey())).toBe(STORE.quarantineBucket);
  });

  /**
   * **The direction of the only mistake it can make.** A key of neither shape
   * is refused by every caller before it reaches here, so this is a backstop —
   * but a backstop that fell the other way would publish an unreviewed object
   * on a spelling error, and the cost of being wrong this way is an object
   * nobody can read.
   */
  it.each([
    ["an empty string", ""],
    ["a traversal", "quarantine/../photos/x"],
    ["a near-miss on the public prefix", "photo/aaaaaaaaaaaaaaaaaaaaa.webp"],
    ["a bare key with no prefix", "aaaaaaaaaaaaaaaaaaaaa"],
  ])("sends %s to the bucket nobody can read", (_name, key) => {
    expect(bucketFor(STORE, key)).toBe(STORE.quarantineBucket);
  });
});

describe("the types a presigned PUT may declare", () => {
  /**
   * The set is derived from the decoder's rather than written out, and this is
   * what that derivation buys: widening one widens the other, so a type can
   * never be declarable and undecodable or the reverse.
   */
  it("is exactly the decoder's formats, spelled as image types", () => {
    expect([...UPLOADABLE_CONTENT_TYPES]).toEqual([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/avif",
      "image/heif",
    ]);
  });

  /**
   * The three a browser can actually produce. `canvas.toBlob` is asked for WebP
   * with JPEG behind it and silently answers PNG when it supports neither, so
   * all three have to be declarable or a real phone is refused a photo it
   * downscaled correctly.
   */
  it.each(["image/webp", "image/jpeg", "image/png"])(
    "admits %s, which a canvas produces",
    (type) => {
      expect(UPLOADABLE_CONTENT_TYPES).toContain(type);
    },
  );

  it.each(["text/html", "image/svg+xml", "application/octet-stream", "IMAGE/WEBP", ""])(
    "does not admit %s",
    (type) => {
      expect(UPLOADABLE_CONTENT_TYPES).not.toContain(type);
    },
  );
});
