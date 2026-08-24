---
stage: spec
status: approved
reviewed: 2026-08-22 fidelity
issue: 30
intent: ./intent.md
---

# Spec: Observability — structured logs, an owned error shape, and reported-once errors

## Problem Statement

Someone who clones this template cannot find out what their application did. There is no logger, no
error shape, no error boundary, and no error reporting, so the first production incident is
diagnosed by guesswork and every decision that should have been made calmly gets made at once, under
time pressure, by whoever is on call.

An agent working in this repo has the same gap from the other side. Nothing in `CLAUDE.md`, no
skill, and no lint rule says how to emit a diagnostic, so it reaches for `console.log` —
unstructured, uncorrelated, invisible to a drain, and, because nothing distinguishes an operator
audience from a user audience, a candidate for leaking server-side detail into a browser.

Underneath both, the Maintain stage of the SDLC loop this template exists to demonstrate has no
input. `README.md` describes deterministic monitoring escalating by tier and `/triage` promoting
findings back into Plan; [ADR-0001](../../adr/0001-findings-enter-through-triage.md) builds the whole
findings model on that edge. Nothing in the template emits anything to monitor, so Plan, Design, and
Build are wired and Maintain cannot be.

## Solution

The template ships a logger, an error shape, and error reporting already wired together, plus the
policy that governs them written where a human and an agent both read it.

Three parts with three jobs and no overlap. **pino** owns operational logs and writes to stdout.
**`AppError`** owns the shape, and reports nothing itself. **One function this repo owns —
`reportError` — is the single server-side report site**, and Sentry sits behind it.

Three rules make the parts non-overlapping.

**Thrown is reported, returned is logged.** An error that escapes a request reaches Next's
`onRequestError`, which calls `reportError` once and emits one correlated log line. An error handled
and returned through `toErrorResponse` produces one `warn` line and no event. That is what prevents
double-reporting, and it is the only quota lever — there is no second filter behind it.

**Every egress is an explicit projection.** `AppError` has **no `toJSON`**, so `JSON.stringify` on
one cannot publish operator prose by accident. Two named methods exist instead: one builds the
whitelisted client shape, one builds the operator shape for the log line. Adding a field to the type
reaches neither until someone writes it into a projection.

**The report is observable from stdout.** `reportError` returns the event id and the log line carries
it as `event_id`. "Exactly one event" therefore becomes "exactly one line carrying an `event_id`" —
countable by reading the dev server's output, with no Sentry account and no mock.

A fresh clone runs, builds, and passes every check with no account and no configuration. With no DSN
the Sentry SDK is never initialised at all, and exactly one line at startup says so.

## User Stories

Prioritized. Each is demoable on its own, because each becomes a tracer-bullet ticket.

**Must**

1. As a developer cloning this template, I want a configured structured logger I can import and call,
   emitting JSON on stdout with the service, environment, and release on every line, so that I never
   choose a logger during an incident and my drain can tell which deployment produced a line.
2. As a developer running `pnpm dev`, I want log lines pretty-printed by default and JSON available
   through one documented switch, so that the stream is readable by me and parseable by an agent.
3. As a developer, I want one error type that separates operator detail from a single user-facing
   string and is importable on both the server and the client, so that the audience split is a
   property of the type rather than a habit of the caller.
4. As a developer writing a Route Handler, I want a framework-agnostic helper that turns any error
   into a response whose body is built from a whitelist, so that adding a field to the error type
   cannot leak it and an unrecognised throw produces a generic response.
5. As a developer writing a Server Action or passing an error to a Client Component, I want the same
   whitelist applied to that egress, so that the RSC payload cannot carry operator prose the wire
   helper would have stripped.
6. As an on-call engineer, I want an uncaught server error to produce exactly one report and exactly
   one log line carrying both the same trace identifier and the report's event id, so that one
   incident costs one event and I can pivot between the drain and the reporting platform in either
   direction.
7. As an on-call engineer, I want one `info` line per completed request carrying route, status, and
   duration, so that I can express an error count as a rate and tell a spike from a busy Tuesday.
8. As a user of a product built from this template, I want an error page that says something went
   wrong, offers a retry, and shows a reference identifier without exposing internals, so that I can
   quote it to support.
9. As a developer evaluating this template, I want `pnpm install`, `dev`, `build`, `lint`,
   `check-types`, and `test` to all succeed with no monitoring account and no configuration, and
   exactly one startup line telling me error reporting is inactive.
10. As a developer going live, I want a runbook naming every environment variable and which are
    needed at build time versus runtime; the free tier's caps and the fact it drops data rather than
    billing; the quota mitigations to switch on; the drain check that proves correlation works; the
    four places a deletion request must reach; the Sentry hosts a future CSP must allow; the
    expression that populates the release; and the one-or-two-line switch that starts forwarding logs.
11. As a security-conscious developer, I want one shipped redaction list applied identically to log
    lines, to server events, and to browser events, named in the README as a placeholder I extend, so
    that the three paths cannot disagree and I know the list is mine to complete.
12. As an agent working in this repo, I want `console.log` to fail `pnpm lint` and the logging and
    error conventions written in `CLAUDE.md`, so that I apply them without being asked.
13. As a maintainer, I want the vendor seam and the no-`toJSON` projection rule recorded as ADRs, and
    the settled vendor and log level written into `docs/policy/operability.md`, so that a future
    reader inherits the decisions rather than re-deriving them.
14. As a maintainer, I want every value this effort makes project-specific listed in `README.md`'s
    placeholder table, so that a downstream project knows what is mine to change.
15. As an on-call engineer, I want a control-band breach to arrive as a `needs-triage` issue carrying
    the band, the observed value, the affected surface, and the first thing to check, so that the
    Maintain → Plan edge runs end to end instead of being documented.
16. As a developer learning the template, I want one worked example Route Handler showing both the
    handled-and-returned path and the rethrown path, so that I learn the intended usage from running
    code rather than from a test file.

## Non-functional requirements

- **NFR1 — Fresh-clone cleanliness.** With **zero** observability environment variables set,
  `pnpm install && pnpm lint && pnpm check-types && pnpm test && pnpm build` all exit `0`, and the
  Sentry build plugin emits **zero** error-level lines. **Binds:** 9.
- **NFR2 — Startup notice volume.** Reporting-inactive produces **exactly 1** line per server
  instance, at `warn` so it survives the production `info` floor, and **0** further lines about it
  per request. **Binds:** 9.
- **NFR3 — Report-once, observable from stdout.** One uncaught server error produces **exactly 1**
  log line at `error` carrying a non-empty `event_id`. A handled error returned through
  `toErrorResponse` produces **1** line at `warn` and **0** lines carrying an `event_id`.
  **Binds:** 6, 8, 16.
- **NFR4 — Client-bundle purity.** **0** bytes of `pino`, `pino-pretty`, `thread-stream`, or
  `sonic-boom` appear in any file under `apps/web/.next/static/`. **Binds:** 1, 3.
- **NFR5 — Correlation.** While reporting is active, **100%** of log lines emitted during
  **uncached** request execution carry `trace_id` and `span_id` equal to those on the event Sentry
  received for that request. Lines emitted inside a `use cache` scope are excluded because they
  describe the cache fill, not the request — see the deep dive. **Binds:** 1, 6, 7.
- **NFR6 — Node floor.** Every dependency added by this effort declares an `engines.node` that admits
  **every** `24.x`, or declares none. Verified at Design against the versions this spec pins:
  `@sentry/nextjs@10.70.0` declares `>=18`; `pino@10` and `pino-pretty@13` declare none.
  **Binds:** 1, 6.
- **NFR7 — Lint enforcement.** A `console.log` or `console.debug` call anywhere under `apps/**` or
  `packages/**` makes `pnpm lint` exit non-zero. `console.error` and `console.warn` do not.
  **Binds:** 12.
