# Simplicity advisory — 0002 profile to Contact Exchange

## The simplest thing that satisfies the intent

`apps/web` plus **one** new server-only workspace. Routes: `/`, `/perfiles`, `/entrar`, `/publicar`,
`/perfil/[slug]`, `/propuestas`, `/propuesta/[id]`, `/admin`. Better Auth's magic link, Drizzle over
PlanetScale, one `sendNotification()` module with a Resend implementation behind it, four email
templates. Nine Server Actions rather than twenty-five. No `use cache` anywhere. No object storage.
No scheduled purge. Ordering by `delivered_offer_count ASC` with a daily-seeded tiebreak.

That covers stories 1, 2, 4, 5, 6, 7, 8, 9, 11 and 14 — publish, browse, gate, offer, human review,
accept, exchange, the two standing notices, the _autorización_. It is a working Contact Exchange.

**What breaks, checked one at a time:**

- **NFR10 (three projections, counted)** — survives. It is a pure function and a Vitest file; it does
  not need a workspace boundary, it needs `./projections` to be a module with no database import.
- **NFR15 (freeze in the same transaction as the Report)** — breaks. Report/Block (story 10) is not
  in the list above, and it should be. Add it back; it is one table, one edge table, one action.
- **NFR9 (0 `personal` columns in a shared cache)** — becomes vacuous, because there is no shared
  cache. See the `use cache` finding below.
- **NFR2 (p95 ≤ 400 ms on `/` and `/perfiles`)** — the only number that argues for the cache, and
  nothing in the spec shows a plain indexed read misses it.
- **NFR16 (habeas data clocks)** — survives, because no code implements it. It is a procedure.
- **NFR21 (attention spread)** — does not survive, and does not survive in the draft either. See
  below: the formula is not satisfiable at launch scale and not measurable at any scale.

Nothing else in the twenty-five NFRs is lost. **That is the finding.** The draft's extra parts are
not buying NFR coverage; they are buying structure, and structure is the thing this operator has the
least time to pay for.

**The arithmetic that should govern the Must list.** 16 `Must` stories, `stacked-prs` is `UNSET` so
`/implement` opens one independent PR per ticket, `pr-size-ceiling` is 1000 reviewed lines, and the
`Must` list **is** the announcement gate. One unpaid person, one ticket per session, one review cycle
each. The `Must` list is not a scope statement; it is a date. Every story kept in it is a day the
Hirer side is not being asked for anything. Stories 3, 13, 15 and 16 are days spent on things that
are not on the path from a published profile to a Contact Exchange.

## Recommend

- **Four new workspaces collapse to one.** `@repo/db` "exposes no query and no business rule" — it is
  a schema and a connection with two importers, and one of them (`@repo/auth`) already breaks the
  invariant the split exists to protect ("nothing imports it except `@repo/domain`"). `@repo/auth` is
  described as "server-only, plus one client subpath", which is a contradiction of the mechanism
  `CLAUDE.md` states for `@repo/observability` — a package with a client subpath is not server-only,
  and `assertServerOnly()` in it is a backstop guarding a door held open. `apps/web` can import
  `better-auth/client` directly; it does not need a repo wrapper for one file.
  **What survives:** the rule that matters — `apps/web` must not reach the schema — is enforced
  *better* by one workspace than by four, and more cheaply: leave `./schema` and `./client` out of
  the package's `exports` map and pnpm makes the import unresolvable. Four packages enforce exactly
  one edge (`apps/web` cannot resolve `@repo/db`) and enforce nothing about `./policy` not importing
  the client, because the whole package depends on it. **Saved:** three `package.json`, three
  `tsconfig.json`, three `vitest.config.mts`, three `.oxlintrc.json`, three turbo wirings, three
  `assertServerOnly()` sites, and three boundaries every future reader and reviewer has to hold.

- **`@repo/notifications` is a module, not a workspace — and this repo already decided that.**
  [ADR-0002](../../../adr/0002-reporting-vendor-seam.md) says it in the first paragraph: "it is a
  **seam, not an abstraction layer**". The reporting seam it describes — the closest existing
  analogue, same shape, same one-vendor-today property — is five files inside `packages/observability/src/`
  and one in `apps/web/lib/`. Intent Q1's obligation is that "a channel is added by implementing the
  seam, never by editing call sites"; a `./notifications` subpath with a `Notification` type and one
  Resend implementation satisfies that obligation exactly. **What survives:** Q1's seam property,
  unchanged, and the precedent stays consistent instead of gaining a second answer to the same
  question.

