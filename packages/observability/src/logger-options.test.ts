import { AppError } from "@repo/errors/app-error";
import { REDACTED } from "@repo/errors/redaction";
import {
  createLoggerOptions,
  MAX_LINE_BYTES,
  MIN_LINE_BYTES,
  resolveLogFormat,
  resolveMaxLineBytes,
} from "@repo/observability/logger-options";
import pino from "pino";
import { Writable } from "node:stream";

const SECRET = "SENTINEL_SECRET_VALUE";

// The shipped key names are module-internal to `@repo/errors`, so this fixture
// names them itself — the same idiom, and the same honest limit, as
// `packages/errors/src/redaction.test.ts`. It asserts that the *mechanism*
// works on the names that ship, never that the names are sufficient, and it is
// the log-line third of NFR10's three-egress parity.
//
// The drift it cannot catch is identical to the other two: a name added to
// `redaction.ts` and not here goes untested and the suite stays green. Only a
// name removed from the module fails here.
const SHIPPED_KEY_NAMES = [
  "authorization",
  "auth",
  "cookie",
  "set-cookie",
  "credentials",
  "password",
  "passwd",
  "secret",
  "client_secret",
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "api_key",
  "apiKey",
  "x-api-key",
  "session",
  "session_id",
  "private_key",
  "connection_string",
  "credit_card",
  "card_number",
  "cvv",
  "ssn",
];

function everyShippedKey(): Record<string, string> {
  return Object.fromEntries(SHIPPED_KEY_NAMES.map((name) => [name, SECRET]));
}

/**
 * A raw line with the clock stamped out, so two emits can be compared byte for
 * byte. `time` is the one field two emits cannot share.
 */
function withoutClock(line: string): string {
  return line.replace(/"time":\d+/, '"time":0');
}

/** The serialised `err` off a line, so an assertion is one cast rather than three. */
function errorField(line: Record<string, unknown> | undefined): Record<string, unknown> {
  return (line?.err ?? {}) as Record<string, unknown>;
}

interface Harness {
  logger: pino.Logger;
  lines: () => Record<string, unknown>[];
  raw: () => string[];
}

/**
 * A logger over an in-memory stream, built from the options under test.
 *
 * pino's own `pino/test/helper` is deliberately not used: it asserts on
 * `pid`/`hostname` before stripping them, and these options replace those.
 */
function harness(
  env: Parameters<typeof createLoggerOptions>[0] = {},
  readTraceContext?: Parameters<typeof createLoggerOptions>[1],
): Harness {
  const written: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      written.push(String(chunk));
      callback();
    },
  });

  return {
    logger: pino(createLoggerOptions(env, readTraceContext), stream),
    raw: () => written,
    lines: () => written.map((line) => JSON.parse(line) as Record<string, unknown>),
  };
}

describe("base fields", () => {
  it("carries service, env, release, level, time and msg on every line", () => {
    const { logger, lines } = harness({ NODE_ENV: "production", NEXT_PUBLIC_RELEASE: "abc123" });

    logger.info("hello");

    expect(lines()[0]).toMatchObject({
      service: expect.any(String),
      env: "production",
      release: "abc123",
      level: "info",
      time: expect.any(Number),
      msg: "hello",
    });
  });

  it("replaces pino's process and host fields rather than carrying them", () => {
    const { logger, lines } = harness();

    logger.info("hello");

    expect(lines()[0]).not.toHaveProperty("pid");
    expect(lines()[0]).not.toHaveProperty("hostname");
  });

  it("still carries a release when the environment supplies none", () => {
    const { logger, lines } = harness({ NODE_ENV: "production" });

    logger.info("hello");

    expect(lines()[0]?.release).toEqual(expect.any(String));
  });

  it("emits the level name rather than the number", () => {
    const { logger, lines } = harness({ LOG_LEVEL: "trace" });

    logger.error("boom");
    logger.trace("quiet");

    expect(lines().map((line) => line.level)).toEqual(["error", "trace"]);
  });
});

describe("the level floor (NFR8)", () => {
  it("defaults to info in production", () => {
    expect(createLoggerOptions({ NODE_ENV: "production" }).level).toBe("info");
  });

  it("defaults to debug in development", () => {
    expect(createLoggerOptions({ NODE_ENV: "development" }).level).toBe("debug");
  });

  it("defaults to debug when the environment says nothing", () => {
    expect(createLoggerOptions({}).level).toBe("debug");
  });

  it("is overridden at runtime by LOG_LEVEL, with no rebuild", () => {
    expect(createLoggerOptions({ NODE_ENV: "production", LOG_LEVEL: "trace" }).level).toBe("trace");
  });

  it("falls back to the default rather than letting a typo stop the server booting", () => {
    expect(createLoggerOptions({ NODE_ENV: "production", LOG_LEVEL: "trce" }).level).toBe("info");
  });

  it("drops a line below the floor and keeps one at it", () => {
    const { logger, lines } = harness({ NODE_ENV: "production" });

    logger.debug("below");
    logger.info("at");

    expect(lines().map((line) => line.msg)).toEqual(["at"]);
  });
});

describe("the format switch (NFR9)", () => {
  it("is pretty in development and JSON in production", () => {
    expect(resolveLogFormat({ NODE_ENV: "development" })).toBe("pretty");
    expect(resolveLogFormat({ NODE_ENV: "production" })).toBe("json");
  });

  it("is overridden either way by LOG_FORMAT", () => {
    expect(resolveLogFormat({ NODE_ENV: "development", LOG_FORMAT: "json" })).toBe("json");
    expect(resolveLogFormat({ NODE_ENV: "production", LOG_FORMAT: "pretty" })).toBe("pretty");
  });

  it("ignores an unrecognised LOG_FORMAT rather than inventing a third destination", () => {
    expect(resolveLogFormat({ NODE_ENV: "production", LOG_FORMAT: "yaml" })).toBe("json");
  });

  it("makes every line the logger writes parse with a bare JSON.parse", () => {
    const { logger, raw } = harness({ NODE_ENV: "development", LOG_FORMAT: "json" });

    logger.info({ context: { orderId: "o_1" } }, "one");
    logger.error({ err: new AppError({ code: "boom", message: "operator detail" }) }, "two");
    logger.warn({ context: { nested: { deep: [1, 2, 3] } } }, "three");

    expect(raw()).toHaveLength(3);
    for (const line of raw()) {
      expect(() => JSON.parse(line) as unknown).not.toThrow();
    }
  });

  it("configures no transport target anywhere — the switch selects a destination", () => {
    expect(createLoggerOptions({})).not.toHaveProperty("transport");
  });
});

