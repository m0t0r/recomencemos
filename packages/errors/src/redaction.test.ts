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
// sufficient. The list is advisory, and it is extended in place as this product
// learns of a field worth scrubbing.
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
  // The parsed cookie map's own key. It is a carrier name rather than a value
  // name, and it is on this fixture so the sweeps below reach it in every hook
  // shape — not only at `request.cookies`, which is where the cases further down
  // exercise it.
  "cookies",
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
  "url.query",
  "url.fragment",
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

    expect(paths).toContain('err["url.query"]');
    expect(paths).toContain('err.*.*.*["http.fragment"]');
    expect(paths).not.toContain("err.url.query");
    // The ordinary form is unchanged by the segment split, at every level.
    expect(paths).toContain("err.authorization");
    expect(paths).toContain("err.*.*.*.authorization");
  });

  // Stated rather than claimed away: a caller can recover the spellings from a
  // generated path by stripping the root, and the parity test above does exactly
  // that. What "not exported" buys is narrower than "unknowable" — it is that no
  // *constant* is published, so there is nothing anyone else can import, pin,
  // filter, or spread, and adding a name to the list breaks nobody.
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
      extra: {
        note: prose,
        empty: "",
        // All three would be truncated by a relative-URL rule with no anchor.
        question: "really?",
        sentence: "what? no.",
        method: "GET /verificar?page=2",
      },
    });

    expect(scrubbed.extra.note).toBe(prose);
    expect(scrubbed.extra.empty).toBe("");
    expect(scrubbed.extra.question).toBe("really?");
    expect(scrubbed.extra.sentence).toBe("what? no.");
    expect(scrubbed.extra.method).toBe("GET /verificar?page=2");
  });

  /**
   * A fetch breadcrumb records the URL the caller passed rather than the one the
   * SDK resolved (`fetch.js:197`), so a relative reference reaches a processor
   * with its query attached. `new URL` throws on one, so an absolute-only branch
   * left criterion 1 unsatisfied for exactly the shape a browser produces.
   */
  it("reduces a path-absolute reference, which is what a fetch breadcrumb records", () => {
    const scrubbed = scrubEvent({
      breadcrumbs: [{ category: "fetch", data: { url: `/api/verificar?token=${SECRET}` } }],
      extra: { fragment: `/perfil#access_token=${SECRET}`, clean: "/perfil/42" },
    });

    expect(scrubbed.breadcrumbs[0]?.data.url).toBe("/api/verificar");
    expect(scrubbed.extra.fragment).toBe("/perfil");
    expect(scrubbed.extra.clean).toBe("/perfil/42");
  });

  /**
   * `new URL` accepts any scheme, and some of the ones it accepts are how a
   * processor resolves a stack frame to source. Rewriting those breaks
   * symbolication and shifts grouping while looking like a redaction win, so the
   * class is bounded to the schemes a request actually travels over.
   */
  it("leaves a scheme nobody fetches a credential over alone", () => {
    const scrubbed = scrubEvent({
      extra: {
        bundler: "webpack-internal:///(app-pages-browser)/./components/x.tsx?ba1e",
        turbopack: "turbopack:///[project]/app/page.tsx?ff00",
        windows: String.raw`C:\Users\v\x?a=1`,
        mail: "mailto:hola@recomencemos.test?subject=hola",
        websocket: `wss://recomencemos.test/socket?token=${SECRET}`,
      },
    });

    expect(scrubbed.extra.bundler).toBe(
      "webpack-internal:///(app-pages-browser)/./components/x.tsx?ba1e",
    );
    expect(scrubbed.extra.turbopack).toBe("turbopack:///[project]/app/page.tsx?ff00");
    expect(scrubbed.extra.windows).toBe(String.raw`C:\Users\v\x?a=1`);
    expect(scrubbed.extra.mail).toBe("mailto:hola@recomencemos.test?subject=hola");
    // ...and a websocket URL is one a credential does travel over.
    expect(scrubbed.extra.websocket).toBe("wss://recomencemos.test/socket");
  });

  /**
   * The reduction rides the carrier walk rather than taking one of its own, so
   * it answers for the region of the event where *data* lives. A stack frame's
   * `abs_path` is not data — it is what Sentry symbolicates by, and its query is
   * a bundler's cache key. `vars` on the same frame **is** data, and is a carrier.
   */
  it("does not touch the frame fields a processor resolves source with", () => {
    const scrubbed = scrubEvent({
      exception: {
        values: [
          {
            stacktrace: {
              frames: [
                {
                  abs_path: "http://localhost:3000/_next/static/chunks/app/page.js?v=173",
                  filename: "webpack-internal:///./app/page.tsx?ba1e",
                  vars: { href: `https://recomencemos.test/v?token=${SECRET}` },
                },
              ],
            },
          },
        ],
      },
      culprit: "app/page.tsx?ba1e",
    });

    const frame = scrubbed.exception.values[0]?.stacktrace.frames[0];

    expect(frame?.abs_path).toBe("http://localhost:3000/_next/static/chunks/app/page.js?v=173");
    expect(frame?.filename).toBe("webpack-internal:///./app/page.tsx?ba1e");
    expect(scrubbed.culprit).toBe("app/page.tsx?ba1e");
    expect(frame?.vars.href).toBe("https://recomencemos.test/v");
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

  // `url.query` is the spelling the installed code *emits*
  // (`getHttpSpanDetailsFromUrlObject`, `utils/url.js:68`); `http.query` is
  // `SanitizedRequestData`'s. Covering only the second was the miss review found.
  it("redacts both spellings, on a span and on a breadcrumb", () => {
    const scrubbed = scrubEvent({
      spans: [
        { op: "http.client", data: { "url.query": `?token=${SECRET}`, "url.path": "/verificar" } },
      ],
      breadcrumbs: [
        {
          category: "fetch",
          data: { "http.query": `?token=${SECRET}`, "url.fragment": `#t=${SECRET}` },
        },
      ],
      contexts: { trace: { data: { "url.query": `?token=${SECRET}` } } },
    });

    expect(scrubbed.spans[0]?.data["url.query"]).toBe(REDACTED);
    expect(scrubbed.breadcrumbs[0]?.data["http.query"]).toBe(REDACTED);
    expect(scrubbed.breadcrumbs[0]?.data["url.fragment"]).toBe(REDACTED);
    expect(scrubbed.contexts.trace.data["url.query"]).toBe(REDACTED);
    // Where the request went is the half NFR19 keeps.
    expect(scrubbed.spans[0]?.data["url.path"]).toBe("/verificar");
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

  /**
   * `MAX_DEPTH` is counted from the carrier root, so naming `request` did not
   * subsume `request.headers` — it moved every header one level down and quietly
   * stopped redacting the deepest of them. Review caught it as a narrowing of
   * NFR18. Both roots are listed for this, and this case is what says so.
   *
   * This used to make the same assertion about `request.cookies`. It no longer
   * can, and that is the fix rather than a regression: the parsed cookie map is
   * now collapsed by its own key before the walk can descend into it, so there
   * is no depth under it left to budget. The case below is what replaced that
   * half.
   */
  it("keeps the full depth budget under headers, which the broad root shortens", () => {
    const scrubbed = scrubEvent({
      request: {
        headers: { a: { b: { c: { token: SECRET } } } },
      },
    });

    expect(scrubbed.request.headers.a.b.c.token).toBe(REDACTED);
  });
});

/**
 * The parsed cookie map is a **carrier**, not a value, and that distinction is
 * the whole of the bug it replaced. `request.headers.cookie` is one string under
 * a name the list holds, so it was redacted; beside it the SDK writes the same
 * cookies again as a parsed record whose *keys are cookie names*. The walk
 * descended and tested each name — `__Secure-better-auth.session_token` is not
 * `cookie` — and every value came out intact.
 *
 * Redacting it by its own key is what makes the fix independent of which cookies
 * this product happens to set: the map collapses whole, so the fifth cookie name
 * somebody adds later cannot defeat it.
 */
describe("the parsed cookie map beside the cookie header", () => {
  it("collapses the whole map by its own key, whatever the cookies inside are called", () => {
    const scrubbed = scrubEvent({
      request: {
        cookies: {
          "__Secure-better-auth.session_token": SECRET,
          // Deliberately not one of the four this product sets today. A fix
          // keyed to today's names would pass the line above and fail here.
          "a-cookie-nobody-has-invented-yet": SECRET,
        },
      },
    });

    expect(scrubbed.request.cookies).toBe(REDACTED);
    expect(JSON.stringify(scrubbed)).not.toContain(SECRET);
  });

  it("still redacts the raw cookie header, which was never the half that leaked", () => {
    const scrubbed = scrubEvent({
      request: { headers: { cookie: SECRET }, cookies: { session_token: SECRET } },
    });

    expect(scrubbed.request.headers.cookie).toBe(REDACTED);
    expect(scrubbed.request.cookies).toBe(REDACTED);
  });
});

/**
 * The one route this product serves a credential in a path segment on.
 *
 * `reduceUrl` takes a URL apart by class and drops the query, the fragment and
 * userinfo — the three positions a credential normally occupies. A path segment
 * is the fourth, and it was out of reach by design: a path is where the request
 * went, which is the half worth keeping, and no scanner can tell a reset token
 * from an order id. ADR-0006 is why nothing here guesses.
 *
 * What makes this route different is that it needs no guessing. The security
 * policy enumerates it, by name, as the single sanctioned credential-in-a-path
 * route — so reducing exactly it is what "name the exposure" means rather than a
 * breach of it.
 *
 * The token is reduced at the reporting egress only. What the request-completion
 * line writes to stdout is unchanged and deliberately so: that exposure is sized
 * and accepted in the security policy, and the go-live runbook's drain step is
 * what bounds it.
 */
describe("the one enumerated credential-bearing route", () => {
  const TOKEN = "PLACEHOLDER0000000000000000000000";
  const REDUCED = "/admin/enrol/[token]";

  it("reduces the token segment of an absolute URL", () => {
    const scrubbed = scrubEvent({
      request: { url: `https://recomencemos.test/admin/enrol/${TOKEN}` },
    });

    expect(scrubbed.request.url).toBe(`https://recomencemos.test${REDUCED}`);
  });

  it("reduces a path-absolute reference, which is what a fetch breadcrumb records", () => {
    const scrubbed = scrubEvent({
      breadcrumbs: [{ data: { url: `/admin/enrol/${TOKEN}` } }],
    });

    expect(scrubbed.breadcrumbs[0]?.data.url).toBe(REDUCED);
  });

  it("reduces a bare path, which is the shape a span attribute carries", () => {
    const scrubbed = scrubEvent({
      spans: [{ data: { "url.path": `/admin/enrol/${TOKEN}` } }],
    });

    expect(scrubbed.spans[0]?.data["url.path"]).toBe(REDUCED);
  });

  /**
   * All three shapes again, each carrying a query — the combination is what
   * exercises the ordering inside `reduceUrl`, where the route replacement runs
   * ahead of the guard that would otherwise return a clean string unparsed, and
   * ahead of the two branches that cut a query off.
   */
  it("reduces the path and drops the query when an absolute URL carries both", () => {
    const scrubbed = scrubEvent({
      request: { url: `https://recomencemos.test/admin/enrol/${TOKEN}?next=/admin` },
    });

    expect(scrubbed.request.url).toBe(`https://recomencemos.test${REDUCED}`);
  });

  it("reduces the path and drops the query on a path-absolute reference", () => {
    const scrubbed = scrubEvent({
      breadcrumbs: [{ data: { url: `/admin/enrol/${TOKEN}?next=/admin` } }],
    });

    expect(scrubbed.breadcrumbs[0]?.data.url).toBe(REDUCED);
  });

  it("reduces the path and drops the fragment on a bare path", () => {
    const scrubbed = scrubEvent({
      spans: [{ data: { "url.path": `/admin/enrol/${TOKEN}#recovery` } }],
    });

    expect(scrubbed.spans[0]?.data["url.path"]).toBe(REDUCED);
  });

  /**
   * The finding's own reproduction, kept as a case. An invalid token is
   * `notFound()` before the page renders, so any event from a rendered enrolment
   * page carries a **live** token — and it arrives by four independent carriers,
   * three of which need no error at all.
   */
  it("leaves the token in none of the carriers one event can hold it in", () => {
    const url = `https://recomencemos.test/admin/enrol/${TOKEN}`;
    const scrubbed = scrubEvent({
      request: { url },
      contexts: {
        nextjs: { request_path: `/admin/enrol/${TOKEN}` },
        trace: { data: { "url.full": url, "url.path": `/admin/enrol/${TOKEN}` } },
      },
      spans: [{ data: { "url.full": url } }],
      breadcrumbs: [{ data: { url } }],
    });

    expect(JSON.stringify(scrubbed)).not.toContain(TOKEN);
    // Reduced rather than dropped: which route the request reached is the half
    // worth keeping, and an event with no path at all is one nobody can triage.
    expect(scrubbed.contexts.nextjs.request_path).toBe(REDUCED);
  });

  it("reduces a Referer that is itself an enrolment URL, which is the browser's carrier", () => {
    const scrubbed = scrubEvent({
      request: { headers: { Referer: `https://recomencemos.test/admin/enrol/${TOKEN}` } },
    });

    expect(scrubbed.request.headers.Referer).toBe(`https://recomencemos.test${REDUCED}`);
  });

  it("is idempotent, so an already-reduced path survives a second pass unchanged", () => {
    const scrubbed = scrubEvent({ request: { url: REDUCED } });

    expect(scrubbed.request.url).toBe(REDUCED);
  });

  it("leaves a path that merely resembles the route alone", () => {
    const scrubbed = scrubEvent({
      request: { url: "https://recomencemos.test/admin/enrolments" },
      spans: [{ data: { "url.path": "/admin/enrol" } }],
    });

    expect(scrubbed.request.url).toBe("https://recomencemos.test/admin/enrolments");
    expect(scrubbed.spans[0]?.data["url.path"]).toBe("/admin/enrol");
  });

  it("returns every other route byte-identical, which the whole module depends on", () => {
    const paths = [
      "https://recomencemos.test/",
      "https://recomencemos.test/perfil/abc",
      "/wall",
      "/orders/42",
      "not a url at all",
    ];

    for (const url of paths) {
      expect(scrubEvent({ request: { url } }).request.url).toBe(url);
    }
  });
});

/**
 * A log envelope is the fourth egress, and it was the one with no hook in front
 * of it at all. The server init forwards pino's lines to the reporting platform,
 * and those route through `beforeSendLog` rather than `beforeSend` — so the
 * request-completion line, `context.path` and all, reached the vendor without
 * ever meeting this module.
 *
 * The shape asserted here is the one the SDK hands the hook: a flat `attributes`
 * record, built as `{ ...beforeLog, attributes: processedLogAttributes }` before
 * the serializer reshapes it into the wire format.
 */
describe("a log envelope, which reaches its own hook and not beforeSend", () => {
  it("scrubs attributes, the carrier a forwarded log line puts its fields in", () => {
    const scrubbed = scrubEvent({
      level: "info",
      message: "request complete",
      attributes: {
        "context.path": "/admin/enrol/PLACEHOLDER0000000000000000000000",
        authorization: SECRET,
        route: "/admin/enrol/[token]",
      },
    });

    expect(scrubbed.attributes["context.path"]).toBe("/admin/enrol/[token]");
    expect(scrubbed.attributes.authorization).toBe(REDACTED);
    expect(scrubbed.attributes.route).toBe("/admin/enrol/[token]");
  });
});
