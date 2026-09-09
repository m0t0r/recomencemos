/**
 * The shared redaction vocabulary, and the matcher the reporting platform
 * derives from it.
 *
 * It lives in this package rather than beside the logger because there are three
 * consumers and one of them is a browser module that may not import a
 * server-only package. A scrubber the client cannot reach is a redaction list
 * that disagrees with itself by construction.
 */

/** The one placeholder. Every consumer substitutes this exact string. */
export const REDACTED = "[redacted]";

/**
 * The shipped key names, **not** exported.
 *
 * Parity between the consumers is proved by running them over one input, never
 * by exporting a constant something else could pin — an exported list is a shape
 * you can no longer change, and redaction lists only ever grow. What this module
 * publishes instead are two *derivations*: {@link isRedactedKey} and
 * {@link redactionPaths}. Both hand over the decision without handing over the
 * list.
 *
 * What that buys is narrower than secrecy, and worth stating plainly:
 * {@link redactionPaths} necessarily reveals the spellings to anyone who strips
 * a generated path. The guarantee is that no *constant* is published — there is
 * nothing to import, pin, filter or spread, so adding a name breaks nobody.
 *
 * The list is **advisory**. It is a floor, raised in place as this product
 * learns of a field worth scrubbing, and no test asserts that these names are
 * sufficient, because asserting that would encode a guarantee nobody can make.
 * What the tests assert is that the mechanism works on the names that ship.
 *
 * Stored as **literal spellings**, not normalised, because the two derived
 * matchers need different things from them — see {@link redactionPaths}.
 */
const REDACTED_KEY_SPELLINGS: readonly string[] = [
  "authorization",
  "auth",
  "cookie",
  "set-cookie",
  // The **parsed** cookie map, which travels beside the raw header rather than
  // inside it. Every name above is the name of a *value*; this one is the name
  // of a *carrier*, and it is listed for exactly that reason.
  //
  // `request.headers.cookie` is one string under a name this list already held,
  // so it was redacted. Beside it the SDK writes the same cookies again as a
  // record whose **keys are cookie names** — and the walk descended into it and
  // tested each name, none of which is `cookie`. Every value came out intact,
  // on error and transaction events alike.
  //
  // Naming the carrier is what makes the fix independent of which cookies this
  // product sets: the map collapses whole, so the next cookie name somebody adds
  // cannot defeat it. It is also why {@link CARRIER_PATHS} no longer needs a
  // `request.cookies` root: that entry existed to keep the depth budget under a
  // map this now never descends into.
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
  // NFR19's sweep, read out of `@sentry/core@10.70.0` rather than recalled. A
  // query string does not only travel *inside* a URL, and {@link reduceUrl}
  // closes only the URL — these close the half the SDK moves out of it:
  //
  // - `query_string` is `RequestEventData`, typed
  //   `string | Record | Array<[string, string]>`, so the whole value goes
  //   whichever of the three shapes it arrives in.
  // - `url.query` / `url.fragment` are what the installed code **emits**:
  //   `getHttpSpanDetailsFromUrlObject` sets them from `search` and `hash` on
  //   every http span, `server` and `client` kind alike (`utils/url.js:68,71`).
  // - `http.query` / `http.fragment` are `SanitizedRequestData`, the other
  //   spelling, carried by an `http` breadcrumb.
  //
  // Both spellings are listed because both are reachable and neither is
  // expensive; taking the emitted one alone would have made this list track a
  // vendor's refactor. `url.path`, `url.scheme` and `url.port` are deliberately
  // absent — they are where the request went, which is the half NFR19 keeps.
  "query_string",
  "url.query",
  "url.fragment",
  "http.query",
  "http.fragment",
];

/**
 * One name, however it was spelled. `api_key`, `apiKey`, and `X-Api-Key` are the
 * same secret wearing three casings, and a list that had to enumerate all three
 * would be wrong the first time someone invented a fourth.
 */
function normaliseKey(key: string): string {
  return key.toLowerCase().replaceAll("-", "").replaceAll("_", "");
}

const REDACTED_KEY_LOOKUP: ReadonlySet<string> = new Set(REDACTED_KEY_SPELLINGS.map(normaliseKey));

