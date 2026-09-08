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

assertServerOnly("client");

/** What this module hands back: a configured client, and the bucket it is pointed at. */
export interface PhotoStore {
  readonly client: import("@aws-sdk/client-s3").S3Client;
  readonly bucket: string;
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
    bucket: config.bucket,
  };

  cached = { store, config };

  return store;
}

function sameConfig(a: StorageConfig, b: StorageConfig): boolean {
  return (
    a.endpoint === b.endpoint &&
    a.bucket === b.bucket &&
    a.accessKeyId === b.accessKeyId &&
    a.secretAccessKey === b.secretAccessKey
  );
}
