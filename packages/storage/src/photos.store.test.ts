/**
 * The photo path against a **real S3 bucket** — the one thing seams 1 and 2
 * structurally cannot reach, and the one criterion #18 states as a negative:
 *
 * > **0 unmoderated photo objects are retrievable** by any caller, by any URL,
 * > guessed or not (NFR6). Verified by attempting to read a quarantined object
 * > directly and failing.
 *
 * **A bucket policy is not testable against a mock.** NFR6 is true because the
 * store refuses, so a double that refuses on our behalf would be asserting our
 * own belief about a configuration file. `docker-compose.yaml` runs MinIO,
 * which speaks the same S3 protocol Cloudflare R2 does, and `minio-init`
 * performs the same two acts a human performs against R2 at runbook §3 — so
 * what is exercised here is the production code path and something very close
 * to the production policy.
 *
 * **It is deliberately not part of `pnpm test`.** The suffix keeps it out of
 * `vitest.config.mts`'s `include`; `pnpm test:store` is what runs it, and it
 * needs `pnpm db:up` first. CLAUDE.md is explicit that `install`, `lint`,
 * `check-types`, `test` and `build` all pass on a machine with no Docker at
 * all, and that adding a service to CI is the moment seam 2's argument has
 * been lost. This file is the same rule applied one store over: real
 * infrastructure, opt-in, never in the required checks.
 */

import sharp from "sharp";
import { PUBLIC_PREFIX, QUARANTINE_PREFIX } from "#key-shapes";
import { discard, presignReview, presignUpload, promoteToPublic, publicPhotoUrl } from "#photos";

const ENV = {
  PHOTO_S3_ENDPOINT: "http://127.0.0.1:9000",
  PHOTO_S3_BUCKET: "recomencemos-photos",
  PHOTO_S3_ACCESS_KEY_ID: "recomencemos",
  PHOTO_S3_SECRET_ACCESS_KEY: "recomencemos",
  PHOTO_PUBLIC_BASE: "http://127.0.0.1:9000/recomencemos-photos",
  PHOTO_TRANSFORMATIONS: "off",
} as const;

/** A generated photo. Never a real face, for the reason `docs/policy/security.md` gives. */
async function photoBytes(width = 900, height = 700): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 90, g: 120, b: 60 } } })
    .withExif({ IFD0: { Model: "a phone" }, IFD3: { GPSLatitude: "4/1 48/1 0/1" } })
    .jpeg()
    .toBuffer();
}

/** Presign, PUT, and hand back the key — the browser's half of DD6 steps 1 and 2. */
async function uploadToQuarantine(bytes: Buffer): Promise<string> {
  const { uploadUrl, photoKey } = await presignUpload(
    { byteLength: bytes.byteLength, contentType: "image/jpeg" },
    ENV,
  );

  const response = await fetch(uploadUrl, {
    method: "PUT",
    body: new Uint8Array(bytes),
    headers: { "Content-Type": "image/jpeg", "Content-Length": String(bytes.byteLength) },
  });

  expect(response.status).toBe(200);

  return photoKey;
}

describe("the quarantine prefix", () => {
  it("refuses an anonymous read of an object that is really there", async () => {
    const key = await uploadToQuarantine(await photoBytes());

    // The object exists — the presigned read below proves it — so a refusal
    // here is the policy refusing rather than the object being absent. That
    // distinction is the whole test: a 404 would pass a naive assertion while
    // proving nothing about NFR6.
    const anonymous = await fetch(`${ENV.PHOTO_PUBLIC_BASE}/${key}`);

    expect(anonymous.status).toBe(403);

    const signed = await fetch(await presignReview(key, ENV));

    expect(signed.status).toBe(200);

    await discard(key, ENV);
  });

  it("refuses a guessed key in the same way, so absence is not distinguishable", async () => {
    const guessed = await fetch(
      `${ENV.PHOTO_PUBLIC_BASE}/${QUARANTINE_PREFIX}/aaaaaaaaaaaaaaaaaaaaa`,
    );

    expect(guessed.status).toBe(403);
  });

  it("will not sign a review URL for anything that is not a quarantine key", async () => {
    await expect(
      presignReview(`${PUBLIC_PREFIX}/aaaaaaaaaaaaaaaaaaaaa.webp`, ENV),
    ).rejects.toMatchObject({ code: "photo_key_not_quarantined" });
  });
});

