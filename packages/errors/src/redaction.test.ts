import * as redactionModule from "@repo/errors/redaction";
import {
  isRedactedKey,
  REDACTED,
  redactionPaths,
  scrubEvent,
  scrubOrDrop,
} from "@repo/errors/redaction";

const SECRET = "SENTINEL_SECRET_VALUE";

// The list is module-internal, so the fixture names the keys itself rather than
// importing them. That is deliberate twice over: it is the assertion that the
// list is unexported, and it keeps the test honest about what it proves — that
// the *mechanism* works on the shipped names, never that the names are
// sufficient. The list is advisory; a downstream project extends it.
//
// The drift this cannot catch, stated plainly: a name added to `redaction.ts`
// and not to this fixture goes untested and the suite stays green. Only the
// reverse — a name removed from the module — fails here. That is the price of
// not exporting the list, and it is the price the design chose knowingly.
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

function errorEvent() {
  return {
    event_id: "e_1",
    level: "error",
    request: {
      url: "https://example.test/orders",
      headers: everyShippedKey(),
    },
    contexts: { runtime: everyShippedKey() },
    tags: everyShippedKey(),
    extra: {
      ...everyShippedKey(),
      // Redaction addresses the *post-serialisation* object, so the fixture
      // nests a `cause` the way an error serialiser leaves one — the shape an
      // incident actually produces (DD3).
      cause: { config: { headers: { authorization: SECRET } } },
    },
    breadcrumbs: [{ category: "fetch", data: everyShippedKey() }],
    exception: {
      values: [
        {
          type: "AppError",
          stacktrace: { frames: [{ function: "load", vars: everyShippedKey() }] },
        },
      ],
    },
  };
}

function transactionEvent() {
  return {
    event_id: "t_1",
    type: "transaction",
    transaction: "GET /orders",
    contexts: { trace: everyShippedKey() },
    tags: everyShippedKey(),
    extra: everyShippedKey(),
    spans: [{ op: "http.client", data: everyShippedKey() }],
  };
}

function breadcrumb() {
  return { type: "http", category: "fetch", message: "GET /orders", data: everyShippedKey() };
}

describe("the three hook shapes", () => {
  it.each([
    ["beforeSend", errorEvent],
    ["beforeSendTransaction", transactionEvent],
    ["beforeBreadcrumb", breadcrumb],
  ])("replaces every shipped key name with one placeholder in a %s payload", (_hook, build) => {
    const serialised = JSON.stringify(scrubEvent(build()));

    expect(serialised).not.toContain(SECRET);
    expect(serialised).toContain(REDACTED);
  });
});

describe("what it reaches", () => {
  it("reaches a key nested under a cause, at depth 4 from the carrier root", () => {
    const scrubbed = scrubEvent(errorEvent());

    expect(scrubbed.extra.cause.config.headers.authorization).toBe(REDACTED);
  });

  it("reaches stack-frame locals and breadcrumb data, which array indices do not push out of range", () => {
    const scrubbed = scrubEvent(errorEvent());

    expect(scrubbed.exception.values[0]?.stacktrace.frames[0]?.vars.token).toBe(REDACTED);
    expect(scrubbed.breadcrumbs[0]?.data.cookie).toBe(REDACTED);
  });

  it("matches a key name regardless of case, hyphens, or underscores", () => {
    const scrubbed = scrubEvent({
      extra: { "X-API-Key": SECRET, Api_Key: SECRET, REFRESHTOKEN: SECRET },
    });

    expect(Object.values(scrubbed.extra)).toEqual([REDACTED, REDACTED, REDACTED]);
  });

  it("leaves everything it does not recognise exactly as it found it", () => {
    const scrubbed = scrubEvent(errorEvent());

    expect(scrubbed.event_id).toBe("e_1");
    expect(scrubbed.request.url).toBe("https://example.test/orders");
    expect(scrubbed.exception.values[0]?.type).toBe("AppError");
  });
});

describe("purity", () => {
  it("returns a new object and leaves the input untouched", () => {
    const event = errorEvent();
    const scrubbed = scrubEvent(event);

    expect(scrubbed).not.toBe(event);
    expect(event.request.headers.authorization).toBe(SECRET);
  });
});

