# Runbook: taking observability live

Everything a project built from this template has to do to turn error reporting and structured logging
from "shipped" into "working". It is the deliverable that stands in for the ten
[`docs/policy/`](../policy/) keys effort [`0001-observability`](../efforts/0001-observability/spec.md)
deliberately left `UNSET`, so where a step ends in a decision this document names the key rather than
making it for you.

**Figures are pinned, and pinning is what makes them checkable.** Vendor caps and pricing change; this
document states what was true on the date below, against the version below, so a reader can tell a
stale number from a current one instead of trusting an undated claim.

| Pinned                    | Value                       |
| ------------------------- | --------------------------- |
| Date figures checked      | **2026-08-23**              |
| `@sentry/nextjs`          | **10.70.0**                 |
| `pino` / `pino-pretty`    | **10.3.1** / **13.1.3**     |
| Plan the figures describe | Sentry **Developer** (free) |

Re-check every figure in [§3](#3-the-free-tier-as-figures) before you rely on it. The
[README's "Still to replace" list](../../README.md#still-to-replace) carries a row saying so.

---

## 1. Environment variables

Eight, and **which ones are needed at build time versus at runtime is not a detail** — a variable the
build bakes in cannot be changed by restarting the process, and a variable declared only at runtime is
absent from the client bundle entirely.

| Variable                 | Build | Runtime | Declared in `turbo.json` as         | What it does, and what breaks without it                                                                                                                                           |
| ------------------------ | :---: | :-----: | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SENTRY_DSN` |  ✅   |   ✅    | `env` on `build`                    | Absent ⇒ the SDK is **never initialised**, on both sides. Not "disabled" — `register()` checks it before importing `sentry.server.config.ts`. No events at all                     |
| `SENTRY_ORG`             |  ✅   |    —    | `env` on `build`                    | Source-map upload target. Absent ⇒ upload is skipped and stack traces stay minified                                                                                                |
| `SENTRY_PROJECT`         |  ✅   |    —    | `env` on `build`                    | Same                                                                                                                                                                               |
| `SENTRY_AUTH_TOKEN`      |  ✅   |    —    | `passThroughEnv` on **`web#build`** | Secret. Source-map upload and release creation. Absent ⇒ both skipped                                                                                                              |
| `NEXT_PUBLIC_RELEASE`    |  ✅   |   ✅    | `env` on `build`                    | The `release` base field on every log line, the release on every event, and the name source maps are filed under. Absent ⇒ lines read `release: "unknown"` and a startup warning   |
| `LOG_LEVEL`              |   —   |   ✅    | `globalPassThroughEnv`              | Overrides the `info`/`debug` floor **without a rebuild**. An unrecognised value falls back to the floor                                                                            |
| `LOG_FORMAT`             |   —   |   ✅    | `globalPassThroughEnv`              | `json` \| `pretty`. Selects the destination stream                                                                                                                                 |
| `LOG_MAX_LINE_BYTES`     |   —   |   ✅    | `globalPassThroughEnv`              | Moves the 8 KB line bound for one session, when a deep stack is being chased. Default 8 KB **in every environment**; a missing, non-numeric, or below-floor value falls back to it |

Two constraints on this table are load-bearing, not stylistic:

**`SENTRY_AUTH_TOKEN` comes from the environment and never from a `.env` file.** `turbo.json` declares
`.env*` a `build` input, so the file's _content_ is hashed into the cache key however the variable is
declared — and under remote caching it would travel with the artifact. `secret-store` is `UNSET`; this
constraint holds whatever you choose.

**It is task-scoped, not global.** `passThroughEnv` on `web#build` alone, so a write-scoped token never
reaches `dev`, `lint`, `test`, or `check-types`. Check what a task actually sees:

```sh
pnpm exec turbo build --dry           # prints the Resolved Task Definition, including env keys
```

Turborepo runs in **strict** environment mode, so an undeclared variable is filtered out of a task's
environment entirely — not merely out of its hash. Adding a variable means declaring it in `turbo.json`
in the same change, or it will simply be absent at runtime.

---

## 2. Set the release

```sh
export NEXT_PUBLIC_RELEASE="$(git rev-parse --short HEAD)"
```

Run it in whatever builds your app, **before** `next build`. Three things about it:

- **It is published to every browser.** The `NEXT_PUBLIC_` prefix means it is inlined into the client
  bundle. Nothing but a build identifier belongs in it — no branch names carrying ticket titles, no
  internal environment names, no customer identifiers.
- **Build-time and runtime must agree on one string.** Uploaded source maps are filed under a release
  and an event is symbolicated only against the release it carries, so a build that uploads under one
  name and a browser that reports under another produces minified stack traces that look like a Sentry
  outage.
- **Left unset it still mostly works, and that is the trap.** The build plugin detects the `HEAD` SHA
  itself and injects it, so events carry a release while _log lines_ read `release: "unknown"` — the
  two halves disagree, which is exactly the state the startup notice warns about in production.

Tweak the expression if you version differently (a tag, a build number). Keep it a build identifier.

---

## 3. The free tier, as figures

**Sentry Developer plan, checked 2026-08-23.** Per month unless stated.

| Category            | Included                       |
| ------------------- | ------------------------------ |
| **Errors**          | **5,000**                      |
| Spans (tracing)     | 5,000,000                      |
| Logs                | 5 GB                           |
| Application metrics | 5 GB                           |
| Session replays     | 50 (not installed — see below) |
| Attachments         | 1 GB                           |
| Cron monitors       | 1                              |
| Uptime monitors     | 1                              |
| Custom dashboards   | 10                             |
| Users (seats)       | 1                              |
| Error retention     | 30-day lookback                |

### It drops data rather than billing, and that is the whole risk

Over quota, Sentry responds **`429`** and events are **dropped**. There is no pay-as-you-go budget on
the Developer plan — that requires Team or Business — so you are never billed for overage and you are
never told an incident went unrecorded except by the absence of it.

**Read the consequence rather than the mechanism: a spent quota means the second incident of the month
is invisible, because the first burned the allowance.** The observability system's own failure is the
one failure it cannot report. That is why the bands in [§5](#5-the-two-band-numbers) alert on
_consumption_, not on errors.

Session replay and user feedback are **not installed at all** rather than sampled to zero, so they
contribute 0 bytes to the bundle every visitor downloads and consume none of the replay quota. Adding
either is a decision with a client-bundle cost and a CSP consequence — see [§8](#8-csp-hosts).

---

## 4. Quota mitigations — switch these on, all vendor-side

**Why this section is not optional.** `NEXT_PUBLIC_SENTRY_DSN` is **public by construction** — that is
how Sentry works; the browser has to hold it to report. So anyone who reads your client bundle can POST
into your quota, and on a plan that drops data at the cap they can **blind your monitoring during an
incident they are causing**. Secrecy is not the mitigation and never was. These are:

| Mitigation           | Where                                                | What it does                                                                                                         |
| -------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Spike protection** | Project Settings → the project's quota/spike setting | Drops events automatically once volume exceeds a computed threshold, so one bad hour cannot spend the month          |
| **Inbound filters**  | Project Settings → Inbound Filters                   | Filtered events are **not counted** against quota. Filter legacy browsers, localhost, and known-noise error messages |
| **Allowed domains**  | Project Settings → Inbound Filters → allowed domains | Rejects events whose origin is not yours. This is the one that answers the stolen-DSN case directly                  |

Turn on all three before the first real traffic, not after the first spike.

**There is deliberately no pre-send filter in this codebase, and the absence is a design decision
rather than an oversight** (NFR12). The only quota lever in the application is the report-once rule:
**thrown is reported, returned is logged** — an error that escapes a request costs one event plus one
`error` line; an error handled and returned through `toErrorResponse` costs one `warn` line and no
event. Which one a handler picks is a real quota decision, and
`apps/web/app/api/example-error/route.ts` is the worked example of both.

That a filter _would_ work is verified rather than assumed — see
[§11, finding 3](#11-what-was-verified-against-the-installed-sdk). Adding one is available to you; it
is not shipped, because a status-based filter silently discards the errors nobody is watching for.

---

## 5. The two band numbers

Both derive from the **5,000 errors/month** figure in §3. Re-derive them if you change plan.

| Band                | Threshold                                  | Arithmetic                                                                                               | Outside it                                            |
| ------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Allowance alert** | **4,000 errors** consumed in a month       | 80% × 5,000                                                                                              | A `needs-triage` issue — see [§6](#6-the-breach-path) |
| **Spike**           | **> 333 errors in any rolling 24h window** | 5,000 ÷ 15 = 333.3. Even burn across a 30-day month is 5,000 ÷ 30 ≈ 167/day, so this is **2× even burn** | Same                                                  |

Both are configured as Sentry alert rules on the org's error consumption. Both are written as a
**next-business-day queue, not a page**, because `on-call-rotation` is `UNSET` and a template may not
assert that somebody is awake.

The spec carries three further bands that **cannot fire until a drain exists**, because they are
measured on log lines rather than on events. They are listed here so they are switched on in the same
session as the drain, not rediscovered later:

- **NFR18 — correlation loss.** `error`-level lines lacking `trace_id` while reporting is active stay
  ≤ 1% over a rolling 1h window.
- **C18 — report-once.** More than 1 event per `trace_id` for over 1% of traces in a rolling 1h window.
- **NFR17 — the denominator.** Every completed request emits exactly 1 `info` line carrying `route`,
  `status`, `duration_ms`, and `trace_id`. Without it an error count cannot be read as a rate and a
  spike is indistinguishable from a busy Tuesday.

---

## 6. The breach path

**A control-band breach lands as a `needs-triage` issue in this repository.** That is not a choice this
runbook makes — it follows from
[ADR-0001](../adr/0001-findings-enter-through-triage.md), which fixes that findings reach Plan only
through `/triage`. Any other destination would contradict it. A breach that arrives as a chat message
is a breach nobody owns.

```
Sentry alert rule fires
        │
        ▼
Sentry webhook (Settings → Integrations → Webhooks, or an Internal Integration)
        │  POST
        ▼
Your endpoint / GitHub Action  ──►  gh issue create --label needs-triage
        │
        ▼
/triage  ──►  wontfix  |  ready-for-agent  |  /to-intent   (a human's call)
```

**The issue carries four fields, and it is not a finding without them:**

| Field                    | Example                                                              |
| ------------------------ | -------------------------------------------------------------------- |
| **Band**                 | `Spike — >333 errors / 24h`                                          |
| **Observed value**       | `412 errors in the 24h to 2026-08-23T09:00Z`                         |
| **Affected surface**     | `POST /api/orders` (the `route` pattern, so it joins with log lines) |
| **First thing to check** | `Sentry issue link, then the drain for that route's trace_ids`       |

A minimal body for the webhook consumer to produce:

```md
## Band

Spike — more than 333 errors in a rolling 24h window (5,000/mo ÷ 15).

## Observed

412 errors in the 24h window ending 2026-08-23T09:00Z.

## Affected surface

`POST /api/orders`

## First thing to check

<sentry-issue-url> — then query the drain for that route's `trace_id` values over the same window.
```

Label it `needs-triage` and nothing else. `/triage` assigns the rest; see
[`docs/agents/triage-labels.md`](../agents/triage-labels.md).

**`alert-destination` stays `UNSET`, deliberately.** The _shape_ of the destination is fixed by
ADR-0001 — a `needs-triage` issue — but the webhook **target** is a per-project URL, and no template
can know it. Set it to the endpoint that opens issues in _your_ repository. Setting the key means
writing that URL (or the Action that receives it) into
[`docs/policy/operability.md`](../policy/operability.md).

---

## 7. The go-live check

**This is the one step that either passes or fails.** Everything above is configuration; this proves
the configuration works.

Until it passes, **NFR5, NFR17, and NFR18 are unenforceable and the log half of this design is inert** —
you have error reporting and you have log lines, and no way to get from one to the other.

### Procedure

1. **Deploy** with `NEXT_PUBLIC_SENTRY_DSN` and `NEXT_PUBLIC_RELEASE` set, and with your log drain
   collecting the process's stdout.

2. **Cause exactly one uncaught server error.** The template ships a handler for this:

   ```sh
   curl -i "https://<your-host>/api/example-error?mode=thrown"
   ```

   (Delete that route before it is genuinely public — it is scaffolding, and the README's placeholder
   table says so.)

3. **Take the `trace_id` from the event.** Open the event in Sentry; the trace id is on it. Then:

   ```sh
   TRACE_ID=<the value from the event>
   ```

4. **Query the drain for that trace id.** The query is drain-specific; the shape is not:

   ```sql
   -- whatever your drain's query language is, this is the predicate
   trace_id = "$TRACE_ID"
   ```

5. **Assert.** The check **passes** when all four hold:

   - [ ] The drain returns **at least one line** for `$TRACE_ID`.
   - [ ] One of those lines is at `level: "error"` and carries a non-empty **`event_id`**, and that
         `event_id` is the id of the Sentry event you started from.
   - [ ] One of those lines is at `level: "info"` and carries `route`, `status`, and `duration_ms`
         (that is NFR17's request-completion line).
   - [ ] Every returned line carries the same `service`, `env`, and `release`, and `release` is the SHA
         you deployed.

6. **Check the two pivots your drain gives you for free.** Both are drain-specific, and both are
   cheaper to find out now than during an incident.

   - **Log line → trace.** Many drains render a one-click link from a log line to its distributed
     trace, and they key it off a **literal field name**. This design emits `trace_id` and `span_id`
     exactly as `spanToJSON()` returns them — see
     [ADR-0005](../adr/0005-log-line-fields-are-named-for-the-line.md), which is why there is no
     mapping layer on these two — so if your drain expects those names the pivot lights up with no
     configuration. If it expects something else (`traceID`, `dd.trace_id`, a nested `trace.id`),
     configure the drain's field mapping rather than renaming the field here: the value is what
     correlates, and renaming it at the source would break the other direction.
   - **Support ticket → log line.** A user quotes the `requestId` from a response body. On the line
     that field is **`request_id`** — same value, `snake_case`, because the line names its own fields.
     Confirm the query works and put it in your support team's saved searches:

     ```sql
     request_id = "<the value the user quoted>"
     ```

     This is the single most common lookup anyone will run against these logs, and it is the one a
     support engineer runs without knowing anything else about the incident.

   It **fails** on any of: no lines returned (stdout is not reaching the drain); lines returned with no
   `trace_id` (the SDK is not initialised, or the log call is inside a `use cache` scope — see below);
   an `event_id` that resolves to no event (reporting ran with no client).

**The pivot step 5 proves works in both directions** — event → `trace_id` → log lines, and log line →
`event_id` → event — and that is the entire reason the design puts `event_id` on the line.

### The one thing that will make this fail confusingly

**A log call inside a `use cache` scope runs at cache-fill time, not request time.** It emits once per
miss, carries the `trace_id` of whichever request filled the entry, and emits nothing at all on a hit.
If step 4 returns lines whose `trace_id` is not the one you asked for, that is the cause. `CLAUDE.md`
carries the rule: **log at the dynamic boundary, never inside a cached function.**

---

## 8. CSP hosts

**No Content-Security-Policy ships with this template, and that is deliberate.** A CSP is a real
surface with real breakage risk; shipping a "reasonable default" nobody understands is how a policy
silently blocks the browser SDK six months later, with no signal. `csp-policy` is `UNSET` and a CSP
deserves its own effort. What ships is the input to that decision:

**Read the host off your own DSN.** A DSN has the shape
`https://<publicKey>@o<orgId>.ingest.<region>.sentry.io/<projectId>`, and the browser SDK POSTs
envelopes to that origin. So:

```
connect-src 'self' https://o<orgId>.ingest.<region>.sentry.io;
```

Substitute your org id and region (`us`, `de`, …) — or, if you would rather not pin a region,
`https://*.ingest.sentry.io` and `https://*.ingest.*.sentry.io`.

Two additions that do **not** apply to what this template ships, listed so they are not discovered by
outage:

- **Session Replay** needs `worker-src 'self' blob:` — it creates a web worker from a blob URL. Safari
  ≤ 15.4 does not support `worker-src`, so a `child-src` entry is needed alongside it. Replay is not
  installed here.
- **Security-policy reporting** (having browsers POST CSP violation reports _to_ Sentry) needs Sentry
  in `default-src` or `connect-src` for the report endpoint itself. Not configured here.

Nothing else is required: the SDK is bundled with the app rather than loaded from a CDN, so no
`script-src` entry is needed for it.

---

## 9. Start forwarding logs

Logs currently go to **stdout and nowhere else**. That is the honest state:
`observability-vendor` names Sentry for errors and traces, and names stdout for logs precisely because
`hosting-target` is `UNSET` and nothing can be routed until there is somewhere to route it.

**Two routes, and they are not alternatives — most projects want the first.**

### a. Collect stdout (the default, and what the go-live check assumes)

The application writes JSON to file descriptor 1 and your platform collects it. Nothing in the code
changes. Set:

```sh
LOG_FORMAT=json     # required in production — the format the drain parses
LOG_LEVEL=info      # the floor; omit to inherit it
```

Then point your platform's log drain at the service. That is a `hosting-target` question, which is why
this document cannot finish the sentence for you.

### b. Forward pino lines into Sentry — the two-line switch

In `apps/web/sentry.server.config.ts`:

```ts
Sentry.init({
  // …existing options…
  enableLogs: true,
  integrations: [Sentry.pinoIntegration()],
});
```

Two things to know before switching it on, both verified against 10.70.0:

- **It does not break report-once.** `pinoIntegration`'s `error.levels` defaults to `[]`, so pino lines
  are forwarded as _logs_ and do not additionally become _error events_. Set `error.levels` and you
  have opted into double-reporting — one event from `onRequestError` and another from the line it
  emitted — which is the one thing NFR3 exists to prevent.
- **Logs are a separate, metered category**: 5 GB/month on the Developer plan (§3), dropped at the cap
  exactly as errors are. Forwarding everything at `debug` is how you spend it.

`autoInstrument` defaults to `true`, so every pino logger in the process is captured. Narrow it with
`pinoIntegration({ autoInstrument: false })` plus `pinoIntegration.trackLogger(logger)` if you have
loggers you do not want forwarded.

---

## 10. Security, privacy, and deletion

### The three threats this effort creates

Named because `threat-model-scope` is `UNSET` and an unnamed threat is not mitigated by being small.

1. **Public-DSN quota exhaustion.** Anyone reading the client bundle holds the DSN and can POST into
   the quota, blinding monitoring during an incident they caused. **Mitigated by §4**, vendor-side —
   allowed domains, inbound filters, spike protection. Not by secrecy: the DSN cannot be secret.

2. **Log injection through the request identifier.** A `requestId` taken from an inbound header lets an
   attacker write newlines and forged fields into the pretty stdout stream that an agent reads and acts
   on. **Closed at source**: `AppError` generates `requestId` with `crypto.randomUUID()` and there is
   deliberately no constructor option an inbound header could be threaded into. There is nothing to
   configure — the mitigation is the absence of a parameter, which is why it is written down.

3. **A credential carried in a URL path segment reaches stdout verbatim.** The request-completion line
   sets `context.path` to the concrete request path — query and hash stripped, the rest whole — on
   **every** completed request, matched or not. So a password-reset, signed-invite, or unsubscribe
   route whose token is a path segment logs that token in full:

   ```json
   {
     "level": "info",
     "route": "/_not-found",
     "context": { "path": "/reset-password/rp_9f81c2d4e0a7" }
   }
   ```

   **Not mitigated, and deliberately so.** `rp_9f81c2d4e0a7` and `42` are the same thing to any
   mechanism this template could ship, and any bound would land equally on `/orders/42`, where the
   concrete segment is the field's entire diagnostic value. The reasoning, the rejected options, and
   the precedent are in
   [ADR-0006](../adr/0006-name-the-exposure-rather-than-ship-a-heuristic.md).

   **State it as what it is: a deviation.** [`docs/policy/data.md`](../policy/data.md) classifies
   `secret` — credentials, tokens, keys — as **never logged**, and marks that vocabulary **Fixed**;
   `retention-logs` adds that a log line inherits the classification of what it contains. This is the
   one field the template writes without being able to know the classification of what it carries, so
   the shipped code deviates from a settled policy row. The row is **not** narrowed to accommodate it.

   **The question is `secrets-in-url-paths` in [`docs/policy/security.md`](../policy/security.md), and
   this runbook does not answer it.** Only the project knows whether any of its routes carries a
   credential in a segment. Answer the key before go-live; where the answer is `yes`, bound the path
   using the recipe below.

#### Bounding the path, for the `yes` branch

Short because a downstream project owns `@repo/observability` outright — there is no knob to reach
for, and none is coming (ADR-0006). You edit the function. Three points, all of which matter:

- **Change `pathOf` in `packages/observability/src/log-request-complete.ts`; leave `routeOf` alone.**
  `pathOf` is the only producer of the value, so one edit covers every completed request — in
  practice you will edit the private `pathnameOf` it delegates to, which is where the query strip
  already lives and where the comment describing this exposure sits.
- **`route` stays untouched.** It is on the log line's stability contract, it is bounded for a
  different reason — cardinality, not exposure — and it is what a drain groups by. Bounding it a
  second time buys nothing and breaks every saved query.
- **Keep `context.path` present.** Replacing the _value_ is safe; deleting the field changes the
  line's shape for every query already bound to it.
  [ADR-0004](../adr/0004-stack-frames-are-trimmed-by-value.md)'s counted marker is the house shape for
  a trimmed diagnostic — keep the segments you can classify and say how many you folded, rather than
  emitting a shorter path that reads like a whole one.

`packages/observability/src/log-request-complete.test.ts` pins today's unbounded behaviour on purpose,
so this edit arrives against a failing assertion rather than silently. Update that case as part of the
change; it is also where you will see what else the line promises.

### `sendDefaultPii` is pinned `false` — do not "modernise" it carelessly

Both inits pin it explicitly rather than inheriting it, so a wizard re-run cannot flip it. Verified
`false` by default in 10.70.0 anyway (§11).

**The migration trap**, which matters because 10.70.0 deprecates the flag for removal in v11: supplying
a `dataCollection` object **at all** switches the SDK's baseline from the privacy-preserving mapping
`sendDefaultPii: false` selects to permissive defaults — `cookies: true`, request and response headers
on, every HTTP body category, user info on. So the "obvious" migration turns PII collection **on**. A
correct migration re-states every category. Both init files carry this as a comment; revisit when v11
removes the flag.

### The four places a deletion request must reach

`retention-personal` is `UNSET` and this template ships no store, but it ships four sinks. A deletion
request that reaches only the first is not honoured:

1. **The drain** — log lines, wherever stdout is collected. Governed by `log-retention` /
   `retention-logs`, both `UNSET`.
2. **Sentry's retained events** — 30-day lookback on the Developer plan (§3). Deletion is per-issue or
   per-event through Sentry, and Sentry is a **data processor you chose on the project's behalf** by
   adopting this template. A regulated adopter needs to know that before an audit, not after.
3. **Uploaded source maps** — filed under a release, and they carry your source, not user data. Listed
   because a full purge of a release means deleting these too.
4. **Any downstream cache** — anything that copied a log line or an event onward: a SIEM, a
   warehouse, a dashboard's materialised store.

### Source-map upload is the one irreversible action

`sourcemaps.deleteSourcemapsAfterUpload: true` is pinned in `next.config.ts` — verified as the correct
option name in §11, and **not** redundant with the SDK's own docstring, which claims a default the code
does not implement. Left behind in the deployed output, your full client and server source is publicly
fetchable: `internal` data served as `public`, and you cannot un-publish it. The forward fix is
deleting the release artifacts in Sentry and rotating `SENTRY_AUTH_TOKEN`.

### Rollback classes

`rollback-mechanism` is `UNSET`; **`redeploy-previous-build` is the documented default** and a project
may choose otherwise (feature flags being the obvious alternative, which changes what is available as a
mid-incident mitigation). These four classes hold either way:

| Change                                                                 | Class                                                                                                   | Time                      |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------- |
| `@repo/errors`, `@repo/observability`                                  | code-only                                                                                               | a redeploy                |
| `LOG_LEVEL`, `LOG_FORMAT`, `LOG_MAX_LINE_BYTES`, the `no-console` rule | config                                                                                                  | seconds                   |
| `withSentryConfig()` in `next.config.ts`                               | code-only, but it fails `pnpm build` for **every** downstream consumer — blast radius exceeds its class | a redeploy                |
| Source-map upload                                                      | **one-way**                                                                                             | not reversible; see above |

---

## 11. What was verified against the installed SDK

Design could not check these — no advisor can read an uninstalled package — so the spec listed four
items for Build. All four were checked against `@sentry/nextjs@10.70.0` as installed in this repo,
reading the shipped code rather than the documentation, on **2026-08-23**.

**1. `sendDefaultPii` defaults to `false`.** Confirmed.
`@sentry/core/build/cjs/utils/data-collection/defaultPiiToCollectionOptions.js` gates on
`sendDefaultPii === true`, so any other value — `undefined` included — selects the privacy-preserving
branch. _New finding, not in the spec:_ the flag is **deprecated** in 10.70.0 for removal in v11, and
`resolveDataCollectionOptions.js` switches the baseline to permissive `DEFAULTS` the moment
`dataCollection` is supplied at all. See the migration trap in §10.

**2. The source-map deletion option is `sourcemaps.deleteSourcemapsAfterUpload`.** Confirmed, on
`withSentryConfig`. Its own docstring says the default is `true`;
`@sentry/nextjs/build/cjs/config/getBuildPluginOptions.js:181` and
`handleRunAfterProductionCompile.js:47` both read `?? false`. **The docstring is wrong** — which is why
the option is pinned explicitly rather than relied on. (A separate Turbopack path in
`getFinalConfigObjectBundlerUtils.js` _does_ set it `true` when the user has not, so the effective
default varies by bundler. Pinning it removes the question.) It maps to the bundler plugin's
`sourcemaps.filesToDeleteAfterUpload`.

**3. The pre-send hook runs _before_ rate limiting — strictly.** This was the open question that
decides whether §5's band is defensible, and the answer is that it is.
`@sentry/core/build/cjs/client.js`'s `_processEvent` runs in this order:

```
_prepareEvent  →  processBeforeSend (beforeSend / beforeSendTransaction)
               →  the sampleRate discard
               →  sendEvent  →  transport.send  →  isRateLimited
```

`isRateLimited` lives in `transports/base.js`, inside `send`. Two consequences:

- **The band measures the right quantity.** Every event that survives `beforeSend` is an event that
  counts against the quota, so "80% of the monthly allowance" is a threshold on the thing actually
  being consumed. A `beforeSend` filter _would_ therefore be a real quota lever — the template ships
  none by decision (NFR12, and §4), not because one would not work.
- **The transport's backoff is not a control you own.** `rateLimits` is populated only from a server
  response (`updateRateLimits(rateLimits, response)`, i.e. a `429`), so the SDK begins dropping only
  _after_ the quota is already gone. It is a courtesy to Sentry's ingest, not a protection for your
  allowance. §4's vendor-side mitigations are the protection.

Worth knowing alongside it: `beforeSend` also runs before the client-side `sampleRate` discard, so the
scrubber runs on some events that are then dropped. Wasted work, not a correctness problem — and
`sampleRate` is unset in this template, so no error is sampled away.

**4. The free-tier figures.** In §3, with their source and date.

---

## 12. A not-found produces no report and no error line — with its condition

`app/not-found.tsx` is deliberately absent. `onRequestError` fires when the server captures an
**error**; `notFound()` is a routing _outcome_, not an error. So "a 404 produces no report" is already
true with zero code, and a file whose only job would be to carry a comment asserting an absence is not
worth the accessibility surface it drags along.

**It does not produce silence, and this section used to say it did.** Every completed request emits one
`info` request-completion line, and a 404 is a completed request. What a tokened 404 leaves behind is:

```json
{
  "level": "info",
  "route": "/_not-found",
  "context": { "path": "/reset-password/rp_9f81c2d4e0a7" },
  "status": 404,
  "duration_ms": 444,
  "msg": "request complete"
}
```

The base fields every line carries — `time`, `service`, `env`, `release` — are elided above; the
`duration_ms` is one observed value, not a figure to hold anyone to.

Two details worth having before you go looking for it. **`route` reads `/_not-found`, not `unknown`** —
Next's per-request meta matches a real pattern for a not-found, so the line does not land in the
unmatched bucket where you might expect to find it. And **the concrete path travels on that line**,
whole, which is the exposure [§10](#10-security-privacy-and-deletion) names as its third threat. If you
are here to learn what a tokened 404 leaves in the drain, that is the answer, and it is not "nothing".

**The condition on the guarantee that does hold, which is why it is written here rather than left
implied:**

> It holds only while a not-found is produced by calling the framework's `notFound()`. **It stops
> holding the day a downstream handler throws its own not-found instead** — a `throw new AppError({
status: 404, … })` that escapes a request is an error like any other, so it reaches
> `onRequestError` and costs one event and one `error` line, per request — **on top of** the `info`
> completion line above, which is emitted either way.

If you add a not-found path that throws, either return it through `toErrorResponse` (one `warn` line,
no event — the report-once rule doing its job) or expect it in your quota. On the free tier, a
crawler hitting a throwing 404 path is a realistic way to spend 5,000 errors in a day.

---

## Checklist

- [ ] All seven environment variables set, at the right phase (§1)
- [ ] `NEXT_PUBLIC_RELEASE` produced by `git rev-parse --short HEAD` in the build (§2)
- [ ] `SENTRY_AUTH_TOKEN` in the environment, **not** in any `.env*` file (§1)
- [ ] `turbo build --dry` shows each variable on the task that needs it (§1)
- [ ] Free-tier figures re-checked against the current plan (§3)
- [ ] Spike protection, inbound filters, and allowed domains all on (§4)
- [ ] Both bands configured as alert rules, with the numbers re-derived from your plan (§5)
- [ ] Webhook → `needs-triage` issue wired, carrying all four fields; `alert-destination` set in `docs/policy/operability.md` (§6)
- [ ] **The go-live check passes** (§7)
- [ ] CSP host recorded for whenever a CSP is written (§8)
- [ ] `LOG_FORMAT=json` in production and a drain collecting stdout (§9)
- [ ] Deletion path known for all four sinks (§10)
- [ ] `secrets-in-url-paths` answered in `docs/policy/security.md`, and `context.path` bounded where the answer is `yes` (§10)
- [ ] `apps/web/app/api/example-error/route.ts` deleted before public traffic (§7)
