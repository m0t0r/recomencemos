---
stage: intent
status: approved
issue: 29
---

# Intent: Observability — structured logs, an owned error shape, and reported-once errors

## Problem

Three people feel this, and the third is why it is worth doing in a template rather than in a
product.

**Someone running a product built from this template** cannot find out what their application did.
There is no logger, no error shape, no error boundary, and no error reporting. The first production
incident is diagnosed by guesswork, and every decision that should have been made in advance —
which logger, what a log line looks like, what may be written into one, what an error is allowed to
tell a user — gets made under time pressure by whoever is on call.

**An agent working in this repo** has no encoded rule for emitting a diagnostic, so it reaches for
`console.log`. Nothing in `CLAUDE.md`, no skill, and no lint rule says otherwise; `.oxlintrc.json`
has no `no-console` entry today. Every such line is unstructured, uncorrelated, invisible to a log
drain, and — because nothing distinguishes an operator audience from a user audience — a candidate
for leaking server-side detail into a browser.

**The template itself** is open at the Maintain stage. `README.md` describes Maintain as
deterministic monitoring escalating by tier, with `/triage` promoting findings back into Plan, and
[ADR-0001](../../adr/0001-findings-enter-through-triage.md) builds the whole findings model on that
edge. The edge has no input: nothing in the template emits anything to monitor. Plan, Design, and
Build are wired; Maintain cannot be, and that is a gap in the thing this repository exists to
demonstrate.

## Proposed outcome

Someone who clones this template inherits logging, an error shape, and error reporting on the first
commit, and spends no incident time deciding any of them.

- Every diagnostic the application emits is **structured JSON on stdout**, carrying enough identity
  (service, environment, release) and correlation (a request or trace id) that a log drain can group
  one request's lines and pivot from a log to whatever the reporting platform holds.
- Errors have **one shape across the app**, and that shape separates what an operator may see from
  what a user may see. Server-side detail cannot reach a browser by accident — the split is a
  property of the type, not a habit of the caller.
- An uncaught error is **reported exactly once**. No double-reporting between a boundary and a global
  handler, and no duplicated spend against whatever quota the reporting platform imposes.
- A **fresh clone runs, builds, and passes every check with no monitoring account and no
  configuration**, while making it unmistakable — at startup, not in a doc — that error reporting is
  inactive.
- An agent writing code here **applies the conventions without being asked**, because they are
  encoded where it already reads: `CLAUDE.md`, a lint rule that fails rather than warns, and the
  policy files under `docs/policy/`.
- The Maintain → Plan edge becomes exercisable end to end: there is something to monitor, so a
  finding can reach `/triage` for real rather than as documentation.

## Affected users and systems

| Who / what                                             | How                                                                                                                     |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Downstream project teams                               | Inherit the log shape, the error shape, and the conventions as defaults, plus a go-live checklist for the reporting DSN |
| Agents working in this repo                            | Gain a written convention and a failing lint rule; lose `console.log` as the default reflex                             |
| The error shape (workspace TBD at Design)              | Must be isomorphic and safe in a client bundle — it crosses the server/browser boundary by design                       |
| The logger and reporting config (workspace TBD)        | Server-only. Where this lands in `packages/*` versus `apps/web` is Design's call, not this intent's                     |
| `apps/web`                                             | Gains instrumentation, error boundaries, and the environment plumbing for a reporting DSN                               |
| `turbo.json`                                           | Gains `env` declarations for the new variables, so the build cache hashes them                                          |
| Root `.oxlintrc.json`                                  | Gains the console rule, and whatever scoped `overrides` its escape hatch needs                                          |
| `packages/design-system`'s Vitest setup                | The precedent a new workspace's test config copies; the error shape guards a security property and must be tested       |
| `README.md`, `CLAUDE.md`, `docs/policy/*`, `docs/adr/` | Gain the conventions, the new placeholder rows, the settled policy keys, and the decision record                        |

## Constraints

- **This is a template, not a product.** The change is judged by whether it makes a downstream
  project's start better. Anything a new project must rename or replace is a placeholder and must
  land in `README.md`'s "Placeholders to change" table in the same change.
- **A fresh clone must work with no accounts and no configuration.** No design may make a missing DSN
  degrade the dev loop, fail a build, or turn a check red.
- **`pnpm lint` is `oxlint . --max-warnings 0`.** A console rule set to `warn` fails a downstream
  build exactly as hard as one set to `error`. That flag must not be relaxed to accommodate this
  work.
- **`engines.node` is `>=24` with `engineStrict: true`.** A dependency whose own `engines` pins a
  narrower range raises this repo's floor and fails installs for its users. This has already
  disqualified one library here — see the happy-dom decision in `CLAUDE.md`.