describe("failing closed", () => {
  it("throws rather than returning a partially scrubbed event", () => {
    const event = errorEvent();
    Object.defineProperty(event.extra, "token", {
      configurable: true,
      enumerable: true,
      get() {
        throw new Error("malformed event");
      },
    });

    expect(() => scrubEvent(event)).toThrow("malformed event");
  });

  it("throws on a value that is not an object, so a caller cannot send it unscrubbed", () => {
    expect(() => scrubEvent(null)).toThrow(TypeError);
    expect(() => scrubEvent("not an event")).toThrow(TypeError);
  });
});

describe("the key-name list", () => {
  // Asserted on the export *names*, because asserting on the values cannot see a
  // list that is closed over rather than returned. A later ticket adding an
  // export to this module has to come back and say so here, which is the point:
  // what this module publishes is a decision, not a side effect.
  it("is not exported from the package", () => {
    expect(Object.keys(redactionModule).toSorted()).toEqual([
      "REDACTED",
      "isRedactedKey",
      "redactionPaths",
      "scrubEvent",
      "scrubOrDrop",
    ]);
  });

  it("cannot be reached through the one export that could leak it", () => {
    const echoed = scrubEvent({ extra: { note: "authorization" } });

    expect(echoed.extra.note).toBe("authorization");
  });
});

describe("what @repo/observability derives from the list without receiving it", () => {
  it("answers the shared question through isRedactedKey, in any spelling", () => {
    expect(isRedactedKey("authorization")).toBe(true);
    expect(isRedactedKey("Authorization")).toBe(true);
    expect(isRedactedKey("API_KEY")).toBe(true);
    expect(isRedactedKey("x-api-key")).toBe(true);
    expect(isRedactedKey("orderId")).toBe(false);
  });

  it("generates pino paths at the roots the caller names, to the same depth as the walk", () => {
    const paths = redactionPaths(["err", "context"]);

    expect(paths).toContain("err.authorization");
    expect(paths).toContain("err.*.*.*.authorization");
    expect(paths).toContain("context.api_key");
    // Depth 4 is the last level, so a fourth wildcard would be out of range.
    expect(paths).not.toContain("err.*.*.*.*.authorization");
    expect(paths.every((path) => path.startsWith("err.") || path.startsWith("context."))).toBe(
      true,
    );
  });

  // This is NFR10's actual property: not "the two consumers hold the same array"
  // — they never see an array — but "the two matchers agree about one input".
  it("agrees with the walker on every name it generates a path for", () => {
    for (const path of redactionPaths(["err"])) {
      const leaf = path.split(".").at(-1) ?? "";

      expect(isRedactedKey(leaf)).toBe(true);
      expect(scrubEvent({ extra: { [leaf]: "SENTINEL" } }).extra[leaf]).toBe(REDACTED);
    }
  });

  // Stated rather than claimed away: a caller can recover the spellings from a
  // generated path by stripping the root, and the parity test above does exactly
  // that. What "not exported" buys is narrower than "unknowable" — it is that no
  // *constant* is published, so there is nothing a downstream project can import,
  // pin, filter, or spread, and adding a name to the list breaks nobody.
  it("publishes no constant to pin, and no derivation that works without a root", () => {
    for (const exported of Object.values(redactionModule)) {
      expect(Array.isArray(exported)).toBe(false);
    }

    expect(redactionPaths([])).toEqual([]);
    expect(isRedactedKey("")).toBe(false);
  });
});

describe("scrubOrDrop", () => {
  it("returns the scrubbed payload when the event is well formed", () => {
    expect(scrubOrDrop({ extra: { token: "SENTINEL" } })).toEqual({ extra: { token: REDACTED } });
  });

  /**
   * The whole reason this wrapper exists rather than being written out at each
   * hook: `scrubEvent` fails closed, and the caller's only safe response is to
   * drop. Three hooks on each of two inits is six chances to write the `catch`
   * wrong, and a `catch` that returns the payload sends it unscrubbed.
   */
  it("drops the payload rather than passing it through when scrubbing throws", () => {
    expect(scrubOrDrop("not an event")).toBeNull();
  });

  it("drops rather than throwing, because a hook that throws is an unhandled rejection", () => {
    expect(() => scrubOrDrop(null)).not.toThrow();
  });
});