- **NFR8 — Log level floor.** Default `info` in production and `debug` in development, overridable at
  runtime by `LOG_LEVEL` without a rebuild. Settles `log-level-production`. **Binds:** 1, 13.
- **NFR9 — Format switch.** `LOG_FORMAT=json` in development makes **every** line the logger writes
  to stdout parse with a bare `JSON.parse`, with no preprocessing. **Binds:** 2.
- **NFR10 — Redaction parity across three egresses.** For one input object carrying a value at every
  shipped key name, **each** of the three egresses — the log line, the server event, the browser
  event — replaces **every** one with the same placeholder, to a nesting **depth of 4**. **Binds:** 11.
- **NFR11 — Accessibility.** Both error boundaries clear **WCAG 2.2 AA** (`docs/policy/ux.md` →
  `wcag-level`), including at the root boundary where the design system's stylesheet is not mounted
  and the page follows the OS colour scheme rather than the app's theme. **Binds:** 8.
- **NFR12 — Quota discipline.** Default production trace sample rate **≤ 0.1**; session replay and
  user-feedback integrations contribute **0** bytes to the client bundle. There is **no** status-based
  pre-send filter — the thrown/returned rule is the only lever. **Binds:** 6, 10.
- **NFR13 — Environment declaration.** Every environment variable this effort introduces appears in
  `turbo.json`. `SENTRY_AUTH_TOKEN` appears as a **task-scoped** `passThroughEnv` on `web#build`
  only, and in **no** other task. `turbo build --dry` lists each one. **Binds:** 1, 2, 6, 9, 10.
- **NFR14 — Placeholder completeness.** Every project-specific value this effort introduces has a row
  in `README.md`'s "Placeholders to change". **Binds:** 10, 11, 14.
- **NFR15 — The audience split, counted.** For an `AppError` whose `message` and every value in
  `context` carries a distinct sentinel string, the serialized Route Handler body and the serialized
  Server Action projection each contain **0** occurrences of any sentinel and **exactly 3** keys.
  **Binds:** 3, 4, 5, 16.
- **NFR16 — Log line bound, and what the bound preserves.** A serialized line exceeding **8 KB** is
  truncated to 8 KB and carries `truncated: true`, rather than being dropped.

  **The size is half the requirement, and shipping only that half is what this NFR got wrong.** A line
  that meets a byte count and cannot be debugged from has passed the number and failed the purpose —
  and it passes green, which is worse, because nothing is left to fail. NFR15 immediately above already
  has the missing shape: it says what the output must _contain_, not only how large it may be. So the
  second half, graded the same way.

  For an `AppError` carrying a `context` of identifiers and a development-depth stack, a truncated line
  carries every stability-contract base field, `code`, `status`, `request_id`, a non-empty operator
  `message`, **≥ 1** key of `context`, and **≥ 1** stack frame naming application code — and it names,
  in the line itself, every field it dropped or shortened. Where the budget forces a choice it is
  spent on what a human debugs from before what a framework produced.

  **The `context` guarantee holds at every level the field appears, not at the level a finding
  happened to exercise.** The line's own top-level `context` — where `logRequestError` and
  `logRequestComplete` put their identifiers — keeps its keys under the same selection as an
  `err.context`, and a record nested inside either is selected from rather than taken or dropped
  whole. Build established this by making admission one mechanism applied recursively, so the
  guarantee is structural rather than enumerated. The budget's priority order is part of the
  requirement: contract fields, then identifiers, then prose shortened into what remains, then `err`
  sized to what is left — an oversized message may cost itself but never the ids.

  **Binds:** 1, 11.

- **NFR17 — Request-completion line.** Every completed request emits **exactly 1** `info` line
  carrying `route`, `status`, `duration_ms`, and `trace_id` as top-level fields. **Binds:** 7.
- **NFR18 — Correlation-loss band.** `error`-level lines lacking `trace_id` while reporting is active
  stay **≤ 1%** over a rolling 1h window. Outside it, a `needs-triage` issue. **Binds:** 6, 7, 15.

## Core entities

**`AppError`** — one error, five fields plus a cause. `code` (free string, no taxonomy ships),
`status` (HTTP), `message` (operator-facing English), `userMessage` (the only string permitted to
reach a browser), `requestId` — **generated server-side with `crypto.randomUUID()`, never read from
an inbound header**, so no attacker-controlled text reaches the pretty dev stream an agent reads —
and `context` (one nested object for everything else). Two named
projections and **no `toJSON`**. `cause` is carried but never appears in either projection — and
neither does `requestId` on the operator side. It is lifted to the log line's own top level as
`request_id` rather than duplicated inside `err`, so the lookup a support ticket starts from resolves
without reaching into a nested object and survives truncation. It stays in the client projection,
which is the egress a user reads it from. See
[ADR-0005](../../adr/0005-log-line-fields-are-named-for-the-line.md).

Why one `context` rather than a flat/nested pair: a caller choosing between two containers with no
stated rule chooses by coin flip, and the rule that would decide it — redaction reaches known key
names to depth 4, so nothing unclassified goes in — applies identically to both.

**Classification.** `context` is `internal` at most: it carries identifiers and shapes — ids, counts,
enum values, truncated inputs — never credentials, tokens, whole request bodies, or raw personal
data. `secret` never enters it. This is the rule redaction cannot enforce, which is why it is written
in `CLAUDE.md` rather than implied by a list.

**Wire error body** — the whitelisted projection: `code`, `message` (the `userMessage`), and
`requestId`. Exactly three keys, on both the Route Handler egress and the Server Action / RSC egress.

**Log line** — one JSON object per emit. Guaranteed base fields on every line: `service`, `env`,
`release`, `level`, `time`, `msg`. Inside an uncached request with reporting active: `trace_id`,
`span_id`. On a report: `event_id`. Request-error lines lift `code`, `status`, and `request_id` to
the top level, so the three lookups an operator actually runs — by failure code, by status, and by
the reference a user quotes — resolve without parsing `err`. Request-completion lines add `route`,
`status`, `duration_ms`, and `context.path`. Everything else is free-form under `context`.

**Field names on a line are `snake_case`, all of them.** The line is its own namespace and names what
it carries for itself, whatever the source called it. That costs exactly one rename —
`AppError.requestId` reaches the line as `request_id` — and buys a casing a query author can predict
without first knowing which entity a field came from; `trace_id` and `span_id` cross no mapping layer
at all. [ADR-0005](../../adr/0005-log-line-fields-are-named-for-the-line.md) is the rule, and is
honest about the one price: the browser still receives `requestId`, so that identifier has two
spellings across that hop and one identical value on both sides. `err`'s own keys are the serialised
entity's property names and are **not** renamed — the rule governs the line's fields, not the
contents of a value the line carries.

**`route` is bounded and `context.path` is not, deliberately.** `route` is the matched pattern or the
literal `unknown`; it is what a drain groups by, so a value that changes every build — a hashed asset
path — may never reach it. The concrete path is real diagnostic detail, so it travels under `context`
where high cardinality is expected. Build established both; see story 7.

**Unboundedness has a second axis, and cardinality is only the first.** The paragraph above weighs what
the field costs a drain; it does not weigh what the field carries. `context.path` is set on **every**
completed request and is stripped of its query and hash only, so a credential in a path **segment** —
a password-reset token, a signed invite, an unsubscribe link — reaches the line verbatim. That is not
closed here and cannot be: no mechanism this template can hold separates `rp_9f81c2d4e0a7` from `42`,
and any bound lands equally on `/orders/42`, where the concrete segment is the field's whole purpose.
The exposure is named instead — `secrets-in-url-paths` in `docs/policy/security.md`, a third threat in
the go-live runbook with the recipe for bounding it, and
[ADR-0006](../../adr/0006-name-the-exposure-rather-than-ship-a-heuristic.md) for the argument, the
rejected options, and the precedent it sets for every future field the template writes on a caller's
behalf. Found after Build; see **Further Notes**.

