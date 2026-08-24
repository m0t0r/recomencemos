# Operability advisory — 0001-observability

Read: `/Users/m0t0r/Developer/ai-native-project/docs/efforts/0001-observability/spec.md`, `intent.md`, `/Users/m0t0r/Developer/ai-native-project/docs/policy/operability.md`, `docs/policy/data.md`, `docs/adr/0001-findings-enter-through-triage.md`.

**The structural finding first.** `docs/policy/operability.md` fixes "every spec names at least one complete control band" as non-negotiable, and this is the spec that exists to open the Maintain edge. It names **zero**. Grep confirms: `band` 0 hits, `traffic` 0, `saturation` 0, `duration` 0, `rollback` 0, `retention` 0. All fourteen NFRs are build-time or test-time assertions — exit 0, 0 bytes in the bundle, exactly 1 event, 100% correlation — every one of them verifiable by `pnpm test` and none of them observable in a running system. A spec that ships the logger and then measures the logger with unit tests has instrumented the template's CI, not the template's runtime. Maintain still has no input; it just has a nicer-looking one.

---

## Recommend

- **One request-completion log line, at `info`, on every request.** This is the largest single gap and the cheapest fix. The draft logs only errors, so of the four golden signals it covers Errors partially, and Latency, Traffic, and Saturation not at all. One line per completed request carrying `route`, `status`, `duration_ms`, `trace_id` yields all three from a single emit and makes every error band expressible as a *rate*. Without traffic, a spike in absolute error count cannot be distinguished from a busy Tuesday — which is the failure mode that makes on-call distrust an alert and then ignore it. Note NFR2's wording ("**0** additional lines per request") reads as forbidding this; it means the reporting-inactive notice, and should be scoped so it does not accidentally outlaw the access log.

- **The one band that is measurable in a template with no deployment: correlation loss.** Propose **`error`-level lines lacking `trace_id` while `isReportingEnabled()` is true ≤ 1% over a rolling 1h window**; outside it, a `needs-triage` issue. NFR5 asserts 100% and verifies it in a unit test, but the mixin reads the *active* Sentry span, and async-context loss after an `await` in a route handler or inside `after()` is the ordinary way that returns `undefined` in production and never in a test. The design says correlation is what it "rests on"; nothing tells anyone when it stopped.

- **A quota band, with the free-tier numbers written as numbers.** Story 8 promises "the free tier's caps and what happens at them" and the spec carries no figure. Per the intent's Q3 the cap *drops data rather than billing*, so exceeding it means the application becomes silently unmonitored — the observability system's own failure is invisible to the observability system. Propose: **alert at 80% of the monthly error allowance consumed, and at any 24h window exceeding 1/15th of it**; escalation is Sentry spike protection → `needs-triage`. NFR12's sample-rate cap (≤ 0.1) manages the *expected* spend; nothing manages the storm.

- **Three identifiers, and the spec never says they are one.** The wire body carries `requestId`, the log line carries `trace_id`/`span_id`, and Story 6's error page shows "a reference identifier". If those differ, the triage path the story exists to create is broken at the first step: the user quotes the reference, support searches the drain keyed on `trace_id`, and finds nothing. Settle it — propose the page renders `trace_id` (32-hex) and `requestId` on the wire body is set equal to it. One id, three surfaces, queryable in both the drain and Sentry.

- **Raise the reporting-inactive notice to `warn` in production.** NFR2 gives exactly one `info`-ish line per instance saying reporting is off. In production that scrolls past during boot and is never seen again, which makes "reporting silently never turned on" the default outcome of a mistyped DSN or a missing `turbo.json` env declaration. At `warn` it survives a level floor of `info` and stays visible. Secondary benefit worth stating: on a scale-to-zero host, "once per instance" is once per cold start, so that line's rate is the only saturation-adjacent signal this design produces.

- **State the rollback class — it is not uniform.** Four different classes in one change: `@repo/errors` and `@repo/observability` are **code-only** (redeploy previous build, minutes); the `no-console` rule and `LOG_LEVEL`/`LOG_FORMAT` defaults are **config, seconds**; `withSentryConfig()` in `next.config.ts` is code-only but fails `pnpm build` for every downstream consumer, so its blast radius is larger than its class suggests; and **source-map upload is one-way** — you cannot un-publish a downstream project's readable source to a third party. Name the forward fix for that last one (delete the release artifacts in Sentry, rotate `SENTRY_AUTH_TOKEN`), because "roll back" will not be available.

- **`NEXT_PUBLIC_RELEASE` will be empty on day one, and that costs the first incident.** It is hashed on `build` and there is no CI (out of scope, correctly), so nothing populates it. Every log line and every event then carries the same `release` forever and "did this start at the last deploy?" — the first question in every incident — becomes unanswerable. Propose: `register()` emits one `warn` when `NODE_ENV === "production"` and `NEXT_PUBLIC_RELEASE` is absent, and the runbook names the expression (`git rev-parse --short HEAD`).

