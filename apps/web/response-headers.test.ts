/**
 * The response-header set as a table, which is what makes a later edit that
 * drops one of them red rather than unnoticed (#232).
 *
 * **This belongs in `web:test` and not at seam 3**, for the reason
 * `gated-routes.test.ts` gives beside it: the question here is whether the
 * *configuration* is right for environments a running server cannot be in at
 * once. A dev server can show the development set and nothing else — the two
 * headers that differ, and the two that are actively harmful in the wrong
 * place, are exactly the ones it can never demonstrate. What a real request
 * carries is checked running, and that leg is the PR's seam-3 evidence.
 *
 * **Node environment, and the import on the last line is why** — the same
 * `withSentryConfig` path-resolution trap `gated-routes.test.ts` records: under
 * happy-dom `document` exists while `document.currentScript` is `null`, the
 * bundler plugin resolves its loader against `document.baseURI`, and the whole
 * suite fails to collect with "The URL must be of scheme file".
 */

// @vitest-environment node

import {
  ALL_ROUTES,
  GOOGLE_AUTHORIZATION_ORIGIN,
  PERMISSIONS_POLICY,
  STRICT_TRANSPORT_SECURITY,
  contentSecurityPolicy,
  securityHeaderRules,
  securityHeaders,
  type HeaderEnvironment,
} from "./lib/response-headers";
import nextConfig from "./next.config";

/**
 * A production build's environment, in the shape the deploy provides it: two
 * photo origins on **different hosts**, which is the production case the local
 * one cannot exercise because MinIO serves both.
 */
const PRODUCTION: HeaderEnvironment = {
  NODE_ENV: "production",
  PHOTO_PUBLIC_BASE: "https://photos.recomencemos.online/recomencemos-photos",
  PHOTO_S3_ENDPOINT: "https://abc123.r2.cloudflarestorage.com",
  NEXT_PUBLIC_SENTRY_DSN: "https://key@o4500.ingest.us.sentry.io/4501",
};

/** What `apps/web/.env.example` produces: one MinIO origin serving both roles. */
const DEVELOPMENT: HeaderEnvironment = {
  NODE_ENV: "development",
  PHOTO_PUBLIC_BASE: "http://127.0.0.1:9000/recomencemos-photos",
  PHOTO_S3_ENDPOINT: "http://127.0.0.1:9000",
};

/**
 * CI. There is no `.env.local` in a CI checkout and no monitoring account, so
 * every optional origin is absent — the row that catches a header emitting the
 * string "undefined" as a source expression.
 */
const CI_BUILD: HeaderEnvironment = { NODE_ENV: "production" };

/** The CSP as `{ directive: sources }`, so a case can ask about one directive. */
function directivesOf(environment: HeaderEnvironment): Record<string, string[]> {
  const parsed: Record<string, string[]> = {};
  for (const clause of contentSecurityPolicy(environment).split("; ")) {
    const [directive, ...sources] = clause.split(" ");
    if (directive) parsed[directive] = sources;
  }
  return parsed;
}

/** What `next.config.ts` actually hands Next, resolved once. */
async function configuredHeaders() {
  const headers = await nextConfig.headers?.();
  expect(headers, "next.config.ts declares no headers()").toBeDefined();
  return headers ?? [];
}

function keysOf(environment: HeaderEnvironment): string[] {
  return securityHeaders(environment).map((header) => header.key);
}

function valueOf(environment: HeaderEnvironment, key: string): string | undefined {
  return securityHeaders(environment).find((header) => header.key === key)?.value;
}

describe("the header set the security policy names", () => {
  /**
   * Retyped rather than derived, so a header deleted from the module fails here
   * instead of silently agreeing with itself.
   */
  const ALWAYS = [
    "Content-Security-Policy",
    "X-Frame-Options",
    "X-Content-Type-Options",
    "Referrer-Policy",
    "Permissions-Policy",
  ];

  it.each(ALWAYS)("sends %s in production", (key) => {
    expect(keysOf(PRODUCTION)).toContain(key);
  });

  it.each(ALWAYS)("sends %s in development too", (key) => {
    expect(keysOf(DEVELOPMENT)).toContain(key);
  });

  it.each([
    ["X-Frame-Options", "DENY"],
    ["X-Content-Type-Options", "nosniff"],
    ["Referrer-Policy", "strict-origin-when-cross-origin"],
    ["Permissions-Policy", PERMISSIONS_POLICY],
  ])("sets %s to %s", (key, value) => {
    expect(valueOf(PRODUCTION, key)).toBe(value);
  });

  it("sends seven headers in production and six everywhere else", () => {
    expect(keysOf(PRODUCTION)).toHaveLength(ALWAYS.length + 1);
    expect(keysOf(DEVELOPMENT)).toHaveLength(ALWAYS.length);
  });

  it("denies every capability this product does not use", () => {
    expect(PERMISSIONS_POLICY.split(", ").toSorted()).toEqual([
      "accelerometer=()",
      "camera=()",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "midi=()",
      "payment=()",
      "usb=()",
    ]);
  });
});

