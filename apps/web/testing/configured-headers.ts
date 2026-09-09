/**
 * What `next.config.ts` actually hands Next, resolved once.
 *
 * **Shared because two suites assert against the same call.**
 * `gated-routes.test.ts` reads NFR8's prefix list out of it and
 * `response-headers.test.ts` reads the security set; a second copy of the
 * resolution is a second place the shape of `headers()` is described.
 *
 * A file importing this must declare `@vitest-environment node`: it reaches
 * `next.config.ts`, and `withSentryConfig` picks a path-resolution branch on
 * `typeof document`, which under happy-dom hands `fileURLToPath` an `http:` URL
 * and fails the whole suite at collection. `gated-routes.test.ts` records the
 * observed error.
 */

import { expect } from "vitest";
import nextConfig from "../next.config";

export async function configuredHeaders() {
  const headers = await nextConfig.headers?.();
  expect(headers, "next.config.ts declares no headers()").toBeDefined();
  return headers ?? [];
}
