import { AppError } from "@repo/errors/app-error";
import { createLoggerOptions } from "@repo/observability/logger-options";
import type {
  ReportingClient,
  RequestErrorContext,
  RequestSummary,
} from "@repo/observability/report-error";
import { reportRequestError } from "@repo/observability/report-request-error";
import pino from "pino";
import { Writable } from "node:stream";

const EVENT_ID = "e55965488ce641a3a86d6686a8a91e61";

function harness() {
  const written: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      written.push(String(chunk));
      callback();
    },
  });

  return {
    logger: pino(createLoggerOptions({ LOG_LEVEL: "trace" }), stream),
    lines: () => written.map((line) => JSON.parse(line) as Record<string, unknown>),
  };
}

const REQUEST: RequestSummary = { path: "/orders?q=1", method: "POST", headers: {} };
const CONTEXT: RequestErrorContext = {
  routerKind: "App Router",
  routePath: "/orders",
  routeType: "route",
};

/**
 * Every case below injects a **reporting client**, not a report, so the real
 * `reportError` always sits in the middle: its readiness guard, its stale-id
 * delta and its swallow are all part of what these tests exercise. A stub
 * standing in for the whole report would let "a throwing report still emits the
 * line" pass against a function that had agreed in advance not to throw.
 */
function client(overrides: Partial<ReportingClient> = {}): ReportingClient {
  let current: string | undefined;

  return {
    isActive: () => true,
    capture: () => {
      current = EVENT_ID;
    },
    lastEventId: () => current,
    ...overrides,
  };
}

/**
 * A **fresh** client per test, deliberately. A shared one keeps the id it last
 * set, and `reportError`'s stale-id delta then correctly declines to report the
 * same id twice — which is the guard working, not a test-harness detail to
 * paper over.
 */
const reported = () => client();
const notReported = client({ isActive: () => false });
const throwingReport = client({
  capture: () => {
    throw new Error("the SDK threw, or the network did");
  },
});

describe("reportRequestError", () => {
  it("emits exactly one line — NFR3's count, and the whole quota argument", () => {
    const { logger, lines } = harness();

    reportRequestError(
      new AppError({ code: "boom", message: "operator detail" }),
      REQUEST,
      CONTEXT,
      logger,
      reported(),
    );

    expect(lines()).toHaveLength(1);
  });

  it("emits it at error, because a thrown error is the reported half", () => {
    const { logger, lines } = harness();

    reportRequestError(
      new AppError({ code: "boom", message: "d" }),
      REQUEST,
      CONTEXT,
      logger,
      reported(),
    );

    expect(lines()[0]?.level).toBe("error");
  });

  it("carries the event id the report returned, which is what makes the pivot work", () => {
    const { logger, lines } = harness();

    reportRequestError(
      new AppError({ code: "boom", message: "d" }),
      REQUEST,
      CONTEXT,
      logger,
      reported(),
    );

    expect(lines()[0]?.event_id).toBe(EVENT_ID);
  });

  it("returns the event id, so a caller can carry it further", () => {
    const { logger } = harness();

    const eventId = reportRequestError(new Error("boom"), REQUEST, CONTEXT, logger, reported());

    expect(eventId).toBe(EVENT_ID);
  });

  it("carries the matched route, not the URL", () => {
    const { logger, lines } = harness();

    reportRequestError(new Error("boom"), REQUEST, CONTEXT, logger, reported());

    expect(lines()[0]?.route).toBe("/orders");
    expect(JSON.stringify(lines()[0])).not.toContain("?q=1");
  });

  it("reports before it logs, while the active span is still resolvable", () => {
    // The order is read off the *stream*, so what is being asserted is the order
    // of the two real effects — the report, and a line reaching a destination —
    // rather than the order of two calls a stub agreed to record.
    const order: string[] = [];
    const stream = new Writable({
      write(_chunk, _encoding, callback) {
        order.push("log");
        callback();
      },
    });
    const logger = pino(createLoggerOptions({ LOG_LEVEL: "trace" }), stream);

    reportRequestError(
      new Error("boom"),
      REQUEST,
      CONTEXT,
      logger,
      client({
        capture: () => {
          order.push("report");
        },
        lastEventId: () => (order.includes("report") ? EVENT_ID : undefined),
      }),
    );

    expect(order).toEqual(["report", "log"]);
  });

  /**
   * The criterion this module exists to make assertable rather than assumed. A
   * report that throws must not suppress the line, or the incident appears in
   * neither sink at exactly the moment both are needed.
   */
  it("still emits the line when the report throws", () => {
    const { logger, lines } = harness();

    reportRequestError(new Error("boom"), REQUEST, CONTEXT, logger, throwingReport);

    expect(lines()).toHaveLength(1);
  });

  it("does not propagate a throwing report to the framework", () => {
    const { logger } = harness();

    expect(() =>
      reportRequestError(new Error("boom"), REQUEST, CONTEXT, logger, throwingReport),
    ).not.toThrow();
  });

  it("omits event_id entirely when the report threw, rather than emitting an empty one", () => {
    const { logger, lines } = harness();

    reportRequestError(new Error("boom"), REQUEST, CONTEXT, logger, throwingReport);

    expect(lines()[0]).not.toHaveProperty("event_id");
  });

  it("still emits the line on the no-DSN path, where nothing is reported at all", () => {
    const { logger, lines } = harness();

    reportRequestError(new Error("boom"), REQUEST, CONTEXT, logger, notReported);

    expect(lines()).toHaveLength(1);
    expect(lines()[0]).not.toHaveProperty("event_id");
  });

  it("hands the request and the route straight to the report, unaltered", () => {
    const { logger } = harness();
    const seen: unknown[] = [];

    reportRequestError(
      new Error("boom"),
      REQUEST,
      CONTEXT,
      logger,
      client({
        capture: (_error, request, context) => {
          seen.push([request, context]);
        },
      }),
    );

    expect(seen).toEqual([[REQUEST, CONTEXT]]);
  });

  it("derives the line's operator context from the hook rather than from the caller", () => {
    const { logger, lines } = harness();

    reportRequestError(new Error("boom"), REQUEST, CONTEXT, logger, reported());

    expect(lines()[0]?.context).toEqual({
      method: "POST",
      router_kind: "App Router",
      route_type: "route",
    });
  });
});
