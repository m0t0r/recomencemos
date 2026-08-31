/**
 * What a request is called, for as long as it lasts. The `request_id` half of
 * the mixin, and `trace-context.ts`'s sibling.
 *
 * **This module owns the identifier's whole life** — minting it, remembering it
 * against the request object, entering it, re-entering it, and publishing it to
 * `@repo/errors`. That is deliberate rather than incidental: the id is one
 * concept with four moments, and splitting them across the completion line's
 * module made that module answer for two unrelated things. `log-request-complete.ts`
 * owns the line and its timing, and calls in here for the rest.
 *
 * The two correlators exist for different failures, which is why they are two
 * modules. `trace_id` comes from the active span and therefore only while
 * reporting is active — with no DSN nothing initialises, there is no span, and
 * the field is correctly absent. `request_id` is minted here, per request, and
 * exists in **every** process: a fresh clone with no monitoring account, a dev
 * session, a machine whose DSN was revoked. So it is the only correlator that is
 * always there, and the one a user quotes off a response body.
 *
 * It is also correct where `trace_id` is *wrong*. Build recorded a dev-only
 * overlay request sharing a `trace_id` with the request that triggered it — one
 * line per request either way, so NFR17 held, but the correlation pointed at the
 * wrong request and NFR18's band cannot see that, because that band counts
 * *missing* identifiers. An id minted once per channel publish cannot do it.
 *
 * ## Why `AsyncLocalStorage.enterWith` and not `channel.bindStore`
 *
 * `bindStore` is the documented route for exactly this and **does not work**
 * here: Node publishes `http.server.request.start` with a plain `publish()`
 * rather than `runStores()`, so a store bound to that channel never activates.
 * Measured on Node v24.11.0 — 0 of 6 reads saw it. `enterWith` does work: it
 * propagates into the handler, survives an `await`, and is still readable when
 * the response finishes.
 *
 * `enterWith` is notorious for contaminating whatever context it is called in,
 * and the spike did not reproduce that — 0 violations over 30 concurrent
 * requests and over 20 keep-alive requests on one socket, with a background
 * timer reading `null` on all 15 ticks. That measurement is the reason
 * {@link runInRequestOf} exists anyway: {@link beginRequest} can only *enter*, and
 * the completion line runs on the response's `finish` event, whose context is
 * not this module's to assume. See there for what that buys.
 */

import { setAmbientRequestIdReader } from "@repo/errors/ambient-request-id";
import { assertServerOnly } from "@repo/observability/server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

assertServerOnly("request-context");

/**
 * A record rather than a bare string, so a later ticket can add a
 * request-scoped field without changing every call site's shape.
 */
interface RequestContext {
  id: string;
}

/**
 * Both slots are on `globalThis` for the reason the subscription flag is: a
 * re-evaluated module gets a fresh module scope, and two storages would mean a
 * line emitted through one reading `{}` from the other. The `request_id` on a
 * handler's line and the one on that request's completion line have to be the
 * same value, and that is only true if there is one store and one map.
 */
const STORAGE = Symbol.for("repo.observability.requestContextStorage");
const IDS = Symbol.for("repo.observability.requestContextIds");

/**
 * `null` is "explicitly no request", and it may **not** be `undefined`.
 *
 * `AsyncLocalStorage.run` opens no frame at all when the store it is handed is
 * already the active one — it compares with `Object.is` and returns the callback
 * applied directly. Outside a request the active store *is* `undefined`, so
 * `run(undefined, fn)` is a no-op wrapper: it would neither isolate what `fn`
 * does nor stop `fn` reading whatever context it was called in, which is the
 * whole job of {@link runInRequestOf}'s unknown-request branch. `null` is never
 * the ambient value, so the frame is always real.
 *
 * Found by a test that expected an `enterWith` inside the frame not to outlive
 * it, and it did.
 */
type Slot = AsyncLocalStorage<RequestContext | null>;

const NO_REQUEST = null;

function storage(): Slot {
  const slot = globalThis as unknown as Record<symbol, Slot>;

  slot[STORAGE] ??= new AsyncLocalStorage<RequestContext | null>();

  return slot[STORAGE];
}

/**
 * Keyed by the request object itself, so a dropped connection cannot leak an
 * entry — nothing has to remember to clean up after an aborted request.
 *
 * It exists because the async store alone cannot answer "which request is this
 * `finish` event for". See {@link runInRequestOf}.
 */
function ids(): WeakMap<object, string> {
  const slot = globalThis as unknown as Record<symbol, WeakMap<object, string>>;

  slot[IDS] ??= new WeakMap<object, string>();

  return slot[IDS];
}

/**
 * The one mint site, and it mints rather than reads.
 *
 * An identifier taken from an inbound header is attacker-controlled text written
 * into the pretty stdout stream an agent reads and acts on — newlines and forged
 * fields included. There is deliberately no parameter for a caller to thread one
 * into, which is the same shape `AppError` takes for the same field: the
 * mitigation is the absence of the option.
 */
function newRequestId(): string {
  return randomUUID();
}