- **Drop `use cache` from the Wall, or state the number that requires it.** The cached read is the
  single most dangerous mechanism in this design — it is the whole reason NFR9 exists, the reason
  NFR2 needs a second clause for the 60 s after a deploy, and the reason story 2 has to revalidate a
  tag. Delete it and four things go with it: NFR9 becomes vacuous, NFR2's `≤ 800 ms` deploy clause
  disappears (it exists only because a cold *cache* is the problem), story 2's `[cache]` crossing
  goes, and DD1's "the framework enforces it from the other side" argument stops being load-bearing.
  Nothing in the spec measures a plain indexed `SELECT ... ORDER BY delivered_offer_count LIMIT 24`
  against the 400 ms budget at the traffic a three-municipality launch produces.
  **What survives:** NFR2's headline number, if a spike shows it is met — and the spike is cheaper
  than the proof obligation NFR9 imposes on every future cached function.

- **NFR21's formula is not a requirement; it is an unshippable one.** Two independent problems.
  *Arithmetic:* at N = 30 profiles and M = 5 delivered Offers in a week, `⌈3 × M/N⌉ = ⌈0.5⌉ = 1` — no
  Worker may receive more than one Offer per week. Hirers are the scarce side, so M < N/3 is the
  expected launch condition indefinitely, and the bound is pinned at 1. The first Worker to receive
  two Offers in a week breaches an NFR by being successful. *Measurability:* "by virtue of list
  position" is not attributable — nothing in this design can tell why a Hirer chose someone.
  **What survives:** the intent's actual sentence — "ordered to favour Workers who have received the
  fewest Offers". `ORDER BY delivered_offer_count ASC, hash(id, current_date)` is that sentence, is
  deterministic within a day so it is cacheable, and needs no rotation cursor and no schedule. Keep
  the spread bound as a thing to *watch*, not a thing to promise.

- **NFR16 is a runbook, not an NFR.** Ten business days for a _consulta_ is a procedure a person
  performs. `CLAUDE.md`'s own three-way split puts it in `docs/runbooks/`. As an NFR it binds
  stories 13 and 14, and `/to-tickets` copies bound criteria onto tickets — producing an acceptance
  criterion no diff can satisfy and no reviewer can tick with evidence. **What survives:** the
  clocks, verified against SIC guidance as the intent asks, written where the person who must meet
  them will look.

- **NFR17's scheduled purge is twelve months of carrying cost for a job whose first run is twelve
  months away.** Nothing is due for deletion until August 2027. The migration cost of adding it then
  is a cron entry and a `DELETE` — about the same as adding it now, which is the test. **What
  survives:** the retention *numbers* (they belong in the privacy notice and in `docs/policy/data.md`
  regardless) and story 13's on-request deletion, which is the path with a legal clock on it.

- **NFR25 measures nothing that exists.** A "rolling 7-day window" of send acceptance and hard-bounce
  rate needs either an events table or a dashboard; logs are undrained, there is no analytics, and
  `analytics-consent` is `UNSET`. Resend's dashboard already shows both numbers. **What survives:**
  the webhook — which is needed anyway for the bounce queue item — and a launch-week check named in
  the go-live runbook.

- **Product components belong in `apps/web`, not `packages/design-system`.** A `PerfilCard`, the
  Skill picker, and the two standing notices are product, and `apps/web` gains a Vitest config in
  this effort anyway. Putting them in the design system makes every copy tweak a cross-workspace
  edit and a second `@source` question. **What survives:** NFR19's WCAG bound, which is per surface
  and does not care which workspace the component lives in.

- **Story 15 shrinks to two files and a runbook line.** `verify-before-stop.sh` already refuses a
  session that reports done while lint/check-types/test are red, and `build-to-deploy-gate.sh`
  already refuses an agent merge — the agent path is gated today. What CI adds is the *human* path
  and the deploy trigger: one workflow running the four commands on PR, one deploy job on push, and
  `rollback-mechanism` set to a documented `fly releases` command rather than a mechanism to build.
  **What survives:** NFR24 in full, including the ≤ 5 minute undo.

## Risks

- **`@repo/db` as a separate workspace** — a package with no behaviour, whose stated invariant is
  violated on the first line of `@repo/auth`'s description. Over time it accretes "just one query"
  because there is no rule a reviewer can point at that distinguishes a query from a schema helper,
  and the boundary becomes a place where imports are argued about rather than a place where they are
  refused.
- **`@repo/auth`'s client subpath** — the one thing in the design that puts a browser-reachable entry
  point on a package that calls `assertServerOnly()`. `CLAUDE.md` is explicit that the mechanism is
  "no client module imports it" and the assert is only the backstop. This package is built to be
  imported by a client module. It will be the exception someone cites later.
