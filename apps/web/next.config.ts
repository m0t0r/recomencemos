import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components: data is dynamic by default and you opt into caching with
  // the `use cache` directive. This flag also makes Partial Prerendering the
  // App Router default — Next.js prerenders a static shell and streams the
  // dynamic parts in — which is why there is no separate `experimental.ppr`
  // flag to set. See https://nextjs.org/docs/app/getting-started/caching
  cacheComponents: true,

  logging: {
    // Forward browser console errors and warnings into the `next dev` terminal
    // so an agent reading stdout sees client-side failures it would otherwise
    // have to open DevTools to find.
    browserToTerminal: true,
  },

  // Note what is *absent*: `serverExternalPackages`. Next's defaults already
  // carry `pino`, `pino-pretty` and `thread-stream`, and supplying an explicit
  // list here replaces those defaults rather than adding to them — so the first
  // person to add one unrelated package silently un-externalises the logger.
};

/**
 * Source-map upload needs all three of `SENTRY_ORG`, `SENTRY_PROJECT` and
 * `SENTRY_AUTH_TOKEN`, and the build plugin logs at **error** level when it is
 * asked to upload without them. A fresh clone of this template sets none, so
 * gating on the full triple is what keeps `pnpm build` clean with no monitoring
 * account — the first thing a person evaluating a template checks.
 *
 * **`SENTRY_AUTH_TOKEN` must come from the environment and never from a `.env`
 * file.** `turbo.json` declares `.env*` a `build` input, so the file's
 * *content* is hashed into the cache key however the variable is declared, and
 * under remote caching it would travel with the artifact. It is passed through
 * to `web#build` alone for the same reason: `dev`, `lint`, `test` and
 * `check-types` have no use for a write-scoped token.
 */
const canUploadSourceMaps = Boolean(
  process.env.SENTRY_ORG && process.env.SENTRY_PROJECT && process.env.SENTRY_AUTH_TOKEN,
);

/**
 * Pinned so build-time and runtime agree on one string.
 *
 * Uploaded source maps are filed under a release and an event is symbolicated
 * only against the release it carries, so a build that uploads under one name
 * and a browser that reports under another produces minified stack traces that
 * look like a Sentry outage. Left unset, the plugin detects the release itself
 * (the `HEAD` commit SHA) and injects the same value into the client bundle,
 * which agrees with itself — so the variable is passed through only when it has
 * a value, never as an explicit `undefined` that would overwrite the injected
 * one with nothing.
 */
const release = process.env.NEXT_PUBLIC_RELEASE;

export default withSentryConfig(nextConfig, {
  // The build plugin reports on itself to Sentry by default, which for a
  // template means every clone's build phones home to a processor the project
  // never chose — the same objection that pins `sendDefaultPii: false` on the
  // init. Off is the privacy-preserving default to ship; a project that wants
  // to help Sentry can turn it back on knowingly.
  telemetry: false,

  // Quiet *only* on the path where the plugin has no credentials and therefore
  // nothing it can act on. It still warns about a missing auth token even with
  // release creation turned off below, because that check runs on the release
  // *name* — which the plugin detects from `HEAD` on its own — and it appends a
  // Turborepo-specific hint about `passThroughEnv` that is actively wrong here,
  // where the token is passed through and simply absent. With uploads and
  // release creation both off, all that is left is release injection, a
  // build-time constant with no failure mode to report. Set credentials and the
  // plugin is fully vocal again, which is when its output matters.
  silent: !canUploadSourceMaps,

  sourcemaps: {
    disable: !canUploadSourceMaps,

    // The one irreversible action in this effort. Source maps left in the
    // deployed output make the app's full client source publicly fetchable, and
    // nothing can un-publish it.
    //
    // Not redundant, whatever the option's own docstring says: it claims a
    // default of `true`, and `getBuildPluginOptions.js` in 10.70.0 reads
    // `?? false`. Deletion also runs independently of whether the upload
    // succeeded, so a failed upload leaves nothing behind either.
    deleteSourcemapsAfterUpload: true,
  },

  release: {
    ...(release ? { name: release } : {}),

    // Creating and finalizing a release are authenticated API calls, and they
    // are *not* covered by `sourcemaps.disable` — leaving them on is what makes
    // a credential-free build print "No auth token provided. Will not create
    // release" plus a Turborepo-specific hint about `passThroughEnv`. Both are
    // noise on the one path a person evaluating this template walks first, so
    // they are gated on the same triple the upload is.
    //
    // Release *injection* is deliberately left alone: it is a build-time
    // constant, needs no credentials, and is what lets a browser event carry a
    // release at all.
    create: canUploadSourceMaps,
    finalize: canUploadSourceMaps,
  },

  // The successor to `disableLogger`, which the spec named and which 10.70.0
  // deprecates in favour of a webpack-only option — this app builds with
  // Turbopack, so the replacement is the build-tool-agnostic one. Strips the
  // SDK's own debug logging from the bundle it ships to every visitor.
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
  },
});