/**
 * This request has started: mint its identifier, remember it against the request
 * object, and make it current from here forward in this execution context.
 *
 * One call because it is one event. `enterWith` rather than `run` because a
 * `diagnostics_channel` subscriber is handed a message and returns — there is no
 * continuation to wrap — and entering is what carries the id into the handler,
 * which is the half `trace_id` cannot do with no DSN configured.
 *
 * ## The one seam in "absent, never stale", written down rather than implied
 *
 * `enterWith` mutates the context it is called in, and for an HTTP server that is
 * the **socket's**, not the request's — a socket outlives every request on it.
 * So between two requests on a keep-alive connection, code running on that
 * socket but inside no request reads the *previous* request's identifier. Every
 * line this repo emits is either inside a request or outside any server at all,
 * and {@link runInRequestOf} is what keeps the completion line off that path, so
 * nothing reaches it today. A socket-level `close` or `error` handler that logged
 * would, and that is the case to remember before adding one.
 *
 * There is no fix available from here: `enterWith` is the only mechanism a plain
 * `publish()` channel leaves (see the module header), and it has no scope to end.
 * Naming the seam is the honest option — the alternative is a guarantee that is
 * true of every line anyone has written and silently false for the next one.
 */
export function beginRequest(request: object): void {
  const id = newRequestId();

  ids().set(request, id);
  storage().enterWith({ id });
}

/**
 * This request is over: forget what it was called.
 *
 * Idempotent, and called on **every** completed request rather than only the ones
 * that produce a line — the request has ended either way, and a rule with an
 * exception is one a later early return quietly falls the wrong side of.
 *
 * Nothing leaks without it, because {@link ids} is a `WeakMap` and the entry
 * cannot outlive the request object it is keyed by. What it buys is that the
 * entry goes at response-finish instead of whenever the collector next runs — and
 * that is worth having precisely because most requests now emit no line: measured
 * at **508 bytes** per entry held, which is V8's ephemeron table plus the id, some
 * six times what a plain `Map` entry would cost.
 */
export function endRequest(request: object): void {
  ids().delete(request);
}

/**
 * Run `fn` as `request`'s request, restoring whatever was current afterwards.
 *
 * **This is correctness, not caution, and the keep-alive case is why.**
 * `enterWith` mutates the *current* execution context, and on a keep-alive socket
 * every request on that socket shares one — so a later request's
 * {@link beginRequest} can overwrite the context an earlier request's `finish`
 * event would otherwise read, and its completion line would carry the wrong id.
 * Keying off the request object is what makes that impossible.
 *
 * **A request this module never saw begin runs under an explicitly empty context,
 * not the ambient one**, and that is the same argument rather than a special
 * case. Falling through to whatever context happened to be current would hand
 * that request the identity of whichever *other* request was last on the socket —
 * which is the exact failure this function exists to prevent, arrived at from the
 * other side. A line with no `request_id` is honest; a line with a neighbour's is
 * a wrong correlation, and NFR18's band cannot see one of those.
 *
 * It reads and does not forget. Forgetting is {@link endRequest}'s, so that it
 * happens once per request rather than once per request *that produced a line* —
 * which is a different and much smaller population now.
 */
export function runInRequestOf<T>(request: object, fn: () => T): T {
  const id = ids().get(request);

  return storage().run(id === undefined ? NO_REQUEST : { id }, fn);
}

/** The current request's identifier, or `undefined` outside a request. */
function currentRequestId(): string | undefined {
  try {
    return storage().getStore()?.id;
  } catch {
    return undefined;
  }
}

/**
 * The mixin's contribution: `{ request_id }` inside a request, `{}` outside.
 *
 * Absent rather than stale is the whole contract. A background timer, a startup
 * line, a module's import-time emit — none of those belongs to a request, and a
 * line stamped with whichever request happened to run last is a wrong
 * correlation, which is worse than none: it is exactly the failure this field
 * was added to fix on the `trace_id` side.
 *
 * Never throws, for the reason `readTraceContext` never throws — it runs on
 * every emit, so a throw here would take the logger down during the incident the
 * logger exists for.
 */
export function readRequestContext(): Record<string, string> {
  const id = currentRequestId();

  return id === undefined ? {} : { request_id: id };
}

/**
 * Let an `AppError` raised inside a request carry that request's identifier
 * rather than one of its own.
 *
 * The registration lives here because this module owns the value being
 * published; `subscribeRequestCompletion` calls it, because that is the one
 * function that knows requests are being tracked at all — before it runs there is
 * no store to read and adoption would have nothing to adopt.
 *
 * What it buys is that a request's `warn`/`error` line and its completion line
 * join, and that a user quoting one reference number gets every line the request
 * emitted rather than one of them.
 * `docs/adr/0016-one-request-id-per-request-adopted-not-minted-per-error.md`
 * carries why a **value** crosses to `@repo/errors` where a module may not.
 */
export function publishRequestIdToErrors(): void {
  setAmbientRequestIdReader(currentRequestId);
}
