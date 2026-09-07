/**
 * How a server tells this isomorphic package what the current request is called.
 *
 * `AppError` used to mint `requestId` per **error**. Once the request-completion
 * line started minting one per **request**, the same field name carried two
 * different values on two lines describing the same failure — and the id a user
 * quotes off a response body matched neither the other error nor the completion
 * line. Two errors raised while handling one request also handed that user two
 * different reference numbers. One identifier per request is what the name says
 * and what a support lookup needs.
 *
 * ## Why a `globalThis` slot rather than an import or a parameter
 *
 * Three constraints meet here, and this is the only shape that satisfies all
 * three.
 *
 * - **`@repo/errors` has no `dependencies` key, and that absence is the design.**
 *   It is isomorphic — importable from a Server Component, a Client Component, a
 *   Route Handler, either instrumentation entry point — and the empty dependency
 *   list is what enforces that. The request store is an `AsyncLocalStorage`, so
 *   importing it here would put `node:async_hooks` in the client graph. What
 *   crosses instead is a **value**, read through a slot; no module is imported
 *   and no dependency is added.
 * - **`AppError` deliberately has no `requestId` option**, and the absence is the
 *   log-injection mitigation: an id taken from an inbound header lets an attacker
 *   write newlines and forged fields into the pretty stdout stream an agent reads
 *   and acts on. That mitigation is unchanged: there is still no parameter, and
 *   the only value this can adopt is one a server minted and registered on its
 *   own process. It is also no longer the *only* thing standing there — see
 *   {@link SAFE_IDENTIFIER}, which bounds what an adopted value may contain
 *   whoever registered it.
 * - **A parameter would have to be threaded through every construction site**, and
 *   the sites that matter most are the ones nobody edits: a `throw new AppError`
 *   deep in a query module, in code written before this existed.
 *
 * The `Symbol.for` slot is the idiom `@repo/observability` already uses for the
 * subscription flag and the request store, and for the same reason: a
 * re-evaluated module gets a fresh module scope, and a module-scoped `let` would
 * leave the registration behind while the store it reads is still live.
 *
 * **`@repo/observability` is the only registrar.** It calls this from
 * `subscribeRequestCompletion`, which is the one function that knows requests are
 * being tracked at all.
 */

/** Returns the current request's identifier, or `undefined` outside a request. */
export type AmbientRequestIdReader = () => string | undefined;

const READER = Symbol.for("repo.errors.ambientRequestIdReader");

/**
 * What an identifier may be made of, and it is the half of the injection
 * mitigation that does not depend on who calls the setter.
 *
 * The absent constructor option is what keeps a request body away from this
 * field. That argument covers the *parameter* and says nothing about a registrar
 * that is itself compromised or merely wrong — and the value reaches the pretty
 * stdout stream an agent reads and acts on, where a newline or a quote is the
 * whole attack. A length bound alone admits both. So the charset is checked
 * rather than assumed: letters, digits, `-` and `_`, which covers every id
 * format this product could plausibly adopt (a UUID, a ULID, a nanoid, a request
 * id from a load balancer) and none of the characters that would let a value
 * break out of the line it is written on.
 *
 * Deliberately not "must be a UUID": this bounds what a value may *contain*
 * without fixing the shape of the ids, which is a choice the request path makes
 * and this module has no reason to constrain.
 */
const SAFE_IDENTIFIER = /^[A-Za-z0-9_-]+$/;

type ReaderSlot = Record<symbol, AmbientRequestIdReader | undefined>;

/**
 * Register the reader, or pass `undefined` to clear it.
 *
 * Idempotent and last-write-wins. Clearing is what a test does between cases;
 * nothing in production clears it, because a process that has started tracking
 * requests does not stop.
 */
export function setAmbientRequestIdReader(read: AmbientRequestIdReader | undefined): void {
  (globalThis as unknown as ReaderSlot)[READER] = read;
}

/**
 * The current request's identifier if a reader is registered, it answers, and its
 * answer is fit to publish — otherwise `undefined`.
 *
 * **Every failure here costs the adoption rather than the error.** This runs
 * inside the constructor of the type that exists to report failure, so a throw
 * would turn one failure into two, and the second would have no `AppError` to
 * describe it. A missing reader, a throwing reader, and a reader returning
 * something unusable are all the same answer: mint a fresh id, exactly as before
 * any of this existed.
 *
 * The length bound applied is the one the wire projection applies to the same
 * field. An id past it is one the browser would refuse to carry, so adopting it
 * would put a value on the log line that no support ticket could ever quote back.
 * {@link SAFE_IDENTIFIER} is the other half, and it is the one that keeps the
 * injection mitigation structural rather than conventional.
 */
export function readAmbientRequestId(maxLength: number): string | undefined {
  const read = (globalThis as unknown as ReaderSlot)[READER];

  if (typeof read !== "function") return undefined;

  try {
    const value = read();

    if (typeof value !== "string") return undefined;
    if (value.length === 0 || value.length > maxLength) return undefined;
    if (!SAFE_IDENTIFIER.test(value)) return undefined;

    return value;
  } catch {
    return undefined;
  }
}
