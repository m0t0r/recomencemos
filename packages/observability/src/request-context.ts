/**
 * The `request_id` half of the mixin, and `trace-context.ts`'s sibling.
 *
 * The two correlators exist for different failures, which is why they are two
 * modules rather than one. `trace_id` comes from the active span and therefore
 * only while reporting is active — with no DSN nothing initialises, there is no
 * span, and the field is correctly absent. `request_id` is minted here, per
 * request, and exists in **every** process: a fresh clone with no monitoring
 * account, a dev session, a machine whose DSN was revoked. So it is the only
 * correlator that is always there, and the one a user quotes off a response body.
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
 * timer reading `null` on all 15 ticks. That measurement is the reason both
 * {@link enterRequestContext} and {@link runInRequestContext} exist rather than
 * only the first: the subscriber can only *enter* at request start, but the
 * completion line runs on the response's `finish` event, whose context is not
 * this module's to assume. See `log-request-complete.ts` for what that costs.
 */

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
 * On `globalThis` for the reason the subscription flag is: a re-evaluated module
 * gets a fresh module scope, and two storages would mean a line emitted through
 * one reading `{}` from the other. The `request_id` on a line and the
 * `request_id` on the completion line for the same request have to be the same
 * value, and that is only true if there is one store.
 */
const STORAGE = Symbol.for("repo.observability.requestContextStorage");

function storage(): AsyncLocalStorage<RequestContext> {
  const slot = globalThis as unknown as Record<symbol, AsyncLocalStorage<RequestContext>>;

  slot[STORAGE] ??= new AsyncLocalStorage<RequestContext>();

  return slot[STORAGE];
}

/**
 * The one mint site, and it mints rather than reads.
 *
 * An identifier taken from an inbound header is attacker-controlled text written
 * into the pretty stdout stream an agent reads and acts on — newlines and forged
 * fields included. There is deliberately no parameter here for a caller to
 * thread one into, which is the same shape `AppError` takes for the same field:
 * the mitigation is the absence of the option.
 */
export function newRequestId(): string {
  return randomUUID();
}

/**
 * Make `id` the current request's, from here forward in this execution context.
 *
 * This is what a `diagnostics_channel` subscriber has. It does not wrap a
 * callback, because the subscriber is handed a message and returns — there is no
 * continuation to wrap.
 */
export function enterRequestContext(id: string): void {
  storage().enterWith({ id });
}

/**
 * Run `fn` as `id`'s request, and restore whatever was current afterwards.
 *
 * The form to use wherever there *is* a callback, because it cannot leak into
 * the caller's context. `log-request-complete.ts` uses it on the response-finish
 * path, where the context in scope may belong to a different request on the same
 * keep-alive socket.
 */
export function runInRequestContext<T>(id: string, fn: () => T): T {
  return storage().run({ id }, fn);
}

/**
 * The current request's identifier, or `undefined` outside a request.
 *
 * The bare value, where {@link readRequestContext} is the line's shape. This is
 * what `@repo/errors` adopts so that an `AppError` raised inside a request
 * carries the request's id rather than one of its own — see
 * `ambient-request-id.ts` there for why it crosses as a value rather than an
 * import, and `subscribeRequestCompletion` for who registers it.
 */
export function currentRequestId(): string | undefined {
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
 * line, a module's import-time emit — none of those belong to a request, and a
 * line stamped with whichever request happened to run last is a wrong
 * correlation, which is worse than none: it is exactly the failure this field
 * was added to fix on the `trace_id` side.
 *
 * Never throws, for the reason `readTraceContext` never throws — it runs
 * on every emit, so a throw here takes the logger down during the incident the
 * logger exists for.
 */
export function readRequestContext(): Record<string, string> {
  const id = currentRequestId();

  return id === undefined ? {} : { request_id: id };
}