- **TypeScript is 7.x** — a `tsc` binary only, no `tsserver` and no JavaScript compiler API. Anything
  built on the TypeScript API is unavailable.
- **Cache Components is on.** Data is dynamic by default, uncached data outside `<Suspense>` is a
  build error, and the Node runtime is required — `runtime = 'edge'` is not an option for
  instrumentation.
- **The test runner is Vitest and it is wired in `packages/design-system` only.** `apps/web` has no
  `test` script on purpose. A new workspace copies design-system's config; runtime behaviour in
  `apps/web` verifies through `next-dev-loop`, because Vitest cannot test `async` Server Components.
- **Four policy keys were `UNSET` when this intent was written** — `observability-vendor`,
  `log-level-production`, and `log-retention` in `docs/policy/operability.md`, and `retention-logs`
  in `docs/policy/data.md`. Per those files an `UNSET` value is raised, never guessed, which is why
  each appears below as an open question rather than an assumption. Q1 and Q2 settle the first two;
  **this effort must write those answers into `docs/policy/operability.md` in the same change**, or
  the next spec raises them again. The two retention keys stay `UNSET` — see Q4.
- **A log line inherits the classification of what it contains** (`docs/policy/data.md`). `secret` is
  never logged; `personal` carries a retention period and a deletion path. That is fixed vocabulary,
  not a preference.
- Bound by [ADR-0001](../../adr/0001-findings-enter-through-triage.md): a folder under `docs/efforts/`
  means a human decided this is work. This effort was opened deliberately, not promoted from a
  finding. Nothing here contradicts it.
- **Prior art, deliberately not inherited.** The unmerged `feat/observability` branch carries an
  approved intent and a spec for this same problem (issues #13–#24, all closed, never landed on
  `dev`). It is worth reading and it settled several questions well. It is not binding: it was
  written before Vitest existed here, so it owned the runner decision this intent does not, and it
  reached different answers on log forwarding and on the shipped example routes. Its vendor choice
  and this one agree, which makes its Sentry-specific findings reusable — Q3 carries one forward.
  Reuse its reasoning; do not import its answers unexamined.

## Open questions

- [x] **Q1** — Which monitoring platform, and is it named in `docs/policy/operability.md` as
      `observability-vendor` or left `UNSET` with the template shipping an adapter seam?
      **Blocks:** whether "reported exactly once" is enforced against a specific SDK's global handlers
      or against an interface we own; which instrumentation files `apps/web` gains; the quota model
      every question below inherits; and the new README placeholder rows.
      **Answer:** **Sentry, and keep the adapter seam** — both, not one or the other.
      `observability-vendor` becomes `sentry` in `docs/policy/operability.md`, so a later spec may
      say a thing is already measured. But application code calls an interface **this repo owns**,
      not `@sentry/nextjs` directly, so a downstream project swaps the vendor by replacing one
      implementation rather than by editing every call site. Three consequences. The seam is a
      durable architectural decision and wants an ADR proposed at Design. The seam must not become a
      lowest-common-denominator wrapper that hides the SDK's Next.js integration — Design says
      explicitly what crosses it and what stays Sentry-specific. And `@sentry/nextjs`'s own
      `engines.node` must be checked against `>=24` with `engineStrict: true` before it is pinned;
      that check has already disqualified one library in this repo.

- [x] **Q2** — What is the production log level floor (`log-level-production`), and is structured JSON
      required at every level or only above it? **Blocks:** the logger's default configuration, what
      the dev loop prints versus what production emits, and the volume estimate Q3 needs.
      **Answer:** Floor is **`info` in production, `debug` in development**. Production emits
      structured JSON; **development pretty-prints by default**, so `pnpm dev` is readable without a
      pipe. `log-level-production` becomes `info`.
      This deliberately accepts a **format divergence between dev and production**, and the cost
      lands on the repo's second reader. `PRODUCT.md` says Claude Code reads this template's output,
      `next.config.ts` sets `logging.browserToTerminal` so browser errors land in the same stream,
      and `next-dev-loop` verifies by reading `next dev` stdout — under this answer that stream is
      the pretty one, which an agent cannot parse. **Design must therefore ship a first-class way to
      get JSON back in development** (an env var or a flag, documented in `CLAUDE.md` next to the
      dev-loop instructions), and treat it as a requirement rather than an escape hatch. Second
      consequence: a pretty-printing transport runs in a **worker thread**, the same mechanism that
      constrains log forwarding in Q3 — Design confirms the two cannot collide.

