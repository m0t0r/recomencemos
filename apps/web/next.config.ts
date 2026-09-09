import path from "node:path";
// `@sentry/nextjs/config` and not `@sentry/nextjs`: the root entry still
// re-exports this, but 10.73.0 deprecates that path and prints a warning on
// every `next build` and `check-types`. It stops working in v11.
import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
import { gatedRouteHeaders } from "./lib/gated-routes";
import { securityHeaderRules } from "./lib/response-headers";

const nextConfig: NextConfig = {
  /**
   * What the production image runs (#9, DD10).
   *
   * `next start` needs almost nothing from `node_modules` — React, Base UI and
   * every icon are already inside `.next` — so a runner that installs the
   * workspace's production dependencies ships about a gigabyte to serve fifty
   * megabytes of it. Standalone traces what the server actually imports and
   * emits a self-contained tree. Measured on this app: a production-dependency
   * install of the workspace makes a **1.1 GB** image; the standalone one is
   * **375 MB**, most of which is the Node base image.
   *
   * The two things it costs, both handled in the `Dockerfile` rather than here,
   * because they are packaging facts rather than framework configuration: the
   * static assets are emitted outside the standalone tree, and the migrate CLI
   * is imported by no route, so tracing cannot see it.
   */
  output: "standalone",

  /**
   * Without this Next infers the trace root from the nearest lockfile and, in a
   * monorepo, warns and guesses. The root is where `pnpm-workspace.yaml` is,
   * because that is the tree the workspace symlinks point into — trace from
   * `apps/web` and every `@repo/*` package resolves outside the root and is
   * silently left behind.
   */
  outputFileTracingRoot: path.join(import.meta.dirname, "..", ".."),

  // Cache Components: data is dynamic by default and you opt into caching with
  // the `use cache` directive. This flag also makes Partial Prerendering the
  // App Router default — Next.js prerenders a static shell and streams the
  // dynamic parts in — which is why there is no separate `experimental.ppr`
  // flag to set. See https://nextjs.org/docs/app/getting-started/caching
  cacheComponents: true,

  /**
   * **A prefetch is one shell per route, not one payload per link** (#228).
   *
   * Every row on `/` and `/profiles` is a `<Link>` to `/profile/[slug]`, and
   * with this off each row the router reaches costs a route tree **plus its own
   * copy of the page payload** — 796 + 4,733 = **5,529 bytes**, per row. With it
   * on the payload is fetched once for the route and each further row costs its
   * tree alone: **795 bytes**, an 86% cut in the marginal cost of a row.
   * Measured on a production build behind a counting proxy, not recalled; the
   * spec's NFR3 carries the figures and the procedure.
   *
   * **That 4,733-byte payload is the static shell, and it was identical for
   * every slug** — which is what makes the repetition pure waste and is worth
   * stating, because the doc-comment above `chargeReadCeilings` in
   * `app/(site)/profile/[slug]/page.tsx` rests on it. That comment's finding
   * (a prefetch fetches the shell, so scrolling the list charges nothing
   * against the read ceilings) is unaffected here: both before and after, a
   * prefetch reaches no dynamic boundary. What changes is only how many times
   * the same shell is sent.
   *
   * **It is not free, and the two costs are on the same page as the saving.**
   * Every document grows about 5 KB (`/` 31.6 → 37.1 KB, `/profiles`
   * 23.5 → 28.3 KB, gzip, medians of fifteen) and every navigation that stays
   * inside a route — the city and Skill filters on `/profiles` — grows about
   * 4.3 KB. So a reader who lands and reads is 12-17% cheaper and a reader who
   * changes the filter four times is 11% dearer.
   *
   * **A single reading of either is not a measurement**, which is worth knowing
   * before anyone re-takes one: both responses stream, so gzip's flush
   * boundaries move between runs and the same document came back at 28,308 and
   * 29,692 bytes. The prefetch figures above need no such care — a prefetch
   * response is buffered, and repeats were byte-identical.
   *
   * **The trade is taken because the exposure it bounds is one-sided.** The only
   * reason the flag-off numbers are small today is that the router stops
   * prefetching after about three links per document — a client scheduling
   * behaviour, not a designed property, and one a patch release could remove. A
   * probe that removed that ceiling (a per-segment `prefetch` export, kept out
   * of this change) measured **132 KB** of prefetch for one 24-row screen,
   * against this flag's 24 KB for the same screen.
   *
   * **`page-weight` cannot see any of this**, which is why it is written here.
   * That script reads `<script src>` off a prerendered document; a prefetch is a
   * request it never observes, and so is the document's own growth.
   *
   * **It changes the default for every future route**, which is the part worth
   * saying out loud once rather than discovering later: the segment-level
   * `prefetch` default becomes `'partial'` app-wide. A per-segment `prefetch`
   * export still wins, and `export const instant = false` is untouched — the
   * three that set it neither benefit nor are disturbed, checked on both builds
   * rather than assumed. One of the three is `(admin)/admin/layout.tsx`, so it
   * covers **every** route in that group rather than one page; the other two are
   * `(token)/admin/enrol/[token]` and `(token)/continue`. It requires
   * `cacheComponents`, which is on above.
   *
   * `'unstable_eager'` is the other accepted value and is not a candidate: Next
   * documents it as an internal migration aid outside the public API.
   */
  partialPrefetching: true,

  /**
   * Two sets, and they are two because they answer to different lists.
   *
   * **The security set applies to every route** — `lib/response-headers.ts`,
   * seven headers including the enforced CSP the spec's C6 settled. It reads
   * `process.env` here and nowhere else, and this is the only place that is
   * true: `headers()` is baked into `routes-manifest.json`, so every value it
   * derives is a **build-time** one.
   *
   * **NFR8's header half applies to six prefixes**, which is the list NFR8
   * names. The list is data in `lib/gated-routes.ts` and `gated-routes.test.ts`
   * drives a table over it, which is the shape NFR8 asks for in as many words:
   * asserted "by a table-driven test over the route list rather than a per-page
   * attribute". Each page still sets `metadata.robots` for the `<meta>` half —
   * NFR8 wants both, because a crawler that never parses the body still reads
   * the header, and a saved copy of a page keeps only the meta.
   */
  async headers() {
    return [...securityHeaderRules(process.env), ...gatedRouteHeaders()];
  },

  /**
   * `X-Powered-By: Next.js` is off, and it belongs with the header set rather
   * than on its own: this is the one header the app was sending that it had no
   * reason to. It names the framework to anyone scanning, with no version and
   * no exploit behind it — so this is tidiness rather than a fix, and the honest
   * reason to take it is that a change titled "the headers ship, as a group" is
   * the only natural place it will ever come up.
   */
  poweredByHeader: false,

  logging: {
    // Forward browser console errors and warnings into the `next dev` terminal
    // so an agent reading stdout sees client-side failures it would otherwise
    // have to open DevTools to find.
    browserToTerminal: true,
  },

  experimental: {
    /**
     * **NFR14 asks for a 403 and the App Router has exactly one way to render
     * one** (#17): `forbidden()` with a `forbidden.tsx`, which this flag turns on.
     *
     * The requirement's own words are that the refusal is _"a **403**, returned,
     * not a redirect and not a thrown error"_, and each third of that is doing
     * work. Not a redirect, because a redirect tells an unauthenticated caller
     * that the route exists. Not a thrown error, because C51 makes every refusal
     * in the UX table a value rather than an `AppError` — a crawler that could
     * raise one on every `/admin` hit would spend the month's 5,000-event Sentry
     * allowance in a day.
     *
     * `forbidden()` satisfies both. It is a framework **interrupt**, the same
     * class as `redirect()` — which `sign-in/actions.ts` already documents as "a
     * navigation and not a swallowed failure" — so it never reaches
     * `handleServerError` and never becomes an event. What it does produce is a
     * real 403 status, which is the third of the requirement nothing else here
     * could deliver: a page cannot set a status code, and a `proxy.ts` doing this
     * job would put an authorization decision in a layer Next's own docs tell you
     * not to rely on for shared modules, against the API contract's rule that
     * every action authorizes independently.
     *
     * **The Server Actions do not use it** and do not need it: `returnActionError`
     * with a 403 `ClientError` is already literally "returned, not thrown".
     */
    authInterrupts: true,
  },

  // Note what is *absent*: `serverExternalPackages`. Next's defaults already
  // carry `pino`, `pino-pretty` and `thread-stream`, and supplying an explicit
  // list here replaces those defaults rather than adding to them — so the first
  // person to add one unrelated package silently un-externalises the logger.
};

/**
 * Source-map upload needs all three of `SENTRY_ORG`, `SENTRY_PROJECT` and
 * `SENTRY_AUTH_TOKEN`, and the build plugin logs at **error** level when it is
 * asked to upload without them. None of the three is set in development or in
 * CI — they are credentials, and NFR24 keeps them out of the repo — so gating on
 * the full triple is what keeps `pnpm build` clean and quiet everywhere the app
 * is built without a monitoring account, which is everywhere except a deploy.
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
  // The build plugin reports on itself to Sentry by default, which means every
  // build of this product — a developer's, CI's, a deploy's — phones home to a
  // processor nobody here chose for that purpose. It is the same objection that
  // pins `sendDefaultPii: false` on the init. Off is the privacy-preserving
  // default; turning it back on is a decision to take knowingly.
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
    // noise on every credential-free build, which is every build except a
    // deploy's, so they are gated on the same triple the upload is.
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
