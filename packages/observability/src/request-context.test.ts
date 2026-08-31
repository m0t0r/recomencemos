import {
  enterRequestContext,
  newRequestId,
  readRequestContext,
  runInRequestContext,
} from "@repo/observability/request-context";

describe("newRequestId", () => {
  it("mints a UUID rather than reading one from anywhere", () => {
    expect(newRequestId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("mints a different one each time, so two requests never share an id", () => {
    expect(newRequestId()).not.toBe(newRequestId());
  });
});

describe("readRequestContext", () => {
  /**
   * The half of the contract that a stale id would break silently: a background
   * timer, a module's import-time line, a startup notice. Absent is the correct
   * answer there, and it is not the same as "whatever the last request was".
   */
  it("contributes nothing outside a request", () => {
    expect(readRequestContext()).toEqual({});
  });

  it("contributes request_id inside one, snake_case like every field on the line", () => {
    const id = newRequestId();

    expect(runInRequestContext(id, () => readRequestContext())).toEqual({ request_id: id });
  });

  it("reads the same id after an await, which is where a store is usually lost", async () => {
    const id = newRequestId();

    const seen = await runInRequestContext(id, async () => {
      await Promise.resolve();

      return readRequestContext();
    });

    expect(seen).toEqual({ request_id: id });
  });

  it("is back to contributing nothing once the request is over", async () => {
    await runInRequestContext(newRequestId(), async () => Promise.resolve());

    expect(readRequestContext()).toEqual({});
  });

  it("keeps two concurrent requests apart", async () => {
    const [first, second] = [newRequestId(), newRequestId()];

    const [a, b] = await Promise.all([
      runInRequestContext(first, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));

        return readRequestContext();
      }),
      runInRequestContext(second, async () => readRequestContext()),
    ]);

    expect(a).toEqual({ request_id: first });
    expect(b).toEqual({ request_id: second });
  });
});

describe("enterRequestContext", () => {
  /**
   * `channel.bindStore()` is the documented route and does not work: Node
   * publishes `http.server.request.start` with plain `publish()` rather than
   * `runStores()`, so a bound store never activates. `enterWith` is what the
   * channel subscriber has, and it propagates forward from the call rather than
   * wrapping a callback.
   */
  it("propagates forward from the call, which is all a channel subscriber can do", () => {
    const id = newRequestId();

    const seen = runInRequestContext(newRequestId(), () => {
      enterRequestContext(id);

      return readRequestContext();
    });

    expect(seen).toEqual({ request_id: id });
  });

  it("survives an await, so a handler's own lines carry the same id", async () => {
    const id = newRequestId();

    const seen = await runInRequestContext(newRequestId(), async () => {
      enterRequestContext(id);

      await Promise.resolve();

      return readRequestContext();
    });

    expect(seen).toEqual({ request_id: id });
  });
});
