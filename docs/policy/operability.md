# Operability policy

Owner: **On-call lead** ([owners.md](owners.md)). Read by `operability-design`.

An `UNSET` value is raised as a flagged concern naming this file and the key. It is never guessed.

**Two keys are answered by shipped code, two by effort 0002.** `observability-vendor` and
`log-level-production` come from effort `0001-observability`, which shipped the code implementing
them. `hosting-target` and `on-call-rotation` come from the effort 0002 design interview - and the
second is **nobody**, which the row itself calls a real answer. It is the constraint every SLO below
has to be set against. There is still no CI.

| Key                    | Value                                                            | What it settles                                                                                                 |
| ---------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `hosting-target`       | **Fly.io**, one machine                                          | Where this runs. Decides cold-start behaviour, regions, and what "instance" means in a cache discussion         |
| `observability-vendor` | **Sentry** for errors and traces; **stdout** for logs, undrained | Where metrics, traces, and logs go. Until set, no spec can say a metric is "already measured"                   |
| `alert-destination`    | **Human-queue bands → a daily digest at 08:00 America/Bogotá through the notification seam; machine bands → a `needs-triage` issue from CI** ([ADR-0001](../adr/0001-findings-enter-through-triage.md)) | Where a breach lands — a channel, a pager, an issue. Not a person                                               |
| `on-call-rotation`     | **Nobody**, best effort                                          | Who answers, and inside what hours. "Nobody, business hours only" is a real answer that changes every SLO below |
| `default-availability` | **99.5% monthly**, measured externally. Uptime probe every 60 s, alerting after 2 consecutive failures | The availability target a spec inherits when it names no other                                                  |
| `default-latency`      | **p95 ≤ 400 ms server-side and ≤ 1200 ms user-measured** | Same, for p95 on a user-visible read path                                                                       |
| `error-budget-policy`  | **Above 50% of the 30-day budget: deploys limited to fixes, cadence to once daily, until the trailing window recovers** | What happens when the budget is spent. A budget with no consequence is a dashboard                              |
| `log-level-production` | **`info`**, and **structured JSON is required**                  | The floor in production, and whether structured JSON is required                                                |
| `log-retention`        | **30 days**, mirroring `retention-logs` | Mirrors `retention-logs` in [data.md](data.md); set both or neither                                             |
| `rollback-mechanism`   | **Bluegreen, health-gated: a failing `GET /api/health` aborts the deploy. A completed deploy is undone in ≤ 5 minutes by one documented command** | How a release is undone and how long that takes. Decides whether "behind a flag" is available as a mitigation   |

## The two keys this template answers

Both were settled by effort [`0001-observability`](../efforts/0001-observability/spec.md), and both
are answered rather than `UNSET` for the same reason: **the template ships running code that already
implements them**, so leaving the key blank would describe the repo inaccurately rather than leave a
decision open. **Every remaining key in the table above was set by effort 0002**, resolving concerns
C9–C12 and C33; none is left `UNSET`.

**`observability-vendor` is two answers, and the split is the point.** Errors and traces go to Sentry
(`@sentry/nextjs`, declared in `apps/web/package.json`). Logs go to **stdout and nowhere else** — pino
writes them, and nothing forwards them — the drain is unwired, not undecided, now that
`hosting-target` is **Fly.io**. So the vendor key is set and the log half of the design is still inert: a `trace_id` on a log
line correlates with an event only once someone wires a drain. The
[go-live runbook](../runbooks/observability-go-live.md) carries the check that proves the wiring works
and the one-or-two-line switch that starts the forwarding, and until that check passes, NFR5, NFR17,
and NFR18 are unenforceable. Changing the error vendor is a bounded, costed change:
[ADR-0002](../adr/0002-reporting-vendor-seam.md) enumerates the swap as three module bodies plus four
integration files, and **no call site** — with a `grep` that fails loudly if a ninth file ever names
the vendor.

**`log-level-production` is `info`, with structured JSON required**, matching the floor
`createLoggerOptions` actually ships — `info` in production, `debug` in development, overridable at
runtime through `LOG_LEVEL` with no rebuild (NFR8). The JSON half is not a preference: the base field
names on a line are a stability contract that every clone's drain queries bind to, so a production
line that is not machine-parseable is a line the contract cannot be honoured on. `LOG_FORMAT=pretty`
exists for a terminal a human is watching, and production is not one.

## Fixed by this repo

Not `UNSET` — decided, and a spec may not reopen them without an ADR.

| Fact                                                                                                      | Where it comes from                              |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| A breach becomes a `needs-triage` issue and reaches Plan only when `/triage` promotes it                  | `docs/adr/0001-findings-enter-through-triage.md` |
| Every spec names at least one complete control band                                                       | This file                                        |
| Cache entries do not survive a deploy, so every release starts cold — the release moment is the peak load | Cache Components                                 |

## What a control band is

Three things. A band missing any of them is not yet a band, and is a concern rather than a value.

1. **The metric** — something already measured, or something this change starts measuring.
2. **The normal range**, as a number.
3. **What happens outside it** — who learns, through what, and how fast.

A band with no number is a wish. Where the number is genuinely not yours to pick, raise the concern
**carrying the range you would defend**: a concern with a proposed number gets answered, a concern
asking "what should this be?" gets deferred.
