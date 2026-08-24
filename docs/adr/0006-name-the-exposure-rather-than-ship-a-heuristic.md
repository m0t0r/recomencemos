# Where no mechanism can tell a secret from an identifier, name the exposure

`context.path` on the request-completion line carries the concrete request path, query and hash
stripped, on **every** completed request. A credential carried in a **path segment** — a
password-reset token, a signed invite, an unsubscribe link — therefore reaches stdout verbatim:

```json
{
  "level": "info",
  "route": "/_not-found",
  "context": { "path": "/reset-password/rp_9f81c2d4e0a7" }
}
```

**This template ships no code fix for that, and that is the decision.** `pathOf` keeps returning what
it returns today. What ships instead is the exposure named in four places — an `UNSET` policy key, a
runbook threat with the recipe for closing it, a doc comment where the next engineer reads, and this
ADR — plus the precedent below, which is the part that outlives the field.

## The rule

**Where no mechanism available to the template can separate a secret from an identifier, the template
names the exposure rather than shipping a heuristic that impersonates a guarantee.**

Two halves, and the second is the one that does work later:

1. **The exposure is written down where the decision that creates it gets made** — a policy key the
   project must answer, and a runbook procedure for the `yes` branch. Not a comment in the module,
   which nobody reads before shipping a tokened route.
2. **No default that would be mistaken for a bound.** A partial mitigation on a field the project has
   not classified is worse than none, because it converts "this may leak" into "this is handled".

## Why no bound ships

**`rp_9f81c2d4e0a7` and `42` are the same thing to any mechanism this package could hold.** Both are
one opaque segment of a URL. Entropy does not separate them — a `cuid`, a `uuid`, and a short-lived
reset token are indistinguishable from an order id by shape, and a project that numbers its invites
sequentially defeats an entropy test in the other direction. Position does not separate them either:
the token is the last segment in `/reset-password/<token>` and the second in `/i/<token>/accept`.

`redaction.ts` already refuses to sell this. Its list matches **key names**, it calls itself advisory,
and it asserts no sufficiency. The key here is `path` and the secret is in the value, so the list
cannot reach it — and a value-shaped guess bolted on beside it would be the first thing in the package
claiming a coverage it does not have.

**The asymmetry is what settles it.** A bound cannot be applied only where it is safe, because the
module cannot tell where that is. Any cap, hash, or counted marker on `pathOf` lands equally on
`/orders/42` — a matched dynamic route where the concrete segment is the field's **entire** diagnostic
value, and the only reason `context.path` exists beside a bounded `route` at all. So the template would
be trading a certain loss of diagnostic value on every project for an uncertain gain on the subset of
projects that carry a credential in a path, and it would be making that trade on their behalf without
being able to ask.

The project can ask. It knows its routes.

## Why no knob

[ADR-0004](0004-stack-frames-are-trimmed-by-value.md) settled this shape of question already: _a knob
would be a second answer to a question with one good one_. The costs it priced apply unchanged. A new
environment variable must be declared in `turbo.json` to survive Turborepo's strict environment mode or
it is silently inert; it becomes a value a wizard has to ask about, a row in the runbook's phase split,
and a second configuration to get wrong in an incident.

And it would not be a second answer to one good question here — it would be a way to defer the question
indefinitely. The point of `secrets-in-url-paths` being `UNSET` is that a skill meeting it raises a
flagged concern and cannot guess. An environment variable defaulting to "unbounded" raises nothing,
forever.

## Why `data.md`'s `secret` row is left exactly as it is

[`docs/policy/data.md`](../policy/data.md) classifies `secret` — credentials, tokens, keys — as **never
cached, never logged, never crosses to the client**, and marks the classification vocabulary **Fixed**.
`retention-logs` adds that a log line inherits the classification of what it contains. The shipped code
contradicts that row, on every request, in the no-DSN state a fresh clone ships in.

**The row is correct and is not narrowed.** Narrowing it — "never logged, except in a URL path" — would
make the policy describe the implementation, which is backwards: policy is what the code is measured
against, and a row edited to stop accusing the code stops being able to accuse anything. The deviation
is named instead, in the runbook's threat section, as a deviation. A reader who finds the contradiction
finds it already written down, with the question that closes it attached.

This is also why the answer is a **security** key rather than a data one. `data.md` has already settled
what may be logged; the open question is a fact about the project's own routes — does any of them carry
a credential in a segment — and only the project holds it.

## Considered options

**Cap the segment count and mark the rest (rejected).** ADR-0004's counted marker is the house shape
for a trimmed diagnostic, and it is the right shape for a project that decides to bound this. As a
template default it fails on the asymmetry above: `/orders/42` loses the `42`. It also fails the
honesty test — a token in the **first** segment survives any suffix cap, so the mitigation would be
sound against the example in the finding and unsound against `/rp_9f81c2d4e0a7/reset`.

**Hash segments beyond the first (rejected).** Same asymmetry, plus it destroys the field's use for the
case it was added for — reading 404 noise — and a hashed segment is not recoverable when the operator
needs the real one. It reads as a privacy guarantee while being a reversible-by-rainbow-table mapping
over a low-entropy space wherever ids are sequential.

**Drop `context.path` entirely (rejected).** It is the one field that answers _which_ URL, and `route`
is deliberately bounded so that it cannot. Removing it also changes the line's shape for every drain
query already bound to it, which is the cost the runbook's recipe is explicit about for the same
reason.

**An allowlist or denylist of route patterns in the package (rejected).** This is the knob again with
more surface. The project would have to enumerate its tokened routes in a config the module reads at a
seam it does not otherwise need, and a route added later and not enumerated leaks exactly as it does
today — with the difference that a config file now claims it is covered.

**Detect high-entropy segments and redact them (rejected).** The one option that looks like a real
mechanism, and the one this ADR most wants to say no to. It fails on both sides: `cuid`-shaped order
ids get redacted, and a six-digit numeric OTP in a path does not. A detector that is wrong in both
directions and cannot be audited is precisely the heuristic wearing the costume of a guarantee.

## Consequences

- **A field this template writes on a caller's behalf can carry a classification the template does not
  know.** That is stated rather than mitigated, and `secrets-in-url-paths` in
  [`docs/policy/security.md`](../policy/security.md) is what keeps asking about it. An `UNSET` key is
  raised by every future spec that touches the area, which is the durability this decision needs and a
  runbook paragraph alone would not give it.
- **The `yes` branch has a procedure, so the key is answerable.** A policy key whose yes-branch has no
  procedure is the form nobody can fill in. The runbook's security section carries it, and it is short
  only because a downstream project owns `@repo/observability` outright: change `pathOf`, leave `route`
  alone, keep the field present.
- **`route` is untouched by any of this.** It is on the log line's stability contract, it is what a
  drain groups by, and it is bounded for a different reason — cardinality, not exposure. The two
  reasons now sit side by side in the spec, where only the first was recorded before.
- **The suite states the declined decision.** `log-request-complete.test.ts` pins the segment case
  verbatim, so bounding `pathOf` is a change that has to be made deliberately against a failing
  assertion rather than slipped in. A downstream project taking the `yes` branch updates that test, and
  the test is where they learn what else to leave alone.
- **This binds the next field the template writes for a caller.** Before shipping a mitigation for a
  value the template cannot classify, ask whether the mechanism can actually tell the two cases apart.
  Where it cannot, the deliverable is the named exposure and the question — not the heuristic.
