---
stage: spec
status: draft
reviewed: 2026-08-25 fidelity
issue: 3
intent: ./intent.md
---

# Spec: Recomencemos — from a published CapabilityProfile to the first Contact Exchange

## Problem Statement

A person in Pereira, Dosquebradas or Santa Rosa de Cabal who lost her income on 10 August 2026 can
work today and has no way to be found. The relief that exists is addressed to housing damage, which
she never had. Her working reach is a neighbourhood that lost its income on the same morning she
did, and the people who could pay her are somewhere else.

Someone anywhere in the world who was moved by the news can give money to an institution. He cannot
see a person, cannot learn what she does, and cannot choose to pay _her_ for something he actually
needs done.

The team is one unpaid person with no legal entity, and the resource running out is attention rather
than money. A platform that opens after the news cycle has moved on has connected nobody.

## Solution

A Worker publishes a CapabilityProfile from a phone, in Spanish, in one sitting, with no document to
produce. It describes what she can do — Skills from the platform's vocabulary, a photo, one line in
her own words — and never what she lost. A Hirer browses without an account, signs in to read a full
profile, and sends an Offer with concrete terms he cannot revise. A human reads every Offer before it
reaches her. She accepts or rejects. On acceptance each side receives the other's contact details,
and the platform is done.

Six rules hold the design together. The last three were put there by the advisories rather than by
the draft, and each replaced something that looked fine and was not.

**Nothing unreviewed is ever reachable.** A profile reaches the Wall in seconds; its photo does not.
Until a human approves it the photo slot shows her initial, described as under review rather than
badged as suspect. The bound is over the stored **object**, not the page — a pending photo sitting at
a publicly-readable storage URL that nothing links to would satisfy the page-shaped version of this
rule and defeat its purpose.

**Three shapes of one profile, differing by exactly the fields that must not leak.** Public is the
Wall card. Gated adds her full self-description and work history, is served `noindex`, and costs a
Hirer an Account. Exchanged adds her full name, phone and email, and exists only after she has
accepted. Each is built field by field from a whitelist under
[ADR-0003](../../adr/0003-no-tojson-on-cross-boundary-types.md); nothing on the path defines
`toJSON`.

**A Server Action never touches the database.** It authorizes, parses its input once at the
boundary, and calls one domain module. Every query, transaction and business rule lives behind
`@repo/domain` — which is also the only place they can be tested, because Vitest cannot reach an
`async` Server Component and a rule written inline in a route file is a rule nothing verifies. See
[ADR-0010](../../adr/0010-the-domain-package-is-the-only-door-to-the-database.md).

**Nothing is cached across users.** No `use cache`, no `use cache: remote`, anywhere in this effort.
Three lenses converged independently: the leak the framework cannot catch is a cached function taking
an account id as an argument, which compiles and serves one Worker's gated profile to everyone;
nothing measures a plain indexed read as missing NFR2 at three-municipality volume; and under
continuous deployment every entry dies several times a day, so the cache is rarely warm enough to pay
for itself. See
[ADR-0011](../../adr/0011-no-shared-cache-until-a-measurement-requires-one.md).

**Attention is spread, and the mechanism is defended from the people it attracts.** The browsable
list orders by fewest **delivered** Offers — delivered, not sent, so an adversary cannot bury a
Worker under junk — with a stored rotation key so "fewest" does not collapse to "oldest". A list that
rewards a zero count also rewards a flood of fake profiles, so publishing is rate-limited and one
Account holds at most one profile by database constraint (NFR26).

**The platform states its own absences, including the two a Worker would otherwise get wrong.**
Nobody is verified; the platform holds no money and can recover none. And: a Block does **not** remove
her from the public Wall, because the Wall is readable signed out; deletion does **not** reach a Hirer
who already has her number. Both are said on the surface where she would otherwise assume otherwise.

## User Stories

Prioritized. Each is demoable on its own, because each becomes a tracer-bullet ticket. The `Must`
list is the **announcement gate** ([intent Q8](./intent.md)): deployment is continuous from the first
ticket, and nobody is told the site exists until every `Must` ticket is closed **and** NFR28's
operational leg is green.

**Every story carrying a surface opens with `/impeccable shape <target>`, then `/prototype` UI**,
inside its own ticket. See **UX design** for target paths and the ordering constraint.

**Must**

1. As a Worker, I want to sign in with a link sent to my email and no password, so that I can reach
   my account from a borrowed phone without remembering anything — and I want the sign-up surface to
   tell me, before I type anything, that I need an address I can open.
2. As a Worker, I want to publish a CapabilityProfile in one sitting from my phone — first name,
   last initial, city, Skills from a list, one line in my own words, my phone number, and a photo —
   so that someone can find me for work today.
3. As a Worker whose Skill is not on the list, I want to request it without abandoning the publish,
   **and as an Admin I want to promote a requested Skill into the vocabulary**, so that a closed list
   has a way in rather than silently excluding people.
4. As a Hirer with no account, I want to browse CapabilityProfiles and see what each person can do,
   so that I can decide whether there is anyone here worth paying before I am asked to register.
5. As a Hirer, I want to sign in and read a Worker's full profile — her full self-description and her
   work history — so that I know enough about her to write a concrete Offer.
6. As a Hirer, I want to send an Offer naming the work, the pay and the when, and to be told a person
   reads it before it reaches her and that I cannot change it, so that what I promise is what she
   reads.
7. As an Admin, I want one daily queue holding unreviewed Offers, unreviewed photos, Reports, Skill
   requests and bounced addresses, **with the age of the oldest item on every screen**, so that one
   person can hold the operational surface and sees the control band where the work happens.
8. As a Worker, I want to see the Offers I have received, read the full terms of each, and accept or
   reject it, so that the decision is mine and is made with everything in front of me.
9. As a Worker and as a Hirer, I want acceptance to deliver each of us the other's contact details on
   the site **and** by email, after a confirmation naming exactly which details cross and saying it
   cannot be undone, so that we can arrange the work ourselves.
10. As a Worker, I want to Report an Offer as abusive and Block a Hirer outright without explaining
    myself, **and as an Admin I want to unfreeze a Hirer**, so that the protective half and the
    corrective half ship together.
11. As anyone on the site, I want to be told prominently that nobody here is verified, that the
    platform holds no money, and what a Block does and does not reach, so that I am not relying on a
    protection that does not exist.
12. As a Worker signing in on a phone that is not mine, I want to say so, so that my session ends when
    the browser closes **and** expires server-side in hours rather than weeks, and I want to sign out
    everywhere from any device I still hold.
13. As a Worker, I want to delete my Account and be told plainly, before I confirm, what deletion
    reaches and what it cannot.
14. As the _responsable del tratamiento_, I want the privacy notice and the _autorización_ to name me
    and the processors, to be presented to **both** sides before their data is collected, and to
    record what each consented to and when, so that a habeas data request can be answered on Ley
    1581's clock.
15. As the operating team, I want the repository's first CI to run the full gate on every PR, the
    default branch to refuse a direct push, a deploy to be health-gated and undoable in minutes, and
    **the migration history to be mechanically protected from drift** — an append-only journal,
    immutable shipped migrations, and destructive statements isolated and opted into — so that
    continuous deployment with nobody on call has a gate, a mitigation, and a schema history that
    cannot rot silently. **This story is expected to split into two PRs** (the CI/deploy half and the
    migration-guardrail half); `docs/policy/build.md`'s `pr-size-ceiling` is 1000 reviewed lines.
16. As the operating team, I want a ceiling on every state-changing action and on gated profile reads,
    so that one person with a script cannot exhaust the reviewer's attention or harvest every
    displaced person's self-description in an afternoon.
17. As a Worker, I want the magic-link token that is the only key to my account to stop being
    transmitted to a third-party error processor, so that my one credential is not sitting in a
    vendor's transaction store.

**Should**

18. As a Worker and as a Hirer, I want a check-in seven days after a Contact Exchange asking whether
    the work happened and whether I was paid, so that there is evidence of whether any of this worked
    and a way to say "no me pagaron" without accusing anyone.
19. As a Hirer, I want to search and filter the browsable list by Skill and city in Spanish, including
    when I type without accents, so that I can find the person I need rather than scroll.
20. As an Admin, I want to take down a CapabilityProfile and to see the realized attention spread over
    the last seven days, so that the corrective half of moderation exists and the fairness property is
    observed rather than only asserted.
21. As a Worker whose email address hard-bounced, I want the site to tell me and let me change it from
    a session I still hold, so that a wrong address is not silently the end of my account.
22. As a maintainer, I want `PRODUCT.md`, `README.md` and the template-facing sections of `CLAUDE.md`
    rewritten to describe Recomencemos, so that a future agent stops judging product code by whether
    it improves a template.

**Could**

23. As an Admin, I want an audit record of every action I take, so that an abuse incident and a Ley
    1581 _reclamo_ can be reconstructed from something other than mutable rows.

## Non-functional requirements

- **NFR1 — Publish latency, end to end.** A Worker completing the form reaches the Wall in **≤ 5 s**,
  measured from submission to visibility on a fresh `/` load. No human review sits on this path.
  **Binds:** 2.
- **NFR2 — Read latency.** p95 **≤ 400 ms** server-side for `/` and `/profiles` on the Fly `iad`
  machine, and **≤ 1200 ms** measured from a Colombian client — the number that includes the
  ~90–110 ms Bogotá↔`iad` round trip the server-side figure excludes. Held at **50 req/s sustained**
  and **500 concurrent**. There is no cache, so there is no warm/cold distinction to state.
  **Binds:** 2, 4, 19.
- **NFR3 — Worker-path page weight.** `/` and `/publish` each ship **≤ 120 KB** of compressed
  JavaScript on first load and reach **LCP ≤ 2.5 s at p75** under 4× network and 4× CPU throttling.
  **Second half:** a page meeting the byte budget must still render the Wall's cards, both standing
  notices, and every field of the publishing form. A budget met by shipping less of the page is a
  budget failed.
  **Images are bounded separately, because on this page they are the dominant bytes.** Every photo is
  served at a width appropriate to its slot and in a format the browser negotiated — **0** Wall cards
  request an image more than **2×** their rendered CSS width, and resizing happens at the edge rather
  than on the Fly machine (DD6). **Binds:** 2, 4, 11.
- **NFR4 — Publishing without JavaScript.** With JavaScript unavailable or still loading, a Worker
  completes **every** field except the photo and submitting produces a published profile. The photo is
  the single documented exception and the form says so where it appears. **Binds:** 2, 4.
- **NFR5 — Browser floor.** Every platform feature on a Worker-critical path is **Baseline Widely
  Available** — 30 months past the date all four core browsers shipped it, verified against web.dev's
  definition rather than recalled. Concretely Chrome on Android 10+, Safari on iOS 16+, current
  evergreen desktop. Settles `browser-support`. **Binds:** 2, 4, 5, 8.
- **NFR6 — Nothing unreviewed is reachable.** **0** unmoderated photo **objects** are retrievable by
  an unauthenticated request, and **0** appear on any public or indexable surface. A profile whose
  photo is `pending` or `rejected` renders its initial everywhere except the Worker's own view.
  **Binds:** 2, 4, 7.
- **NFR7 — Offer review latency and queue depth.** Age of the oldest undelivered Offer **≤ 24 h**;
  unreviewed depth **≤ 50 items**; arrivals **≤ 20 Offers per rolling hour**. Both halves are needed —
  age-of-oldest moves slowly, so a flood keeps it green for most of a day while the queue becomes
  unholdable by one person. Best effort against `on-call-rotation` = **nobody**, and both sides' copy
  says so in those words. **Binds:** 6, 7, 8.
- **NFR8 — Gated surfaces are never indexed.** **100%** of responses for `/profile/*`, `/offers*`,
  `/my-profile*`, `/sent-offers*`, `/account*`, `/admin/*` carry `X-Robots-Tag: noindex, nofollow`
  and a `<meta name="robots">` equivalent, asserted by a table-driven test over the route list rather
  than a per-page attribute. `robots.txt` **does not** `Disallow` `/profile/*`: a disallowed URL is
  never fetched, so its `noindex` is never read, and a linked-but-disallowed URL can still be indexed
  as a bare string. NFR9 is what makes that bare string harmless. **Binds:** 5, 8.
- **NFR9 — The slug carries no identity.** A profile's public slug is server-generated, opaque,
  derived from **no** part of her name, city or Skills, and stable across edits. **Binds:** 4, 5.
- **NFR10 — The three projections, counted.** For a profile whose full name, phone, email,
  self-description and work history each carry a distinct sentinel: the **public** projection contains
  **0** sentinels; the **gated** contains the self-description and work-history sentinels and **0** of
  the other three; the **exchanged** contains all five. **Binds:** 4, 5, 9.
- **NFR11 — Contact details cross exactly once, and only on acceptance.** A Worker's phone, email and
  full name appear in **0** responses to any principal before she accepts that principal's Offer.
  **The Admin is the one stated exception, bounded per queue item:** Offer review renders the body and
  her display identity and **no** phone; the bounce item renders the address alone; the Report item
  renders neither. A Block or deletion removes them from every future response and from **0** completed
  Contact Exchanges — the deletion surface states that second number. **Binds:** 7, 9, 10, 13.
- **NFR12 — Free text rejects contact details, and says what it rejected.** Headline,
  self-description, work history and Offer body reject a submission containing a phone number, an
  email address, or a messaging-app URL in the forms named in DD3, and the rejection **names the
  fragment it objected to and preserves everything the person typed**. **Second half:** this is a
  speed bump, not a control — human review of every Offer is the control, and no copy claims
  otherwise. **Binds:** 2, 6.
- **NFR13 — Session lifetime, and revocation before expiry.** Own device **30 days** rolling. Shared
  device, self-declared **8 hours**, enforced on the **session row** and not only by a non-persistent
  cookie, because a cybercafé browser may not close for a week. Admin **8 hours**, no rolling. A
  Worker ends all her sessions from any device she holds; an Admin ends a reported Hirer's while
  handling the Report. Any session cookie cache is **off**, or every revocation here and NFR15's zero
  lag by its TTL. Settles `session-lifetime`. **Binds:** 1, 10, 12.
- **NFR14 — Admin authentication is a property of the session, not the principal.** Every `/admin/*`
  response — page and Server Action alike — to a session **not established through password + TOTP**
  is a **403**, even where the principal has both factors enrolled. An Admin who signed in through the
  magic link every Account can use is not an authenticated Admin.
  **The mechanism, because "a property of the session" is not free.** Better Auth records 2FA on the
  **user** (`twoFactorEnabled`), not on the session, and its 2FA flow guards only the credential
  path — so a magic-link session on an Admin account would carry full Admin authority having presented
  no second factor at all. Two things close that, and both are required: magic-link sign-in is
  **refused** for an account holding the Admin grant, and the session records the method that created
  it, through `session.additionalFields` written by a `databaseHooks.session.create.before` hook.
  `requireAdmin` reads that field, not `twoFactorEnabled`. **Binds:** 7, 20.
- **NFR15 — A Report freezes without waiting for a human, and the freeze is race-free.** From commit
  of a Report the reported Hirer sends **0** further Offers. `sendOffer` takes a row lock on the
  Hirer's Account inside its transaction: under READ COMMITTED an unlocked read of `offerSendingState`
  interleaves with the freeze and an Offer gets through, and a Report plus a burst of Offers from the
  same Hirer is the expected shape of the incident rather than an exotic one. `UNIQUE (offer_id)` on
  ContactExchange is the same discipline against a double accept. **Binds:** 10.
- **NFR16 — Habeas data.** A _consulta_ is answered within **10 business days**, extensible once by
  **≤ 5**; a _reclamo_ within **15 business days**, extensible once by **≤ 8**; an incomplete
  _reclamo_ returned for correction within **5 days**. Verified against Ley 1581 de 2012 arts. 14–15
  rather than recalled. **The clock is a runbook, not a diff.** What this spec makes buildable is the
  **subject-access export**: one function producing everything held about one person, built from the
  same whitelist mechanism as the three projections, so a new `personal` column omitted from the
  export fails the same class of sentinel test as NFR10. **Binds:** 13, 14.
- **NFR17 — Retention, as a graph with a purge order.** Reports **24 months**; Offers **12 months from
  send**, except an Offer referenced by a live Report, which is pinned until that Report purges;
  ContactExchange **12 months**, then reduced to non-identifying counts; CheckIns follow their
  exchange; Account, profile and photo **12 months after last sign-in**; logs **30 days**. Purge order
  is leaf-first — CheckIn, ContactExchange, Report, Offer, Profile, Account — so no foreign key
  dangles, which the per-table version of this requirement did in three places. "Deleted" means rows
  **and** storage objects **and** logs. Settles `retention-personal`, `retention-internal`,
  `retention-logs`, `log-retention`. **Binds:** 13, 14.