**The guaranteed names above are a stability contract.** Every clone's drain queries and saved
searches bind to them, and no clone can be migrated by us — renaming one later is a one-way change
with no forward fix available to the person it breaks.

**Redaction list** — one list of **key names**, not paths, because its consumers address different
namespaces: pino's `redact` compiles paths against the object you log, while a Sentry event holds the
same secret at `request.headers.*`, `contexts.*`, `extra.*`, `breadcrumbs[].data.*`, and
`exception.values[].stacktrace.frames[].vars.*`. Each consumer derives its own matcher from the
shared names.

**Reported event** — produced only at the two named report sites, one server and one browser. At most
one per uncaught error.

## API / interface contract

### `@repo/errors` — new workspace, isomorphic, **zero runtime dependencies**

Consumed as source with no build step, matching `@repo/design-system`. May be imported from a Server
Component, a Client Component, a Route Handler, a Server Action, or either instrumentation entry
point. The absent dependency list _is_ the client-safety guarantee.

| Export              | Shape                                                                                                                                                                       | Who may call it                   |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `AppError`          | `class AppError extends Error`. **No `toJSON`.**                                                                                                                            | Anyone, either side of the wire   |
| `.toClientError()`  | `() => { code, message, requestId }` — the whitelist, built field by field                                                                                                  | `toErrorResponse`; Server Actions |
| `.toOperatorJSON()` | `() => { code, status, message, userMessage, context }` — the operator shape for the log line. **Five keys: no `requestId`**, which the line lifts. Never reaches a browser | `@repo/observability` only        |
| `isAppError`        | `(value: unknown) => value is AppError`, checked against a **registered symbol**                                                                                            | Anyone                            |
| `toErrorResponse`   | `(error: unknown) => { status, body, headers }` — a plain value, **not** a framework `Response`                                                                             | Any Route Handler, any framework  |
| `scrubEvent`        | `(event: T) => T`, **pure**, typed structurally over the carrier keys — no Sentry import                                                                                    | Both Sentry inits; tests          |

Four rules the implementation follows literally:

- **Identity is a registered symbol**, because Next compiles the server and client graphs as separate
  realms and a prototype check does not survive that. But `Symbol.for()` is a shared registry, so
  `isAppError` is a **claim, not a proof**: `toClientError` therefore validates the type and length of
  every field it copies and never trusts `status` to be a number in range.
- **`userMessage` defaults to a module constant, never to `message`.** Defaulting to the operator
  message is the single mistake that turns this design into a leak.
- **Both projections build field by field from a whitelist.** A deny-list means the next field added
  to the type leaks by default. An input that fails `isAppError` produces a generic 500 carrying
  nothing from the original.
- **`scrubEvent` fails closed.** If it throws on a malformed event, the caller drops the event rather
  than sending it unscrubbed. That is a design decision, not a vendor default.

The redaction **key-name list itself is module-internal**. Parity is proved by running the two
consumers over one input, not by exporting a constant a downstream project would pin.

### `@repo/observability` — new workspace, **server-only**

Depends on `@repo/errors`, `pino`, `pino-pretty`, and `@sentry/nextjs`. Kept out of the browser by
the dependency graph, with a runtime browser-global guard as a backstop.

| Export                       | Shape                                                                                                                                                 | Who may call it                     |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `logger`                     | The module singleton, a `pino.Logger`                                                                                                                 | Any server module                   |
| `createLoggerOptions`        | `(env) => LoggerOptions` — pure, exported **as the stdout test seam**                                                                                 | Tests; the module itself            |
| `reportError`                | `(error, request, context, client?) => string \| undefined` — **the vendor seam**. Delegates to `Sentry.captureRequestError` and returns the event id | `reportRequestError` only           |
| `reportRequestError`         | `(error, request, context, logger?, client?) => string \| undefined` — report first, then log with the returned id                                    | `instrumentation.ts` only           |
| `logRequestComplete`         | `(fields, logger?) => void` — the NFR17 emit; defaulted logger param is the injection point                                                           | `subscribeRequestCompletion`, tests |
| `subscribeRequestCompletion` | `(logger?) => void` — idempotent; subscribes the emit to the process's HTTP traffic. **This** is what the entry point calls                           | `instrumentation.ts` only           |
| `routeOf` / `pathOf`         | `(request) => string` — the bounded route pattern, and the concrete path. Pure, and exported because the fallbacks are what need testing              | `subscribeRequestCompletion`, tests |

**What crosses the seam and what does not** — the question [Q1](./intent.md) requires this spec to
answer explicitly.

_Crosses (owned by this repo):_ `reportError`, `reportRequestError`, and `scrubEvent`. Application
code never names Sentry.

**The seam delegates to the SDK's capture helper; it does not replace it.** `reportError` calls
`Sentry.captureRequestError` and adds exactly one thing the helper does not provide — the event id,
which NFR3 needs on the log line. Build established that these are not in tension, correcting a first
implementation that bypassed the helper to obtain the id and lost real reporting quality doing it;
see **Further Notes**.

_Stays Sentry-specific, deliberately:_ `instrumentation.ts` / `instrumentation-client.ts`
registration, `sentry.server.config.ts`, `withSentryConfig()`, `Sentry.captureRequestError`, and
source-map upload. These are framework integration, not error reporting, and wrapping them would hide
exactly what makes `@sentry/nextjs` worth having — automatic instrumentation, span propagation, and
the trace context NFR5 depends on. A vendor swap replaces one module plus the integration files and
touches **no call site**. Recorded as an ADR (story 13).

### `apps/web`

| Surface                                 | Shape                                                                         | Exposure                         |
| --------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------- |
| `instrumentation.ts`                    | `register()` and `onRequestError`                                             | Server                           |
| `instrumentation-client.ts`             | Sentry browser init + `scrubEvent`. **Must not import `@repo/observability`** | Browser                          |
| `sentry.server.config.ts`               | The one server reporting-configuration module                                 | Server, imported only with a DSN |
| `app/error.tsx`, `app/global-error.tsx` | Client error boundaries                                                       | Browser                          |
| `lib/report-client-error.ts`            | The single **browser** report site, holding the digest guard                  | The two boundaries only          |

No `sentry.edge.config.ts` and no `app/not-found.tsx` — see Further Notes for both.

### Environment variables

| Variable                       | When            | Turborepo                       | Effect                                                                                                                              |
| ------------------------------ | --------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SENTRY_DSN`       | Build + runtime | Hashed on `build`               | Absent ⇒ the SDK is never initialised                                                                                               |
| `SENTRY_ORG`, `SENTRY_PROJECT` | Build           | Hashed on `build`               | Source-map upload target                                                                                                            |
| `SENTRY_AUTH_TOKEN`            | Build           | `passThroughEnv` on `web#build` | Secret. Lives in the environment, never `.env*`                                                                                     |
| `NEXT_PUBLIC_RELEASE`          | Build + runtime | Hashed on `build`               | The `release` base field. A commit SHA by default, tweakable per project. Published to every browser, so nothing else belongs in it |
| `LOG_LEVEL`                    | Runtime         | `globalPassThroughEnv`          | Overrides the NFR8 floor without a rebuild                                                                                          |
| `LOG_FORMAT`                   | Runtime         | `globalPassThroughEnv`          | `json` \| `pretty`; NFR9's switch                                                                                                   |
| `LOG_MAX_LINE_BYTES`           | Runtime         | `globalPassThroughEnv`          | Moves NFR16's bound for one session. Default 8 KB in **every** environment; an unusable value falls back to it rather than throwing |

