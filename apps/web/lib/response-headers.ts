/**
 * The response-header set, as a group, for every route (#232).
 *
 * The exchange spec's security deep dive settles these as one decision —
 * _"Headers, as a group"_ — and until this module none of them shipped:
 * `headers()` returned the gated-route `X-Robots-Tag` set and nothing else.
 * `frame-ancestors 'none'` is the load-bearing one and the reason it is a bug
 * rather than a tidy-up: without it the second-factor form at `/continue` and
 * the acceptance of an Offer are both clickjackable, and the second is one
 * click releasing a displaced person's name, phone and email to a stranger.
 *
 * **Shaped after `gated-routes.ts` on purpose.** Data and pure functions here,
 * `next.config.ts` reduced to assigning the result, a table-driven test over
 * the output. No proxy, no middleware, no package: every value below is already
 * fixed by the spec and the security policy, so a library shipping defaults of
 * its own would be a second place this header set is described, and the first
 * place the two can disagree.
 *
 * **The environment arrives as an argument.** `next.config.ts` is the only
 * caller that passes `process.env`, which lets the test drive the three
 * environments that actually differ — production, development, and a CI build
 * where the photo variables are simply absent — as a table rather than by
 * stubbing a global.
 *
 * **Everything here is a build-time value.** Next bakes `headers()` into
 * `routes-manifest.json`, so a deploy that changes the photo origin needs a
 * rebuild, not a restart. That is why `PHOTO_S3_ENDPOINT` and
 * `PHOTO_PUBLIC_BASE` are declared on `build.env` in `turbo.json` as well as in
 * `globalPassThroughEnv` — the pass-through declaration exists to keep a value
 * *out* of the build hash, which is exactly wrong for a value the build reads.
 */

/**
 * Every route, which is the whole difference between this set and the gated
 * one. `X-Robots-Tag` names six prefixes because NFR8 names six; a security
 * header that named a prefix list would be a boundary described in a second
 * place, and the first route to land outside it would be the hole.
 */
export const ALL_ROUTES = "/(.*)";

/** What `next.config.ts` hands in: `process.env`, and in a test whatever the row says. */
export type HeaderEnvironment = Readonly<Record<string, string | undefined>>;

/** One header, in the shape Next's `headers()` wants. */
export type ResponseHeader = { key: string; value: string };

/**
 * Two years with subdomains, and **no `preload`**.
 *
 * Preloading is submitting the domain to a list browsers ship compiled in;
 * removal takes months and reaches users only as they update. That is a human's
 * decision about a domain, not a line an agent adds to a config file, so the
 * go-live runbook carries it as its own box.
 */
export const STRICT_TRANSPORT_SECURITY = "max-age=63072000; includeSubDomains";

/**
 * Where the Google door sends a browser, and the one origin `form-action` has
 * to admit besides this app's own.
 *
 * **Measured, not predicted.** `form-action` governs the **redirect** a form
 * submission follows, not merely its immediate target, and the Google door with
 * JavaScript unavailable is a native form POST whose response is a `303` to
 * Google's authorization endpoint. Driven against a running dev server with
 * `'self'` alone, the POST was made and the redirect was never followed: the
 * door dies silently on exactly the path this repository guards hardest (NFR4).
 *
 * Widened rather than deleted. Dropping `form-action` would also release every
 * other form on this site to post anywhere an injection chose, and that
 * directive is one of the two the security policy singles out as protecting a
 * Server Action form. Naming one origin costs the rest of the protection
 * nothing.
 *
 * `accounts.google.com` and not `*.google.com`: this is where Better Auth's
 * social provider builds its authorization URL, and a wildcard would admit
 * every Google-hosted origin including user content.
 */
export const GOOGLE_AUTHORIZATION_ORIGIN = "https://accounts.google.com";

/**
 * Deny-all for every capability this product does not use.
 *
 * The photo path is a **file input**, not a `getUserMedia` capture, so denying
 * the camera costs this product nothing today — and the day a surface wants one
 * it will fail loudly here rather than quietly acquiring a permission nobody
 * reviewed.
 *
 * **`browsing-topics=()` stands where the brief asked for `interest-cohort=()`.**
 * That token was FLoC's, and Chrome withdrew FLoC in 2022 — no shipping browser
 * recognises it, so sending it denies nothing and teaches the next reader to
 * copy a dead string. `browsing-topics` gates the interest-inference API that
 * exists in its place, which is what the FLoC entry was reaching for. An
 * unrecognised feature is ignored on its own rather than voiding the header, so
 * naming it costs a browser without it nothing.
 */