describe("redaction (NFR10, the log-line egress)", () => {
  it("replaces every shipped key name under context, to a nesting depth of 4", () => {
    const { logger, raw, lines } = harness();

    logger.info(
      {
        context: {
          ...everyShippedKey(),
          one: { ...everyShippedKey(), two: { ...everyShippedKey(), three: everyShippedKey() } },
        },
      },
      "with secrets",
    );

    expect(raw()[0]).not.toContain(SECRET);

    const context = lines()[0]?.context as Record<string, unknown>;
    for (const name of SHIPPED_KEY_NAMES) {
      expect(context[name]).toBe(REDACTED);
    }
  });

  it("replaces every shipped key name under the err root too, not only under context", () => {
    const { logger, raw, lines } = harness();

    logger.error(
      { err: new AppError({ code: "boom", message: "d", context: everyShippedKey() }) },
      "with secrets",
    );

    expect(raw()[0]).not.toContain(SECRET);

    const context = errorField(lines()[0]).context as Record<string, unknown>;
    for (const name of SHIPPED_KEY_NAMES) {
      expect(context[name]).toBe(REDACTED);
    }
  });

  it("reaches the post-serialisation shape an incident actually produces (DD3)", () => {
    const { logger, raw } = harness();
    const cause = new Error("ECONNREFUSED");
    Object.assign(cause, { config: { headers: { authorization: SECRET } } });

    logger.error(
      { err: new AppError({ code: "upstream", message: "call failed", cause }) },
      "upstream failed",
    );

    expect(raw()[0]).not.toContain(SECRET);
    expect(raw()[0]).toContain(REDACTED);
  });
});

describe("the error serialiser", () => {
  const error = new AppError({
    code: "order_not_found",
    status: 404,
    message: "order lookup failed for tenant acme",
    userMessage: "That order no longer exists.",
    context: { orderId: "o_1" },
  });

  it("logs an AppError through the operator projection", () => {
    const { logger, lines } = harness();

    logger.error({ err: error }, "failed");

    expect(lines()[0]?.err).toMatchObject({
      code: "order_not_found",
      status: 404,
      message: "order lookup failed for tenant acme",
      userMessage: "That order no longer exists.",
      context: { orderId: "o_1" },
    });
  });

  // ADR-0005. The projection stopped carrying it, so `err` does too — the field
  // is lifted to the line's top level by `logRequestError`, which is where it is
  // asserted. Here the point is only that the serialiser publishes no second copy.
  it("carries no requestId, which is now the line's rather than the projection's", () => {
    const { logger, lines } = harness();

    logger.error({ err: error }, "failed");

    expect(errorField(lines()[0])).not.toHaveProperty("requestId");
  });

  it("carries the stack, which the projection does not", () => {
    const { logger, lines } = harness();

    logger.error({ err: error }, "failed");

    expect(errorField(lines()[0]).stack).toEqual(expect.any(String));
  });

  it("walks the cause the projections deliberately drop", () => {
    const { logger, lines } = harness();

    logger.error(
      {
        err: new AppError({
          code: "upstream",
          message: "call failed",
          cause: new Error("ECONNREFUSED 10.0.0.4:5432"),
        }),
      },
      "failed",
    );

    const cause = errorField(lines()[0]).cause as { message?: string };

    expect(cause.message).toBe("ECONNREFUSED 10.0.0.4:5432");
  });

  it("serialises an ordinary Error too", () => {
    const { logger, lines } = harness();

    logger.error({ err: new Error("plain") }, "failed");

    expect(lines()[0]?.err).toMatchObject({ type: "Error", message: "plain" });
  });

  it("survives a forgery whose toOperatorJSON throws, and publishes nothing from it", () => {
    const { logger, lines } = harness();
    const forged = {
      [Symbol.for("@repo/errors:AppError")]: true,
      code: "forged",
      toOperatorJSON() {
        throw new Error("gotcha");
      },
    };

    expect(() => logger.error({ err: forged }, "failed")).not.toThrow();
    expect(JSON.stringify(errorField(lines()[0]))).not.toContain("gotcha");
  });

  it("survives a forgery whose toOperatorJSON returns something that is not an object", () => {
    const { logger, lines } = harness();
    const forged = {
      [Symbol.for("@repo/errors:AppError")]: true,
      toOperatorJSON: () => "not an object",
    };

    expect(() => logger.error({ err: forged }, "failed")).not.toThrow();
    expect(lines()[0]?.err).toEqual(expect.any(Object));
  });
});

