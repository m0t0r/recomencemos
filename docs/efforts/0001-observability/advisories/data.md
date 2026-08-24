# Data advisory — 0001-observability

Read: `/Users/m0t0r/Developer/ai-native-project/docs/efforts/0001-observability/spec.md`, `.../intent.md`, `/Users/m0t0r/Developer/ai-native-project/docs/policy/data.md`, `.../security.md`, `.../operability.md`, `/Users/m0t0r/Developer/ai-native-project/apps/web/next.config.ts`, `turbo.json`, `apps/web/AGENTS.md`.

There is no store here, so most of `data.md` is genuinely inapplicable and I say so at the bottom rather than inventing a schema. The lens still bites in three places this effort really does create data: **the log line is a schema with drain queries as its access patterns**, **the redaction list is one artifact with more consumers than the spec counts**, and **classification/retention apply to log and event payloads exactly as they would to columns**.

## Recommend

- **`redactPaths` belongs in `@repo/errors`, not `@repo/observability`.** The spec has three report/emit destinations (pino on stdout, `scrubEvent` on the server pre-send hook, and `lib/report-client-error.ts` in the browser) but Story 9 and NFR10 count two. `@repo/observability` is server-only and `instrumentation-client.ts` is explicitly forbidden from importing it, so the browser path structurally cannot reach the shared list. The list is data with zero dependencies — it satisfies `@repo/errors`' "physically nothing for a bundler to pull in" rule, and putting it there is what makes "one list, so the two paths cannot disagree" actually true across all three.

- **Say whether the redaction list is *paths* or *leaf key names*, because its two consumers address different namespaces.** pino's `redact` compiles static paths against the object you log (`req.headers.authorization`). A Sentry `ErrorEvent` has none of those paths — the same secret lives at `event.request.headers.authorization`, `event.contexts.*`, `event.extra.*`, `exception.values[].stacktrace.frames[].vars.*`, and `breadcrumbs[].data.*`. NFR10 as written ("every path in the shipped list is replaced by the same placeholder in the log line and in the reported event", for *one input object*) is not satisfiable by one list of paths, because the event is not the input object. The decidable form: ship **key names**, and let each consumer derive its own matcher — pino paths generated at known roots, a bounded recursive walk in `scrubEvent`. Then NFR10 becomes testable.

- **Name the authoritative shape for `cause`.** `AppError.toJSON()` deliberately omits `cause`; the pino error serialiser "merges pino's with `AppError.toJSON()`", and pino's own `err` serialiser walks `cause`. Two authorities over one field means it is dropped twice or never. `cause` is the single field most likely to carry a wrapped driver/HTTP error with a connection string or an `Authorization` header in it, which is why this one matters more than its size suggests.

- **Settle whether redaction addresses the pre-serializer or post-serializer object.** `err.cause.config.headers.authorization` only exists *after* the error serialiser has run. Whichever way pino orders it, the spec should pin it and NFR10's test should assert against a fixture that has a nested `cause`, not a flat object — otherwise the test passes on a shape no incident produces.

- **Name the identifier a user quotes and the field that joins it back.** Story 6 wants "a reference identifier"; the design produces four ids and joins none of them to that one. `requestId` lives on `AppError` (server), `trace_id`/`span_id` live on the log line and the event (NFR5 joins those two, correctly), the Sentry event id is returned by `reportError` and thrown away, and React's `digest` is what `app/error.tsx` actually has in hand. Next's `digest` is derived from the error, so it identifies an error *class*, not an occurrence — two users hitting the same bug quote the same string. Stated as an access pattern: *"given a reference a user read off the error page, return every log line for that request"* — no field in the log line's schema serves that query. Either the log line gains `request_id` as a base field and the boundary is given it, or Story 6 explicitly says the reference is a class identifier and support pivots on `trace_id` from the event instead.

- **Declare the log line's field set as a stability contract.** The log line is the only schema this effort ships, and it has the one property a schema in a *template* has that a schema in a product does not: every clone's drain queries, saved searches, and future alerts bind to these names, and no clone can be migrated. Renaming `service`/`env`/`release`/`trace_id` later is a one-way migration with no forward fix available to the person it breaks. Say which fields are guaranteed and which are free-form now, while it costs a sentence.

- **`sendDefaultPii` must be pinned explicitly to `false` in `sentry.server.config.ts` and in the client init, and named in the runbook as the row to flip deliberately.** Sentry's wizard-generated config sets it `true`; if the template copies that shape, IP address, cookies, and request headers go to the vendor. Every one of those is `personal` under `data.md`'s fixed vocabulary — which means *never in a shared cache*, *carries a retention period and a deletion path*, and this effort has none of the three. A template that ships PII-on by default hands every downstream project a compliance decision it did not know it made. Verify the default against the pinned `@sentry/nextjs@10.70.0` rather than my recall.