export const PERMISSIONS_POLICY = [
  "accelerometer=()",
  "browsing-topics=()",
  "camera=()",
  "geolocation=()",
  "gyroscope=()",
  "magnetometer=()",
  "microphone=()",
  "midi=()",
  "payment=()",
  "usb=()",
].join(", ");

/**
 * The **origin** of a configured URL, or nothing.
 *
 * Only the origin, never the path: `PHOTO_PUBLIC_BASE` carries a bucket path in
 * development (`http://127.0.0.1:9000/recomencemos-photos`), and a CSP source
 * expression with a path is a *narrower* rule than the one intended — it stops
 * matching the moment a key is stored one level deeper. Origin is what a source
 * expression is for.
 *
 * A value that will not parse is dropped rather than interpolated. A typo would
 * otherwise reach the header as a source expression matching nothing, which is
 * a broken photo path presented as a configured one.
 */
function originOf(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

/** Drops the absent and the repeated, preserving order. */
function sources(...candidates: readonly (string | undefined)[]): string[] {
  return [...new Set(candidates.filter((candidate) => candidate !== undefined))];
}

/**
 * **Production is `NODE_ENV === "production"` and everything else is
 * development**, which is the fail-safe direction rather than the tidy one.
 *
 * The two headers that vary are HSTS and `upgrade-insecure-requests`, and both
 * are harmful in the wrong place rather than merely absent: the development
 * origin is HTTPS by design (ADR-0018), so an HSTS header sent there pins HSTS
 * against `*.localhost` in the developer's own browser, which is unpleasant to
 * undo and reaches every other project they run. An unset `NODE_ENV` therefore
 * has to read as development. Missing HSTS in production is a header the
 * go-live scan finds; HSTS in development is a browser somebody has to repair.
 *
 * **`NODE_ENV` is deliberately not declared in `turbo.json`.** Next sets it
 * inside its own process — `production` for `next build`, `development` for
 * `next dev` — so it survives whatever Turborepo's strict mode filters out of
 * the environment it spawns. Declaring it on `build` would add to the cache key
 * a value that never varies.
 */
function isProduction(environment: HeaderEnvironment): boolean {
  return environment.NODE_ENV === "production";
}

/**
 * The Content-Security-Policy, enforced rather than report-only.
 *
 * Report-only first was rejected at the spec's C6 on the one point that
 * settles it: `frame-ancestors` does nothing in report-only mode, and it is the
 * directive the whole header is here for.
 *
 * **`script-src 'unsafe-inline'` is a deliberate, temporary decision, recorded
 * by #232 and revisited by #253.** Every prerendered document in a production
 * build carries at least one inline `<script>` — React's streaming timing
 * script, with the not-found and global-error documents carrying seven and
 * eight flight-data scripts — and hashes cannot cover them because the
 * flight-data payloads vary per request. So the only route to dropping it is a
 * nonce, and a nonce means a per-request proxy and `await connection()` on
 * every page: Next's own bundled documentation for the installed version states
 * that _"Partial Prerendering (PPR) is incompatible with nonce-based CSP since
 * static shell scripts won't have access to the nonce"_. This app is
 * `cacheComponents` plus `partialPrefetching`, so that trade is the whole of
 * #253 and is not taken here. **Do not silently fix this, and do not silently
 * keep it.**
 */
export function contentSecurityPolicy(environment: HeaderEnvironment): string {
  const production = isProduction(environment);

  // The transformation zone that serves an approved photo on the Wall.
  const photoDelivery = originOf(environment.PHOTO_PUBLIC_BASE);
  // The object store itself: where the browser PUTs an upload, and where the
  // Admin's review `<img>` fetches a signed quarantine GET from. **A different
  // host from the one above in production**, which is why `img-src` names two.
  const photoStore = originOf(environment.PHOTO_S3_ENDPOINT);
  // There is no `tunnelRoute`, so the browser posts events to Sentry's ingest
  // host directly and `connect-src` has to name it. Absent DSN, absent origin —
  // the SDK is then never initialised either, so nothing is missing.
  const sentryIngest = originOf(environment.NEXT_PUBLIC_SENTRY_DSN);

  const directives: Record<string, readonly string[]> = {
    "default-src": ["'self'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
    "frame-ancestors": ["'none'"],
    "form-action": ["'self'", GOOGLE_AUTHORIZATION_ORIGIN],
    // React reconstructs server-side error stacks in the browser with `eval` in
    // development and does not in production — Next's bundled CSP guide is the
    // source. So the relaxation is development-only rather than everywhere.
    "script-src": sources("'self'", "'unsafe-inline'", production ? undefined : "'unsafe-eval'"),
    "style-src": ["'self'", "'unsafe-inline'"],
    // `blob:` is the picker's preview. `publish/_lib/downscale.ts` hands the
    // chosen photo to `URL.createObjectURL` before anything is uploaded, so
    // without it a Worker sees a broken image at the moment she chooses one.
    // `data:` is the design system's inline SVG chevron, reached as a CSS
    // `background-image`, which `img-src` governs.
    "img-src": sources("'self'", "data:", "blob:", photoDelivery, photoStore),
    // **No `ws:` source, and that is a measurement rather than an omission.**
    // Turbopack's HMR socket is same-host, and CSP Level 3 matches it against
    // `'self'` — driven on a running dev server, the console prints
    // `[HMR] connected` with no violation. A `ws:` source added "to be safe"
    // would be a development-only relaxation nothing needs.
    "connect-src": sources("'self'", sentryIngest, photoStore),
    "font-src": ["'self'"],
  };

  const policy = Object.entries(directives).map(
    ([directive, values]) => `${directive} ${values.join(" ")}`,
  );

  /**
   * **Only where the policy admits nothing plaintext**, which is a narrower
   * condition than "production" and the difference was measured rather than
   * reasoned about.
   *
   * A local production build reads the same `.env.local` every dev server does,
   * so its policy admits `http://127.0.0.1:9000` — and this directive would
   * then rewrite every presigned PUT and every review image to a scheme MinIO
   * does not serve. A policy that admits an origin in one directive and orders
   * every request to it upgraded in another contradicts itself; the
   * contradiction is settled in favour of the admission, because the admission
   * is the value somebody configured.
   *
   * Nothing is lost in the deployment this is for. Both photo origins and the
   * ingest host are HTTPS there, so the condition holds — and where it does
   * not, the source expressions are already the stronger rule: an
   * `http://` URL does not match an `https://` origin, so it is **blocked**
   * rather than upgraded.
   */
  const admitsPlaintext = [photoDelivery, photoStore, sentryIngest].some((origin) =>
    origin?.startsWith("http:"),
  );
  if (production && !admitsPlaintext) policy.push("upgrade-insecure-requests");

  return policy.join("; ");
}

/**
 * The seven headers, minus HSTS wherever this is not a production build.
 *
 * `X-Frame-Options: DENY` sits beside `frame-ancestors 'none'` rather than
 * instead of it, which is what the spec asks for: the CSP directive is the one
 * that matters and the legacy header is what a browser without it reads.
 */
export function securityHeaders(environment: HeaderEnvironment): ResponseHeader[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(environment) },
    ...(isProduction(environment)
      ? [{ key: "Strict-Transport-Security", value: STRICT_TRANSPORT_SECURITY }]
      : []),
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
  ];
}

/**
 * What `next.config.ts` puts in front of the gated-route rules.
 *
 * `Referrer-Policy` is the one here that was already being relied on without
 * being decided: the browser default is `strict-origin-when-cross-origin`, and
 * that default is currently the only thing keeping `/admin/enrol/<token>` — a
 * credential in a path segment, `secrets-in-url-paths` — out of a cross-origin
 * `Referer`. Sending it makes the product own the answer instead of inheriting
 * it.
 */
export function securityHeaderRules(environment: HeaderEnvironment) {
  return [{ source: ALL_ROUTES, headers: securityHeaders(environment) }];
}
