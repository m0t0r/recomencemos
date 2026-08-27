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
 * by exporting a constant a downstream project would pin — an exported list is a
 * shape you can no longer change, and redaction lists only ever grow. What this
 * module publishes instead are two *derivations*: {@link isRedactedKey} and
 * {@link redactionPaths}. Both hand over the decision without handing over the
 * list.
 *
 * What that buys is narrower than secrecy, and worth stating plainly:
 * {@link redactionPaths} necessarily reveals the spellings to anyone who strips
 * a generated path. The guarantee is that no *constant* is published — there is
 * nothing to import, pin, filter or spread, so adding a name breaks nobody.
 *
 * The list is **advisory**. It is a floor a project raises, and no test asserts
 * that these names are sufficient, because asserting that would encode a
 * guarantee nobody can make. What the tests assert is that the mechanism works
 * on the names that ship.
 *
 * Stored as **literal spellings**, not normalised, because the two derived
 * matchers need different things from them — see {@link redactionPaths}.
 */
const REDACTED_KEY_SPELLINGS: readonly string[] = [
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
  // NFR19's sweep, read out of `@sentry/core@10.70.0` rather than recalled. A
  // query string does not only travel *inside* a URL: `RequestEventData` carries
  // `query_string` on its own (typed `string | Record | Array<[string, string]>`,
  // so the whole value goes whichever shape it arrives in), and
  // `SanitizedRequestData` — what an `http.client` span and an `http` breadcrumb
  // carry — is the SDK splitting `http.query` and `http.fragment` off the URL
  // into fields of their own. {@link reduceUrl} closes the URL; these close the
  // half the SDK moved out of it.
  "query_string",
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
 * `request` is named whole rather than at `headers` and `cookies`, which is what
 * the first two entries here used to be. Those two were narrower than the SDK:
 * `RequestEventData` also carries `query_string` and `data` — the request body —
 * so a name on the shipped list could sit directly on `request` and be out of the
 * walk's reach at the same time. The broader root subsumes both and costs one
 * level of the depth budget under `headers`, which is flat.
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
  ["contexts"],
  ["extra"],
  ["tags"],
  ["breadcrumbs", "*", "data"],
  ["spans", "*", "data"],
  ["exception", "values", "*", "stacktrace", "frames", "*", "vars"],
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function scrubBranch(value: unknown, depth: number): unknown {
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
 * A string is treated as a URL when it parses **whole** as an absolute one — a
 * scheme and everything after it, nothing before. That is the class, and it is
 * what makes this a general answer rather than a `request.url` special case.
 *
 * What it removes is everything a URL can carry beyond where it points: the
 * query, the fragment, and userinfo. The fragment is not decoration — an OAuth
 * provider returns `#access_token=…` there, so dropping the query alone would
 * leave the second-most-likely credential position open. Userinfo is the third:
 * `https://admin:hunter2@host/` is a credential in a URL wearing neither a query
 * nor a key.
 *
 * **A URL with nothing to remove comes back byte-identical**, not merely
 * equivalent. `new URL(…).toString()` normalises — it appends the root path to a
 * bare origin, lowercases the host, drops a default port — so re-serialising
 * unconditionally would put a diff on every clean URL in every event. The guard
 * is the four emptiness checks, and it is load-bearing rather than an
 * optimisation.
 *
 * **The residue is named, not guessed at.** A URL *embedded* in a longer string
 * — a message reading `fetch failed for https://…?token=…` — is left alone,
 * because no scanner can tell a link in an error message from a link that is a
 * credential, and any bound that caught the second would mangle the first.
 * [ADR-0006](../../../docs/adr/0006-name-the-exposure-rather-than-ship-a-heuristic.md)
 * is the precedent for saying so here rather than shipping the heuristic.
 */
function reduceUrl(value: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return value;
  }

  if (url.search === "" && url.hash === "" && url.username === "" && url.password === "") {
    return value;
  }

  url.search = "";
  url.hash = "";
  url.password = "";
  url.username = "";

  return url.toString();
}

/**
 * Only a plain object or an array is walked into. Anything else — a `Date`, a
 * class instance, anything with a prototype of its own — is handed back as it
 * arrived, because rebuilding it from `Object.entries` would return `{}` and
 * destroy the value. {@link scrubBranch} can afford the looser test because it
 * runs only at the carrier roots, where a Sentry payload is JSON-shaped by the
 * time a hook sees it; this pass runs over the **whole** event, so it meets
 * fields that walk never touches.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;

  const prototype: unknown = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

/**
 * {@link reduceUrl} over every string in the event, at every depth and under
 * every key.
 *
 * Unbounded, unlike {@link scrubBranch}'s {@link MAX_DEPTH} — that bound exists
 * so the walker and {@link redactionPaths} agree about how deep a *name* is
 * matched, and this pass generates no paths and matches no names, so there is
 * nothing for it to agree with. A pathologically deep event overflows the stack
 * instead, which throws, which {@link scrubOrDrop} turns into a dropped event.
 * That is the same fail-closed contract the rest of this module states, reached
 * by a different route.
 */
function reduceUrlsIn(value: unknown): unknown {
  if (typeof value === "string") return reduceUrl(value);

  if (Array.isArray(value)) return value.map((item) => reduceUrlsIn(item));

  if (!isPlainObject(value)) return value;

  const reduced: Record<string, unknown> = {};

  for (const [key, nested] of Object.entries(value)) {
    reduced[key] = reduceUrlsIn(nested);
  }

  return reduced;
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
      const wildcards = "*.".repeat(level);

      for (const spelling of REDACTED_KEY_SPELLINGS) {
        // A spelling carrying a dot is one key, not two. `err.http.query` tells
        // `fast-redact` to descend through an `http` object that does not exist;
        // `err["http.query"]` is the literal-key form, and it is the reason the
        // prefix drops its own separator when the segment is bracketed.
        paths.push(
          spelling.includes(".")
            ? `${root}.${wildcards}["${spelling}"]`.replace(".[", "[")
            : `${root}.${wildcards}${spelling}`,
        );
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

  // Names first, URLs second, and the order is deliberate: a value the key-name
  // pass has already reduced to `[redacted]` is not a URL, so the second pass
  // never re-parses what the first one settled.
  return reduceUrlsIn(scrubbed) as T;
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