describe("the presigned PUT", () => {
  /**
   * The byte ceiling is signed into the URL, which is what makes it a property
   * of the bucket rather than of our code. A client that declares one length
   * and sends another has composed a request the store rejects — so the ceiling
   * is not something an action could be talked past.
   */
  it("refuses a body that is not the length the signature covers", async () => {
    const bytes = await photoBytes();
    const { uploadUrl } = await presignUpload(
      { byteLength: bytes.byteLength, contentType: "image/jpeg" },
      ENV,
    );

    const oversized = Buffer.concat([bytes, Buffer.alloc(1024)]);
    const response = await fetch(uploadUrl, {
      method: "PUT",
      body: new Uint8Array(oversized),
      headers: { "Content-Type": "image/jpeg" },
    });

    expect(response.ok).toBe(false);
  });

  it("refuses to sign anything above the ceiling in the first place", async () => {
    await expect(
      presignUpload({ byteLength: 5 * 1024 * 1024, contentType: "image/jpeg" }, ENV),
    ).rejects.toMatchObject({ code: "photo_over_byte_ceiling" });
  });
});

describe("promoteToPublic", () => {
  it("puts a re-encoded object where the public prefix can be read anonymously", async () => {
    const key = await uploadToQuarantine(await photoBytes());

    const { publicKey } = await promoteToPublic(key, ENV);

    const url = publicPhotoUrl(publicKey, undefined, ENV);
    expect(url).toBe(`${ENV.PHOTO_PUBLIC_BASE}/${publicKey}`);

    const anonymous = await fetch(url as string);
    expect(anonymous.status).toBe(200);
    expect(anonymous.headers.get("content-type")).toBe("image/webp");

    // The whole reason step 4 is a re-encode rather than a copy, asserted on
    // the object a stranger can actually download.
    const published = Buffer.from(await anonymous.arrayBuffer());
    const metadata = await sharp(published).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.exif).toBeUndefined();

    await discard(key, ENV);
    await discard(publicKey, ENV);
  });

  it("leaves the quarantined object alone, so a bad re-encode is recoverable", async () => {
    const key = await uploadToQuarantine(await photoBytes());

    const { publicKey } = await promoteToPublic(key, ENV);

    expect((await fetch(await presignReview(key, ENV))).status).toBe(200);

    await discard(key, ENV);
    await discard(publicKey, ENV);
  });

  it("refuses an object that is not in the bucket rather than writing an empty one", async () => {
    await expect(
      promoteToPublic(`${QUARANTINE_PREFIX}/aaaaaaaaaaaaaaaaaaaaa`, ENV),
    ).rejects.toThrow();
  });
});

describe("discard", () => {
  it("removes the object, and says so by the object being gone", async () => {
    const key = await uploadToQuarantine(await photoBytes());

    await discard(key, ENV);

    // The signed read is the only way to ask; an anonymous one is 403 whether
    // the object is there or not, which is the property the first block asserts.
    expect((await fetch(await presignReview(key, ENV))).status).toBe(404);
  });

  /**
   * Idempotent, because a rejection is an act that must complete rather than
   * one that might have to be undone: a retried rejection, and a rejection of
   * an object a lifecycle rule already collected, both have to succeed.
   */
  it("is idempotent", async () => {
    const key = await uploadToQuarantine(await photoBytes());

    await discard(key, ENV);
    await expect(discard(key, ENV)).resolves.toBeUndefined();
  });

  it("refuses a key this repository did not mint rather than deleting by it", async () => {
    await expect(discard("quarantine/../photos/x", ENV)).rejects.toMatchObject({
      code: "photo_key_unrecognised",
    });
  });
});