describe("the line bound (NFR16)", () => {
  function oversized() {
    const { logger, raw, lines } = harness({ NEXT_PUBLIC_RELEASE: "abc123" });
    logger.info({ context: { blob: "x".repeat(20_000) } }, "too big");
    return { line: raw()[0] ?? "", parsed: lines()[0] ?? {} };
  }

  it("truncates rather than dropping the line", () => {
    expect(oversized().parsed).toMatchObject({ msg: "too big", truncated: true });
  });

  it("holds the line to 8 KB", () => {
    expect(Buffer.byteLength(oversized().line.trimEnd())).toBeLessThanOrEqual(MAX_LINE_BYTES);
    expect(MAX_LINE_BYTES).toBe(8 * 1024);
  });

  it("stays parseable with a bare JSON.parse, which a byte-slice would not be", () => {
    expect(() => JSON.parse(oversized().line) as unknown).not.toThrow();
  });

  it("keeps the guaranteed base fields", () => {
    expect(oversized().parsed).toMatchObject({
      service: expect.any(String),
      env: expect.any(String),
      release: "abc123",
      level: "info",
      time: expect.any(Number),
    });
  });

  it("shortens the message when the message is itself what overflows", () => {
    const { logger, raw, lines } = harness();

    logger.info("y".repeat(20_000));

    expect(Buffer.byteLength((raw()[0] ?? "").trimEnd())).toBeLessThanOrEqual(MAX_LINE_BYTES);
    expect(lines()[0]).toMatchObject({ truncated: true });
    expect(String(lines()[0]?.msg).startsWith("yyy")).toBe(true);
  });

  it("keeps code and status, which are the only record an oversized 4xx leaves", () => {
    const { logger, lines } = harness();

    logger.warn(
      { code: "rate_limited", status: 429, context: { blob: "x".repeat(20_000) } },
      "too big",
    );

    expect(lines()[0]).toMatchObject({ code: "rate_limited", status: 429, truncated: true });
  });

  it("holds the bound when a preserved field other than the message is what overflows", () => {
    const { logger, raw, lines } = harness();

    logger.info({ route: "/".concat("r".repeat(20_000)) }, "long route");

    expect(Buffer.byteLength((raw()[0] ?? "").trimEnd())).toBeLessThanOrEqual(MAX_LINE_BYTES);
    expect(lines()[0]).toMatchObject({ truncated: true, msg: "long route" });
    // The route did not fit, so it was dropped rather than allowed to breach the
    // bound — but the line, and everything a query binds to, survived.
    expect(lines()[0]).not.toHaveProperty("route");
  });

  it("holds the bound when every field is oversized at once", () => {
    const { logger, raw, lines } = harness();

    logger.info(
      { route: "r".repeat(20_000), context: { blob: "x".repeat(20_000) } },
      "m".repeat(20_000),
    );

    expect(Buffer.byteLength((raw()[0] ?? "").trimEnd())).toBeLessThanOrEqual(MAX_LINE_BYTES);
    expect(lines()[0]?.original_bytes).toEqual(expect.any(Number));
  });

  it("leaves a line under the bound exactly as it was", () => {
    const { logger, lines } = harness();

    logger.info({ context: { orderId: "o_1" } }, "small");

    expect(lines()[0]).not.toHaveProperty("truncated");
    expect(lines()[0]).not.toHaveProperty("original_bytes");
    expect(lines()[0]?.context).toEqual({ orderId: "o_1" });
  });
});

/**
 * The second question a rebuilt line has to answer.
 *
 * `truncated: true` says the line was rebuilt, which is a question nobody asks.
 * These cover the one they do ask — *how much was there* — and the reason the
 * count is seeded rather than admitted: the lines this field exists for are
 * precisely the lines under the most byte pressure, so a field offered after the
 * preserved ones would be missing from exactly the lines that need it.
 *
 * The cases the marker shares with the bound itself — that it survives every
 * field being oversized at once, and that a line under the bound carries neither
 * marker — are asserted where that behaviour already lives, in the NFR16 block
 * above, rather than cloned here.
 */
describe("what a rebuilt line says about the line it replaced", () => {
  const OVERSIZED = { context: { blob: "x".repeat(20_000) } };

  /**
   * The byte size of the same emit through a bound nothing can breach, which is
   * what the original measured.
   *
   * The payload carries no error on purpose: the stack allowance is a fraction
   * of the bound, so an error-carrying line would serialise differently under a
   * different bound and the two would not be comparable.
   */
  function bytesOfSameEmitUntruncated(): number {
    const { logger, raw } = harness({ LOG_MAX_LINE_BYTES: "1000000" });

    logger.info(OVERSIZED, "too big");

    return Buffer.byteLength((raw()[0] ?? "").trimEnd());
  }

  it("records the byte size of the line it replaced, not merely that it was over", () => {
    const { logger, lines } = harness();

    logger.info(OVERSIZED, "too big");

    expect(lines()[0]?.original_bytes).toBe(bytesOfSameEmitUntruncated());
  });

  it("survives the floor bound, where a field admitted after the preserved ones would not", () => {
    const { logger, raw, lines } = harness({ LOG_MAX_LINE_BYTES: String(MIN_LINE_BYTES) });

    logger.info(OVERSIZED, "too big");

    expect(Buffer.byteLength((raw()[0] ?? "").trimEnd())).toBeLessThanOrEqual(MIN_LINE_BYTES);
    expect(lines()[0]?.original_bytes).toEqual(expect.any(Number));
  });

  /**
   * The claim is that an under-bound line is emitted *byte-for-byte* as pino
   * produced it, and asserting on parsed properties cannot show that — a rebuilt
   * line parses too. So this compares the hook's output against the same options
   * with the hook removed, which is the only thing that distinguishes "untouched"
   * from "rebuilt into something that happens to look the same".
   *
   * `time` is stamped from the clock and is the one field two emits cannot share,
   * so it is normalised rather than the whole assertion being weakened.
   */
  it("passes a line under the bound through byte-for-byte", () => {
    const payload = { context: { orderId: "o_1" } };

    const capped = harness();
    capped.logger.info(payload, "small");

    const written: string[] = [];
    const uncapped = pino(
      { ...createLoggerOptions({}), hooks: {} },
      new Writable({
        write(chunk, _encoding, callback) {
          written.push(String(chunk));
          callback();
        },
      }),
    );
    uncapped.info(payload, "small");

    expect(withoutClock(capped.raw()[0] ?? "")).toBe(withoutClock(written[0] ?? ""));
  });
});

/**
 * A synthetic stack, because a real one under Vitest is neither deep nor
 * expensive — and the shape that breaks the cap is not a worst case but the
 * ordinary development one. `next dev` sets `Error.stackTraceLimit = 50`
 * unconditionally in its constructor, and under pnpm's isolated store a single
 * `node_modules` frame measures roughly this many bytes.
 */
