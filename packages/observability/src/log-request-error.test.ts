import { AppError, MAX_CODE_LENGTH } from "@repo/errors/app-error";
import { toErrorResponse } from "@repo/errors/error-response";
import { logRequestError } from "@repo/observability/log-request-error";
import { createLoggerOptions, MIN_LINE_BYTES } from "@repo/observability/logger-options";
import pino from "pino";
import { Writable } from "node:stream";

function harness(env: Parameters<typeof createLoggerOptions>[0] = {}) {
  const written: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      written.push(String(chunk));
      callback();
    },
  });

  return {
    logger: pino(createLoggerOptions({ LOG_LEVEL: "trace", ...env }), stream),
    lines: () => written.map((line) => JSON.parse(line) as Record<string, unknown>),
  };
}

function errorField(line: Record<string, unknown> | undefined): Record<string, unknown> {
  return (line?.err ?? {}) as Record<string, unknown>;
}

/** A carrier wearing the registered marker, never built through the constructor. */
function forgedCarrier(fields: Record<string, unknown>): unknown {
  return { [Symbol.for("@repo/errors:AppError")]: true, ...fields };
}

describe("logRequestError", () => {
  it("writes to the logger the caller injects, not to the singleton", () => {
    const { logger, lines } = harness();

    logRequestError(new AppError({ code: "boom", message: "operator detail" }), {}, logger);

    expect(lines()).toHaveLength(1);
  });

  it("emits at error by default — the thrown-and-reported case", () => {
    const { logger, lines } = harness();

    logRequestError(new AppError({ code: "boom", message: "operator detail" }), {}, logger);

    expect(lines()[0]?.level).toBe("error");
  });

  it("emits at warn for an error returned through toErrorResponse", () => {
    const { logger, lines } = harness();

    logRequestError(new AppError({ code: "boom", message: "d" }), { level: "warn" }, logger);

    expect(lines()[0]?.level).toBe("warn");
  });

  it("lifts code and status to the top level, where a query can filter on them", () => {
    const { logger, lines } = harness();

    logRequestError(
      new AppError({ code: "order_not_found", status: 404, message: "no order" }),
      { level: "warn", route: "/orders/[id]" },
      logger,
    );

    expect(lines()[0]).toMatchObject({
      code: "order_not_found",
      status: 404,
      route: "/orders/[id]",
    });
  });

  it("lets the caller's status win over the error's", () => {
    const { logger, lines } = harness();

    logRequestError(
      new AppError({ code: "boom", status: 500, message: "d" }),
      { status: 502 },
      logger,
    );

    expect(lines()[0]?.status).toBe(502);
  });

  it("carries the event id when the report site supplies one", () => {
    const { logger, lines } = harness();

    logRequestError(new AppError({ code: "boom", message: "d" }), { event_id: "e_1" }, logger);

    expect(lines()[0]?.event_id).toBe("e_1");
  });

  it("carries no event_id key at all when there was no report", () => {
    const { logger, lines } = harness();

    logRequestError(new AppError({ code: "boom", message: "d" }), {}, logger);

    expect(lines()[0]).not.toHaveProperty("event_id");
  });

  it("logs the error through the serialiser", () => {
    const { logger, lines } = harness();
    const error = new AppError({ code: "boom", message: "operator detail" });

    logRequestError(error, {}, logger);

    expect(lines()[0]?.err).toMatchObject({ code: "boom", message: "operator detail" });
  });

  it("handles something that is not an AppError at all", () => {
    const { logger, lines } = harness();

    expect(() => logRequestError("a thrown string", {}, logger)).not.toThrow();
    expect(lines()[0]).toMatchObject({ code: "internal_error", status: 500 });
  });

  it("redacts caller context, like any other line", () => {
    const { logger, lines } = harness();

    logRequestError(new Error("plain"), { context: { token: "SENTINEL" } }, logger);

    expect(JSON.stringify(lines()[0])).not.toContain("SENTINEL");
  });
});

/**
 * ADR-0005. The request id is the one identifier a user can quote — one of
 * exactly three keys `ClientError` publishes — and on the handled-and-returned
 * path, with no DSN configured, it is the only correlator the line has. It is
 * lifted for the same reason `code` and `status` are.
 *
 * It reaches the line as `request_id` while the entity spells the property
 * `requestId`, because the line is `snake_case` throughout and names its own
 * fields. The tests below assert the line's spelling; the wire's is asserted in
 * `@repo/errors`, and the two differing is the documented price.
 */
