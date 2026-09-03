#!/usr/bin/env node
// The one place this pipeline talks to the object store, kept in its own module
// for two reasons that are both about what the *rest* of it can then be.
//
// **`ui-proof.mjs` imports this dynamically**, so `--dry-run` never loads the
// SDK and never reads a credential. That is what lets the fixture suite drive
// the whole publish path — naming, grouping, prefixes, the report, the body
// rewrite — on a machine with no bucket and no keys, which is every machine
// until an operator has worked the runbook.
//
// **The credential is read here and nowhere else.** It comes from the process
// environment, never from a file in the repository: `secret-store` in
// `docs/policy/security.md` is `fly secrets` mirrored in a password manager, and
// `build-guard.sh` rule I refuses a credential written into the tree. This module
// holds the only four variable names that matter, and it refuses rather than
// guessing when one is absent.
//
// R2 speaks S3, so this is the S3 client pointed at an account endpoint. The
// bucket, its two lifecycle rules and the public base URL are a human's step —
// `docs/runbooks/ui-proof-artifacts.md` is that step, and nothing here creates
// any of them.

// The SDK is imported inside `configure`, not at the top. That keeps this module
// free to be imported statically by the publisher — which is what lets it ask
// `missingConfig()` *before* it starts calling `gh`, so an absent credential is a
// refusal that costs nothing rather than one discovered after two network round
// trips. Nothing loads the client until an object is actually being written.
const REQUIRED = [
  "UI_PROOF_S3_ENDPOINT",
  "UI_PROOF_S3_BUCKET",
  "UI_PROOF_S3_ACCESS_KEY_ID",
  "UI_PROOF_S3_SECRET_ACCESS_KEY",
];

/**
 * The variables this module needs and does not have. The publisher checks this
 * up front so the refusal is exit 1 — "a refusal the caller must act on" — and
 * not exit 2, which is reserved for the script failing to run at all. A
 * credential an operator has not set yet is the ordinary state of a machine
 * before the runbook has been worked, not a broken script.
 */
export const missingConfig = () => REQUIRED.filter((k) => !process.env[k]);

let client;

async function configure() {
  const missing = missingConfig();
  if (missing.length > 0) {
    throw new Error(
      `the object store is not configured: ${missing.join(", ")} unset. See docs/runbooks/ui-proof-artifacts.md`,
    );
  }

  const { S3Client } = await import("@aws-sdk/client-s3");

  // R2 has no regions, but the S3 protocol requires one in the signature, so
  // "auto" is what Cloudflare's own documentation specifies. It is not a default
  // this repository chose and is not a value an operator sets.
  client ??= new S3Client({
    region: "auto",
    endpoint: process.env.UI_PROOF_S3_ENDPOINT,
    // **Path-style, explicitly.** The SDK defaults to virtual-hosted addressing,
    // which puts the bucket in the hostname — `https://<bucket>.<account>.r2…`
    // — and R2's S3 endpoint is documented path-style. Two things follow, and
    // the second is why this line is not merely tidy: an endpoint that is an IP
    // or `localhost` cannot carry a bucket subdomain at all, so without this the
    // client resolves a hostname that does not exist and retries until it gives
    // up. That is not hypothetical — it is how a stub endpoint hung the first
    // end-to-end test of this module for three minutes with no error, and it is
    // what makes the whole upload path drivable offline.
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.UI_PROOF_S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.UI_PROOF_S3_SECRET_ACCESS_KEY,
    },
  });

  return client;
}

/**
 * One object. `length` is passed explicitly because a stream has no length the
 * SDK can read, and S3 requires one — omitting it makes the SDK buffer the whole
 * file to find out, which for a video is the difference between a constant and a
 * proportional memory cost.
 */
export async function putObject({ key, body, type, length }) {
  const s3 = await configure();
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.UI_PROOF_S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: type,
      ContentLength: length,
    }),
  );
}