/**
 * The two headers that are wrong in the wrong environment rather than merely
 * absent, which is the pair this file exists for more than any other.
 */
describe("HTTPS enforcement is production-only", () => {
  it("sends HSTS on a production build", () => {
    expect(valueOf(PRODUCTION, "Strict-Transport-Security")).toBe(STRICT_TRANSPORT_SECURITY);
  });

  it("carries includeSubDomains and deliberately not preload", () => {
    // Preloading is close to irreversible and is a human's decision about a
    // domain — the go-live runbook carries it as its own box.
    expect(STRICT_TRANSPORT_SECURITY).toContain("includeSubDomains");
    expect(STRICT_TRANSPORT_SECURITY).not.toContain("preload");
  });

  /**
   * The development origin is HTTPS by design, so this header sent there pins
   * HSTS against `*.localhost` in the developer's own browser — which reaches
   * every other project on the machine and is unpleasant to undo.
   */
  it("sends no HSTS in development", () => {
    expect(keysOf(DEVELOPMENT)).not.toContain("Strict-Transport-Security");
  });

  /**
   * An unset `NODE_ENV` reads as development. Missing HSTS in production is a
   * header the go-live scan finds; HSTS in development is a browser somebody
   * has to repair, so the ambiguous case fails towards the recoverable one.
   */
  it("treats an unset NODE_ENV as development rather than production", () => {
    expect(keysOf({})).not.toContain("Strict-Transport-Security");
    expect(directivesOf({})).not.toHaveProperty("upgrade-insecure-requests");
  });

  it("upgrades insecure requests in production and not in development", () => {
    expect(contentSecurityPolicy(PRODUCTION)).toContain("upgrade-insecure-requests");
    expect(contentSecurityPolicy(DEVELOPMENT)).not.toContain("upgrade-insecure-requests");
  });

  /**
   * The case that made the directive conditional on more than `NODE_ENV`, found
   * by reading a local `pnpm build` back out of `routes-manifest.json`: a
   * production build on a developer's machine reads the same `.env.local` a dev
   * server does, so its policy admits `http://127.0.0.1:9000` — and upgrading
   * would rewrite every presigned PUT to a scheme MinIO does not serve.
   */
  it("does not upgrade requests to an origin the same policy admits in plaintext", () => {
    const localProductionBuild = { ...DEVELOPMENT, NODE_ENV: "production" };

    expect(directivesOf(localProductionBuild)["img-src"]).toContain("http://127.0.0.1:9000");
    expect(contentSecurityPolicy(localProductionBuild)).not.toContain("upgrade-insecure-requests");
    // Still a production build in every other respect.
    expect(keysOf(localProductionBuild)).toContain("Strict-Transport-Security");
  });
});

describe("the CSP names every directive the security policy sets", () => {
  it.each([
    ["default-src", ["'self'"]],
    ["base-uri", ["'self'"]],
    ["object-src", ["'none'"]],
    ["frame-ancestors", ["'none'"]],
    ["form-action", ["'self'", GOOGLE_AUTHORIZATION_ORIGIN]],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["font-src", ["'self'"]],
  ])("sets %s to exactly %s", (directive, expected) => {
    expect(directivesOf(PRODUCTION)[directive]).toEqual(expected);
  });

  /**
   * The load-bearing one. Without it the second-factor form at `/continue` and
   * the acceptance of an Offer are both clickjackable, and the second is one
   * click releasing a displaced person's name, phone and email.
   */
  it("refuses every framer, in every environment", () => {
    for (const environment of [PRODUCTION, DEVELOPMENT, CI_BUILD, {}]) {
      expect(directivesOf(environment)["frame-ancestors"]).toEqual(["'none'"]);
      expect(valueOf(environment, "X-Frame-Options")).toBe("DENY");
    }
  });

  /**
   * The temporary value, asserted so that dropping it is a decision somebody
   * takes on purpose rather than a change that quietly passes. #253 is where
   * the nonce that replaces it is weighed against the prerendered shells it
   * costs; until then this is what keeps them.
   */
  it("admits inline script, which is the deliberate gap", () => {
    expect(directivesOf(PRODUCTION)["script-src"]).toEqual(["'self'", "'unsafe-inline'"]);
  });

  /**
   * React reconstructs server-side error stacks in the browser with `eval` in
   * development and does not in production.
   */
  it("admits eval in development and not in production", () => {
    expect(directivesOf(DEVELOPMENT)["script-src"]).toContain("'unsafe-eval'");
    expect(directivesOf(PRODUCTION)["script-src"]).not.toContain("'unsafe-eval'");
  });

  /**
   * **The one origin `form-action` admits besides this app**, and the case that
   * put it there rather than a prediction that it would be needed.
   *
   * `form-action` governs the redirect a form submission *follows*. With
   * JavaScript unavailable the Google door is a native form POST answered by a
   * `303` to Google, so `'self'` alone kills that door silently — driven
   * against a running dev server, the POST was made and the redirect was never
   * followed. Widened rather than deleted: the directive still holds every
   * other form on this site to this origin.
   */
  it("admits Google's authorization origin and nothing wider", () => {
    expect(directivesOf(PRODUCTION)["form-action"]).toEqual([
      "'self'",
      "https://accounts.google.com",
    ]);
    expect(GOOGLE_AUTHORIZATION_ORIGIN).not.toContain("*");
  });
});