const FRAME_BYTES = 250;

/**
 * And roughly this many for a frame naming a file in the repo — the disparity
 * ADR-0004 is about. A vendor frame costs more than twice what an application
 * frame costs and says less, which is why position alone spends the budget on
 * the wrong ones.
 */
const APPLICATION_FRAME_BYTES = 110;

/**
 * The three kinds of frame a real request stack carries. `internal` is Node's
 * own `node:` frames: not vendored, not application, and folded with the rest
 * because the classification rule asks what a frame is *worth*, not where it
 * was installed from.
 */
type FrameKind = "vendor" | "application" | "internal";

function frameOf(kind: FrameKind, index: number): string {
  if (kind === "internal")
    return `    at frame${index} (node:internal/process/task_queues:${index}:5)`;

  const path =
    kind === "vendor"
      ? "/repo/node_modules/.pnpm/".concat("p".repeat(FRAME_BYTES - 60), "/index.js")
      : "/repo/apps/web/app/".concat("a".repeat(APPLICATION_FRAME_BYTES - 60), "/route.ts");

  return `    at frame${index} (${path}:${index}:1)`;
}

/** A stack of exactly these frames, in this order. The general fixture. */
function stackFrom(label: string, kinds: readonly FrameKind[]): string {
  return [`${label}: synthetic`, ...kinds.map(frameOf)].join("\n");
}

function repeated(kind: FrameKind, count: number): FrameKind[] {
  return Array.from({ length: count }, () => kind);
}

/**
 * One application frame in every four, which is about the ratio a Next.js
 * request stack carries. It matters that this is a *mix*: a uniformly-vendor
 * stack collapses to two lines, and a suite built on one would assert the
 * budget's behaviour against a case the budget never has to think about.
 */
const APPLICATION_FRAME_EVERY = 4;

function syntheticStack(label: string, frames: number): string {
  return stackFrom(
    label,
    Array.from({ length: frames }, (_, index): FrameKind =>
      index % APPLICATION_FRAME_EVERY === APPLICATION_FRAME_EVERY - 1 ? "application" : "vendor",
    ),
  );
}

function withStack<E extends Error>(error: E, frames: number): E {
  error.stack = syntheticStack(error.name, frames);

  return error;
}

function withFrames<E extends Error>(error: E, kinds: readonly FrameKind[]): E {
  error.stack = stackFrom(error.name, kinds);

  return error;
}

describe("the stack budget", () => {
  function deepError(): AppError {
    return withStack(
      new AppError({ code: "deep", message: "operator detail", context: { orderId: "o_1" } }),
      50,
    );
  }

  it("keeps err whole on a development-depth stack rather than losing it to the cap", () => {
    const { logger, raw, lines } = harness();

    logger.error({ err: deepError() }, "failed");

    expect(Buffer.byteLength((raw()[0] ?? "").trimEnd())).toBeLessThanOrEqual(MAX_LINE_BYTES);
    expect(lines()[0]).not.toHaveProperty("truncated");
    expect(errorField(lines()[0])).toMatchObject({
      message: "operator detail",
      context: { orderId: "o_1" },
    });
  });

  it("keeps the leading frames, which are the throw site", () => {
    const { logger, lines } = harness();

    logger.error({ err: deepError() }, "failed");

    const stack = String(errorField(lines()[0]).stack);

    expect(stack).toContain("at frame0");
    expect(stack).not.toContain("at frame49");
  });

  it("says so on the stack it trimmed, rather than passing it off as a shallow one", () => {
    const { logger, lines } = harness();

    logger.error({ err: deepError() }, "failed");

    expect(String(errorField(lines()[0]).stack)).toMatch(/frames omitted/);
  });

  it("bounds every link of a cause chain, not only the outermost stack", () => {
    const { logger, raw, lines } = harness();
    const root = withStack(new Error("ECONNREFUSED 10.0.0.4:5432"), 10);
    const middle = withStack(new Error("query failed", { cause: root }), 10);
    const outer = withStack(new Error("repository read failed", { cause: middle }), 10);

    logger.error(
      {
        err: withStack(
          new AppError({ code: "upstream", message: "call failed", cause: outer }),
          10,
        ),
      },
      "failed",
    );

    expect(Buffer.byteLength((raw()[0] ?? "").trimEnd())).toBeLessThanOrEqual(MAX_LINE_BYTES);
    expect(lines()[0]).not.toHaveProperty("truncated");

    const chain = errorField(lines()[0]).cause as {
      message?: string;
      cause?: { cause?: { message?: string } };
    };

    expect(chain.message).toBe("repository read failed");
    expect(chain.cause?.cause?.message).toBe("ECONNREFUSED 10.0.0.4:5432");
  });

  it("spends the whole allowance on a lone stack, and splits it across a chain", () => {
    const stackOf = (error: AppError): string => {
      const { logger, lines } = harness();

      logger.error({ err: error }, "failed");

      return String(errorField(lines()[0]).stack);
    };

    const lone = stackOf(withStack(new AppError({ code: "lone", message: "detail" }), 50));
    const chained = stackOf(
      withStack(
        new AppError({
          code: "chained",
          message: "detail",
          cause: withStack(new Error("inner", { cause: withStack(new Error("root"), 50) }), 50),
        }),
        50,
      ),
    );

    // The guarantee is on the total, not on any one stack: a chain three deep
    // gets the same half of the line a lone error does, and a lone error is not
    // charged the chain's worst case.
    expect(lone.split("\n").length).toBeGreaterThan(chained.split("\n").length);
    expect(Buffer.byteLength(lone)).toBeLessThanOrEqual(MAX_LINE_BYTES / 2);
  });

  it("leaves a stack that already fits exactly as it was", () => {
    const { logger, lines } = harness();
    const error = withStack(new AppError({ code: "shallow", message: "detail" }), 2);

    logger.error({ err: error }, "failed");

    expect(errorField(lines()[0]).stack).toBe(error.stack);
  });
});