- **NFR18 — No personal data leaves the machine, on any egress.** **0** log lines, **0** Sentry events
  and **0** Sentry transactions carry a phone number, an email address, a full name, an Offer body or
  a Worker's own-words text. The test drives every logging call site **and** the `beforeSend` /
  `beforeSendTransaction` hooks with the same sentinels, because the shipped redaction list matches
  key names and contains no `phone`, `email`, `about` or `workDescription`. **Binds:** 1, 2, 6, 8, 9, 17.
- **NFR19 — `request.url` carries no credential to any processor.** The magic-link token is a query
  parameter and `CARRIER_PATHS` in `packages/errors/src/redaction.ts` has no `["request","url"]`
  entry — verified in the shipped file, whose own docstring defers the case to "whatever consumes
  transactions". This effort is that consumer. At `tracesSampleRate: 0.1` the exposure is ~1 in 10
  verify requests and 100% of errors on that route. Afterwards, **0** events or transactions reaching
  a processor carry a query string. **Binds:** 17.
- **NFR20 — Accessibility.** **WCAG 2.2 AA** (`docs/policy/ux.md` → `wcag-level`) on every surface, in
  the single light theme, in `es-CO`, including every error state and the full six-state set named per
  surface in **UX design**. **Binds:** 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 19, 20, 21.
- **NFR21 — Search quality in Spanish.** A query returns the same results with or without accents and
  in any case, over **≥ 95%** of the seeded vocabulary, measured against a fixture of
  accented/unaccented pairs. **Binds:** 19.
- **NFR22 — Attention spread, as the intent states it.** The browsable list orders by delivered-Offer
  count ascending, then a **stored** `rotationKey` rewritten daily, then id — index-ordered,
  keyset-paginable, and a pure function of stored columns. The observed property is reported weekly to
  the Admin: **the share of delivered Offers going to the single most-contacted profile over a rolling
  7 days**. The draft's `⌈3 × M/N⌉` bound is **withdrawn**: at the expected launch ratio — Hirers are
  the scarce side, so M < N/3 — it evaluates to 1, so the first Worker to have a good week violates
  it. **Binds:** 4, 19, 20.
- **NFR23 — Node floor.** Every dependency this effort adds declares an `engines.node` admitting every
  `24.x`, or none. Verified at Design against the versions this spec pins: `better-auth@1.7.1` and
  `drizzle-orm@0.45.2` declare none; `resend@6.22.1` declares `>=20`; `pg@8.23.0` declares
  `>= 16.0.0`; `@electric-sql/pglite@0.5.7` declares none. **Binds:** 1, 2, 9.
- **NFR24 — Environment declaration, and credentials in neither.** Every environment variable this
  effort introduces appears in `turbo.json`: build-baked values in `env` on `build`, runtime-only
  values in `globalPassThroughEnv`. **No runtime credential appears in any turbo task at all** —
  `DATABASE_URL`, `DIRECT_DATABASE_URL`, `RESEND_API_KEY`, the webhook signing secret, the R2
  credentials and Better Auth's secret are needed by no turbo task, and `.env*` files are `build`
  inputs. They reach the app through `fly secrets` only. `turbo build --dry` lists what remains.
  **Binds:** 1, 2, 9, 15.
- **NFR25 — The gate runs off a developer's terminal, and a bad deploy cannot take the site.**
  `pnpm lint`, `check-types`, `test` and `build` run in CI on every PR; the default branch refuses a
  direct push; deploys are **bluegreen and health-gated**, so a failing `GET /api/health` aborts the
  deploy and leaves the previous machine serving. A completed deploy is undoable in **≤ 5 minutes** by
  one documented command. `NEXT_PUBLIC_RELEASE` is set from the commit SHA, or every log line reads
  `release: "unknown"` while Sentry events carry a plugin-injected one and the two halves disagree.
  Settles `required-checks`, `branch-protection`, `rollback-mechanism`. **Binds:** 15.
- **NFR26 — Ceilings on the two exhaustible resources.** Gated profile reads **≤ 60 per Account per
  hour, ≤ 300 per day**, with a higher per-IP bound above it. Per Account and per IP:
  `publishProfile` **≤ 3/day**, `sendOffer` **≤ 10/day**, `reportOffer` **≤ 10/day**, `requestSkill`
  **≤ 5/day**, `createPhotoUpload` **≤ 10/day**, `changeEmail` **≤ 3/day**, `requestMagicLink`
  **≤ 5/hour per address and ≤ 20/hour per IP**. One Account holds at most one CapabilityProfile, by
  unique constraint rather than by the form. The counter lives in Postgres, not process memory,
  because deploys are continuous and an in-memory limiter resets several times a day. It **fails
  closed**.
  **Better Auth's own endpoints are a second door, and this requirement does not reach them.**
  `/api/auth/*` is directly reachable; a ceiling on the `requestMagicLink` Server Action does nothing
  for `/api/auth/sign-in/magic-link`. Better Auth's built-in limiter is on in production by default
  but keeps counters **in memory** unless told otherwise — resetting on every deploy, which is the
  exact defect this requirement already rejects for our own counter. So `rateLimit.storage` is
  **`"database"`** and the sensitive-endpoint rules are set explicitly rather than inherited.
  **And every per-IP bound depends on reading the right IP.** Fly's proxy sits in front of the app, so
  unless `advanced.ipAddress.ipAddressHeaders` names `x-forwarded-for`, every request appears to come
  from one address and **every per-IP ceiling above collapses into a single global one** — which would
  lock out legitimate users while barely inconveniencing an attacker.
  **Second half:** a refusal returns a typed value and does **not** throw, so a crawler cannot spend
  the month's Sentry error quota. **Binds:** 16, 2, 6, 10.
- **NFR27 — Sign-in actually completes.** **≥ 70%** of `requestMagicLink` calls are followed by a
  completed sign-in within 30 minutes, rolling 7 days; a **drop of > 20 points** against the trailing
  30-day value is the actionable signal. This replaces a bounce-rate-only indicator, which goes green
  while a new sending domain lands in Colombian spam folders — accepted, not bounced, never read —
  and magic link is the only key to an account. Hard bounces **≤ 2%** and **spam complaints ≤ 0.1%**
  remain as secondaries — a complaint is more damaging than a bounce to a single-domain sender, and the
  draft tracked neither. Costs two id-only `info` lines, so NFR18 is untouched. **Binds:** 1, 21.
- **NFR28 — The announcement has an operational leg.** Before anyone is told the site exists: the log
  drain is collecting, the uptime monitor is firing against `/api/health`, a rollback has been
  rehearsed once against production, the domain is a Cloudflare zone with **transformations enabled**
  (DD6 — a dashboard step, and photos serve at full size until it is done), and a load test shows NFR2
  held at its stated concurrency.
  **Two email preconditions, because the announcement is the spike and the magic link is the only door
  (DD14):** SPF, DKIM and DMARC resolve for the sending subdomain — verified with `dig`, not assumed —
  and the domain has been **warmed** to a daily volume that covers the announcement's expected sign-ups.
  A cold domain caps at 50–100 sends a day in its first week. **Binds:** 15, and gates every `Must`.

- **NFR29 — Spanish is the interface; English is the code.** **0** Spanish-language identifiers appear
  anywhere a developer types a name: route segments, file and directory names, database tables and
  columns, enum values, query parameters, API request and response field names, log `event` names,
  test names, branch names. The one permitted appearance of Spanish outside a rendered string is a
  **value** — `Skill.labelEs` holds Spanish, and its column name does not.
  **Second half — and it is the half that matters here:** this constrains identifiers only. Every
  string a person reads stays `es-CO` (`docs/policy/ux.md` → `locales`), and a surface that became
  less Spanish to satisfy this requirement has failed it, not met it. See
  [ADR-0012](../../adr/0012-spanish-is-the-interface-english-is-the-code.md).
  **Binds:** 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 20, 21.

- **NFR30 — Migration integrity, enforced rather than agreed.** Four counts, all machine-checked
  (DD13): **0** entries in `drizzle/meta/_journal.json` are removed, reordered, or mutated once
  committed — it is append-only. **0** migration `.sql` files change content after their tag reaches
  the default branch. A migration containing a destructive statement — `DROP TABLE`, `DROP COLUMN`,
  `DROP CONSTRAINT`, `ALTER COLUMN … TYPE`, `ALTER COLUMN … SET NOT NULL`, any `RENAME` — contains
  **only** destructive statements and carries an explicit marker. And **0** pull requests contain both
  a marked contract migration and a change to `@repo/domain`'s query modules, which is DD10's
  expand/contract rule made mechanical.
  **Second half:** a destructive change must stay **possible**. The marker is an opt-in, not a
  prohibition, and every refusal names the statement and the file it objected to — a guardrail that
  cannot be satisfied becomes a reason to edit production by hand, which is strictly worse than the
  drift it was built to stop. **Binds:** 2, 3, 6, 8, 9, 10, 13, 14, 15, 16.

**Availability is deliberately not an NFR here** and is concern C9 instead: the number is the On-call
lead's, and a single Fly machine with health-gated bluegreen deploys has a materially different
ceiling from one without. Naming a figure before that choice is settled would be a wish.

## Core entities

Vocabulary is `CONTEXT.md`'s and is binding. Entities named here for the first time belong in
`CONTEXT.md` by the end of this effort.

**Account** — one identity keyed by email (`citext`, unique, `personal`). Not typed at sign-up: it
becomes a Worker by holding a CapabilityProfile and a Hirer by having sent an Offer, exactly as
`CONTEXT.md` says. **Admin** is the exception — a grant, because it is conferred rather than earned,
and the first one is made by a documented manual `UPDATE` (DD7). Carries `emailStatus`,
`offerSendingState` (`active` | `frozen` | `banned`), `lastSignInAt`. Holds **0..1** CapabilityProfile
by unique constraint, not by the form — that constraint is half of NFR26's Sybil answer.

**CapabilityProfile** — 1:1 with an Account. `slug` (opaque, NFR9), `firstName`, `lastInitial`,
`city`, `headline`, `about`, `phone` (E.164), `photoState`, `photoKey`, `state`
(`published` | `taken_down`), `publishedAt`, `deliveredOfferCount`, `rotationKey`, `searchText`.
`firstName`, `lastInitial`, `city`, `headline` and an **approved** photo are `public`; `about`,
`phone` and the Account's `email` are `personal`. **`photoKey` is `personal` always** — the public URL
is derived only at `photoState = approved`, so "which URL do I render" is a projection question rather
than an accident. `deleted` is **not** a profile state: moderation takedown and the data subject's own
deletion are different acts and never share a mechanism (DD8). There is no field for what she lost,
and there will not be one
([ADR-0009](../../adr/0009-a-workers-full-identity-is-gated-and-never-indexed.md)).

**WorkHistoryEntry** — 0..n per profile, `personal`, gated, with an explicit `position` and
`UNIQUE (capability_profile_id, position)`. "Ordered" with no ordering column means an edit silently
reorders her history.

**Skill** — the closed vocabulary. `slug` (natural key), `labelEs`, `cuocCode`, `active`. `public`.
Seeded by an **idempotent migration**, so the test vocabulary and the production vocabulary cannot
drift and NFR21 is measured against the list production actually has. Grows only through Admin
promotion.

**ProfileSkill** — many-to-many, composite natural PK, indexed **in both directions**: the browse
filter reads it the reverse way from the profile render.

**SkillRequest** — a Worker's request for a missing Skill. `state`
(`pending` | `promoted` | `declined`). A queue item with a resolver, which is why story 3 carries both
halves.

**Offer** — from one Account to one CapabilityProfile, **immutable after send**. `workDescription`,
`payTerms`, `whenText`, all `personal`. `state`: `pending_review` → `delivered` →
(`accepted` | `declined` | `expired`), with `rejected_by_admin` and `reported` as terminal branches.
**`deliveredAt` is a column, not an inference** — `state` moves past `delivered`, so a count over
`state` stops counting an Offer the moment it is accepted, and `deliveredOfferCount` would drift
permanently with nothing able to rebuild it. `deliveredAt IS NULL` is also NFR7's queue metric and
NFR22's window.

**ContactExchange** — 1:1 with an accepted Offer, `UNIQUE (offer_id)`. Snapshots both sides' name,
phone and email at the moment of crossing, `personal`, so a later edit or deletion does not rewrite
history two people are already acting on.

**CheckIn** — 0..2 per exchange, one per side, at seven days. `personal`. The only impact evidence
that exists ([ADR-0007](../../adr/0007-the-platform-never-handles-money.md)).

**Report** — a Worker's assertion about one Offer. `reason` optional; she does not explain herself.
Commits with the Hirer's freeze in one transaction.

**Block** — a Worker → Hirer edge, permanent, no reason. **Keyed from the Offer**, never from a Hirer
account id supplied by a browser. What it reaches is bounded and stated: he cannot open her gated
profile and cannot send her anything. It does **not** remove her from the public Wall and cannot —
see concern C3.

**Consent** — notice version, _autorización_ version, timestamp. Written for the **Worker** at publish
and for the **Hirer** at first Offer send. The platform collects and then discloses his name, phone
and email too, and the draft had him consenting to nothing.

**RateCounter** — per principal, per action, per window. Boring, and NFR26 rests on it.

**AdminAction** — actor, action, target id, timestamp; ids and enum values only. A table rather than
log lines, because NFR18 forbids the payload on a line and NFR17 gives logs 30 days while a Report
lives 24 months. Story 23, `Could`.

**Session** and **Verification** are Better Auth's. The shared-device flag is carried through Better
Auth's own `additionalFields` mechanism, **never** as a hand-added column: a hand-added column on a
vendor table is invisible to the schema generator, and the next regeneration drops it — silently
reverting every borrowed phone to a 30-day session.

**Ownership edges.** Authorization hangs off **Account** for a Hirer's actions and
**CapabilityProfile** for a Worker's. An Offer has two owners and every read scopes by whichever the
caller is. The claim is enforced in the type rather than the prose: every `@repo/domain` function
reading or writing an owned row takes the principal as its **first required parameter**, and no
unscoped finder is exported.

## API / interface contract

Every Server Action **authorizes independently** — Next compiles each to a directly reachable POST
endpoint and a page-level check does not extend to it. Every one also **rate-limits** (NFR26) and
**calls a domain module rather than the database**.

### Public — no Account

| Surface                           | What it is                                      | Shape                                                              | Who may call                                                                                                    |
| --------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `GET /`                           | Server Component. Newest published profiles     | `PublicProfile[]`                                                  | Anyone. Indexable                                                                                               |
| `GET /profiles`                   | Server Component. Fewest delivered Offers first | `PublicProfile[]`, keyset-paginated                                | Anyone. Indexable                                                                                               |
| `GET /sign-in`                    | Server Component + one Client Component         | —                                                                  | Anyone                                                                                                          |
| action `requestMagicLink`         | Server Action                                   | `{ email, sharedDevice, returnPath? }` → `{ ok: true }` **always** | Anyone. Rate-limited. `returnPath` must be a single-leading-slash relative path; `//host` and `/\host` rejected |
| `GET /api/auth/*`                 | Route Handler (Better Auth)                     | its own                                                            | Anyone. `trustedOrigins` set explicitly. Token is a **query** parameter, single-use, TTL in DD5                 |
| `GET /api/health`                 | Route Handler                                   | `200`, empty, after a trivial DB round trip, in **≤ 50 ms**        | The deploy health gate and the uptime monitor. `noindex`, returns no data                                       |
| `GET /robots.txt`, `/sitemap.xml` | Route Handlers                                  | —                                                                  | Anyone. The sitemap lists `/` and `/profiles` and **no** profile                                                |

### Worker — Account required, `noindex`