- **The photo cluster** — `photoState`, `photoKey`, object storage (a **fifth** external account; the
  intent counted four), an upload path that NFR4 exempts from the no-JavaScript guarantee, a
  moderation queue source, two Admin actions, NFR6, and the "initial, not a badge" dignity
  requirement. It is the largest single cluster of moving parts in the spec and it is not on the path
  from publish to Contact Exchange. It may well be *right* — a face is plausibly what makes a Hirer
  choose a person over a fund — but the spec does not say so, and an unstated reason is one nobody
  can weigh against a closing window.
- **Twenty-five Server Actions, each authorizing independently** — and Testing Decisions correctly
  says each must be verified at seam 3 by requesting the endpoint unauthenticated. That is twenty-five
  runtime verifications a solo operator performs by hand through `next-dev-loop`. Every action kept
  in `Must` is one of those.
- **A freeze with no unfreeze** — NFR15 freezes a Hirer's Offer-sending in 0 further requests, and
  `unfreezeHirer` is inside story 19, which is `Should`. If 19 does not ship before announcement, an
  accusation is a permanent ban with no reversal path. The protective half is shipping without the
  corrective half, which inverts the intent's own sentence ("the automatic response is protective and
  the human response is corrective").
- **Story 3 creates a queue item nothing can resolve.** Requesting a Skill is `Must` (3); promoting
  one is `Should` (19). At announcement, `SkillRequest` rows accumulate in a queue with no action
  attached.

## Could be cut

- **Story 16 (framing rewrite of `PRODUCT.md`, `README.md`, `CLAUDE.md`) — out of the `Must` list.**
  This is the clearest cut available: it is documentation about the repository's self-description,
  it connects nobody, and as a `Must` it means *the announcement waits on a README rewrite*. The
  cheap half — five lines at the top of `CLAUDE.md` saying this repo is Recomencemos and product
  code belongs here — buys the whole stated benefit (a future agent stops judging product code by
  template fit). The full rewrite is `Could`.
- **Story 3 (in-form Skill request) → `Should`.** Intent Q2 is right that "a closed list with no way
  in is a list that silently excludes" — but the way in need not be in-product at launch. She
  publishes with the nearest Skills and her one line in her own words, and the operator adds Skills
  from what he sees. Cutting it removes the `SkillRequest` entity, one queue source, two Admin
  actions, and the inconsistency above.
- **Story 13 (self-serve account deletion) → `Should`.** Ley 1581 obliges the controller to honour a
  _supresión_ request on a clock, not to ship a button. The *statement* of the hard edge — deletion
  cannot reach a Hirer who already holds her phone — is copy, and belongs in story 14's privacy
  notice where it lands anyway. The transaction that touches every table and reduces every
  ContactExchange to counts is a week that could be spent on the Hirer side. See the handoff.
- **Story 18 (Spanish full-text search) → `Could`, and NFR20 with it.** At launch scale the browsable
  list is a page of cards; filtering by Skill slug and city is a `WHERE` clause. Free-text search
  with `pg_trgm` + `unaccent` + a 95%-accent-parity fixture is the largest infrastructure item in the
  spec supporting a story that is not `Must`.
- **Story 21 (last-active) → Out of Scope.** A `lastSeenAt` write on every authenticated request, on
  one Fly machine, for a `Could`.
- **Story 22 (queue age on every screen) → fold into story 7.** Story 7's own high-level design
  already says the queue shows the age of the oldest item. It is not a second ticket.
- **Story 17 (seven-day check-in) — keep as `Should`, and note it cannot be needed until seven days
  after the first Contact Exchange.** It is the one piece of this effort that can be built *after*
  announcement at zero cost, which is worth saying explicitly so it is not built before.

## Concerns

- [ ] **C-S1** — Four new workspaces (`@repo/db`, `@repo/domain`, `@repo/auth`, `@repo/notifications`)
      where one server-only workspace with a withholding `exports` map enforces the same boundary.
      **Risk if wrong:** if collapsed and the layering is later needed, the split costs a day of
      moving files; if kept, it costs three permanent boundaries, three test configs, and a
      contradiction with [ADR-0002](../../../adr/0002-reporting-vendor-seam.md)'s "seam, not an
      abstraction layer". **Owner:** Tech lead.
- [ ] **C-S2** — `@repo/auth` is declared server-only and exports a client subpath.
      **Risk if wrong:** `assertServerOnly()` becomes a guard everyone learns to route around, and
      the mechanism `CLAUDE.md` relies on ("no client module imports it") stops being true of a
      package that asserts it. **Owner:** Tech lead (with Security owner).
- [ ] **C-S3** — NFR21's `⌈3 × M/N⌉` bound evaluates to 1 at every plausible launch ratio and is not
      attributable to list position. **Risk if wrong:** a shipped NFR that a successful week
      violates, and a rotation cursor built to satisfy it that also defeats the Wall's cacheability.
      **Owner:** Tech lead (with Data lead).
