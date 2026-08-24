import { AppError, DEFAULT_USER_MESSAGE, isAppError } from "@repo/errors/app-error";

describe("isAppError", () => {
  it("recognises an AppError", () => {
    expect(isAppError(new AppError({ code: "boom", message: "operator detail" }))).toBe(true);
  });

  it("rejects a lookalike carrying the same fields but not the symbol", () => {
    const lookalike = {
      code: "boom",
      status: 500,
      message: "operator detail",
      userMessage: "Something went wrong.",
      requestId: "abc",
      context: {},
    };

    expect(isAppError(lookalike)).toBe(false);
  });

  it("rejects values that are not objects", () => {
    expect(isAppError(new Error("plain"))).toBe(false);
    expect(isAppError(null)).toBe(false);
    expect(isAppError("boom")).toBe(false);
  });
});

describe("userMessage", () => {
  it("falls back to the module constant, never to the operator message", () => {
    const error = new AppError({ code: "boom", message: "connection string leaked in here" });

    expect(error.userMessage).toBe(DEFAULT_USER_MESSAGE);
    expect(error.userMessage).not.toBe(error.message);
    expect(error.userMessage).not.toContain("connection string");
  });

  it("uses the caller's userMessage when one is given", () => {
    const error = new AppError({
      code: "boom",
      message: "operator detail",
      userMessage: "That order no longer exists.",
    });

    expect(error.userMessage).toBe("That order no longer exists.");
  });
});

describe("the two projections", () => {
  const error = new AppError({
    code: "order_not_found",
    status: 404,
    message: "order lookup failed for tenant acme",
    userMessage: "That order no longer exists.",
    context: { orderId: "o_1", attempt: 2 },
    cause: new Error("ECONNREFUSED 10.0.0.4:5432"),
  });

  it("has no toJSON, so JSON.stringify cannot publish operator prose by accident", () => {
    expect("toJSON" in error).toBe(false);
    expect(Object.getPrototypeOf(error)).not.toHaveProperty("toJSON");
  });

  it("projects the operator shape as an exact key set", () => {
    expect(Object.keys(error.toOperatorJSON()).toSorted()).toEqual([
      "code",
      "context",
      "message",
      "status",
      "userMessage",
    ]);
  });

  // ADR-0005. The field moved rather than being duplicated: the log line lifts
  // it to the top level as `request_id`, read off the error rather than obtained
  // from here, so a reader has one place to look and a truncated line cannot
  // trim one of two copies. `ClientError` still carries it, still spelled
  // `requestId` — the wire is a JS contract and stays camelCase, which is the
  // hop where the two spellings meet.
  it("leaves requestId out of the operator shape, and keeps it in the client one", () => {
    expect(error.toOperatorJSON()).not.toHaveProperty("requestId");
    expect(error.toClientError().requestId).toBe(error.requestId);
  });

  it("projects the client shape as an exact key set", () => {
    expect(Object.keys(error.toClientError()).toSorted()).toEqual(["code", "message", "requestId"]);
  });

  it("sends the userMessage as the client `message`, never the operator one", () => {
    expect(error.toClientError().message).toBe("That order no longer exists.");
    expect(error.toClientError().message).not.toBe(error.message);
  });

  it("carries the cause but publishes it in neither projection", () => {
    expect(error.cause).toBeInstanceOf(Error);
    expect(JSON.stringify(error.toOperatorJSON())).not.toContain("ECONNREFUSED");
    expect(JSON.stringify(error.toClientError())).not.toContain("ECONNREFUSED");
  });
});
