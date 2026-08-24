# A type that crosses the RSC boundary defines no `toJSON`; every egress is a named projection

This is a rule about **any type that crosses the React Server Components boundary**, not about one
class. `AppError` is where it was first applied and is used below as the worked instance, but the rule
binds every future type that a Server Component passes as a prop, a Server Action returns, or a Route
Handler puts in a body.

**The rule.** Such a type defines no `toJSON`, no `Symbol.toPrimitive`, and no other implicit
serialisation hook. Each place it leaves the process gets a **named projection** — an explicit method
that builds the outgoing object field by field from a whitelist. A field added to the type reaches no
wire until someone writes it into a projection.

## Why an implicit hook is the wrong shape here

Serialisation across the RSC boundary is performed by machinery no author reviews at the call site.
The RSC payload serializer walks whatever it is handed. A log serialiser walks the error it is given.
`JSON.stringify` is reached by `console.log`, by a test helper, by a fetch body. Every one of those
honours `toJSON` if it exists.

So a `toJSON` makes the wire shape a property of the **type** while the decision to publish is made
somewhere else entirely — and the two drift in one direction only. Adding a field to a type is an
ordinary, unremarkable change; with `toJSON` present, that change publishes the field everywhere the
type is serialised, in the same commit, with nothing in the diff that looks like an egress. The author
who adds `internalNotes` to a type is not reviewing the seven places it is serialised.

The rule inverts that default. With no `toJSON`, an accidental `JSON.stringify` produces the value's
own enumerable fields and nothing curated, so publishing becomes an act with a diff.

**Be exact about what that buys, because half of it is a bound and not a guarantee.** Measured on the
worked instance below:

```
JSON.stringify(new AppError({ code: "boom", message: "…", context: { orderId: "…" } }))
→ {"name","code","status","userMessage","context","requestId"}
```

`message` and `stack` are absent because `Error` defines them non-enumerable, so the accidental path
cannot publish **operator prose** — which is the field the audience split exists to contain. But
`context` is an own enumerable property and it _is_ in that output, and `context` is `internal`. So the
rule's guarantee is narrower than "nothing escapes": it is that **no egress shape is defined
implicitly**. What keeps `context` off a wire is that every egress is a named projection and no code
path hands the value itself to a serializer. The two halves are load-bearing together; a codebase that
adopted the no-`toJSON` half and then passed an `AppError` straight to a Client Component as a prop
would have followed this ADR and still leaked.

## The worked instance

`AppError` (`packages/errors/src/app-error.ts`) carries `code`, `status`, `message` (operator-facing
English), `userMessage` (the only string permitted to reach a browser), `requestId`, `context`, and a
`cause`. It defines two projections and no `toJSON`:

| Projection         | Returns                                           | Audience                                                                  |
| ------------------ | ------------------------------------------------- | ------------------------------------------------------------------------- |
| `toClientError()`  | `{ code, message, requestId }`                    | A browser — via `toErrorResponse`, a Server Action return, or an RSC prop |
| `toOperatorJSON()` | `{ code, status, message, userMessage, context }` | The log line only. Never reaches a browser                                |

`requestId` is a field of `AppError` and is **absent from the operator projection deliberately**: it
is lifted to the log line's own top level instead, under its own name, so a support lookup does not
have to reach inside `err` and does not lose the field when `err` is trimmed. See
[ADR-0005](0005-log-line-fields-are-named-for-the-line.md). It remains in the client
projection, which is the egress a user reads it from.

Two details of the instance are general, not incidental:

- **The client projection's `message` is `userMessage`, and there is deliberately no code path from
  `message` to it.** `userMessage` defaults to a module constant, never to `message`. A projection
  that falls back to the operator field is the single mistake that turns this design into a leak.
- **Neither projection carries `cause`.** A cause is an arbitrary foreign object — a driver error, an
  HTTP client's config with headers in it — and a whitelist cannot whitelist an unknown shape. The
  pino error serialiser is the only thing that walks it, with the shared scrubber applied.

## Considered options

**`toJSON` plus a deny-list (rejected).** Define `toJSON`, delete the sensitive keys. Rejected because
it inverts the failure direction: the next field added to the type is published by default and the
author has to remember to deny it. Every leak of this class in the wild is a deny-list that was one
commit behind its type.

**One projection, with a flag (rejected).** `toJSON(audience: "client" | "operator")`. Rejected on two
counts: `JSON.stringify` calls `toJSON` with a property key, not with the caller's argument, so the
implicit path still exists and now silently takes the default branch; and a single method with a mode
flag is where the two whitelists start sharing a line of code and stop being independently reviewable.

**A runtime marker plus a serialisation guard (rejected).** Make `JSON.stringify` on the value throw,
via a `toJSON` that raises. Rejected because it converts a data-exposure bug into a production crash
on a path that may be an incidental `console.log` inside a dependency, and because the RSC serializer
would surface it as a render failure far from the cause. Absence is quieter and equally safe.

**Trusting review (rejected).** The projection discipline is exactly the kind of rule that holds until
the week someone is shipping under pressure. It is written here so review has something to cite.

## Consequences

- **Adding a field to a cross-boundary type is inert on every defined egress.** It reaches no browser
  and no log line until a projection is edited. That is the property this ADR exists for — and, per the
  measurement above, it holds because the egresses are named, not because the value is unserialisable.
- **The value itself is never handed to a serializer.** A Server Action returns `error.toClientError()`,
  never `error`; a Route Handler's body comes from `toErrorResponse`; the log line's `err` comes from
  `toOperatorJSON()`, and the handful of fields lifted beside it are read and validated field by field
  rather than obtained by calling anything. Passing a cross-boundary value whole to anything that
  serialises is the one move that defeats this ADR while appearing to comply with it.
- **Two whitelists must be maintained by hand,** and a forgotten one is a real failure mode. The guard
  is a test, not vigilance: NFR15's sentinel check builds an error whose `message` and every `context`
  value carries a distinct sentinel string, then asserts the serialized Route Handler body and the
  serialized Server Action projection each contain **zero** occurrences and **exactly three** keys.
  Any new cross-boundary type inherits that obligation — a projection with no key-count test is not
  finished.
- **A projection may not trust its input.** Identity across the RSC boundary is a **registered symbol**
  (`Symbol.for("@repo/errors:AppError")`), because Next compiles the server and client graphs as
  separate realms and `instanceof` does not survive that. A registry is shared, so `isAppError` is a
  _claim, not a proof_: `toClientError` validates the type and length of every field it copies, never
  trusts `status` to be a number in range, and returns a generic value for anything that fails. Any
  future cross-boundary type using the same identity mechanism inherits the same obligation.
- **The rule costs nothing at the boundary it does not cross.** A type used only inside the server may
  define `toJSON` freely; this ADR is scoped to types that cross.
- **It generalises past errors.** The next candidate is any DTO a Server Component hands a Client
  Component — a user summary, a settings object, a search result. Each gets a named projection rather
  than being passed whole, and the reason is this file rather than a per-case argument.