- [x] **Q3** — Do logs get forwarded to the monitoring platform alongside errors, or do only errors go
      there while logs stop at stdout? Forwarding gives one triage surface; it also spends a quota
      that, on a free tier, drops data rather than billing for it. **Blocks:** whether the logger
      needs a platform integration at all, any minimum SDK version floor, the "where do my logs go"
      section of the README, and the default this template ships as on or off.
      **Answer:** **Errors only.** Logs stop at stdout and the drain a downstream project points at
      it; Sentry receives errors. Forwarding all logs must be a **documented one-or-two-line
      switch**, not a rewrite — so the logger is constructed behind a seam that can gain the
      integration without touching call sites, and the README carries the switch, the free tier's
      volume cap, and the fact that it drops data rather than billing at the cap.
      Carried forward from `feat/observability`, which investigated this: when forwarding is switched
      on it must use Sentry's **logger integration** (`Sentry.pinoIntegration()` for pino), never a
      logger **transport**. A transport runs in a worker thread with no access to the request's
      active span, which silently breaks the `trace_id` correlation this whole design rests on. That
      finding also named a minimum `@sentry/nextjs` floor of `10.18`; Design re-verifies the number
      against the version it actually pins rather than trusting it.

- [x] **Q4** — Is the redaction list mandatory policy or an advisory default a downstream project
      extends, and what settles `retention-logs` / `log-retention`? Redaction can cover known field
      names but cannot reach inside a caller-supplied nested object, so part of the protection is a
      rule people follow rather than a filter that runs. **Blocks:** the shipped redaction list, the
      scrubber on the reporting path, the wording of the metadata rule in `CLAUDE.md`, and what the
      redaction tests are allowed to assert.
      **Answer:** **Advisory defaults.** The template ships a list covering common credential field
      names, `README.md` names it a placeholder to extend, and a project established from this
      template owns deciding what is mandatory for its own data. The template's job is to make the
      rule visible and the list easy to find, not to pretend it is complete. The redaction tests
      therefore assert that **the mechanism works on the shipped list** — never that the list is
      sufficient, which would encode a false guarantee.
      **The retention half is settled separately: the keys stay `UNSET`, and that is a decision.**
      `retention-logs` and `log-retention` remain unset because the template has no hosting target,
      no drain, and no `compliance-regime` — retention is a first-deploy answer, not one this effort
      is deferring out of caution. Design states that reasoning in the spec rather than leaving the
      keys silently blank, so the next spec that needs them reads a decision instead of a gap.

- [x] **Q5** — Does the console convention **bind** (a `no-console` rule at a severity that fails
      `--max-warnings 0`) or **advise** (documented only), and what is the sanctioned escape hatch —
      a scoped `overrides` entry, an inline disable with a reason, or a named logger method? A rule
      that fails a downstream build is an opinion this template imposes on every project cloned from
      it. **Blocks:** the root `.oxlintrc.json` change, whether `apps/web`'s scaffolding needs an
      exemption, and whether the convention is enforceable or merely stated.
      **Answer:** **Bind**, as `"no-console": ["error", { "allow": ["error", "warn"] }]` in the root
      `.oxlintrc.json`. `console.log` and `console.debug` — the actual reflex named in the Problem —
      fail the build; `console.error` and `console.warn` stay available without a disable comment.
      Verified against the installed oxlint: the rule is `eslint(no-console)`, is off by default
      here, and honours the `allow` option exactly as written.
      This leaves **two unstructured, uncorrelated sinks permanently open**, and `console.error` is
      precisely the one most likely to carry the server-side detail the error shape exists to keep
      away from a browser. Design must say what keeps that narrow — at minimum, `CLAUDE.md` states
      that the allowance exists for pre-logger bootstrap paths and not as a general error channel,
      and the error boundaries reach for the owned error shape rather than `console.error`. If
      review finds the allowance being used as an ordinary log, tightening it to no allow-list is
      the correction, and that is a one-line change.

## Out of scope

- **A browser-side log sink.** A custom ingest endpoint is an unauthenticated write surface needing
  rate limiting, body caps, origin checks, and a schema — decisions this template must not make on a
  downstream project's behalf. Client errors go through the reporting platform's browser SDK.
- **A self-hosted OpenTelemetry collector or a vendor-neutral tracing pipeline.** An infrastructure
  commitment a template cannot make for its reader.
- **Metrics, profiling, uptime checks, cron monitors, and session replay.** Each costs bundle size or
  quota with no template-level payoff. Each is documented as a one-line addition instead.
- **Alerting rules, dashboards, and SLO definitions.** Project-specific, and not writable without a
  real account and a real traffic shape. `default-availability` and `default-latency` stay `UNSET`.
- **Log-based analytics or business event tracking.** A different problem with a different shape.
- **Wiring Vitest into `apps/web`.** `CLAUDE.md` states the reason: a suite there is either vacuously
  green or destined for deletion. It arrives with the first real app code.
- **CI.** There is no `.github/workflows/` yet, and adding one is its own decision — including whether
  the console rule and the redaction tests are what a pipeline gates on.
