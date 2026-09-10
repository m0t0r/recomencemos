/**
 * The photo path against a **real S3 bucket** — the one thing seams 1 and 2
 * structurally cannot reach, and the one criterion #18 states as a negative:
 *
 * > **0 unmoderated photo objects are retrievable** by any caller, by any URL,
 * > guessed or not (NFR6). Verified by attempting to read a quarantined object
 * > directly and failing.
 *
 * **A store's refusal is not testable against a mock.** NFR6 is true because
 * the store refuses, so a double that refuses on our behalf would be asserting
 * our own belief about a configuration file. `docker-compose.yaml` runs MinIO,
 * which speaks the same S3 protocol Cloudflare R2 does, and `minio-init`
 * performs the same acts a human performs against R2 at runbook §3 — so what is
 * exercised here is the production code path against something very close to
 * the production configuration.
 *
 * **Two buckets, and the second one is what makes that sentence true** (#251).
 * The pair used to be two prefixes in one bucket, with an anonymous policy on
 * one of them — which MinIO expresses and R2 cannot: public access there is a
 * single bucket-level switch with no per-prefix ACL. So the fixture was proving
 * a property production had no way to state. Quarantine now lives in a bucket
 * whose public access is simply never turned on, which is the same act in both
 * stores.
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
import {
  discard,
  presignReview,
  presignUpload,
  promoteToPublic,
  publicPhotoUrl,
  quarantinedEtag,
} from "#photos";

const ENV = {
  PHOTO_S3_ENDPOINT: "http://127.0.0.1:9000",
  PHOTO_S3_BUCKET: "recomencemos-photos",
  PHOTO_S3_QUARANTINE_BUCKET: "recomencemos-photos-quarantine",
  PHOTO_S3_ACCESS_KEY_ID: "recomencemos",
  PHOTO_S3_SECRET_ACCESS_KEY: "recomencemos",
  PHOTO_PUBLIC_BASE: "http://127.0.0.1:9000/recomencemos-photos",
  PHOTO_TRANSFORMATIONS: "off",
} as const;

/**
 * The quarantine bucket's own address.
 *
 * **Nothing in the product ever builds this string** — no origin is configured
 * for that bucket and `photoUrl` refuses a quarantine key by shape. It is built
 * here so the refusal can be asked for directly, which is the only way to show
 * that the store is what refuses.
 */
const QUARANTINE_BASE = `${ENV.PHOTO_S3_ENDPOINT}/${ENV.PHOTO_S3_QUARANTINE_BUCKET}`;

/** A generated photo. Never a real face, for the reason `docs/policy/security.md` gives. */
async function photoBytes(width = 900, height = 700): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 90, g: 120, b: 60 } } })
    .withExif({ IFD0: { Model: "a phone" }, IFD3: { GPSLatitude: "4/1 48/1 0/1" } })
    .jpeg()
    .toBuffer();
}

/**
 * A **different** picture of exactly the same length — the swap, arranged the
 * way somebody attempting it would arrange it.
 *
 * **Same length, because length is the one thing the signature pins** and it is
 * the holder's own declared value: they declare the length of the picture they
 * mean to publish and pad the picture they show to match. Bytes after a JPEG's
 * end-of-image marker are ignored by every decoder, so what is padded is still
 * a picture — which `sharp` reading it back is what proves.
 *
 * **Different, and asserted to be.** A "swapped" image that happened to be
 * byte-identical would make every case below pass while checking nothing, which
 * is precisely how the first draft of this helper failed: the neighbouring
 * replay case had been passing `photoBytes(900, 700)` against a default of
 * `photoBytes(900, 700)`.
 */
async function differentPhotoOfLength(byteLength: number): Promise<Buffer> {
  const swapped = await sharp({
    create: { width: 900, height: 700, channels: 3, background: { r: 190, g: 40, b: 40 } },
  })
    .jpeg({ quality: 40 })
    .toBuffer();

  expect(swapped.byteLength).toBeLessThanOrEqual(byteLength);

  return Buffer.concat([swapped, Buffer.alloc(byteLength - swapped.byteLength)]);
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
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(bytes.byteLength),
      // A signed header, so this is not optional politeness — dropping it
      // invalidates the signature. See `presignUpload`.
      "If-None-Match": "*",
    },
  });

  expect(response.status).toBe(200);

  return photoKey;
}