/**
 * ADR-0004's measurement, as a fixture: the 29 frames off one `next dev` request
 * — 18 naming `node_modules`, 8 naming application code, 3 Node's own — laid out
 * in the runs they actually arrived in. A named fixture rather than a ratio,
 * because it is the case this whole change exists to move.
 */
const MEASURED_REQUEST: readonly FrameKind[] = [
  "application",
  ...repeated("vendor", 8),
  "application",
  "application",
  ...repeated("vendor", 10),
  "application",
  ...repeated("internal", 3),
  ...repeated("application", 4),
];

/** A stack where every framework run is long enough to fold and the tail still overflows. */
const DEEP_MIXED_REQUEST = 200;

const COLLAPSE_MARKER = /\.\.\. (\d+) framework frames omitted/g;
const TAIL_MARKER = /\.\.\. (\d+) frames? omitted/;

function emit(error: Error, env: Parameters<typeof createLoggerOptions>[0] = {}) {
  const { logger, raw, lines } = harness(env);

  logger.error({ err: error }, "failed");

  const parsed = lines()[0] ?? {};

  return { stack: String(errorField(parsed).stack), line: raw()[0] ?? "", parsed };
}

/** How many frames of the trimmed stack name a file a human can open. */
function applicationFramesIn(stack: string): number {
  return stack.split("\n").filter((line) => line.includes("/repo/apps/web/app/")).length;
}

function foldedRunsIn(stack: string): number[] {
  return [...stack.matchAll(COLLAPSE_MARKER)].map((match) => Number(match[1]));
}

describe("collapsing framework frames (ADR-0004)", () => {
  it("folds each run of consecutive framework frames into one marker naming its length", () => {
    const { stack } = emit(
      withFrames(new AppError({ code: "measured", message: "operator detail" }), MEASURED_REQUEST),
    );

    expect(foldedRunsIn(stack)).toEqual([8, 10, 3]);
  });

  it("keeps the first frame verbatim even when it is a framework frame", () => {
    const { stack } = emit(
      withFrames(new AppError({ code: "library_throw", message: "operator detail" }), [
        ...repeated("vendor", 4),
        ...repeated("application", 60),
      ]),
    );

    expect(stack).toContain(frameOf("vendor", 0));
    expect(foldedRunsIn(stack)).toEqual([3]);
  });

  it("leaves a lone framework frame between two application frames alone", () => {
    const { stack } = emit(
      withFrames(new AppError({ code: "lone_vendor", message: "operator detail" }), [
        "application",
        "vendor",
        ...repeated("application", 60),
      ]),
    );

    expect(stack).toContain(frameOf("vendor", 1));
    expect(foldedRunsIn(stack)).toEqual([]);
  });

  it("leaves a run alone when the marker would cost more than the frames it replaces", () => {
    // The boundary case of the rule that makes a run of one pointless, seen at
    // the other end: two `node:` frames measuring less between them than the
    // marker that would stand for them. It is the arithmetic that decides
    // whether a run folds, not the classification.
    const error = new AppError({ code: "tiny", message: "operator detail" });
    const short = ["    at (node:a)", "    at (node:b)"];

    error.stack = [
      `${error.name}: synthetic`,
      frameOf("application", 0),
      ...short,
      ...Array.from({ length: 60 }, (_, index) => frameOf("application", index + 3)),
    ].join("\n");

    const { stack } = emit(error);

    expect(stack).toContain(short[0]);
    expect(stack).toContain(short[1]);
    expect(foldedRunsIn(stack)).toEqual([]);
  });

  it("distinguishes a folded run from a truncated tail, and carries both at once", () => {
    const { stack } = emit(
      withStack(new AppError({ code: "both", message: "operator detail" }), DEEP_MIXED_REQUEST),
    );

    expect(foldedRunsIn(stack).length).toBeGreaterThan(0);
    expect(stack).toMatch(TAIL_MARKER);
  });

  it("counts the tail in frames, not in lines, so a folded run is not undercounted", () => {
    const { stack } = emit(
      withStack(new AppError({ code: "counted", message: "operator detail" }), DEEP_MIXED_REQUEST),
    );

    const folded = foldedRunsIn(stack).reduce((total, run) => total + run, 0);
    const shown = stack.split("\n").filter((line) => line.startsWith("    at ")).length;
    const omitted = Number(TAIL_MARKER.exec(stack)?.[1]);

    expect(folded + shown + omitted).toBe(DEEP_MIXED_REQUEST);
  });

  it("collapses every stack in a cause chain, not only the outermost", () => {
    const link: readonly FrameKind[] = ["application", ...repeated("vendor", 6), "application"];
    const root = withFrames(new Error("ECONNREFUSED 10.0.0.4:5432"), link);
    const middle = withFrames(new Error("query failed", { cause: root }), link);
    const { parsed } = emit(
      withFrames(
        new AppError({ code: "chained", message: "operator detail", cause: middle }),
        link,
      ),
    );

    const err = errorField(parsed);
    const first = (err.cause ?? {}) as Record<string, unknown>;
    const second = (first.cause ?? {}) as Record<string, unknown>;

    for (const stack of [err.stack, first.stack, second.stack]) {
      expect(foldedRunsIn(String(stack))).toEqual([6]);
    }
  });

  it("returns a stack that already fits byte-identical, framework runs and all", () => {
    const error = withFrames(new AppError({ code: "roomy", message: "operator detail" }), [
      "application",
      ...repeated("vendor", 5),
      "application",
    ]);
    const before = error.stack;

    expect(emit(error).stack).toBe(before);
  });

  it("holds the line bound on every one of these, at the default and at the floor", () => {
    const cases: [string, Error][] = [
      ["measured", withFrames(new AppError({ code: "a", message: "d" }), MEASURED_REQUEST)],
      ["deep mixed", withStack(new AppError({ code: "b", message: "d" }), DEEP_MIXED_REQUEST)],
      [
        "first frame is vendor",
        withFrames(new AppError({ code: "c", message: "d" }), [
          ...repeated("vendor", 40),
          ...repeated("application", 40),
        ]),
      ],
      [
        "chained",
        withStack(
          new AppError({
            code: "d",
            message: "d",
            cause: withStack(new Error("inner"), DEEP_MIXED_REQUEST),
          }),
          DEEP_MIXED_REQUEST,
        ),
      ],
    ];

    for (const env of [{}, { LOG_MAX_LINE_BYTES: String(MIN_LINE_BYTES) }]) {
      const bound = resolveMaxLineBytes(env);

      for (const [name, error] of cases) {
        const { line } = emit(error, env);

        expect(`${name}: ${Buffer.byteLength(line.trimEnd())}`).toBe(
          `${name}: ${Math.min(Buffer.byteLength(line.trimEnd()), bound)}`,
        );
      }
    }
  });

  /**
   * The budget is the one promise `trimStack` makes about its own return value,
   * and the collapse gave it a new way to be off by one — the header's joining
   * newline. Swept rather than sampled, because the overshoot only shows where
   * the cut lands within a byte or two of the budget, which no single bound
   * reliably reproduces.
   */
  it("never returns a stack larger than the budget it was given, at any bound", () => {
    const error = withFrames(new AppError({ code: "swept", message: "d" }), [
      "application",
      ...repeated("vendor", 3),
      ...repeated("application", 40),
    ]);

    const over: string[] = [];

    for (let bound = MIN_LINE_BYTES; bound <= MIN_LINE_BYTES + 600; bound += 1) {
      const { stack } = emit(error, { LOG_MAX_LINE_BYTES: String(bound) });
      // One stack, so it is handed the whole allowance: half the bound.
      const budget = Math.floor(bound / 2);

      if (Buffer.byteLength(stack) > budget) over.push(`${bound} → ${Buffer.byteLength(stack)}`);
    }

    expect(over).toEqual([]);
  });

  it("keeps all eight application frames of the measured request, which position alone did not", () => {
    const { stack, parsed } = emit(
      withFrames(new AppError({ code: "measured", message: "operator detail" }), MEASURED_REQUEST),
    );

    expect(applicationFramesIn(stack)).toBe(8);
    expect(stack).not.toMatch(TAIL_MARKER);
    expect(parsed).not.toHaveProperty("truncated");
  });
});

