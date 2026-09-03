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

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const REQUIRED = [
  "UI_PROOF_S3_ENDPOINT",
  "UI_PROOF_S3_BUCKET",
  "UI_PROOF_S3_ACCESS_KEY_ID",
  "UI_PROOF_S3_SECRET_ACCESS_KEY",
];

let client;

function configure() {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `the object store is not configured: ${missing.join(", ")} unset. See docs/runbooks/ui-proof-artifacts.md`,
    );
  }

  // R2 has no regions, but the S3 protocol requires one in the signature, so
  // "auto" is what Cloudflare's own documentation specifies. It is not a default
  // this repository chose and is not a value an operator sets.
  client ??= new S3Client({
    region: "auto",
    endpoint: process.env.UI_PROOF_S3_ENDPOINT,
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
  const s3 = configure();
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
