/**
 * The one place in this repository that holds an object-store client for
 * photos.
 *
 * **The SDK is imported inside {@link photoStore}, not at the top**, which is
 * the shape `scripts/ui-proof-store.mjs` already uses and for the same reason:
 * a caller can ask {@link missingConfig} whether this deploy has a bucket
 * without loading three megabytes of AWS SDK to find out no. `createPhotoUpload`
 * asks exactly that, so an unconfigured deploy refuses at the top of the action
 * rather than after the client has been constructed.
 *
 * **`forcePathStyle` is on.** R2 accepts both addressing styles, but MinIO —
 * which is what `docker-compose.yaml` runs in development — serves virtual-host
 * style only behind a wildcard DNS entry nobody has on a laptop. Path style
 * works against both, so it is one line here rather than a divergence between
 * what a developer exercises and what production runs.
 */

import { assertServerOnly } from "#server-only";
import { storageConfig, type StorageConfig, type StorageEnv } from "#config";
import { isPublicKey } from "#key-shapes";

assertServerOnly("client");

/** What this module hands back: a configured client, and the two buckets it addresses. */
export interface PhotoStore {
  readonly client: import("@aws-sdk/client-s3").S3Client;
  /** Publicly readable in whole. Only re-encoded, approved objects are written here. */
  readonly publicBucket: string;
  /** Public access never turned on. Everything an Admin has not yet decided on. */
  readonly quarantineBucket: string;
}

/**
 * Which bucket a key lives in, decided by the key's own shape.
 *
 * **One function, so no call site picks.** The two buckets differ in exactly one
 * property and it is the one that matters — one of them is readable by anybody —
 * so a caller choosing between two similarly-named strings is a caller that can
 * write an unreviewed photo into the readable one. The key already carries its
 * prefix; this is the only thing that reads it for this purpose.
 *
 * **It asks whether the key is a public one rather than whether it is a
 * quarantine one**, so that anything unrecognised lands in the bucket nobody
 * can read. That is the safe side of the only mistake this can make. Every
 * caller validates the shape and refuses before reaching here, so the case is a
 * backstop rather than a route — but a backstop that defaulted the other way
 * would be one that published on a spelling error.
 */
export function bucketFor(store: PhotoStore, key: string): string {
  return isPublicKey(key) ? store.publicBucket : store.quarantineBucket;
}

let cached: { readonly store: PhotoStore; readonly config: StorageConfig } | undefined;

/**
 * The client, built once per process.
 *
 * Cached on the resolved configuration rather than unconditionally, so a test
 * that supplies a different environment gets a different client instead of
 * silently reusing the first one — which is the bug a bare `client ??=` would
 * have, and it would only show up in whichever test happened to run second.
 */
export async function photoStore(env: StorageEnv = process.env): Promise<PhotoStore> {
  const config = storageConfig(env);

  if (cached && sameConfig(cached.config, config)) return cached.store;

  const { S3Client } = await import("@aws-sdk/client-s3");

  const store: PhotoStore = {
    client: new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    }),
    publicBucket: config.publicBucket,
    quarantineBucket: config.quarantineBucket,
  };

  cached = { store, config };

  return store;
}

function sameConfig(a: StorageConfig, b: StorageConfig): boolean {
  return (
    a.endpoint === b.endpoint &&
    a.publicBucket === b.publicBucket &&
    a.quarantineBucket === b.quarantineBucket &&
    a.accessKeyId === b.accessKeyId &&
    a.secretAccessKey === b.secretAccessKey
  );
}