- **Classify the two caller-supplied fields, since they are the ones redaction cannot reach.** `attributes` (flat primitives) and `metadata` (nested arbitrary) have no design-time class — whatever the caller puts in them is what they are. pino/fast-redact wildcards are single-level (`a.*.b`), with no recursive form, so a shipped path list *cannot* reach an arbitrary-depth `metadata`. Q4 already conceded this is "a rule people follow rather than a filter that runs"; the spec should carry that as a stated classification rule (`metadata` is treated as `internal` at most, and `secret` never enters it) rather than leaving it implied by the intent.

- **State the retention decision in the spec.** The word "retention" appears **zero times** in the draft. Q4's answer explicitly instructs Design to state the reasoning "in the spec rather than leaving the keys silently blank, so the next spec that needs them reads a decision instead of a gap" — and the draft's Out of Scope carries the parallel note for `default-availability`/`default-latency` but not this one. `retention-logs` and `log-retention` staying `UNSET` is a *decision* here, not a concern, and it needs a sentence naming both files and the reason (no hosting target, no drain, no `compliance-regime`).

## Risks

- **NFR10 is false for every client-side event, as the architecture is drawn.** `scrubEvent` and `redactPaths` are `@repo/observability` exports; `instrumentation-client.ts` "**Must not** import `@repo/observability`". So browser events reach Sentry with no scrubber at all. Concrete failure: a client component throws with a token in the message, `lib/report-client-error.ts` reports it, and the string the shipped list exists to remove is sitting in the vendor's UI — while a test asserting NFR10 on the server path stays green. This is the sharpest thing in the draft.

- **NFR5's "100%" cannot hold once anything logs inside `use cache`.** Cache Components is on (`apps/web/next.config.ts` → `cacheComponents: true`) and is the documented default for downstream data access. A log line emitted inside a cached function is emitted **once per cache miss, not once per request**: it carries the `trace_id` of whichever request populated the entry, and every subsequent request that hits the entry produces no line at all. A quantified NFR that says 100% of in-request lines match that request's event is falsifiable the first day a clone adds `use cache`. Scope it to uncached execution, or state that the logger must not be called inside a `use cache` scope and say what enforces that.

- **The tunnel route contradicts the intent's Out of Scope.** It appears under "stays Sentry-specific, deliberately", which reads as *ships*. A tunnel route is an unauthenticated origin endpoint that forwards arbitrary client-supplied bodies onward — which is precisely the "custom ingest endpoint … needing rate limiting, body caps, origin checks, and a schema" the intent and the spec both rule out two sections later. Either it is out of scope like the rest of the browser sink, or the spec owes it the four controls it just said a template must not decide on a downstream project's behalf.

- **`toJSON()` is the operator projection, and `JSON.stringify` calls it implicitly, everywhere.** `AppError` is importable in the browser by design. Any `JSON.stringify(error)` — in a client component, in a fetch error path, in the `console.error` that Q5 deliberately left open — silently emits `message`, `reason`, `hint`, `attributes`, and `metadata`, the whole operator half of the audience split. `toErrorResponse`'s whitelist protects the wire; nothing protects the implicit path, because `toJSON` is the name JS reserves for exactly that. Two projections of one entity want two explicit names, or the spec should state that the guarantee rests on a convention rather than on the type — which is the opposite of what Story 3 claims for it.

- **The DSN is `NEXT_PUBLIC_*` and therefore an unauthenticated, quota-bearing write key.** Correct classification (`public`, and correctly not a secret), but NFR12's quota discipline is written as if this repo's code is the only thing that can spend the quota. Anyone who reads the client bundle can post events to it. Worth one sentence in the runbook rather than a redesign.

- **`SENTRY_AUTH_TOKEN` is `secret` and `.env*` is a Turborepo `build` input.** `turbo.json` sets `"inputs": ["$TURBO_DEFAULT$", ".env*"]`. Routing the token through `globalPassThroughEnv` so it is never *hashed* is the right call and the spec gets it right — but if the token lands in a `.env.local` it is in the build's input set regardless of the env config, and under remote caching it would travel with the artifact. The spec should say the token comes from the environment, never a file. `secret-store` being `UNSET` is why this needs saying rather than assuming.

