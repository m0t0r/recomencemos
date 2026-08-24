import {
  logRequestComplete,
  pathOf,
  routeOf,
  subscribeRequestCompletion,
} from "@repo/observability/log-request-complete";
import { createLoggerOptions, type TraceContextReader } from "@repo/observability/logger-options";
import pino from "pino";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Writable } from "node:stream";

function harness(readTraceContext?: TraceContextReader) {
  const written: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      written.push(String(chunk));
      callback();
    },
  });

  return {
    logger: pino(createLoggerOptions({ LOG_LEVEL: "trace" }, readTraceContext), stream),
    lines: () => written.map((line) => JSON.parse(line) as Record<string, unknown>),
  };
}

/** The shape `routeOf` reads, built the way Next builds it, without importing Next. */
function requestWithMeta(url: string, pathname: string | undefined): { url: string } {
  const request = { url };
  const meta = pathname === undefined ? {} : { match: { definition: { pathname } } };

  return Object.assign(request, { [Symbol("NextInternalRequestMeta")]: meta });
}

describe("logRequestComplete", () => {
  it("emits exactly one line per completed request", () => {
    const { logger, lines } = harness();

    logRequestComplete({ route: "/", status: 200, duration_ms: 12 }, logger);

    expect(lines()).toHaveLength(1);
  });

  it("emits at info — a completed request is the denominator, not a problem", () => {
    const { logger, lines } = harness();

    logRequestComplete({ route: "/", status: 200, duration_ms: 12 }, logger);

    expect(lines()[0]?.level).toBe("info");
  });

  it("carries route, status and duration_ms as top-level snake_case fields", () => {
    const { logger, lines } = harness();

    logRequestComplete({ route: "/orders/[id]", status: 503, duration_ms: 87 }, logger);

    expect(lines()[0]).toMatchObject({
      route: "/orders/[id]",
      status: 503,
      duration_ms: 87,
    });
  });
});

describe("routeOf", () => {
  it("reads the matched route pattern, not the concrete path", () => {
    expect(routeOf(requestWithMeta("/orders/42", "/orders/[id]"))).toBe("/orders/[id]");
  });

  it("stays bounded rather than leaking a raw path when nothing matched", () => {
    // A hashed asset path here would grow the field's cardinality every build.
    expect(routeOf({ url: "/_next/static/chunks/page-a1b2c3.js" })).toBe("unknown");
  });

  it("stays bounded rather than throwing when the meta is present but malformed", () => {
    expect(routeOf(requestWithMeta("/orders/42", undefined))).toBe("unknown");
  });

  it("survives a request with no url at all", () => {
    expect(routeOf({})).toBe("unknown");
  });
});

describe("pathOf", () => {
  it("keeps the concrete path, which is what route deliberately drops", () => {
    expect(pathOf({ url: "/orders/42" })).toBe("/orders/42");
  });

  it("strips the query string, which is where a token would be", () => {
    expect(pathOf({ url: "/reset?token=secret" })).toBe("/reset");
  });

  it("strips a fragment too", () => {
    expect(pathOf({ url: "/docs#section" })).toBe("/docs");
  });

  // The declined decision, pinned so it is stated rather than merely not done.
  // A credential in a path *segment* survives the query strip, because nothing
  // here can tell it from an order id — ADR-0006. A project answering
  // `secrets-in-url-paths` yes bounds `pathOf` and updates this case; that is
  // the point of asserting it.
  it("does not bound a path segment, so a token in one reaches the line whole", () => {
    expect(pathOf({ url: "/reset-password/rp_9f81c2d4e0a7" })).toBe(
      "/reset-password/rp_9f81c2d4e0a7",
    );
  });

  it("survives a request with no url at all", () => {
    expect(pathOf({})).toBe("unknown");
  });
});

/**
 * AC1 names four top-level fields and the logger contributes the fourth: the
 * completion line does not pass `trace_id`, it inherits it from the mixin. That
 * inheritance is the thing worth asserting, and the injectable reader
 * `createLoggerOptions` already takes is what makes it assertable here rather
 * than only against a running server.
 */
describe("the completion line and the trace mixin", () => {
  it("carries trace_id as a top-level field while reporting is active", () => {
    const { logger, lines } = harness(() => ({ trace_id: "t_1", span_id: "s_1" }));

    logRequestComplete({ route: "/orders/[id]", status: 200, duration_ms: 3 }, logger);

    expect(lines()[0]).toMatchObject({
      route: "/orders/[id]",
      status: 200,
      duration_ms: 3,
      trace_id: "t_1",
      span_id: "s_1",
    });
  });

  it("carries no trace_id on the no-DSN path, where nothing is tracing", () => {
    const { logger, lines } = harness();

    logRequestComplete({ route: "/", status: 200, duration_ms: 3 }, logger);

    expect(lines()[0]).not.toHaveProperty("trace_id");
  });
});

/**
 * A real Node HTTP server rather than a mocked channel. The subscription listens
 * to the process's HTTP traffic, so the honest test is to generate some — and
 * `no mocks` is the rule the spec's Testing Decisions set for exactly this case:
 * a test that had to fake `diagnostics_channel` would be asserting on its own
 * fake rather than on the mechanism NFR17 depends on.
 */
async function completeOneRequest(path: string, status: number): Promise<void> {
  const server = createServer((_req, res) => {
    res.statusCode = status;
    res.end("ok");
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  const { port } = server.address() as AddressInfo;

  await fetch(`http://127.0.0.1:${port}${path}`).then((response) => response.text());
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

describe("subscribeRequestCompletion", () => {
  const { logger, lines } = harness();

  beforeAll(() => {
    subscribeRequestCompletion(logger);
  });

  it("emits exactly one line for one completed request, and it carries the fields", async () => {
    await completeOneRequest("/orders/42?token=secret", 201);

    const emitted = lines().filter((line) => line["msg"] === "request complete");

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      route: "unknown",
      status: 201,
      level: "info",
      context: { path: "/orders/42" },
    });
    expect(typeof emitted[0]?.["duration_ms"]).toBe("number");
  });

  it("emits one line per request and no more, including for a failing status", async () => {
    const before = lines().filter((line) => line["msg"] === "request complete").length;

    await completeOneRequest("/a", 200);
    await completeOneRequest("/b", 500);

    const emitted = lines().filter((line) => line["msg"] === "request complete");

    expect(emitted.length - before).toBe(2);
    expect(emitted.at(-1)).toMatchObject({ status: 500, context: { path: "/b" } });
  });

  it("is idempotent — a second call does not double the lines", async () => {
    subscribeRequestCompletion(logger);

    const before = lines().filter((line) => line["msg"] === "request complete").length;

    await completeOneRequest("/c", 200);

    const after = lines().filter((line) => line["msg"] === "request complete").length;

    expect(after - before).toBe(1);
  });
});