describe("the lifted request_id", () => {
  it("carries the error's request id at the top level, and not inside err", () => {
    const { logger, lines } = harness();
    const error = new AppError({ code: "boom", message: "operator detail" });

    logRequestError(error, {}, logger);

    expect(lines()[0]?.request_id).toBe(error.requestId);
    expect(lines()[0]).not.toHaveProperty("requestId");
    expect(errorField(lines()[0])).not.toHaveProperty("requestId");
  });

  // The criterion this covers is about *how* the value arrives, not what it is:
  // identity is a registered symbol and therefore a claim, so obtaining a query
  // field by invoking a projection would run a forger's code. A forgery whose
  // projection throws still yields the field, which is only possible if it was
  // read off the value.
  it("reads the field off the error rather than calling toOperatorJSON for it", () => {
    const { logger, lines } = harness();
    const forged = {
      [Symbol.for("@repo/errors:AppError")]: true,
      code: "forged",
      status: 418,
      requestId: "req_from_a_field",
      toOperatorJSON() {
        throw new Error("gotcha");
      },
    };

    expect(() => logRequestError(forged, {}, logger)).not.toThrow();
    expect(lines()[0]?.request_id).toBe("req_from_a_field");
    expect(JSON.stringify(lines()[0])).not.toContain("gotcha");
  });

  // A logger is the one place that must not throw, so an unusable value costs
  // the field and nothing else. The bounds are the client projection's, which is
  // why they are one exported number rather than two that can drift.
  it.each([
    ["absent", undefined],
    ["not a string", 12_345],
    ["empty", ""],
    ["over-long", "r".repeat(65)],
  ])("omits the field entirely when the value is %s", (_case, requestId) => {
    const { logger, lines } = harness();
    const forged = {
      [Symbol.for("@repo/errors:AppError")]: true,
      code: "boom",
      status: 500,
      ...(requestId === undefined ? {} : { requestId }),
    };

    expect(() => logRequestError(forged, {}, logger)).not.toThrow();
    expect(lines()[0]).not.toHaveProperty("request_id");
    expect(lines()[0]?.code).toBe("boom");
  });

  // The defect #55 is really about. Before the lift, `requestId` reached the
  // line only inside `err`, behind an operator `message` that is shortened
  // rather than dropped — so an oversized message consumed the budget and the
  // field a support lookup starts from vanished from exactly the lines an
  // operator most needs. It is now a preserved field, admitted with the
  // correlation fields before anything shortenable is offered a byte.
  it("survives a line that breached the cap, with an oversized operator message", () => {
    const { logger, lines } = harness({ LOG_MAX_LINE_BYTES: String(MIN_LINE_BYTES) });
    const error = new AppError({
      code: "example_failure",
      status: 422,
      message: "m".repeat(20_000),
      context: { blob: "x".repeat(20_000) },
    });

    logRequestError(error, { level: "warn", route: "/api/example-error" }, logger);

    expect(lines()[0]).toMatchObject({ truncated: true, request_id: error.requestId });
  });
});

/**
 * #67. Identity is a registered symbol, so `isAppError` is a claim and every
 * field lifted off a claimed error is a value someone else may have written.
 * The wire has always validated `status` and `code` before copying them; this
 * reader accepted any `number` and any `string`, so the two egresses published
 * different answers for the same error — the wire a generic 500, the line
 * `null`, `-1`, or `200.5`.
 *
 * Both fields are preserved on truncation and `status` is what the go-live
 * runbook's mass-401 band filters on, so a line that carries an unusable one is
 * a line that incident query silently skips.
 */
describe("the lifted fields hold to the wire's standard", () => {
  // `NaN` and `Infinity` are the two the old `typeof` check let through and JSON
  // then rendered as `null`; `200.5` and `999` are what `Number.isInteger` and
  // the range respectively are for. `"500"` is the case that already worked, and
  // is here so the table is the whole predicate rather than the part that broke.
  const REFUSED_STATUSES: readonly [string, unknown][] = [
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["negative", -1],
    ["zero", 0],
    ["non-integer", 200.5],
    ["above the range", 999],
    ["a string", "500"],
  ];

  it.each(REFUSED_STATUSES)("publishes the generic 500 when status is %s", (_case, status) => {
    const { logger, lines } = harness();

    logRequestError(forgedCarrier({ code: "boom", status }), {}, logger);

    expect(lines()[0]?.status).toBe(500);
  });

  it.each([400, 404, 500, 599])("carries a usable status unchanged: %s", (status) => {
    const { logger, lines } = harness();

    logRequestError(forgedCarrier({ code: "boom", status }), {}, logger);

    expect(lines()[0]?.status).toBe(status);
  });

  // The regression guard for the drift itself, rather than for the seven values
  // above: whatever the two egresses do, they do the same thing. A predicate
  // that changes on one side and not the other fails here first.
  it.each(REFUSED_STATUSES)("agrees with the wire about a status that is %s", (_case, status) => {
    const { logger, lines } = harness();
    const error = forgedCarrier({ code: "boom", status });

    logRequestError(error, {}, logger);

    expect(lines()[0]?.status).toBe(toErrorResponse(error).status);
  });

  const REFUSED_CODES: readonly [string, unknown][] = [
    ["empty", ""],
    ["over-long", "c".repeat(MAX_CODE_LENGTH + 1)],
    ["not a string", 418],
  ];

  it.each(REFUSED_CODES)("publishes the generic code when code is %s", (_case, code) => {
    const { logger, lines } = harness();

    logRequestError(forgedCarrier({ code, status: 404 }), {}, logger);

    expect(lines()[0]?.code).toBe("internal_error");
    expect(lines()[0]?.status).toBe(404);
  });

  it("carries a usable code unchanged", () => {
    const { logger, lines } = harness();

    logRequestError(forgedCarrier({ code: "order_not_found", status: 404 }), {}, logger);

    expect(lines()[0]?.code).toBe("order_not_found");
  });

  it.each(REFUSED_CODES)("agrees with the wire about a code that is %s", (_case, code) => {
    const { logger, lines } = harness();
    const error = forgedCarrier({ code, status: 404 });

    logRequestError(error, {}, logger);

    expect(lines()[0]?.code).toBe(toErrorResponse(error).body.code);
  });

  // The override wins only if it is usable. Falling back to the error's own
  // status rather than to the generic is the documented choice: the caller's
  // mistake should not cost a value the error carried correctly.
  it("falls back to the error's status when the caller's override is unusable", () => {
    const { logger, lines } = harness();

    logRequestError(
      new AppError({ code: "boom", status: 404, message: "d" }),
      { status: Number.NaN },
      logger,
    );

    expect(lines()[0]?.status).toBe(404);
  });

  it("falls back to the generic when neither the override nor the error is usable", () => {
    const { logger, lines } = harness();

    logRequestError(forgedCarrier({ code: "boom", status: -1 }), { status: 999 }, logger);

    expect(lines()[0]?.status).toBe(500);
  });
});
