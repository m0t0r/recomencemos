import { AppError, DEFAULT_USER_MESSAGE, GENERIC_ERROR_CODE } from "@repo/errors/app-error";
import { toErrorResponse } from "@repo/errors/error-response";

// NFR15 counts occurrences, so every operator-side value carries a string that
// appears nowhere else. Anything that reaches the wire brings its sentinel with
// it, and a leak is a number rather than a judgement call.
const SENTINELS = [
  "SENTINEL_OPERATOR_MESSAGE",
  "SENTINEL_CONTEXT_TENANT",
  "SENTINEL_CONTEXT_QUERY",
  "SENTINEL_CONTEXT_NESTED",
  "SENTINEL_CAUSE",
];

function sentinelledError(): AppError {
  return new AppError({
    code: "order_lookup_failed",
    status: 503,
    message: "SENTINEL_OPERATOR_MESSAGE",
    userMessage: "We could not load that order.",
    context: {
      tenant: "SENTINEL_CONTEXT_TENANT",
      query: "SENTINEL_CONTEXT_QUERY",
      upstream: { detail: "SENTINEL_CONTEXT_NESTED" },
    },
    cause: new Error("SENTINEL_CAUSE"),
  });
}

function countSentinels(serialised: string): number {
  return SENTINELS.filter((sentinel) => serialised.includes(sentinel)).length;
}

describe("NFR15 — the audience split, counted", () => {
  it("puts 0 sentinels and exactly 3 keys on the Route Handler body", () => {
    const { body } = toErrorResponse(sentinelledError());

    expect(countSentinels(JSON.stringify(body))).toBe(0);
    expect(Object.keys(body)).toHaveLength(3);
  });

  it("puts 0 sentinels and exactly 3 keys on the Server Action projection", () => {
    const projection = sentinelledError().toClientError();

    expect(countSentinels(JSON.stringify(projection))).toBe(0);
    expect(Object.keys(projection)).toHaveLength(3);
  });

  it("carries the userMessage and the requestId through, so the wire is still useful", () => {
    const error = sentinelledError();
    const { status, body } = toErrorResponse(error);

    expect(status).toBe(503);
    expect(body.message).toBe("We could not load that order.");
    expect(body.requestId).toBe(error.requestId);
    expect(body.code).toBe("order_lookup_failed");
  });
});

describe("unrecognised throws", () => {
  it("yields a generic 500 carrying nothing from the original", () => {
    const response = toErrorResponse(new Error("SENTINEL_OPERATOR_MESSAGE"));

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      code: GENERIC_ERROR_CODE,
      message: DEFAULT_USER_MESSAGE,
      requestId: "",
    });
  });

  it("yields the same generic 500 for a thrown string, null, or undefined", () => {
    for (const thrown of ["SENTINEL_OPERATOR_MESSAGE", null, undefined]) {
      const response = toErrorResponse(thrown);
      expect(response.status).toBe(500);
      expect(JSON.stringify(response.body)).not.toContain("SENTINEL");
    }
  });
});

describe("a value that carries the registered symbol but was not built here", () => {
  const APP_ERROR_MARKER = Symbol.for("@repo/errors:AppError");

  it("refuses a status that is not a number in range", () => {
    for (const status of ["503", 1_000, 0, Number.NaN, 200.5, -1, null]) {
      const forged = {
        [APP_ERROR_MARKER]: true,
        code: "forged",
        status,
        message: "operator",
        userMessage: "user",
        requestId: "r_1",
      };

      expect(toErrorResponse(forged).status).toBe(500);
    }
  });

  it("refuses fields of the wrong type or over length, substituting constants", () => {
    const forged = {
      [APP_ERROR_MARKER]: true,
      code: { toString: () => "SENTINEL_OPERATOR_MESSAGE" },
      status: 503,
      message: "operator",
      userMessage: "x".repeat(5_000),
      requestId: 12_345,
    };

    expect(toErrorResponse(forged).body).toEqual({
      code: GENERIC_ERROR_CODE,
      message: DEFAULT_USER_MESSAGE,
      requestId: "",
    });
  });

  it("never runs a method the forged value supplies", () => {
    let called = false;
    const forged = {
      [APP_ERROR_MARKER]: true,
      code: "forged",
      status: 503,
      message: "operator",
      userMessage: "user",
      requestId: "r_1",
      toClientError: () => {
        called = true;
        return { code: "SENTINEL_OPERATOR_MESSAGE", message: "x", requestId: "y" };
      },
    };

    const { body } = toErrorResponse(forged);

    expect(called).toBe(false);
    expect(body.code).toBe("forged");
  });
});

describe("the shape of the returned value", () => {
  it("is a plain status/body/headers value, not a framework Response", () => {
    const response = toErrorResponse(new AppError({ code: "boom", message: "operator" }));

    expect(Object.keys(response).toSorted()).toEqual(["body", "headers", "status"]);
    expect(response).not.toBeInstanceOf(Response);
    expect(response.headers["content-type"]).toBe("application/json");
  });
});