`SENTRY_AUTH_TOKEN` is task-scoped rather than global because `globalPassThroughEnv` hands a
write-scoped token to `dev`, `lint`, `test`, and `check-types`, which none of them need. And it must
not live in `.env.local`: `turbo.json` declares `.env*` as a `build` input, so its **content** is
hashed into the build key regardless of how the variable is declared, and under remote caching it
would travel with the artifact.

## High-level design

**Two packages, and the split is physical.** `@repo/errors` is isomorphic with zero dependencies;
`@repo/observability` is server-only. One package with two entry points was considered and rejected:
a semantic subpath _documents_ a boundary, a separate dependency-free package _enforces_ it — an
`import pino` inside `@repo/errors` fails to **resolve** under pnpm's isolated store, where a subpath
would only fail a `.next/static` grep after the fact.

That split is also why `scrubEvent` and the redaction list live in `@repo/errors` rather than
alongside the logger. Three egresses need them and one of the three is a browser module forbidden
from importing `@repo/observability`; a scrubber the client cannot reach is a redaction list that
disagrees with itself by construction.

**Stories 1, 2 — the logger.** `createLoggerOptions(env)` is pure and returns pino options: level
from `LOG_LEVEL` defaulting by `NODE_ENV`; base fields `service`, `env`, `release`, **replacing**
pino's `pid`/`hostname`, which are noise on serverless; redaction paths derived from the shared key
names; an error serialiser that calls `toOperatorJSON()`; a mixin reading `trace_id`/`span_id` from
the active Sentry span via `spanToJSON()`, whose output is already `snake_case`; a level formatter
emitting the name; and the NFR16 size cap.

`LOG_FORMAT` selects the destination — `pino.destination({ fd: 1, sync: true })` for `json`, a
`pino-pretty` **stream** for `pretty`. Deliberately a same-thread destination and **not**
`transport: { target: "pino-pretty" }`: a transport runs in a worker thread, which is the mechanism
[Q2](./intent.md) asked Design to confirm cannot collide with [Q3](./intent.md)'s forwarding path.
Constructing it as a destination removes the worker entirely, answering the question structurally.
`sync: true` is right at template scale; revisit above roughly 1000 lines/sec/instance, where a
blocked event loop costs more than the last lines lost to a hard crash.

**Stories 3, 4, 5 — the error shape and its two egresses.** `toErrorResponse` returns a plain
`{ status, body, headers }`, so `@repo/errors` needs no framework types. `toClientError()` is the
same whitelist in a bare object, for the Server Action return value and for any `AppError` passed as
a prop — the egress `toErrorResponse` never sees, because a Server Action does not return a
`Response` and the RSC payload serializes whatever it is given.

**Story 6 — report-once.** `onRequestError` is the single server report site. It calls
`reportRequestError` first, while the active span is still resolvable, then emits the log line
carrying the returned `event_id` and the `trace_id` from that same span. The report **cannot
propagate**: a thrown SDK error, a network failure, or a quota rejection must not suppress the log
line, or the incident appears in neither sink at exactly the moment both are needed.

**The event id is recovered from `lastEventId()`, read twice.** `captureRequestError` returns `void`,
discarding the id, and `lastEventId()` lives on the SDK's isolation scope and survives the call that
set it — so a single read after a capture that had not completed synchronously would return the
_previous_ error's id. A log line pointing confidently at the wrong event is worse than one carrying
no id, so the value is compared before and after and the failure mode is `undefined` rather than
wrong.

**Story 7 — the request-completion line.** One `info` line per completed request from
`onRequestError`'s sibling path in `instrumentation.ts`. Without traffic, an error count cannot be
read as a rate, and a spike is indistinguishable from a busy Tuesday.

