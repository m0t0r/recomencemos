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
  // The three the sweep for NFR19 found, read out of `@sentry/core@10.70.0`
  // rather than recalled. `query_string` is `RequestEventData`; `http.query` and
  // `http.fragment` are `SanitizedRequestData`, which is what an `http.client`
  // span and an `http` breadcrumb carry -- Sentry splits the query off the URL
  // into its own field, so reducing the URL alone would leave the half it moved.
  "query_string",
  "http.query",
  "http.fragment",
];

// A generated path ends either in a bare name or in a bracketed one; the
// bracketed form is why `split(".").at(-1)` is not enough any more.
function leafOf(path: string): string {
  return /\["(?<name>[^"]+)"\]$/.exec(path)?.groups?.name ?? path.split(".").at(-1) ?? "";
}

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
    // Rooted at a name the caller gave, and separated from it by either form:
    // `.` for an ordinary segment, `[` for a bracketed one.
    expect(
      paths.every((path) =>
        ["err", "context"].some(
          (root) => path.startsWith(`${root}.`) || path.startsWith(`${root}[`),
        ),
      ),
    ).toBe(true);
  });

  // This is NFR10's actual property: not "the two consumers hold the same array"
  // — they never see an array — but "the two matchers agree about one input".
  it("agrees with the walker on every name it generates a path for", () => {
    for (const path of redactionPaths(["err"])) {
      const leaf = leafOf(path);

      expect(isRedactedKey(leaf)).toBe(true);
      expect(scrubEvent({ extra: { [leaf]: "SENTINEL" } }).extra[leaf]).toBe(REDACTED);
    }
  });

  // A spelling carrying a dot is one key, not two, so its path is
  // `err["http.query"]` and not `err.http.query` -- the second means something
  // else to `fast-redact`, and it is the shape the naive template produces.
  it("emits a dotted spelling as one bracketed segment rather than as nesting", () => {
    const paths = redactionPaths(["err"]);

    expect(paths).toContain('err["http.query"]');
    expect(paths).toContain('err.*.*.*["http.fragment"]');
    expect(paths).not.toContain("err.http.query");
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

/**
 * NFR19. The magic-link token is the **only** key to a Worker's account and it
 * travels as a query parameter, so at `tracesSampleRate: 0.1` roughly one in ten
 * verify requests shipped its whole URL to a processor, and every error on that
 * route shipped it at 100%.
 *
 * These cases are written against the *class* rather than against `request.url`,
 * because the ticket's own criterion 1 — "`["request","url"]` as a carrier path"
 * — is a no-op: `CARRIER_PATHS` names roots to walk and the walk replaces values
 * held under a secret-named key, while here the key is innocuous and the secret
 * is inside the value. A case pinned to `request.url` would pass over an
 * implementation that still leaked every other URL-valued field.
 */
describe("a URL reaching a processor carries no query string", () => {
  const MAGIC_LINK = `https://recomencemos.test/verificar?token=${SECRET}&next=%2Fperfil`;

  it("keeps where the URL points and drops what it carries", () => {
    const scrubbed = scrubEvent({ request: { url: MAGIC_LINK } });

    expect(scrubbed.request.url).toBe("https://recomencemos.test/verificar");
  });

  it("drops the fragment too, which is where an OAuth token arrives", () => {
    const scrubbed = scrubEvent({
      request: { url: `https://recomencemos.test/callback#access_token=${SECRET}` },
    });

    expect(scrubbed.request.url).toBe("https://recomencemos.test/callback");
  });

  it("drops userinfo, which is a credential in a URL wearing neither a query nor a key", () => {
    const scrubbed = scrubEvent({
      request: { url: `https://admin:${SECRET}@recomencemos.test/health` },
    });

    expect(scrubbed.request.url).toBe("https://recomencemos.test/health");
  });

  // The class property, stated as a test: no case here names `request.url`, and
  // the implementation may not either.
  it("reduces a URL under any key, at any depth, in any of the hook shapes", () => {
    const scrubbed = scrubEvent({
      breadcrumbs: [{ category: "fetch", data: { href: MAGIC_LINK } }],
      spans: [{ op: "http.client", data: { "sentry.origin": MAGIC_LINK } }],
      exception: {
        values: [{ stacktrace: { frames: [{ vars: { deep: { nested: { at: MAGIC_LINK } } } }] } }],
      },
      contexts: { response: { location: MAGIC_LINK } },
    });

    const serialised = JSON.stringify(scrubbed);

    expect(serialised).not.toContain(SECRET);
    expect(scrubbed.breadcrumbs[0]?.data.href).toBe("https://recomencemos.test/verificar");
    expect(scrubbed.spans[0]?.data["sentry.origin"]).toBe("https://recomencemos.test/verificar");
    expect(scrubbed.exception.values[0]?.stacktrace.frames[0]?.vars.deep.nested.at).toBe(
      "https://recomencemos.test/verificar",
    );
    expect(scrubbed.contexts.response.location).toBe("https://recomencemos.test/verificar");
  });

  /**
   * The false-positive bound, and the reason it is drawn here.
   *
   * Only a string that parses **whole** as an absolute URL is reduced. Prose
   * that happens to contain a link is left alone, which leaves a residue: a URL
   * embedded in a message still carries its query. That residue is **named
   * rather than guessed at**, per
   * [ADR-0006](../../../docs/adr/0006-name-the-exposure-rather-than-ship-a-heuristic.md)
   * — no scanner can tell a link in an error message from a link in a
   * credential, and any bound that caught the second would mangle the first.
   */
  it("returns anything that is not wholly a URL byte-identical", () => {
    const prose = `fetch failed for https://recomencemos.test/verificar?token=${SECRET}`;
    const scrubbed = scrubEvent({
      extra: { note: prose, relative: "/verificar?token=abc", empty: "", question: "really?" },
      transaction: "GET /verificar",
    });

    expect(scrubbed.extra.note).toBe(prose);
    expect(scrubbed.extra.relative).toBe("/verificar?token=abc");
    expect(scrubbed.extra.empty).toBe("");
    expect(scrubbed.extra.question).toBe("really?");
    expect(scrubbed.transaction).toBe("GET /verificar");
  });

  // `new URL(...).toString()` normalises -- it appends the root path to a bare
  // origin, among other things. A URL with nothing to remove must come back the
  // same bytes rather than the same meaning, or every clean URL in every event
  // acquires a diff nobody asked for.
  it("does not normalise a URL that carries nothing to drop", () => {
    const scrubbed = scrubEvent({
      extra: { origin: "https://recomencemos.test", padded: "https://recomencemos.test/a/b" },
    });

    expect(scrubbed.extra.origin).toBe("https://recomencemos.test");
    expect(scrubbed.extra.padded).toBe("https://recomencemos.test/a/b");
  });
});

/**
 * The other two shapes the sweep found. Sentry does not only put a query inside
 * a URL: `RequestEventData.query_string` holds one on its own, and
 * `SanitizedRequestData` — what an `http.client` span and an `http` breadcrumb
 * carry — splits `http.query` and `http.fragment` off the URL into their own
 * fields. Reducing URLs alone would have moved the leak rather than closed it.
 */
describe("a query string travelling beside a URL rather than inside one", () => {
  it("redacts request.query_string in each of the three shapes its type allows", () => {
    const asString = scrubEvent({ request: { query_string: `token=${SECRET}` } });
    const asRecord = scrubEvent({ request: { query_string: { token: SECRET } } });
    const asPairs = scrubEvent({ request: { query_string: [["token", SECRET]] } });

    expect(asString.request.query_string).toBe(REDACTED);
    expect(asRecord.request.query_string).toBe(REDACTED);
    expect(asPairs.request.query_string).toBe(REDACTED);
  });

  it("redacts http.query and http.fragment on a span and on a breadcrumb", () => {
    const scrubbed = scrubEvent({
      spans: [{ op: "http.client", data: { "http.query": `?token=${SECRET}` } }],
      breadcrumbs: [{ category: "fetch", data: { "http.fragment": `#access_token=${SECRET}` } }],
    });

    expect(scrubbed.spans[0]?.data["http.query"]).toBe(REDACTED);
    expect(scrubbed.breadcrumbs[0]?.data["http.fragment"]).toBe(REDACTED);
  });

  // `request` was reachable only at `headers` and `cookies`, so a name sitting
  // directly on it was in the list and out of the walk's reach at the same time.
  it("reaches a secret sitting directly on request, not only under its two subtrees", () => {
    const scrubbed = scrubEvent({
      request: { url: "https://recomencemos.test/a", data: { password: SECRET }, auth: SECRET },
    });

    expect(scrubbed.request.auth).toBe(REDACTED);
    expect(scrubbed.request.data.password).toBe(REDACTED);
    expect(scrubbed.request.url).toBe("https://recomencemos.test/a");
  });
});