- **Ship the breach issue body.** ADR-0001 fixes the escalation (a `needs-triage` issue) but not its content, and that content is decidable today with no vendor and no account: which band broke, observed value against expected range, the affected surface, the first thing to check. This is the one deliverable that actually closes the Maintain edge inside a template rather than deferring it to the first deploy. It is arguably a missing user story, not a footnote.

- **Cap the log line.** `AppError.metadata` is "nested arbitrary" and the error serialiser merges `toJSON()` into the line. pino's `redact` matches known paths, so it cannot reach in — the intent's Q4 says exactly this and answers "a rule people follow". The spec states no rule and sets no bound. Propose a serialiser-side **8 KB per-line cap with `truncated: true`** rather than a drop, and `redact` paths matched to depth 4. A size cap is the only mechanical defence against someone logging a whole request object; the advisory list cannot be.

---

## Risks

- **The client report path has no scrubber, and NFR10 is untrue on it as written.** `redactPaths` and `scrubEvent` are exports of `@repo/observability` (server-only), and `instrumentation-client.ts` "**must not import `@repo/observability`**". So the browser SDK initialises with no pre-send scrub, while NFR10 claims parity "in the log line and in the reported event". The failure: a client-side event carries a token in a breadcrumb or a captured context and no shipped list touches it, and the redaction tests are green because they only exercise the server path. `scrubEvent` is declared **pure** — it can live in `@repo/errors` (zero-dep, isomorphic) and be consumed by both inits without breaching NFR4. This is where the two-package split, which is otherwise the strongest idea in the draft, has a hole.

- **Everything terminates at stdout, and nobody has said stdout is collected.** Q3 settled logs-stop-at-stdout, which is right, but `hosting-target` is `UNSET`. On several plausible targets, stdout is retained for ~1h and is not queryable by field at all. Under that, NFR5's correlation has no consumer, the request-completion line has nowhere to be counted, and every band above is unenforceable. The spec should say plainly that the log half of this design is inert until a drain exists, rather than leaving a reader to assume the JSON is going somewhere.

- **`beforeSend` drops everything below HTTP 500 (NFR12), and 4xx is where the interesting failures live.** A credential-stuffing run, a broken client hammering 400s, a mass-401 after an auth config change — all invisible in Sentry by design, and visible in stdout only if a drain exists and the `warn` line carries `status` and `code` as top-level queryable fields. It currently isn't specified to. Make those fields explicit, or accept in writing that 4xx is unobservable.

- **Story 14 removes a signal and calls it a feature.** "A 404 produces 0 and 0" keeps routing misses out of the incident stream, which is correct for noise — but it also means a deploy that breaks every route produces *silence*, not a spike. Propose `debug` rather than nothing: off at the production `info` floor, recoverable by one `LOG_LEVEL` flip during an incident, no quota cost. Zero is one notch too far.

- **`pino.destination(1)` is specified without saying `sync` true or false, and the two have opposite failure modes.** Sync writes block the event loop under a backpressured collector; async buffers and can lose the last lines before a hard crash — which are precisely the lines you want. Whichever is chosen, name the number at which it reverses. Propose sync at template scale, reconsider above ~1000 lines/sec/instance. Related: **stdout write throughput is the saturating resource** in this design, and the spec names no saturating resource at all.

- **Report-once is asserted at build time and unguarded at runtime.** NFR3 is a unit test. The regression that costs money is behavioural — someone adds a `Sentry.captureException` in a boundary and one incident becomes N events against a quota that drops rather than bills. Propose a band: **>1 event per `trace_id` for more than 1% of traces in a 1h window**.

- **Q4's retention decision did not survive into the draft.** The intent requires Design to *state* why `log-retention` and `retention-logs` stay `UNSET`, so the next spec reads a decision rather than a gap. `retention` has 0 hits in the spec; Out of Scope carries only `default-availability`/`default-latency`. As written, the next spec raises the concern again — which is the exact outcome Q4 was written to prevent.

---

## Concerns

- [ ] **C-O1 — Where a control-band breach lands.** Every band above is a wish until a breach reaches a human. **Risk if wrong:** the bands ship as documentation, the Maintain edge stays open, and ADR-0001's escalation model has nothing to fire against — the same gap this effort exists to close. **Owner:** On-call lead. **Proposed:** a `needs-triage` GitHub issue in this repo, opened by the vendor's webhook, since that is already the fixed destination per ADR-0001. **Unblocks by setting:** `docs/policy/operability.md` → `alert-destination`