describe("what a truncated line keeps of err", () => {
  function truncatedWithError() {
    const { logger, raw, lines } = harness();
    const error = withStack(
      new AppError({
        code: "boom",
        status: 500,
        message: "operator detail",
        context: { detail: "d".repeat(5_000) },
      }),
      50,
    );

    logger.warn({ err: error, route: "/api/x", context: { blob: "x".repeat(20_000) } }, "too big");

    return { line: raw()[0] ?? "", parsed: lines()[0] ?? {} };
  }

  it("admits err in trimmed form rather than dropping it", () => {
    const { parsed } = truncatedWithError();

    expect(parsed).toMatchObject({ truncated: true });
    expect(errorField(parsed)).toMatchObject({ code: "boom", message: "operator detail" });
  });

  it("spends the budget it was handed rather than abandoning it", () => {
    const bytes = Buffer.byteLength(truncatedWithError().line.trimEnd());

    expect(bytes).toBeLessThanOrEqual(MAX_LINE_BYTES);
    expect(bytes).toBeGreaterThan(MAX_LINE_BYTES / 2);
  });

  it("stays parseable with a bare JSON.parse", () => {
    expect(() => JSON.parse(truncatedWithError().line) as unknown).not.toThrow();
  });

  it("fills the preserved fields first, which are what a query binds to", () => {
    expect(truncatedWithError().parsed).toMatchObject({
      level: "warn",
      route: "/api/x",
      msg: "too big",
      service: expect.any(String),
    });
  });

  it("holds the bound when err itself is what overflows", () => {
    const { logger, raw, lines } = harness();

    logger.error(
      {
        err: new AppError({
          code: "huge",
          message: "m".repeat(20_000),
          context: { blob: "x".repeat(20_000) },
        }),
      },
      "failed",
    );

    expect(Buffer.byteLength((raw()[0] ?? "").trimEnd())).toBeLessThanOrEqual(MAX_LINE_BYTES);
    expect(lines()[0]).toMatchObject({ truncated: true });
    expect(errorField(lines()[0]).code).toBe("huge");
  });
});

