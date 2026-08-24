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
 * `request.cookies` is here beyond the namespaces the spec enumerates: the
 * `cookie` *header* is covered by name, but the SDK also lifts cookies into
 * their own field, and a list that covered one and not the other would be a
 * redaction list that disagreed with itself.
 *
 * **What key names cannot reach**: a secret in a URL rather than under a key —
 * `request.url` holding `?api_key=…`. Matching by key name structurally cannot
 * see it, and no test here pretends otherwise. Whatever consumes transactions
 * needs its own answer for query strings.
 */
const CARRIER_PATHS: readonly (readonly string[])[] = [
  ["data"],
  ["request", "headers"],
  ["request", "cookies"],
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
        paths.push(`${root}.${wildcards}${spelling}`);
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