- [ ] **C-O2 — Who answers, and inside what hours.** **Risk if wrong:** "exactly one report per incident" is engineering effort spent on a stream nobody reads; conversely, a band tuned for a paged responder fires at 3am for a template with no rotation. **Owner:** On-call lead. **Proposed:** `nobody, business hours only` — a real answer that makes every band above a next-business-day queue rather than a page, and one this template can honestly ship. **Unblocks by setting:** `docs/policy/operability.md` → `on-call-rotation`

- [ ] **C-O3 — What happens when the reporting quota is spent.** The free tier drops data rather than billing (intent Q3), so the budget's consequence is *the application becomes unmonitored*, silently. **Risk if wrong:** the second incident of the month is invisible because the first one burned the allowance, and nothing said so. **Owner:** On-call lead. **Proposed:** alert at 80% consumed; at 100%, the drop is itself a `needs-triage` issue. **Unblocks by setting:** `docs/policy/operability.md` → `error-budget-policy`

- [ ] **C-O4 — Whether stdout is collected, and by what.** **Risk if wrong:** the entire log half of this design writes to a stream with ~1h retention and no field query, making NFR5's correlation and every log-derived band unenforceable from day one. **Owner:** On-call lead. **Proposed:** state explicitly in the spec that the log half is inert until a drain exists, and name the go-live check (`trace_id` from a Sentry event returns lines in the drain). **Unblocks by setting:** `docs/policy/operability.md` → `hosting-target`

- [ ] **C-O5 — How a release is undone, and how long that takes.** The spec states no rollback class for any of its four differently-shaped pieces. **Risk if wrong:** "flip a flag" is assumed available as a mitigation, no flag system exists here, and the actual path is a redeploy nobody has timed. **Owner:** On-call lead. **Proposed:** `redeploy-previous-build`, target ≤ 10 minutes; source-map upload named separately as one-way with a forward fix. **Unblocks by setting:** `docs/policy/operability.md` → `rollback-mechanism`

- [ ] **C-O6 — No user-visible SLO exists, by decision.** `default-availability` and `default-latency` stay `UNSET` (intent, correctly — a template has no traffic shape). **Risk if wrong:** it is not wrong, but it should be stated as the *reason* band selection falls entirely on the observability system's own health rather than on any user story. Six of the fourteen user stories describe runtime behaviour and none carries an SLO. **Owner:** On-call lead. **Proposed:** leave both `UNSET` and record why, exactly as Q4 does for retention. **Unblocks by setting:** `docs/policy/operability.md` → `default-latency`, `default-availability`

---

## Handoffs

- **data-design** — `AppError.metadata` is nested and arbitrary and flows into log lines through the error serialiser. `docs/policy/data.md` fixes that a log line inherits the classification of what it contains, and the draft classifies neither `attributes` nor `metadata`. I need a classification on both before I can say the redaction list is sufficient at any depth. No migration is involved here, so the one-way-migration forward-fix handoff does not apply to this effort.
- **security-design** — the client-side pre-send gap (`scrubEvent` unreachable from `instrumentation-client.ts`) is a leak surface as much as a logging one; we will likely both raise it, and the fix — moving the pure scrubber into `@repo/errors` — is one change.
- **ux-design** — Story 6's error page shows "a reference identifier". Which identifier, and whether it is the one queryable in the drain, decides whether the triage path works. My recommendation is `trace_id`; the rendering and the copy are theirs.

---

## Not applicable

- **The release moment as a capacity question.** The skill's cold-cache concern is about a band held up by caching; nothing in this change is cached or holds a band through a cache, so the empty-cache-on-deploy fact does not bite here. The release moment *is* still relevant for a different reason — it is when `NEXT_PUBLIC_RELEASE` changes and when report volume spikes — and I raised that above rather than under this heading.
- **One-way migrations.** No datastore, no schema, no migration in this effort. The only irreversible action is source-map upload, handled under rollback.
- **Saturation of a shared resource in the usual sense** (connection pool, queue depth, worker count). None exists. Stdout write throughput and the vendor event quota are the two things that give first, and both are named above.

## What I could not check

- **Whether `pino.destination(1)` defaults to sync or async in pino 10.** I did not verify against the installed package; the finding stands either way, because the spec specifies neither and the two choices have opposite failure modes.
- **Sentry's current free-tier allowances.** I proposed band shapes as fractions of the allowance rather than absolute event counts for that reason — the runbook needs the real figures at pin time, and NFR6's precedent (verify the version you actually pin) applies here too.
- **Whether `@sentry/nextjs@10.70.0`'s `beforeSend` runs before or after client-side rate limiting**, which decides whether the NFR12 drop of sub-500 errors actually protects quota or merely hides events after they are counted. Worth confirming at Build; it changes whether C-O3's band is defensible.
- **Runtime behaviour of any of this.** Nothing is implemented yet, so every claim above is read off the draft, not measured.