describe("the bound's runtime override (LOG_MAX_LINE_BYTES)", () => {
  it("is the 8 KB default when unset, in development and production alike", () => {
    expect(resolveMaxLineBytes({})).toBe(MAX_LINE_BYTES);
    expect(resolveMaxLineBytes({ NODE_ENV: "development" })).toBe(MAX_LINE_BYTES);
    expect(resolveMaxLineBytes({ NODE_ENV: "production" })).toBe(MAX_LINE_BYTES);
  });

  it("takes a number above the default", () => {
    expect(resolveMaxLineBytes({ LOG_MAX_LINE_BYTES: "131072" })).toBe(131_072);
  });

  it("takes a number down to the floor", () => {
    expect(resolveMaxLineBytes({ LOG_MAX_LINE_BYTES: String(MIN_LINE_BYTES) })).toBe(
      MIN_LINE_BYTES,
    );
  });

  it("falls back to the default rather than letting a typo stop the server booting", () => {
    for (const value of ["", "lots", "8kb", "-1", "0", "1e4", "12.5", String(MIN_LINE_BYTES - 1)]) {
      expect(resolveMaxLineBytes({ LOG_MAX_LINE_BYTES: value })).toBe(MAX_LINE_BYTES);
    }
  });

  it("still bounds the line at the default when the value is unusable", () => {
    const { logger, raw } = harness({ LOG_MAX_LINE_BYTES: "lots" });

    expect(() => logger.info({ context: { blob: "x".repeat(20_000) } }, "too big")).not.toThrow();
    expect(Buffer.byteLength((raw()[0] ?? "").trimEnd())).toBeLessThanOrEqual(MAX_LINE_BYTES);
  });

  it("lets a full development-depth stack through when raised", () => {
    const { logger, lines } = harness({ LOG_MAX_LINE_BYTES: "131072" });

    logger.error(
      { err: withStack(new AppError({ code: "deep", message: "operator detail" }), 50) },
      "failed",
    );

    expect(lines()[0]).not.toHaveProperty("truncated");
    expect(String(errorField(lines()[0]).stack)).toContain("at frame49");
  });

  it("truncates correspondingly sooner when lowered", () => {
    const { logger, raw, lines } = harness({ LOG_MAX_LINE_BYTES: "1024" });

    logger.info({ context: { blob: "x".repeat(2_000) } }, "modest");

    expect(Buffer.byteLength((raw()[0] ?? "").trimEnd())).toBeLessThanOrEqual(1024);
    expect(lines()[0]).toMatchObject({ truncated: true, msg: "modest" });
  });

  it("leaves that same line untouched at the default bound", () => {
    const { logger, lines } = harness();

    logger.info({ context: { blob: "x".repeat(2_000) } }, "modest");

    expect(lines()[0]).not.toHaveProperty("truncated");
  });
});

describe("the trace-context mixin", () => {
  it("puts the reader's fields on the line, top-level and already snake_case", () => {
    const { logger, lines } = harness({}, () => ({ trace_id: "t_1", span_id: "s_1" }));

    logger.info("correlated");

    expect(lines()[0]).toMatchObject({ trace_id: "t_1", span_id: "s_1" });
  });

  it("contributes no fields when nothing is tracing, which is the no-DSN path", () => {
    const { logger, lines } = harness();

    logger.info("uncorrelated");

    expect(lines()[0]).not.toHaveProperty("trace_id");
    expect(lines()[0]).not.toHaveProperty("span_id");
  });
});

describe("what a truncated line keeps of a structured err field", () => {
  /**
   * The report's own case: three identifiers and one oversized value, which is
   * the ordinary way a payload ends up on a line. Before this was fixed the
   * whole `context` was refused and the line measured 1693 of 8192 bytes.
   */
  function checkoutFailure() {
    const { logger, raw, lines } = harness();

    logger.error(
      {
        err: new AppError({
          code: "checkout_failed",
          status: 502,
          message: "charge rejected for tenant acme",
          context: { orderId: "o_1", tenantId: "t_9", attempt: 3, payload: "x".repeat(20_000) },
        }),
      },
      "checkout failed",
    );

    return { line: raw()[0] ?? "", parsed: lines()[0] ?? {} };
  }

  function contextOf(line: Record<string, unknown> | undefined): Record<string, unknown> {
    return (errorField(line).context ?? {}) as Record<string, unknown>;
  }

  it("keeps the identifiers rather than refusing context whole", () => {
    expect(contextOf(checkoutFailure().parsed)).toEqual({
      orderId: "o_1",
      tenantId: "t_9",
      attempt: 3,
    });
  });

  it("refuses the one value that caused the breach", () => {
    expect(contextOf(checkoutFailure().parsed)).not.toHaveProperty("payload");
  });

  it("holds the bound while doing it", () => {
    expect(Buffer.byteLength(checkoutFailure().line.trimEnd())).toBeLessThanOrEqual(MAX_LINE_BYTES);
  });

  it("admits the smallest keys first, so one oversized value costs only itself", () => {
    const { logger, lines } = harness();

    // Declared largest-first: insertion order would spend the budget on `bulk`
    // and leave nothing for the four ids behind it.
    logger.error(
      {
        err: new AppError({
          code: "ordered",
          message: "operator detail",
          context: {
            bulk: "x".repeat(20_000),
            one: "1",
            two: "2",
            three: "3",
            four: "4",
          },
        }),
      },
      "failed",
    );

    expect(contextOf(lines()[0])).toEqual({ one: "1", two: "2", three: "3", four: "4" });
  });

  /**
   * `cause` is offered last, so squeezing it means giving the fields ahead of it
   * something real to spend the budget on: three hundred identifiers, which is a
   * fan-out job's `context` rather than a contrived one.
   */
  function squeezedCause() {
    const { logger, raw, lines } = harness();

    logger.error(
      {
        err: new AppError({
          code: "squeezed",
          message: "operator detail",
          context: Object.fromEntries(
            Array.from({ length: 300 }, (_, index) => [`id_${index}`, `value_${index}`]),
          ),
          cause: withStack(new Error("upstream refused the charge"), 200),
        }),
      },
      "failed",
    );

    return { line: raw()[0] ?? "", parsed: lines()[0] ?? {} };
  }

  it("contributes the identity of a cause too large to admit whole", () => {
    const admittedCause = (errorField(squeezedCause().parsed).cause ?? {}) as Record<
      string,
      unknown
    >;

    expect(admittedCause).toMatchObject({ message: "upstream refused the charge" });
    expect(admittedCause.stack).toBeUndefined();
  });

  it("spends the budget on the keys rather than abandoning it", () => {
    const { line, parsed } = squeezedCause();

    expect(Object.keys(contextOf(parsed))).toHaveLength(300);
    expect(Buffer.byteLength(line.trimEnd())).toBeGreaterThan(MAX_LINE_BYTES * 0.9);
    expect(Buffer.byteLength(line.trimEnd())).toBeLessThanOrEqual(MAX_LINE_BYTES);
  });

  it("admits a record that fits whole without reordering or losing a key", () => {
    const { logger, lines } = harness();
    const context = { orderId: "o_1", tenantId: "t_9", attempt: 3 };

    // A top-level `context` is what breaches here. Its one key is oversized, so
    // selection admits nothing from it and `err` is offered the whole remaining
    // budget — leaving `err.context` never under pressure.
    logger.warn(
      {
        err: new AppError({ code: "roomy", message: "operator detail", context }),
        context: { blob: "x".repeat(20_000) },
      },
      "too big",
    );

    expect(lines()[0]).toMatchObject({ truncated: true });
    expect(JSON.stringify(contextOf(lines()[0]))).toBe(JSON.stringify(context));
  });

  it("yields no context at all when every key is individually oversized", () => {
    const { logger, lines } = harness();

    logger.error(
      {
        err: new AppError({
          code: "all_huge",
          message: "m".repeat(7_000),
          context: { a: "x".repeat(20_000), b: "y".repeat(20_000) },
        }),
      },
      "failed",
    );

    expect(errorField(lines()[0])).not.toHaveProperty("context");
  });
});

