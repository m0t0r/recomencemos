import { AppError } from "@repo/errors/app-error";
import { setAmbientRequestIdReader } from "@repo/errors/ambient-request-id";
import {
  beginRequest,
  endRequest,
  publishRequestIdToErrors,
  readRequestContext,
  runInRequestOf,
} from "@repo/observability/request-context";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** A stand-in for the `IncomingMessage` the channel publishes. Identity is all this module reads. */
function aRequest(): object {
  return {};
}

/**
 * `beginRequest` enters the current execution context, which is the only thing it
 * can do from a channel subscriber. Every call here is wrapped so the entry
 * cannot outlive the case that made it and reach the next one.
 */
function within<T>(fn: () => T): T {
  return runInRequestOf(aRequest(), fn);
}

function idIn(fn: () => void): string | undefined {
  let seen: string | undefined;

  within(() => {
    fn();
    seen = readRequestContext()["request_id"];
  });

  return seen;
}

describe("readRequestContext", () => {
  /**
   * The half of the contract a stale id would break silently: a background timer,
   * a module's import-time line, a startup notice. Absent is the correct answer
   * there, and it is not the same as "whatever the last request was".
   */
  it("contributes nothing outside a request", () => {
    expect(readRequestContext()).toEqual({});
  });

  it("contributes request_id inside one, snake_case like every field on the line", () => {
    expect(idIn(() => beginRequest(aRequest()))).toMatch(UUID);
  });

  it("is back to contributing nothing once the request is over", () => {
    within(() => beginRequest(aRequest()));

    expect(readRequestContext()).toEqual({});
  });
});

describe("beginRequest", () => {
  it("mints a different id for every request, so two never share one", () => {
    const first = idIn(() => beginRequest(aRequest()));
    const second = idIn(() => beginRequest(aRequest()));

    expect(first).not.toBe(second);
  });

  /**
   * `channel.bindStore()` is the documented route and does not work: Node
   * publishes `http.server.request.start` with plain `publish()` rather than
   * `runStores()`, so a bound store never activates. `enterWith` is what a
   * subscriber has, and it propagates forward from the call rather than wrapping
   * a callback.
   */
  it("propagates forward from the call, which is all a channel subscriber can do", () => {
    const request = aRequest();

    const seen = within(() => {
      beginRequest(request);

      return readRequestContext();
    });

    expect(seen["request_id"]).toMatch(UUID);
  });

  it("survives an await, so a handler's own lines carry the same id", async () => {
    const request = aRequest();

    const [entered, afterAwait] = await runInRequestOf(aRequest(), async () => {
      beginRequest(request);

      const before = readRequestContext()["request_id"];

      await Promise.resolve();

      return [before, readRequestContext()["request_id"]];
    });

    expect(entered).toMatch(UUID);
    expect(afterAwait).toBe(entered);
  });
});

describe("runInRequestOf", () => {
  it("re-enters the identity the request began with", () => {
    const request = aRequest();
    const atStart = idIn(() => beginRequest(request));

    expect(runInRequestOf(request, () => readRequestContext()["request_id"])).toBe(atStart);
  });

  /**
   * The shape `enterWith` is notorious for, and the reason this function exists
   * rather than the completion line emitting into whatever context it finds. One
   * socket carries every request, so a later request enters the same execution
   * context an earlier one's `finish` event would otherwise read.
   */
  it("gives the earlier request its own id after a later one has entered", () => {
    const earlier = aRequest();
    const later = aRequest();

    const [earlierId, laterId] = within(() => {
      beginRequest(earlier);
      const first = readRequestContext()["request_id"];

      beginRequest(later);

      return [first, readRequestContext()["request_id"]];
    });

    expect(laterId).not.toBe(earlierId);
    expect(runInRequestOf(earlier, () => readRequestContext()["request_id"])).toBe(earlierId);
  });

  it("keeps two concurrent requests apart", async () => {
    const first = aRequest();
    const second = aRequest();
    const firstId = idIn(() => beginRequest(first));
    const secondId = idIn(() => beginRequest(second));

    const [a, b] = await Promise.all([
      runInRequestOf(first, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));

        return readRequestContext();
      }),
      runInRequestOf(second, async () => readRequestContext()),
    ]);

    expect(a).toEqual({ request_id: firstId });
    expect(b).toEqual({ request_id: secondId });
  });

  it("contributes nothing for a request it never saw begin", () => {
    expect(runInRequestOf(aRequest(), () => readRequestContext())).toEqual({});
  });

  /**
   * The same argument as the keep-alive case, arrived at from the other side. A
   * request that began before the subscription existed must not inherit whichever
   * *other* request was last on the socket — a line with no `request_id` is
   * honest, a line with a neighbour's is a wrong correlation, and the band that
   * would catch it counts missing ids rather than wrong ones.
   */
  it("does not let an unknown request inherit the context it was called in", () => {
    const known = aRequest();

    within(() => {
      beginRequest(known);

      expect(readRequestContext()["request_id"]).toMatch(UUID);
      expect(runInRequestOf(aRequest(), () => readRequestContext())).toEqual({});
    });
  });
});

describe("endRequest", () => {
  /**
   * The `WeakMap` means nothing leaks either way — the entry cannot outlive the
   * request object it is keyed by. What this buys is that the entry goes at
   * response-finish rather than whenever the collector next runs, on the majority
   * path that now emits no line at all.
   */
  it("forgets the request, so re-entering it contributes nothing", () => {
    const request = aRequest();

    within(() => beginRequest(request));
    endRequest(request);

    expect(runInRequestOf(request, () => readRequestContext())).toEqual({});
  });

  it("is idempotent, and forgetting one it never knew is not an error", () => {
    const request = aRequest();

    within(() => beginRequest(request));

    expect(() => {
      endRequest(request);
      endRequest(request);
      endRequest(aRequest());
    }).not.toThrow();
  });

  /**
   * Forgetting belongs to one moment, not to whichever caller happens to read
   * last. A completion line that read the identity twice — or a later ticket
   * adding a second reader — must not find it gone.
   */
  it("is the only thing that forgets: runInRequestOf reads without consuming", () => {
    const request = aRequest();
    const id = idIn(() => beginRequest(request));

    expect(runInRequestOf(request, () => readRequestContext()["request_id"])).toBe(id);
    expect(runInRequestOf(request, () => readRequestContext()["request_id"])).toBe(id);
  });
});

describe("publishRequestIdToErrors", () => {
  afterEach(() => {
    setAmbientRequestIdReader(undefined);
  });

  it("gives an AppError raised inside a request that request's id", () => {
    publishRequestIdToErrors();

    const [ambient, raised] = within(() => {
      beginRequest(aRequest());

      return [
        readRequestContext()["request_id"],
        new AppError({ code: "probe", message: "probe" }).requestId,
      ];
    });

    expect(raised).toBe(ambient);
  });

  it("leaves an AppError raised outside one to mint its own", () => {
    publishRequestIdToErrors();

    const raised = new AppError({ code: "probe", message: "probe" }).requestId;

    expect(raised).toMatch(UUID);
    expect(readRequestContext()).toEqual({});
  });
});