- **Source-map disposition is unstated.** `SENTRY_AUTH_TOKEN` + `SENTRY_ORG`/`SENTRY_PROJECT` means `withSentryConfig` uploads source maps; the spec does not say whether they are deleted from the deployed output afterwards. If left, server and client source are publicly fetchable — `internal` data served as `public`. One config key, verifiable against 10.70.0.

## Concerns

- [ ] **C-data-1** — Redaction coverage for the client report path (`lib/report-client-error.ts`), given `@repo/observability` is server-only and the shared list is not reachable from a browser module.
      **Risk if wrong:** NFR10 is asserted, tested green on the server, and false for every browser event; secrets in client error messages reach the vendor unscrubbed.
      **Owner:** Data lead (with Security owner).

- [ ] **C-data-2** — Whether `sendDefaultPii` ships `false`, and what the template says about the IP/cookie/header payload if a project turns it on.
      **Risk if wrong:** the template default sends `personal` data to a third party with no retention period and no deletion path — the exact combination `docs/policy/data.md` forbids.
      **Owner:** Data lead (with Security owner).

- [ ] **C-data-3** — The deletion path for `personal` data that reaches a log line or an event. "Deleted" has to name four places: stdout/the drain (downstream-owned), the vendor's retained events (a vendor-side setting, not a repo one), uploaded source maps, and anything a downstream cache holds.
      **Risk if wrong:** a subject-deletion request is answerable for rows a downstream project has and unanswerable for the two sinks this effort ships; the template quietly created that gap for every clone.
      **Owner:** Data lead. **Unblocks by setting:** `docs/policy/data.md` → `retention-personal`, bounded by `docs/policy/security.md` → `compliance-regime`.

- [ ] **C-data-4** — Log retention. The intent already decided these keys stay `UNSET`; the concern exists so the *decision* is visible in the spec, not so it is reopened.
      **Risk if wrong:** the next spec raises the same question from scratch and reads the blank as an oversight instead of a first-deploy answer.
      **Owner:** Data lead (with On-call lead). **Unblocks by setting:** `docs/policy/data.md` → `retention-logs` and `docs/policy/operability.md` → `log-retention` — set both or neither, per those files.

- [ ] **C-data-5** — Whether an emit inside a `use cache` scope is permitted, and what NFR5's "100%" means if it is.
      **Risk if wrong:** correlation silently degrades to one-line-per-cache-miss carrying a stale `trace_id`, invisible in dev with a cold cache and wrong in production on every hit.
      **Owner:** Data lead (with Tech lead).

## Handoffs

- **security-design** — C-data-1 and C-data-2 land there as much as here; the classification decides what may cross to the client and they own that side. Also the tunnel-route write surface, the `toJSON` implicit-projection leak, and the `SENTRY_AUTH_TOKEN`-in-`.env` question (`secret-store` is `UNSET`).
- **operability-design** — the log line's field set is a one-way migration for every downstream clone; there is no forward fix available to the person a rename breaks, so the stability contract is theirs to make explicit. Also `log-retention` (C-data-4) mirrors `retention-logs`, and the NFR5/`use cache` scoping is a correlation SLI question.
- **ux-design / simplicity** — the user-facing reference identifier (Story 6) is a data-join question here and a copy question there; I have named the missing join, not the string.

## Not applicable

Checked and genuinely absent from this change:

- **Entities to schema, primary keys, foreign keys, indexes, normalization/denormalization, unique constraints.** No table is created; the template still ships no `packages/db`. `store`, `orm`, `pk-strategy`, `soft-delete`, `migration-policy`, `backup-rpo`/`backup-rto` are all `UNSET` and correctly untouched by this effort — this is not a spec that should settle them, and it does not try to. What the absent layer *would* have settled and I therefore could not check: whether `AppError.requestId` should share a key format with a future request/audit table, and whether `pk-strategy`'s eventual choice (`uuidv7()` is the sensible default nobody has picked) makes `requestId` a foreign key or a free string.
- **Database migrations and expand–contract.** No schema change exists. The migration-shaped risk that *does* exist is the log-line field set, handled above under Recommend and handed to operability.
- **`remote-cache-handler` and `refreshTags()`.** `UNSET`, and this effort adds no `use cache: remote` read path — nothing here revalidates by tag, so the cross-instance tag trap does not fire. It becomes live the moment a downstream project sets the key, and at that point a custom cache handler is a *second* place code runs where `reportError` could be called; worth remembering, not worth designing for now.
- **Cache ownership per read path.** There are no data read paths in this effort. `use cache: private` is not in play. The one cache interaction that *is* real is the NFR5/`use cache` collision above.
- **Whether the design-system Vitest config transfers.** I did not evaluate the two new workspaces' test setup — the intent names it and it is not a data question.