**The sibling path is `node:diagnostics_channel`, and Build had to establish that** — this spec named
no mechanism because Next exposes none. `InstrumentationModule` is `{ register?, onRequestError? }`
and neither fires on a request that succeeds. The obvious candidate is disqualified: a span end
(`onEnd`, or the SDK's `spanEnd`) never runs for an unsampled span, so at NFR12's
`tracesSampleRate: 0.1` roughly nine in ten production requests would emit **no line**, and a fresh
clone with no DSN would emit none at all. `http.server.request.start` / `http.server.response.finish`
fire exactly once per completed request in every configuration, cost no dependency, and are
indifferent to whether reporting is on. `trace_id` needs no new plumbing: the active span is still
resolvable on that path, so the mixin contributes it as it does to every other line.

**`route` is the matched pattern, and it does not come from the span.** It has to be the pattern, or
it does not join with the `route` on an error line and NFR18's band is measuring a different field.
The span carries the pattern only when sampled — 5 of 30 requests at 0.1 — so it is read from the
framework's per-request meta instead. That is **one framework internal**, and the cost is stated
rather than hidden: it is reached through a fully guarded reader whose every step is type-checked, so
an upgrade that moves it degrades `route` to `unknown` and never throws, never drops the line, and
never fails the build.

**The subscription lives in `@repo/observability`, not in `instrumentation.ts`.** Next compiles that
file for both runtimes, and a `node:diagnostics_channel` specifier written into it warns on every
build — a runtime guard inside a dynamic `import` does not hide a specifier from a bundler. The
package's `browser` export condition resolves the whole module away instead, which is the same
mechanism DD2 relies on and is what keeps NFR1's fresh-clone build clean.

**Story 8 — the boundaries.** Both guard reporting on the **absence of a `digest`**: a digest means
the error was thrown on the server and already reported. This diverges from Sentry's documented
example, which reports unconditionally, and the divergence is commented at the call site.
`global-error.tsx` replaces the root layout, so no stylesheet, fonts, or `ThemeProvider` are mounted.

**Story 9 — the no-configuration path.** An empty DSN or `enabled: false` still installs Sentry's
tracing provider, propagator, context manager, and module-loader hooks on every boot. The only clean
off-switch is **not calling `init`**, so `register()` checks for a DSN _before_ importing
`sentry.server.config.ts`. `sendDefaultPii` is pinned `false` explicitly on both inits rather than
inherited — the wizard-generated config sets it `true`, which would send IP, cookies, and headers,
every one of them `personal` under `docs/policy/data.md`, to a processor no downstream project chose.

**Story 12 — the conventions.** `"no-console": ["error", { "allow": ["error", "warn"] }]` in the root
`.oxlintrc.json`. pino writes through `process.stdout`, not `console`, so no workspace needs an
exemption.

## Deep dives

One per requirement the high-level design does not already satisfy.

### DD1 — Correlation under Cache Components (NFR5, NFR18)

`cacheComponents: true` is on, so a downstream project's data access is cached by default. **A log
call inside a `use cache` scope runs at cache-fill time, not request time**: it emits once per miss,
carries the `trace_id` of whichever request populated the entry, and emits nothing at all on a hit.
An unscoped "100% of lines correlate" is falsifiable the first day a clone adds `use cache`, and
worse, it mis-attributes one user's incident to another user's trace.

Two rules, both in `CLAUDE.md`: **log at the dynamic boundary, never inside a cached function**, and
**an `AppError` may not be returned from a cached function** — a returned error is an ordinary value,
so a cached one becomes a shared entry serving one request's `requestId` to every later user.

NFR5 is scoped to uncached execution accordingly. What catches the residue at runtime is NFR18's
band, because the mixin reads the _active_ span and async-context loss after an `await` returns
`undefined` in production and never in a test.

### DD2 — The fresh clone (NFR1, NFR2)

The fresh-clone path is the single most important check for a template, and three things break it.
Source-map upload runs only when the full `SENTRY_ORG` + `SENTRY_PROJECT` + `SENTRY_AUTH_TOKEN`
triple is present, so a clone builds without an error-level warning about a missing token. Nothing is
added to `serverExternalPackages`: Next's defaults already contain pino, pino-pretty, and
thread-stream, and supplying an explicit list risks trimming those defaults later. And `pino` is
declared a **direct dependency of `apps/web` even though the app never imports it**, as the mitigation
for a monorepo resolution defect — the reason is documented in `apps/web/package.json`, or a future
dependency cleanup deletes it.

The startup notice is `warn`, not `info`, so it survives the production floor. In production it is
also emitted when `NEXT_PUBLIC_RELEASE` is absent: nothing populates it without CI, and a constant
`release` makes "did this start at the last deploy?" — the first question of every incident —
unanswerable.

### DD3 — Redaction across three egresses (NFR10)

Three egresses, one list of key names, three derived matchers: pino paths generated at known roots;
a recursive walk to depth 4 in `scrubEvent` for the server event; the same `scrubEvent` on the browser
init. Redaction addresses the **post-serialisation** object, because `cause.config.headers.authorization`
only exists after the error serialiser has run — so NFR10's fixture carries a nested `cause`, not a
flat object, or the test passes on a shape no incident produces.

`cause`'s authority is settled: neither projection carries it, and the pino error serialiser is the
only thing that walks it, with the scrubber applied.

`scrubEvent` is wired to **all three** Sentry hooks — `beforeSend`, `beforeSendTransaction`, and
`beforeBreadcrumb` — because NFR12 keeps `tracesSampleRate` at 0.1, so transactions ship too, carrying
URLs with query strings and span attributes through a hook a scrubber typed only to `ErrorEvent`
would miss.

The list is **advisory** ([Q4](./intent.md)) and its tests assert the mechanism works on the shipped
names, never that the names are sufficient — which would encode a false guarantee.

### DD4 — Quota, and the release moment (NFR12, NFR18)

The free tier **drops data rather than billing** at the cap, so exceeding it means the application
becomes silently unmonitored — the observability system's own failure invisible to itself. Two
consequences the runbook carries as numbers at pin time: alert at **80%** of the monthly error
allowance, and treat any 24h window above **1/15th** of it as a spike.

**A breach lands as a `needs-triage` issue in this repo, opened by Sentry's webhook.** That follows
from ADR-0001 rather than being chosen here: findings reach Plan only through `/triage`, so any other
destination would contradict it. The webhook target itself is a per-project setting, which is why
`alert-destination` stays `UNSET`.

`NEXT_PUBLIC_SENTRY_DSN` is public by construction — that is how Sentry works — which means anyone
reading the client bundle can POST into the quota and blind the monitoring during an incident they
caused. The mitigations are Sentry-side and belong in the runbook: spike protection, inbound filters,
and allowed domains.

Session replay and user feedback are **not installed at all** rather than sampled to zero: they are a
large client bundle cost for a capped feature, and the feedback widget would render into the
placeholder app.

### DD5 — Build, cache, and secrets (NFR13)

Turborepo's strict environment mode **filters an undeclared variable out of the task environment
entirely**, not merely out of the hash — so NFR13 is a correctness requirement, not tidiness.
Build-affecting variables are declared on `build` because they are baked into output; `LOG_LEVEL`,
`LOG_FORMAT`, and `LOG_MAX_LINE_BYTES` are globally passed through because they change runtime
behaviour only, and hashing them would invalidate the cache for values the build never reads.

Source maps are **deleted from the deployed output after upload**. Left behind, the app's full client
and server source is publicly fetchable — `internal` data served as `public` — and this is the one
irreversible action in the whole effort.

pnpm needs public hoist patterns for the two module-interception packages Sentry relies on
(`import-in-the-middle`, `require-in-the-middle`). Per `CLAUDE.md`, pnpm 11 reads its settings from
**`pnpm-workspace.yaml`**, not `.npmrc` — which also means the entry lands in a file pnpm owns and
oxfmt ignores.

### DD6 — Rollback classes

Not uniform, and the spec should not pretend otherwise. `@repo/errors` and `@repo/observability` are
**code-only** — redeploy the previous build. `LOG_LEVEL` / `LOG_FORMAT` / `LOG_MAX_LINE_BYTES` and the
`no-console` rule are **config**, seconds. `withSentryConfig()` in `next.config.ts` is code-only but fails `pnpm build` for
every downstream consumer, so its blast radius exceeds its class. **Source-map upload is one-way**:
you cannot un-publish a downstream project's source to a third party, and the forward fix is deleting
the release artifacts in Sentry and rotating `SENTRY_AUTH_TOKEN`.

**`redeploy-previous-build` is the documented default**, and a project may set something else —
feature flags are the obvious alternative and change which mitigations are available mid-incident.
The four classes above hold either way; `rollback-mechanism` stays `UNSET` so the choice is the
project's.

### DD7 — Retention, and the keys that stay `UNSET`

`retention-logs` (`docs/policy/data.md`) and `log-retention` (`docs/policy/operability.md`) **stay
`UNSET`, and that is a decision, not a deferral** ([Q4](./intent.md)). The template has no hosting
target, no drain, and no `compliance-regime`; retention is a first-deploy answer. Recorded here so
the next spec reads a decision rather than a gap. `default-availability` and `default-latency` stay
`UNSET` for the same reason — a template has no traffic shape — which is why every band in this spec
measures the observability system's own health rather than a user-visible SLO.

The one place that reasoning does **not** reach is the reporting path: choosing Sentry settles a
processor and its retention schedule for every clone, which the runbook states so a regulated adopter
finds it before an audit rather than after.

### DD9 — The keys that stay `UNSET`, and what ships instead

Eleven policy keys this effort touched stay `UNSET` **by decision**. Setting one would bake an answer
into every clone of a template that has no deployment, which is the thing `docs/policy/` exists to
prevent; leaving one silently blank is what makes the next spec raise it again. So each is recorded
here with the deliverable that replaces it.

One further key was added **after** this effort shipped — `secrets-in-url-paths`, by ticket #66 — and
is listed with them rather than apart, because the exposure it names is this design's own and the row
would otherwise be the only one without a home.

| Key                               | Why it stays `UNSET`              | What ships instead                                                                                                                                                                                                                                                          |
| --------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hosting-target`                  | No deployment                     | A go-live check: take a `trace_id` from a Sentry event, confirm it returns lines in the drain. Until it passes, NFR5/NFR17/NFR18 are unenforceable and the log half of this design is inert                                                                                 |
| `alert-destination`               | The webhook target is per-project | The destination _shape_ is fixed by ADR-0001 — a `needs-triage` issue                                                                                                                                                                                                       |
| `on-call-rotation`                | Not a template's to assert        | Every band is written as a next-business-day queue, not a page                                                                                                                                                                                                              |
| `error-budget-policy`             | Per-project                       | The runbook states the free tier **drops data rather than billing**, so a spent quota means the second incident of the month is invisible                                                                                                                                   |
| `rollback-mechanism`              | Per-project                       | DD6's four classes, with `redeploy-previous-build` as the documented default                                                                                                                                                                                                |
| `secret-store`                    | Per-project                       | The fixed constraint: `SENTRY_AUTH_TOKEN` comes from the environment, **never `.env*`**                                                                                                                                                                                     |
| `compliance-regime`               | Per-project                       | `sendDefaultPii: false` ships pinned, so the default is privacy-preserving before anyone answers                                                                                                                                                                            |
| `threat-model-scope`              | Per-project                       | The runbook names the three threats this effort creates: public-DSN quota exhaustion, log injection through `requestId` (closed at source by `crypto.randomUUID()`), and a credential in a URL path segment reaching `context.path` verbatim (named, not closed — ADR-0006) |
| `secrets-in-url-paths`            | Only the project knows its routes | Added by ticket #66. The runbook carries the recipe for bounding `context.path`; ADR-0006 carries why nothing bounds it by default                                                                                                                                          |
| `dependency-policy`               | No CI to run scanning             | Recorded as arriving with the pipeline                                                                                                                                                                                                                                      |
| `csp-policy`                      | A CSP is its own effort           | The runbook lists the Sentry hosts a future CSP must allow                                                                                                                                                                                                                  |
| `retention-personal`              | No store, no regime               | The runbook lists the four places deletion must reach: the drain, Sentry's retained events, uploaded source maps, any downstream cache                                                                                                                                      |
| `voice-guide` / `browser-support` | Per-project                       | The error copy ships as a placeholder row; `global-error.tsx` uses two `prefers-color-scheme` media queries, so NFR11 holds with no browser floor                                                                                                                           |

**No CSP ships, and that is deliberate.** A CSP is a real surface with real breakage risk and is not
in this intent. Shipping a "reasonable default" is how a CSP nobody understands silently blocks the
browser SDK six months later with no signal — the exact failure the concern existed to name.

### DD8 — Proposed ADRs

- **`docs/adr/0002-reporting-vendor-seam.md`** (`status: proposed`) — Sentry, and the narrow owned
  seam. Required by [Q1](./intent.md).
- **`docs/adr/0003-no-tojson-on-cross-boundary-types.md`** (`status: proposed`) — `AppError` has no
  `toJSON`; every egress is a named projection. Durable precedent for any type crossing the RSC
  boundary, not just this one.

## UX design

**Router case 2 (a state added to an existing surface) and case 4 (agent-facing surfaces).** Not case
3: the boundaries are the `error` state of the app shell, not a new product surface, and running
`impeccable shape` on a page nobody should ever see is the identity-exercise failure the router warns
against. The agent-facing half — the `CLAUDE.md` conventions, the `no-console` rule, and the
`LOG_FORMAT=json` note in `apps/web/AGENTS.md` outside the regenerated markers — routes to
`writing-for-agents` at Build.

**No new Suspense boundary.** This effort adds no data read, so it implies no fallback. The rule it
does add — log at the dynamic boundary, never inside a cached function (DD1) — is what a downstream
project needs when it adds one.

**The state set**, for the app shell's error surface:

| State             | What it shows                                                                                                                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| empty             | Not reachable — the boundary always has a message. Stated so it is not mistaken for missing                                               |
| loading           | Retry in flight: the button reads "Trying again…", `aria-busy` on the container                                                           |
| partial           | Under PPR the shell rendered and a nested boundary failed — `app/error.tsx` renders inside the shell, which is why it must not restyle it |
| error             | The boundary itself throwing escalates to `global-error.tsx`                                                                              |
| permission denied | No auth ships, so no 403 path exists. A downstream project adding one gets a distinct `userMessage`, never the generic copy               |
| success           | `retry()` succeeds, the boundary unmounts, focus moves to the restored content's first heading                                            |

**The copy**, written here rather than at Build:

- `app/error.tsx` — heading "Something went wrong". Body "We hit an unexpected problem. Trying again
  may fix it." Button "Try again". Reference line "Reference: `<id>`".
- `app/global-error.tsx` — heading "Something went wrong". Body "This page could not be loaded.
  Reloading may fix it." Button "Reload". Same reference line.

**The reference identifier is the `digest` when present, and the browser event id otherwise.** For a
server-thrown error the digest is all the browser has — the client never reported it, by the digest
guard — so anything else would be invented. The spec states plainly that **a digest identifies an
error class, not an occurrence**: two users hitting the same bug quote the same string, and the
operator's pivot is digest → Sentry issue → `trace_id` → the drain. That pivot is why NFR3 puts
`event_id` on the log line.

**Keyboard and announcement.** The container is `role="alert"`, so it is announced on mount. Focus
moves to the heading (`tabIndex={-1}`) when the boundary mounts; the retry button is the only
interactive element; after a successful retry focus lands on the restored content's first heading.
Tokens are semantic (`bg-background`, `text-foreground`, `text-muted-foreground`) — except in
`global-error.tsx`, which mounts no stylesheet and therefore carries inline styles that must clear AA
in both OS colour schemes on their own — via **two `prefers-color-scheme` media queries**, not
`light-dark()`. The same amount of code, and it raises no browser-floor question at all.

## Testing Decisions

Seams confirmed with the user at A5. The template has exactly **three destinations** a diagnostic can
reach, and one seam per destination is both the minimum and the natural cut.

1. **The wire** — `toErrorResponse` and `toClientError`. Both return plain values, so neither test
   imports a framework. Covers NFR15's sentinel count, the exact three-key set, the generic-500
   fallback, and the forged-symbol case.
2. **stdout** — `createLoggerOptions`, plus a `pino` instance the test constructs over an in-memory
   writable stream. One call exercises base fields, redaction, the error serialiser, the level
   formatter, and the NFR16 cap. `logRequestComplete` takes a defaulted logger parameter — the only
   concession to testability in the effort, and a defaulted parameter rather than mutable module state.
3. **The reporting platform** — `scrubEvent`, pure, fed fixture events for all three hook shapes.

**No mocks.** If a test needs to mock pino or Sentry, the module boundary is wrong. pino's own test
utility is not used: it asserts on `pid`/`hostname` before stripping them, and these options
deliberately replace those.

**Where the tests run.** Both new packages get `"test": "vitest run"` and a minimal `vitest.config.mts`
carrying `resolve.tsconfigPaths` only — Node default environment, no React plugin, no setup file, no
coverage gate. `turbo run test` picks them up with no `turbo.json` change. `packages/design-system` is
the prior art for the config; there is no prior art for Node-package tests here, so these become it.

**What the seams cannot reach**, verified through `next-dev-loop` against a running dev server: NFR1's
clean build, NFR2's single startup line, NFR3's line counts, NFR11's boundaries, NFR17, and story 16's worked example — which is
also the runtime demo stories 3, 4, and 5 would otherwise lack. NFR3 and
NFR5 are reachable there **only because** the log line carries `event_id` and `trace_id` — without that
they would need a Sentry account, which is why the design puts them on the line.

## Flagged concerns

All resolved by the repo owner, 2026-08-22. Every role in
[`docs/policy/owners.md`](../../policy/owners.md) is `_unassigned_`, so all fourteen roles escalate
to the repo owner — which is the correct behaviour for a one-person project and a loud one for a team
that has outgrown it.

**Three outcomes were available, not two.** Setting a key bakes an answer into every clone of this
template; leaving it `UNSET` and recording _why_ lets the next spec read a decision; leaving it
`UNSET` silently makes every future spec raise it again. Most keys below take the middle path, because
this template has no deployment and answering on a downstream project's behalf is exactly what
`docs/policy/` exists to prevent. See **DD9**.

- [x] **C1** — Whether the template ships any call site for `@repo/errors`.
      **Answer: ship one.** A worked example Route Handler (story 16), a placeholder a downstream
      project deletes. Resolves **C22** with it.
- [x] **C2** — `LOG_FORMAT` default. **Answer: keep the intent's Q2 answer** — pretty in development,
      terse structured JSON in production. Simplicity's inversion is rejected; the +14 packages and
      the unasserted branch are accepted costs, recorded in Further Notes.
- [x] **C3** — Where a control-band breach lands. **Answer: a `needs-triage` issue in this repo,
      opened by Sentry's webhook.** Follows from ADR-0001, which already fixes that findings reach
      Plan only through `/triage`. `alert-destination` stays `UNSET` — the webhook target is a
      per-project setting.
- [x] **C4** — Who answers a breach. **Answer: deferred, recorded.** `on-call-rotation` stays `UNSET`;
      "nobody, business hours only" is a real answer but not one a template may assert for every clone.
- [x] **C5** — What happens when the quota is spent. **Answer: deferred, with the warning shipped.**
      `error-budget-policy` stays `UNSET`; the runbook states that the free tier **drops data rather
      than billing**, so a spent quota means the second incident of the month is invisible because the
      first burned the allowance.
- [x] **C6** — Whether stdout is collected. **Answer: deferred, with a go-live check.**
      `hosting-target` stays `UNSET`; the runbook carries the check — take a `trace_id` from a Sentry
      event and confirm it returns lines in the drain. Until it passes, NFR5, NFR17, and NFR18 are
      unenforceable and the log half of this design is inert.
- [x] **C7** — How a release is undone. **Answer: `redeploy-previous-build` is the documented default,
      adjustable per project** — feature flags are a legitimate alternative and DD6 names them as one.
      `rollback-mechanism` stays `UNSET` so a project sets its own; the four rollback classes in DD6
      hold either way, and source-map upload is one-way regardless.
- [x] **C8** — Where `SENTRY_AUTH_TOKEN` lives. **Answer: deferred, with the constraint fixed.**
      `secret-store` stays `UNSET`; the template fixes that the token comes from the environment and
      **never from `.env*`**, because `turbo.json` declares `.env*` a `build` input and hashes its
      content into the cache key regardless of how the variable is declared.
- [x] **C9** — What may lawfully cross to Sentry. **Answer: deferred.** `compliance-regime` stays
      `UNSET`; `sendDefaultPii: false` ships pinned either way, so the template's default is
      privacy-preserving before anyone answers this.
- [x] **C10** — Who the adversary is. **Answer: deferred, with the threats named.**
      `threat-model-scope` stays `UNSET`; the runbook names the two this effort creates — public-DSN
      quota exhaustion, and log injection through `requestId`, which **C15** closes at the source.
- [x] **C11** — What blocks a release on a CVE. **Answer: deferred.** `dependency-policy` stays
      `UNSET`. Dependabot is a mechanism, not a policy, and there is nowhere to run scanning yet
      because CI is out of scope — so the threshold arrives with the pipeline.
- [x] **C12** — Whether a CSP ships. **Answer: no CSP ships in this effort, and that is deliberate.**
      A CSP is a real surface with real breakage risk and is not in this intent; shipping a "reasonable
      default" is how a CSP nobody understands silently blocks the browser SDK later. What ships instead
      is the input to that decision: the runbook lists the Sentry hosts a future CSP must allow.
      `csp-policy` stays `UNSET`, and the CSP deserves its own intent.
- [x] **C13** — The voice for the error copy. **Answer: professional, and the copy in the UX section
      stands as written.** `voice-guide` stays `UNSET`; the shipped strings gain a placeholder row
      saying they are a downstream project's to rewrite.
- [x] **C14** — The browser floor for `global-error.tsx`. **Answer: two `prefers-color-scheme` media
      queries, not `light-dark()`.** The same amount of code with no browser-floor question at all, so
      `browser-support` stays `UNSET` and NFR11 holds regardless.
- [x] **C15** — Where `requestId` comes from. **Answer: generated server-side with
      `crypto.randomUUID()`, never read from an inbound header.** That closes the log-injection path
      into the pretty dev stream an agent reads. `trace_id` remains the correlation key, but it exists
      only while reporting is active, so it cannot be the `requestId`.
- [x] **C16** — `console.error` as an unredacted third path. **Answer: named in `CLAUDE.md`, and the
      allow-list stays.** Q5 fixed `allow: ["error", "warn"]` and the intent requires _evidence of
      misuse_ before tightening. `CLAUDE.md` states the allowance is for pre-logger bootstrap paths and
      is never an error channel, and records that tightening to no allow-list is the one-line
      correction if review finds it abused.
- [x] **C17** — The deletion path for `personal` data. **Answer: deferred, with the map shipped.**
      `retention-personal` stays `UNSET`; the runbook lists the four places deletion must reach — the
      drain, Sentry's retained events, uploaded source maps, and any downstream cache.
- [x] **C18** — A runtime band for report-once. **Answer: the band is recorded, its escalation
      deferred with C3/C6.** Proposed: more than 1 event per `trace_id` for over 1% of traces in a
      rolling 1h window. It cannot fire until a drain exists.
- [x] **C19** — The redaction depth. **Answer: depth 4, documented as tunable.** Not deferrable — the
      shipped code needs a number, and "bounded" is not testable.
- [x] **C20** — What may go in `NEXT_PUBLIC_RELEASE`. **Answer: a commit SHA by default, tweakable per
      project**, stated in the placeholder row. It is published to every browser, so nothing else
      belongs in it.
- [x] **C21** — How `NEXT_PUBLIC_RELEASE` is produced. **Answer: as proposed** — the runbook names
      `git rev-parse --short HEAD`.
- [x] **C22** — Whether "demoable on its own" holds for stories 3, 4, and 5. **Answer: it holds, given
      C1.** The worked example (story 16) is the runtime demo those three lacked.

## Out of Scope

Inherited from the intent, unchanged: a browser-side log sink; a self-hosted OpenTelemetry collector
or vendor-neutral tracing pipeline; metrics, profiling, uptime checks, cron monitors, and session
replay; alerting rules, dashboards, and SLO definitions; log-based analytics; wiring Vitest into
`apps/web`; and CI.

Added by Design:

- **The Sentry tunnel route.** All three advisors that reached it said the same thing: a tunnel is a
  new unauthenticated inbound POST endpoint relaying arbitrary bodies to a third party — structurally
  the identical surface the intent refuses in its first Out of Scope bullet, needing rate limiting,
  body caps, origin checks, and a schema. A template with no CSP has nothing to tunnel around.
- **`sentry.edge.config.ts`.** Cache Components requires the Node runtime and `runtime = 'edge'` is
  not available, so the edge branch is unreachable rather than merely unused.
- **`app/not-found.tsx`.** `onRequestError` fires when the server captures an **error**; `notFound()`
  is a routing outcome, so "a 404 produces no report" is already true with zero code. A file whose
  stated job is to carry a comment asserting an absence is not worth the WCAG surface it drags along.
  The guarantee moves to the runbook, with the condition attached: it stops holding the day a
  downstream handler throws its own not-found instead of calling `notFound()`. **The cut was written
  as "no report and no log line", and the second half was never true** — a 404 is a completed request
  and so emits one `info` completion line, carrying `route: "/_not-found"` and the concrete path.
  Corrected here and in the runbook by ticket #66; nothing about the cut itself changes.
- **A Content-Security-Policy.** Real breakage risk, not in this intent, and a "reasonable default"
  nobody understands is how a CSP silently blocks the browser SDK later. What ships is the input to
  that decision — the Sentry hosts a future CSP must allow. See **C12**.
- **Shipped example server components.** One worked Route Handler ships (story 16, resolving **C1**);
  a server component example would additionally have to demonstrate the `use cache` rule from DD1,
  which is documentation rather than scaffolding.
- **`defineErrors` and a scoped error-set factory.** No NFR binds it, no story names it, and with
  examples out of scope it would have zero call sites. Adding it later is additive.

## Further Notes

**Advisor recommendations I overrode, and why.**

- **Operability asked for a 404 at `debug` rather than silence**, so a deploy breaking every route
  produces a signal instead of nothing. Overridden: with `app/not-found.tsx` cut on simplicity's
  argument, there is no code site to emit it from, and re-adding the file to carry one `debug` line
  reinstates exactly the surface the cut removed. The traffic signal that actually answers "did every
  route break" is NFR17's request-completion line, which carries `status`.
- **Simplicity asked to narrow `isReportingEnabled` and the redaction list to module-internal.**
  Taken for both — but only half for the reason given. The list is internal because parity is proved
  by running its consumers, not by exporting a constant a downstream project would pin; `scrubEvent`
  stays exported because three egresses across two packages need it, which is the opposite of the
  narrowing simplicity was arguing for and is forced by security's and data's finding.
- **Simplicity asked to keep `attributes`/`metadata` collapsed and drop `scope`/`reason`/`hint`.**
  Taken in full. Data had asked for the two caller-supplied fields to be classified separately; with
  one field there is one classification, which is strictly simpler and loses nothing.
- **Data asked for `retention-logs`/`log-retention` to be raised as a concern** so the decision is
  visible. Not raised as a concern — the intent's Q4 already settled it, and re-raising a settled
  question is how a decision becomes a gap again. It is stated as a decision in DD7 instead, which is
  what Q4 actually asked for.
- **Operability proposed the error page render `trace_id`.** Overridden: for a server-thrown error the
  browser has only the `digest`, because the digest guard means the client never reported it. Rendering
  `trace_id` would require inventing a channel to carry it into the boundary. The class-vs-occurrence
  caveat data raised is stated in the UX section instead, and `event_id` on the log line is what makes
  the pivot work from the other end.

**Where two advisors disagreed, and how it was settled.** Simplicity argued the whole `LOG_FORMAT`
branch away; the intent's Q2 requires it. That was **C2**, and the repo owner kept Q2's answer —
pretty in development, terse structured JSON in production. The costs simplicity priced stand and are
accepted knowingly: 14 transitive packages for `pino-pretty`, and a `pretty` branch NFR9 does not
assert.

**`console.error` stays available and is now bounded in prose rather than by a rule** (**C16**). Q5
fixed `allow: ["error", "warn"]` and the intent requires evidence of misuse before tightening, so
`CLAUDE.md` states that the allowance exists for pre-logger bootstrap paths and is never an error
channel — and records that tightening to no allow-list is the one-line correction if review finds it
abused. The consequence security asked to have named is named there: `console.error` bypasses the
shared redaction list on both sides of the wire.

**What Design verified rather than trusted**, closing three items the prior art left for Build:
`spanToJSON()` returns `trace_id`/`span_id` already `snake_case`; `import { type Instrumentation } from "next"`
exists in Next 16's bundled docs; and `disableLogger` exists in `@sentry/nextjs@10.70.0`'s config
types. `pinoIntegration` is present in 10.70.0, comfortably above the `10.18` floor Q3 named. The
prior art's fourth open item — which pnpm file honours `publicHoistPattern` — is answered by
`CLAUDE.md`: pnpm 11 reads `pnpm-workspace.yaml`.

**What Build verified, and the one thing it corrected** (ticket #35).

- **`sendDefaultPii` defaults to `false` in 10.70.0.** Pinned explicitly on both inits anyway, so a
  wizard re-run or an SDK default cannot flip it silently.
- **`deleteSourcemapsAfterUpload` is the option name**, and its own docstring is wrong about the
  default — the plugin reads `?? false`.
- **The seam must delegate to `Sentry.captureRequestError`, not bypass it.** The first implementation
  read this section's "stays Sentry-specific" list as _"do not call it"_, and reached for
  `captureException` directly because the helper returns `void` while NFR3 needs the event id on the
  line. That was a false trade. Measured against a received envelope, bypassing the helper dropped the
  `transaction` name (`GET /orders`), the whole `request` section, `contexts.nextjs`, and the
  `auto.function.nextjs.on_request_error` mechanism. The transaction name is the one that matters: it
  is what the platform groups issues by, so every route's failures grouped together. The id is
  recoverable from `lastEventId()` — see story 6 for why it is read twice — so the helper does the
  reporting and the seam adds only the id. **The list above means "a vendor swap rewrites these
  files", never "application code may not reach them through the seam".**
- **An empty DSN and a whitespace DSN must be the same thing.** Two call sites derived "reporting is
  configured" separately and disagreed, so `NEXT_PUBLIC_SENTRY_DSN="  "` announced reporting inactive
  and then called `init` anyway. One exported predicate now answers it.
- **The edge runtime reaches neither sink.** Next compiles `instrumentation.ts` for both runtimes, and
  `@repo/observability` cannot load in the edge one — a static import fails the _build_, which is the
  server-only seam working. A downstream project that adds a `middleware.ts` gets no event and no log
  line for an error thrown there. Named here because the alternative is discovering it during an
  incident.

**What Build established about the completion line** (ticket #36).

- **Next has no request-completion hook**, so the mechanism was measured rather than chosen:
  `node:diagnostics_channel` fired exactly once per completed request across 30/30 sequential, 25/25
  concurrent, and 1/1 with no DSN. A span end was disqualified on the sampling rate — see story 7.
- **The route pattern is not on the span** (5 of 30 requests at `tracesSampleRate: 0.1`), so `route`
  reads the framework's per-request meta through a guarded reader. Named here because it is the one
  framework internal this effort depends on, and because the failure mode a Next upgrade produces —
  `route` degrades to `unknown`, nothing throws — is what makes it an acceptable one.
- **`route` may not carry a raw path.** The first implementation fell back to the pathname, which put
  `/_next/static/chunks/page-<hash>.js` — a value that changes every build — into the field a drain
  groups by. The subscription hears every HTTP server in the process, not only the app's router, so
  the fallback is `unknown` and the path travels under `context.path`.
- **A Node builtin cannot be named in `instrumentation.ts`.** Even behind `NEXT_RUNTIME` and inside a
  dynamic `import`, the specifier makes the edge bundler warn on every build. Routing the subscription
  through the package is what resolves it away — the `browser` condition doing the same job for a
  builtin that it already does for the package's own modules.
- **A dev-only overlay request shared a `trace_id`** with the request that triggered it. One line per
  request either way, so NFR17 holds, but it is a _wrong_ correlation and NFR18's band measures
  missing ones. Written down because the alternative is rediscovering it during an incident.

**What a retrospective review found on the completion line** (ticket #66). `context.path` carries a
credential in a URL path segment straight to stdout, on every request, which contradicts
`docs/policy/data.md`'s **Fixed** `secret` row — _never logged_ — in the no-DSN state every fresh clone
ships in. The finding is recorded here rather than fixed, and the reasoning is
[ADR-0006](../../adr/0006-name-the-exposure-rather-than-ship-a-heuristic.md): the two things a bound
would have to tell apart are indistinguishable to any mechanism the template can ship, and a partial
mitigation on a field the project has not classified converts "this may leak" into "this is handled".
Three things follow, and none of them is code. `data.md`'s row is **not** narrowed to stop it accusing
the implementation — a policy row edited to match the code stops being able to measure it.
`secrets-in-url-paths` in `docs/policy/security.md` ships `UNSET`, so every future spec touching the
area raises it as a flagged concern rather than anyone having to remember. And the design passage above
now carries both axes, because recording only the cardinality one is what let this sit unnamed through
the whole effort.

**What remains unverified and must be checked at Build**, because no advisor could read an uninstalled
package: `sendDefaultPii`'s actual default in 10.70.0, the exact option name for deleting source maps
after upload, whether `beforeSend` runs before or after client-side rate limiting (which decides
whether DD4's band is defensible), and Sentry's current free-tier figures, which the runbook needs as
numbers at pin time.

**Simplicity's healthy result, worth recording:** it found nothing else in the `Must` list cuttable
without breaking a number. Stories 1, 3, 6, 9, and 12 are the spine; 10, 13, and 14 are documents with
no moving parts; 8 and 11 each carry an NFR.

**`@sentry/nextjs` costs 255 transitive packages** and `pino` + `pino-pretty` add 28. Q1 bought the
first and Q2 the second; neither is reopened here, but the price is recorded because it is the largest
single thing this effort adds to a downstream `pnpm install`, and this repo has rejected a dependency
on that axis before.
