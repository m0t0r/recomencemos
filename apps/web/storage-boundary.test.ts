// @vitest-environment node

/**
 * The claims `@repo/storage` makes that it cannot check from inside itself.
 *
 * **`domain-boundary.test.ts` and `notifications-boundary.test.ts` are the shape
 * and the reasoning**, and this file exists because the package that arrived
 * with the strongest credential arrived without their test. ADR-0013 names the
 * `exports` map as mechanism 1 — the one that fails at *build*, in module
 * resolution — and CLAUDE.md is explicit that it "is the mechanism, and it is
 * the only one of the three with a test". `assertServerOnly()` is the backstop,
 * never the plan; a package whose map has quietly widened still passes it,
 * because by then the module is already in the bundle.
 *
 * **Node, not happy-dom.** This app's suite runs in a DOM environment, so
 * `globalThis.window` is defined and a server module's own guard would fire
 * before the resolver was asked anything. Nothing below touches the DOM: it asks
 * Node's own resolver a question, and reads the manifest that resolver consults.
 *
 * **The `browser` condition is read off the map rather than resolved**, which is
 * the same limit `notifications-boundary.test.ts` states: `createRequire().resolve`
 * answers under the conditions *this* process runs with, and there is no way to
 * ask it for `browser`. The proof that the condition *works* is the build error
 * recorded by hand in `packages/storage/src/browser-refusal.ts`.
 */

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);

/**
 * The internals. Each is reachable inside the package through its `#` specifier
 * and from nowhere else — which is what stops a call site building an S3 client
 * of its own, or reading the credentials directly, and routing around the seam
 * that owns the two irreversible acts.
 */
const WITHHELD = [
  // No `"."` entry, so importing the package bare is not a shortcut either.
  "@repo/storage",
  // The one that matters most: it is where the access key and the secret are
  // read, and a reachable subpath would put both a credential and a client
  // constructor one import away from any surface.
  "@repo/storage/config",
  "@repo/storage/client",
  // The re-encode is the trusted step in DD6 — the thing that strips EXIF and
  // decides the format from the decoder rather than from a header. Reachable, it
  // becomes something a caller could skip on the way to the public prefix.
  "@repo/storage/reencode",
  "@repo/storage/keys",
  "@repo/storage/key-shapes",
  "@repo/storage/server-only",
  "@repo/storage/user-messages",
];

/** What the package actually publishes, and therefore what must resolve. */
const PUBLISHED = ["@repo/storage/photos", "@repo/storage/photo-url", "@repo/storage/limits"];

/**
 * The subset carrying the `browser` condition — which is not all of `PUBLISHED`,
 * deliberately. `./photo-url` and `./limits` are reached from `"use client"`
 * code on purpose: the downscale needs the numbers and the image loader needs
 * the URL builder. `browser-refusal.ts` carries the argument for why that is
 * safe, and the last case below is what stops it silently becoming untrue.
 */
const SERVER_ONLY = ["@repo/storage/photos"];

const BROWSER_REFUSAL = "./src/browser-refusal.ts";

interface Manifest {
  readonly exports: Record<string, string | Record<string, string>>;
}

function storageManifest(): Manifest {
  const photosPath = require.resolve("@repo/storage/photos");
  const packageRoot = photosPath.slice(0, photosPath.indexOf("/src/"));

  return JSON.parse(readFileSync(`${packageRoot}/package.json`, "utf8")) as Manifest;
}

describe("the storage package's export map", () => {
  it.each(WITHHELD)("refuses %s to apps/web", (specifier) => {
    expect(() => require.resolve(specifier)).toThrow(
      expect.objectContaining({ code: "ERR_PACKAGE_PATH_NOT_EXPORTED" }),
    );
  });

  it.each(PUBLISHED)("resolves %s, so the refusals above mean something", (specifier) => {
    expect(require.resolve(specifier)).toContain("packages/storage");
  });
});

describe("the browser condition on that map", () => {
  /**
   * The half `require.resolve` cannot be asked about. Without it, a
   * `"use client"` module importing the photo seam resolves cleanly, and the
   * only thing between it and an S3 client built from
   * `PHOTO_S3_SECRET_ACCESS_KEY` is a runtime throw that fires *after* the
   * module is in the bundle — which is the inversion ADR-0013 made visible.
   */
  it.each(SERVER_ONLY)("points %s at the package's own refusal module", (specifier) => {
    const subpath = `.${specifier.slice("@repo/storage".length)}`;
    const entry = storageManifest().exports[subpath];

    expect(entry).toMatchObject({ browser: BROWSER_REFUSAL });
  });

  it("leaves every published subpath resolving to its real module otherwise", () => {
    for (const entry of Object.values(storageManifest().exports)) {
      const target = typeof entry === "string" ? entry : entry.default;

      expect(target).toEqual(expect.not.stringContaining("browser-refusal"));
    }
  });

  /**
   * The inverse of the case above, and the one that is easy to leave out: it
   * pins that the two credential-free subpaths are *deliberately* condition-free
   * rather than accidentally so. If a later change gives `./photo-url` a
   * `browser` refusal, the client-side loader stops resolving and this says so
   * at the boundary rather than at the first blank image.
   */
  it.each(PUBLISHED.filter((specifier) => !SERVER_ONLY.includes(specifier)))(
    "leaves %s reachable from a browser, which the downscale and the loader need",
    (specifier) => {
      const subpath = `.${specifier.slice("@repo/storage".length)}`;
      const entry = storageManifest().exports[subpath];

      expect(entry).toEqual(expect.not.objectContaining({ browser: expect.anything() }));
    },
  );
});
