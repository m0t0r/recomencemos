/**
 * The response-header set as a table, which is what makes a later edit that
 * drops one of them red rather than unnoticed (#232).
 *
 * **It is here and not at seam 3 because a running server is one environment at
 * a time**, and the values worth pinning are the ones that differ between
 * three. What a real request carries is checked running, and that is the PR's
 * seam-3 evidence.
 *
 * Node environment for the `next.config` import, for the `withSentryConfig`
 * reason `gated-routes.test.ts` records in full.
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
import { configuredHeaders } from "./testing/configured-headers";

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
      // The live interest-inference API, standing where the brief named FLoC's
      // withdrawn `interest-cohort`. The module says why.
      "browsing-topics=()",
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

  /** Sent in development it would pin HSTS against `*.localhost`; see the module. */
  it("sends no HSTS in development", () => {
    expect(keysOf(DEVELOPMENT)).not.toContain("Strict-Transport-Security");
  });

  /** The ambiguous case has to fail towards the recoverable one — `isProduction`. */
  it("treats an unset NODE_ENV as development rather than production", () => {
    expect(keysOf({})).not.toContain("Strict-Transport-Security");
    expect(directivesOf({})).not.toHaveProperty("upgrade-insecure-requests");
  });

  it("upgrades insecure requests in production and not in development", () => {
    expect(contentSecurityPolicy(PRODUCTION)).toContain("upgrade-insecure-requests");
    expect(contentSecurityPolicy(DEVELOPMENT)).not.toContain("upgrade-insecure-requests");
  });

  /** The case that made the directive conditional on more than `NODE_ENV`. */
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

  /** The load-bearing pair: without them `/continue` and Offer acceptance are clickjackable. */
  it("refuses every framer, in every environment", () => {
    for (const environment of [PRODUCTION, DEVELOPMENT, CI_BUILD, {}]) {
      expect(directivesOf(environment)["frame-ancestors"]).toEqual(["'none'"]);
      expect(valueOf(environment, "X-Frame-Options")).toBe("DENY");
    }
  });

  /** Pinned so that changing the temporary value is deliberate rather than quiet (#253). */
  it("admits inline script, which is the deliberate gap", () => {
    expect(directivesOf(PRODUCTION)["script-src"]).toEqual(["'self'", "'unsafe-inline'"]);
  });

  /** React reconstructs server-side error stacks with `eval`, in development only. */
  it("admits eval in development and not in production", () => {
    expect(directivesOf(DEVELOPMENT)["script-src"]).toContain("'unsafe-eval'");
    expect(directivesOf(PRODUCTION)["script-src"]).not.toContain("'unsafe-eval'");
  });

  /** One origin and not a wildcard; the module carries why it is admitted at all. */
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

  /** The origin and never the path — `PHOTO_PUBLIC_BASE` carries a bucket path. */
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

  /** `blob:` is the picker's preview, built before anything is uploaded. */
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
  });

  it("puts the string nowhere in the header at all", () => {
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
