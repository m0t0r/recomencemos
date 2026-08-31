import { AppError } from "@repo/errors/app-error";
import {
  logRequestComplete,
  pathOf,
  routeOf,
  shouldEmitCompletionLine,
  subscribeRequestCompletion,
} from "@repo/observability/log-request-complete";
import { logRequestError } from "@repo/observability/log-request-error";
import { createLoggerOptions, type TraceContextReader } from "@repo/observability/logger-options";
import { readRequestContext, runInRequestOf } from "@repo/observability/request-context";
import pino from "pino";
import { Agent, createServer, get, type IncomingMessage, type ServerResponse } from "node:http";
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

    logRequestComplete({ method: "GET", route: "/", status: 200, duration_ms: 12 }, logger);

    expect(lines()).toHaveLength(1);
  });

  it("carries method, route, status and duration_ms as top-level snake_case fields", () => {
    const { logger, lines } = harness();

    logRequestComplete(
      { method: "POST", route: "/orders/[id]", status: 503, duration_ms: 87 },
      logger,
    );

    expect(lines()[0]).toMatchObject({
      method: "POST",
      route: "/orders/[id]",
      status: 503,
      duration_ms: 87,
    });
  });

  /**
   * The level is read off `status` rather than passed, because the two would
   * then be able to disagree — and a completion line that says `error` about a
   * 200 is a line an operator learns to stop trusting.
   */
  describe("chooses its level from the status", () => {
    it.each([500, 502, 503, 599])("emits a %i at error — the server broke", (status) => {
      const { logger, lines } = harness();

      logRequestComplete({ method: "GET", route: "/", status, duration_ms: 1 }, logger);

      expect(lines()[0]?.level).toBe("error");
    });

    /**
     * A 401 or a 422 is the system correctly saying no, not a fault. `status` is
     * the field that distinguishes them, and it is already on the line.
     */
    it.each([200, 204, 304, 401, 404, 422, 499])(
      "emits a %i at info — the denominator, not a problem",
      (status) => {
        const { logger, lines } = harness();

        logRequestComplete({ method: "GET", route: "/", status, duration_ms: 1 }, logger);

        expect(lines()[0]?.level).toBe("info");
      },
    );
  });
});

/**
 * The emission rule, tested apart from the channel. `logRequestComplete` emits
 * what it is given and decides nothing about *whether* to; that decision is the
 * subscriber's, and it is a pure function of two values so that it can be read
 * here rather than only inferred from line counts against a running server.
 */
describe("shouldEmitCompletionLine", () => {
  it("emits for a routed request, which is the population the numbers are about", () => {
    expect(shouldEmitCompletionLine("/orders/[id]", 200)).toBe(true);
  });

  it("stays silent for unrouted success — framework traffic is not the app's", () => {
    expect(shouldEmitCompletionLine("unknown", 200)).toBe(false);
  });

  it("stays silent for an unrouted 304, which is the bulk of what a chunk load is", () => {
    expect(shouldEmitCompletionLine("unknown", 304)).toBe(false);
  });

  /**
   * The `status >= 400` clause is not there for 404s — those are routed. It is
   * there so an unrouted *failure* still leaves a line: an asset 5xx, or a
   * request the router never reached.
   */
  it.each([400, 404, 500, 503])(
    "emits an unrouted %i, which is a failure worth seeing",
    (status) => {
      expect(shouldEmitCompletionLine("unknown", status)).toBe(true);
    },
  );

  it("emits a routed 404, which carries a pattern and always did", () => {
    expect(shouldEmitCompletionLine("/_not-found", 404)).toBe(true);
  });

  /**
   * The cut is `routeOf`'s existing answer, not a `/_next/` prefix match. The
   * router already tells us whether it matched, so the signal is structural and
   * needs no pattern to maintain — a path denylist would be a heuristic shipped
   * into the one field a drain groups by.
   */
  it("cuts on whether the router matched, not on what the path looks like", () => {
    expect(shouldEmitCompletionLine("/_next/static/chunks/[chunk]", 200)).toBe(true);
    expect(shouldEmitCompletionLine("unknown", 200)).toBe(false);
  });
});

