import {
  type ReportingClient,
  reportError,
  type RequestErrorContext,
  type RequestSummary,
} from "@repo/observability/report-error";

const EVENT_ID = "e55965488ce641a3a86d6686a8a91e61";
const EARLIER_EVENT_ID = "0000aaaa1111bbbb2222cccc3333dddd";

const REQUEST: RequestSummary = { path: "/orders?q=1", method: "POST", headers: {} };
const CONTEXT: RequestErrorContext = {
  routerKind: "App Router",
  routePath: "/orders",
  routeType: "route",
};

/** A reporting platform that behaves, so each test can vary one thing about it. */
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

describe("reportError", () => {
  it("returns the event id the capture produced — what makes one event countable", () => {
    expect(reportError(new Error("boom"), REQUEST, CONTEXT, client())).toBe(EVENT_ID);
  });

  it("hands the request and the route to the capture, so the event carries both", () => {
    const seen: unknown[] = [];
    const capturing = client({
      capture: (_error, request, context) => {
        seen.push([request, context]);
      },
    });

    reportError(new Error("boom"), REQUEST, CONTEXT, capturing);

    expect(seen).toEqual([[REQUEST, CONTEXT]]);
  });

  it("reports nothing and returns undefined when no client is initialised", () => {
    const captures: unknown[] = [];
    const inactive = client({
      isActive: () => false,
      capture: (error) => {
        captures.push(error);
      },
    });

    expect(reportError(new Error("boom"), REQUEST, CONTEXT, inactive)).toBeUndefined();
    expect(captures).toEqual([]);
  });

  /**
   * The reason the id is read twice rather than once. `lastEventId` lives on the
   * SDK's isolation scope and survives the call that set it, so a capture that
   * did not complete synchronously leaves the *previous* error's id sitting
   * there. Returning it would put a confident, wrong event id on a log line —
   * worse than no id, because someone follows it mid-incident.
   */
  it("returns undefined rather than a stale id when the capture set no new one", () => {
    const stale = client({
      capture: () => {},
      lastEventId: () => EARLIER_EVENT_ID,
    });

    expect(reportError(new Error("boom"), REQUEST, CONTEXT, stale)).toBeUndefined();
  });

  it("returns the new id when one genuinely replaced an earlier one", () => {
    let current: string | undefined = EARLIER_EVENT_ID;
    const replacing = client({
      capture: () => {
        current = EVENT_ID;
      },
      lastEventId: () => current,
    });

    expect(reportError(new Error("boom"), REQUEST, CONTEXT, replacing)).toBe(EVENT_ID);
  });

  it("returns undefined when the platform reports no id at all", () => {
    const silent = client({ capture: () => {}, lastEventId: () => undefined });

    expect(reportError(new Error("boom"), REQUEST, CONTEXT, silent)).toBeUndefined();
  });

  it("does not propagate a throwing report", () => {
    const throwing = client({
      capture: () => {
        throw new Error("the SDK threw, or the network did");
      },
    });

    expect(() => reportError(new Error("boom"), REQUEST, CONTEXT, throwing)).not.toThrow();
  });

  it("returns undefined when the report throws, so no id reaches the line", () => {
    const throwing = client({
      capture: () => {
        throw new Error("the SDK threw, or the network did");
      },
    });

    expect(reportError(new Error("boom"), REQUEST, CONTEXT, throwing)).toBeUndefined();
  });

  it("does not propagate when even the readiness check throws", () => {
    const hostile = client({
      isActive: () => {
        throw new Error("the SDK is in a bad state");
      },
    });

    expect(reportError(new Error("boom"), REQUEST, CONTEXT, hostile)).toBeUndefined();
  });
});