/**
 * The shared decision, without the list.
 *
 * This is the derivation a consumer should reach for first: it cannot be pinned,
 * spread, or filtered the way an exported array can, and it carries the
 * normalisation with it, so every consumer agrees on what counts as the same
 * name.
 */
export function isRedactedKey(key: string): boolean {
  return REDACTED_KEY_LOOKUP.has(normaliseKey(key));
}

const MAX_DEPTH = 4;

/**
 * Where a secret can be, expressed once. `*` is "every element of this array".
 *
 * A Sentry payload holds the same value under several namespaces depending on
 * how it got there, and the three hook shapes do not agree on the roots:
 * `beforeBreadcrumb` receives a bare breadcrumb whose carrier is top-level
 * `data`, while `beforeSendTransaction` brings `spans`. All three are listed, so
 * one scrubber serves every hook.
 *
 * `request` is named **as well as** `request.headers`, and the apparent
 * redundancy is load-bearing. The narrow root alone was narrower than the SDK —
 * `RequestEventData` also carries `query_string` and `data`, the request body, so
 * a name on the shipped list could sit directly on `request` and be out of the
 * walk's reach at the same time. But the broad root does **not** subsume it,
 * because {@link MAX_DEPTH} is counted *from the carrier root*: reached through
 * `["request"]`, a header is already one level down, and
 * `request.headers.a.b.c.token` stops being redacted. Review caught that as a
 * silent narrowing of NFR18, so both are listed and the subtree is walked twice.
 * The second walk sees an already-scrubbed copy, so the two compose to the union
 * of their reach rather than fighting.
 *
 * **`request.cookies` is deliberately not a third root.** It was one, for the
 * depth-budget reason above. It stopped being able to do anything the moment
 * `cookies` joined the key list: the `["request"]` walk now collapses the whole
 * map to a string on sight, so a second walk into it reaches a string and returns
 * it unchanged. An entry that cannot fire is worse than no entry, because it
 * reads as though the map were still being walked.
 *
 * **What key names cannot reach**: a secret in a URL rather than under a key —
 * `request.url` holding `?token=…`. Matching by key name structurally cannot see
 * it, because the key is innocuous and the secret is inside the value. That is
 * {@link reduceUrl}'s job, and it is a second pass rather than an entry here for
 * exactly that reason: adding `["request","url"]` to this list would walk to a
 * string and hand it to {@link scrubBranch}, which returns any non-record
 * unchanged. It would have shipped green and checked nothing.
 */