describe("routeOf", () => {
  it("reads the matched route pattern, not the concrete path", () => {
    expect(routeOf(requestWithMeta("/orders/42", "/orders/[id]"))).toBe("/orders/[id]");
  });

  it("stays bounded rather than leaking a raw path when nothing matched", () => {
    expect(routeOf(requestWithMeta("/_next/static/chunks/page-abc123.js", undefined))).toBe(
      "unknown",
    );
  });

  it("stays bounded rather than throwing when the meta is present but malformed", () => {
    expect(routeOf(Object.assign({ url: "/x" }, { [Symbol("NextInternalRequestMeta")]: 7 }))).toBe(
      "unknown",
    );
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
    expect(pathOf({ url: "/reset?token=rp_9f81c2d4e0a7" })).toBe("/reset");
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
 * AC1 names six top-level fields and the logger contributes two of them: the
 * completion line passes neither `trace_id` nor `request_id`, it inherits both
 * from the mixin. That inheritance is the thing worth asserting, and the
 * injectable reader `createLoggerOptions` already takes is what makes it
 * assertable here rather than only against a running server.
 */
describe("the completion line and the trace mixin", () => {
  it("carries trace_id as a top-level field while reporting is active", () => {
    const { logger, lines } = harness(() => ({ trace_id: "t_1", span_id: "s_1" }));

    logRequestComplete(
      { method: "GET", route: "/orders/[id]", status: 200, duration_ms: 3 },
      logger,
    );

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

    logRequestComplete({ method: "GET", route: "/", status: 200, duration_ms: 3 }, logger);

    expect(lines()[0]).not.toHaveProperty("trace_id");
  });
});

/**
 * A real Node HTTP server rather than a mocked channel. The subscription listens
 * to the process's HTTP traffic, so the honest test is to generate some — and
 * `no mocks` is the rule the spec's Testing Decisions set for exactly this case:
 * a test that had to fake `diagnostics_channel` would be asserting on its own
 * fake rather than on the mechanism NFR17 depends on.
 *
 * `matched` is what Next attaches to the request when its router matches, so
 * attaching it here is what makes a request in this file *routed* — the same
 * per-request meta `routeOf` reads in production, set by the same kind of
 * assignment.
 */
function route(request: IncomingMessage, matched: string | undefined): void {
  if (matched === undefined) return;

  Object.assign(request, {
    [Symbol("NextInternalRequestMeta")]: { match: { definition: { pathname: matched } } },
  });
}

async function serve(
  handle: (request: IncomingMessage, response: ServerResponse) => void,
  drive: (origin: string) => Promise<void>,
): Promise<void> {
  const server = createServer(handle);

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  const { port } = server.address() as AddressInfo;

  try {
    await drive(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

/** One request, answered with `status`, routed to `matched` when one is given. */
async function completeOneRequest(
  path: string,
  status: number,
  matched?: string,
  handle?: (request: IncomingMessage) => void,
): Promise<void> {
  await serve(
    (request, response) => {
      route(request, matched);
      handle?.(request);
      response.statusCode = status;
      response.end("ok");
    },
    async (origin) => {
      await fetch(`${origin}${path}`).then((response) => response.text());
    },
  );
}

function completionLines(lines: () => Record<string, unknown>[]): Record<string, unknown>[] {
  return lines().filter((line) => line["msg"] === "request complete");
}

/**
 * One subscription for the whole file, and one logger with it. The idempotence
 * guard lives on `globalThis`, so a second `subscribeRequestCompletion` with a
 * different logger is a no-op — and the lines would go on arriving at the first
 * one, which is a test that passes while asserting on the wrong stream.
 */
const { logger, lines } = harness(readRequestContext);

beforeAll(() => {
  subscribeRequestCompletion(logger);
});

function handlerLines(): Record<string, unknown>[] {
  return lines().filter((line) => line["msg"] === "in handler");
}

describe("subscribeRequestCompletion", () => {
  it("emits exactly one line for one routed request, and it carries the fields", async () => {
    await completeOneRequest("/orders/42?token=secret", 201, "/orders/[id]");

    const emitted = completionLines(lines);

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      method: "GET",
      route: "/orders/[id]",
      status: 201,
      level: "info",
      context: { path: "/orders/42" },
    });
    expect(typeof emitted[0]?.["duration_ms"]).toBe("number");
  });

  /**
   * The defect this rule exists for: the subscription hears every HTTP server in
   * the process, so before it, a page load's chunk 304s outnumbered the app's own
   * requests roughly 30:1 — which put p95 on the chunks and diluted the error
   * rate by the same factor.
   */
  it("emits nothing for an unrouted success, which is framework traffic", async () => {
    const before = completionLines(lines).length;

    await completeOneRequest("/_next/static/chunks/page-abc123.js", 200);
    await completeOneRequest("/_next/static/chunks/page-abc123.js", 304);

    expect(completionLines(lines).length - before).toBe(0);
  });

  it("still emits for an unrouted failure, which is not framework noise", async () => {
    const before = completionLines(lines).length;

    await completeOneRequest("/_next/static/chunks/gone.js", 500);

    const emitted = completionLines(lines);

    expect(emitted.length - before).toBe(1);
    expect(emitted.at(-1)).toMatchObject({ route: "unknown", status: 500, level: "error" });
  });

  /**
   * A 404 is a *routed* request and always was — Next's per-request meta matches
   * a real pattern for it — so it is unaffected by the rule above. Pinned as a
   * regression guard on behaviour the spec already recorded.
   */
  it("emits for a 404, which carries a route pattern rather than unknown", async () => {
    const before = completionLines(lines).length;

    await completeOneRequest("/nope", 404, "/_not-found");

    const emitted = completionLines(lines);

    expect(emitted.length - before).toBe(1);
    expect(emitted.at(-1)).toMatchObject({ route: "/_not-found", status: 404, level: "info" });
  });

  it("emits one line per routed request and no more", async () => {
    const before = completionLines(lines).length;

    await completeOneRequest("/a", 200, "/a");
    await completeOneRequest("/b", 500, "/b");

    const emitted = completionLines(lines);

    expect(emitted.length - before).toBe(2);
    expect(emitted.at(-1)).toMatchObject({ status: 500, level: "error", context: { path: "/b" } });
  });

  /**
   * The forget is on the finish path unconditionally, not inside the branch that
   * emits — and the unrouted case is the one that matters, because it is now most
   * of the traffic. Nothing leaks either way (the entry is keyed weakly by the
   * request), but holding it until the collector runs is waste with no upside.
   */
  describe("forgets the request once it has finished", () => {
    it.each([
      ["one that produced a line", "/kept", 200, "/kept"],
      ["one that produced none", "/_next/static/chunks/x.js", 200, undefined],
    ])("%s", async (_name, path, status, matched) => {
      let captured: IncomingMessage | undefined;

      await completeOneRequest(path, status as number, matched as string | undefined, (request) => {
        captured = request;
      });

      expect(captured).toBeDefined();
      expect(runInRequestOf(captured as IncomingMessage, () => readRequestContext())).toEqual({});
    });
  });

  it("is idempotent — a second call does not double the lines", async () => {
    subscribeRequestCompletion(logger);

    const before = completionLines(lines).length;

    await completeOneRequest("/c", 200, "/c");

    expect(completionLines(lines).length - before).toBe(1);
  });
});

/**
 * The shape the one mint site produces. Asserted rather than "some 36 characters"
 * because a weaker pattern would also admit the empty-ish fallbacks this module
 * has for a request it never saw start.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * `request_id` is the correlator that exists with no DSN, which is every fresh
 * clone and every dev session — so unlike `trace_id` it has to hold up under the
 * two shapes that break an `AsyncLocalStorage`: concurrency, and a keep-alive
 * socket carrying one request's context into the next one's `finish` event.
 *
 * These run against `node:http`, which is where the mechanism lives. Next runs
 * its own request storage and the reporting SDK's OTel context manager is a third
 * `AsyncLocalStorage` in the same process, so the same two shapes are re-checked
 * against a running `next dev` — a green run here is not evidence for that.
 */
describe("the completion line and the request_id mixin", () => {
  it("carries a request_id, which no caller passed", async () => {
    await completeOneRequest("/r", 200, "/r");

    expect(completionLines(lines).at(-1)?.["request_id"]).toMatch(UUID);
  });

  it("gives the handler's own line the same id as the completion line", async () => {
    await completeOneRequest("/r", 200, "/r", () => logger.info("in handler"));

    expect(handlerLines().at(-1)?.["request_id"]).toBe(
      completionLines(lines).at(-1)?.["request_id"],
    );
  });

  /**
   * Absent, never stale. A line outside a request stamped with whichever request
   * ran last is a *wrong* correlation, which is the failure this field was added
   * to fix on the `trace_id` side rather than to reproduce.
   */
  it("leaves request_id off a line emitted outside any request", async () => {
    await completeOneRequest("/r", 200, "/r");

    logger.info("outside");

    expect(lines().at(-1)).not.toHaveProperty("request_id");
  });

  /**
   * The reason `@repo/errors` grew an ambient reader. `AppError` mints
   * `requestId` in its constructor, so before adoption an error line and the
   * completion line for the same request carried two different values under one
   * field name — and the id a user quotes off a response body matched neither.
   */
  it("gives an error raised in the handler the same id, so both lines join", async () => {
    let raised: AppError | undefined;

    await completeOneRequest("/e", 422, "/e", () => {
      raised = new AppError({ code: "example_failure", message: "probe" });
      logRequestError(raised, { level: "warn", route: "/e" }, logger);
    });

    const errorLine = lines().findLast((line) => line["msg"] === "request error");

    expect(raised?.requestId).toMatch(UUID);
    expect(errorLine?.["request_id"]).toBe(raised?.requestId);
    expect(completionLines(lines).at(-1)?.["request_id"]).toBe(raised?.requestId);
  });

  it("keeps thirty concurrent requests apart", async () => {
    const paths = Array.from({ length: 30 }, (_, index) => `/con/${index}`);

    await serve(
      (request, response) => {
        route(request, "/con/[n]");
        logger.info({ probe: request.url }, "in handler");
        setTimeout(
          () => {
            response.statusCode = 200;
            response.end("ok");
          },
          Math.floor(Math.random() * 20),
        );
      },
      async (origin) => {
        await Promise.all(paths.map((path) => fetch(`${origin}${path}`).then((r) => r.text())));
      },
    );

    const paired = paths.map((path) => ({
      handler: handlerLines().find((line) => line["probe"] === path)?.["request_id"],
      completion: completionLines(lines).find(
        (line) => (line["context"] as { path?: string } | undefined)?.path === path,
      )?.["request_id"],
    }));

    expect(paired.filter((pair) => pair.handler !== undefined)).toHaveLength(30);
    for (const pair of paired) expect(pair.completion).toBe(pair.handler);
    expect(new Set(paired.map((pair) => pair.completion)).size).toBe(30);
  });

  /**
   * The shape `enterWith` is notorious for. One socket carries every request, so
   * request N+1 enters the same execution context request N's `finish` would
   * otherwise read — which is why the completion line re-enters its own request's
   * context rather than trusting the one it finds.
   */
  it("keeps twenty keep-alive requests on one socket apart", async () => {
    const agent = new Agent({ keepAlive: true, maxSockets: 1 });
    const paths = Array.from({ length: 20 }, (_, index) => `/ka/${index}`);

    await serve(
      (request, response) => {
        route(request, "/ka/[n]");
        logger.info({ probe: request.url }, "in handler");
        response.statusCode = 200;
        response.end("ok");
      },
      async (origin) => {
        for (const path of paths) {
          // Sequential is the test. `Promise.all` here would open twenty sockets
          // and assert nothing about keep-alive, which is the shape that reuses
          // one execution context across requests.
          // oxlint-disable-next-line no-await-in-loop
          await new Promise<void>((resolve, reject) => {
            get(`${origin}${path}`, { agent }, (response) => {
              response.resume();
              response.on("end", resolve);
            }).on("error", reject);
          });
        }
      },
    );

    agent.destroy();

    const paired = paths.map((path) => ({
      handler: handlerLines().find((line) => line["probe"] === path)?.["request_id"],
      completion: completionLines(lines).find(
        (line) => (line["context"] as { path?: string } | undefined)?.path === path,
      )?.["request_id"],
    }));

    expect(paired.filter((pair) => pair.handler !== undefined)).toHaveLength(20);
    for (const pair of paired) expect(pair.completion).toBe(pair.handler);
    expect(new Set(paired.map((pair) => pair.completion)).size).toBe(20);
  });
});