- [ ] **C-S4** — `use cache` on the Wall read path, unmeasured against NFR2.
      **Risk if wrong:** the most dangerous class in this design (a `personal` column reaching a
      shared cache entry) is carried for a latency budget a plain indexed read already meets.
      **Owner:** Tech lead (with On-call lead). **Unblocks by:** one timing spike before Build.
- [ ] **C-S5** — Story 19's `unfreezeHirer` is `Should` while NFR15's synchronous freeze is `Must`.
      **Risk if wrong:** at announcement, one Report is an unappealable permanent ban administered by
      an accusation, on a platform where [ADR-0008](../../../adr/0008-open-enrolment-with-published-non-verification.md)
      says the adversary may arrive as a Worker. **Owner:** Security owner (with Repo owner).
- [ ] **C-S6** — Story 13 self-serve deletion as `Must` versus an on-request deletion handled by the
      controller within NFR16's clock. **Risk if wrong:** cutting it puts a statutory deadline on one
      unpaid person's inbox; keeping it spends a `Must` slot on a path with an expected launch-week
      volume near zero. **Owner:** Security owner (compliance). **Unblocks by setting:**
      `docs/policy/security.md` → the deletion-path half of `compliance-regime`.
- [ ] **C-S7** — `branch-protection` on a one-person repository. **Risk if wrong:** required *reviews*
      lock the only operator out of his own default branch or force routine admin bypass, which makes
      the protection theatre; required *status checks* alone give NFR24 everything it asks for.
      **Owner:** Repo owner. **Unblocks by setting:** `docs/policy/build.md` → `branch-protection`.
- [ ] **C-S8** — The photo, as a `Must`. **Risk if wrong:** cutting it removes what may be the single
      thing that makes a Hirer choose a person over a fund; keeping it silently adds a fifth external
      account, an object-storage dependency, a moderation queue source, and NFR4's one documented
      exception. Either way the spec should state the reason. **Owner:** Tech lead (with Design lead).

## Handoffs

- **Cutting self-serve deletion (C-S6) hands the legal clock to a person.** A _supresión_ request
  arrives by email to one unpaid controller under NFR16's 15-business-day clock. That is a real
  transfer of risk from the system to a human who may be asleep, and it should be named in the
  privacy notice's contact route rather than assumed.
- **Cutting `use cache` hands the deploy cold-start to operability.** Intent Q8 says every deploy is
  a cold start and the release moment is the peak load; with continuous deployment, an uncached Wall
  means every request reaches Postgres at exactly that moment. The counterargument is that a cache
  that dies with each build was never warm at that moment either — but the on-call lens should say so,
  not this one.
- **Cutting story 3 hands "mi capacidad no está en la lista" to the operator's inbox.** Intent Q2 is
  right that the way in must exist. Off-product it still exists — but it becomes invisible: nobody
  can count how many Workers hit a missing Skill and left. That is a real loss of the only signal
  about vocabulary coverage, and it is the reason to overrule this cut if it is overruled.
- **Collapsing the workspaces hands enforcement to the `exports` map.** If the map is later widened
  to export `./client` "just for a script", the boundary is gone with no compile error. That is
  cheaper to watch than three package boundaries, but it is a thing to watch, and it belongs in the
  spec sentence that records the collapse.
- **Removing the scheduled purge hands August 2027 to a calendar.** The obligation is to delete, not
  to have a scheduler — but an obligation with no mechanism needs an owner and a date written
  somewhere a person will see it, which is `docs/runbooks/`, not a comment.
- **Cutting full-text search hands accent handling to the filter UI.** If Skill and city become
  clickable chips rather than a text box, nobody types "albañil" without the tilde, and NFR20's whole
  problem class disappears. If a text box survives anywhere, NFR20 comes back with it.

## What earns its place

Said plainly, because an advisory that objects to everything is not read:

- **The three projections and their sentinel test (NFR10).** This is the mechanism that makes
  [ADR-0003](../../../adr/0003-no-tojson-on-cross-boundary-types.md) enforceable rather than
  aspirational, it is pure functions and one Vitest file, and it is the cheapest part of the design
  relative to what it prevents.
- **Seam 2 over PGlite.** A same-major in-process Postgres with the committed migrations and a
  restored snapshot per file is *fewer* moving parts than the alternatives — no container, no shared
  test database, no truncation ordering — and the version and extension claims were verified rather
  than recalled. It buys NFR15 and NFR11, both of which are transaction-shaped and untestable as
  pure functions.
- **`assertServerOnly()` reuse and the existing `@repo/errors` / `@repo/observability` split.** The
  spec reaches for what exists instead of inventing a parallel answer. The objection above is about
  how many *new* boundaries join them, not about these.