const CARRIER_PATHS: readonly (readonly string[])[] = [
  ["data"],
  ["request"],
  ["request", "headers"],
  ["contexts"],
  ["extra"],
  ["tags"],
  ["breadcrumbs", "*", "data"],
  ["spans", "*", "data"],
  ["exception", "values", "*", "stacktrace", "frames", "*", "vars"],
  // A **log envelope**, which is not an event and does not reach `beforeSend`.
  // The server init forwards pino's lines to the reporting platform, and those
  // route through `beforeSendLog` — so before this entry the request-completion
  // line reached the vendor without ever meeting this module.
  //
  // The shape is the one the SDK hands that hook: a flat record, built as
  // `{ ...beforeLog, attributes: processedLogAttributes }` before the serializer
  // reshapes it into the wire format's `{ value, type }` pairs. An *event* has no
  // top-level `attributes`, so this entry costs the other three hooks nothing.
  ["attributes"],
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function scrubBranch(value: unknown, depth: number): unknown {
  // **{@link MAX_DEPTH} bounds this rule as well as the key rule, and the phrasing
  // below used to hide that.** A *container* at the depth limit is returned whole,
  // before any string inside it is visited — so a URL nested deeper than the
  // budget from its carrier root is not reduced either. Every carrier this module
  // is aimed at is a flat attribute map two or three levels from its root, so
  // nothing currently relies on reach it does not have; a carrier root added
  // deeper than that would silently stop being scrubbed, which is the reason this
  // is written down rather than left to be rediscovered.
  //
  // The second rule, and the only one in this module that reads a *value*
  // instead of a key. It rides the same walk rather than taking one of its own,
  // which is what keeps both rules answering for the same region of the event:
  // the carriers, where data lives. Outside them sit the SDK's own metadata --
  // `culprit`, `debug_meta`, and a stack frame's `abs_path` and `filename`,
  // which are URLs that a processor resolves to source rather than URLs anyone
  // fetched with a credential.
  if (typeof value === "string") {
    return reduceUrl(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => scrubBranch(item, depth));
  }

  if (!isRecord(value) || depth >= MAX_DEPTH) {
    return value;
  }

  const scrubbed: Record<string, unknown> = {};

  for (const [key, nested] of Object.entries(value)) {
    scrubbed[key] = isRedactedKey(key) ? REDACTED : scrubBranch(nested, depth + 1);
  }

  return scrubbed;
}

/**
 * The four schemes over which a request carrying a credential actually travels.
 *
 * Restricting to them is not tidiness. `new URL` accepts any scheme, so without
 * this a Windows path (`C:\\Users\\v\\x?a=1`), a `mailto:` with a subject, a
 * `data:` URI, and — the one that bites — a bundler's `webpack-internal:///…?hash`
 * or `turbopack:///…?hash` all parse and all get rewritten. Those last two are
 * how a processor resolves a stack frame to source, and reducing them breaks
 * symbolication and shifts grouping while looking like a redaction win.
 */
const FETCHED_SCHEMES: ReadonlySet<string> = new Set(["http:", "https:", "ws:", "wss:"]);

/**
 * A path-absolute reference — `/verify?token=…` — which is the shape a relative
 * URL takes on a fetch breadcrumb, where the SDK records what the caller passed
 * rather than what it resolved to (`fetch.js:197`, and `parseStringToURLObject`
 * handles relative input explicitly).
 *
 * Leading `/`, no whitespace, and a `?` or `#` somewhere after. All three
 * clauses earn their place: without the anchor, `GET /orders?page=2` and
 * `what? no.` both parse as relative references and get truncated, which is
 * prose destroyed to remove a query that was never there.
 */
const PATH_ABSOLUTE_WITH_QUERY = /^\/\S*[?#]/;

/**
 * The **one** route this product serves a credential in a path segment on, and
 * the only path this module rewrites.
 *
 * A path is normally where the request *went*, which is the half worth keeping —
 * so `url.path`, `url.scheme` and `url.port` are deliberately absent from the key
 * list above. This route is the recorded exception: `secrets-in-url-paths` in
 * `docs/policy/security.md` is `yes` for `GET /admin/enrol/[token]`, one route,
 * named and bounded, and an invalid token is `notFound()` before the page
 * renders — so any event from a *rendered* enrolment page carries a **live**
 * token by construction.
 *
 * **This is not the heuristic [ADR-0006](../../../docs/adr/0006-name-the-exposure-rather-than-ship-a-heuristic.md)
 * refuses.** That ADR refuses a rule that cannot tell a reset token from an order
 * id and would also land on `/orders/42`. This matches one enumerated literal
 * prefix and nothing else; naming the exposure is precisely what it asks for. A
 * second such route is a decision to take deliberately, not a pattern to widen
 * here.
 *
 * The capture group keeps the prefix so the replacement cannot move the path
 * somewhere else, and `[^/?#]+` stops at the segment boundary so a query, a
 * fragment and any deeper segment are left for the rest of {@link reduceUrl} to
 * handle. It is idempotent: re-running it over `/admin/enrol/[token]` reproduces
 * the same string.
 *
 * **Case-insensitive, and tolerant of a repeated slash, because a scrubber's job
 * is what the app did not intend.** Next routes case-sensitively and the page
 * only validates a token reached by the exact segment, so this app cannot emit
 * `/Admin/Enrol/…` or `/admin/enrol//…` for a *live* token — both were shown to
 * pass through byte-identical before this. That made it a hardening note rather
 * than a finding, and it is closed anyway: the whole value of a control at the
 * egress is that it does not depend on the emitter being well behaved. The
 * capture group replays whatever it matched, so neither the original casing nor
 * a doubled slash is rewritten anywhere else in the string.
 *
 * **Only the reporting egress reduces this.** The request-completion line still
 * writes the token to stdout under `context.path`; that exposure is sized and
 * accepted in the security policy, and the go-live runbook's drain step is what
 * bounds it. Reducing it here and not there is the difference between the two
 * sinks, not an inconsistency.
 */
const ENROLMENT_TOKEN_SEGMENT = /(\/admin\/enrol\/+)[^/?#]+/gi;

/**
 * Everything a URL can carry beyond where it points, removed — by class, not by
 * the name of the key holding it.
 *
 * The class is "a string that is wholly a URL": absolute with a fetched scheme,
 * or a path-absolute reference. What comes off is the query, the fragment, and
 * userinfo. The fragment is not decoration — an OAuth provider returns
 * `#access_token=…` there, so dropping the query alone would leave the
 * second-most-likely credential position open. Userinfo is the third:
 * `https://admin:hunter2@host/` is a credential in a URL wearing neither a query
 * nor a key.
 *
 * A path segment is the fourth position, and it is handled for exactly one
 * enumerated route rather than by class — see {@link ENROLMENT_TOKEN_SEGMENT},
 * which is also where the reason that is not a heuristic is written down.
 *
 * **A URL with nothing to remove comes back byte-identical**, not merely
 * equivalent. `new URL(…).toString()` normalises — it appends the root path to a
 * bare origin, lowercases the host, drops a default port — so re-serialising
 * unconditionally would put a diff on every clean URL in every event. The guard
 * is the four emptiness checks, and it is load-bearing rather than an
 * optimisation. The relative branch never serialises at all: it cuts the
 * original string, which is what `@repo/observability`'s `pathnameOf` does with
 * the same input, so the two egresses reduce a path the same way.
 *
 * **"Nothing to remove" now means the enrolment route too**, and that is the one
 * way the guarantee above narrowed: a string carrying that route comes back
 * changed even when it holds no query, no fragment and no userinfo. Every other
 * string in an event is untouched, which is what the byte-identical cases in the
 * suite pin.
 *
 * **The residues, named rather than guessed at.** A URL *embedded* in a longer
 * string — a message reading `fetch failed for https://…?token=…` — keeps its
 * query, and so does a relative reference that does not start with `/`. No
 * scanner can tell a link in an error message from a link that is a credential,
 * and any bound that caught the second would mangle the first.
 * [ADR-0006](../../../docs/adr/0006-name-the-exposure-rather-than-ship-a-heuristic.md)
 * is the precedent for writing the gap down here rather than shipping the
 * heuristic that half-closes it.
 *
 * The enrolment route is the exception on this axis as well, and deliberately:
 * it is reduced wherever it appears, embedded in prose included, because
 * replacing one enumerated segment destroys none of the surrounding message the
 * way truncating at a `?` would.
 */
function reduceUrl(value: string): string {
  // The enumerated route first, and on the raw string rather than on a parsed
  // path. One rule then covers every shape the carriers actually use — an
  // absolute URL, a path-absolute reference, and the bare path a span attribute
  // holds — and it covers them whether or not a query is present, which the
  // guard below would otherwise return before.
  const reduced = value.replace(ENROLMENT_TOKEN_SEGMENT, "$1[token]");

  // Nothing a URL carries beyond its destination can be present without one of
  // these three characters, so the overwhelming majority of strings in an event
  // leave here without being parsed at all.
  if (!reduced.includes("?") && !reduced.includes("#") && !reduced.includes("@")) {
    return reduced;
  }

  if (PATH_ABSOLUTE_WITH_QUERY.test(reduced)) {
    return reduced.split(/[?#]/, 1)[0] ?? reduced;
  }

  let url: URL;

  try {
    url = new URL(reduced);
  } catch {
    return reduced;
  }

  if (!FETCHED_SCHEMES.has(url.protocol)) {
    return reduced;
  }

  if (url.search === "" && url.hash === "" && url.username === "" && url.password === "") {
    return reduced;
  }

  url.search = "";
  url.hash = "";
  url.password = "";
  url.username = "";

  return url.toString();
}

function scrubAtPath(node: unknown, path: readonly string[]): unknown {
  const [head, ...rest] = path;

  if (head === undefined) {
    return scrubBranch(node, 0);
  }

  if (head === "*") {
    return Array.isArray(node) ? node.map((item) => scrubAtPath(item, rest)) : node;
  }

  if (!isRecord(node) || !(head in node)) {
    return node;
  }

  return { ...node, [head]: scrubAtPath(node[head], rest) };
}

/**
 * The **pino** derivation: literal `redact.paths` strings, generated at the
 * roots the caller names, to the same {@link MAX_DEPTH} the walk uses.
 *
 * `roots` is what makes this a derivation rather than a second list. The logger
 * knows the shape of the object it logs — `err`, `context`, `req.headers` — and
 * this module knows the names. Neither has to learn the other's half.
 *
 * **Two things the caller must know**, because they are properties of pino's
 * matcher and not of this list:
 *
 * 1. **Paths are literal.** `fast-redact` compiles a string, so it matches the
 *    exact spelling. {@link isRedactedKey} normalises and would catch
 *    `Api-Key`; a generated path for `api_key` will not. The two matchers agree
 *    on the *names* by construction and diverge on *spelling variants* — which
 *    is why the shipped list carries the common spellings explicitly, and why a
 *    logger that wants the normalising behaviour should pass a censor built on
 *    {@link isRedactedKey} rather than rely on paths alone.
 * 2. **Multiple wildcards per path are unverified here.** Reaching depth 4
 *    requires `root.*.*.*.name`, and `pino` is not a dependency of this package,
 *    so nothing in this repo has yet run `fast-redact` over that shape. The
 *    consuming package must confirm it — and if it does not hold, the fallback
 *    is a censor over {@link isRedactedKey}, which needs no path support at all.
 */
export function redactionPaths(roots: readonly string[], depth = MAX_DEPTH): readonly string[] {
  const paths: string[] = [];

  for (const root of roots) {
    for (let level = 0; level < depth; level++) {
      // The prefix is built with its own separators rather than assembled and
      // then patched, because the two segment forms need different ones and a
      // `.replace` over the finished string would hunt for the first `.[` in it
      // — which is only the right one for the roots this repository happens to
      // pass.
      const prefix =
        level === 0 ? root : `${root}.${Array.from({ length: level }, () => "*").join(".")}`;

      for (const spelling of REDACTED_KEY_SPELLINGS) {
        // A spelling carrying a dot is one key, not two. `err.url.query` tells
        // `fast-redact` to descend through a `url` object that does not exist;
        // `err["url.query"]` is the literal-key form.
        paths.push(spelling.includes(".") ? `${prefix}["${spelling}"]` : `${prefix}.${spelling}`);
      }
    }
  }

  return paths;
}

/**
 * Replaces every value held under a shipped key name with {@link REDACTED}.
 *
 * Pure, and typed structurally over the carrier keys rather than against the
 * SDK's `ErrorEvent` — which is what lets this package keep its empty dependency
 * list and serve `beforeSend`, `beforeSendTransaction`, and `beforeBreadcrumb`
 * from one implementation.
 *
 * **It fails closed.** A malformed event makes this throw rather than return a
 * half-scrubbed one, and because it builds a new object instead of mutating,
 * a throw leaves nothing partially processed behind. The caller's job is to drop
 * the event — `try { return scrubEvent(event) } catch { return null }` in a hook
 * — which sends nothing rather than sending something unscrubbed.
 */
export function scrubEvent<T>(event: T): T {
  if (!isRecord(event)) {
    throw new TypeError("scrubEvent expects an event object; refusing to pass the value through");
  }

  let scrubbed: unknown = { ...event };

  for (const path of CARRIER_PATHS) {
    scrubbed = scrubAtPath(scrubbed, path);
  }

  return scrubbed as T;
}

/**
 * `scrubEvent` with the caller's only safe response to a throw already applied.
 *
 * It lives here rather than beside each `Sentry.init` because there are **six**
 * hook wirings — three on the server init, three on the browser one — and a
 * `catch` written six times is a `catch` that eventually returns the payload
 * instead of `null`, which sends an unscrubbed event. One function is also what
 * keeps the two inits honest about being mirror images: the thing they most
 * need to agree on is the one thing neither of them now spells out.
 *
 * Isomorphic like the rest of this package, which is what lets the browser init
 * — forbidden from importing `@repo/observability` — use the same one.
 */
export function scrubOrDrop<T>(payload: T): T | null {
  try {
    return scrubEvent(payload);
  } catch {
    return null;
  }
}
