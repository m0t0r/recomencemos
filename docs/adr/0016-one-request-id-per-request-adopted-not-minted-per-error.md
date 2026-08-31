---
status: proposed
---

# One `request_id` per request, adopted rather than minted per error

`AppError` mints `requestId` in its constructor with `crypto.randomUUID()`, once per **error**. The
request-completion line now mints one per **request** and the logger's mixin puts it on every line
emitted inside that request. Both are correct on their own; together they put two different values
under one field name, and #81 is where that collided.

Observed against a running `next dev`, one request to `/api/example-error`:

```
WARN: request error    {"request_id":"a73a2263-…","route":"/api/example-error","status":422}
INFO: request complete {"request_id":"db16d267-…","route":"/api/example-error","status":422}
```

Three things follow from that, and only the first is cosmetic.

- **`request_id` means two things.** On an error line it is the id the browser was given; on every
  other line it is the id of the HTTP request. A drain cannot join them and a query author cannot
  predict which they are reading — which is precisely what
  [ADR-0005](0005-log-line-fields-are-named-for-the-line.md) exists to prevent.
- **The support lookup returns one line instead of all of them.** A query on the `request_id` a user
  quoted is described in the go-live runbook as the single most common one anyone will run against
  these logs. Under two mints it returns the error line and nothing else — not the completion line
  that carries the status and the duration, and not anything the handler logged.
- **Two failures in one request hand the user two reference numbers.** Neither is wrong, and there is
  no way to tell from either one that they describe the same request.

## Decision

**`AppError` adopts the current request's identifier where a server has registered one, and mints its
own only when there is none.** The field becomes per-request rather than per-error, which is what its
name says.

The registration crosses as a **value through a `globalThis` slot**, not as an import:
`packages/errors/src/ambient-request-id.ts` owns the slot and the validation;
`@repo/observability`'s `subscribeRequestCompletion` is the only registrar, and it registers
`currentRequestId` — a read of the same `AsyncLocalStorage` the mixin reads.

## Why that shape and not an obvious one

Three constraints meet, and no other shape satisfies all three.

- **`@repo/errors` has no `dependencies` key, and that absence is the design.** It is isomorphic, and
  the empty dependency list is what enforces that rather than documenting it. The request store is an
  `AsyncLocalStorage`, so importing it would put `node:async_hooks` in the client graph. A value read
  through a slot adds no module and no dependency.
- **`AppError` has no `requestId` constructor option, and the absence is the log-injection
  mitigation** — an id taken from an inbound header lets an attacker write newlines and forged fields
  into the pretty stdout stream an agent reads and acts on. **That mitigation is unchanged.** The only
  value adoptable is one the server minted on its own process; nothing a request body carries can
  reach the slot.
- **A parameter would have to be threaded through every construction site**, and the sites that
  matter most are the ones nobody will edit — a `throw new AppError` deep in a query module, written
  before any of this existed.

`Symbol.for` rather than a module-scoped `let` for the reason `@repo/observability` already uses it
twice: a re-evaluated module gets a fresh module scope, which would leave a stale registration behind
while the store it reads is still live.

## What it costs

- **`AppError.requestId` changes meaning**, from "this error" to "this request, if one is in flight".
  Nothing in this repo depended on the old meaning — it is only ever read for correlation — but a
  downstream project counting distinct `requestId`s as a proxy for error count would now be counting
  requests.
- **One more thing can be wrong at a distance.** A registrar that returns a bad value would put it on
  every error in the process. Every failure mode therefore costs the _adoption_ rather than the
  error: a missing reader, a throwing reader, a non-string, an empty string, and a value past
  `MAX_REQUEST_ID_LENGTH` all fall back to a fresh mint. The
  `a reader that cannot be trusted` block in `packages/errors/src/ambient-request-id.test.ts` is those
  five plus the value exactly at the bound, which is adopted. This runs inside the constructor of the
  type that exists to report failure, so a throw here would turn one failure into two and the second
  would have no `AppError` to describe it.
- **A global slot is action at a distance**, and that is the honest name for it. It is bounded by
  being write-only from one package, read-only from one function, and validated at the read.

## Alternatives

- **Carry both ids, under two names.** Additive and needs no record. Rejected because it leaves
  `request_id` meaning two things and asks a drain to join on two fields — it documents the collision
  rather than resolving it.
- **Let the mixin win and drop the lift in `logRequestError`.** Cheapest, and wrong: the lifted value
  is the one the browser receives, so the line would stop carrying the string a user actually quotes.
- **Give `AppError` a `requestId` option and pass it at every site.** Reopens the injection mitigation
  and misses exactly the call sites nobody revisits.
