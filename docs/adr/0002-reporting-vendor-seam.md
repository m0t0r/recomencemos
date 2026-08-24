# Error reporting goes through one owned function, and Sentry sits behind it

Error reporting is Sentry — `@sentry/nextjs`, declared `^10.70.0` in `apps/web/package.json` and
`packages/observability/package.json`, resolving to **10.70.0** as installed. **No application module
names it**: everything that reports an error calls one of two functions this repo owns,
`reportRequestError` on the server and `reportClientError` in the browser. The seam is deliberately
narrow, and the narrowness is the decision: it is a **seam, not an abstraction layer**, so it wraps the
one thing a vendor swap would otherwise scatter across call sites and leaves the framework integration
exposed on purpose.

## What crosses the seam

Five modules, all code this repo owns. Each one names the vendor so that nothing above it has to:

| Crossing                     | Where                                                | What it does                                                                                                 |
| ---------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `reportError`                | `packages/observability/src/report-error.ts`         | Reports one error, returns the event id. The single **server** report site                                   |
| `reportRequestError`         | `packages/observability/src/report-request-error.ts` | Reports, then logs the line carrying that id. Called by `instrumentation.ts` only                            |
| `reportClientError`          | `apps/web/lib/report-client-error.ts`                | The single **browser** report site, holding the digest guard. Reports the errors that never reach a server   |
| `readTraceContext`           | `packages/observability/src/trace-context.ts`        | Reads `trace_id`/`span_id` off the active span for the log line. Runs as pino's `mixin`, once per emit       |
| `scrubEvent` / `scrubOrDrop` | `packages/errors/src/redaction.ts`                   | The shared redaction pass, applied to all three egresses. The only one that imports **nothing** from the SDK |

`scrubEvent` lives in `@repo/errors` rather than beside the logger because one of its three consumers
is a browser module forbidden from importing `@repo/observability`. A scrubber the client cannot reach
is a redaction list that disagrees with itself by construction.

**`trace-context.ts` is a crossing and not an integration file**, which is the distinction worth being
careful about. It is not registration or build config; it is correlation, and correlation is squarely
the seam's job. It reads the vendor's span shape through `getActiveSpan()` and `spanToJSON()`, so a
swap rewrites its body — but its exported type, `TraceContextReader`, is structural, and
`createLoggerOptions` has taken it as a parameter since the logger shipped. So the reader changes and
no caller does, which is the seam pattern working rather than an exception to it.

`scrubEvent` lives in `@repo/errors` rather than beside the logger because one of its three consumers
is a browser module forbidden from importing `@repo/observability`. A scrubber the client cannot reach
is a redaction list that disagrees with itself by construction.

## What stays vendor-specific

Named rather than wrapped, and this is the deliberate half of the decision:

- `apps/web/instrumentation.ts` and `apps/web/instrumentation-client.ts` — SDK registration
- `apps/web/sentry.server.config.ts` — the one server reporting-configuration module
- `withSentryConfig()` in `apps/web/next.config.ts` — build config, source-map upload, release injection
- `Sentry.captureRequestError` — the framework's own capture helper, called from inside the seam
- Source-map upload and release management

These are **framework integration, not error reporting**. Wrapping them would hide exactly what makes
`@sentry/nextjs` worth having over a bare HTTP client: automatic instrumentation, span propagation,
and the trace context correlation depends on.

**The list means "a vendor swap rewrites these files". It has never meant "application code may not
reach them through the seam."** That reading is not hypothetical — the first implementation of
`reportError` took it, refused to call `captureRequestError` because the helper appears on this list,
and reached for `captureException` directly to obtain the event id the helper discards. Measured
against a received envelope, that cost the `transaction` name (`POST /orders`), the whole `request`
section, `contexts.nextjs`, and the `auto.function.nextjs.on_request_error` mechanism. The transaction
name is the one that matters: the platform groups issues by it, so every route's failures grouped
together. The seam now delegates to the helper and adds exactly one thing the helper does not provide
— the event id, recovered from `lastEventId()` read before and after the capture so the failure mode
is `undefined` rather than a line pointing confidently at the previous error.

## What a swap costs

**Three module bodies plus the integration files above, and no call site.** Exhaustively, a swap
rewrites:

| Rewritten                                     | Why                                                 |
| --------------------------------------------- | --------------------------------------------------- |
| `packages/observability/src/report-error.ts`  | The server capture call and the event-id protocol   |
| `apps/web/lib/report-client-error.ts`         | The browser capture call                            |
| `packages/observability/src/trace-context.ts` | Reads the vendor's span shape                       |
| `apps/web/instrumentation.ts`                 | Registration and the DSN off-switch                 |
| `apps/web/instrumentation-client.ts`          | Browser registration                                |
| `apps/web/sentry.server.config.ts`            | The reporting-configuration module — likely renamed |
| `apps/web/next.config.ts`                     | `withSentryConfig()`, source maps, release          |