/** The line's own top-level `context`, as {@link errorField} reads `err`. */
function lineContextOf(line: Record<string, unknown> | undefined): Record<string, unknown> {
  return (line?.context ?? {}) as Record<string, unknown>;
}

describe("what a truncated line keeps of the line's own context", () => {
  /**
   * The same shape the package's own emitters produce: `logRequestError` and
   * `logRequestComplete` both put identifiers under a **top-level** `context`,
   * beside `err` rather than inside it. Small ids and one oversized value, so
   * the line breaches for a reason the ids did not cause.
   */
  function breachedRequestLine() {
    const { logger, raw, lines } = harness();

    logger.error(
      {
        code: "orders/payment-failed",
        status: 502,
        context: { order_id: "ord_8842", method: "POST", big: "x".repeat(9_000) },
      },
      "payment provider returned an unexpected response",
    );

    return { line: raw()[0] ?? "", parsed: lines()[0] ?? {} };
  }

  it("keeps the identifiers rather than dropping context whole", () => {
    expect(lineContextOf(breachedRequestLine().parsed)).toEqual({
      order_id: "ord_8842",
      method: "POST",
    });
  });

  it("refuses the one value that caused the breach, and holds the bound", () => {
    const { line, parsed } = breachedRequestLine();

    expect(lineContextOf(parsed)).not.toHaveProperty("big");
    expect(Buffer.byteLength(line.trimEnd())).toBeLessThanOrEqual(MAX_LINE_BYTES);
  });

  it("spends the budget on the keys rather than abandoning it", () => {
    const { logger, raw, lines } = harness();

    logger.error(
      {
        code: "fanout",
        context: Object.fromEntries(
          Array.from({ length: 400 }, (_, index) => [`id_${index}`, `value_${index}`]),
        ),
      },
      "m".repeat(9_000),
    );

    const kept = Object.keys(lineContextOf(lines()[0]));
    const bytes = Buffer.byteLength((raw()[0] ?? "").trimEnd());

    expect(kept.length).toBeGreaterThan(300);
    expect(bytes).toBeGreaterThan(MAX_LINE_BYTES * 0.9);
    expect(bytes).toBeLessThanOrEqual(MAX_LINE_BYTES);
  });

  it("selects inside a nested record rather than taking or dropping it whole", () => {
    const { logger, lines } = harness();

    logger.error(
      {
        code: "nested",
        context: { attempt: 3, upstream: { host: "api.example", body: "x".repeat(20_000) } },
      },
      "failed",
    );

    expect(lineContextOf(lines()[0])).toEqual({ attempt: 3, upstream: { host: "api.example" } });
  });

  it("keeps the ids even when the line also carries an err spending the budget", () => {
    const { logger, lines } = harness();

    logger.error(
      {
        context: { order_id: "ord_8842", tenant_id: "t_9" },
        err: withStack(new AppError({ code: "both", message: "operator detail" }), 200),
      },
      "failed",
    );

    expect(lineContextOf(lines()[0])).toEqual({ order_id: "ord_8842", tenant_id: "t_9" });
    expect(errorField(lines()[0])).toMatchObject({ code: "both" });
  });

  it("omits context rather than claiming an empty one when nothing fits", () => {
    const { logger, lines } = harness();

    logger.error(
      { code: "all_huge", context: { a: "x".repeat(20_000), b: "y".repeat(20_000) } },
      "failed",
    );

    expect(lines()[0]).toMatchObject({ truncated: true });
    expect(lines()[0]).not.toHaveProperty("context");
  });

  it("survives a pathologically nested context rather than throwing out of the hook", () => {
    const { logger, raw, lines } = harness();

    // Deep enough that an unbounded recursion overflows the call stack, padded
    // wide enough that a line carrying it whole would breach the bound. The
    // logger is the one place that must not throw.
    let nested: Record<string, unknown> = { leaf: "x".repeat(9_000) };
    for (let level = 0; level < 5_000; level += 1) nested = { down: nested };

    expect(() => logger.error({ code: "abyss", context: nested }, "failed")).not.toThrow();
    expect(lines()[0]).toMatchObject({ code: "abyss" });
    expect(Buffer.byteLength((raw()[0] ?? "").trimEnd())).toBeLessThanOrEqual(MAX_LINE_BYTES);

    // `truncated: true` is deliberately **not** asserted, and the reason is the
    // finding in #41. Which of two serialisation paths this input takes is a
    // property of the available stack, not of the logger:
    //
    //   - a large stack serialises the whole 5,000-deep object, the line lands
    //     far over the bound, and `capLine` rebuilds it — `truncated: true`;
    //   - a small one raises `RangeError` inside `JSON.stringify`, pino falls
    //     back to its depth-limited serializer, and the ~189-byte line it emits
    //     was never over budget, so the cap correctly does not fire and
    //     correctly does not claim it did.
    //
    // Both hold what this test is named for. Asserting the marker made the case
    // pass on a macOS dev machine and fail on a Linux CI runner, which is how
    // the repository's first CI run found it. What #41 still owes an answer is
    // the gap underneath: a field pino's fallback stubs leaves no marker on the
    // line at all.
  });
});