| Surface                                                 | Shape                                                                                                                                 | Who may call                                                                                                                                                                                                               |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /publish`                                          | —                                                                                                                                     | Signed-in Account with no CapabilityProfile                                                                                                                                                                                |
| action `publishProfile`                                 | `{ firstName, lastInitial, city, headline, about, phone, skillSlugs[], workHistory[], consentVersion }` → `{ ok } \| { fieldErrors }` | Itself only                                                                                                                                                                                                                |
| action `createPhotoUpload`                              | `{ contentType, byteLength }` → `{ uploadUrl, photoKey }`, a presigned PUT into a quarantine prefix                                   | The owner. **Not** a multipart Server Action — the body limit defaults to 1 MB and a phone photo is 2–5 MB (DD6)                                                                                                           |
| action `attachPhoto`                                    | `{ photoKey }` → `{ photoState: "pending" }`                                                                                          | The owner                                                                                                                                                                                                                  |
| action `requestSkill`                                   | `{ text }` → `{ ok }`                                                                                                                 | The owner                                                                                                                                                                                                                  |
| `GET /my-profile`                                       | `OwnProfile` — the gated shape plus her own photo whatever its state                                                                  | The owner                                                                                                                                                                                                                  |
| `GET /offers`, `GET /offers/[id]`                       | `ReceivedOffer[]`, `ReceivedOffer`                                                                                                    | The owner, scoped by profile ownership                                                                                                                                                                                     |
| action `acceptOffer`                                    | `{ offerId, confirmed: true }` → `{ exchange }`                                                                                       | The addressee. Two-step: the confirmation names which details cross and that it is irreversible                                                                                                                            |
| actions `declineOffer`, `reportOffer`, `blockFromOffer` | `{ offerId, reason? }` → `{ ok }`                                                                                                     | Same. `blockFromOffer` takes the **Offer** id, so Hirer account ids never cross to a browser                                                                                                                               |
| action `signOutEverywhere`                              | `{}` → `{ ok }`                                                                                                                       | Itself                                                                                                                                                                                                                     |
| action `changeEmail`                                    | `{ email }` → `{ ok: "verification_sent" }`                                                                                           | Itself. **Two-phase**: the new address is verified before the switch, the old address is notified, and all other sessions end on completion. A one-shot switch is an account-takeover primitive from any abandoned session |
| action `deleteAccount`                                  | `{ confirmationPhrase }` → `{ ok }`                                                                                                   | Itself, and only from a **fresh** sign-in                                                                                                                                                                                  |

### Hirer — Account required, `noindex`

| Surface               | Shape                                                                                                | Who may call                                                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `GET /profile/[slug]` | `GatedProfile`                                                                                       | Signed-in Account not Blocked. Charged against NFR26's read ceiling. A Blocked caller gets the same response as a missing profile |
| action `sendOffer`    | `{ profileSlug, workDescription, payTerms, whenText, consentVersion }` → `{ ok } \| { fieldErrors }` | Signed-in Account whose `offerSendingState` is read **from the row under a lock**, never from the session, and who is not Blocked |
| `GET /sent-offers`    | `SentOffer[]` — state only; no contact details unless exchanged                                      | The sender                                                                                                                        |

### Admin — password **and** TOTP on the session itself

| Surface                                                                                                                                                                                 | Shape                                                                                     | Who may call                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `GET /admin`                                                                                                                                                                            | `QueueItem[]` across five sources, each branch `LIMIT`-capped, with the age of the oldest | An Admin **session** (NFR14)                                      |
| actions `deliverOffer`, `rejectOffer`, `approvePhoto`, `rejectPhoto`, `resolveReport`, `unfreezeHirer`, `banHirer`, `promoteSkill`, `declineSkill`, `takeDownProfile`, `revokeSessions` | `{ id, ... }` → `{ ok }`                                                                  | An Admin session, each re-checking, each writing an `AdminAction` |

### Webhook

`POST /api/webhooks/resend` — signature-verified with a timestamp window against replay, idempotent
on the event id, bodyless `401` on failure. A forged bounce is an account-denial primitive, because
magic link is the only sign-in.

### Cross-boundary types

**Membership means: exactly these keys are present on the wire, and adding a field to the entity
reaches none of them until someone writes it into one.**

- **`PublicProfile`** — `slug`, `firstName`, `lastInitial`, `city`, `headline`, `skills[]`,
  `photoUrl | null`, `publishedAt`.
- **`GatedProfile`** — every `PublicProfile` key, plus `about`, `workHistory[]`.
- **`ExchangedContact`** — `fullName`, `phone`, `email`, and the counterpart's same three. Reachable
  only from a ContactExchange row.
- **`ReceivedOffer` / `SentOffer`** — `id`, `state`, `workDescription`, `payTerms`, `whenText`,
  `sentAt`, plus the counterpart's `PublicProfile`-shaped identity and nothing more until exchange.

None defines `toJSON`; each is built field by field
([ADR-0003](../../adr/0003-no-tojson-on-cross-boundary-types.md)).

### Modules and workspaces

**Two new workspaces, not four.** The draft proposed `@repo/db`, `@repo/domain`, `@repo/auth` and
`@repo/notifications`. `@repo/db`'s stated invariant — "nothing imports it except `@repo/domain`" —
was violated on the first line of `@repo/auth`'s own description, and a **withholding `exports` map**
enforces the boundary that matters more cheaply than a package split: an unexported subpath is
unresolvable under pnpm's isolated store, which is a stronger guarantee than a convention spread over
four packages. Better Auth moves inside `@repo/domain` because Accounts are a domain aggregate and
Better Auth owns their tables — which also removes the draft's contradiction of a server-only package
carrying a browser-reachable subpath.

| Workspace                                         | Public subpaths                                                                                                                                                                      | Why here                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`@repo/domain`** (new, server-only)             | `./accounts`, `./profiles`, `./skills`, `./offers`, `./exchange`, `./moderation`, `./rate-limit`, `./projections`, `./policy`, `./guards`, `./auth-handler`, `./migrate`, `./export` | The models. Every query, transaction and business rule sits behind one of these. **Not exported, therefore unreachable from `apps/web`: the Drizzle schema, the connection, and the Better Auth instance.** `./policy` and `./projections` are pure. `./export` is NFR16's subject-access export. Depends on `@repo/errors`, `@repo/observability`                                                                              |
| **`@repo/notifications`** (new, server-only, JSX) | `./send`, `./templates/*`                                                                                                                                                            | The seam. One implementation today (Resend). A channel is added by implementing the seam, never by editing a call site ([intent Q1](./intent.md)). Carries a **kill switch**, because a send is the one irreversible act in this system. Templates are **React Email** components (DD14), so it takes `react` and `@react-email/components` and extends `@repo/typescript-config/react-library.json`. Depends on `@repo/errors` |
| `@repo/errors`                                    | existing                                                                                                                                                                             | Gains `["request","url"]` handling for NFR19                                                                                                                                                                                                                                                                                                                                                                                    |
| `@repo/design-system`                             | existing                                                                                                                                                                             | Only genuinely reusable primitives. `PerfilCard`, the Skill picker and the two standing notices are **product** and live in `apps/web`                                                                                                                                                                                                                                                                                          |
| `apps/web`                                        | —                                                                                                                                                                                    | Routes, Server Actions, rendering, product components. **Gains a Vitest config for the first time.** Imports `better-auth/react` directly for the client half, so no server-only package carries a browser subpath                                                                                                                                                                                                              |

```
apps/web  →  @repo/domain        →  @repo/errors, @repo/observability
          →  @repo/notifications →  @repo/errors
          →  better-auth/react      (client only, imported directly)
```

Each new package extends `@repo/typescript-config`, restates no compiler option, and adds no `@source`
glob — neither carries Tailwind classes, and `globals.css` already globs
`../../../../apps/**/*.{ts,tsx}`. Both call `assertServerOnly()` as the backstop; the mechanism is
still that no client module imports them.

## High-level design

One pass per `Must` story, naming components rather than files. Boundaries are marked **[trust]** or
**[network]**. There is no **[cache]** marking anywhere, and that is ADR-0011.

**Story 1 — sign in.** `/sign-in` is a Server Component with one Client Component: the email field and
the _"este no es mi teléfono"_ checkbox. `requestMagicLink` **[trust]** rate-limits, records the
shared-device choice through Better Auth's `additionalFields`, and asks the notification seam
**[network]** to send. The reply is `{ ok: true }` whatever happened, so the endpoint cannot enumerate
addresses. Verify mints a session whose lifetime and cookie persistence come from that choice (DD5).
The surface says she needs an address she can open **before** she types one.

**Story 2 — publish.** `/publish` posts every field except the photo through `publishProfile`
**[trust]**, which authorizes, rate-limits, parses the whole payload once at the boundary, runs the
contact-detail rejector (DD3), computes `searchText` and `slug`, and writes profile, skills, work
history and the Worker Consent row in **one transaction**. Published on commit — nothing waits on a
person (NFR1). The photo takes the separate presigned path in DD6.

**Story 3 — the vocabulary's way in.** The Skill picker's last option posts `requestSkill` inline
without leaving the form. The request enters the queue and `promoteSkill` resolves it. Both halves are
one story, because a queue item whose resolver is a lower-priority story is a queue item that
accumulates.

**Story 4 — browse.** `/` and `/profiles` are Server Components reading `PublicProfile[]` through a
plain indexed query. No cached scope, so the class of bug where a cached function takes an account id
cannot exist here at all. Skills are aggregated in **one** query rather than per card — N+1 on a
paginated list is what would actually miss NFR2. Both standing notices render on both.

**Story 5 — read a full profile.** `/profile/[slug]` reads the session **[trust]**, redirects an
anonymous caller to `/sign-in` with a validated return path, checks the Block edge, charges the read
against NFR26's ceiling, and renders `GatedProfile` dynamically. A Blocked caller gets exactly the
missing-profile response: telling him she Blocked him is itself a disclosure.

**Story 6 — send an Offer.** `sendOffer` **[trust]** authorizes, rate-limits, takes a row lock on the
Hirer's Account, re-reads `offerSendingState` and the Block edge under it, runs the rejector, and
writes an immutable Offer in `pending_review` plus the Hirer Consent row. Nothing is delivered. The
confirmation says a person reads it first, that this usually takes under a day, and that he cannot
change it.

**Story 7 — the queue.** `/admin` unions five sources, each served by a **partial index** on its
pending predicate, so the age-of-oldest is an index-only scan over a handful of rows rather than five
sequential scans that grow with total table size forever. Each branch is `LIMIT`-capped — an unbounded
union after three days away is exactly when the surface needs to still load. Every action re-checks
the Admin session **[trust]**, writes an `AdminAction`, and renders only the fields NFR11 permits that
item type. `deliverOffer` sets `deliveredAt`, increments the counter, and notifies **[network]**.

**Story 8 — answer an Offer.** Dynamic reads scoped by profile ownership. `acceptOffer` **[trust]**
re-reads the Offer inside a transaction, refuses anything not `delivered`, and writes the exchange
under `UNIQUE (offer_id)`.

**Story 9 — the Contact Exchange.** The transaction **commits first**, then enqueues both sends and
both check-ins. The details are on screen because the email is a copy rather than the original — a
failed send must not lose the one thing she accepted in order to get.

**Story 10 — Report, Block, unfreeze.** `reportOffer` **[trust]** writes the Report and sets `frozen`
in one transaction, hides the Offer from her, and enqueues it. `blockFromOffer` writes the edge from
the Offer. `unfreezeHirer` is the Admin's half and ships in this story rather than a later one.

**Story 11 — the notices.** Product components on the Wall, on `/profiles`, on every profile and every
Offer surface. Three statements, not two: nobody is verified, we hold no money, and a Block does not
remove her from the public Wall.

**Story 12 — sessions.** DD5.

**Story 13 — deletion.** Requires a fresh sign-in, states the hard edge before taking the
confirmation, then hard-deletes rows, deletes storage objects, and reduces every ContactExchange the
Account appears in to non-identifying counts.

**Story 14 — consent.** Both sides, before collection, naming the _responsable_ and the four
international processors.

**Story 15 — CI, deploy, and migration guardrails.** DD10 and DD13. **Story 16 — ceilings.** DD7. **Story 17 — the egress fix.** DD11.

## Deep dives

One per non-functional requirement the high-level design does not already satisfy. **The ones it does
satisfy, stated rather than omitted:** NFR1 (no human review on the publish path), NFR4 (Server
Components and a progressively-enhanced form are the default here), NFR5 (a floor, checked at review),
NFR8 and NFR9 (a route group and an opaque slug generator), NFR10 (pure projections, tested at seam
1), NFR20 (per surface, in **UX design**), NFR23 (verified above), NFR24 (a `turbo.json` edit).

### DD1 — Why nothing is cached (NFR2)

`use cache` is the obvious reach on a public read path, and this effort does not take it. Three
independent findings pointed the same way, and the third is the one that settles it.

**The leak the framework cannot catch.** The draft claimed a gated read "cannot compile inside a
cached scope because it reads `cookies()`". That is true only of reads that call `cookies()`. The
compliant-looking version — authorize outside the cache, pass the profile id or the account id in as
an argument, return `GatedProfile` — compiles perfectly and serves one Worker's `about` and work
history to everyone who hits the entry. The compiler is a coincidence, not a control. Both the data
and security lenses found this independently.

**Nothing shows the cache is needed.** Three municipalities, hundreds of profiles at launch. A keyset
query over a partial B-tree index returning 24 rows, with skills aggregated in the same statement, is
a single-digit-millisecond read; PlanetScale `us-east-1` and Fly `iad` are the same metro (~1–3 ms).
NFR2's 400 ms is three orders of magnitude above that — a design decision recorded, rather than a hope.

**And it would rarely be warm.** Cache entries key on the build id, so every deploy empties them, and
[intent Q8](./intent.md) makes deploys continuous. A cache emptied several times a day on a
single-machine app pays its full correctness cost for a fraction of its benefit.

What this buys: the whole class of shared-cache disclosure bugs is **absent** rather than guarded, and
no future cached function inherits a proof obligation. What it costs: if NFR2 is ever missed, caching
is the first tool, and it returns with the whitelist test attached. That is
[ADR-0011](../../adr/0011-no-shared-cache-until-a-measurement-requires-one.md), which also records
that `remote-cache-handler` = none and one machine mean `revalidateTag`'s cross-instance problem does
not bite today — and that a second machine reintroduces it with no handler to carry the fix.

### DD2 — Schema, keys, and the indexes the access patterns actually need (NFR2, NFR7, NFR22)

`pk-strategy` is **`BIGINT GENERATED ALWAYS AS IDENTITY` by default, and `uuidv7()` only where an id
reaches a URL or a browser.** The draft made every key a `uuidv7()`; the `planetscale:postgres`
guidance is the other way round and it is right — a UUID is 16 bytes against 8, it widens every index
and every foreign key that references it, and it slows joins. The exception earns itself on one
table rather than on all of them:

- **`Offer.id` is `uuidv7()`**, because `/offers/[id]` puts it in a URL. A `BIGINT IDENTITY` there
  publishes the platform's total Offer count to every Hirer on his first Offer and hands an
  enumerator a clean `/offers/1..N` sweep. Authorization stops the read; it does not stop the
  existence oracle.
- **Everything else is `BIGINT IDENTITY`.** `CapabilityProfile` in particular: its public handle is
  the opaque `slug` (NFR9), so its primary key never crosses a boundary and has no reason to be wide.
- **Better Auth owns the shape of its own tables** — `account`, `session`, `verification` — and this
  spec does not override it. That is a third id convention in one schema, and naming it here is
  cheaper than discovering it at Build.
- **Pure join tables** (`ProfileSkill`) take a composite natural PK and no surrogate at all.

`uuidv7()` is native in Postgres 18, and PGlite 0.5.7 is 18.3, so the test seam has it with no
extension divergence and no `uuid-ossp`.

Three schema rules that apply to every table and are cheaper stated once than argued per migration:
**`NOT NULL` wherever feasible**; **`created_at TIMESTAMPTZ NOT NULL DEFAULT now()` on every table**,
because the Admin queue, the retention graph and every incident reconstruction read it; and **every
foreign key column carries its own index** — Postgres does not create one, and an unindexed FK turns
the leaf-first purge in NFR17 into a sequential scan per parent row.

`orm` is **Drizzle**, with **committed SQL migrations** — the same files run against PlanetScale and
against PGlite, which is what makes seam 2 a real seam rather than a parallel schema.

The indexes, derived from the reads rather than guessed:

| Read                        | Index                                                                                                     |
| --------------------------- | --------------------------------------------------------------------------------------------------------- |
| Wall                        | partial `capability_profile (published_at DESC, id DESC) WHERE state='published'`                         |
| Browse                      | `(delivered_offer_count, rotation_key, id) WHERE state='published'`                                       |
| Browse + city               | `(city, delivered_offer_count, rotation_key, id) WHERE state='published'` — the equality column **leads** |
| Browse + skill              | `profile_skill (skill_id, capability_profile_id)` — the reverse of the natural PK                         |
| Profile                     | `UNIQUE (slug)`                                                                                           |
| Block check                 | `UNIQUE (worker_profile_id, hirer_account_id)` — read on every gated view and every `sendOffer`           |
| Received / sent Offers      | `offer (capability_profile_id, sent_at DESC)`, `offer (hirer_account_id, sent_at DESC)`                   |
| **The five queue branches** | five **partial** indexes, one per pending predicate                                                       |
| `signOutEverywhere`         | `session (account_id)` — Better Auth may not create it                                                    |

The five partial indexes are the clearest case in the schema: without them, story 7's age-of-oldest is
five sequential scans per Admin page render, growing with total table size forever while the pending
set stays near zero.

**`rotationKey` is a stored column, not a per-request expression.** `hash(id, now())` or `random()` is
not a function over an indexed column, so the planner sorts the whole published set on every page
load — and worse, it destroys keyset pagination: page 2 is drawn from a different ordering than page 1,
so the Hirer sees duplicates and misses profiles. The fairness mechanism would defeat itself. A
daily-rewritten integer keeps the sort index-ordered, keyset-paginable, and a pure function of stored
columns, which is what lets NFR22 be tested at seam 1. It also keeps the ordering out of any function
that reads the clock — which under Cache Components is its own failure mode, the same one `CLAUDE.md`
already documents for `pino` stamping `time`.

Enum-shaped columns are `TEXT` with a `CHECK (col IN (...))`, not Postgres `ENUM`: adding a fourth
municipality is then a constraint change rather than a type alteration. `TIMESTAMPTZ` everywhere, in a
product spanning `America/Bogota` and "anywhere in the world". **Where validation is authoritative:**
the boundary parse produces `fieldErrors` for a person; a `CHECK` is a backstop that must never fire,
and when it does the answer is a 500, not a field error.

**Two connection strings.** PlanetScale's pooler runs transaction-pooling mode, so DDL, long
transactions and session state belong on the **direct** connection while the app uses the pooler.
`@repo/domain/migrate` and the runtime client therefore take different URLs — two environment
variables, both declared per NFR24. Transaction pooling also removes `LISTEN/NOTIFY`, session advisory
locks, temp tables and cross-transaction prepared statements, which is why DD10's scheduler cannot use
an advisory-lock single-runner, and why `pg` is pinned rather than `postgres.js` (which prepares by
default).

### DD3 — The contact-detail rejector, and what it honestly is (NFR12)

[ADR-0008](../../adr/0008-open-enrolment-with-published-non-verification.md) requires free-text fields
to reject phone numbers and email addresses "so the consent step cannot be routed around". The forms
it must catch: `+57 300 123 4567`, `3001234567`, `300-123-4567`, `300 123 45 67`, an `@` address in any
spacing, and — added by the security lens — `wa.me/57…`, `t.me/…` and shortened links, because a
messaging URL is a phone number wearing a different hat and is simultaneously the phishing vector
against the Hirer.

It will not catch a number spelled in words, a number split across two sentences, or a handle a person
recognises and a regex does not. **NFR12's second half is that admission**: the rejector is a speed
bump, and human review of every Offer is the control. No copy on either side claims otherwise, because
a Worker who believes the field is a filter is relying on a protection that does not exist — the exact
failure ADR-0008's framing exists to refuse.

The rejector is a pure function in `@repo/domain/policy`, tested at seam 1 over a fixture of positives
**and** negatives: a rule that rejects "llámame el 15 a las 3" has broken the publishing form for
everyone.

### DD4 — Spanish search without lying to the planner (NFR21)

`unaccent()` is **`STABLE`, not `IMMUTABLE`**, so `CREATE INDEX ... ON (unaccent(headline))` is refused
by Postgres, and a `GENERATED ... STORED` column over it is refused for the same reason. The folklore
fix — wrapping it in a hand-declared `IMMUTABLE` SQL function — works and is a lie to the planner:
change the dictionary and the index silently returns wrong rows.

So normalization happens **in the application at write time**, into a plain `searchText TEXT NOT NULL`
column: lowercased, accents folded, written on publish and on edit. Three consequences, all wanted.
The normalizer is a pure function testable at seam 1 beside the rejector. The `unaccent` extension is
not needed at all, so PGlite and PlanetScale cannot diverge on a text-search configuration. And the
query is a `pg_trgm` GIN index over `searchText` for the Skill-and-headline match — which is the
strategy this spec picks rather than leaving open.

One shape to know rather than discover: a GIN index **cannot supply ordering**, so a text search
combined with the `deliveredOfferCount` sort is always a bitmap scan plus a sort. At launch volume that
is fine, and it is written here so nobody later reads it as a regression.

Story 19 is `Should`. If it slips, filtering by Skill slug and city is a `WHERE` clause over indexes
that already exist, and NFR21 slips with it.

### DD5 — Auth configuration, sessions, and the Admin's second factor (NFR13, NFR14, NFR26)

Read against `better-auth@1.7.1`'s own guidance rather than recalled. Eleven settings below are
**not defaults** — each is either off, memory-backed, or pointed at the wrong thing until set, and
three of them would ship as security holes rather than as rough edges.

| Setting                                          | Value here                               | Why it is not the default                                                                     |
| ------------------------------------------------ | ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| `rateLimit.storage`                              | `"database"`                             | Defaults to memory; deploys are continuous, so the limiter resets several times a day (NFR26) |
| `rateLimit.customRules`                          | explicit on the magic-link and 2FA paths | Inheriting "3 per 10 s" leaves the one credential in this system on a default                 |
| `advanced.ipAddress.ipAddressHeaders`            | `["x-forwarded-for"]`                    | Fly proxies every request; unset, every per-IP ceiling becomes one global ceiling             |
| `session.cookieCache`                            | **disabled**                             | Enabled, every revocation in NFR13 and NFR15's zero lag by its TTL                            |
| `session.expiresIn` / `updateAge`                | per NFR13, per device class              | Defaults are 7 days / 1 day for everyone                                                      |
| `session.additionalFields`                       | records the sign-in method               | NFR14's mechanism; there is no built-in equivalent                                            |
| `user.changeEmail.enabled`                       | `true`                                   | **Disabled by default** — the contract's `changeEmail` silently does nothing otherwise        |
| `user.deleteUser.enabled`                        | `true`                                   | **Disabled by default** — same for story 13, which is a Ley 1581 surface                      |
| `emailAndPassword.requireEmailVerification`      | `true`                                   | Admin only; the credential account is the one worth it                                        |
| `emailAndPassword.revokeSessionsOnPasswordReset` | `true`                                   | Off by default, so a reset would leave the attacker's session alive                           |
| `emailAndPassword.minPasswordLength`             | `16`                                     | Default is 8, for the one account that can read every phone number                            |

**The Admin second factor has a hole that is easy to miss.** Better Auth's `twoFactor` plugin can
only be enabled for **credential accounts**, and its flow is credentials → session removed →
temporary 2FA cookie → verify → session created. That is sound, and it guards exactly one path. Every
Account in this product can also sign in by **magic link**, which never touches that flow — so an
Admin arriving by magic link would hold a full Admin session having presented no second factor, and
`twoFactorEnabled` on the user would still read `true`. NFR14 now carries both halves of the fix:
refuse magic link for an Admin-granted account, **and** stamp the session with the method that
created it.

**`trustDevice` works against NFR13 and is turned off for the Admin.** Verifying with
`trustDevice: true` skips the second factor for `trustDeviceMaxAge` — **30 days** by default. NFR13
gives the Admin an 8-hour non-rolling session precisely because that account can take down a profile
and read every phone number in the system; a 30-day trusted device means 8-hour sessions
re-established all month on a password alone. See concern C44.

**`BETTER_AUTH_SECRET` is load-bearing beyond sessions.** It encrypts TOTP secrets and backup codes
at rest, so rotating it invalidates every Admin second factor — which makes rotation an operational
event with a recovery step, not a routine hygiene task. 32+ characters,
`openssl rand -base64 32`, and it belongs in the go-live runbook beside that warning. Better Auth
rejects placeholder secrets in production and warns below 120 bits of entropy.

**What Better Auth already does, so this spec does not rebuild it.** Origin and Fetch-Metadata CSRF
checks are on by default (`disableCSRFCheck` stays `false`). `trustedOrigins` validates
`callbackURL`, `redirectTo`, `errorCallbackURL` and `newUserCallbackURL` and returns 403 — which is
**not** the same as the API contract's `returnPath` rule, since that one guards _our_ post-sign-in
redirect; both are needed and they guard different hops. Account enumeration is already handled by
constant responses and dummy operations, matching the contract's `{ ok: true }`-always shape.
`databaseHooks` on `session.create`, `session.delete` and `user.update` are where DD11's
`session.revoked`, `account.deleted` and email-change events come from, rather than hand-wiring each
call site.

**Not applicable, stated rather than omitted:** `advanced.backgroundTasks.handler` exists for
serverless platforms that kill the process after a response. This runs as a long-lived Node process
on a Fly machine, so email sends complete without it.

#### The shared device, and the mechanism the intent's vocabulary did not have

[Intent Q5](./intent.md) settles the shape — the risk is the device, not the clock, so one checkbox at
sign-in puts the choice where the knowledge is — and says explicitly that Design verifies the
mechanism against the pinned version rather than the answer's vocabulary. Verified, and it is not what
the vocabulary suggests:

- `better-auth@1.7.1`'s **magic-link plugin exposes no `rememberMe` parameter**, on either
  `signIn.magicLink` or the verify endpoint. The documented `rememberMe` is an email-and-password
  affordance.
- The **`dont_remember` cookie is core**, not password-specific, so the capability exists below the
  plugin layer.
- Issue #4491, "`dontRememberMe` does not work when cookie cache is enabled", was **closed in September
  2025** and 1.7.1 postdates the fix — but that interaction is exactly why **NFR13 requires the session
  cookie cache off**. With a cookie cache on, every revocation in NFR13 and NFR15's "0 further
  requests" lag by its TTL.

So the choice travels as an `additionalFields` value on the **verification** record — never a
hand-added column, see Core entities — and the session it mints carries both halves: a non-persistent
cookie **and** an 8-hour expiry on the session **row**. The row half is the one that matters: a
cybercafé browser may not close for a week, and a non-persistent cookie alone is a promise the device
does not keep.

Also unstated in the intent and settled here: the magic link is **single-use** with a **15-minute
TTL**. A `GET` verify URL is fetched by corporate link scanners, WhatsApp previews and Outlook Safe
Links, and a single-use token consumed by a scanner locks a Worker out with no password to fall back
on — so the consumed-link surface offers an immediate resend rather than an error.

`secrets-in-url-paths` stays **`no`**: the token is a query parameter and `pathOf` strips query and
hash before the completion line. The Sentry egress is a different path, and it is DD11.

### DD6 — The photo path, which the draft got wrong at the framework boundary (NFR3, NFR6)

The draft made `uploadPhoto` a multipart Server Action. **Next 16.3.2's Server Action body limit
defaults to 1 MB** and `apps/web/next.config.ts` does not raise it, while a phone photo is 2–5 MB — so
every real upload would fail at the framework boundary, with no domain log line, on the one flow NFR4
already exempts. Raising `bodySizeLimit` would fix the symptom and leave the machine buffering
multipart bodies in process, which is the memory-saturation shape that kills a single Fly machine.

The path instead:

1. The client **downscales and re-encodes to ~1600 px and ≤ 2 MB in a canvas** before upload, which
   also serves NFR3's mobile-data premise and strips EXIF as a side effect.
2. `createPhotoUpload` returns a **presigned PUT** into a **quarantine** prefix. The key is
   **server-generated and opaque** — the client's filename never reaches it, or the upload is a
   path-traversal and cross-Worker-overwrite primitive — and the quarantine prefix is not publicly
   readable, which is what makes NFR6 a statement about reachability rather than about our routing.
3. `attachPhoto` records the key and sets `pending`.
4. **Approval re-encodes server-side** from quarantine into the public prefix. The trusted re-encode
   happens once, on ≤ 2 MB, so the public object is always server-produced: EXIF GPS cannot survive it,
   and the SVG/polyglot route to stored XSS is closed by decoding to a raster allowlist rather than
   trusting `Content-Type`. Byte and pixel ceilings bound the decompression bomb.
5. **Rejection deletes the object**, rather than merely flipping a state. Object storage is a second
   store, and NFR17's "deleted" covers rows, objects and logs.

EXIF GPS on an indexable Wall would publish the precise location of a displaced woman to anyone who
downloads the file. That is why step 4 is a re-encode and not a copy — and why it stays server-side
whatever the delivery layer below can do.

**Storage is Cloudflare R2; public variants are served through Cloudflare Images transformations.**
R2 is S3-compatible, so the presigned-PUT quarantine design above is unchanged: 10 GB of storage and
**zero egress** on the free tier, which at a re-encoded ~200–400 KB per photo is 25,000–50,000
photos — beyond any launch volume this product will see.

**The delivery half is the part the first draft of this deep dive was missing, and it is what NFR3
actually turns on.** One ~1600 px image served into a Wall _grid_ on a 4×-throttled mid-range Android
is how LCP ≤ 2.5 s gets missed; photos are the dominant bytes on that page. So the public prefix is
read through a transformation URL that names a width and negotiates the format
(`/cdn-cgi/image/width=…,format=auto/…`), wired into `next/image` as a **custom loader** so that
resizing happens at Cloudflare's edge and **never on the Fly machine** — the same CPU and memory
that DD7 already names as a saturating resource. The Images free plan allows **5,000 unique
transformations per month** against images stored outside Images, and a transformation is cached
after its first request, so the budget is consumed by _new_ (image × variant) pairs rather than by
traffic: at three variants per profile that is ~1,600 new profiles a month.

**Two preconditions this creates, both cheap and both real.** The domain must be a **Cloudflare
zone** with transformations **explicitly enabled** on it — free, conventional, and a go-live step
rather than a code change (NFR28). And Cloudflare joins the processor list in C15.

**A correction to what this deep dive first said.** It chose Tigris via `fly storage create` and
argued that, because Fly bills it, it was not the "fifth external account" the simplicity lens
objected to. That rebuttal conflated a billing relationship with a **processor**: Tigris Data is a
distinct company handling personal data either way, so it never shrank the Ley 1581 disclosure list —
it only removed a signup. Choosing storage to defeat an objection rather than to serve NFR3 is what
produced the missing delivery half above.

### DD7 — Ceilings, and the resource that is actually scarce (NFR26, NFR7)

The draft rate-limited exactly one surface. Under
[ADR-0008](../../adr/0008-open-enrolment-with-published-non-verification.md) nobody is verified and
`threat-model-scope` is anyone on the internet, so the abuse cases belong beside the stories — and the
**Worker-side ones first**, because the draft modelled only the bad Hirer, which the intent warned
against in those words:

- _I publish many profiles from throwaway addresses, so the browse order — which favours the fewest
  delivered Offers — puts mine on top._ Every fake profile has a zero count. Answered by
  `publishProfile` at ≤ 3/day per IP and per Account, one profile per Account by unique constraint, and
  a queue signal above a stated publish rate. NFR1 forbids human review on that path, so the control
  must be a rate and a signal.
- _I create an Account and read every gated profile, harvesting the self-descriptions of every
  displaced person on the site._ `PublicProfile` carries `slug`, so `/profiles` hands an enumerator the
  complete key set — nothing left to guess — and an Account costs one disposable address. Answered by
  NFR26's read ceiling, which turns a twenty-minute script into weeks, and into a signal.
- _I Report every Offer I receive, freezing legitimate Hirers with no human in the loop._ The freeze is
  a Worker-side weapon and the draft treated it only as a shield. Kept, with the counterweight: a
  Report rate per profile, and a queue signal when one profile reports many Hirers.
- _I send hundreds of Offers, so the 24-hour queue held by one unpaid person becomes unholdable._
  NFR7's depth and arrival-rate halves are the detector; `sendOffer` at ≤ 10/day is the bound.

**The scarcest resource in this design is one person's attention, and nothing in the draft protected
it.** That is what NFR26 is for.

The counter lives in Postgres because an in-memory map resets on every deploy and deploys are
continuous. It fails closed. A refusal **returns** rather than throws, or a crawler spends the month's
5,000-event Sentry allowance in a day and the second real incident of the month is invisible.

**Least privilege on the Admin**, who holds everything: the queue renders only the fields NFR11 permits
per item type; every action writes an `AdminAction`; the app credential holds DML and the migration
credential holds DDL, following the split `./migrate` already implies. **The first Admin grant is a
documented manual `UPDATE`** — undocumented, it becomes a self-grant endpoint the first time someone
needs it at 2 a.m.

**Headers, as a group:** `frame-ancestors 'none'` plus `X-Frame-Options: DENY` — `acceptOffer` is a
single click releasing a displaced person's name, phone and email to a stranger, the highest-value
clickjacking target in the system and the second reason acceptance is two-step — plus HSTS,
`X-Content-Type-Options`, and `Referrer-Policy: strict-origin-when-cross-origin`. The CSP itself is
concern C6.

**No user-supplied text is ever rendered as HTML or Markdown, anywhere.** React escapes by
construction — and since DD14 makes the email templates React Email components, that now holds on the
email path too, which is where the draft said it did not. The rule that replaces the exception is
narrower and mechanical: **no `dangerouslySetInnerHTML` and no `<Markdown>` over user text**, in the
app or in a template.

### DD8 — Retention, deletion, and habeas data (NFR16, NFR17)

**Two deletions, never one mechanism.** `taken_down` is moderation and is a soft state. The data
subject's own deletion is a **hard delete**, plus deletion of storage objects, plus in-place reduction
of every ContactExchange she appears in. `deleted` is therefore not a profile state at all — the draft
shipped both answers and would have left "does a deleted row still hold her phone number?" to be
discovered at Build. It does not, because the row is gone. Settles `soft-delete` as **no** for the
subject path.

Consequences taken deliberately: a hard delete frees her `citext UNIQUE` email so she can return, which
is right for this population. It also means a **Block does not survive the Hirer's deletion** — he
re-registers with the same address and the edge is gone. Stated rather than discovered, and a second
reason concern C3 matters.

**Retention is a graph, not a table.** The draft's per-table numbers left three dangling references —
most sharply, a Report outliving its Offer by twelve months, so at month 13 an Admin opens a Report and
the Offer it is about is unreadable, which removes the entire reason for the 24-month number. NFR17's
pinning rule and leaf-first purge order fix it, and every `ON DELETE` follows from that order.

**The subject-access export is the buildable half of NFR16.** A _consulta_ on a 10-business-day clock
means everything held about one person, across every table carrying a `personal` column. The Consent
row proves we were authorized; it does not produce the export. `@repo/domain/export` builds it from the
same whitelist discipline as the three projections, so a new `personal` column omitted from it fails
the same class of sentinel test as NFR10 — the only mechanism that keeps an export honest as the schema
grows.

**The business-day calendar is real work**, not an afternoon: Colombia has ~18 public holidays and
`America/Bogota` is UTC−5. It belongs in the runbook that carries the clock.

**RNBD, verified rather than recalled.** Registration in the Registro Nacional de Bases de Datos is
required of _sociedades_ and non-profits with total assets over 100,000 UVT, and of public legal
persons (Decreto 1074 de 2015, ch. 26). A **persona natural** as _responsable_ is not in that list, so
the repo owner personally — [intent Q4](./intent.md)'s answer — does **not** trigger RNBD registration.
That answers the question the intent asked. It does not answer the international-transmission question,
which is concern C15.

### DD9 — Transactions, races, and the one thing seam 2 structurally cannot test (NFR15, NFR11)

Three races, all ordinary interleavings rather than exotic ones:

1. **Freeze versus send.** `sendOffer` reads `active`, the Report transaction commits `frozen`,
   `sendOffer` inserts. NFR15's zero is violated by the _expected_ shape of the incident — a Report plus
   a burst of Offers from the same Hirer. Fixed by a row lock on the Hirer's Account taken inside
   `sendOffer`'s transaction, before the state is read.
2. **Double accept.** Two concurrent accepts write two exchanges and cross two sets of contact details.
   `UNIQUE (offer_id)` on ContactExchange turns that into a constraint violation.
3. **Accept racing report.** Same lock discipline; the Offer is re-read inside the transaction and
   anything not `delivered` is refused.

**Seam 2 cannot catch any of these, and that is worth naming precisely.** PGlite is single-connection
and in-process, so the specific loss is not the vague "concurrency" the draft filed under a future deep
dive — it is that **NFR15's bound is the one requirement this seam structurally cannot exercise**, and
it is the requirement whose failure hurts a Worker directly. The lock therefore goes in the design
rather than being left for a test to find, and its verification is a reasoned review plus seam 3.

A Worker may not send an Offer to her own profile — nothing in the draft refused it, and it inflates
`deliveredOfferCount`, which is NFR22's ordering input.

**Fail closed, per decision point**, because the draft stated behaviour for every `false` answer and
none of the error answers: `sendOffer` when the Block or state read throws → refuse. Wall render when
`photoState` cannot be read → render the initial. `acceptOffer` when the notification send fails → the
exchange **still commits** and the on-site copy is the durable channel. Rate limiter when its store is
unreachable → deny.

### DD10 — Deploy, migrations, rollback, and the cold start (NFR2, NFR25, NFR28)

**Region: Fly `iad` with PlanetScale `us-east-1`.** Same metro, ~1–3 ms app-to-database. The
operability lens proposed `mia` for ~40–60 ms of Worker-side RTT; **Fly has no Miami region** — its
only South American region is `gru` (São Paulo), and Colombian international traffic routes north
rather than south, so `gru` is worse for Pereira than `iad`, not better. Verified against Fly's region
list and PlanetScale's, and the repo owner confirmed N. Virginia. NFR2's second number exists because
that RTT is real and the server-side figure hides it.

**Deploys are bluegreen and health-gated.** On one machine a rolling deploy is a stop and a start, so
every deploy is a small outage several times a day — and worse, a broken build replaces a working
machine, because Fly's check degrades to TCP-accept, which succeeds while every route returns 500.
Hence `GET /api/health` doing a trivial DB round trip: without the round trip a bad `DATABASE_URL`
deploys clean. **A failing health check aborting the deploy is the only rollback that works when nobody
is watching** — NFR25's ≤ 5 minutes assumes a human who noticed, and `on-call-rotation` is nobody.

**Rollback, verified against the installed `flyctl` v0.4.87:**

```sh
fly releases --image --json          # read the previous release's image reference
fly deploy --image <ref> --strategy immediate
```

**Migrations run in a Fly `release_command`, not at server boot.** In a release command a failed
migration aborts the deploy with the old machine still serving; at boot it takes the site down. They
run on the **direct** connection (DD2). **Expand/contract is required**: a contracting migration may
not ship in the same deploy as the code change, because rolling the code back leaves a schema the old
build does not understand — which is exactly where NFR25's five minutes would stop being true.

**Rollback classes, because "≤ 5 minutes" is true for the easy one only:** code-only is a bluegreen
redeploy of the previous image, ~3 minutes. An additive migration is the same, and the column stays. A
**completed send is one-way** — an email is in an inbox and a phone number is on a stranger's screen —
and its forward fix must exist before it is needed: the kill switch on `@repo/notifications`, a
per-send `info` line carrying `exchange_id` and recipient **id** (never address) so the affected set is
enumerable afterwards, and a written notification procedure. Without that line the blast radius is not
even knowable. `fly secrets set` restarts the machine, so a config change is redeploy-class too; there
is no feature-flag mechanism in this repo, so "behind a flag" is unavailable rather than unchosen.

**Four scheduled jobs and one scheduler**: the retention purge, the daily `rotationKey` rewrite, Offer
expiry, and the seven-day check-ins. They run as one heartbeat job so that **one** cron monitor covers
all four — the free tier includes one, and a purge that silently stops running is a growing Ley 1581
exposure with no symptom. Transaction pooling removes session advisory locks, so the usual
single-runner guard is unavailable; on one machine that is fine, and on two it is not.

**`branch-protection` on a one-person repository** is required **status checks**, not required reviews:
required reviews lock the only operator out or normalize admin bypass, and status checks give NFR25
everything it asks for. See concern C16.

### DD11 — The two egresses, and a credential currently reaching one of them (NFR18, NFR19, NFR27, NFR7)

**NFR19 is a fix to shipped code, verified rather than suspected.** `CARRIER_PATHS` in
`packages/errors/src/redaction.ts:108` lists nine carriers and `["request","url"]` is not among them;
the module's own docstring says so and defers the case — _"a secret in a URL rather than under a key…
Whatever consumes transactions needs its own answer for query strings."_ This effort is that consumer,
and the secret is the magic-link token, which is the **only** key to a Worker's account. With
`tracesSampleRate: 0.1` and `beforeSendTransaction: scrubOrDrop` in `apps/web/sentry.server.config.ts`,
roughly one in ten verify requests ships its full URL to Sentry, and every error on that route ships it
at 100%. The fix — strip query strings from `request.url` in the scrubber — is one carrier entry plus a
test, and it belongs to `@repo/errors` rather than to this app.

**NFR18 is restated over every egress**, not only log lines, for the same reason: the redaction list
matches key **names** and contains `password`, `token`, `cookie`, `ssn` — and no `phone`, `email`,
`about`, or `workDescription`. An `AppError` thrown out of `sendOffer` with
`context: { profileId, phone }` reaches `beforeSend` untouched today. The sentinel test drives the
Sentry hooks and the logger from one fixture.

**The drain is not deferrable, and the intent's "deploy-time act" framing understates it.** With logs
undrained and deploys continuous, real retention is not 30 days — it is **until the next deploy**,
minutes. The cheapest route adds no vendor: `enableLogs: true` plus `Sentry.pinoIntegration()`, per
[the go-live runbook](../../runbooks/observability-go-live.md) §9b, whose free tier is ~5 GB/month, far
above anything this product will produce. It lands in the same PR as the first deploy.

**The event list, because the draft said what must never be logged and never said what is logged.**
Every safety-relevant transition emits one `info` line with a stable `event` field and **ids and enum
values only**: `offer.delivered`, `offer.rejected_by_admin`, `photo.approved`, `photo.rejected`,
`report.created` (with the freeze), `block.created`, `session.revoked`, `account.deleted`,
`exchange.created`, `notification.sent`, `magic_link.requested`, `magic_link.consumed`. The last two
are NFR27's measurement. Ids-only satisfies NFR18 by construction rather than by discipline.

**The control bands, complete.** A band with a metric and a range and no "who learns" is two-thirds of a
band, which [intent Q3](./intent.md) said this effort should not ship — and `alert-destination` is still
`UNSET`, which is concern C10. The proposal carried there: human-queue bands (NFR7) as a daily digest
at 08:00 America/Bogotá through the notification seam that already exists; machine bands (uptime, error
spike) as a `needs-triage` issue from CI, per
[ADR-0001](../../adr/0001-findings-enter-through-triage.md). Neither needs new infrastructure. Sentry's
free tier includes **one uptime monitor** and **one cron monitor**; both are claimed above, and the
runbook's §3 figures are pinned at 2026-08-23 and worth re-reading before go-live.

### DD12 — The Skill vocabulary, and a correction to the intent's candidates

[Intent Q2](./intent.md) named **CIUO-08 A.C.** (DANE's adaptation of ISCO-08) and the **SENA**
occupational catalogue (CNO) as the two sources to check first. Checked — and they were merged by
government mandate. **CUOC, the Clasificación Única de Ocupaciones para Colombia**, unifies SENA's CNO
and DANE's CIUO-08 A.C.; it was established by **Decreto 654 de 2021** and **Resolución 771 de 2021**,
is maintained by DANE, preserves CIUO-08 A.C.'s structure to the fourth digit and adds a fifth
"Occupation" digit, and its latest published edition is **CUOC 2025**. So the answer is not a choice
between the intent's two candidates; it is the single classification they became.

`Skill.cuocCode` records the provenance of each seeded entry.

**The seed is a source, not the vocabulary**, exactly as the intent says. CUOC is written in the
register of a labour statistician, and the person reading the publishing form is a cook deciding
whether a phrase describes her. Translating it into the words a Worker would use about herself, at the
granularity a Hirer would search for, is craft — and craft that **has no authority until `voice-guide`
is set** (concern C2). The seeding ticket therefore blocks on that session, and this is the one place in
the effort where a `Must` story has a non-code dependency.

The seed ships as an **idempotent migration**, so seam 2 and production hold the same list.

### DD13 — Migration integrity, and why it is a test rather than a convention (NFR30)

This effort introduces the repository's first database, and with it the first artifact that is
**append-only by nature and editable by accident**. Three failure modes, in increasing order of how
quietly they happen:

**A rewritten journal.** `drizzle/meta/_journal.json` is the ordered record of what has been applied.
Reorder or drop an entry — trivially done by resolving a merge conflict the wrong way, since two
branches adding migrations always conflict there — and production and the test seam apply different
SQL in a different order. The check: diff the journal against the merge base and refuse anything but
an append. No committed `tag`, `when`, or `idx` may change.

**An edited migration.** This is the one that matters most here, and it is silent. A migration whose
tag is already on the default branch has run against production; editing its `.sql` changes nothing
there, because Drizzle will not re-run it. But **PGlite replays every migration from scratch on every
test run**, so seam 2 immediately starts testing a schema production does not have — and it goes
green. The entire argument for seam 2 being "a real seam rather than a mock in a database costume"
rests on those files being identical, so this check is what keeps Testing Decisions honest. Content
is hashed at the tag's first appearance and compared thereafter.

**A destructive statement smuggled into an ordinary migration.** `DROP TABLE`, `DROP COLUMN`,
`DROP CONSTRAINT`, `ALTER COLUMN … TYPE`, `ALTER COLUMN … SET NOT NULL`, any `RENAME`. Mixing one
with additive statements means the additive half cannot be rolled back without also reversing the
drop — and the drop is the half that has already destroyed the data. So a migration containing any of
them contains **nothing else**, and says so in its name. That is not a ban: it is what makes
NFR25's "≤ 5 minutes" true for the additive case, which is the overwhelming majority.

**And the contract half is a separate deploy.** DD10 requires expand/contract; the check enforces the
part a human forgets under time pressure — a marked contract migration may not share a pull request
with a change to `@repo/domain`'s query modules. Ship the code that stops using the column, deploy,
then drop it.

**Where this lives, in this repository's idiom.** It is repo logic, so it is a **test suite, not a
script somebody remembers to run** — the same argument `CLAUDE.md` already makes for the stage hooks.
It joins `pnpm test:gates`, which means CI runs it on every PR under NFR25, and `gate-test.sh` gains
its cases. `.claude/hooks/build-guard.sh` gains a matching rule refusing a `Write` or `Edit` to a
migration file already in the journal, which is exactly the shape of its existing rule H for vendored
skills, committed advisories and `pnpm-lock.yaml`. Both halves are needed and they are not redundant:
the hook stops the agent mid-session, and the gate stops the human's PR.

**These gates refuse false positives loudly, so each rule ships with its prose case.** A commit
message naming `DROP COLUMN`, an ADR quoting one, and this very deep dive are all text that must not
trip the check — `gate-lib.sh`'s existing heredoc stripping and anchoring are the precedent, and four
false refusals were found the last time these were written.

### DD14 — The notification seam, React Email, and the domain nobody has warmed (NFR27, NFR28, NFR20)

**Templates are React Email components, and that changes a security argument rather than only a
rendering one.** DD7 called the email templates "the one rendering path where React's escaping does
not apply", and the security advisory asked for explicit escaping at that seam (concern C26). With
React Email the templates **are** React components rendered through `render()`, so interpolating an
Offer body or a headline escapes by construction, exactly as it does in the app. The exception
dissolves; what remains is narrower and easier to hold: **no `dangerouslySetInnerHTML`, and no
`<Markdown>` component over user-supplied text**, ever. That is a mechanism rather than a discipline,
which is the difference C26 was actually asking for.

**Sends are idempotent, because the one irreversible act in this system is a send.** Every call
carries an idempotency key in Resend's `<event-type>/<entity-id>` form — `contact-exchange/<id>`,
`offer-delivered/<offer-id>`, `check-in/<exchange-id>` — so a retry after a timeout returns the
original response instead of delivering a stranger's phone number twice. Keys last 24 hours; the same
key with a **different** payload is a 409, which is the correct failure for a bug that changed the
body under a retry. DD9 already commits the exchange transaction before enqueuing the send; the
idempotency key is what makes that enqueue safely retryable.

**The SDK does not throw.** `resend.emails.send()` returns `{ data, error }`, so a `try`/`catch`
around it catches nothing and every send silently "succeeds". This is the vendor's own most-cited
mistake, and it is exactly the shape that would make DD9's "the send failed, the exchange still
commits" fail _silently_ instead of loudly. The seam checks `error` explicitly and emits DD11's
`notification.sent` line off the returned id.

**The webhook contract, concretely.** Verification is `resend.webhooks.verify()` over the `svix-id`,
`svix-timestamp` and `svix-signature` headers — svix carries the replay window the API contract asks
for. The body **must** be read with `req.text()`, not `req.json()`: parsing first destroys the exact
bytes the signature covers. Beyond `email.bounced`, two events matter here and neither is in the
draft: **`email.complained`**, which is a spam report and is far more damaging to a single-domain
sender than a bounce, and **`email.suppressed`**, which fires when Resend refuses to send to an
address it has already suppressed.

**Suppression is a second source of truth, and story 21 has to know that.** Resend suppresses
hard-bounced and complained addresses automatically. So a Worker whose address bounced is suppressed
**at the vendor**, not only flagged in our database — and changing her address in our `account` row
does not un-suppress the old one, nor does it help if the new address is also suppressed. Story 21's
recovery path therefore has a second leg the draft did not have: the Admin queue item names the
suppression, and un-suppressing is a dashboard act that belongs in the runbook.

**The launch constraint nobody has costed: a new sending domain is rate-limited by reputation, not by
plan.** Warm-up guidance is **50–100 sends/day in week 1**, 200–500 in week 2, 1,000–2,000 in week 3.
The magic link is the **only** way into an account, and NFR28's announcement is a deliberate traffic
spike aimed at exactly one domain that has never sent anything. An announcement that produces 400
sign-ups on day one either fails to deliver most of them or burns the domain's reputation on the day
the product's whole thesis depends on it — and the intent's scarce resource is that attention window.
This is concern C45, and it is the one finding here that can lose the launch rather than degrade it.

**Sender identity is a product decision, not a config line.** The `from` address is a real,
monitored address on a sending **subdomain**, and it is **not** `noreply@`. A displaced woman who
receives an Offer notification and replies to it must reach a person, not a bounce — and with one
operator (C43) a monitored `Reply-To` is a real commitment, which is why it is named here rather than
assumed.

**Two things this adds to the workspace.** `@repo/notifications` now contains JSX, so it takes
`react` and `@react-email/components` as dependencies and a tsconfig extending
`@repo/typescript-config/react-library.json`. And it gains a preview server — `email dev --dir
src/templates` — which is how a template is reviewed without sending, and which belongs in the
package's scripts rather than being reinvented per ticket.

**Email cannot use this product's design tokens, and that is worth stating before someone tries.**
`DESIGN.md`'s palette is `oklch()` in CSS custom properties; email clients support neither. So the
templates carry a **hex** palette derived from those tokens, with `pixelBasedPreset` because `rem` is
unsupported, no flexbox or grid, no media queries, and no `dark:` variants. Drift between the two
palettes is a real maintenance cost and the honest answer is that the email palette is a copy —
reviewed when `DESIGN.md` changes, not generated from it.

**Accessibility (NFR20) reaches the emails too, and one default is wrong for this product.** React
Email's `<Html>` defaults to `lang="en"`; every template here sets **`lang="es"`**. Each template also
ships a plain-text alternative — `render(..., { plainText: true })`, which the Resend SDK produces
automatically from the `react` prop — a single `<Heading as="h1">`, descriptive link text rather than
"click here", explicit `alt` on any meaningful image, and 4.5:1 contrast. Bodies stay under **102 KB**
or Gmail clips them, which on the Contact Exchange email would clip the contact details.

**Testing uses the vendor's own addresses, never invented ones.** `delivered@resend.dev`,
`bounced@resend.dev` and `complained@resend.dev` simulate each outcome; sending to a made-up address
at a real provider bounces and damages the reputation NFR27 measures. Rendering is testable without
sending at all: `render()` a template in Node and assert on the string, which is seam 1 work and is
where the "no `dangerouslySetInnerHTML`" rule above becomes a test.

### DD15 — Proposed ADRs

Two decisions here are durable and reach beyond this effort, so they belong in `docs/adr/` rather than
in a folder nobody reopens. Both are written with `status: proposed`; **accepting one is the human's
act**, the same as approving this spec.

- **[ADR-0010 — The domain package is the only door to the database.](../../adr/0010-the-domain-package-is-the-only-door-to-the-database.md)**
  A Server Action authorizes, parses, and calls a domain module; the schema and the connection are
  unexported. Binds every future surface, and is the reason the business rules in this product are
  testable at all.
- **[ADR-0011 — No shared cache until a measurement requires one.](../../adr/0011-no-shared-cache-until-a-measurement-requires-one.md)**
  No `use cache` on any path, and the terms on which it may return: a measurement showing the number is
  missed, plus the whitelist test that makes a cached function's output provable.

**No ADR is contradicted by this spec.** ADR-0003 is extended rather than reopened — the three
projections are its first real multi-shape test, and DD8's subject-access export applies the same
whitelist discipline to a fourth egress. ADR-0006's `context.path` exposure is untouched: NFR19 is a
different egress, and a gap effort 0001 named rather than a decision it made.

## UX design

**Router case 3 — new surfaces and flows**, twelve of them. The conclusion is stated rather than left
silent: every surface below is new, and none inherits an existing brief.

**The craft is delegated to Build, by decision, and it is delegated as tickets rather than as
goodwill.** `/to-tickets` cuts one ticket per user story; every story carrying a surface gets a ticket
whose first two acts are named on the ticket itself:

1. **`/impeccable shape <target>`** — the discovery interview for that one surface, producing a brief
   at `.impeccable/briefs/<slug>.md`. Target paths are the ones this spec commits to below, so the
   brief and the spec name the same file before it exists.
2. **`/prototype` UI** — variants on the real route, against real data and real density, switchable by
   `?variant=`. Note the ordering constraint and design the ticket around it: `/prototype` UI needs a
   page to sit inside, so the sequence within a ticket is _shape → tracer-bullet route with real data →
   variants → lock one → finish_, never prototype-before-route.

Running twelve `shape` interviews inside `/to-spec` would spend the scarce resource this whole effort
is racing — attention — before a single ticket exists. Running them one per ticket spends it against
work that is about to be done.

**What Design still owes, and does not defer:** the target paths, the full state set per surface, the
Suspense boundaries and what their fallbacks show, the keyboard path and the announcement, and **what
each string must say** — never the words themselves. That exclusion is [intent Q6](./intent.md):
`voice-guide` is `UNSET`, microcopy has no authority until it is set, and inventing a voice for a
product where the difference between _trabajadora_ and _damnificada_ **is** the product would be worse
than naming the gap. See concern C2.

### The surfaces, their targets, and their state sets

`empty` / `loading` / `partial` / `error` / `permission denied` / `success`, all six, per surface.
`partial` is the one this design actually hits, because the Wall streams and a photo resolves on its
own schedule.

| Surface              | Target                        | `empty`                                                                                                        | `loading`                                                                        | `partial`                                                                                                                        | `error`                                                                                                                                                                                                                                 | `permission denied`                                                                                                                                      | `success`                                                                                                                                                                                   |
| -------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Wall**             | `app/page.tsx`                | Before the first profile exists: the proposition and a route into `/publish`. Never a blank region             | Card skeletons at the card's exact height, so the notices above them do not move | Cards rendered, a photo slot still resolving → the initial, which is also the approved-photo-absent state. One shape, two causes | The Wall failed to load: what failed, that retrying helps, and the notices still render                                                                                                                                                 | n/a — public                                                                                                                                             | n/a                                                                                                                                                                                         |
| **Browse**           | `app/profiles/page.tsx`       | No match for this Skill/city: say which filter is narrowing, offer to clear it. Distinct from the Wall's empty | Skeletons holding the grid                                                       | Some cards, more streaming                                                                                                       | Search failed; the unfiltered list is still reachable                                                                                                                                                                                   | n/a — public                                                                                                                                             | n/a                                                                                                                                                                                         |
| **Full profile**     | `app/profile/[slug]/page.tsx` | n/a                                                                                                            | Skeleton at the profile's height                                                 | Identity rendered, work history streaming                                                                                        | Profile failed to load                                                                                                                                                                                                                  | **Signed out** → the Account gate and why it exists. **Blocked** → indistinguishable from "not found", because the alternative tells him she Blocked him | n/a                                                                                                                                                                                         |
| **Sign in**          | `app/sign-in/page.tsx`        | n/a                                                                                                            | Button busy, form still readable                                                 | n/a                                                                                                                              | Send failed, retry available, and the address is still in the field                                                                                                                                                                     | n/a                                                                                                                                                      | "Check your email" — said **whether or not the address exists**, because the honest reply and the enumeration-safe reply are the same one. A consumed link offers an immediate resend (DD5) |
| **Publish**          | `app/publish/page.tsx`        | Skill picker before a query                                                                                    | Per-field, never a whole-form spinner                                            | Fields accepted, photo still uploading — the profile is already live                                                             | Per-field errors **and** a focused form-level summary; the contact-detail rejection names the fragment and keeps everything typed (NFR12); a photo rejected at the size ceiling says so in her terms rather than failing opaquely (DD6) | Already has a profile → route to `/my-profile`                                                                                                           | Published, with the live profile linked and the pending photo explained without a badge                                                                                                     |
| **Own profile**      | `app/my-profile/page.tsx`     | n/a                                                                                                            | Skeleton                                                                         | Photo pending → **her own photo shown**, dignified, described as under review, not flagged                                       | Load failed                                                                                                                                                                                                                             | Not the owner → 404                                                                                                                                      | Edit saved                                                                                                                                                                                  |
| **Received Offers**  | `app/offers/page.tsx`         | No Offers yet: say what makes one arrive, and that a person reads each first                                   | Row skeletons                                                                    | Some rows, terms streaming                                                                                                       | Load failed                                                                                                                                                                                                                             | Not the owner → 404                                                                                                                                      | n/a                                                                                                                                                                                         |
| **One Offer**        | `app/offers/[id]/page.tsx`    | n/a                                                                                                            | Skeleton at the terms' height                                                    | Terms rendered, Hirer identity streaming                                                                                         | Load failed                                                                                                                                                                                                                             | Not the addressee → 404                                                                                                                                  | Accepted → the Contact Exchange below. Declined → confirmed, and it stays confirmed rather than vanishing                                                                                   |
| **Contact Exchange** | same route, post-accept       | n/a                                                                                                            | n/a                                                                              | Details on screen, the email still sending — and the screen says the email is a copy, not the original                           | Email failed to send: the details are **still on screen**, which is why they are on screen                                                                                                                                              | Not a party to it → 404                                                                                                                                  | Both sides' details, once, plus the standing safety guidance and the no-money notice                                                                                                        |
| **Sent Offers**      | `app/sent-offers/page.tsx`    | None sent: route into `/profiles`                                                                              | Row skeletons                                                                    | Rows, states streaming                                                                                                           | Load failed                                                                                                                                                                                                                             | Not the sender → 404                                                                                                                                     | n/a                                                                                                                                                                                         |
| **Account**          | `app/account/page.tsx`        | n/a                                                                                                            | Per-action                                                                       | n/a                                                                                                                              | Action failed                                                                                                                                                                                                                           | Signed out → `/sign-in`                                                                                                                                  | Signed out everywhere / email change **pending verification** (DD5) / **deletion**, whose confirmation carries NFR11's second number: it reaches nothing a Hirer already read               |
| **Admin queue**      | `app/admin/page.tsx`          | Queue empty — a real and good state, and it says the oldest-item age is zero                                   | Skeletons                                                                        | Some sources loaded, others streaming; **the age of the oldest item renders first** (story 7)                                    | A source failed: say **which**, because a silently missing source is an unreviewed Offer                                                                                                                                                | Not an Admin session → 403, not a redirect (NFR14)                                                                                                       | Per-action, and the item leaves the queue                                                                                                                                                   |

### Suspense boundaries and their fallbacks

Cache Components is on, so uncached data outside a `<Suspense>` boundary fails the build. Each boundary
is therefore a designed state, not a spinner chosen at the end of a ticket.

| Boundary                | Fallback                                                                               | Holds layout?                                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Wall card grid          | `skeleton.tsx` at the card's measured height, in the grid's own columns                | **Yes** — the load-bearing one: the non-verification notice sits above the grid, and a shifting grid moves it |
| Browse results          | Skeleton rows in the result container; filters render immediately and stay interactive | **Yes**                                                                                                       |
| Profile work history    | Skeleton lines at the entry height                                                     | **Yes**                                                                                                       |
| Offer list rows         | Skeleton rows                                                                          | **Yes**                                                                                                       |
| Admin queue, per source | Skeleton rows per source, each labelled with its source                                | **Yes**                                                                                                       |

A fallback of a different shape than the content it replaces is a layout shift the spec would have
specified. `packages/design-system/src/components/skeleton.tsx` ships for exactly this; a spinner in
the middle of content is the wrong answer on every row above.

### Keyboard and announcement

- **Publishing form** — tab order follows visual order; the Skill picker is operable from the keyboard
  alone, including "mi capacidad no está en la lista"; on submit failure focus moves to the
  **form-level summary**, not the first bad field, so a screen-reader user hears how many things are
  wrong before being dropped into one.
- **Accepting an Offer** — the two-step confirmation is keyboard-reachable and names what crosses;
  focus moves to the Contact Exchange heading once it resolves, and the details are announced through a
  polite live region.
- **Wall and Browse** — streamed cards are announced as a count ("12 perfiles"), once, when the
  boundary resolves. Not per card.
- **Admin actions** — focus returns to the queue position the item left, not the top, because the queue
  is worked top to bottom by one person.
- **Report and Block** — both confirm in a live region and both are reachable without a pointer.

### Components

From the shadcn registry on Base UI, already present: `button`, `card`, `input`, `label`, `field`,
`select`, `checkbox`, `badge`, `avatar`, `dialog`, `separator`, `skeleton`, `tabs`, `sonner`.

**Not in the registry, so building them is scope a ticket carries** — and they live in `apps/web`, not
in the design system, because they are product: the Skill picker (multi-select with an inline "not
listed" request), the photo upload with its client-side downscale and pending state, the Offer terms
card, `PerfilCard`, and the two standing notices.

`DESIGN.md` is the visual authority. Every surface names semantic tokens — `bg-background`,
`text-muted-foreground`, `border-border` — and **no** colour value and **no** `dark:` override:
`theme-parity` is light only. A token this design needs and `globals.css` lacks is a change to the
design system and the Design lead's call, not a line in an implementation ticket.

## Testing Decisions

**Three seams, and one already exists.** The rule is the highest seam available and as few as
possible; this is the smallest set that puts an automated test on every bug class this design can
produce — plus one honest gap.

### Seam 1 — `@repo/domain`, pure (Vitest, Node environment)

Prior art: `@repo/errors`. A `vitest.config.mts` carrying `resolve.tsconfigPaths`, `test.globals` and
an `include` glob, and nothing else. Tests sit beside their source as `src/**/*.test.ts`, so
`check-types` covers them, and the workspace sets `"types": ["vitest/globals"]`.
**Vitest globals are on — a test importing `describe`/`it`/`expect` from `"vitest"` is the mistake to
correct on sight.**

Covers the functions where a leak is a return value:

- `./projections` — the three profile shapes. **NFR10 is a test here**: one fixture carrying five
  distinct sentinels, three assertions counting occurrences. This is what makes
  [ADR-0003](../../adr/0003-no-tojson-on-cross-boundary-types.md) enforceable rather than
  aspirational. `./export` is tested the same way, because an export that silently omits a `personal`
  column is the same bug wearing a compliance hat.
- `./policy` — the Offer state machine (every transition **and** every refused transition), the
  contact-detail rejector (NFR12, both halves: it names the fragment, preserves the input, and does
  **not** reject ordinary Spanish), the search normalizer (NFR21, over accented/unaccented pairs), and
  the list ordering (NFR22, over a generated population).

**Tested as external behaviour.** A projection test asserts on the object that crosses the boundary,
never on how it was built; a state-machine test asserts which transitions are refused, never the shape
of the guard clause.

### Seam 2 — `@repo/domain`, against PGlite (Vitest, Node environment)

The modules that own transactions cannot be pure, and they hold the consequential mistakes: the
exchange snapshot, the leaf-first purge, the deletion that reduces an exchange to counts, the ordering
query's index behaviour, the five queue branches.

**The database is PGlite, and the same committed migrations run against it.** Two verified facts make
this a real seam rather than a mock in a database costume:

- **PGlite 0.5.7 is PostgreSQL 18.3; PlanetScale for Postgres runs 18.4.** Same major version, so
  `uuidv7()` and the planner's behaviour are the ones production has. Read out of the shipped
  `pglite.wasm`, not recalled.
- **Every extension this design needs is bundled in PGlite and supported on PlanetScale** — `citext`,
  `pg_trgm`. (`unaccent` is deliberately unused: DD4 normalizes in the application instead, which
  removes a divergence risk rather than testing around one.)

**Isolation, because a database shared between tests is what makes an integration suite
untrustworthy:**

1. Once per Vitest worker: create a PGlite instance, run the **committed migrations** — the same files
   that run against PlanetScale, never a `CREATE TABLE` written for tests — then `dumpDataDir()` and
   hold the blob in memory. The Skill seed is itself a migration, so it is included by construction.
2. Per test file: `PGlite.create({ loadDataDir: snapshot })`, restoring the post-migration state in
   milliseconds rather than replaying migrations. Isolation costs nothing and no test sees another's
   rows.
3. No test truncates and no test orders itself relative to another. A test needing a row creates it
   through the domain module that owns it, which also stops fixtures drifting from the schema.

**What this seam cannot prove, stated precisely rather than vaguely.** PGlite is single-connection and
in-process, so **NFR15's race-freedom is the one requirement it structurally cannot exercise** — and it
is the requirement whose failure hurts a Worker directly. That is why DD9 puts the row lock in the
design rather than leaving a test to find it, and why its verification is a reasoned review plus seam 3. Connection pooling and PlanetScale's network behaviour are likewise out of reach.

### Seam 3 — `apps/web`, running (`next-dev-loop`)

Vitest **cannot test `async` Server Components**, so every route has its runtime leg here against a
running `next dev`. Not a fallback — the only verification available for a Server Component, and
`docs/policy/build.md`'s definition of done requires it for any change touching `apps/web`.

This is also where **every Server Action's authorization is verified, by requesting the endpoint
unauthenticated**. Server Actions are deliberately **not** unit-tested by importing them: an imported
action is not the compiled POST endpoint an attacker reaches, so a green test there asserts
authorization on a code path nobody attacks. Their logic lives at seams 1 and 2 — which is the whole
reason a Server Action calls a domain module instead of the database.

`apps/web` gains its **first Vitest config** — happy-dom, copied from
`packages/design-system/vitest.config.mts` — covering exactly two things:

- The Client Components this effort adds: the shared-device checkbox, the Skill picker, the photo
  upload's downscale path, and the form's error states.
- **NFR8's `noindex`, as a table-driven test over the route list.** The gated prefixes are one exported
  array and the test asserts each is covered by the route group applying `noindex`. A per-page
  `metadata` export tested per page passes while the page someone forgot fails silently — which is the
  failure [ADR-0009](../../adr/0009-a-workers-full-identity-is-gated-and-never-indexed.md) calls
  "load-bearing and easy to lose".

### `@repo/notifications`

Node-environment Vitest, same shape as `@repo/errors`. Templates are React Email components, so they
are tested **without sending**: `render()` a template and assert on the returned string — that every
prop it was given appears, that no `dangerouslySetInnerHTML` or `<Markdown>` sits on a user-text path
(DD14), that `lang="es"` is set, and that the body stays under Gmail's 102 KB clip.

Where a test does send, it sends to the vendor's own simulators — **`delivered@resend.dev`**,
**`bounced@resend.dev`**, **`complained@resend.dev`** — never to an invented address at a real
provider, which bounces and damages the very reputation NFR27 measures. `bounced@resend.dev` is what
makes story 21's recovery path testable end to end.

### `packages/errors` and `packages/design-system`

Both existing seams, unchanged in shape. `@repo/errors` gains NFR18/NFR19's sentinel test, which drives
the logger **and** the `beforeSend` / `beforeSendTransaction` hooks from one fixture, so the three
egresses cannot disagree. `packages/design-system` keeps `src/components/dialog.test.tsx` as the guard
on the DOM environment itself.

## Flagged concerns

**Forty-five concerns, in four blocks.** C1–C20 were raised at authoring time: six are contradictions
between binding documents or between two advisories, and the rest are policy keys this spec needs and
may not set. C21–C42 were appended by `/spec-review` — eighteen advisory recommendations the synthesis
dropped or diluted, plus four from the mechanical shape checks and the intent's own obligations on
Design. C43–C44 came from reviewing the auth design against `better-auth@1.7.1`'s own guidance, and C45 from reviewing the email design against Resend's and React Email's.

Every proposal carries the value its author would defend, because a concern with a number gets
answered and a concern asking "what should this be?" gets deferred.

- [ ] **C1** — **Where the Worker's full name crosses.** [ADR-0009](../../adr/0009-a-workers-full-identity-is-gated-and-never-indexed.md)
      says "full name is released at Contact Exchange… the only moment identity crosses", and the
      intent's **Constraints** restates it that way — but the intent's **Proposed outcome** says her
      full name is "behind an Account", which is the gated shape. This spec designs to the **stricter**
      reading: `fullName` is in `ExchangedContact` only, and is deliberately absent from
      `CapabilityProfile`. That leaves a second question the ADR does not answer: it is then collected
      either at publish (a database of displaced people's full names from day one) or at acceptance (a
      new input on the highest-stakes action in the product).
      **Risk if wrong:** either a permanent over-collection, or an identity crossing a Hirer sees
      before she has chosen. **Owner:** Tech lead (arbitrating ADR-0009 against the intent's prose),
      with Security owner.
- [ ] **C2** — **`voice-guide` is `UNSET`, and one `Must` story blocks on it.** [Intent Q6](./intent.md)
      settles that a `brand-voice` session sets it and that it stays `UNSET` through `/to-spec`. This
      spec names what every string must **say** and fixes no words. DD12's Skill-vocabulary translation
      is the exception that cannot wait: turning CUOC's statistician register into the words a Worker
      uses about herself **is** voice work.
      **Risk if wrong:** either the vocabulary ships in the register of a labour statistic, or story 3
      stalls. **Owner:** Design lead. **Unblocks by setting:** `docs/policy/ux.md` → `voice-guide`.
- [ ] **C3** — **A Block cannot mean what `CONTEXT.md` says it means.** The glossary binds Block as
      "her CapabilityProfile becomes invisible to him". The Wall and `/profiles` are public, indexable
      and readable signed out, so a Blocked Hirer sees her card in a private window. This spec honours
      "he cannot open her gated profile" and "he can send her nothing", states the gap in product copy
      (story 11), and proposes **amending the `CONTEXT.md` entry** rather than leaving the vocabulary
      describing a protection that does not exist. DD8 adds a second edge: a Block does not survive the
      Hirer's account deletion, because deletion frees his email.
      **Risk if wrong:** a Worker relies on invisibility she does not have — the exact failure story 11
      exists to prevent. **Owner:** Tech lead (domain model), with Design lead (copy).
- [ ] **C4** — **The exchange is asymmetric in identity, against the vulnerable side.**
      `ExchangedContact` claims the Hirer's name, phone and email, and **no story, entity or route ever
      collects them**. Magic link proves only that he controls an inbox. So she hands over a
      verified-reachable phone number and receives three self-asserted strings typed at exchange time.
      It also caps what a Report can achieve: with no durable Hirer identity, a banned Hirer
      re-registers in thirty seconds. Proposal: collect his details at first Offer send, alongside the
      Consent row this spec already adds there, and state plainly on both sides that they are
      self-asserted.
      **Risk if wrong:** the platform's terminal event is a one-way disclosure by the person with the
      least power in it. **Owner:** Tech lead, with Security owner.
- [ ] **C5** — **Where six new credentials live and who rotates each** (PlanetScale app + direct,
      Resend, the webhook signing secret, R2, Better Auth's secret). NFR24 keeps them out of every
      turbo task; it does not say where they live. Proposal: `fly secrets` as the only store, with the
      go-live runbook naming each.
      **Risk if wrong:** a production database URL for a table of displaced people's phone numbers
      lands in a `.env` file, which is a Turborepo `build` input and one `git add` from an incident.
      **Owner:** Security owner. **Unblocks by setting:** `docs/policy/security.md` → `secret-store`.
- [ ] **C6** — **The CSP this app ships, or the recorded decision not to.** DD7 settles the rest of the
      header set; the CSP itself is not this spec's to pick. Proposal: `default-src 'self'`,
      `frame-ancestors 'none'`, `img-src 'self' <cloudflare-image-delivery-host> data:`, and the Sentry hosts the go-live
      runbook already enumerates.
      **Risk if wrong:** no `frame-ancestors` leaves `acceptOffer` clickjackable — one click releasing
      a displaced person's name, phone and email. **Owner:** Security owner. **Unblocks by setting:**
      `docs/policy/security.md` → `csp-policy`.
- [ ] **C7** — **What blocks a release: a CVE threshold, a licence allowlist, or neither.** Proposal:
      CI fails on `high` or above in a direct dependency.
      **Risk if wrong:** an advisory against the authentication library ships to production with
      nobody watching and nothing blocking. **Owner:** Security owner. **Unblocks by setting:**
      `docs/policy/security.md` → `dependency-policy`.
- [ ] **C8** — **Whether an external party ever looks at this.** "Never" is a legitimate answer for an
      unfunded one-person platform and is worth recording as a decision rather than a silence.
      **Risk if wrong:** the only review this system receives is its own. **Owner:** Security owner.
      **Unblocks by setting:** `docs/policy/security.md` → `pentest-cadence`.
- [ ] **C9** — **The availability target for the public reads.** Proposal: **99.5% monthly** on `/` and
      `/profiles`, measured by the external uptime monitor rather than server-side. Note the
      arithmetic: without DD10's bluegreen, ~30 s of boot per deploy at ~10 deploys/day spends ~0.35%
      on deploys alone — an implicit 99.65% ceiling. With bluegreen the ceiling goes away, which is why
      the two decisions are one.
      **Risk if wrong:** the site is down and the first to learn is a Worker who assumes she did
      something wrong. **Owner:** On-call lead. **Unblocks by setting:**
      `docs/policy/operability.md` → `default-availability`.
- [ ] **C10** — **Where a breach lands.** Every band in this spec is otherwise two-thirds of a band,
      which [intent Q3](./intent.md) said this effort should not ship. Proposal, two destinations
      because the failure classes differ: human-queue bands (NFR7) as a **daily digest at 08:00
      America/Bogotá through the notification seam**; machine bands (uptime, error spike) as a
      **`needs-triage` issue from CI**, per ADR-0001. Neither needs new infrastructure.
      **Risk if wrong:** NFR7 and NFR27 are numbers nobody ever reads. **Owner:** On-call lead.
      **Unblocks by setting:** `docs/policy/operability.md` → `alert-destination`.
- [ ] **C11** — **The consequence of a spent error budget.** With one unpaid person the only real lever
      is deploy cadence. Proposal: above 50% of the 30-day budget, deploys pause except fixes and
      cadence drops to once daily until it recovers.
      **Risk if wrong:** continuous deployment with no on-call and no brake degrades monotonically with
      nobody empowered to stop it. **Owner:** On-call lead. **Unblocks by setting:**
      `docs/policy/operability.md` → `error-budget-policy`.
- [ ] **C12** — **The inherited latency default.** Proposal: **p95 ≤ 400 ms server-side and ≤ 1200 ms
      user-measured**, matching NFR2 and making the network leg explicit for the next spec.
      **Risk if wrong:** the next spec re-derives a number and server-side figures keep reading as
      user-experience commitments. **Owner:** On-call lead. **Unblocks by setting:**
      `docs/policy/operability.md` → `default-latency`.
- [ ] **C13** — **Writing this effort's settled numbers back into `docs/policy/`.** NFR13 settles
      `session-lifetime`; NFR5 settles `browser-support`; NFR17 settles the four retention keys; NFR25
      settles `required-checks`, `branch-protection` and `rollback-mechanism`; DD2 settles `orm`,
      `pk-strategy` and `soft-delete`. **The intent requires them written back in this effort**, or the
      next spec raises every one again.
      **Risk if wrong:** ten keys stay `UNSET` while the code answers them, which
      `docs/policy/README.md` calls the same failure as guessing. **Owner:** each key's owner per
      `owners.md`; **Repo owner** to confirm the sweep happened.
- [ ] **C14** — **`migration-policy`, and what a one-way migration does to NFR25's five minutes.**
      Drizzle generates one-way SQL by default. DD10 proposes **expand/contract, with a contracting
      migration forbidden in the same deploy as the code change**, and DD13 makes that mechanical
      (NFR30) — so what remains open is narrower than it was: whether a reversible `down` migration is
      required at all, or whether forward-fix plus the isolation rules above is the policy.
      **Risk if wrong:** the one deploy that needs undoing is the one the rollback cannot undo.
      **Owner:** Data lead. **Unblocks by setting:** `docs/policy/data.md` → `migration-policy`.
- [ ] **C15** — **Authorization for international transmission.** PlanetScale, Fly, Cloudflare, Resend and
      Sentry are all outside Colombia, so every one is a _transmisión_ requiring disclosure in the
      _autorización_ and a transmission contract or equivalent. **RNBD registration is separately
      answered and does not apply** — DD8 verified that the threshold reaches _sociedades_ and
      non-profits above 100,000 UVT and public legal persons, not a _persona natural_.
      **Risk if wrong:** a named individual holding personal liability is transmitting displaced
      people's personal data abroad without the authorization Ley 1581 requires. **Owner:** Security
      owner, as _responsable del tratamiento_.
- [ ] **C16** — **`branch-protection` on a one-person repository.** Proposal: required **status
      checks**, not required reviews — required reviews lock the only operator out or normalize admin
      bypass, and status checks give NFR25 everything it asks for.
      **Risk if wrong:** either the operator is locked out of his own repository, or the gate becomes
      advisory. **Owner:** Repo owner. **Unblocks by setting:** `docs/policy/build.md` →
      `branch-protection`, and `stacked-prs` with it — 17 `Must` stories at one independent PR each is
      the volume that makes that key worth answering.
- [ ] **C17** — **Backup RPO and RTO.** One Postgres holds displaced people's phone numbers, with
      nobody on call and no second copy anywhere in this design; R2 is a second store with its own
      answer. Proposal: RPO **≤ 1 h**, RTO **≤ 4 h**, both verified once by an actual restore before
      the announcement.
      **Risk if wrong:** the failure that ends the platform is unrecoverable and nobody learns how much
      was lost until they need it. **Owner:** Data lead. **Unblocks by setting:**
      `docs/policy/data.md` → `backup-rpo` / `backup-rto`.
- [ ] **C18** — **What "reduced to non-identifying counts" retains**, on both paths that reach it
      (NFR11's deletion and NFR17's 12-month reduction). At three municipalities and launch volume,
      `(city, skill, month, workHappened, wasPaid)` may still re-identify one person.
      **Risk if wrong:** a record a Worker was told is anonymized identifies her. **Owner:** Data lead,
      with Security owner.
- [ ] **C19** — **Whether the Consent row — the _prueba de la autorización_ — survives the purge of the
      Account it authorizes.** Proposal: it survives, reduced to the versions and timestamps with no
      identifier beyond a hash.
      **Risk if wrong:** the evidence that we were permitted to hold her data is destroyed while a
      24-month Report about her survives. **Owner:** Security owner, as _responsable_.
- [ ] **C20** — **Two structural decisions where two advisories disagree, taken by this spec and worth
      confirming.** (a) **Workspaces:** the draft's four collapsed to two, because `@repo/db`'s stated
      invariant was already violated and a withholding `exports` map is a stronger boundary than a
      package split; the data lens implicitly assumed the split. (b) **The cache:** DD1 removes
      `use cache` entirely, which the data lens analysed carefully rather than argued for.
      **Risk if wrong:** (a) collapsing and later needing the split costs a day of moving files;
      keeping four costs three permanent boundaries and a contradiction with
      [ADR-0002](../../adr/0002-reporting-vendor-seam.md)'s "a seam, not an abstraction layer". (b) if
      NFR2 is missed, caching returns with a proof obligation attached. **Owner:** Tech lead
      (arbitrating simplicity vs data).

### Appended by `/spec-review` (2026-08-25, fidelity)

C21–C38 are advisory recommendations the synthesis dropped or diluted, found by the fidelity check
against the four committed advisories. C39–C42 come from the three mechanical shape checks and from
one obligation the intent placed on Design. **Note on cross-references:** `security.md` and
`simplicity.md` independently numbered their concerns `C-S1`–`C-S8`, so an advisory ID is ambiguous
on its own — each concern below names its advisory.

- [ ] **C21** — **No trust boundary is named and no STRIDE walk exists.** The security advisory
      listed seven boundaries this change crosses and noted the three outbound ones — object storage,
      Resend, Sentry — are "where personal data leaves the system, which is why they are not optional
      rows". The spec keeps only `[trust]` / `[network]` markers, which the advisory called "the right
      instinct" while noting no boundary carries a threat walk.
      **Risk if wrong:** the advisory's own summary — the spec is strong on disclosure and thin on the
      other five STRIDE letters. **Owner:** Security owner.
- [ ] **C22** — **A freeze stops sending and nothing else.** A reported Hirer keeps full gated read
      access to every Worker's `about` and work history, and any already-`delivered` Offer stays live
      and acceptable, until a human acts — with `on-call-rotation` = nobody and a 24 h queue. The
      security advisory asked that `reportOffer` also suspend his gated reads of _her_ profile and
      mark his undelivered Offers non-deliverable. NFR15 bounds further Offers only.
      **Risk if wrong:** the protective response to an accusation covers one of three channels.
      **Owner:** Security owner.
- [ ] **C23** — **Whether a purge reaches backups.** Distinct from C17, which asks the recovery
      question. The security advisory's point is a compliance one: "a 12-month purge with an unstated
      backup retention horizon is not a _supresión_; it is a delay." NFR17 defines "deleted" as rows,
      objects and logs — backups are not in that list.
      **Risk if wrong:** story 13 tells a Worker deletion "removes everything from the platform" while
      the row survives in backups — a false statement to a _titular_, made on the deletion screen.
      **Owner:** Data lead (with Security owner).
- [ ] **C24** — **The publish-rate queue signal has no number.** The security advisory asked for "an
      Admin queue signal when publish volume exceeds a **stated per-hour figure**"; DD7 says "a queue
      signal above a stated publish rate" and states none. The other two halves of that answer landed
      with numbers (≤ 3/day, one profile per Account). NFR7's ≤ 20/hour is Offers, not publishes.
      **Risk if wrong:** the mechanism designed to spread attention to displaced people is the one
      that hands a flooder the top of the list, undetected. **Owner:** Security owner.
- [ ] **C25** — **`AdminAction` is `Could` while two sections assert it unconditionally.** The API
      contract ("each writing an `AdminAction`") and DD7 ("every action writes an `AdminAction`") both
      make it mandatory; story 23 is `Could`, outside the announcement gate. The security advisory
      called repudiation "the one STRIDE letter with no entity behind it".
      **Risk if wrong:** the audit table need not exist when the site opens, so an abuse incident or a
      Ley 1581 _reclamo_ is reconstructed from mutable rows — and the spec contradicts itself about
      whether it is optional. **Owner:** Security owner (with Tech lead on the tier).
- [ ] **C26** — **Email template escaping — the mechanism changed after this was raised, and the
      owner should confirm rather than re-decide.** The advisory asked for explicit escaping at the
      template seam because DD7 called email "the one path where React's escaping does not apply".
      Adopting React Email (DD14) makes the templates React components, so escaping is by construction
      again and the residual rule is mechanical: no `dangerouslySetInnerHTML`, no `<Markdown>` over user
      text, both testable at seam 1. What remains for the owner is whether that is accepted as
      satisfying the advisory.
      **Risk if wrong:** stored HTML injection into an inbox, reaching both sides of an unverified
      market. **Owner:** Security owner.
- [ ] **C27** — **A failed webhook verification is not logged.** The contract carries three of the
      advisory's four asks — signature, replay window, idempotency, bodyless 401 — and drops "logged
      with the event id and nothing else". DD11's twelve-event list has no webhook-failure event.
      **Risk if wrong:** a forged bounce is an account-lockout primitive, and there is no record that
      forgeries were attempted. **Owner:** Security owner.
- [ ] **C28** — **Session and Verification carry no classification and no retention.** The data
      advisory flagged that these hold `secret`-class tokens and appear in neither NFR17's retention
      graph nor NFR18's egress bound. Both omissions are still true.
      **Risk if wrong:** the two tables holding the only credential in the system sit outside the
      retention graph and outside the egress bound. **Owner:** Data lead (with Security owner).
- [ ] **C29** — **Every Better Auth upgrade is now a schema-diff review, and the spec does not say
      so.** The mechanism half landed exactly (`additionalFields`, never a hand-added column); the
      standing cost the "one schema owner" decision buys was not written down.
      **Risk if wrong:** a regeneration drops the shared-device column silently — sessions revert to
      30 days and a borrowed phone keeps her account, with no failing test. **Owner:** Data lead.
- [ ] **C30** — **The duplicate-phone moderation signal was lost.** `phone (E.164)` landed; the
      non-unique index on the normalized value did not, and DD2's index table has no phone row. The
      data advisory noted this is "a moderation signal, not a verification gate, so it stays inside
      ADR-0008".
      **Risk if wrong:** the one Sybil signal available without breaching ADR-0008 is unavailable to
      the Admin. **Owner:** Data lead.
- [ ] **C31** — **Whether Better Auth stores session tokens hashed at rest** (data advisory D9). This
      reached the spec only as a bullet in _What was not verified_ — the risk sentence survived, the
      **owner did not**, so it is not among the boxes a human checks to approve.
      **Risk if wrong:** unhashed, one database read is session hijack of every Worker, and NFR13's
      revocation surfaces do not help. **Owner:** Security owner.
- [ ] **C32** — **The spread mechanism sits on the surface that does not get the traffic.** Ordering
      lives on `/profiles`; the Wall is newest-first and is the indexable, most-linked, most-shared
      surface, so most Hirer traffic bypasses the mechanism entirely. The realized-distribution SLI
      the operability advisory asked for **did** land in NFR22 — but its reporting surface is story
      20, which is `Should`.
      **Risk if wrong:** the fairness property this product is partly built on is asserted, bypassed,
      and observed only if a `Should` story ships. **Owner:** Tech lead (with On-call lead).
- [ ] **C33** — **The uptime monitor has no interval and no alert threshold.** The advisory proposed a
      1-minute interval alerting after 2 consecutive failures — "detection in ~2 minutes versus 'when
      a Worker mentions it to someone' is the entire difference this product can afford". NFR28 asks
      only that the monitor be "firing".
      **Risk if wrong:** with nobody on call, detection latency is the entire mitigation, and it is
      unspecified. **Owner:** On-call lead.
- [ ] **C34** — **No machine memory floor.** The advisory proposed **1 GB** as one of three saturation
      answers; the other two (photo cap, browser-side downscale) landed in DD6 in full. DD6 argues
      in-process multipart buffering "is the memory-saturation shape that kills a single Fly machine"
      and then states no bound.
      **Risk if wrong:** the deep dive names the failure mode and omits the number that answers it.
      **Owner:** On-call lead.
- [ ] **C35** — **The Postgres connection pool is never capped, and a forward reference points at a
      commitment that does not exist.** _What was not verified_ says PlanetScale's limit "is what
      turns **DD2's pool cap** into a number" — DD2 makes no pool cap.
      **Risk if wrong:** saturation stays a word rather than a number, on a single machine whose
      every cold start reopens the pool. **Owner:** On-call lead (with Data lead).
- [ ] **C36** — **Deferring the retention purge was overridden silently.** The simplicity advisory
      argued the purge is twelve months of carrying cost for a job whose first run is twelve months
      away, and that adding it in August 2027 costs about the same. DD10 keeps it and argues only that
      a silently-stopped purge is an undetected exposure — a case for monitoring it, not for building
      it now. **Further Notes** records five overrides and this is not among them.
      **Risk if wrong:** a `Must`-path day spent against a closing announcement window, and the
      override list stops being trustworthy as a complete record. **Owner:** Tech lead.
- [ ] **C37** — **Why the photo earns a `Must` slot is never stated.** The spec designs the path
      thoroughly (DD6) and corrects the fifth-account claim, but does not say why it is `Must`. The
      advisory's framing: "it may well be right — a face is plausibly what makes a Hirer choose a
      person over a fund — but an unstated reason is one nobody can weigh against a closing window."
      **Risk if wrong:** cutting it removes what may be the thing that makes a Hirer choose a person;
      keeping it costs an object store, a queue source, and NFR4's one exception — and neither side of
      that trade is written down. **Owner:** Tech lead (with Design lead).
- [ ] **C38** — **Twenty-five-odd Server Actions, each hand-verified by one person.** Testing
      Decisions makes the obligation stricter than the draft did — every action's authorization
      verified by requesting the endpoint unauthenticated — while the action count is unchanged and
      the cost is acknowledged nowhere.
      **Risk if wrong:** the definition-of-done burden scales with the action count and is paid by the
      one unpaid person the whole effort is racing. **Owner:** Tech lead.
- [ ] **C39** — **NFR26's second half protects the adversary, not the user.** It says a refusal
      returns rather than throws, so a crawler cannot spend the Sentry quota — and never says what a
      **legitimate** person gets when she hits a ceiling. No surface in the UX state table has a
      rate-limited state.
      **Risk if wrong:** a Worker who trips `publishProfile ≤ 3/day` after two failed attempts is
      stopped with no message, no retry-after and no path, by a requirement that passes green — the
      exact shape the second-half rule exists to catch. **Owner:** Design lead (with Tech lead).
- [ ] **C40** — **DD11's event list does not state what membership means.** "Every safety-relevant
      transition emits one `info` line…" followed by twelve events reads either as _exactly these_ or
      as _these plus any other safety-relevant transition_.
      **Risk if wrong:** Build picks one reading without asking, which is the failure effort 0001 paid
      a wrong implementation and a mid-Build amendment for. **Owner:** Tech lead.
- [ ] **C41** — **An obligation the intent placed on Design was not discharged.** [Intent
      Q3](./intent.md): "Design states what the queue does when one person is away for three days:
      Offers accumulate undelivered, and whether that is silent or visible to a waiting Hirer is a
      decision, not an implementation detail." NFR7 sets the bound and admits best-effort; the
      decision is made nowhere, and the Sent Offers row in the state table has no state for an Offer
      still unreviewed past 24 h.
      **Risk if wrong:** the Hirer — the scarce side, whose attention is the resource the whole effort
      is racing — waits with no signal and no expectation set. **Owner:** Design lead (with On-call
      lead).
- [ ] **C42** — **Story 18, the seven-day check-in, is bound by no NFR and cannot run until after
      launch.** [ADR-0007](../../adr/0007-the-platform-never-handles-money.md) calls it "the only
      evidence available" of whether any of this produced income, and no requirement measures whether
      it works — no response-rate number, no send-success number. The simplicity advisory separately
      noted it "cannot be needed until seven days after the first Contact Exchange… worth saying so it
      is not built before" — which is also its scheduling answer.
      **Risk if wrong:** the platform's only impact evidence ships unmeasured, and any figure published
      from it carries an unknown response rate on top of ADR-0007's self-reporting qualification.
      **Owner:** Tech lead (with On-call lead on the number).

### Appended after the Better Auth review (2026-08-25)

- [ ] **C43** — **There is one Admin, and losing the TOTP device locks the platform's only moderator
      out of the queue.** Backup codes are the sole recovery path (10 codes, encrypted at rest with
      `BETTER_AUTH_SECRET`, single-use), and rotating that secret invalidates the second factor
      entirely. Meanwhile every Offer stays undelivered behind NFR7's 24 h band and every reported
      Hirer stays frozen, because `unfreezeHirer` is an Admin action. Proposal: backup codes printed
      and stored offline at setup, a second Admin grant held by the same person on a separate device,
      and a documented break-glass in the go-live runbook — a `UPDATE` disabling 2FA, executed
      against the direct connection, which is itself a credential worth naming.
      **Risk if wrong:** the moderation queue — the one control ADR-0008 leaves standing after
      choosing not to verify anyone — stops, with no way back in and nobody on call.
      **Owner:** Security owner (with On-call lead).
- [ ] **C44** — **`trustDevice` at its 30-day default contradicts NFR13's 8-hour Admin session.**
      Trusting a device skips the _second factor_ on re-authentication, so an 8-hour non-rolling
      session would be re-established on a password alone for a month — on the account that can take
      down a profile and read every phone number in the system. Proposal: **disable trusted devices
      for the Admin outright**; if that is judged too costly for a person moderating daily, cap
      `trustDeviceMaxAge` at the session length so the two numbers stop disagreeing.
      **Risk if wrong:** NFR14 is satisfied on paper — the session did complete 2FA once — while the
      practical factor count drops to one for thirty days at a time.
      **Owner:** Security owner.

### Appended after the Resend / React Email review (2026-08-25)

- [ ] **C45** — **The announcement is a spike onto a sending domain that has never sent anything, and
      the magic link is the only door.** Warm-up guidance for a new domain is **50–100 sends/day in
      week 1**, 200–500 in week 2. Every sign-up needs one magic link, plus Offer notifications and
      Contact Exchange deliveries on top. An announcement producing a few hundred sign-ups on day one
      either fails to deliver most of them or burns the domain's reputation on the exact day the
      product's thesis depends on it — and [intent Q8](./intent.md) makes attention the scarce
      resource, so there is no second attempt at this.
      Proposal, all three: **begin warming the domain from the first deploy** rather than at
      announcement — every ticket's test sends count; **stage the announcement** rather than making it
      one event, so volume tracks the warm-up curve; and **hold a pre-warmed fallback subdomain** so a
      reputation problem on the primary is a DNS change rather than a rebuild. Whether the `Must` gate
      should additionally require a measured deliverability check into Colombian Gmail and Hotmail —
      which [intent Q1](./intent.md) called "a launch risk to measure, not to assume" and nothing in
      this spec yet measures — is the same decision.
      **Risk if wrong:** the platform opens, Workers publish, Hirers arrive, and neither side can sign
      in. It is silent: sends are accepted, not bounced, and NFR27's conversion metric is the only
      thing that would show it — after the window has closed. **Owner:** On-call lead (with Repo owner
      on the announcement plan).

## Out of Scope

Inherited from the intent unchanged: payments, escrow and disputes
([ADR-0007](../../adr/0007-the-platform-never-handles-money.md)); verification of any kind
([ADR-0008](../../adr/0008-open-enrolment-with-published-non-verification.md)); ratings, reviews and
reputation; in-platform messaging; Hirer-side postings; any municipality beyond the three and any
language beyond `es-CO`; dark mode; native or installable apps; analytics and product instrumentation
(`analytics-consent` is `UNSET`, and under Ley 1581 that gate precedes instrumentation).

**Corrected from the intent:** _running the log drain_ was listed out of scope as a deploy-time act.
DD11 moves it **in** — under continuous deployment, undrained logs retain for minutes rather than 30
days, which makes NFR17's log number false and every incident undiagnosable. It lands with the first
deploy.

**Added by Design:**

- **Multi-region, replication and failover.** `hosting-target` fixes one machine; there is no second
  thing to fail over to.
- **A second Fly machine.** It would reintroduce `revalidateTag`'s cross-instance problem with no
  handler, and remove the single-runner guarantee the scheduler relies on now that transaction pooling
  has taken advisory locks away.
- **Partitioning the `offer` table.** Considered against the 12-month retention window — a monthly
  partition makes the purge a `DETACH` — and rejected: at this volume the purge is a trivial `DELETE`
  and partitioning complicates every foreign key in NFR17's graph.
- **Feature flags.** No mechanism exists in this repo, so "behind a flag" is unavailable as a
  mitigation rather than unchosen. DD10's health gate carries that weight instead.
- **"Last active" on a profile.** A write on every authenticated request, on one machine, for a
  `Could`-tier signal.
- **Session replay and user-feedback integrations.** Zero bytes today (effort 0001's NFR12), and
  turning them on would spend quota and collect exactly the personal data NFR18 forbids.

## Further Notes

### Advisor recommendations overridden, and why

Five, each recorded because a silent override is what `/spec-review` exists to catch.

1. **Operability C-OP8 — move the region from `iad` to `mia`.** Overridden on fact and on decision.
   **Fly has no Miami region**; its only South American region is `gru` (São Paulo), and Colombian
   international traffic routes north, so `gru` is worse for Pereira than `iad`. PlanetScale offers no
   Colombian region either. The repo owner confirmed N. Virginia. The advisory's underlying point —
   that a server-side p95 measures our comfort rather than hers — was **accepted** and became NFR2's
   second number.
2. **Simplicity — cut story 3 (in-form Skill request) to `Should`.** Overridden.
   [Intent Q2](./intent.md) makes the request path "the vocabulary's only growth path", and a closed
   list with no way in silently excludes. The advisory's real finding — that the request was `Must`
   while its resolver was `Should` — was **accepted** by merging both halves into story 3.
3. **Simplicity — cut story 13 (self-serve deletion) to `Should`.** Overridden. Deletion is the habeas
   data surface, and moving it transfers a statutory clock onto one unpaid person's inbox — which the
   advisory itself named as the cost in its handoff.
4. **Simplicity — cut `@repo/notifications` to a module inside another package,** citing
   [ADR-0002](../../adr/0002-reporting-vendor-seam.md)'s "a seam, not an abstraction layer".
   Overridden on the workspace, accepted on the principle: it stays a workspace because it carries a
   distinct runtime dependency (`resend`) that `@repo/domain` should not inherit, and because DD10's
   kill switch makes it an operational surface rather than a helper. The **larger** cut — four
   workspaces to two — was accepted, which is most of what the advisory was asking for.
5. **Operability — replace NFR25's bounce-rate SLI.** Not an override; recorded because it changed a
   number rather than adding one. The bounce rate became a secondary and conversion-to-signed-in
   became NFR27.

### What was verified rather than recalled

Named so a reader knows which claims carry weight: PGlite's Postgres version (read from the shipped
`pglite.wasm`) and its bundled extensions (read from the package); PlanetScale's Postgres versions,
regions and extension support; Fly's region list and `flyctl` v0.4.87's `releases` / `deploy --image`
flags (run locally); Better Auth 1.7.1's magic-link options, session options, `dont_remember` cookie
and issue #4491's closure; Ley 1581's arts. 14–15 clocks and the RNBD threshold in Decreto 1074 de
2015; CUOC's establishing decree and resolution; Baseline's 30-month definition; the `engines.node` of
every dependency this spec pins; and `CARRIER_PATHS` in the shipped `packages/errors/src/redaction.ts`.

### What was not verified, and should be before Build

- **Better Auth 1.7.1's actual generated schema** — table names, whether it indexes
  `session.account_id`, whether session tokens are hashed at rest (unhashed, one database read is
  session hijack of every Worker), and whether `additionalFields` reaches the `verification` record as
  DD5 assumes.
- **Whether PlanetScale requires dashboard enablement** for `citext` and `pg_trgm` before
  `CREATE EXTENSION` works. If so it belongs in the go-live runbook.
- **PlanetScale's connection limit** on the chosen plan, which is what turns DD2's pool cap into a
  number.
- **Actual Pereira↔`iad` RTT.** The 90–110 ms in NFR2 is an estimate and is worth one measurement
  before the number is committed to.
- **Sentry free-tier figures** — one uptime monitor, one cron monitor, 5,000 errors, 5 GB of logs. The
  runbook pins them at 2026-08-23 and instructs re-reading §3 before relying on them; DD11 relies on
  all four.

### Volume, and the number this spec does not have

No advisory could size an index, because neither the intent nor this spec states a population. NFR2
promises a p95 and NFR22 promises a spread property, and both hold over a population nobody has
estimated. The honest position: at three municipalities the launch population is hundreds of profiles,
which is the premise DD1's no-cache decision rests on. **If that premise is wrong by an order of
magnitude, DD1 is the first thing to revisit** — not last.

### The dependency Build must not discover late

`voice-guide` (concern C2) blocks the Skill-vocabulary seeding ticket, which blocks story 3 and story
2's picker. It is the only non-code dependency on the `Must` path, and the `brand-voice` session
should be scheduled before `/to-tickets` runs rather than after.