/** The store's own client, for the two things the product deliberately cannot do. */
async function storeClient() {
  const { S3Client } = await import("@aws-sdk/client-s3");

  return new S3Client({
    region: "auto",
    endpoint: ENV.PHOTO_S3_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: ENV.PHOTO_S3_ACCESS_KEY_ID,
      secretAccessKey: ENV.PHOTO_S3_SECRET_ACCESS_KEY,
    },
  });
}

/**
 * Overwrite a quarantined object, unconditionally.
 *
 * **The product cannot do this and that is the point.** `presignUpload` signs
 * `If-None-Match: *`, so the swap is unreachable through the URL a browser
 * holds; the control under test is the one that has to work when the store does
 * not honour that condition, so the state it refuses is built by a caller that
 * does not go through it.
 */
async function overwrite(key: string, bytes: Buffer): Promise<void> {
  const [{ PutObjectCommand }, client] = await Promise.all([
    import("@aws-sdk/client-s3"),
    storeClient(),
  ]);

  await client.send(
    new PutObjectCommand({
      Bucket: ENV.PHOTO_S3_QUARANTINE_BUCKET,
      Key: key,
      Body: new Uint8Array(bytes),
      ContentType: "image/jpeg",
    }),
  );
}

/**
 * How many objects the public bucket holds.
 *
 * A refusal has no key to look up — the public key is minted inside
 * `promoteToPublic` and never leaves it on the failing path — so "nothing was
 * published" is asked as a count rather than as a 404 on a name.
 */
async function publicObjectCount(): Promise<number> {
  const [{ ListObjectsV2Command }, client] = await Promise.all([
    import("@aws-sdk/client-s3"),
    storeClient(),
  ]);

  const listed = await client.send(
    new ListObjectsV2Command({ Bucket: ENV.PHOTO_S3_BUCKET, Prefix: PUBLIC_PREFIX }),
  );

  return listed.KeyCount ?? 0;
}

