# Log line fields are named for the line, and the request id is lifted onto it

`requestId` is lifted to the top level of the log line **as `request_id`**, and it is removed from
`OperatorError` rather than duplicated there.

## The rule

**A field on a log line is `snake_case`, whatever its source calls it.** The line is its own
namespace: its consumer is a drain query, not a JavaScript caller, and one casing across the whole
line is what lets a query author predict a field name instead of having to know where the field came
from.

This is narrower than it sounds, because almost nothing has to be renamed to satisfy it:

| Field                       | Source                              | Renamed on the way? |
| --------------------------- | ----------------------------------- | ------------------- |
| `trace_id`, `span_id`       | the tracing SDK's `spanToJSON()`    | no — already        |
| `event_id`, `duration_ms`   | minted by this package for the line | no — named here     |
| `service`, `env`, `release` | the logger's own base bindings      | no — one word       |
| `level`, `time`, `msg`      | pino                                | no — one word       |
| `route`, `code`, `status`   | read off the request and the error  | no — one word       |
| `request_id`                | `AppError.requestId`                | **yes**             |

`request_id` is the only rename in the design, and `trace_id`/`span_id` — the two identifiers a drain
pivots to the reporting platform on — are passed through untouched. That is the outcome to want:
the rule costs one rename at the point of emission and buys a uniform line, while spending nothing at
the boundary where a mapping layer would be riskiest.

## Why `request_id` and not `requestId`

Because the alternative is a line that is `snake_case` everywhere except one field, and a query
author who cannot predict a field name without first knowing which entity it was lifted from. The
casing of a log field is a property of the line, not of the class the value happened to come from.

**Be exact about the price, because it is real and it is the one thing this decision costs.** The
browser receives `requestId` — that is one of exactly three keys `ClientError` publishes, and it stays
`camelCase` because the response body is a JavaScript contract consumed by JavaScript. So one
identifier has two spellings across that hop: a user reads `requestId` off a response and a support
engineer searches `request_id` in the drain. What nobody ever has to translate is a **value**; the
string is byte-identical on both sides, and this paragraph is where the two names are written down.

## Why it moves rather than duplicates

`requestId` leaves `OperatorError`. Keeping it in both places costs about fifty bytes a line, which
is nothing, and one ambiguity, which is not: a shared whitelist with a field that is also published
beside it has two answers to "where does a reader look", and the answer drifts the first time one of
the two is trimmed.

**It is trimmed today.** Under a bound that forces truncation, the operator `message` is offered
before `requestId` and is shortened rather than dropped, so it can consume the whole `err` budget —
measured at a 400-byte bound, `err` survived carrying `type`, `code`, `status` and a shortened
`message`, and the request id appeared nowhere on the line. That is the same class of failure
[ADR-0004](0004-stack-frames-are-trimmed-by-value.md) was written for and that NFR16's content half
now grades: a bound that holds while quietly dropping the field the query needed. Lifting the field
and preserving it is this line's instance of that rule.

The lifted field is **read and validated off the error, never obtained by invoking a method on it** —
the precedent the identity reader already sets for `code` and `status`, and for the reason stated
there: identity is a registered symbol, so it is a claim and not a proof, and a projection call runs
a forger's code. A value that fails validation contributes no `request_id` rather than a forged one.

## Considered options

**Lift as `requestId`, keeping the entity's spelling (rejected).** The rule would be that a field
keeps the name its source gives it, and there is a real argument for it: it is the spelling the
browser receives, so the identifier would read the same on both sides of the hop. Rejected because it
buys that one field's consistency by spending every other field's predictability — the line would be
`snake_case` except in one place, and a query author would have to know each field's origin to guess
its casing. The hop is documented in one paragraph; the casing question would be asked forever.

**Convert the whole line to `camelCase` (rejected).** The other way to get one casing, and it would
match the surrounding JavaScript. Rejected because `trace_id` and `span_id` arrive from
`spanToJSON()` already `snake_case`, so this rule direction is the one that _introduces_ a mapping
layer, and it introduces it on the two fields where correlation with the reporting platform matters
most. It would also put `snake_case`'s absence in the one place a rename is cheapest to avoid.

**Lift as `request_id` but keep `err.requestId` too (rejected).** The additive option: no existing
reader of `err` breaks, and `OperatorError` is untouched. Rejected on the duplication argument above
— two copies, one of which is already being trimmed, is worse than one copy in the better place.

**Rename `err.requestId` and `err.userMessage` to `snake_case` (rejected).** `err` is the serialised
entity, and its keys are the entity's property names. The rule here governs the **line's** fields, not
the contents of a value the line carries. Renaming inside `err` would be a breaking rename with no
forward fix available to the person it breaks: every clone's saved searches bind to those names and no
clone can be migrated by us.

## Consequences

- **`OperatorError` has five keys, not six.** Any consumer counting them changes with this decision,
  and the key-count assertion on the operator projection is where that is caught. The three-key
  assertion on the client projection is untouched — `ClientError` still carries `requestId`, which is
  the whole reason this field is worth lifting.
- **The support lookup survives truncation.** `request_id` joins the preserved fields, positioned with
  the correlation fields rather than appended, so the one query a support ticket starts from still
  resolves on a line that breached the cap. That was the concrete defect; the naming is the precedent.
- **One identifier, two spellings, across exactly one hop.** `requestId` on the wire, `request_id` on
  the line. This is the cost, it is bounded to one field, and the value is identical on both sides.
- **The line has no mapping layer for the fields that pivot.** `trace_id` and `span_id` reach the line
  from `spanToJSON()` unmodified, which is what keeps a drain's log-to-trace correlation working
  without this repo having an opinion about it. Whether a given drain's automatic pivot keys off those
  literal names is drain-specific — it is worth confirming against whichever drain a project adopts,
  and [the go-live runbook](../runbooks/observability-go-live.md) is where that check lives.
- **`CLAUDE.md`'s stability contract sentence names `request_id`.** The guaranteed names are still a
  contract and still unmigratable by us.
- **This binds the next field lifted to the line.** It is named for the line, in `snake_case`, whatever
  the entity it came from called it. Neither the entity nor `err` is renamed to match.