**And no call site.** `instrumentation.ts` calls `reportRequestError`, the two boundaries call
`reportClientError`, and `createLoggerOptions` takes the trace reader as a parameter. None of those
signatures mentions a vendor: `RequestSummary` and `RequestErrorContext` are declared structurally in
`report-error.ts` rather than imported from `next` or from the SDK, `ReportingClient` bundles the three
SDK calls into one injectable value, and `TraceContextReader` is structural too. So nothing in
`apps/web/app/`, nothing in `@repo/errors`, and no test that is not already about the seam.

**This says "three modules" where the spec said "one", and the correction is the point of writing the
record after the code rather than before it.** The spec's high-level design counted `report-error.ts`
alone, because at Design there was no browser report site and no trace reader yet — #35 added the
first and #33 the second, and both name the vendor by necessity. The `no call site` half, which is the
half that actually bounds the blast radius, is unchanged and verified below.

## Considered options

**No seam — call the SDK from each site (rejected).** Cheapest today and the SDK's own documented
shape. Rejected because it makes "exactly one report per uncaught error" unenforceable: the guarantee
becomes a convention every handler must remember, and the first double-report is discovered from a
spent quota rather than from a diff. It also puts a vendor import on every path that can fail,
including client paths, which is how a server-only dependency ends up in a browser bundle.

**A vendor-neutral reporting abstraction (rejected).** Model the report as an interface, implement it
for Sentry, keep the door open for anything else. Rejected on cost against evidence: the abstraction
has one implementation and no second candidate, so its shape would be Sentry's shape with the names
changed — and it would have to re-expose automatic instrumentation, span propagation, and trace
context to be worth using, at which point it is a fork of the SDK rather than an abstraction over it.
A one-implementation interface is a guess about the second one.

**An OpenTelemetry collector, vendor-neutral by construction (rejected, and out of scope).** The
honest version of the previous option: emit OTLP, route it anywhere. Explicitly Out of Scope in the
intent — it is infrastructure this template has nowhere to run, and it answers a portability question
nobody has asked yet. Recorded because it is the option that would supersede this ADR if the question
is ever asked in earnest.

**A different vendor (not chosen, no blocker).** Nothing in the analysis above is Sentry-specific
except the Next.js integration quality, which is the reason for the choice. The free tier drops data
rather than billing, which the go-live runbook carries as a number; a project that finds that
unacceptable pays the swap cost stated above.

## Consequences

- **Application code is vendor-free, and there is a check that proves it rather than a claim that
  asserts it.**

  ```sh
  grep -rln "@sentry" apps packages --include="*.ts" --include="*.tsx"
  ```

  Every path it returns must appear in one of this record's two lists — the five crossings, or the
  integration files. As of this record it returns exactly eight, and they all do:

  ```
  apps/web/sentry.server.config.ts          integration
  apps/web/instrumentation-client.ts        integration
  apps/web/instrumentation.ts               integration
  apps/web/next.config.ts                   integration
  apps/web/lib/report-client-error.ts       crossing
  packages/observability/src/report-error.ts        crossing
  packages/observability/src/trace-context.ts       crossing
  packages/observability/src/trace-context.test.ts  a crossing's test
  ```

  **A ninth path is the finding.** A new name on that list is either a module that belongs in a list
  above — add it, and re-count the swap cost — or vendor coupling that has escaped the seam, which is
  the thing this ADR exists to prevent. Nothing under `apps/web/app/` may ever appear.

- **The report is observable from stdout.** Because the seam returns the event id and the log line
  carries it as `event_id`, "exactly one event" is countable by reading the dev server's output — no
  account, no mock, no dashboard. That property exists only because the seam adds the id; it is the
  concrete thing this ADR buys beyond tidiness.
- **The seam cannot propagate a failure.** A thrown SDK error, a network failure, or a quota rejection
  returns `undefined` and never escapes, because the caller logs immediately afterwards and an
  exception here would suppress that line — leaving the incident in neither sink at the moment both
  are needed.
- **Framework integration is a maintenance surface we accept.** An SDK upgrade that changes
  `captureRequestError`'s signature or `instrumentation-client.ts`'s expected exports is a change we
  make by hand, in the files named above. That is the price of not wrapping them, and it is the right
  price: the alternative is discovering the change through degraded event quality rather than through
  a type error.
- **The edge runtime reaches neither sink.** `@repo/observability` cannot load in Next's edge runtime,
  which is the server-only seam working as designed. A downstream project that adds a `middleware.ts`
  gets no event and no log line for an error thrown there. Recorded so it is found in this file rather
  than during an incident.
- **Choosing a vendor settles a processor and its retention schedule for every clone.** The go-live
  runbook states it so a regulated adopter finds it before an audit rather than after.
