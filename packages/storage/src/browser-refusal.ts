/**
 * What a **browser** bundler resolves `@repo/storage/photos` to, through the
 * `browser` condition in the `exports` map.
 *
 * This is [ADR-0013](../../../docs/adr/0013-a-server-only-package-declares-which-guards-it-has.md)'s
 * mechanism 1 in its strongest form, and `assertServerOnly` in `#server-only` is
 * mechanism 3 behind it. `@repo/notifications/src/browser-refusal.ts` is the
 * prior art and its doc comment carries the measurement that justified the
 * shape; what is written here is what is different.
 *
 * **The credential this one keeps out of a bundle signs writes rather than
 * sends mail.** `PHOTO_S3_SECRET_ACCESS_KEY` in a browser is not a leak that
 * costs a mailbox — it is an object-store write primitive handed to anyone who
 * opens the tab, with no bound on what it may overwrite beyond what the token's
 * own scope happens to be. And unlike a send, the damage is not one irreversible
 * act but an ongoing capability.
 *
 * **`./limits` and `./photo-url` are exported without this condition, and that
 * is not an inconsistency** — but the two earn it differently, and saying so is
 * the point. `./limits` is a leaf in the strict sense: no imports, no
 * environment, no I/O, no credential, three numbers. `./photo-url` is not. It
 * imports `#key-shapes` and `#limits`, and it re-exports `publicBase` and
 * `transformationsEnabled` from `#config`, which does read the environment.
 *
 * What makes that safe is narrower than "it is a leaf", so it is worth stating
 * exactly: `#config` reads through a **computed** lookup — `env[VARIABLE]`, with
 * the name held in a const — and a bundler can only inline a static
 * `process.env.FOO` member expression. So no `PHOTO_S3_*` value can be baked
 * into client output, and the two functions that do cross read
 * `PHOTO_PUBLIC_BASE` and `PHOTO_TRANSFORMATIONS`, which are a public URL and a
 * feature flag rather than credentials. The credential-bearing entry points of
 * `#config` are reachable only from `./photos`, which carries the condition.
 *
 * The client-side downscale and the `next/image` loader genuinely need both
 * subpaths. `@repo/errors` is isomorphic on a similar argument, and mechanism 1
 * is about withholding what must not cross rather than about a package-wide
 * label.
 *
 * The `throw` below is not what a named import hits — that fails earlier, on the
 * missing export, which is the loud failure at build time this file exists to
 * produce. It covers the one case a missing export cannot: a bare
 * `import "@repo/storage/photos"` for side effects, which resolves cleanly and
 * would otherwise do nothing at all.
 */

throw new Error(
  "@repo/storage was resolved for a browser bundle, and it must never be. " +
    "It reads PHOTO_S3_SECRET_ACCESS_KEY and signs upload URLs with it, so shipping it to a " +
    "browser hands every visitor the ability to write into the bucket. Ask the server for a " +
    "presigned URL through a Server Action, PUT the bytes to that URL, and let the browser " +
    "hold nothing but the key it was given back.",
);