describe("the photo path's two origins", () => {
  it("names both hosts in img-src, because production serves them from two", () => {
    expect(directivesOf(PRODUCTION)["img-src"]).toEqual([
      "'self'",
      "data:",
      "blob:",
      "https://photos.recomencemos.online",
      "https://abc123.r2.cloudflarestorage.com",
    ]);
  });

  /** The browser PUTs an upload straight to the store, which is the whole of DD6. */
  it("names the store in connect-src, beside the Sentry ingest host", () => {
    expect(directivesOf(PRODUCTION)["connect-src"]).toEqual([
      "'self'",
      "https://o4500.ingest.us.sentry.io",
      "https://abc123.r2.cloudflarestorage.com",
    ]);
  });

  /**
   * The origin and never the path. `PHOTO_PUBLIC_BASE` carries a bucket path,
   * and a source expression with a path stops matching the moment a key is
   * stored one level deeper.
   */
  it("takes the origin of the public base and drops its bucket path", () => {
    expect(directivesOf(PRODUCTION)["img-src"]).not.toContain(
      "https://photos.recomencemos.online/recomencemos-photos",
    );
  });

  /** Locally MinIO is both roles, and one origin repeated is one source expression. */
  it("collapses the two to one where development serves both from MinIO", () => {
    expect(directivesOf(DEVELOPMENT)["img-src"]).toEqual([
      "'self'",
      "data:",
      "blob:",
      "http://127.0.0.1:9000",
    ]);
  });

  /**
   * `blob:` is the picker's preview — `publish/_lib/downscale.ts` hands the
   * chosen file to `URL.createObjectURL` before anything is uploaded, so
   * without it a Worker sees a broken image at the moment she chooses one.
   */
  it("admits the object URL the picker previews from", () => {
    expect(directivesOf(PRODUCTION)["img-src"]).toContain("blob:");
  });
});

/**
 * The CI build, where every optional origin is absent. This is the row that
 * catches the failure mode a template string has and a filter does not: a
 * header carrying the literal `undefined` as a source expression, which is a
 * misconfiguration presented as a configuration.
 */
describe("an absent origin is absent rather than interpolated", () => {
  it.each(["img-src", "connect-src"])("leaves %s with no undefined source", (directive) => {
    expect(directivesOf(CI_BUILD)[directive]).not.toContain("undefined");
    expect(contentSecurityPolicy(CI_BUILD)).not.toContain("undefined");
  });

  it("falls back to self alone", () => {
    expect(directivesOf(CI_BUILD)["connect-src"]).toEqual(["'self'"]);
    expect(directivesOf(CI_BUILD)["img-src"]).toEqual(["'self'", "data:", "blob:"]);
  });

  it("drops a value that will not parse as a URL", () => {
    // A typo would otherwise reach the header as a source expression matching
    // nothing: a broken photo path presented as a configured one.
    const malformed = { ...CI_BUILD, PHOTO_S3_ENDPOINT: "127.0.0.1:9000" };
    expect(directivesOf(malformed)["connect-src"]).toEqual(["'self'"]);
  });
});

/**
 * The wiring, asserted against what `next.config.ts` actually hands Next rather
 * than against the module in isolation — the same thing `gated-routes.test.ts`
 * does, and for the same reason: an export nobody assigns ships nothing.
 */
describe("next.config.ts sends the set on every route", () => {
  it("carries one rule matching every path", async () => {
    const rule = (await configuredHeaders()).find((entry) => entry.source === ALL_ROUTES);

    expect(rule, `no headers() rule for ${ALL_ROUTES}`).toBeDefined();
    expect(rule?.headers.map((header) => header.key)).toEqual(
      securityHeaders(process.env).map((header) => header.key),
    );
  });

  /**
   * The security set is not a prefix list, and the gated set still is. A
   * regression that merged the two would either leak `X-Robots-Tag` onto the
   * public Wall or lose `frame-ancestors` off everything outside six prefixes.
   */
  it("leaves the gated-route rules alone beside it", async () => {
    const sources = (await configuredHeaders()).map((rule) => rule.source);

    expect(sources).toContain("/admin");
    expect(sources).not.toContain(`${ALL_ROUTES}/:path*`);
  });

  it("returns the security rule first, so a later rule cannot shadow it", async () => {
    expect((await configuredHeaders())[0]?.source).toBe(ALL_ROUTES);
  });

  it("builds the rule shape Next wants", () => {
    expect(securityHeaderRules(PRODUCTION)).toEqual([
      { source: ALL_ROUTES, headers: securityHeaders(PRODUCTION) },
    ]);
  });
});
