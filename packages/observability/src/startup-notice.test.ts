import { createLoggerOptions } from "@repo/observability/logger-options";
import { isReportingConfigured, logStartupNotice } from "@repo/observability/startup-notice";
import pino from "pino";
import { Writable } from "node:stream";

function harness() {
  const written: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      written.push(String(chunk));
      callback();
    },
  });

  return {
    // `trace` so the test can never pass because a line was filtered out — the
    // point of NFR2's `warn` is the *production* floor, and that is asserted by
    // reading the level off the line rather than by hiding lines below it.
    logger: pino(createLoggerOptions({ LOG_LEVEL: "trace" }), stream),
    lines: () => written.map((line) => JSON.parse(line) as Record<string, unknown>),
  };
}

const DSN = "https://examplePublicKey@o0.ingest.sentry.io/0";

describe("logStartupNotice", () => {
  // One line is NFR2's count.
  it("emits exactly one line when there is no DSN", () => {
    const { logger, lines } = harness();

    logStartupNotice({ NODE_ENV: "development" }, logger);

    expect(lines()).toHaveLength(1);
  });

  it("emits it at warn, so it survives the production info floor", () => {
    const { logger, lines } = harness();

    logStartupNotice({ NODE_ENV: "development" }, logger);

    expect(lines()[0]?.level).toBe("warn");
  });

  it("names the variable to set, not only that something is unset", () => {
    const { logger, lines } = harness();

    logStartupNotice({ NODE_ENV: "development" }, logger);

    expect(String(lines()[0]?.msg)).toContain("NEXT_PUBLIC_SENTRY_DSN");
  });

  it("carries the gaps as a queryable field, not only as prose", () => {
    const { logger, lines } = harness();

    logStartupNotice({ NODE_ENV: "development" }, logger);

    const context = lines()[0]?.context as Record<string, unknown> | undefined;
    expect(context?.gaps).toEqual(["reporting-inactive"]);
  });

  it("says nothing at all once a DSN is configured in development", () => {
    const { logger, lines } = harness();

    logStartupNotice({ NODE_ENV: "development", NEXT_PUBLIC_SENTRY_DSN: DSN }, logger);

    expect(lines()).toHaveLength(0);
  });

  it("fires the same notice in production when the release variable is absent", () => {
    const { logger, lines } = harness();

    logStartupNotice({ NODE_ENV: "production", NEXT_PUBLIC_SENTRY_DSN: DSN }, logger);

    const context = lines()[0]?.context as Record<string, unknown> | undefined;
    expect(lines()).toHaveLength(1);
    expect(lines()[0]?.level).toBe("warn");
    expect(context?.gaps).toEqual(["release-unknown"]);
  });

  it("does not mention the release in development, where nothing populates it", () => {
    const { logger, lines } = harness();

    logStartupNotice({ NODE_ENV: "development", NEXT_PUBLIC_SENTRY_DSN: DSN }, logger);

    expect(lines()).toHaveLength(0);
  });

  // NFR2 counts lines, not notices.
  it("stays at one line when both gaps are open", () => {
    const { logger, lines } = harness();

    logStartupNotice({ NODE_ENV: "production" }, logger);

    const context = lines()[0]?.context as Record<string, unknown> | undefined;
    expect(lines()).toHaveLength(1);
    expect(context?.gaps).toEqual(["reporting-inactive", "release-unknown"]);
  });

  it("says nothing when the deployment is fully configured", () => {
    const { logger, lines } = harness();

    logStartupNotice(
      { NODE_ENV: "production", NEXT_PUBLIC_SENTRY_DSN: DSN, NEXT_PUBLIC_RELEASE: "abc1234" },
      logger,
    );

    expect(lines()).toHaveLength(0);
  });

  it("treats an empty DSN as no DSN, which is how the off-switch is usually reached", () => {
    const { logger, lines } = harness();

    logStartupNotice({ NODE_ENV: "development", NEXT_PUBLIC_SENTRY_DSN: "" }, logger);

    expect(lines()).toHaveLength(1);
  });
});

/**
 * `register()` reads this rather than testing the variable itself, so that
 * "reporting is configured" has exactly one definition. When it had two, a
 * whitespace DSN announced itself inactive and then initialised the SDK — which
 * is the state the off-switch exists to make impossible.
 */
describe("isReportingConfigured", () => {
  it("is true for a DSN", () => {
    expect(isReportingConfigured({ NEXT_PUBLIC_SENTRY_DSN: DSN })).toBe(true);
  });

  it("is false when the variable is absent", () => {
    expect(isReportingConfigured({})).toBe(false);
  });

  it("is false for an empty DSN", () => {
    expect(isReportingConfigured({ NEXT_PUBLIC_SENTRY_DSN: "" })).toBe(false);
  });

  it("is false for a whitespace DSN, which a bare truthiness check calls configured", () => {
    expect(isReportingConfigured({ NEXT_PUBLIC_SENTRY_DSN: "  " })).toBe(false);
  });

  it("agrees with the notice: whatever it calls unconfigured is reported as a gap", () => {
    for (const dsn of [undefined, "", "   "]) {
      const { logger, lines } = harness();

      logStartupNotice({ NODE_ENV: "development", NEXT_PUBLIC_SENTRY_DSN: dsn }, logger);

      expect(isReportingConfigured({ NEXT_PUBLIC_SENTRY_DSN: dsn })).toBe(false);
      expect((lines()[0]?.context as { gaps?: string[] })?.gaps).toEqual(["reporting-inactive"]);
    }
  });
});