describe("the quarantine bucket", () => {
  it("refuses an anonymous read of an object that is really there", async () => {
    const key = await uploadToQuarantine(await photoBytes());

    // The object exists — the presigned read below proves it — so a refusal
    // here is the policy refusing rather than the object being absent. That
    // distinction is the whole test: a 404 would pass a naive assertion while
    // proving nothing about NFR6.
    const anonymous = await fetch(`${QUARANTINE_BASE}/${key}`);

    expect(anonymous.status).toBe(403);

    const signed = await fetch(await presignReview(key, ENV));

    expect(signed.status).toBe(200);

    await discard(key, ENV);
  });

  it("refuses a guessed key in the same way, so absence is not distinguishable", async () => {
    const guessed = await fetch(`${QUARANTINE_BASE}/${QUARANTINE_PREFIX}/aaaaaaaaaaaaaaaaaaaaa`);

    expect(guessed.status).toBe(403);
  });

  /**
   * **The composite in #251, closed by the object not being there rather than
   * bounded by a rule that refuses it.**
   *
   * `PHOTO_PUBLIC_BASE` is a bucket root and a key carries its own prefix, so
   * `${base}/quarantine/<21 chars>` is a string anybody can construct. While
   * both prefixes lived in one bucket, whether that string served bytes turned
   * on a per-prefix anonymous policy — which MinIO has and **R2 does not**:
   * public access there is one switch for the whole bucket. So the property
   * this file was proving locally was one production could not express.
   *
   * With quarantine in a bucket of its own, the answer no longer depends on a
   * policy at all. The two assertions are the pair that says so: the public
   * origin really is readable, and the quarantine key is simply not in it.
   */
  it("holds no object the public origin can name", async () => {
    const key = await uploadToQuarantine(await photoBytes());

    const { publicKey } = await promoteToPublic(key, await quarantinedEtag(key, ENV), ENV);

    // The origin is open — this is the object it is open for.
    expect((await fetch(`${ENV.PHOTO_PUBLIC_BASE}/${publicKey}`)).status).toBe(200);

    // Same origin, same credentials, the quarantine key concatenated on. A 404
    // rather than a 403: nothing is refusing, because there is nothing there.
    expect((await fetch(`${ENV.PHOTO_PUBLIC_BASE}/${key}`)).status).toBe(404);

    await discard(key, ENV);
    await discard(publicKey, ENV);
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

  /**
   * The type is covered too, and it is covered only because the option below is
   * passed — which is the whole of what this case exists to hold in place.
   *
   * The installed presigner adds `content-type` to its `unsignableHeaders`
   * unconditionally, so a `ContentType` on the command lands in the canonical
   * request and then never appears in `X-Amz-SignedHeaders`. The result is a
   * declaration the store does not check: a client could declare `image/webp`
   * to us and PUT `text/html` with a body of the declared length, and the
   * object would be stored, served with that type, and read back by whatever
   * fetched it next. `signableHeaders` is the documented override.
   */
  it("refuses a body whose type is not the one the signature covers", async () => {
    const bytes = await photoBytes();
    const { uploadUrl } = await presignUpload(
      { byteLength: bytes.byteLength, contentType: "image/webp" },
      ENV,
    );

    const response = await fetch(uploadUrl, {
      method: "PUT",
      body: new Uint8Array(bytes),
      headers: {
        "Content-Type": "text/html",
        "Content-Length": String(bytes.byteLength),
        "If-None-Match": "*",
      },
    });

    expect(response.status).toBe(403);
  });

  it("accepts the same PUT when the type is the one that was declared", async () => {
    const bytes = await photoBytes();
    const { uploadUrl, photoKey } = await presignUpload(
      { byteLength: bytes.byteLength, contentType: "image/jpeg" },
      ENV,
    );

    const response = await fetch(uploadUrl, {
      method: "PUT",
      body: new Uint8Array(bytes),
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(bytes.byteLength),
        "If-None-Match": "*",
      },
    });

    expect(response.status).toBe(200);

    await discard(photoKey, ENV);
  });

  /**
   * The control for the pair above, on the shape the conditional-write case
   * already uses: sign the same PUT **without** the option and show the
   * mismatched type accepted. Without it a green refusal could equally mean the
   * store was refusing for some other reason, and this is the defect as it
   * shipped — it is what #251 measured.
   */
  it("would accept a mismatched type if the header were not signable", async () => {
    const [{ PutObjectCommand, S3Client }, { getSignedUrl }] = await Promise.all([
      import("@aws-sdk/client-s3"),
      import("@aws-sdk/s3-request-presigner"),
    ]);

    const bytes = await photoBytes();
    const key = `${QUARANTINE_PREFIX}/${"unsigned".padEnd(21, "0")}`;
    const unbound = await getSignedUrl(
      new S3Client({
        region: "auto",
        endpoint: ENV.PHOTO_S3_ENDPOINT,
        forcePathStyle: true,
        credentials: {
          accessKeyId: ENV.PHOTO_S3_ACCESS_KEY_ID,
          secretAccessKey: ENV.PHOTO_S3_SECRET_ACCESS_KEY,
        },
      }),
      new PutObjectCommand({
        Bucket: ENV.PHOTO_S3_QUARANTINE_BUCKET,
        Key: key,
        ContentLength: bytes.byteLength,
        ContentType: "image/webp",
      }),
      { expiresIn: 300 },
    );

    const response = await fetch(unbound, {
      method: "PUT",
      body: new Uint8Array(bytes),
      headers: { "Content-Type": "text/html", "Content-Length": String(bytes.byteLength) },
    });

    expect(response.status).toBe(200);

    await discard(key, ENV);
  });

  /**
   * The other half, and the reason the signing fix alone is not the whole
   * answer: binding the header makes the request agree with its own
   * declaration, and nothing about that stops the declaration being
   * `text/html`. So the set of types that may be declared is closed before
   * anything is signed.
   */
  it("refuses to sign a type it would not decode", async () => {
    await expect(
      presignUpload({ byteLength: 1024, contentType: "text/html" }, ENV),
    ).rejects.toMatchObject({ code: "photo_content_type_not_allowed" });
  });

  /**
   * The one that closes the time-of-check/time-of-use hole: an Admin decides on
   * bytes, and the bytes have to still be the ones decided on.
   *
   * The queue renders the object once and the approval reads it *again*, so a
   * write capability that outlives its first use lets a holder swap the object
   * in between — publishing to the anonymously-readable prefix something no
   * person ever looked at, which is the whole of what the review gate is for.
   * Length and content type are pinned by the signature but are the holder's own
   * declared values, so neither bounds the swap.
   *
   * The control below is half the case: without the condition the replay is
   * accepted, so a green first half alone would prove only that the store was
   * asleep.
   */
  it("refuses a second write to a key its URL has already written", async () => {
    const bytes = await photoBytes();
    const { uploadUrl } = await presignUpload(
      { byteLength: bytes.byteLength, contentType: "image/jpeg" },
      ENV,
    );

    const put = (body: Buffer) =>
      fetch(uploadUrl, {
        method: "PUT",
        body: new Uint8Array(body),
        headers: {
          "Content-Type": "image/jpeg",
          "Content-Length": String(body.byteLength),
          "If-None-Match": "*",
        },
      });

    expect((await put(bytes)).status).toBe(200);

    // A different picture, padded to the length the signature covers — which is
    // exactly the move the condition exists to refuse.
    expect((await put(await differentPhotoOfLength(bytes.byteLength))).status).toBe(412);
  });

  /**
   * The control for the case above, and the reason it is worth its lines: it
   * signs the same PUT *without* the condition and shows the replay accepted.
   *
   * It reaches for the SDK directly rather than adding a switch to
   * `presignUpload`, because a production flag that turns the condition off
   * would be a way to reintroduce the defect in the field — a worse thing to own
   * than a few lines of setup in a test.
   */
  it("would accept that replay if the write were not conditional", async () => {
    const [{ PutObjectCommand, S3Client }, { getSignedUrl }] = await Promise.all([
      import("@aws-sdk/client-s3"),
      import("@aws-sdk/s3-request-presigner"),
    ]);

    const bytes = await photoBytes();
    const unconditional = await getSignedUrl(
      new S3Client({
        region: "auto",
        endpoint: ENV.PHOTO_S3_ENDPOINT,
        forcePathStyle: true,
        credentials: {
          accessKeyId: ENV.PHOTO_S3_ACCESS_KEY_ID,
          secretAccessKey: ENV.PHOTO_S3_SECRET_ACCESS_KEY,
        },
      }),
      new PutObjectCommand({
        Bucket: ENV.PHOTO_S3_QUARANTINE_BUCKET,
        Key: `quarantine/${"control".padEnd(21, "0")}`,
        ContentLength: bytes.byteLength,
        ContentType: "image/jpeg",
      }),
      { expiresIn: 300 },
    );

    const put = () =>
      fetch(unconditional, {
        method: "PUT",
        body: new Uint8Array(bytes),
        headers: { "Content-Type": "image/jpeg", "Content-Length": String(bytes.byteLength) },
      });

    expect((await put()).status).toBe(200);
    expect((await put()).status).toBe(200);
  });

  it("refuses to sign anything above the ceiling in the first place", async () => {
    await expect(
      presignUpload({ byteLength: 5 * 1024 * 1024, contentType: "image/jpeg" }, ENV),
    ).rejects.toMatchObject({ code: "photo_over_byte_ceiling" });
  });
});

describe("promoteToPublic", () => {
  it("puts a re-encoded object where the public bucket can be read anonymously", async () => {
    const key = await uploadToQuarantine(await photoBytes());

    const { publicKey } = await promoteToPublic(key, await quarantinedEtag(key, ENV), ENV);

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

    const { publicKey } = await promoteToPublic(key, await quarantinedEtag(key, ENV), ENV);

    expect((await fetch(await presignReview(key, ENV))).status).toBe(200);

    await discard(key, ENV);
    await discard(publicKey, ENV);
  });

  it("refuses an object that is not in the bucket rather than writing an empty one", async () => {
    await expect(
      promoteToPublic(`${QUARANTINE_PREFIX}/aaaaaaaaaaaaaaaaaaaaa`, '"whatever"', ENV),
    ).rejects.toMatchObject({ code: "photo_object_missing" });
  });

  /**
   * **The case the whole binding exists for**, and it is constructed straight
   * against the store rather than through the product's own path — the
   * presigned PUT carries `If-None-Match: *`, so a holder of that URL cannot
   * reach this state any more. That is exactly why it is written this way: the
   * single-write property is a property of the *store honouring a condition*,
   * measured here and an open question against the production one, and this
   * control is what has to hold when it does not.
   *
   * The two objects are the same length, which is the move a signature covering
   * `Content-Length` does not stop.
   */
  it("refuses bytes that are not the bytes whose identity was recorded", async () => {
    const key = await uploadToQuarantine(await photoBytes());
    const attached = await quarantinedEtag(key, ENV);

    await overwrite(key, await differentPhotoOfLength((await photoBytes()).byteLength));

    expect(await quarantinedEtag(key, ENV)).not.toBe(attached);

    await expect(promoteToPublic(key, attached, ENV)).rejects.toMatchObject({
      code: "photo_object_changed",
    });

    await discard(key, ENV);
  });

  /**
   * The refusal above has to happen **before** anything is written, not after —
   * a public object nobody can reach is still an unreviewed photo in the bucket
   * that is open to the world. Nothing names the key that would have been
   * minted, so this asks the question the other way round: the public bucket
   * gained no object at all.
   */
  it("writes nothing under the public prefix when it refuses", async () => {
    const key = await uploadToQuarantine(await photoBytes());
    const attached = await quarantinedEtag(key, ENV);

    await overwrite(key, await differentPhotoOfLength((await photoBytes()).byteLength));

    const before = await publicObjectCount();
    await expect(promoteToPublic(key, attached, ENV)).rejects.toThrow();

    expect(await publicObjectCount()).toBe(before);

    await discard(key, ENV);
  });

  /**
   * **An empty expectation refuses rather than falling back.** This is the row
   * attached before the identity was recorded, and the failure to guard against
   * is the friendly one: treating "nothing to compare" as "nothing to check"
   * restores exactly the behaviour this parameter removed, on precisely the
   * rows that have no binding.
   */
  it("refuses to publish on an empty expectation", async () => {
    const key = await uploadToQuarantine(await photoBytes());

    await expect(promoteToPublic(key, "", ENV)).rejects.toMatchObject({
      code: "photo_object_unidentified",
    });

    await discard(key, ENV);
  });

  /**
   * **Which of the two mechanisms fired, asked directly.**
   *
   * `promoteToPublic` sends `If-Match` *and* compares the ETag it gets back, and
   * the cases above pass whichever of them refuses — which is the property that
   * makes the pair worth having and also the reason neither is observable from
   * outside. This asks the store the question on its own: with a stale
   * condition it answers 412, so the bytes never cross the wire, and the
   * comparison in our own code is the second line rather than the only one.
   */
  it("is refused by the store itself, before any bytes cross", async () => {
    const [{ GetObjectCommand }, client] = await Promise.all([
      import("@aws-sdk/client-s3"),
      storeClient(),
    ]);

    const key = await uploadToQuarantine(await photoBytes());
    const attached = await quarantinedEtag(key, ENV);

    await overwrite(key, await differentPhotoOfLength((await photoBytes()).byteLength));

    const refused = await client
      .send(
        new GetObjectCommand({
          Bucket: ENV.PHOTO_S3_QUARANTINE_BUCKET,
          Key: key,
          IfMatch: attached,
        }),
      )
      .then(
        () => 200,
        (cause: { $metadata?: { httpStatusCode?: number } }) => cause.$metadata?.httpStatusCode,
      );

    expect(refused).toBe(412);

    await discard(key, ENV);
  });

  it("publishes bytes that have not moved, which is the case it must not break", async () => {
    const key = await uploadToQuarantine(await photoBytes());

    const { publicKey } = await promoteToPublic(key, await quarantinedEtag(key, ENV), ENV);

    expect((await fetch(`${ENV.PHOTO_PUBLIC_BASE}/${publicKey}`)).status).toBe(200);

    await discard(key, ENV);
    await discard(publicKey, ENV);
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
