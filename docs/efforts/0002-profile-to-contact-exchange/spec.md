---
stage: spec
status: approved
reviewed: 2026-08-25 fidelity (second pass, C46–C57 resolved)
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
accepted — her full name is **collected at publish and withheld until then** (C1), so the exchange is
the same whichever door she signed in through. Each is built field by field from a whitelist under
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

**The platform states its own absences, including the ones a Worker would otherwise get wrong.**
Nobody is verified — and that includes the Hirer's own name and phone, which he types and nothing
checks (C4); the platform holds no money and can recover none. And: a Block stops him **sending** and
does nothing else (C3) — it does not remove her from the public Wall, which is readable signed out, and
it does not close his reading of her profile; deletion removes everything from the platform at once and
from backups within seven days (C23), but does **not** reach a Hirer who already has her number. Each
is said on the surface where she would otherwise assume otherwise.

## User Stories

Prioritized. Each is demoable on its own, because each becomes a tracer-bullet ticket. The `Must`
list is the **announcement gate** ([intent Q8](./intent.md)): deployment is continuous from the first
ticket, and nobody is told the site exists until every `Must` ticket is closed **and** NFR28's
operational leg is green.

**Every story carrying a surface opens with `/impeccable shape <target>`, then `/prototype` UI**,
inside its own ticket. See **UX design** for target paths and the ordering constraint.

**Must**

1. As a Worker, I want to sign in **either with Google in one tap or with a link sent to my email**,
   with no password either way, so that I can reach my account from a phone without remembering
   anything — and where I choose the email route, I want the surface to tell me before I type
   anything that I need an address I can open.
2. As a Worker, I want to publish a CapabilityProfile in one sitting from my phone — my full name,
   first name, last initial, city, Skills from a list, one line in my own words, my phone number, and
   a photo — so that someone can find me for work today. My full name is collected here and shown to
   nobody until I accept an Offer (C1).
   **The photo is `Must` for the reason [ADR-0009](../../adr/0009-a-workers-full-identity-is-gated-and-never-indexed.md)
   gives** (C37): that ADR removed the loss narrative and named its replacement in the same breath —
   "one line in her own words about what she does, and a face." With the damage story deliberately
   gone, a headline and a face are the entire emotional surface a Hirer meets.
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
    platform holds no money, that a Hirer's own name and phone are self-asserted like everyone
    else's (C4), and what a Block does and does not reach — **it stops him sending, and does not
    hide my public card or close his reading of my profile** (C3) — so that I am not relying on a
    protection that does not exist.
12. As a Worker signing in on a phone that is not mine, I want to say so, so that my session ends when
    the browser closes **and** expires server-side in hours rather than weeks, and I want to sign out
    everywhere from any device I still hold.
13. As a Worker, I want to delete my Account and be told plainly, before I confirm, what deletion
    reaches and what it cannot — including that it removes everything from the platform immediately
    and from backups within seven days (C23), and that it cannot reach what a Hirer already read.
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

**Also `Must`, promoted while resolving the flagged concerns.** Story numbers are stable across this
document, so each keeps its original one.

1.  As an Admin, I want to take down a CapabilityProfile and to see the realized attention spread
    over the last seven days, so that the corrective half of moderation exists and the fairness
    property is observed rather than only asserted. **Promoted by C32:** the Wall stays newest-first,
    so the spread mechanism is bypassed by most traffic and measuring it is what replaces reordering.

And the audit record, which two other sections of this spec already assert unconditionally:

1.  As an Admin, I want an audit record of every action I take, so that an abuse incident and a Ley
    1581 _reclamo_ can be reconstructed from something other than mutable rows. **Promoted by C25:**
    repudiation is the one STRIDE letter with no other answer here, and logs live 30 days while a
    Report lives 24 months.

**Also `Must`, added by amendment (2026-09-02, #139).** Four places in this document already assumed
editing existed and none built it; **Further Notes** names all four. It is `Must` because those four
are load-bearing today, and because a wrong phone number on a published profile is a profile nobody
can reach. Story numbers are stable across this document, so this one takes the next free number
rather than a position in the list above.

24. As a Worker, I want to change what my published profile says — my Skills, my work history, the
    line in my own words, my city, my name as it is shown and the number people reach me on — so that
    a mistake or a change in what I do is mine to correct, from the same phone, without asking
    anybody. The address people already hold for my profile keeps working, and correcting it does not
    move me to the top of the Wall.

**Should**

1.  As a Worker and as a Hirer, I want a check-in seven days after a Contact Exchange asking whether
    the work happened and whether I was paid, so that there is evidence of whether any of this worked
    and a way to say "no me pagaron" without accusing anyone.
2.  As a Hirer, I want to search and filter the browsable list by Skill and city in Spanish, including
    when I type without accents, so that I can find the person I need rather than scroll.
3.  As a Worker whose email address hard-bounced, I want the site to tell me and let me change it from
    a session I still hold, so that a wrong address is not silently the end of my account.
4.  As a maintainer, I want `PRODUCT.md`, `README.md` and the template-facing sections of `CLAUDE.md`
    rewritten to describe Recomencemos, so that a future agent stops judging product code by whether
    it improves a template.

**Could**

Empty. Both stories that sat here or in `Should` were promoted above while resolving the flagged
concerns.

## Non-functional requirements

- **NFR1 — Publish latency, end to end.** A Worker completing the form reaches the Wall in **≤ 5 s**,
  measured from submission to visibility on a fresh `/` load. No human review sits on this path.
  **Binds:** 2.
- **NFR2 — Read latency, and which half of it is instrumented.** p95 **≤ 400 ms** server-side for `/`
  and `/profiles` on the Fly `iad` machine, and **≤ 1200 ms** measured from a Colombian client — the
  number that includes the ~90–110 ms Bogotá↔`iad` round trip the server-side figure excludes. Held at
  **50 req/s sustained** and **500 concurrent**. There is no cache, so there is no warm/cold
  distinction to state.
  **The two numbers are measured by different things, and only one is continuous** (C50). The
  server-side p95 is read from the log line on every request. The client-side 1200 ms has **no
  instrument in this product** — analytics and RUM are Out of Scope, the uptime monitor probes
  `/api/health`, and NFR28's load test runs against the machine — so it is a **measured figure on a
  cadence, not a monitored SLI**: taken at go-live from a real Colombian connection under 4× network
  and 4× CPU throttling (runbook §11), and re-taken **monthly** and **after any change to the Wall's
  payload or the photo path**. Stating it that way is the point: the honest cost is that a regression
  between two measurements is invisible, and pretending otherwise is what the operability advisory
  objected to. `default-latency` is set to both numbers on that understanding, and the row in the policy
  table below says which half is monitored.
  **Binds:** 2, 4, 19.
- **NFR3 — Worker-path page weight.** `/` and `/profiles` each ship **≤ 140 KB**, and `/publish`
  **≤ 250 KB**, of gzip-compressed JavaScript on first load, and all three reach **LCP ≤ 2.5 s at
  p75** under 4× network and 4× CPU throttling. The LCP figure is the requirement; the byte budget
  is its leading indicator, and is the half a ticket can be held to before there is any traffic to
  measure.
  **What counts, written down because the ambiguity cost 39 KB once.** gzip on the wire, every
  `<script>` the prerendered document requests, **excluding** the `noModule` polyfill bundle — no
  browser inside NFR5's floor downloads it. Any figure quoted anywhere names its compression.
  **Amended 2026-09-03 with #157.** It was one **≤ 120 KB** budget over both routes, set without
  measuring what the framework costs before a line of this product's code runs. Measured that day
  from a production build, `/`'s floor — React, the Next runtime and the app shell, with no Sentry,
  no Base UI and no form layer — is **81 KB**, so 120 KB left **39 KB** for everything the product
  is, against Base UI's popup machinery alone at 53 KB. `/privacy`, a static page owning no client
  component of its own, missed it by 171 KB. The second half below was written from one side only: a
  budget **nothing** can meet fails exactly as a budget met by shipping less of the page does, and is
  the worse of the two, because it reads as a requirement while being guidance nobody is expected to
  act on. The replacement numbers are the measured floor plus the headroom #157 leaves — `/` lands
  at 133 KB and `/publish` at 233 KB the day it does — so both are tight rather than slack, and
  neither is met today.
  **Second half:** a page meeting the byte budget must still render the Wall's cards, both standing
  notices, and every field of the publishing form. A budget met by shipping less of the page is a
  budget failed.
  **Images are bounded separately, because on this page they are the dominant bytes.** Every photo is
  served at a width appropriate to its slot and in a format the browser negotiated — **0** Wall cards
  request an image more than **2×** their rendered CSS width, and resizing happens at the edge rather
  than on the Fly machine (DD6).
  **Amended 2026-09-08 with #228: prefetch traffic is a second instrument, and the byte budget above
  is unchanged.** The two measure different things and neither can see the other: the budget is script
  bytes a prerendered document requests, read by `pnpm page-weight`; this is router traffic that
  script then generates, which `page-weight` never observes. It matters here because every row of both
  lists is a link to one repeated route, so it grows with the list rather than with the page.
  **The number to hold is the marginal cost of a row, and it is 795 bytes.** With
  `partialPrefetching` on, a prefetched row costs its route tree and nothing else, because the page
  payload is fetched once for the route and shared. Measured 2026-09-08 on Next 16.3.4: **795 B** per
  row, against **5,529 B** (796 tree + 4,733 page) with the flag off. Over a whole list the request
  count barely moves and the bytes do: scrolling `/profiles` to the end of 91 rows went from
  **14 requests / 37,871 B** to **11 / 21,687 B**, and the Wall from **14 / 36,200 B** to
  **12 / 22,688 B**.
  **Whole-journey figures from the same runs**, gzip on the wire, 390 × 844. Each is a sum, and its
  parts are named so a re-take reconstructs the total rather than having to trust it. Reading the Wall
  to the end — document plus prefetch — is **67,769 → 59,818 B** (−12%). Reading `/profiles` to the
  end — document plus prefetch plus 6,271 B of infinite-scroll Server Action responses, identical on
  both sides — is **67,658 → 56,268 B** (−17%). Four city-filter changes on `/profiles` — document
  plus prefetch plus the four navigations — is **154,221 → 170,614 B** (**+11%**), the one journey the
  flag makes dearer. That +16,393 B decomposes as **+4,794** on the document, **−5,776** on prefetch
  and **+17,375** across the four navigations (+4,343 each, +15.9% on the navigations alone). One trap
  worth naming: the flag-**off** filter journey summed with the _scroll_ run's prefetch figure comes to
  170,643 B, within 29 bytes of the flag-**on** total above and a different quantity entirely.
  **A single reading of a document or a navigation is not a measurement.** Both stream, so gzip's
  flush boundaries move between runs and one document came back at 28,308 bytes and at 29,692. The
  figures above are medians of fifteen for documents and means of four for navigations. Prefetch
  responses are buffered and repeat byte-identically, which is why the per-row number can be quoted
  exactly and these cannot.
  **How to re-take it**, because a figure quoted from memory is what amended this requirement once
  already. It is a seam-3 procedure rather than a command, since it needs a running server and a
  browser: build for production and run `next start` — never `next dev`, which does not prefetch —
  seeded with **90 published profiles** and scrolled to the end of the list, which is what the figures
  above are and is four pages rather than three; put a counting reverse proxy in front of it that logs
  each response's header and body bytes; drive the route at 390 × 844 with a fixed scroll script; and
  classify each request by the header the router sets rather than by its path, since a prefetch
  (`Next-Router-Prefetch`), a navigation (`RSC` alone) and the infinite-scroll action (a `POST`) all
  hit the same URLs. **A browser HAR is not an instrument for this**: it reports a streamed RSC
  response's `bodySize` as whatever had arrived when it was recorded, and gave 363 bytes and 27,336
  bytes for the same navigation on two runs. Buffered prefetch responses it reports correctly, which
  is what makes the error easy to miss.
  **Binds:** 2, 4, 11.
- **NFR4 — Publishing and editing without JavaScript.** With JavaScript unavailable or still loading,
  a Worker completes **every** field except the photo and submitting produces a published profile —
  **and the same holds for a change to one already published.** The photo is the single documented
  exception and the form says so where it appears. _Amended 2026-09-02 with #139: this named publishing
  alone. She corrects a wrong number on the same phone and the same connection she typed it on, over
  the same fields, so the exemption had no argument behind it — and the photo stays the exception on
  both paths._ **Binds:** 2, 4, 24.
- **NFR5 — Browser floor.** Every platform feature on a Worker-critical path is **Baseline Widely
  Available** — 30 months past the date all four core browsers shipped it, verified against web.dev's
  definition rather than recalled. Concretely Chrome on Android 10+, Safari on iOS 16+, current
  evergreen desktop. Settles `browser-support`. **Binds:** 2, 4, 5, 8, 24.
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
  derived from **no** part of her name, city or Skills, and stable across edits. _Amended 2026-09-02
  with #139: "stable across edits" was vacuous until story 24 gave the document an edit — an address a
  Hirer already holds keeps resolving after she corrects her wording._ **Binds:** 4, 5, 24.
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
  otherwise. **Binds:** 2, 6, 24.
- **NFR13 — Session lifetime, and revocation before expiry.** Own device **30 days, absolute**
  _(amended 2026-08-28, with #12: this read "rolling", and rolling is not implementable without
  breaking the shared-device promise — better-auth@1.7.1 computes its refresh predicate from the
  configured `expiresIn` rather than from the row, so with per-device rows any refresh rewrites an
  8-hour shared-device session to 30 days on its first read. `session.disableSessionRefresh` is the
  one mechanism that keeps the 8-hour row honest, and it makes the own-device lifetime absolute: a
  Worker who uses the product daily signs in again on day 30. PR #77 carries the verification and
  `session-lifetime.integration.test.ts` asserts both halves)_. Shared
  device, self-declared **8 hours**, enforced on the **session row** and not only by a non-persistent
  cookie, because a cybercafé browser may not close for a week. Admin **8 hours**, no rolling. A
  Worker ends all her sessions from any device she holds; an Admin ends a reported Hirer's while
  handling the Report. Any session cookie cache is **off**, or every revocation here and NFR15's zero
  lag by its TTL. Settles `session-lifetime`. **Binds:** 1, 10, 12.
- **NFR14 — Admin authentication is a property of the session, not the principal.** Every `/admin/*`
  response — page and Server Action alike — to a session **not established through the Admin door** is
  a **403**, even where the principal holds the Admin grant and has a second factor enrolled. An Admin
  who signed in through the magic link every Account can use is not an authenticated Admin.
  **The Admin door is two factors and neither of them is a password** (_amended 2026-08-30 with #96_).
  It is a **single-use emailed link** — possession of the mailbox — followed by a **TOTP code** —
  possession of the authenticator. Neither factor alone mints a session: consuming the link sets a
  short-lived challenge and creates nothing, and the session exists only after the code. The session
  records `link_totp` as the method that created it.
  **The mechanism, because "a property of the session" is not free.** Better Auth records 2FA on the
  **user** (`twoFactorEnabled`), not on the session, and its own 2FA flow intercepts only
  `/sign-in/email`, `/sign-in/username` and `/sign-in/phone-number` — so a magic-link session on an
  Admin account would carry full Admin authority having presented no second factor at all. Two things
  close that, and both are required: **every door other than the Admin door is refused for an account
  holding the Admin grant**, and the session records the method that created it, through
  `session.additionalFields` written by a `databaseHooks.session.create.before` hook. `requireAdmin`
  reads that field, not `twoFactorEnabled`.
  **The rule is written over the class rather than over its members**, and the class widened with the
  amendment: it was _"every passwordless door"_ while a password door existed, and it is now **every
  door that is not the Admin door**. That is the stronger statement and the one that survives a third
  door being added, which is exactly when this gets forgotten. It also no longer has an exception to
  remember — under the old rule the credential door was passwordful and therefore silently outside the
  class it needed to be inside.
  **What the amendment removes is a password, not a factor.** Before it, the two factors were a
  16-character password and TOTP; after it they are a mailbox and an authenticator. The count is
  unchanged and the shared failure mode — one person, one device — is unchanged with it, so C43's three
  recovery paths still apply in full. What is gone is the single reusable secret that had to be stored
  somewhere, typed on whatever machine was to hand, and floored at sixteen characters because there was
  no bound on how many times it could be guessed. **Binds:** 7, 20.
- **NFR15 — A Report freezes without waiting for a human, and the freeze is race-free.** From commit
  of a Report the reported Hirer sends **0** further Offers. `sendOffer` takes a row lock on the
  Hirer's Account inside its transaction: under READ COMMITTED an unlocked read of `offerSendingState`
  interleaves with the freeze and an Offer gets through, and a Report plus a burst of Offers from the
  same Hirer is the expected shape of the incident rather than an exotic one. `UNIQUE (offer_id)` on
  ContactExchange is the same discipline against a double accept. **Binds:** 10.
- **NFR16 — Habeas data, as the half a diff can satisfy.** One function produces the
  **subject-access export**: everything held about one person, built from the same whitelist mechanism
  as the three projections, so a new `personal` column omitted from the export fails the same class of
  sentinel test as NFR10. That is the whole of this requirement, and it is the whole of what
  `/to-tickets` copies onto a ticket. **Binds:** 13, 14.
  **The clocks are a runbook, and they are deliberately not part of this NFR** (C53). A _consulta_ is
  answered within **10 business days**, extensible once by **≤ 5**; a _reclamo_ within **15 business
  days**, extensible once by **≤ 8**; an incomplete _reclamo_ returned for correction within **5
  days** — verified against Ley 1581 de 2012 arts. 14–15 rather than recalled, and carried by the
  go-live runbook's §7, which is where a step ending in a calendar belongs. The previous wording
  adopted that distinction in prose while keeping the clocks inside a bound requirement, so an
  unsatisfiable acceptance criterion still travelled to a `Must` ticket beside a satisfiable one. **A
  business-day clock binds no story**, because no diff advances it and no reviewer can tick it with
  evidence.
- **NFR17 — Retention, as a graph with a purge order.** Reports **24 months**; Offers **12 months from
  send**, except an Offer referenced by a live Report, which is pinned until that Report purges;
  ContactExchange **12 months**, then reduced to non-identifying counts; CheckIns follow their
  exchange; Account, profile and photo **12 months after last sign-in**; logs **30 days**;
  **Session at expiry or `signOutEverywhere`, Verification on use with a sweep for the unredeemed**
  (C28); **Consent with the Account it authorizes, no exception** (C19). Purge order is leaf-first —
  CheckIn, ContactExchange, Report, Offer, Consent, Session, Verification, Profile, Account — so no
  foreign key dangles, which the per-table version of this requirement did in three places.
  **"Deleted" means rows and storage objects and logs and backups**, the last bounded by
  `retention-backups` at **7 days** (C23): removal from the platform is immediate and the backup
  window rolls past within a week, and the deletion surface says both numbers rather than implying
  the first covers everything.
  **"Reduced to non-identifying counts" is exactly four integers per month** (C18) — exchanges,
  check-ins answered, work-happened, was-paid — with no city and no skill dimension, so the claim
  holds at any volume rather than above a traffic level nobody is measuring. Settles
  `retention-personal`, `retention-internal`, `retention-logs`, `log-retention`,
  `retention-backups`. **Binds:** 13, 14.
- **NFR18 — No personal data leaves the machine, on any egress.** **0** log lines, **0** Sentry events
  and **0** Sentry transactions carry a phone number, an email address, a full name, an Offer body or
  a Worker's own-words text. The test drives every logging call site **and** the `beforeSend` /
  `beforeSendTransaction` hooks with the same sentinels, because the shipped redaction list matches
  key names and contains no `phone`, `email`, `about` or `workDescription`. **Binds:** 1, 2, 6, 8, 9,
  17, 24.
- **NFR19 — `request.url` carries no credential to any processor.** The magic-link token is a query
  parameter and `CARRIER_PATHS` in `packages/errors/src/redaction.ts` has no `["request","url"]`
  entry — verified in the shipped file, whose own docstring defers the case to "whatever consumes
  transactions". This effort is that consumer. At `tracesSampleRate: 0.1` the exposure is ~1 in 10
  verify requests and 100% of errors on that route. Afterwards, **0** events or transactions reaching
  a processor carry a query string. **Binds:** 17.
- **NFR20 — Accessibility.** **WCAG 2.2 AA** (`docs/policy/ux.md` → `wcag-level`) on every surface, in
  the single light theme, in `es-CO`, including every error state and the full six-state set named per
  surface in **UX design**. **Binds:** 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 19, 20, 21, 24.
- **NFR21 — Search quality in Spanish.** A query returns the same results with or without accents and
  in any case, over **≥ 95%** of the seeded vocabulary, measured against a fixture of
  accented/unaccented pairs. **Binds:** 19.
- **NFR22 — Attention spread, as the intent states it.** The browsable list orders by delivered-Offer
  count ascending, then a **stored** `rotationKey` rewritten daily, then id — index-ordered,
  keyset-paginable, and a pure function of stored columns. The observed property is reported weekly to
  the Admin: **the share of delivered Offers going to the single most-contacted profile over a rolling
  7 days** — reported by story 20, which C32 promoted to `Must` precisely because the Wall stays
  newest-first and the mechanism is therefore bypassed by most traffic. The draft's `⌈3 × M/N⌉` bound
  is **withdrawn**: at the expected launch ratio — Hirers are
  the scarce side, so M < N/3 — it evaluates to 1, so the first Worker to have a good week violates
  it. **Binds:** 4, 19, 20.
- **NFR23 — Node floor.** Every dependency this effort adds declares an `engines.node` admitting every
  `24.x`, or none. Verified at Design against the versions this spec pins: `better-auth@1.7.1` and
  `drizzle-orm@0.45.2` declare none; `resend@6.22.1` declares `>=20`; `pg@8.23.0` declares
  `>= 16.0.0`; `@electric-sql/pglite@0.5.7` and `uuid@14.0.2` declare none. **Binds:** 1, 2, 9.
- **NFR24 — Environment declaration, and credentials in neither.** Every environment variable this
  effort introduces appears in `turbo.json`: build-baked values in `env` on `build`, runtime-only
  values in `globalPassThroughEnv`. **No runtime credential appears in any turbo task at all** —
  `DATABASE_URL`, `DIRECT_DATABASE_URL`, `RESEND_API_KEY`, the webhook signing secret, the R2
  credentials, the Google OAuth client id and secret, Better Auth's secret, and the **job endpoint's
  shared secret** (DD10) are needed by no turbo task, and `.env*` files are `build`
  inputs. They reach the app through `fly secrets` only. `turbo build --dry` lists what remains.
  **Binds:** 1, 2, 9, 15.
- **NFR25 — The deploy is a promotion, not a terminal habit, and a bad deploy cannot take the site.**
  `pnpm lint`, `check-types`, `test` and `build` run in CI on every PR; the default branch refuses a
  direct push; deploys are **bluegreen and health-gated**, so a failing `GET /api/health` aborts the
  deploy and leaves the previous machine serving. A completed deploy is undoable in **≤ 5 minutes** by
  one documented command. `NEXT_PUBLIC_RELEASE` is set from the commit SHA **at build time and again
  at runtime** — `NEXT_PUBLIC_*` is inlined into the client bundle by the build, but the logger is
  externalised out of the server bundle and reads `process.env` at start, so a build-only value gives
  a browser that reports the release correctly and server log lines that all read `release: "unknown"`.
  Settles `required-checks`, `branch-protection`, `rollback-mechanism`, `release-branch`. **Binds:** 15.
  **Amended at #9, and the amendment is the first clause.** This requirement was written as _"the gate
  runs off a developer's terminal"_: CI ran the checks and a human ran `fly deploy`. Two things were
  wrong with that. A deploy nobody can perform except the one person with `flyctl` logged in is a
  bus-factor of one on the only irreversible operation in the system, which sits badly beside
  `on-call-rotation` being nobody. And a deploy path that exists only on a laptop is a path no gate
  covers — the checks are advisory the moment the command that ships is typed by hand.
  So: **`main` is the release branch and `dev` is the default branch**, deploys run from
  `.github/workflows/deploy.yml` on a push to `main` and from nowhere else, and that workflow **calls
  `ci.yml` as a reusable workflow** rather than restating the five jobs — one definition of green,
  run on the commit actually being deployed. Merging a ticket into `dev` integrates it; reaching
  `main` is a promotion a human performs, which is what keeps "continuous deployment" from meaning
  "every merged ticket is a release". `scripts/deploy.sh` stays the single deploy path and CI invokes
  it, so a terminal deploy and a CI deploy cannot diverge; it refuses any branch but `main` unless
  `DEPLOY_ALLOW_BRANCH=1` says a rehearsal is meant.
- **NFR26 — Ceilings on the two exhaustible resources.** Gated profile reads **≤ 60 per Account per
  hour, ≤ 300 per day**, with a higher per-IP bound above it. Per Account and per IP:
  `publishProfile` **≤ 3/day**, `updateProfile` **≤ 10/day**, `sendOffer` **≤ 10/day**, `reportOffer`
  **≤ 10/day**, `requestSkill` **≤ 5/day**, `createPhotoUpload` **≤ 10/day**, `changeEmail`
  **≤ 3/day**, `requestMagicLink` **≤ 5/hour per address and ≤ 20/hour per IP**.
  _Amended 2026-09-02 with #139: `updateProfile` added. Deliberately **not** `publishProfile`'s 3/day —
  publishing happens once and editing is a repeated act, so a Worker fixing her own wording three times
  would be locked out of her profile for a day by a number chosen to bound a one-off. 10/day is the
  shape `sendOffer` and `reportOffer` already use._ One Account holds at most one CapabilityProfile, by
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
  the month's Sentry error quota. **And the same holds for every not-found** (C51), which is the other
  half of the finding this half came from: **0** of the surfaces that answer `404` — the five in the UX
  state table plus C22's frozen caller at `GET /profile/[slug]` — reach `onRequestError`. A not-found
  is a **returned** response carrying a `warn` line, never a thrown error, which is DD11's "thrown is
  reported; returned is logged" applied to the case the advisory named. An unauthenticated enumeration
  sweep of `/profile/[slug]` is otherwise the cheapest way there is to spend a 5,000-error monthly
  allowance in a day and make the second real incident of the month invisible.
  **Third half, which the second was missing (C39): a refusal is legible to the person who hit it.**
  Every ceiling returns an `AppError` carrying `code: "rate_limited"`, a **`retryAfter`**, and a
  `userMessage` in her terms, and every surface with a ceiling carries a rate-limited state in the UX
  state table — **all nine ceilings, checked as a list against that table rather than by eye** (C57).
  _Amended 2026-09-02 with #139: eight became nine. The count is written out because C57 made this a
  list somebody ticks, and a ceiling added without its seventh state is the exact defect C57 closed._
  A Worker who trips `publishProfile ≤ 3/day` after two failed attempts must not be stopped by
  silence. **Binds:** 16, 2, 6, 10, 24.
- **NFR27 — Sign-in actually completes.** **≥ 70%** of `requestMagicLink` calls are followed by a
  completed sign-in within 30 minutes, rolling 7 days; a **drop of > 20 points** against the trailing
  30-day value is the actionable signal. This replaces a bounce-rate-only indicator, which goes green
  while a new sending domain lands in Colombian spam folders — accepted, not bounced, never read —
  and the email door is the fragile one. It measures **that door specifically** — a Google sign-in
  never touches email — so it is a health check on the path most likely to fail silently rather than a
  measure of sign-in overall. Hard bounces **≤ 2%** and **spam complaints ≤ 0.1%**
  remain as secondaries — a complaint is more damaging than a bounce to a single-domain sender, and the
  draft tracked neither. Costs two id-only `info` lines, so NFR18 is untouched. **Binds:** 1, 21.
- **NFR28 — The announcement has an operational leg.** Before anyone is told the site exists: the log
  drain is collecting, the uptime monitor is **probing `/api/health` every 60 s and alerting after 2
  consecutive failures** (C33 — with nobody on call, detection latency is the entire mitigation), a
  rollback has been
  rehearsed once against production, the domain is a Cloudflare zone with **transformations enabled**
  (DD6 — a dashboard step, and photos serve at full size until it is done), and a load test shows NFR2
  held at its stated concurrency. **NFR2's client-side number is measured here too** (C50, runbook
  §11) — from a real Colombian connection rather than from the machine, because it is the only number
  in this spec whose instrument is a person with a stopwatch.
  **Two email preconditions, because the announcement is the spike and the magic link is the only door
  (DD14):** SPF, DKIM and DMARC resolve for the sending subdomain — verified with `dig`, not assumed —
  and the domain has been **warmed** to a daily volume that covers the announcement's expected sign-ups.
  A cold domain caps at 50–100 sends a day in its first week, 200–500 in its second.
  **Warming starts at the first deploy, not at the announcement** (C45): every ticket's test sends
  count toward the curve, the announcement is **staged** so volume tracks it, and a **pre-warmed
  fallback subdomain** is held so a reputation problem is a DNS change rather than a rebuild. The
  measured check into real Colombian Gmail and Hotmail inboxes is a numbered go-live runbook step and
  does **not** gate the announcement — a decision taken knowingly at C45, whose risk is that the check
  most likely to be ticked without being done is the one whose failure is silent.
  **Binds:** 15, and gates every `Must`.

- **NFR29 — Spanish is the interface; English is the code.** **0** Spanish-language identifiers appear
  anywhere a developer types a name: route segments, file and directory names, database tables and
  columns, enum values, query parameters, API request and response field names, log `event` names,
  test names, branch names. The one permitted appearance of Spanish outside a rendered string is a
  **value** — `Skill.labelEs` holds Spanish, and its column name does not.
  **Second half — and it is the half that matters here:** this constrains identifiers only. Every
  string a person reads stays `es-CO` (`docs/policy/ux.md` → `locales`), and a surface that became
  less Spanish to satisfy this requirement has failed it, not met it. See
  [ADR-0012](../../adr/0012-spanish-is-the-interface-english-is-the-code.md).
  **Binds:** 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 20, 21, 24.

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

- **NFR31 — The only impact evidence that exists is measured, or it is an anecdote.** Every Contact
  Exchange schedules a check-in to **both** sides at seven days: **100%** scheduled, **send success
  measured**, and any figure published from the responses carries its **response rate** alongside
  [ADR-0007](../../adr/0007-the-platform-never-handles-money.md)'s self-reporting qualification.
  Without those two numbers a published impact figure has an unknown denominator on top of a known
  weakness, which is close to unusable.
  **Second half — when it is built.** This provably cannot be needed until seven days after the
  **first** Contact Exchange, so it sits outside the announcement gate; the deadline is real
  (first exchange + 7 days) rather than a backlog position. **Binds:** 18.

- **NFR32 — Availability, and the deploy arithmetic behind it.** **99.5% monthly** on `/` and
  `/profiles`, measured by the external uptime monitor rather than server-side — a machine that is
  down measures nothing. This is settleable only because DD10's bluegreen is: without it, ~30 s of
  boot at ~10 deploys a day spends ~0.35% on deploys alone and caps the achievable figure at ~99.65%.
  Above **50%** of the 30-day budget, deploys are limited to fixes and cadence drops to once daily
  until the trailing window recovers (C11). **Binds:** 15.

- **NFR33 — Every Admin action is auditable, and the audit cannot be skipped.** **100%** of the
  eleven `/admin` actions write an `AdminAction` row **in the same transaction as the action itself**,
  so **0** of them can commit unaudited — asserted by a table-driven test over the action registry
  (the same registry seam 3's authorization table already enumerates, C38), which is red for an action
  added without one. The row carries **actor, action, target id, timestamp — ids and enum values only**
  and **0** sentinels from NFR10's set, because an audit table that accumulates personal data is a
  second copy of the thing NFR11 counts. It is retained **24 months**, matching a Report rather than a
  log line, since logs live 30 days and the incident it reconstructs may not surface for a year.
  **Binds:** 23.
- **NFR34 — The repository describes the product, not the template it came from.** **0** rows remain
  unresolved in `README.md`'s "Placeholders to change" table; `PRODUCT.md` names Recomencemos and the
  three municipalities; **0** statements in `CLAUDE.md` instruct a reader to judge a change by whether
  it improves a template. The check is a reading, not a script — but the counts are what make it one
  a reviewer can tick, and this story exists because a future agent inheriting the template's judging
  criterion will apply it to product code. **Binds:** 22.

Both availability numbers above were concerns rather than requirements in the draft — C9 and C42 —
because each depended on a decision this spec had not yet taken. They are requirements now that it
has. **NFR33 and NFR34 were added while resolving C54**: every NFR carried a non-empty `Binds:` and
every story it named existed, but stories 22 and 23 were bound by nothing — story 23 having been
promoted into the announcement gate by C25 in the same round that C42 closed the identical gap one
story over.

## Core entities

Vocabulary is `CONTEXT.md`'s and is binding. Entities named here for the first time belong in
`CONTEXT.md` by the end of this effort.

**Account** — one identity keyed by email (`citext`, unique, `personal`). Not typed at sign-up: it
becomes a Worker by holding a CapabilityProfile and a Hirer by having sent an Offer, exactly as
`CONTEXT.md` says. **`hirerName` and `hirerPhone`, both `personal`, are collected at first Offer send**
(C4) and are self-asserted — nothing verifies either, and every surface rendering them says so. **Admin** is the exception — a grant, because it is conferred rather than earned,
and the first one is made by a documented manual `UPDATE` (DD7). Carries `emailStatus`,
`offerSendingState` (`active` | `frozen` | `banned`), `lastSignInAt`. Holds **0..1** CapabilityProfile
by unique constraint, not by the form — that constraint is half of NFR26's Sybil answer.

**CapabilityProfile** — 1:1 with an Account. `slug` (opaque, NFR9), `fullName`, `firstName`, `lastInitial`,
`city`, `headline`, `about`, `phone` (E.164), `photoState`, `photoKey`, `state`
(`published` | `taken_down`), `publishedAt`, `updatedAt`, `deliveredOfferCount`, `rotationKey`,
`searchText`. _Amended 2026-09-02 with #139: `updatedAt` was missing from this list while the column
existed, which is what let story 24's write have no field to stamp. `publishedAt` and `updatedAt` are
two columns for one reason — only the first is indexed, and only the first orders the Wall._
`firstName`, `lastInitial`, `city`, `headline` and an **approved** photo are `public`; `fullName`,
`about`, `phone` and the Account's `email` are `personal`. **`fullName` is collected at publish and
released only at Contact Exchange** (C1) — prefilled and editable from a Google profile, typed by a
magic-link Worker, so both doors produce the same exchange. It is absent from `PublicProfile` **and**
from `GatedProfile`, which preserves the stricter reading of
[ADR-0009](../../adr/0009-a-workers-full-identity-is-gated-and-never-indexed.md) exactly: the ADR
governs the moment identity _crosses_, not the moment it is collected. **`photoKey` is `personal` always** — the public URL
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
(`accepted` | `declined` | `expired`), with `rejected_by_admin` and `reported` as terminal branches,
and **`on_hold`** on the `pending_review` branch for an Offer whose sender is frozen (C22) — held
rather than rejected, so clearing the Report releases it.
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
account id supplied by a browser. What it reaches is bounded, stated, and **narrower than the draft
had it** (C3): **he cannot send her anything, and that is all**. It does not remove her from the
public Wall — the Wall is public and cannot be selectively invisible — and it does not close his
gated read of her profile either. One rule, explainable to a Worker in one sentence, instead of a
protection that is partial in two different ways. Her phone and email are untouched: those cross only
at Contact Exchange, which he can no longer reach.

**Consent** — notice version, _autorización_ version, **international-transmission acknowledgement**
(C15), timestamp. **Purged with the Account it authorizes** (C19): story 13 promises deletion reaches
everything, and a retained proof row — even reduced to a hash — is a record she was told did not
survive. Written for the **Worker** at publish
and for the **Hirer** at first Offer send. The platform collects and then discloses his name, phone
and email too, and the draft had him consenting to nothing.

**MonthlyMetric** — what a ContactExchange reduces to at twelve months, and what NFR11's deletion path
leaves behind (C18). `month`, `exchanges`, `checkInsAnswered`, `workHappened`, `wasPaid`. All
`internal`, because no dimension survives that can narrow toward a person. Written by the reduction,
never by a request.

**RateCounter** — per principal, per action, per window. Boring, and NFR26 rests on it.

**AdminAction** — actor, action, target id, timestamp; ids and enum values only. A table rather than
log lines, because NFR18 forbids the payload on a line and NFR17 gives logs 30 days while a Report
lives 24 months. Story 23, **`Must`** (C25) — the insert shares the transaction of the action it
records, so an action cannot commit unaudited.

**Session** and **Verification** are Better Auth's, and both are classified **`secret`** (C28): the
value never reaches a log line, a Sentry event, or the subject-access export — handing a _titular_ her
own session token is a credential disclosure, not habeas data. Their retention is in NFR17. The shared-device flag is carried through Better
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

| Surface                                 | What it is                                      | Shape                                                              | Who may call                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /`                                 | Server Component. Newest published profiles     | `PublicProfile[]`                                                  | Anyone. Indexable                                                                                                                                                                                                                                                                                                                                                                         |
| `GET /profiles`                         | Server Component. Fewest delivered Offers first | `PublicProfile[]`, keyset-paginated                                | Anyone. Indexable                                                                                                                                                                                                                                                                                                                                                                         |
| `GET /sign-in`                          | Server Component + one Client Component         | —                                                                  | Anyone **without a session**. _Amended 2026-08-30 with #96: a request carrying a live session is redirected — to its `returnPath` when safe, else `/`. A signed-in person looking at a sign-in form is being asked to solve a problem they do not have_                                                                                                                                   |
| action `requestMagicLink`               | Server Action                                   | `{ email, sharedDevice, returnPath? }` → `{ ok: true }` **always** | Anyone. Rate-limited. `returnPath` must be a single-leading-slash relative path; `//host` and `/\host` rejected. _Amended 2026-08-30 with #96: an address holding the Admin grant is sent an **Admin** link instead of a magic link. The response, the copy, the status and the timing are identical, which is what leaves the surface saying nothing about which address is the Admin's_ |
| `GET /api/auth/sign-in/social` (Google) | Route Handler (Better Auth)                     | its own; PKCE automatic                                            | Anyone **except** an Admin-granted account (NFR14). Links to an existing Account only on a **verified** email match (DD5). Provider tokens are not stored                                                                                                                                                                                                                                 |
| `GET /api/auth/*`                       | Route Handler (Better Auth)                     | its own                                                            | Anyone. `trustedOrigins` set explicitly. Token is a **query** parameter, single-use, TTL in DD5                                                                                                                                                                                                                                                                                           |
| `GET /api/health`                       | Route Handler                                   | `200`, empty, after a trivial DB round trip, in **≤ 50 ms**        | The deploy health gate and the uptime monitor. `noindex`, returns no data                                                                                                                                                                                                                                                                                                                 |
| `GET /robots.txt`, `/sitemap.xml`       | Route Handlers                                  | —                                                                  | Anyone. The sitemap lists `/` and `/profiles` and **no** profile                                                                                                                                                                                                                                                                                                                          |

### Worker — Account required, `noindex`

| Surface                                                 | Shape                                                                                                                                                                                                          | Who may call                                                                                                                                                                                                               |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /publish`                                          | —                                                                                                                                                                                                              | Signed-in Account with no CapabilityProfile                                                                                                                                                                                |
| action `publishProfile`                                 | `{ fullName, firstName, lastInitial, city, headline, about, phone, skillSlugs[], workHistory[], consentVersion }` → `{ ok } \| { fieldErrors }`. `fullName` is gated at rest and crosses only at exchange (C1) | Itself only                                                                                                                                                                                                                |
| action `updateProfile`                                  | `publishProfile`'s field set **minus `consentVersion`** → `{ ok } \| { fieldErrors }`. Rewrites `searchText` and `updatedAt`; `slug` and `publishedAt` untouched. Added 2026-09-02 with #139 — see below       | The owner. Rate-limited (NFR26)                                                                                                                                                                                            |
| action `createPhotoUpload`                              | `{ contentType, byteLength }` → `{ uploadUrl, photoKey }`, a presigned PUT into a quarantine prefix                                                                                                            | The owner. **Not** a multipart Server Action — the body limit defaults to 1 MB and a phone photo is 2–5 MB (DD6)                                                                                                           |
| action `attachPhoto`                                    | `{ photoKey }` → `{ photoState: "pending" }`                                                                                                                                                                   | The owner                                                                                                                                                                                                                  |
| action `requestSkill`                                   | `{ text }` → `{ ok }`                                                                                                                                                                                          | The owner                                                                                                                                                                                                                  |
| `GET /my-profile`                                       | `OwnProfile` — the gated shape plus her own photo whatever its state                                                                                                                                           | The owner                                                                                                                                                                                                                  |
| `GET /offers`, `GET /offers/[id]`                       | `ReceivedOffer[]`, `ReceivedOffer`                                                                                                                                                                             | The owner, scoped by profile ownership                                                                                                                                                                                     |
| action `acceptOffer`                                    | `{ offerId, confirmed: true }` → `{ exchange }`                                                                                                                                                                | The addressee. Two-step: the confirmation names which details cross and that it is irreversible                                                                                                                            |
| actions `declineOffer`, `reportOffer`, `blockFromOffer` | `{ offerId, reason? }` → `{ ok }`                                                                                                                                                                              | Same. `blockFromOffer` takes the **Offer** id, so Hirer account ids never cross to a browser                                                                                                                               |
| action `signOutEverywhere`                              | `{}` → `{ ok }`                                                                                                                                                                                                | Itself                                                                                                                                                                                                                     |
| action `changeEmail`                                    | `{ email }` → `{ ok: "verification_sent" }`                                                                                                                                                                    | Itself. **Two-phase**: the new address is verified before the switch, the old address is notified, and all other sessions end on completion. A one-shot switch is an account-takeover primitive from any abandoned session |
| action `deleteAccount`                                  | `{ confirmationPhrase }` → `{ ok }`                                                                                                                                                                            | Itself, and only from a **fresh** sign-in                                                                                                                                                                                  |

_Added 2026-09-02 with #139, on `updateProfile`._ Three things about that row are load-bearing and do
not fit in a table cell. **The DD3 rejector runs again**, on every edited free-text field, exactly as
it does at publish — a field checked once and never again is a field with a documented way past the
consent step. **`searchText` is rewritten** because DD4 already says it is written "on publish and on
edit", and this is the edit. **`publishedAt` is not stamped**, because it orders the Wall and an edit
that stamped it would be a free bump to the top of the site's most-linked surface — the argument, and
what it costs story 20's fairness measurement to get wrong, is in **Further Notes**.

### Hirer — Account required, `noindex`

| Surface               | Shape                                                                                                                                                                                                                   | Who may call                                                                                                                                                                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /profile/[slug]` | `GatedProfile`                                                                                                                                                                                                          | Any signed-in Account **whose `offerSendingState` is `active`**. Charged against NFR26's read ceiling. A frozen caller gets the same response as a missing profile (C22). **A Blocked caller is served normally** — a Block reaches the send only (C3) |
| action `sendOffer`    | `{ profileSlug, hirerName, hirerPhone, workDescription, payTerms, whenText, consentVersion }` → `{ ok } \| { fieldErrors }`. The two identity fields are collected once, on the first Offer, and stored on Account (C4) | Signed-in Account whose `offerSendingState` is read **from the row under a lock**, never from the session, and who is not Blocked                                                                                                                      |
| `GET /sent-offers`    | `SentOffer[]` — state only; no contact details unless exchanged. Carries the derived `reviewDelayed` (C41)                                                                                                              | The sender                                                                                                                                                                                                                                             |

### Admin — an emailed link **and** TOTP on the session itself

_Amended 2026-08-30 with #96: this read "password **and** TOTP". The Admin door has no password; the
argument is at DD5, **The Admin door is passwordless**._

**The door.** There is no `/admin/sign-in`: the request for a link is made at the public `/sign-in`,
which answers identically whichever kind of address it was given. What is listed here is where an
Admin link **lands**, and both landing routes are reachable only with a token.

| Surface                    | What it is                                                 | Shape                                                                                                                                              | Who may call                                                                                                                                                                                                                                     |
| -------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /admin/continue`      | Server Component. Consumes the link, mints **no** session  | Sets a short-lived signed challenge carrying the Account id and nothing else, then renders the code field                                          | Anyone holding an unspent, unexpired Admin token. Expired, spent, unknown or malformed → **404**, never a legible refusal: this route's error copy is an oracle for which tokens existed. A caller who already holds an Admin session → `/admin` |
| action `verifyAdminCode`   | Server Action                                              | `{ code }` → `{ ok }` \| `{ error }`. Six TOTP digits or one of the ten backup codes, told apart by length rather than by a field the caller picks | A caller holding a valid challenge. **Bounded per Account** by an NFR26 ceiling, not per IP (DD5). A backup code is consumed on use. On success the session is created and stamped `link_totp`                                                   |
| `GET /admin/enrol/[token]` | Server Component. The setup link `pnpm admin:enrol` prints | The TOTP QR and the ten backup codes, rendered **once**                                                                                            | Anyone holding an unspent, unexpired setup token; same 404 rule. The grant is **not** set here — the CLI sets it after verifying a code, so a link opened and abandoned leaves no Admin behind                                                   |

**The queue.** Every row below refuses with NFR14's 403 — returned, not redirected, and one answer for
every caller that is not an authenticated Admin.

| Surface                                                                                                                                                                                 | Shape                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Who may call                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `GET /admin`                                                                                                                                                                            | _Amended 2026-08-30 with #96: this was one page holding all five sources. Shape settled a **`sidebar` shell with one route per concern**, so this row is now a redirect and the five below it are the work._ The gate runs **before** the redirect, so an unauthenticated caller meets the 403 here and never learns the section routes exist. Redirects to `/admin/offers`, which leads because it is the only source with a deadline — NFR7's band is per Offer                                  | An Admin **session** (NFR14)                                                                    |
| `GET /admin/offers`, `/admin/photos`, `/admin/reports`, `/admin/skills`, `/admin/hirers`                                                                                                | One source each, rendered **in full so nothing is approved unread**. Each branch is `LIMIT`-capped for display while its **count and age-of-oldest are computed over the whole branch** (C55). The **shell** carries the age of the oldest item anywhere plus a per-section count, which is load-bearing rather than decorative: with five routes and no landing page, the oldest Offer would otherwise hide behind a nav item nobody clicked. Segments are English, labels are Spanish (ADR-0012) | An Admin session (NFR14), enforced once at the shell                                            |
| The four signals                                                                                                                                                                        | **Not queue items and never actionable.** Split by scope: the publish rate above 10/hour (C24) is about the platform and sits in the shell; the duplicate-phone flag (C30), a profile filing more than 3 Reports in 7 days (C49), and a profile completing more than 5 Contact Exchanges with distinct Hirers in 7 days (C47) are about one profile and ride on that profile's rows, where the decision is made. **Exactly four.** A fifth is a spec amendment                                     | Rendered wherever an Admin session already is                                                   |
| actions `deliverOffer`, `rejectOffer`, `approvePhoto`, `rejectPhoto`, `resolveReport`, `unfreezeHirer`, `banHirer`, `promoteSkill`, `declineSkill`, `takeDownProfile`, `revokeSessions` | `{ id, ... }` → `{ ok }`. `unfreezeHirer` releases his `on_hold` Offers and restores his gated reads (C22)                                                                                                                                                                                                                                                                                                                                                                                         | An Admin session, each re-checking, each writing an `AdminAction` in the same transaction (C25) |

### Webhook

`POST /api/webhooks/resend` — signature-verified with a timestamp window against replay, idempotent
on the event id, bodyless `401` on failure, and **one `info` line on every rejection carrying the
event id and an enum reason — `bad_signature`, `stale_timestamp`, `replayed_id` — and nothing from
the body** (C27).

### Scheduled jobs — Trigger.dev calls in; it never reads the database

Four Route Handlers, **not** Server Actions: a Server Action is reached by a browser and these are
reached by a scheduler, and conflating the two would put a job behind session authorization it can
never present. Each is `noindex`, returns **`204` with no body**, and authorizes on a shared secret
compared in constant time plus a timestamp window against replay — the Resend webhook's discipline,
applied to the other direction of the same problem.

| Endpoint                      | Cron (UTC unless stated)       | What it does                                                        | Bound per invocation                   |
| ----------------------------- | ------------------------------ | ------------------------------------------------------------------- | -------------------------------------- |
| `POST /api/jobs/rotation-key` | `0 3 * * *`                    | Rewrites the stored `rotationKey`, NFR22's ordering input           | Whole published set; one `UPDATE`      |
| `POST /api/jobs/offer-expiry` | `0 * * * *`                    | Expires delivered Offers past their window                          | **≤ 500 Offers**, oldest first         |
| `POST /api/jobs/check-ins`    | `0 9 * * *`                    | Sends the seven-day check-ins (NFR31)                               | **≤ 200 sends**, oldest exchange first |
| `POST /api/jobs/queue-digest` | `0 8 * * *` **America/Bogotá** | C10's daily digest of NFR7's queue depths and the age of the oldest | One send                               |

**Every one is idempotent**, because Trigger.dev retries: a second call inside the same window
completes and changes nothing. **Every one is bounded**, and the second half of that bound is
stated — a capped run does the oldest work first and **leaves the rest for the next tick**, so the
cap delays work and never drops it. A run that hits its cap emits one `info` line saying so, which is
how a backlog that outgrows the cadence becomes visible instead of silently permanent.

A rejected call is logged exactly as C27's webhook rejection is — `event: "job_rejected"`, the job
name and an enum reason, nothing else — and returns a bodyless `401`. A forged bounce is an account-denial primitive, because
magic link is the only sign-in.

### Cross-boundary types

**Membership means: exactly these keys are present on the wire, and adding a field to the entity
reaches none of them until someone writes it into one.**

- **`PublicProfile`** — `slug`, `firstName`, `lastInitial`, `city`, `headline`, `skills[]`,
  `photoUrl | null`, `publishedAt`.
- **`GatedProfile`** — every `PublicProfile` key, plus `about`, `workHistory[]`. **Not `fullName`**,
  which is collected at publish and withheld until exchange (C1).
- **`ExchangedContact`** — `fullName`, `phone`, `email`, and the counterpart's same three. Reachable
  only from a ContactExchange row. The Hirer's three are **self-asserted** and are rendered as such
  (C4).
- **`ReceivedOffer` / `SentOffer`** — `id`, `state`, `workDescription`, `payTerms`, `whenText`,
  `sentAt`, plus the counterpart's `PublicProfile`-shaped identity and nothing more until exchange.
  `ReceivedOffer` additionally carries **`hirerName`**, badged as declared rather than verified, so
  she judges knowing who claims to be asking (C4). `SentOffer` additionally carries
  **`reviewDelayed`**, derived from `deliveredAt IS NULL AND sentAt < now() - interval '24 hours'` —
  a projection, not a stored state, and English like every other identifier (C41, ADR-0012).

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
| `@repo/design-system`                             | existing                                                                                                                                                                             | Only genuinely reusable primitives. `PublicProfileCard`, the Skill picker and the two standing notices are **product** and live in `apps/web`                                                                                                                                                                                                                                                                                   |
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
anonymous caller to `/sign-in` with a validated return path, checks that the caller is `active`,
charges the read against NFR26's ceiling, and renders `GatedProfile` dynamically. A **frozen** caller —
one with an open Report against him — gets exactly the missing-profile response (C22). A **Blocked**
caller is served normally: C3 narrowed a Block to the send, so the Block edge is checked at `sendOffer`
and not here.

**Story 6 — send an Offer.** `sendOffer` **[trust]** authorizes, rate-limits, takes a row lock on the
Hirer's Account, re-reads `offerSendingState` and the Block edge under it, runs the rejector, and
writes an immutable Offer in `pending_review` plus the Hirer Consent row — and, on his **first** Offer,
his self-asserted `hirerName` and `hirerPhone` onto the Account (C4). Nothing is delivered. The
confirmation says a person reads it first, that this usually takes under a day, and that he cannot
change it.

**Story 7 — the queue.** `/admin` unions five sources — plus the four signals that inform rather
than queue (C24's publish rate, C30's duplicate phone, C49's Report rate, C47's exchange rate) — each
served by a **partial index** on its pending predicate, so the age-of-oldest is an index-only scan over
a handful of rows rather than five sequential scans that grow with total table size forever. Each
branch is `LIMIT`-capped — an unbounded union after three days away is exactly when the surface needs
to still load — and **the cap bounds the rows rendered, never the numbers read off them** (C55): the
count and the age-of-oldest per branch come from a separate `COUNT(*)` / `MIN(created_at)` over the
**whole** predicate, on the same partial index. A page capped at 50 that reported a depth of 50 would
be an instrument that goes green exactly when the backlog is worst, and NFR7's band and story 7's
age-on-every-screen are both read off that number. Every action re-checks
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

**One deep dive was added while resolving the flagged concerns**: DD16 (trust boundaries and a STRIDE
walk over the three outbound ones, C21). It answers a gap in the design rather than an unmet NFR,
which is why it sits last.

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

`pk-strategy` is **`BIGINT GENERATED ALWAYS AS IDENTITY` by default, and a UUIDv7 only where an id
reaches a URL or a browser.** The draft made every key a UUID; the `planetscale:postgres`
guidance is the other way round and it is right — a UUID is 16 bytes against 8, it widens every index
and every foreign key that references it, and it slows joins. The exception earns itself on one
table rather than on all of them:

- **`Offer.id` is a UUIDv7**, because `/offers/[id]` puts it in a URL. A `BIGINT IDENTITY` there
  publishes the platform's total Offer count to every Hirer on his first Offer and hands an
  enumerator a clean `/offers/1..N` sweep. Authorization stops the read; it does not stop the
  existence oracle.
- **Everything else is `BIGINT IDENTITY`.** `CapabilityProfile` in particular: its public handle is
  the opaque `slug` (NFR9), so its primary key never crosses a boundary and has no reason to be wide.
- **Better Auth owns the shape of its own tables** — `account`, `session`, `verification` — and this
  spec does not override it. That is a third id convention in one schema, and naming it here is
  cheaper than discovering it at Build.
- **Pure join tables** (`ProfileSkill`) take a composite natural PK and no surrogate at all.

**The v7 value is generated in the application by `uuid@14.0.2`'s `v7()`, not by the database and
never by hand.** Postgres 18 ships a native `uuidv7()` and the draft reached for it; app-side
generation is better here for three reasons. The id exists **before** the insert, which DD9's
transactions need — an Offer is written and then referenced in the same transaction, and a column
default would force a `RETURNING` round trip to learn the value. It removes a **version dependency**:
`uuidv7()` is Postgres 18 only, and while PGlite 18.3 and PlanetScale 18.4 happen to agree today, that
is an alignment being relied on rather than a guarantee. And it is what Drizzle expects —
`.$defaultFn(() => v7())` — so the schema declares it in one place.

A column `DEFAULT uuidv7()` was considered as a backstop for rows inserted outside the application and
**dropped**: under [ADR-0010](../../adr/0010-the-domain-package-is-the-only-door-to-the-database.md)
there is no such path, the Skill seed migration writes `BIGINT` keys, and a default that never fires
in normal operation while silently depending on a server version is more moving parts than it earns.

`uuid@14.0.2` declares **no** `engines` field, so it satisfies NFR23. Writing a v7 generator by hand
is out of the question — the monotonicity and clock-regression rules are exactly the kind of thing
that looks right and produces colliding or non-ordered keys under load.

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
| Duplicate-phone signal      | `capability_profile (phone)`, **non-unique** — a moderation signal, never a constraint (C30)              |
| `signOutEverywhere`         | `session (account_id)` — Better Auth may not create it                                                    |

**The phone index is a signal and not a gate** (C30). Families and shared households genuinely share
one handset, and [ADR-0008](../../adr/0008-open-enrolment-with-published-non-verification.md) declined
verification deliberately, so the Admin queue reads "N profiles share this number" and refuses nobody.
It is also the only Sybil signal available at all on a platform whose single trust control is the
moderation queue.

**The connection pool is capped at 10 per machine** (C35), `min` 0 — every cold start reopens it
anyway (DD10) — and a connect timeout surfaces as an `AppError` rather than a hung request. One
machine and one pool puts 10 well inside any PlanetScale plan ceiling and well above what a single
Node process serving this traffic needs. The **plan's actual limit** is what remains unverified, and
it is a numbered go-live runbook check rather than an assumption.

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

Read against `better-auth@1.7.1`'s own guidance rather than recalled. Every setting below is
**not a default** — each is either off, memory-backed, or pointed at the wrong thing until set, and
three of them would ship as security holes rather than as rough edges.

_Amended 2026-08-30 with #96: the four `emailAndPassword` rows and the `twoFactor` row are gone, and
the two rows that replace them record their **absence** rather than their value. The argument is at
**The Admin door is passwordless** below._

| Setting                                       | Value here                             | Why it is not the default                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rateLimit.storage`                           | `"database"`                           | Defaults to memory; deploys are continuous, so the limiter resets several times a day (NFR26)                                                                                                                                                                                                                                                                                                                        |
| `rateLimit.customRules`                       | explicit on the magic-link paths       | Inheriting "3 per 10 s" leaves the doors into this system on a default. _Amended 2026-08-30 with #96: the 2FA paths are no longer Better Auth's, so the code attempt's bound is an NFR26 ceiling instead — and it has to be, because the plugin's per-account lockout went with the plugin_                                                                                                                          |
| `advanced.ipAddress.ipAddressHeaders`         | `["fly-client-ip", "x-forwarded-for"]` | Fly proxies every request; unset, every per-IP ceiling becomes one global ceiling. _Amended with #12: 1.7.1 trusts a forwarded header only when it holds one entry, and Fly appends to a caller-sent `x-forwarded-for` — so that header alone collapses to a shared bucket exactly when a caller wants it to; `fly-client-ip` is proxy-set and single-value_                                                         |
| `session.cookieCache`                         | **disabled**                           | Enabled, every revocation in NFR13 and NFR15's zero lag by its TTL                                                                                                                                                                                                                                                                                                                                                   |
| `session.expiresIn` / `disableSessionRefresh` | 30-day fallback; refresh **refused**   | Defaults are 7 days rolling for everyone. _Amended with #12: the per-device lifetime is written on the row by `session.create.before`, and the refresh predicate reads the configured `expiresIn` rather than the row — so the refresh must be refused or a shared-device row is promoted to 30 days on its first read (NFR13). `updateAge` has no remaining reader_                                                 |
| `session.additionalFields`                    | records the sign-in method             | NFR14's mechanism; there is no built-in equivalent                                                                                                                                                                                                                                                                                                                                                                   |
| `user.changeEmail.enabled`                    | `true`                                 | **Disabled by default** — the contract's `changeEmail` silently does nothing otherwise                                                                                                                                                                                                                                                                                                                               |
| `user.deleteUser.enabled`                     | `true`                                 | **Disabled by default** — same for story 13, which is a Ley 1581 surface                                                                                                                                                                                                                                                                                                                                             |
| `emailAndPassword`                            | **absent**                             | _Amended 2026-08-30 with #96._ Enabling it opens `/sign-up/email` alongside `/sign-in/email`, and the only account that ever wanted a password no longer has one. Absent, there is no credential door to close with `disableSignUp`, no 16-character floor to justify, no reset flow to revoke sessions on, and no `/sign-in/email` ceiling to choose a number for — four rows of this table replaced by one absence |
| `twoFactor` plugin                            | **absent**                             | _Amended 2026-08-30 with #96._ Its sign-in interception matches `/sign-in/email`, `/sign-in/username` and `/sign-in/phone-number` only (read out of `two-factor/index.mjs` at 1.7.1), so it can never challenge the Admin door. TOTP is ours, built on `@better-auth/utils/otp` and `better-auth/crypto` — the same two primitives the plugin itself calls. `trustDevice` is not disabled, it does not exist (C44)   |

**Trusted devices do not exist** (C44, _amended 2026-08-30 with #96_). They were `trustDevice: false`
while the second factor was Better Auth's; with the plugin gone there is no such option to set, and the
Admin door has no notion of a remembered device to build one from. The conclusion is unchanged and now
carried by an absence rather than by a flag somebody could flip: **TOTP is entered on every Admin
sign-in**. Moderating daily costs six digits once a day, which is the right price for the account that
can take down a profile and read every exchanged phone number.

**The schema is pinned to the installed library, not generated** (C29, amended 2026-08-28 with #12).
This read "the schema is generated", and Build showed the generator cannot be the mechanism: a
version-matched CLI exists and was run, but its pg type map hardcodes `timestamp` and `text` where
DD2 requires `TIMESTAMPTZ` and `citext`, and it has no concept of a `CHECK` — so generated output
would need hand-editing on every regeneration, the exact failure the "never hand-edit" rule exists
to prevent. The schema is therefore written by hand in `auth-schema.ts`, and `auth-schema.test.ts`
pins it to `getSchema()` from the **installed** `better-auth/db` on fields, nullability in both
directions, uniqueness, every declared index, and the deliberate deviations as data. The three rules
survive, sharper:

1. **A hand-added column fails CI** rather than being dropped by a regeneration: it is not in
   `getSchema()`'s answer.
2. **A plugin added without its tables fails CI** — the common Better Auth mistake, caught by a red
   test rather than by somebody remembering to re-run a CLI.
3. An upgrade touching Better Auth's own tables fails the pin on the version bump and produces an
   ordinary Drizzle migration, reviewed under the expand/contract rule like any other (NFR30).

#### The Admin door is passwordless (amended 2026-08-30 with #96)

**What this replaces.** The Admin's door was a 16-character password followed by TOTP, served from
`/admin/sign-in`, with the second factor supplied by Better Auth's `twoFactor` plugin. Three things
were wrong with it, and only the third was known when it was designed.

**1. The door announced itself.** `/admin/sign-in` answered **200** with a password form to any
anonymous caller, while NFR14 spent its whole mechanism on answering 403 rather than redirecting
_"because a redirect tells an unauthenticated caller that the route exists and is worth attacking"_.
The refusal copy went further and named the route, both factors, and — by firing only for one
address — which account holds the grant. A door that is bookmarkable is enumerable; no wording fixes
that, so the door is gone rather than reworded.

**2. The second factor was coupled to a credential this product otherwise refuses.** Enabling
`emailAndPassword` for one account enabled `/sign-up/email` with it, which is why `disableSignUp`,
`requireEmailVerification`, `revokeSessionsOnPasswordReset` and a 16-character floor all existed — four
settings whose entire job was to make a door safe that only one person was ever meant to open. None of
them is needed once there is no password.

**3. The plugin was never going to reach the Admin door anyway.** Its sign-in interception matches
`/sign-in/email`, `/sign-in/username` and `/sign-in/phone-number` and nothing else — read out of
`two-factor/index.mjs` at 1.7.1. That is the same finding as the "hole that is easy to miss" this
paragraph replaces, stated as its cause rather than as its symptom: the plugin does not challenge
magic-link sign-in because it does not challenge anything that is not a credential path. Any
passwordless first factor puts the challenge in our hands. Accepting that is what the amendment does.

**The door, in four steps.** Nothing about it is a second route to guard:

1. **One public door.** `/sign-in` takes an address. If it holds the Admin grant the email carries an
   Admin link; otherwise it carries an ordinary magic link. Copy, shape, status and timing are
   identical, and the action answers `{ ok: true }` **always**, exactly as it already does — so the
   surface says nothing about which addresses exist, and nothing about which one is the Admin's. There
   is no `/admin/sign-in` left to find.
2. **The link mints no session.** Its token is single-use and hashed at rest (the rule already in force
   for the magic link, C28), and consuming it sets a short-lived signed **challenge** carrying the
   Account id and nothing else. A token that is expired, spent or unknown answers **404**, not an
   error — a legible refusal here is an oracle.
3. **The code is the second factor.** Six digits from the authenticator, or one of the ten backup
   codes. Only now does a session exist, and `session.create.before` stamps it `link_totp`.
4. **`requireAdmin` reads the stamp**, unchanged. NFR14's rule is a comparison against one method, and
   the amendment changes which string it compares to.

**Two possession factors, and that is the whole security argument.** The mailbox and the authenticator
are separate channels held on separate credentials, so compromising one yields nothing. The password
it replaces was a single reusable secret that had to live somewhere — a manager, a note, a shell
history — and be typed on whichever machine was to hand. **This is not the emailed-OTP design DD5
rejects.** That objection was _"an emailed OTP would put the second factor in the same inbox the magic
link already reaches, so a compromised inbox would hold both factors"_, and it still stands: the
mailbox is factor **one** here, and the factor it is paired with is never sent to it.

**What we now own, stated as cost rather than skipped.** Three things the plugin was doing:

- **The TOTP secret and the ten backup codes at rest.** `better-auth/crypto`'s `symmetricEncrypt` /
  `symmetricDecrypt`, keyed on `BETTER_AUTH_SECRET` — the same primitive and the same key the plugin
  used, so the standing hazard below is unchanged rather than newly introduced.
- **Verification.** `@better-auth/utils/otp`'s `createOTP(secret).verify(code, { window })`, which is
  the function the plugin calls. Backup codes are compared with `constantTimeEqual` and consumed on
  use.
- **The attempt bound.** This is the real loss. The plugin gave ten consecutive failures then fifteen
  minutes, counted per account across factors, and that survived an attacker rotating IPs. It is
  rebuilt as an **NFR26 ceiling scoped to the Account**, which is a `rate_counter.action` constraint
  change under NFR30's expand/contract rule. A per-IP ceiling is **not** an acceptable substitute and
  must not be shipped as one: six digits against an unbounded-per-account attacker is a matter of
  hours.

**And the enrolment is a command, not a form** (DD7, runbook §6). `pnpm admin:enrol <email>` mints a
single-use setup link and prints it; opening the link shows the QR and the ten codes **once**; the
operator scans, and types the six digits **back into the terminal**, which verifies them over the
direct connection and only then sets the grant. **The grant is the last step rather than the first**,
which is what makes a half-enrolled Admin unrepresentable: an Account cannot hold Admin authority until
a working authenticator has proved itself. `isAdmin` stays `input: false`, so no request body reaches
it and this is still not an endpoint.

**One Admin means one point of failure, and it is the moderation queue** (C43). Losing the TOTP device
stops every delivery behind NFR7's 24-hour band and leaves every reported Hirer frozen, because
`unfreezeHirer` is an Admin action. Three recovery paths, all of them required:

1. **Ten backup codes**, generated at enrolment, **stored where one unlock cannot reach both
   factors**. _Amended 2026-08-30 with #96, twice. This first read "not in the password manager that
   also holds the password", and there is no password now. Then it read "printed and stored offline",
   which the enrolment screen went on to contradict: shape settled that surface on a **clipboard
   button and nothing else**, so its only affordance points at a manager and a runbook demanding paper
   would be a rule the UI works against. What survives both edits is the rule underneath, which never
   depended on the medium — **the codes must not be reachable by the same unlock as the mailbox**,
   because the mailbox is the other factor. A separate vault, a separate device, or paper all satisfy
   it; the same vault does not._
2. **A second Admin grant** on a separate device with its own TOTP secret, held by the same person.
   This is the one that recovers the platform in minutes rather than hours, and it is made by running
   `pnpm admin:enrol` a second time (DD7).
3. **A documented break-glass** in the go-live runbook: clearing the enrolled second factor over the
   direct connection — itself a credential C5's store and rotation list names. _Amended 2026-08-30 with
   #96: this used to leave a password-only door standing, which is why it was an `UPDATE` disabling 2FA.
   With no password there is no one-factor door to fall back to, so the break-glass is **re-enrolment**
   — the same command, against the same direct connection, by the same person who already holds the
   migration credential. It is a stronger procedure and not a weaker one: it ends with a working
   authenticator rather than with an account that can be opened by a secret alone._

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

#### Google as a second door, and the three things it changes

Google sign-in ships alongside the magic link. The reason is not convenience: the magic link was the
**only** door, and every risk attached to it — unmeasured deliverability into Colombian inboxes
(intent Q1), a cold sending domain capped at 50–100 sends a day (C45), a hard bounce that locks a
Worker out permanently with no password to fall back on, and Q1's openly-accepted eligibility bar
that "a Worker with no working email cannot participate" — is removed for anyone holding a Google
account, which on an Android phone is effectively everyone. Facebook is deferred: Meta's
individual-developer verification path exists, so it is not blocked by having no legal entity, but it
is an app-review cycle of unpredictable length against a closing window, and on the Worker's device
Google already reaches the same person.

**Account linking is the security decision, and its default is the dangerous one.**
`account.accountLinking` decides what happens when someone signs in with Google using an address that
already has an Account. Linking on an **unverified** email is an account-takeover primitive — register
a Google account claiming her address, get handed her profile. Linking is therefore permitted **only
on a verified email match**, and never silently on an unverified one. Not linking at all is also
wrong here: it produces two Accounts for one person, one holding her CapabilityProfile and one not,
and "why is my profile gone" arriving at a single unpaid operator (C43).

**Provider tokens are not stored.** This design never acts on Google's API on her behalf — it wants
an identity assertion and nothing else — so there is no access token worth keeping, and the safest
handling of a credential is not to hold it. PKCE is automatic in Better Auth for every OAuth flow, so
that is inherited rather than configured.

**The borrowed-Android hazard is new and is not the one NFR13 already covers.** On a shared or
borrowed phone the Google account is _already signed in_, so "Sign in with Google" completes in one
tap with no credential prompt at all — and she may create or enter an account under the **phone
owner's** identity without ever seeing a login screen. NFR13's shared-device checkbox governs how
long the session lives; it does nothing about whose account it is. So the sign-in surface names the
account it is about to use, and the Google button carries that check where a person will read it
rather than in a settings page. The copy is Build's, under `voice-guide` (C2); the requirement is
Design's.

**One consequence to carry into C1, because it is easy to miss.** Google returns a real name at
sign-up and the magic link returns none — so `ExchangedContact.fullName` now has a source for one
class of Worker and no source for the other. Either the magic-link path still asks for a name
somewhere, or a Contact Exchange delivers a full name for some Workers and not others. That is a
product decision this spec does not settle, and it is why C1 stays open rather than being closed by
this change.

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
**The machine floor is 1 GB** (C34), stated here rather than left implied: Node plus Next plus a
connection pool is tight on 512 MB before a request arrives, and this deep dive names the failure mode,
so it owns the number that answers it.

**Why the photo is `Must` at all** (C37): [ADR-0009](../../adr/0009-a-workers-full-identity-is-gated-and-never-indexed.md)
removed the loss narrative and named its replacement in the same breath — "one line in her own words
about what she does, and a face." The photo is the other half of that decision rather than decoration
on it, so cutting it leaves the ADR's answer half-built.

The path instead:

1. The client **downscales and re-encodes to ~1600 px and ≤ 2 MB in a canvas** before upload, which
   also serves NFR3's mobile-data premise and strips EXIF as a side effect.
2. `createPhotoUpload` returns a **presigned PUT** into a **quarantine bucket**. The key is
   **server-generated and opaque** — the client's filename never reaches it, or the upload is a
   path-traversal and cross-Worker-overwrite primitive — and that bucket's public access is never
   turned on, which is what makes NFR6 a statement about reachability rather than about our routing.
   The declared `Content-Length` **and `Content-Type`** are named in the signature's
   `signableHeaders`, and the type is checked against a closed set before anything is signed.

   > **Amended by [#251](https://github.com/m0t0r/recomencemos/issues/251), 2026-09-09.** This step
   > said "a quarantine **prefix**… not publicly readable". R2 states public access as one switch per
   > bucket, with no per-prefix ACL and no S3-style bucket policy, so that sentence named a control
   > production had no mechanism to implement — while `PHOTO_PUBLIC_BASE` is a bucket root and a key
   > carries its own prefix, making `${base}/quarantine/<key>` a URL anyone can construct. It also
   > said the type was signed; naming `ContentType` on the command does not sign it. Both are now
   > true. Keys keep their prefixes, which is how one bucket is chosen over the other.

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
  **a queue signal above 10 published profiles per hour, platform-wide** (C24). NFR1 forbids human
  review on that path, so the control must be a rate and a signal. Per-IP was rejected because Fly
  proxies every request and a flood from one person on mobile data rotates addresses, while a shared
  NAT trips it — it misses the case it exists for. Announcement day will trip the signal, which is
  correct: the day a flood could hide inside real traffic is the day to be looking.
- _I create an Account and read every gated profile, harvesting the self-descriptions of every
  displaced person on the site._ `PublicProfile` carries `slug`, so `/profiles` hands an enumerator the
  complete key set — nothing left to guess — and an Account costs one disposable address. Answered by
  NFR26's read ceiling, which turns a twenty-minute script into weeks, and into a signal.
- _I Report every Offer I receive, freezing legitimate Hirers with no human in the loop._ The freeze is
  a Worker-side weapon and the draft treated it only as a shield. Kept, with the counterweight in both
  halves: the rate is `reportOffer` **≤ 10/day** (NFR26), and the signal is **more than 3 Reports from
  one profile in 7 days** (C49), surfaced on `/admin` beside C24's publish rate and **informing rather
  than blocking** — a Report is never silently dropped, because the freeze is what protects her while
  she waits. Without the signal a handful of bad-faith Reports removes the scarce side of the market
  for a day and nothing says so.
- _I send hundreds of Offers, so the 24-hour queue held by one unpaid person becomes unholdable._
  NFR7's depth and arrival-rate halves are the detector; `sendOffer` at ≤ 10/day is the bound.
- _I publish a profile that is not a person, accept the Offers it attracts, and harvest a real
  Hirer's name, phone and email for the cost of one email address._ **This case runs against the
  Worker's counterpart rather than against her**, and it is the one the security advisory named as the
  point of the exercise — almost every mechanism above points at the bad Hirer. It matters more since
  C4: `sendOffer` now snapshots his self-asserted `hirerName` and `hirerPhone` onto the Account and
  `ExchangedContact` carries them, so what an acceptance discloses in that direction grew.
  **What already bounds it:** the exchange happens only on **her** acceptance of **his** Offer, so the
  attacker cannot initiate — he must attract an Offer, and every Offer is human-reviewed before it is
  delivered; `publishProfile` ≤ 3/day and one profile per Account bound the fleet; the photo is
  reviewed before it is public (NFR6); C30's duplicate-phone flag catches the reused number; and story
  11 tells a Hirer in plain words that nobody here is verified and that his own name and phone are
  self-asserted like everyone else's (C4). **What was missing and is added here:** a queue signal above
  **5 completed Contact Exchanges with distinct Hirers from one profile in 7 days** — the shape a
  harvester makes and an ordinary Worker does not — informing rather than blocking, because the same
  shape is what success looks like and blocking it would be the platform working against its own
  purpose. No ceiling sits on `acceptOffer`: refusing a Worker the acceptance she has waited for, to
  slow an attacker who can simply wait a day, spends the wrong side's patience.

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
narrower and mechanical, and it has **three** clauses rather than two: **no `dangerouslySetInnerHTML`,
no `<Markdown>` over user text, and no `href` — or any other URL-valued attribute — built from user
text**, in the app or in a template.

**The third clause is the one C48 caught missing, and it is not covered by the first two.** React's
escaping constrains element **content**; it does not sanitise an **attribute**, so
`<a href={userText}>` interpolating `javascript:…` or an attacker-chosen host survives every mechanism
above and reaches an inbox on both sides of an unverified market. Every URL this product renders or
sends is therefore **constructed server-side from values the server owns** — a slug, an Offer id, a
route constant, `NEXT_PUBLIC_APP_URL` — and never from a field a person typed. Free text stays text:
the rejector (DD3, NFR12) already refuses a messaging-app URL inside it, and what survives that is
rendered as content, never linkified. Seam 1 tests the rule with a sentinel `javascript:` fragment in
every free-text field; the accessibility requirement about descriptive link text is a different
requirement and does not discharge this one.

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
That answers the question the intent asked. The international-transmission question is separate and is
answered at **C15**: every processor is named with its country in the _aviso de privacidad_, the
_autorización_ at publish and at first Offer send carries express consent to the transmission, and
filing each vendor's DPA is a go-live runbook step — deferred knowingly, and the half a regulator asks
for first.

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

**Four scheduled jobs at launch, and the scheduler is Trigger.dev** — the daily `rotationKey` rewrite,
Offer expiry, the seven-day check-ins, and C10's queue digest at **08:00 America/Bogotá**, which is
scheduled work the draft's list omitted. Free tier, verified 2026-08-25: **$5/month of credits, 20
concurrent runs, 10 schedules**, minute-granularity cron with full IANA timezone support, 1-day log
retention. Four of the ten slots.

**The rule that shapes the whole integration: Trigger.dev never holds a database credential.** Its
scheduled tasks run on **its** infrastructure, not ours — a task lives in a `/trigger` folder and is
deployed to them — so a task body that queried Postgres would put a third party's workers on the far
end of a credential reading displaced people's phone numbers. Instead each task's entire body is an
authenticated **`POST` to a Route Handler on Fly**, and every job runs where the data already is.

Three consequences follow, and they are why this shape was chosen over the idiomatic one:

- **No personal data crosses, so Trigger.dev is not a processor.** It appears in **no** _aviso de
  privacidad_ and adds **no** transmission under Ley 1581 (C15). It learns that a request was made and
  that it returned `204`, and nothing else.
- **The boundary is inbound, not outbound**, which is a boundary class DD16 already knows how to
  authorize — the same discipline as the Resend webhook.
- **A Fly rollback stays meaningful.** The task bodies never change, so they are deployed once and a
  release of ours does not need a second deploy to stay consistent with them.

The one thing it costs: **an unmonitored schedule is invisible**, so Sentry's single free cron monitor
sits on the **queue digest** — the job whose silence nobody would otherwise notice, because the other
three announce themselves through the product.

**The retention purge is deliberately not among them** (C36). Every table in NFR17's graph has its
first purgeable row around August 2027, so building the job now is twelve months of carrying cost for
work that cannot happen yet — the simplicity advisory's argument, adopted. The objection that a
silently-stopped purge is undetectable is answered without building it: **a test fails once 2027-06-01
passes with no purge job registered**, so the reminder is red CI rather than memory. What still ships
is the **immediate** deletion path — NFR11 and story 13 — which is on request and unrelated to the
schedule. Transaction pooling removes session advisory locks, so the usual
single-runner guard is unavailable; on one machine that is fine, and on two it is not.

**`branch-protection` on a one-person repository** is required **status checks**, not required reviews:
required reviews lock the only operator out or normalize admin bypass, and status checks give NFR25
everything it asks for. Settled at C16, which also turned `stacked-prs` **on** for genuine chains —
maximal chains of blocking edges publish as a stack, a ticket with two blockers stays serialized, and
`pr-merge-method` is **rebase**, because squashing a lower PR rewrites the base every branch above it
was cut from.

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
`exchange.created`, `notification.sent`, `magic_link.requested`, `magic_link.consumed`, and
`webhook.rejected` and `job.rejected` — the last two carrying an id and an enum reason and nothing
from the body (C27, DD10). `magic_link.*` are NFR27's measurement. Ids-only satisfies NFR18 by construction rather than by
discipline.

**Membership is closed: exactly these fourteen** (C40). `job.rejected` is the fourteenth, added by the
amendment that adopted Trigger.dev (DD10) — which is the rule working rather than an exception to it:
a new safety-relevant transition arrived, and it reached the list through a spec change rather than
through someone's judgment at Build time. Adding a fifteenth is a spec amendment too, not a
judgment call made at Build time by whoever happens to be writing that action. This is the discipline
the cross-boundary types already use — "exactly these keys are present on the wire" — and the reason
`CLAUDE.md` treats the guaranteed log field names as a stability contract: a drain's queries bind to
the vocabulary, and one that drifts silently is not a vocabulary.

**The control bands, complete.** A band with a metric and a range and no "who learns" is two-thirds of a
band, which [intent Q3](./intent.md) said this effort should not ship. `alert-destination` is now
**set** (C10), and it is two destinations because the failure classes differ: human-queue bands (NFR7)
as a daily digest at 08:00 America/Bogotá through the notification seam that already exists; machine
bands (uptime, error spike) as a `needs-triage` issue from CI, per
[ADR-0001](../../adr/0001-findings-enter-through-triage.md). Neither needs new infrastructure, and the
split is the point — a queue depth is a rhythm read with coffee, while an issue for the same thing
teaches the operator to close issues unread. Sentry's
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
dissolves; what remains is narrower and easier to hold: **no `dangerouslySetInnerHTML`, no
`<Markdown>` component over user-supplied text, and no `href` built from user text**, ever. That is a
mechanism rather than a discipline, which is the difference C26 was actually asking for.

**The third clause is not a restatement of the first two** (C48). Escaping constrains element content
and leaves an attribute alone, so a link whose `href` interpolates a typed field is the one injection
this seam still admits — into an inbox, on both sides, past a control everyone believes is closed.
Every URL in every template is built from server-owned values: the app origin, a route constant, an
Offer or exchange id. DD7 states the rule for the app and the template alike.

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
This is concern C45 — the one finding here that can lose the launch rather than degrade it — and it is
answered by three mitigations that live in NFR28: warming from the first deploy so every ticket's test
sends count, a **staged** announcement so volume tracks the curve, and a pre-warmed **fallback
subdomain** so a reputation problem is a DNS change rather than a rebuild. The measured check into real
Colombian inboxes is a runbook step and does not gate the announcement.

**Sender identity is a product decision, not a config line.** The `from` address is a real,
monitored address on a sending **subdomain**, and it is **not** `noreply@`. A displaced woman who
receives an Offer notification and replies to it must reach a person, not a bounce — and with one
operator (C43) a monitored `Reply-To` is a real commitment, which is why it is named here rather than
assumed.

> **Amendment, 2026-08-27 — the `Reply-To` half is withdrawn until a mailbox exists.**
>
> The domain is `recomencemos.online` and the sending subdomain is `mail.recomencemos.online`,
> verified in Resend and **configured send-only**: no MX record, no inbound route, no mailbox. The
> paragraph above asked for something the infrastructure cannot currently provide, and the choice was
> not between keeping the commitment and dropping it — it was between **an unkept promise and no
> promise**.
>
> So: `NOTIFICATIONS_REPLY_TO` is removed, `@repo/notifications` sends no `Reply-To` header, and the
> email frame's _"Puedes responder a este correo…"_ line is removed from the footer. It was removed
> rather than reworded. A line reading _this address does not read replies_ is the same dead end,
> printed instead of promised, and it spends a footer line saying nothing she can act on. Without the
> header a reply goes to `from`, finds no MX, and **her own provider bounces it within seconds** —
> which tells her more, sooner, than any sentence in the footer could.
>
> **What survives is the half that was always the real decision:** the `from` address is still not
> `noreply@`. The local part names someone, so the day the mailbox exists the address is already
> right.
>
> **This is a withdrawal, not a reversal, and the way back is one step.** The root domain already
> carries Namecheap forwarding MX; a single forwarding rule to a real inbox makes this paragraph true
> again, at which point the variable, the header and the footer line come back **together** — and
> that is an amendment in this direction too, not a config change made quietly. Runbook §4 carries
> the unticked box that owns it.

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

**Two existing ADRs need amendments, both raised by the flagged concerns and both the human's act.**

- **[ADR-0009](../../adr/0009-a-workers-full-identity-is-gated-and-never-indexed.md) conflates
  collecting a full name with crossing one** (C1). Its Consequences say "full name is released at
  Contact Exchange… the only moment identity crosses", which this spec honours exactly — `fullName` is
  absent from `PublicProfile` and from `GatedProfile`. The amendment says the other half out loud: it
  is **collected at publish**, gated at rest, and the ADR governs the crossing rather than the
  collection. Without it, the two doors — Google, which returns a name, and the magic link, which does
  not — produce different exchanges.
- **[`CONTEXT.md`](../../../CONTEXT.md)'s Block entry describes a protection that does not exist**
  (C3). "Her CapabilityProfile becomes invisible to him" cannot hold while the Wall is public and
  indexable. The amendment narrows Block to what it actually does: **he cannot send her anything**.
  Not an ADR, but the same class of act — the vocabulary is binding, so changing it is deliberate.

**No ADR is contradicted by this spec.** ADR-0003 is extended rather than reopened — the three
projections are its first real multi-shape test, and DD8's subject-access export applies the same
whitelist discipline to a fourth egress. ADR-0006's `context.path` exposure is untouched: NFR19 is a
different egress, and a gap effort 0001 named rather than a decision it made.

### DD16 — Trust boundaries, and a STRIDE walk on the three that leak (C21)

The draft carried `[trust]` and `[network]` markers and no boundary table, which the security advisory
called the right instinct with the walk missing. Seven boundaries, and what authorizes each.
**Membership is closed: exactly these seven** (C56), by the same rule DD11's event list carries — an
eighth boundary is a **spec amendment**, not a Build decision. The table is what `/security-audit` is
handed as its input, so a table read as illustrative is an egress added at Build that nobody modelled:

| #   | Boundary                       | What crosses                                                           | What authorizes it                                                                                                                                   |
| --- | ------------------------------ | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Browser → Server Action        | Every write in the product                                             | Per-action authorization (never the page's), NFR26's ceiling, the principal as first parameter                                                       |
| 2   | Browser → public read          | `PublicProfile` only                                                   | Nothing — public by design, `noindex` absent by design                                                                                               |
| 3   | Browser → gated read           | `GatedProfile`                                                         | A session, not `frozen` (C22); charged against the read ceiling                                                                                      |
| 3b  | **Trigger.dev → job endpoint** | A signed request carrying **no data**; the reply is `204` with no body | A shared secret compared in constant time, a timestamp window, and idempotency. Inbound by design: the scheduler holds no database credential (DD10) |
| 4   | Server → Postgres              | Everything                                                             | `@repo/domain` is the only door ([ADR-0010](../../adr/0010-the-domain-package-is-the-only-door-to-the-database.md)); the connection is unexported    |
| 5   | **Server → object storage**    | Photo bytes, presigned PUT into a quarantine prefix                    | A short-lived presigned URL; the public URL derives only at `photoState = approved`                                                                  |
| 6   | **Server → Resend**            | Email address, Offer notification, exchanged contact details           | The notification seam; React Email templates; NFR18's zero on everything else                                                                        |
| 7   | **Server → Sentry**            | Errors and 10% of traces                                               | `beforeSend` / `beforeSendTransaction` scrubbing, and NFR19's query-string fix                                                                       |

Boundaries 5–7 are where personal data **leaves the system**, which is why they get the walk and the
inbound ones do not — those are already answered by DD5, DD7 and DD9 letter by letter. **Boundary 3b
is inbound precisely so that it stays off the outbound list**: a scheduler that ran the jobs itself
would be an eighth boundary carrying personal data, and a seventh processor in the _aviso_ with it.
Its one real threat is spoofing — an unauthenticated caller triggering `check-ins` repeatedly to spend
the sending quota — which the shared secret and the per-invocation cap close together.

|                            | Object storage (5)                                                                                                                       | Resend (6)                                                                                                                                                                                | Sentry (7)                                                                                                |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **S**poofing               | A forged presigned URL needs the R2 credential (C5)                                                                                      | The webhook is the spoofable direction: signature + timestamp window + idempotency, and every rejection logged (C27)                                                                      | Ingest is one-way; a forged event is noise, not disclosure                                                |
| **T**ampering              | The quarantine bucket's public access is never turned on (amended by #251); the served object is server-produced, so EXIF cannot survive | Templates are React components, so escaping is by construction; no `dangerouslySetInnerHTML`, and **no `href` built from user text** — escaping covers content, not attributes (C26, C48) | Nothing crossing back is trusted                                                                          |
| **R**epudiation            | `AdminAction` records approve/reject (C25)                                                                                               | `notification.sent` is on DD11's closed list                                                                                                                                              | Event ids reach the log line, so an incident is traceable both ways                                       |
| **I**nformation disclosure | **The real risk**: a pending photo at a readable URL. Bounded over the object, not the page (NFR6)                                       | **The real risk**: the exchange payload is the most sensitive thing this product sends. One recipient per send, no bcc, no batching across people                                         | **The real risk**: NFR19's magic-link token in a query string — a fix to shipped code, not a future guard |
| **D**enial of service      | 2 MB cap, browser-side downscale, 1 GB machine floor (C34)                                                                               | Warm-up curve and staged announcement (C45); a burnt domain is a self-inflicted outage                                                                                                    | A crawler cannot spend the quota, because a refusal returns rather than throws (NFR26)                    |
| **E**levation of privilege | No path from an object to an identity                                                                                                    | A forged bounce is an account-denial primitive, which the webhook rules close                                                                                                             | None — Sentry holds no authority over this app                                                            |

**What this walk does not replace** is the code audit. `/security-audit` runs against the built system
before the announcement (C8); design-time modelling catches a wrong shape, which is a rewrite by the
time a code audit finds it, and the table above is also the input that keeps that audit from inferring
an architecture for itself.

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
than naming the gap. C2 settles when that gap closes: a `brand-voice` session blocks the **first ticket
rendering `es-CO` copy** — not Build as a whole, since schema, domain and auth tickets ship no strings —
and DD12's Skill vocabulary is that session's first deliverable, because translating CUOC's
statistician register into the words a Worker uses about herself **is** voice work.

### The surfaces, their targets, and their state sets

`empty` / `loading` / `partial` / `error` / `permission denied` / `success`, all six, per surface.
`partial` is the one this design actually hits, because the Wall streams and a photo resolves on its
own schedule.

| Surface              | Target                             | `empty`                                                                                                                                                                        | `loading`                                                                                    | `partial`                                                                                                                                                                      | `error`                                                                                                                                                                                                                                                               | `permission denied`                                                                                                                                                                                                                               | `success`                                                                                                                                                                                                                                                                                                                    |
| -------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Wall**             | `app/page.tsx`                     | Before the first profile exists: the proposition and a route into `/publish`. Never a blank region                                                                             | Card skeletons at the card's exact height, so the notices above them do not move             | Cards rendered, a photo slot still resolving → the initial, which is also the approved-photo-absent state. One shape, two causes                                               | The Wall failed to load: what failed, that retrying helps, and the notices still render                                                                                                                                                                               | n/a — public                                                                                                                                                                                                                                      | n/a                                                                                                                                                                                                                                                                                                                          |
| **Browse**           | `app/profiles/page.tsx`            | No match for this Skill/city: say which filter is narrowing, offer to clear it. Distinct from the Wall's empty                                                                 | Skeletons holding the grid                                                                   | Some cards, more streaming                                                                                                                                                     | Search failed; the unfiltered list is still reachable                                                                                                                                                                                                                 | n/a — public                                                                                                                                                                                                                                      | n/a                                                                                                                                                                                                                                                                                                                          |
| **Full profile**     | `app/profile/[slug]/page.tsx`      | n/a                                                                                                                                                                            | Skeleton at the profile's height                                                             | Identity rendered, work history streaming                                                                                                                                      | Profile failed to load                                                                                                                                                                                                                                                | **Signed out** → the Account gate and why it exists. **Frozen** (a Report is open against him) → indistinguishable from "not found" (C22). **Blocked** → served normally: a Block reaches the send only, and the send is where he is refused (C3) | n/a                                                                                                                                                                                                                                                                                                                          |
| **Sign in**          | `app/sign-in/page.tsx`             | n/a                                                                                                                                                                            | Per-door: the Google button and the email button busy independently; the form stays readable | n/a                                                                                                                                                                            | Send failed, retry available, address still in the field. **Google failed** → the email door is still offered, never a dead end                                                                                                                                       | **Already signed in** → redirected to its `returnPath` when safe, else `/`. No message: there is nothing to tell somebody about a problem they do not have                                                                                        | Email → "Check your email", said **whether or not the address exists**, because the honest reply and the enumeration-safe reply are the same one; a consumed link offers an immediate resend. **Google** → the surface names the account it is about to use, because on a borrowed Android it may be the phone owner's (DD5) |
| **Publish**          | `app/publish/page.tsx`             | Skill picker before a query                                                                                                                                                    | Per-field, never a whole-form spinner                                                        | Fields accepted, photo still uploading — the profile is already live                                                                                                           | Per-field errors **and** a focused form-level summary; the contact-detail rejection names the fragment and keeps everything typed (NFR12); a photo rejected at the size ceiling says so in her terms rather than failing opaquely (DD6)                               | Already has a profile → route to `/my-profile`                                                                                                                                                                                                    | Published, with the live profile linked and the pending photo explained without a badge                                                                                                                                                                                                                                      |
| **Own profile**      | `app/my-profile/page.tsx`          | n/a                                                                                                                                                                            | Skeleton                                                                                     | Photo pending → **her own photo shown**, dignified, described as under review, not flagged                                                                                     | Load failed                                                                                                                                                                                                                                                           | Not the owner → 404                                                                                                                                                                                                                               | Edit saved — story 24's `updateProfile`, added 2026-09-02 with #139; see below                                                                                                                                                                                                                                               |
| **Received Offers**  | `app/offers/page.tsx`              | No Offers yet: say what makes one arrive, and that a person reads each first                                                                                                   | Row skeletons                                                                                | Some rows, terms streaming                                                                                                                                                     | Load failed                                                                                                                                                                                                                                                           | Not the owner → 404                                                                                                                                                                                                                               | n/a                                                                                                                                                                                                                                                                                                                          |
| **One Offer**        | `app/offers/[id]/page.tsx`         | n/a                                                                                                                                                                            | Skeleton at the terms' height                                                                | Terms rendered, Hirer identity streaming                                                                                                                                       | Load failed                                                                                                                                                                                                                                                           | Not the addressee → 404                                                                                                                                                                                                                           | Accepted → the Contact Exchange below. Declined → confirmed, and it stays confirmed rather than vanishing                                                                                                                                                                                                                    |
| **Contact Exchange** | same route, post-accept            | n/a                                                                                                                                                                            | n/a                                                                                          | Details on screen, the email still sending — and the screen says the email is a copy, not the original                                                                         | Email failed to send: the details are **still on screen**, which is why they are on screen                                                                                                                                                                            | Not a party to it → 404                                                                                                                                                                                                                           | Both sides' details, once, plus the standing safety guidance and the no-money notice                                                                                                                                                                                                                                         |
| **Sent Offers**      | `app/sent-offers/page.tsx`         | None sent: route into `/profiles`                                                                                                                                              | Row skeletons                                                                                | Rows, states streaming. `pending_review` states the normal window up front; past 24 h the derived `reviewDelayed` says plainly that this one is taking longer than usual (C41) | Load failed                                                                                                                                                                                                                                                           | Not the sender → 404                                                                                                                                                                                                                              | n/a                                                                                                                                                                                                                                                                                                                          |
| **Account**          | `app/account/page.tsx`             | n/a                                                                                                                                                                            | Per-action                                                                                   | n/a                                                                                                                                                                            | Action failed                                                                                                                                                                                                                                                         | Signed out → `/sign-in`                                                                                                                                                                                                                           | Signed out everywhere / email change **pending verification** (DD5) / **deletion**, whose confirmation carries NFR11's second number: it reaches nothing a Hirer already read                                                                                                                                                |
| **Admin queue**      | `app/admin/[section]/`             | Queue empty — a real and good state, and it says the oldest-item age is zero. Never an illustration and never "nothing here yet": zero unreviewed Offers is the system working | Skeleton rows per section, at the row's height                                               | Some rows rendered, others streaming; **the age of the oldest item renders first** (story 7), because it is the number that decides whether this person keeps working          | A source failed: say **which**, because a silently missing source is an unreviewed Offer. The other sections stay usable                                                                                                                                              | Not an Admin session → 403, not a redirect (NFR14), enforced once at the shell                                                                                                                                                                    | Per-action: the item leaves its section, the sidebar count decrements, and focus returns to the **next** row rather than to the top of the page                                                                                                                                                                              |
| **Admin door**       | `app/admin/continue/page.tsx`      | n/a                                                                                                                                                                            | The code field is busy; nothing else on the screen moves                                     | n/a                                                                                                                                                                            | A wrong code says only that it was wrong — never whether the challenge, the Account or the code was the part that failed. At the attempt ceiling it says when the Account may try again, which is the honest reply and tells an attacker nothing he could not measure | No token, or a spent, expired or unknown one → **404**. Already an Admin session → `/admin`                                                                                                                                                       | Session created, `/admin`                                                                                                                                                                                                                                                                                                    |
| **Admin enrolment**  | `app/admin/enrol/[token]/page.tsx` | n/a                                                                                                                                                                            | n/a — the QR and the codes are rendered in one pass or not at all                            | n/a                                                                                                                                                                            | Enrolment failed: say so plainly and say the command may be run again, because nothing has been granted yet                                                                                                                                                           | Same 404 rule as the door                                                                                                                                                                                                                         | **Shown once**, and the screen says so before the codes rather than after them. It carries runbook §6's condition where it applies — keep them out of reach of the same unlock as the mailbox, which is the other factor — because a person who closes this screen has lost them                                             |

_Amended 2026-09-02 with #139, on the **Own profile** row._ Its `success` cell read "Edit saved" while
no story asked for an edit and no action could produce one; story 24 is that action. The edit surface
sits under `app/(site)/my-profile/` — the targets in this table predate the route groups #103
introduced — and **whether the text fields, the Skills and the work history are edited on one form or
on several is the ticket's `shape` question**, deliberately not one this table answers. Its `error`
cell is the Publish row's: per-field errors, a focused form-level summary, and a contact-detail
rejection that names the fragment and keeps everything she typed.

**A seventh state, on every surface that has a ceiling: `rate limited`** (C39). NFR26's refusal returns
rather than throws, which protects the Sentry quota and says nothing to the person who hit it. Each
one renders the `userMessage` and the `retryAfter` in her terms:

| Surface          | Ceiling                                      | What she is told                                                                                                                                                                                                                                        |
| ---------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sign in**      | `requestMagicLink` ≤ 5/hour per address      | Too many links requested; when she may ask again; the Google door is still there                                                                                                                                                                        |
| **Admin door**   | `verifyAdminCode`, per **Account** (DD5)     | That the Account is locked for now and when it reopens. Per-Account rather than per-IP is the whole point — a per-IP bound on six digits is no bound at all — so the copy names a wait rather than pretending the attempt was malformed                 |
| **Publish**      | `publishProfile` ≤ 3/day                     | How many attempts today, when the window resets, and that nothing she typed was lost                                                                                                                                                                    |
| **Publish**      | `createPhotoUpload` ≤ 10/day                 | Same, and that the profile is already live without the photo                                                                                                                                                                                            |
| **Publish**      | `requestSkill` ≤ 5/day (C57)                 | That the requests already sent are queued and not lost, when she may ask again, and that she can publish now with the closest Skill on the list and edit later — she is **mid-publish** when she meets this, which is the moment silence costs the most |
| **Full profile** | reads ≤ 60/hour, ≤ 300/day                   | Reading paused, when it resumes — the honest reply, since a harvester learns nothing he did not already know from being stopped                                                                                                                         |
| **One Offer**    | `sendOffer` ≤ 10/day, `reportOffer` ≤ 10/day | When he may send again; a Report is never silently dropped                                                                                                                                                                                              |
| **Account**      | `changeEmail` ≤ 3/day                        | When she may try again, and that the address on file is unchanged                                                                                                                                                                                       |
| **Own profile**  | `updateProfile` ≤ 10/day (#139)              | When she may save again, that nothing she typed was lost, and that the profile people can already see is the last version she saved — not a half-applied one                                                                                            |

The case that motivated this is concrete: a Worker who trips `publishProfile` after two failed
attempts currently meets silence, from a requirement that passes green.

**Every `404` in the table above is a returned response, not a thrown error** (C51). Five surfaces
refuse that way and C22 added a sixth — a frozen caller at `/profile/[slug]`, deliberately
indistinguishable from a missing profile — which makes profile enumeration the cheapest path there is
to the month's 5,000-event Sentry allowance. NFR26 states the rule; it is repeated here because the
person implementing a `permission denied` cell is the one who reaches for `notFound()` out of habit.

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
card, `PublicProfileCard`, and the two standing notices.

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
  the planner's behaviour is the one production has. Read out of the shipped `pglite.wasm`, not
  recalled. (Primary keys do not depend on that alignment — DD2 generates UUIDv7 in the application
  rather than in the engine, which is one fewer thing for the two to agree on.)
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

**That obligation is discharged once, by a table, not twenty-five times by hand** (C38). One
table-driven test enumerates an **action registry** and asserts each entry refuses an anonymous
caller, and the registry's **completeness** is asserted against the exported action modules — so an
action added without a row is red rather than forgotten. It is the only version of this that survives
twenty-five repetitions by one tired person. What stays per-ticket is the narrower half: an action
whose authorization is more than "is there a principal" — ownership scoping, `frozen`, Blocked, Admin
session — still earns its own case.

`apps/web` gains its **first Vitest config** — happy-dom, copied from
`packages/design-system/vitest.config.mts` — covering exactly two things:

- The Client Components this effort adds: the shared-device checkbox, the Skill picker, the photo
  upload's downscale path, and the form's error states.
- **NFR8's `noindex`, as a table-driven test over the route list.** The gated prefixes are one exported
  array and the test asserts each is covered by the route group applying `noindex`. A per-page
  `metadata` export tested per page passes while the page someone forgot fails silently — which is the
  failure [ADR-0009](../../adr/0009-a-workers-full-identity-is-gated-and-never-indexed.md) calls
  "load-bearing and easy to lose".

**Two more cases belong at seam 1**, both cheap and both guarding something no other test reaches:

- **Template escaping, content and attribute** (C26, C48). Each React Email template carrying user
  text is rendered twice: once with a scripted payload in the user-controlled field, asserting the
  output is escaped, and once with a `javascript:` fragment, asserting **no `href` in the rendered
  output derives from the payload**. React escapes by construction; the guarantee holds right up until
  someone reaches for `dangerouslySetInnerHTML` to make a line break work, or linkifies a typed
  fragment, and this is what catches both. The same attribute assertion runs at seam 1 over every
  free-text field the app renders.
- **The purge tripwire** (C36). A test that **fails once 2027-06-01 passes with no retention purge job
  registered**. The job is deferred because its first purgeable row is roughly a year out; the reminder
  is red CI rather than memory.

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

- [x] **C1** — **Where the Worker's full name crosses.** [ADR-0009](../../adr/0009-a-workers-full-identity-is-gated-and-never-indexed.md)
      says "full name is released at Contact Exchange… the only moment identity crosses", and the
      intent's **Constraints** restates it that way — but the intent's **Proposed outcome** says her
      full name is "behind an Account", which is the gated shape. This spec designs to the **stricter**
      reading: `fullName` is in `ExchangedContact` only, and is deliberately absent from
      `CapabilityProfile`. That leaves a second question the ADR does not answer: it is then collected
      either at publish (a database of displaced people's full names from day one) or at acceptance (a
      new input on the highest-stakes action in the product).
      **Adding Google sign-in (DD5) changed the shape of this, without settling it.** Google returns a
      real name at sign-up; the magic link returns none. So the answer is now _different per door_ —
      `ExchangedContact.fullName` has a source for a Google Worker and no source for a magic-link one,
      and a Contact Exchange would deliver a full name for some Workers and not others unless the
      email path asks for one somewhere.
      **Risk if wrong:** either a permanent over-collection, or an identity crossing a Hirer sees
      before she has chosen — plus, now, an exchange whose completeness depends on which button she
      pressed at sign-up. **Owner:** Tech lead (arbitrating ADR-0009 against the intent's prose), with
      Security owner.
      **Answer: collected at publish, shown only at Contact Exchange.** The two halves of this
      concern are independent and the ADR only binds the second. `fullName` becomes a required
      `personal` field on CapabilityProfile — prefilled and editable from the Google profile, typed by
      a magic-link Worker — gated, absent from `PublicProfile` **and** from `GatedProfile`, and
      reaching a Hirer only through `ExchangedContact`. Both doors then produce the same exchange,
      which is what the per-door asymmetry above asked for. The marginal over-collection is small
      because publish already takes her phone ([intent Q1](./intent.md) settled that), and the
      stricter reading of ADR-0009 — the moment identity _crosses_ — is preserved exactly.
      **Follows:** `publishProfile` gains `fullName`; DD15 gains a proposed amendment to
      [ADR-0009](../../adr/0009-a-workers-full-identity-is-gated-and-never-indexed.md) separating
      collection from crossing, because its prose conflates them.
- [x] **C2** — **`voice-guide` is `UNSET`, and one `Must` story blocks on it.** [Intent Q6](./intent.md)
      settles that a `brand-voice` session sets it and that it stays `UNSET` through `/to-spec`. This
      spec names what every string must **say** and fixes no words. DD12's Skill-vocabulary translation
      is the exception that cannot wait: turning CUOC's statistician register into the words a Worker
      uses about herself **is** voice work.
      **Risk if wrong:** either the vocabulary ships in the register of a labour statistic, or story 3
      stalls. **Owner:** Design lead. **Unblocks by setting:** `docs/policy/ux.md` → `voice-guide`.
      **Answer: `voice-guide` stays `UNSET`, and the `brand-voice` session blocks the first ticket that
      renders user-facing Spanish — not Build as a whole.** Schema, domain, auth and storage tickets ship
      no copy, so they are not gated. The session's **first deliverable is DD12's Skill vocabulary**,
      because turning CUOC's statistician register into the words a Worker uses about herself is voice
      work and cannot be done twice.
      **Follows:** `/to-tickets` marks the first copy-bearing ticket as blocked on that session;
      `docs/policy/ux.md` → `voice-guide` stays `UNSET` by decision, per [intent Q6](./intent.md), and
      that is a set answer rather than an omission.
- [x] **C3** — **A Block cannot mean what `CONTEXT.md` says it means.** The glossary binds Block as
      "her CapabilityProfile becomes invisible to him". The Wall and `/profiles` are public, indexable
      and readable signed out, so a Blocked Hirer sees her card in a private window. This spec honours
      "he cannot open her gated profile" and "he can send her nothing", states the gap in product copy
      (story 11), and proposes **amending the `CONTEXT.md` entry** rather than leaving the vocabulary
      describing a protection that does not exist. DD8 adds a second edge: a Block does not survive the
      Hirer's account deletion, because deletion frees his email.
      **Risk if wrong:** a Worker relies on invisibility she does not have — the exact failure story 11
      exists to prevent. **Owner:** Tech lead (domain model), with Design lead (copy).
      **Answer: amend the glossary, and narrow Block to the send.** A Block prevents one Hirer from
      sending her anything further. It does **not** remove her public card — the Wall is public by
      ADR-0009 and cannot be made selectively invisible — and, decided here against the draft, it does
      **not** close his gated read either: `GET /profile/[slug]` answers a Blocked caller normally.
      One rule, explainable in one sentence to a Worker, instead of a protection that is partial in two
      different ways.
      **What this accepts, stated rather than implied:** the person she refused keeps reading her
      `about` and work history for as long as he holds an Account. Her phone and email are unaffected —
      those cross only at Contact Exchange, and he can no longer reach that path at all. Story 11's copy
      says what a Block does in those terms and does not imply invisibility.
      **Follows:** `CONTEXT.md`'s Block entry is amended in this effort; the Block entity and the
      `GET /profile/[slug]` row of the API contract drop the not-Blocked condition; `sendOffer` keeps it.
      DD8's edge is unchanged — a Block does not survive the Hirer's account deletion.
- [x] **C4** — **The exchange is asymmetric in identity, against the vulnerable side.**
      `ExchangedContact` claims the Hirer's name, phone and email, and **no story, entity or route ever
      collects them**. Magic link proves only that he controls an inbox. So she hands over a
      verified-reachable phone number and receives three self-asserted strings typed at exchange time.
      It also caps what a Report can achieve: with no durable Hirer identity, a banned Hirer
      re-registers in thirty seconds. Proposal: collect his details at first Offer send, alongside the
      Consent row this spec already adds there, and state plainly on both sides that they are
      self-asserted.
      **Risk if wrong:** the platform's terminal event is a one-way disclosure by the person with the
      least power in it. **Owner:** Tech lead, with Security owner.
      **Answer: collect his details at first Offer send, and show his declared name on the Offer she
      reads.** `sendOffer` gains `hirerName` and `hirerPhone`, stored on **Account** beside the Consent
      row this spec already writes there and snapshotted into `ExchangedContact` at crossing. Both
      sides' copy states which fields are self-asserted and which are verified — the same honesty move
      ADR-0008 makes about verification generally. `ReceivedOffer` carries his declared name **before**
      she accepts, badged as declared rather than verified, so she judges knowing who claims to be
      asking; the sliver of pre-consent exposure that costs him is accepted, because he initiated and
      holds the power in the exchange. This does not make a Report survive re-registration — nothing
      short of verification would, and ADR-0008 declined that — but it gives a Report a durable string
      to attach to instead of nothing.
      **Follows:** `sendOffer` gains two fields; `ReceivedOffer` gains `hirerName`; Account gains
      `hirerName` / `hirerPhone`, both `personal`, both inside NFR17's retention graph.
- [x] **C5** — **Where six new credentials live and who rotates each** (PlanetScale app + direct,
      Resend, the webhook signing secret, R2, the Google OAuth client secret, Better Auth's secret). NFR24 keeps them out of every
      turbo task; it does not say where they live. Proposal: `fly secrets` as the only store, with the
      go-live runbook naming each.
      **Risk if wrong:** a production database URL for a table of displaced people's phone numbers
      lands in a `.env` file, which is a Turborepo `build` input and one `git add` from an incident.
      **Owner:** Security owner. **Unblocks by setting:** `docs/policy/security.md` → `secret-store`.
      **Answer: `fly secrets` is the only runtime store, mirrored into a password manager as the human
      copy.** No secret reaches a `.env` file in the repo — `.env*` is a Turborepo `build` input, so that
      is one `git add` from an incident. Local development uses a gitignored `.env.local` holding
      development-tier credentials only, never a production value. Every one of the six is additionally
      held in the operator's password manager, because a lost machine must not be a lost platform: the
      R2 and Resend keys are not recoverable from Fly, only replaceable.
      **The mirror is the part that drifts**, and nothing enforces it. The go-live runbook names each
      secret, its vendor dashboard, its rotation step, and the mirror as an explicit step of that
      rotation.
      **Sets:** `docs/policy/security.md` → `secret-store`.
- [x] **C6** — **The CSP this app ships, or the recorded decision not to.** DD7 settles the rest of the
      header set; the CSP itself is not this spec's to pick. Proposal: `default-src 'self'`,
      `frame-ancestors 'none'`, `img-src 'self' <cloudflare-image-delivery-host> data:`, and the Sentry hosts the go-live
      runbook already enumerates.
      **Risk if wrong:** no `frame-ancestors` leaves `acceptOffer` clickjackable — one click releasing
      a displaced person's name, phone and email. **Owner:** Security owner. **Unblocks by setting:**
      `docs/policy/security.md` → `csp-policy`.
      **Answer: ship the proposed policy, enforcing from the first deploy.**
      `default-src 'self'; frame-ancestors 'none'; img-src 'self' <image-host> data:; connect-src 'self'
<sentry-ingest>; base-uri 'self'; form-action 'self'`. `frame-ancestors 'none'` is the load-bearing
      directive — without it `acceptOffer` is clickjackable, and that is one click releasing a displaced
      person's name, phone and email. Report-only first was rejected on exactly that point: the
      directive that matters does nothing in report-only mode, and the week spent measuring is the
      announcement week.
      **The Next inline bootstrap needs a nonce or `'strict-dynamic'`**; that is the implementing
      ticket's detail, not this spec's, and it is the one thing likely to break the first deploy.
      **Sets:** `docs/policy/security.md` → `csp-policy`.
      **The value above is the proposal as answered, and it is no longer the value that ships.** The
      implementing ticket ([#232](https://github.com/m0t0r/recomencemos/issues/232)) resolved the
      `<image-host>` placeholder into the two photo hosts, added `script-src`, `style-src`,
      `object-src`, `font-src` and `blob:`, and widened `form-action` by one origin — each change
      recorded under "The response-header set" in the policy file. This concern says the CSP is not
      this spec's to pick, so **the key is the authority and this paragraph is a snapshot**; read it
      for the reasoning, never for the string. The nonce sentence above was answered too, and the
      answer was no: it is incompatible with this app's Partial Prerendering, so the ticket ships
      `'unsafe-inline'` deliberately and
      [#253](https://github.com/m0t0r/recomencemos/issues/253) is where that trade is weighed.
- [x] **C7** — **What blocks a release: a CVE threshold, a licence allowlist, or neither.** Proposal:
      CI fails on `high` or above in a direct dependency.
      **Risk if wrong:** an advisory against the authentication library ships to production with
      nobody watching and nothing blocking. **Owner:** Security owner. **Unblocks by setting:**
      `docs/policy/security.md` → `dependency-policy`.
      **Answer: CI fails on `high` or above in a **direct** dependency.** Direct-only is what keeps it
      actionable — a transitive `high` inside a build tool nobody can upgrade would block every PR and be
      bypassed within a week, which is how a gate dies. No licence allowlist: the dependency set is
      small, chosen deliberately, and already read.
      **Sets:** `docs/policy/security.md` → `dependency-policy`, and the check joins
      `docs/policy/build.md` → `required-checks`.
- [x] **C8** — **Whether an external party ever looks at this.** "Never" is a legitimate answer for an
      unfunded one-person platform and is worth recording as a decision rather than a silence.
      **Risk if wrong:** the only review this system receives is its own. **Owner:** Security owner.
      **Unblocks by setting:** `docs/policy/security.md` → `pentest-cadence`.
      **Answer: no external review — recorded as a decision — with two tiers of agent review as the
      standing substitute.** `pentest-cadence` is `none` for an unfunded one-person platform, with
      the revisit triggers named beside it (external funding, a legal entity, or a partner
      organisation). What runs instead:
      **Per PR touching auth, the exchange path, or an egress** — the `security-review` skill against
      the branch diff, as a `REVIEW.md` pass. The path condition is deliberate: a security review on
      the PR that changes a font size is how a reader learns to skim.
      **Before the announcement, and after any later change to the auth or exchange path large enough
      to warrant it** — a full `/security-audit` run. That skill is a multi-phase fan-out with its own
      output directory, so it is a periodic run rather than a merge gate; its `findings.json` from
      earlier runs makes each later one cheaper by deduplicating what has already been found.
      **This is not a pentest and is not recorded as one.** An agent reading code another agent wrote
      shares its blind spots; what the two tiers buy is coverage and consistency, not independence.
      **Sets:** `docs/policy/security.md` → `pentest-cadence`; adds both passes to `REVIEW.md`.
- [x] **C9** — **The availability target for the public reads.** Proposal: **99.5% monthly** on `/` and
      `/profiles`, measured by the external uptime monitor rather than server-side. Note the
      arithmetic: without DD10's bluegreen, ~30 s of boot per deploy at ~10 deploys/day spends ~0.35%
      on deploys alone — an implicit 99.65% ceiling. With bluegreen the ceiling goes away, which is why
      the two decisions are one.
      **Risk if wrong:** the site is down and the first to learn is a Worker who assumes she did
      something wrong. **Owner:** On-call lead. **Unblocks by setting:**
      `docs/policy/operability.md` → `default-availability`.
      **Answer: 99.5% monthly on `/` and `/profiles`, measured externally.** Roughly 3h39m of budget per
      30 days, read from the uptime monitor rather than server-side — a machine that is down measures
      nothing. 99.9% was rejected as unreachable on one machine with nobody on call, and a target missed
      every month is not a target.
      **This and DD10's bluegreen are one decision**, per the arithmetic in the concern: without it,
      ~30 s of boot at ~10 deploys/day spends ~0.35% on deploys alone and caps the achievable figure at
      ~99.65%.
      **Sets:** `docs/policy/operability.md` → `default-availability`.
- [x] **C10** — **Where a breach lands.** Every band in this spec is otherwise two-thirds of a band,
      which [intent Q3](./intent.md) said this effort should not ship. Proposal, two destinations
      because the failure classes differ: human-queue bands (NFR7) as a **daily digest at 08:00
      America/Bogotá through the notification seam**; machine bands (uptime, error spike) as a
      **`needs-triage` issue from CI**, per ADR-0001. Neither needs new infrastructure.
      **Risk if wrong:** NFR7 and NFR27 are numbers nobody ever reads. **Owner:** On-call lead.
      **Unblocks by setting:** `docs/policy/operability.md` → `alert-destination`.
      **Answer: two destinations, split by failure class.** Human-queue bands (NFR7 — Offers awaiting
      review, photos awaiting moderation, the age of the oldest) arrive as a **daily digest at 08:00
      America/Bogotá** through the notification seam this spec already builds. Machine bands (uptime,
      error spike) open a **`needs-triage` issue from CI**, per
      [ADR-0001](../../adr/0001-findings-enter-through-triage.md). Neither needs new infrastructure.
      The split is the point: a queue depth is a rhythm read with coffee, and an issue for the same thing
      teaches the operator to close issues unread.
      **Sets:** `docs/policy/operability.md` → `alert-destination`.
- [x] **C11** — **The consequence of a spent error budget.** With one unpaid person the only real lever
      is deploy cadence. Proposal: above 50% of the 30-day budget, deploys pause except fixes and
      cadence drops to once daily until it recovers.
      **Risk if wrong:** continuous deployment with no on-call and no brake degrades monotonically with
      nobody empowered to stop it. **Owner:** On-call lead. **Unblocks by setting:**
      `docs/policy/operability.md` → `error-budget-policy`.
      **Answer: above 50% of the 30-day budget, deploys are limited to fixes and cadence drops to once
      daily until the trailing window recovers.** With one unpaid person, deploy cadence is the only
      lever that exists. Acting at 100% was rejected because by then the month is already missed, so the
      brake punishes rather than prevents.
      Writing it down in advance is the whole value — it is the operator's permission to stop, decided
      when calm rather than at 2am.
      **Sets:** `docs/policy/operability.md` → `error-budget-policy`.
- [x] **C12** — **The inherited latency default.** Proposal: **p95 ≤ 400 ms server-side and ≤ 1200 ms
      user-measured**, matching NFR2 and making the network leg explicit for the next spec.
      **Risk if wrong:** the next spec re-derives a number and server-side figures keep reading as
      user-experience commitments. **Owner:** On-call lead. **Unblocks by setting:**
      `docs/policy/operability.md` → `default-latency`.
      **Answer: p95 ≤ 400 ms server-side and ≤ 1200 ms user-measured.** Both numbers, because the second
      is what stops a future spec quoting a server-side figure as a user-experience commitment — the
      exact conflation this concern was raised about. The user-measured figure is against a Colombian
      mobile network, which is the connection this product is actually used on.
      **Sets:** `docs/policy/operability.md` → `default-latency`.
- [x] **C13** — **Writing this effort's settled numbers back into `docs/policy/`.** NFR13 settles
      `session-lifetime`; NFR5 settles `browser-support`; NFR17 settles the four retention keys; NFR25
      settles `required-checks`, `branch-protection` and `rollback-mechanism`; DD2 settles `orm`,
      `pk-strategy` and `soft-delete`. **The intent requires them written back in this effort**, or the
      next spec raises every one again.
      **Risk if wrong:** ten keys stay `UNSET` while the code answers them, which
      `docs/policy/README.md` calls the same failure as guessing. **Owner:** each key's owner per
      `owners.md`; **Repo owner** to confirm the sweep happened.
      **Answer: yes, the sweep happens in this effort.** Every key this spec settles is written back to
      `docs/policy/` as part of resolving these concerns, not as a follow-up ticket — the intent requires
      it and the alternative is the next spec raising all ten again. The keys and their sources are
      recorded in **Policy keys set by this effort** at the end of this section.
- [x] **C14** — **`migration-policy`, and what a one-way migration does to NFR25's five minutes.**
      Drizzle generates one-way SQL by default. DD10 proposes **expand/contract, with a contracting
      migration forbidden in the same deploy as the code change**, and DD13 makes that mechanical
      (NFR30) — so what remains open is narrower than it was: whether a reversible `down` migration is
      required at all, or whether forward-fix plus the isolation rules above is the policy.
      **Risk if wrong:** the one deploy that needs undoing is the one the rollback cannot undo.
      **Owner:** Data lead. **Unblocks by setting:** `docs/policy/data.md` → `migration-policy`.
      **Answer: expand/contract plus forward-fix; no `down` is required.** Expand/contract is what makes
      rollback work at all — every deploy's schema stays compatible with the **previous** code version,
      so NFR25's five minutes is a code rollback and never needs a schema one. A `down` that no test ever
      runs is theatre: it reads as a safety net and fails the single occasion it is used. A `down`
      restricted to contracting migrations was rejected for the sharper version of the same objection —
      that is exactly the migration whose reverse cannot restore what it dropped, so it recreates an
      empty column and lies about having recovered.
      What carries the guarantee instead is already in the spec: DD10's rule that a contracting migration
      may not ship in the same deploy as the code change that frees the column, and DD13's test (NFR30)
      that makes the rule mechanical rather than a convention.
      **Sets:** `docs/policy/data.md` → `migration-policy`.
- [x] **C15** — **Authorization for international transmission.** PlanetScale, Fly, Cloudflare, Google, Resend and
      Sentry are all outside Colombia, so every one is a _transmisión_ requiring disclosure in the
      _autorización_ and a transmission contract or equivalent. **RNBD registration is separately
      answered and does not apply** — DD8 verified that the threshold reaches _sociedades_ and
      non-profits above 100,000 UVT and public legal persons, not a _persona natural_.
      **Risk if wrong:** a named individual holding personal liability is transmitting displaced
      people's personal data abroad without the authorization Ley 1581 requires. **Owner:** Security
      owner, as _responsable del tratamiento_.
      **Answer: disclose every recipient and take express authorization for the transmission; the
      per-vendor contracts are a runbook step, not a Design commitment.** The _aviso de privacidad_
      names each processor with its country and purpose — PlanetScale, Fly, Cloudflare, Google, Resend,
      Sentry — and the _autorización_ shown at publish and at first Offer send carries express consent
      to international transmission, versioned in the Consent row this spec already writes at both
      moments. Express authorization is the path that holds however SIC adequacy is read, which is why
      it is not made to depend on that reading.
      **Filing each vendor's DPA / SCCs is deliberately deferred to the go-live runbook**, and that is
      the half a regulator asks for first. Stated here so the deferral is a decision with an owner
      rather than an omission.
      **Follows:** Consent gains a transmission acknowledgement in its versioned payload; the go-live
      runbook gains a step per processor; whether Circular Externa 005 de 2017 lists these countries as
      adequate goes in _What was not verified_ rather than being recalled here.
- [x] **C16** — **`branch-protection` on a one-person repository.** Proposal: required **status
      checks**, not required reviews — required reviews lock the only operator out or normalize admin
      bypass, and status checks give NFR25 everything it asks for.
      **Risk if wrong:** either the operator is locked out of his own repository, or the gate becomes
      advisory. **Owner:** Repo owner. **Unblocks by setting:** `docs/policy/build.md` →
      `branch-protection`, and `stacked-prs` with it — 17 `Must` stories at one independent PR each is
      the volume that makes that key worth answering.
      **Answer: required status checks and no required reviews; `stacked-prs` **yes**, for genuine
      chains only.** Required reviews on a one-person repository either lock the only operator out or
      normalise admin bypass, and bypass-as-habit is worse than no protection at all; status checks give
      NFR25 everything it asks for. Direct push to `dev` stays refused, which the Build gate's rule G
      already enforces on the agent side.
      **Stacking is on**, so a maximal chain of blocking edges publishes as a stack and each diff stays
      small enough to review — schema, then domain, then UI. The rule from `issue-tracker.md` holds
      unchanged: maximal chains become stacks, a ticket with two blockers stays serialized, and unrelated
      tickets are never stacked for tidiness. The cost is accepted knowingly: a review fix low in a stack
      rebases everything above it, and `resolving-merge-conflicts` is the skill that gets used.
      **Sets:** `docs/policy/build.md` → `branch-protection` and `stacked-prs`.
- [x] **C17** — **Backup RPO and RTO.** One Postgres holds displaced people's phone numbers, with
      nobody on call and no second copy anywhere in this design; R2 is a second store with its own
      answer. Proposal: RPO **≤ 1 h**, RTO **≤ 4 h**, both verified once by an actual restore before
      the announcement.
      **Risk if wrong:** the failure that ends the platform is unrecoverable and nobody learns how much
      was lost until they need it. **Owner:** Data lead. **Unblocks by setting:**
      `docs/policy/data.md` → `backup-rpo` / `backup-rto`.
      **Answer: RPO ≤ 1 h, RTO ≤ 4 h, proven by one real restore before the announcement.** The rehearsal
      is the load-bearing half — an untested backup is a belief, and the first restore must not happen
      during the incident. Tighter numbers were rejected as describing the tool rather than the operator:
      an RTO of one hour cannot be met by one person who may be asleep.
      What the rehearsal has to prove is **both stores together** — that the R2 objects survive alongside
      the rows that reference them, since a restored `photoKey` pointing at a deleted object is a
      half-recovery nobody would notice until a Worker did.
      **Sets:** `docs/policy/data.md` → `backup-rpo` and `backup-rto`; the rehearsal is a numbered step in
      the go-live runbook.
- [x] **C18** — **What "reduced to non-identifying counts" retains**, on both paths that reach it
      (NFR11's deletion and NFR17's 12-month reduction). At three municipalities and launch volume,
      `(city, skill, month, workHappened, wasPaid)` may still re-identify one person.
      **Risk if wrong:** a record a Worker was told is anonymized identifies her. **Owner:** Data lead,
      with Security owner.
      **Answer: global monthly totals, with no city and no skill dimension.** The reduction — on both
      paths, NFR17's twelve months and NFR11's deletion — produces four integers per month: exchanges,
      check-ins answered, work-happened, was-paid. No dimension survives that can narrow toward one
      person, so "non-identifying" is true at any volume rather than true above a traffic level nobody
      is measuring. A k-threshold over `(city, skill, month, …)` was rejected as a suppression rule to
      build, test and re-check as volume changes, for analysis nothing yet asks for.
      **This keeps ADR-0007's impact evidence intact**, because the evidence that ADR names is a total
      rather than a cross-tab.
      **Follows:** a `MonthlyMetric` entity — `month`, `exchanges`, `checkInsAnswered`, `workHappened`,
      `wasPaid`, all `internal` — written by the purge job at reduction time; NFR17's phrase "reduced to
      non-identifying counts" resolves to exactly those columns.
- [x] **C19** — **Whether the Consent row — the _prueba de la autorización_ — survives the purge of the
      Account it authorizes.** Proposal: it survives, reduced to the versions and timestamps with no
      identifier beyond a hash.
      **Risk if wrong:** the evidence that we were permitted to hold her data is destroyed while a
      24-month Report about her survives. **Owner:** Security owner, as _responsable_.
      **Answer: no — the Consent row is purged with everything else.** Story 13 tells her deletion removes
      everything from the platform, and that sentence is either true or it is not. A retained proof row,
      even reduced to a hash, is a record she was told did not survive, and the person being protected
      from over-retention is the same person whose authorization it evidences.
      **What this costs, stated plainly:** the evidence that we were permitted to hold her data is gone,
      while a Report about her may still be inside its 24-month window. If a _reclamo_ ever arrives about
      a deleted Account, the answer is that the record was deleted at the _titular_'s request and nothing
      about it survives — which is a defensible position precisely because it is the one she was
      promised.
      **Follows:** Consent joins NFR17's leaf-first purge order and NFR11's deletion path with no
      exception; the deletion confirmation copy may say "everything" without qualification.
- [x] **C20** — **Two structural decisions where two advisories disagree, taken by this spec and worth
      confirming.** (a) **Workspaces:** the draft's four collapsed to two, because `@repo/db`'s stated
      invariant was already violated and a withholding `exports` map is a stronger boundary than a
      package split; the data lens implicitly assumed the split. (b) **The cache:** DD1 removes
      `use cache` entirely, which the data lens analysed carefully rather than argued for.
      **Risk if wrong:** (a) collapsing and later needing the split costs a day of moving files;
      keeping four costs three permanent boundaries and a contradiction with
      [ADR-0002](../../adr/0002-reporting-vendor-seam.md)'s "a seam, not an abstraction layer". (b) if
      NFR2 is missed, caching returns with a proof obligation attached. **Owner:** Tech lead
      (arbitrating simplicity vs data).
      **Answer: both confirmed.** (a) **Two workspaces.** `@repo/db`'s stated invariant — nothing imports
      it except `@repo/domain` — was already violated by `@repo/auth`'s own description, and a
      withholding `exports` map is a stronger boundary than a package split because it fails at the
      import rather than at review. It is also what [ADR-0002](../../adr/0002-reporting-vendor-seam.md)
      means by "a seam, not an abstraction layer". (b) **No `use cache`**, per DD1 and
      [ADR-0011](../../adr/0011-no-shared-cache-until-a-measurement-requires-one.md): if NFR2 is missed,
      caching returns with a measurement attached to it.
      The asymmetry decides it: collapsing now and splitting later costs a day of moving files, while
      keeping four costs three permanent boundaries and a standing contradiction with ADR-0002. That is
      the cheap direction in which to be wrong.

### Appended by `/spec-review` (2026-08-25, fidelity)

C21–C38 are advisory recommendations the synthesis dropped or diluted, found by the fidelity check
against the four committed advisories. C39–C42 come from the three mechanical shape checks and from
one obligation the intent placed on Design. **Note on cross-references:** `security.md` and
`simplicity.md` independently numbered their concerns `C-S1`–`C-S8`, so an advisory ID is ambiguous
on its own — each concern below names its advisory.

- [x] **C21** — **No trust boundary is named and no STRIDE walk exists.** The security advisory
      listed seven boundaries this change crosses and noted the three outbound ones — object storage,
      Resend, Sentry — are "where personal data leaves the system, which is why they are not optional
      rows". The spec keeps only `[trust]` / `[network]` markers, which the advisory called "the right
      instinct" while noting no boundary carries a threat walk.
      **Risk if wrong:** the advisory's own summary — the spec is strong on disclosure and thin on the
      other five STRIDE letters. **Owner:** Security owner.
      **Answer: both — a design-time boundary walk now, `/security-audit` against the code later.**
      A new deep dive, **DD16**, lists all seven boundaries this change crosses with what crosses each and
      what authorizes it, then walks STRIDE across the three **outbound** ones — object storage, Resend,
      Sentry — because those are where personal data leaves the system. A full seven-boundary walk was
      rejected as mostly restating DD5, DD7 and DD11.
      The two are complementary rather than redundant: design-time modelling catches a wrong shape — an
      authorization living in the wrong layer — which is a rewrite by the time a code audit finds it, and
      the table is also the input that makes the audit sharper, since that skill's first phase otherwise
      infers an architecture for itself.
      **Follows:** DD16 is written into this spec; the pre-announcement `/security-audit` run is C8's.
- [x] **C22** — **A freeze stops sending and nothing else.** A reported Hirer keeps full gated read
      access to every Worker's `about` and work history, and any already-`delivered` Offer stays live
      and acceptable, until a human acts — with `on-call-rotation` = nobody and a 24 h queue. The
      security advisory asked that `reportOffer` also suspend his gated reads of _her_ profile and
      mark his undelivered Offers non-deliverable. NFR15 bounds further Offers only.
      **Risk if wrong:** the protective response to an accusation covers one of three channels.
      **Owner:** Security owner.
      **Answer: both halves.** A freeze holds his **undelivered** Offers as non-deliverable pending
      review — held, not rejected, so an Admin who clears the Report releases them — and **suspends his
      gated reads** for as long as he is frozen. Already-`delivered` Offers are untouched: they are
      already in her hands and hers to accept, decline, report or block.
      **The asymmetry with C3 is deliberate.** A Block is her permanent personal refusal and reaches only
      the send; a freeze is the platform's temporary response to an accusation under review, so it may be
      stronger precisely because it expires. With `on-call-rotation` at nobody and NFR7's 24-hour band,
      the freeze is the only protection that acts within minutes.
      **Follows:** Offer gains an `on_hold` state on the `pending_review` branch; `GET /profile/[slug]`
      refuses a frozen caller the way it refuses a missing profile; `unfreezeHirer` releases both.
- [x] **C23** — **Whether a purge reaches backups.** Distinct from C17, which asks the recovery
      question. The security advisory's point is a compliance one: "a 12-month purge with an unstated
      backup retention horizon is not a _supresión_; it is a delay." NFR17 defines "deleted" as rows,
      objects and logs — backups are not in that list.
      **Risk if wrong:** story 13 tells a Worker deletion "removes everything from the platform" while
      the row survives in backups — a false statement to a _titular_, made on the deletion screen.
      **Owner:** Data lead (with Security owner).
      **Answer: name the backup horizon and say so to her.** `retention-backups` is **7 days** — ample
      above C17's RPO ≤ 1 h and RTO ≤ 4 h — deletion is complete when that window rolls past, and story
      13's copy states both halves: removed from the platform immediately, and from backups within seven
      days. A _supresión_ with a stated short horizon is defensible; an unstated one is the delay the
      advisory named, and the current copy is a false statement made to a _titular_ on the deletion
      screen.
      **Follows:** NFR17's definition of "deleted" gains backups with its horizon; `docs/policy/data.md`
      gains `retention-backups`; the deletion confirmation copy carries the seven days.
- [x] **C24** — **The publish-rate queue signal has no number.** The security advisory asked for "an
      Admin queue signal when publish volume exceeds a **stated per-hour figure**"; DD7 says "a queue
      signal above a stated publish rate" and states none. The other two halves of that answer landed
      with numbers (≤ 3/day, one profile per Account). NFR7's ≤ 20/hour is Offers, not publishes.
      **Risk if wrong:** the mechanism designed to spread attention to displaced people is the one
      that hands a flooder the top of the list, undetected. **Owner:** Security owner.
      **Answer: a queue signal above 10 published profiles per hour, platform-wide.** It is a signal and
      not a ceiling — publishing is never refused, the Admin queue simply says the rate is unusual. At
      three municipalities and launch volume, 10/hour sits well above ordinary traffic. **Announcement
      day will trip it, and that is correct**: the one day a flood could hide inside real traffic is the
      day the operator wants to be looking.
      Per-IP was rejected for a stated reason: DD5 already records that Fly proxies every request, so a
      flood from one person on mobile data rotates addresses while a shared NAT trips the signal — it
      misses the case it exists for and fires on the case it does not.
      **Follows:** DD7's "a stated publish rate" resolves to this number, and it joins the Admin queue's
      sixth signal alongside the five branch counts.
- [x] **C25** — **`AdminAction` is `Could` while two sections assert it unconditionally.** The API
      contract ("each writing an `AdminAction`") and DD7 ("every action writes an `AdminAction`") both
      make it mandatory; story 23 is `Could`, outside the announcement gate. The security advisory
      called repudiation "the one STRIDE letter with no entity behind it".
      **Risk if wrong:** the audit table need not exist when the site opens, so an abuse incident or a
      Ley 1581 _reclamo_ is reconstructed from mutable rows — and the spec contradicts itself about
      whether it is optional. **Owner:** Security owner (with Tech lead on the tier).
      **Answer: `AdminAction` is promoted to `Must`.** It is one table and one insert inside transactions
      that already exist, and repudiation is the STRIDE letter with no other answer in this design — a
      Ley 1581 _reclamo_ about a takedown, or an abuse incident in week one, is otherwise reconstructed
      from mutable rows. Logging the actions instead was rejected on NFR17's own numbers: logs live 30
      days and a Report lives 24 months, which is why DD7 chose a table.
      This also removes the contradiction the concern names — the API contract and DD7 already assert it
      unconditionally, and now they are true.
      **Follows:** story 23 moves from `Could` to `Must` and comes inside the announcement gate; the
      insert shares the transaction of the action it records, so an action cannot commit unaudited.
- [x] **C26** — **Email template escaping — the mechanism changed after this was raised, and the
      owner should confirm rather than re-decide.** The advisory asked for explicit escaping at the
      template seam because DD7 called email "the one path where React's escaping does not apply".
      Adopting React Email (DD14) makes the templates React components, so escaping is by construction
      again and the residual rule is mechanical: no `dangerouslySetInnerHTML`, no `<Markdown>` over user
      text, both testable at seam 1. What remains for the owner is whether that is accepted as
      satisfying the advisory.
      **Risk if wrong:** stored HTML injection into an inbox, reaching both sides of an unverified
      market. **Owner:** Security owner.
      **Answer: accepted, with the residual rule made mechanical.** React Email templates are React
      components, so escaping is by construction and the advisory's ask is satisfied at the level it was
      asking about. What remains is a two-clause rule — **no `dangerouslySetInnerHTML` in a template, and
      no `<Markdown>` over user-supplied text** — and it is tested rather than asserted: seam 1 renders
      each template with a scripted payload in the user-controlled field and asserts the rendered HTML is
      escaped.
      The test is the part that matters, because React's guarantee holds right up until someone reaches
      for `dangerouslySetInnerHTML` to make a line break work.
      **Follows:** the assertion joins seam 1's list in Testing Decisions, one case per template carrying
      user text.
- [x] **C27** — **A failed webhook verification is not logged.** The contract carries three of the
      advisory's four asks — signature, replay window, idempotency, bodyless 401 — and drops "logged
      with the event id and nothing else". DD11's twelve-event list has no webhook-failure event.
      **Risk if wrong:** a forged bounce is an account-lockout primitive, and there is no record that
      forgeries were attempted. **Owner:** Security owner.
      **Answer: log a rejected webhook, event id and reason only.** One `info` line carrying the event
      id and the failure as an enum — `bad_signature`, `stale_timestamp`, `replayed_id` — and nothing
      from the body, the headers, or any address inside them. It joins DD11's event list as a thirteenth
      entry, which is what makes "were forgeries attempted" a question with an answer.
      No threshold band is attached: with no traffic history the number would be invented, and the line
      is queryable the moment anyone asks.
      **Follows:** DD11's list grows by one event; the bodyless `401` in the webhook contract is unchanged
      — the caller still learns nothing.
- [x] **C28** — **Session and Verification carry no classification and no retention.** The data
      advisory flagged that these hold `secret`-class tokens and appear in neither NFR17's retention
      graph nor NFR18's egress bound. Both omissions are still true.
      **Risk if wrong:** the two tables holding the only credential in the system sit outside the
      retention graph and outside the egress bound. **Owner:** Data lead (with Security owner).
      **Answer: both are classified `secret`, and both join both graphs.** `secret` is a class above
      `personal`: the value never reaches a log line, a Sentry event, or the subject-access export —
      NFR18's zero covers it and NFR16's export excludes it, because handing a _titular_ her own session
      token is not habeas data, it is a credential disclosure.
      Retention: a **Session** row is deleted at expiry and on `signOutEverywhere`; a **Verification** row
      is single-use and deleted on use, with a sweep for the unredeemed. Both enter NFR17's leaf-first
      purge order ahead of Account. Leaving retention to the library's defaults was rejected on the
      grounds that an undocumented default is not a retention answer.
      **Follows:** NFR17 gains two rows and NFR18 gains the `secret` class; `@repo/domain/export` excludes
      both by whitelist, which is the same mechanism NFR10 tests.
- [x] **C29** — **Every Better Auth upgrade is now a schema-diff review, and the spec does not say
      so.** The mechanism half landed exactly (`additionalFields`, never a hand-added column); the
      standing cost the "one schema owner" decision buys was not written down.
      **Risk if wrong:** a regeneration drops the shared-device column silently — sessions revert to
      30 days and a borrowed phone keeps her account, with no failing test. **Owner:** Data lead.
      **Answer: the concern's premise is wrong, and nothing new is needed. Corrected rather than
      implemented.** `additionalFields` are declared in the **auth config**, and
      `npx @better-auth/cli generate --output …` derives the Drizzle schema _from that config_. A
      regeneration therefore re-emits the declared field every time; it cannot silently drop it. The
      generated schema file is an artifact, not a source of truth, which is what the Account entity's note
      already says.
      What is actually true, and is the whole of the standing cost: 1. **Never hand-edit the generated schema file** — a hand-added column is what a regeneration drops,
      and that is the failure the concern was reaching for. 2. **Re-run the CLI after adding a plugin.** The two-factor plugin brings its own tables; forgetting
      this is the common Better Auth mistake, not a lost custom field. 3. An upgrade that changes Better Auth's own tables produces an ordinary Drizzle migration, reviewed
      as any migration is under C14's expand/contract, and **DD13's integrity test (NFR30) already
      fails** if the generated schema and the migrations disagree.
      A second dedicated test was rejected as duplicate machinery for a failure DD13 already catches.
      **Follows:** DD5 gains those three lines; no new test, no per-upgrade review process.
      **Amended 2026-08-28, with #12 (PR #77):** the resolution's premise — that the schema is
      generated — did not survive contact with the version-matched generator. The CLI exists and was
      run, but its pg type map cannot emit `TIMESTAMPTZ`, `citext`, or a `CHECK` (DD2's requirements),
      so generated output would need hand-editing on every regeneration. The schema is hand-written
      and `auth-schema.test.ts` pins it to `getSchema()` from the installed library — which is the
      "second dedicated test" this entry rejected, shipped because the generation guarantee it
      duplicated no longer exists. DD13's integrity check still holds the schema-to-migrations half;
      the pin holds the schema-to-library half the generator was supposed to. DD5's paragraph now
      states the pin mechanism.
- [x] **C30** — **The duplicate-phone moderation signal was lost.** `phone (E.164)` landed; the
      non-unique index on the normalized value did not, and DD2's index table has no phone row. The
      data advisory noted this is "a moderation signal, not a verification gate, so it stays inside
      ADR-0008".
      **Risk if wrong:** the one Sybil signal available without breaching ADR-0008 is unavailable to
      the Admin. **Owner:** Data lead.
      **Answer: restored as a moderation signal.** A **non-unique** index on the normalized E.164 phone,
      and a duplicate-phone flag on the Admin queue reading "N profiles share this number". Not a
      uniqueness constraint and not a verification gate — families and shared households genuinely share
      one handset, and [ADR-0008](../../adr/0008-open-enrolment-with-published-non-verification.md)
      declined verification deliberately. It stays inside that ADR because it informs a human rather than
      refusing a person.
      It is also the only Sybil signal available to an Admin at all, on a platform whose single trust
      control is the moderation queue.
      **Follows:** DD2's index table gains the phone row; the Admin queue gains the flag.
- [x] **C31** — **Whether Better Auth stores session tokens hashed at rest** (data advisory D9). This
      reached the spec only as a bullet in _What was not verified_ — the risk sentence survived, the
      **owner did not**, so it is not among the boxes a human checks to approve.
      **Risk if wrong:** unhashed, one database read is session hijack of every Worker, and NFR13's
      revocation surfaces do not help. **Owner:** Security owner.
      **Answer: owned by the Security owner, discharged before the first auth ticket merges.** It moves
      out of _What was not verified_ and into this list, so it is a box a human checks rather than a
      sentence a human reads. The discharge is reading `better-auth@1.7.1`'s session storage once the
      package is installed — not recalling it, and not inferring it from documentation.
      If tokens turn out to be stored plaintext at rest, the mitigation is decided at that point and
      NFR13's revocation surfaces do **not** substitute for it: one database read would be session hijack
      of every Worker, and revocation only helps someone who already knows.
- [x] **C32** — **The spread mechanism sits on the surface that does not get the traffic.** Ordering
      lives on `/profiles`; the Wall is newest-first and is the indexable, most-linked, most-shared
      surface, so most Hirer traffic bypasses the mechanism entirely. The realized-distribution SLI
      the operability advisory asked for **did** land in NFR22 — but its reporting surface is story
      20, which is `Should`.
      **Risk if wrong:** the fairness property this product is partly built on is asserted, bypassed,
      and observed only if a `Should` story ships. **Owner:** Tech lead (with On-call lead).
      **Answer: the Wall stays newest-first; story 20 is promoted to `Must`.** Newest-first carries
      something the fairness ordering does not — a Worker who publishes today sees herself on the front
      page, and that is the moment she tells her neighbours. Trading it for spread would buy the
      mechanism traffic at the cost of the thing that brings the traffic.
      **So the mechanism stays partial, and the answer is to measure it rather than assert it.** NFR22's
      realized-distribution report — the share of delivered Offers going to the single most-contacted
      profile over a rolling 7 days — moves inside the announcement gate. If the Wall is bypassing the
      spread badly, that number says so within a week, and the decision to reorder can then be taken
      against evidence instead of against a worry.
      **Follows:** story 20 moves from `Should` to `Must`; NFR22 binds it as a `Must`.
- [x] **C33** — **The uptime monitor has no interval and no alert threshold.** The advisory proposed a
      1-minute interval alerting after 2 consecutive failures — "detection in ~2 minutes versus 'when
      a Worker mentions it to someone' is the entire difference this product can afford". NFR28 asks
      only that the monitor be "firing".
      **Risk if wrong:** with nobody on call, detection latency is the entire mitigation, and it is
      unspecified. **Owner:** On-call lead.
      **Answer: a 1-minute interval, alerting after 2 consecutive failures.** Detection in roughly two
      minutes rather than "when a Worker mentions it to someone" is, as the advisory put it, the entire
      difference this product can afford — with nobody on call, detection latency **is** the mitigation.
      Two consecutive failures rather than one keeps a single transient blip out of C10's machine-band
      path, which matters because an operator who closes issues unread has no alerting at all.
      **Follows:** NFR28's "firing" resolves to those two numbers; the probe is `GET /api/health`, which
      already has a ≤ 50 ms bound and returns no data.
- [x] **C34** — **No machine memory floor.** The advisory proposed **1 GB** as one of three saturation
      answers; the other two (photo cap, browser-side downscale) landed in DD6 in full. DD6 argues
      in-process multipart buffering "is the memory-saturation shape that kills a single Fly machine"
      and then states no bound.
      **Risk if wrong:** the deep dive names the failure mode and omits the number that answers it.
      **Owner:** On-call lead.
      **Answer: a 1 GB memory floor.** The third of the advisory's three saturation answers; the other
      two — the photo size cap and the browser-side downscale — already landed in DD6 in full. Node plus
      Next plus a connection pool is tight on 512 MB before a request arrives, and 1 GB is the smallest
      size that is not a gamble on a machine nobody is watching.
      **Follows:** DD6 states the number beside the photo cap, and `fly.toml` carries it.
- [x] **C35** — **The Postgres connection pool is never capped, and a forward reference points at a
      commitment that does not exist.** _What was not verified_ says PlanetScale's limit "is what
      turns **DD2's pool cap** into a number" — DD2 makes no pool cap.
      **Risk if wrong:** saturation stays a word rather than a number, on a single machine whose
      every cold start reopens the pool. **Owner:** On-call lead (with Data lead).
      **Answer: a pool cap of 10 per machine, with the plan's real limit verified before launch.** One
      machine and one pool, so 10 sits well inside any PlanetScale plan ceiling and well above what a
      single Node process serving this traffic needs. `min` is 0, because every cold start reopens the
      pool anyway (DD10), and a connect timeout surfaces as an `AppError` rather than a hung request.
      The dangling forward reference in _What was not verified_ now has a target: what remains unverified
      is the **plan limit**, and that becomes a numbered go-live runbook check rather than an assumption.
      **Follows:** DD2 gains the pool row; the runbook gains the check.
- [x] **C36** — **Deferring the retention purge was overridden silently.** The simplicity advisory
      argued the purge is twelve months of carrying cost for a job whose first run is twelve months
      away, and that adding it in August 2027 costs about the same. DD10 keeps it and argues only that
      a silently-stopped purge is an undetected exposure — a case for monitoring it, not for building
      it now. **Further Notes** records five overrides and this is not among them.
      **Risk if wrong:** a `Must`-path day spent against a closing announcement window, and the
      override list stops being trustworthy as a complete record. **Owner:** Tech lead.
      **Answer: the scheduled purge job is deferred, with a dated tripwire; the override is recorded.**
      What still ships is the **immediate** deletion path — NFR11 and story 13, on request, unrelated to
      the schedule. What defers is the periodic job, whose first real work falls around August 2027 for
      every table in NFR17's graph.
      DD10's objection — that a silently-stopped purge is an undetected exposure — is answered without
      building it: a test **fails once 2027-06-01 passes** with no purge job registered, so the reminder
      is red CI rather than memory. That is the part the simplicity advisory could not have known was
      available.
      **Follows:** the purge job leaves the `Must` set; the tripwire test joins seam 1; **Further Notes**
      gains this as a recorded override, which is also what keeps that list trustworthy as a complete
      record.
- [x] **C37** — **Why the photo earns a `Must` slot is never stated.** The spec designs the path
      thoroughly (DD6) and corrects the fifth-account claim, but does not say why it is `Must`. The
      advisory's framing: "it may well be right — a face is plausibly what makes a Hirer choose a
      person over a fund — but an unstated reason is one nobody can weigh against a closing window."
      **Risk if wrong:** cutting it removes what may be the thing that makes a Hirer choose a person;
      keeping it costs an object store, a queue source, and NFR4's one exception — and neither side of
      that trade is written down. **Owner:** Tech lead (with Design lead).
      **Answer: it stays `Must`, and the reason is
      [ADR-0009](../../adr/0009-a-workers-full-identity-is-gated-and-never-indexed.md)'s own.** That ADR
      removed the loss narrative and named its replacement in the same breath — "One line in her own
      words about what she does, and a face." The photo is not decoration on that decision, it is the
      other half of it: with the damage story deliberately gone, a headline and a face are the entire
      emotional surface a Hirer meets. Cutting it does not save a feature, it leaves the ADR's answer
      half-built.
      **Follows:** that sentence goes into the photo story and the head of DD6, so a future cut has to
      argue against the ADR rather than against a tier.
- [x] **C38** — **Twenty-five-odd Server Actions, each hand-verified by one person.** Testing
      Decisions makes the obligation stricter than the draft did — every action's authorization
      verified by requesting the endpoint unauthenticated — while the action count is unchanged and
      the cost is acknowledged nowhere.
      **Risk if wrong:** the definition-of-done burden scales with the action count and is paid by the
      one unpaid person the whole effort is racing. **Owner:** Tech lead.
      **Answer: make it mechanical — one table-driven test over an action registry.** A single test
      enumerates every Server Action and asserts an unauthenticated call is refused, and the registry's
      **completeness** is itself asserted against the exported action modules, so an action added without
      a row is red rather than forgotten.
      This is the only version of the obligation that survives twenty-five repetitions by one tired
      person. The stricter wording in Testing Decisions stays exactly as written; what changes is that it
      is discharged once by a test instead of twenty-five times by hand.
      **Follows:** Testing Decisions gains the registry test at seam 3; per-ticket manual verification
      drops to the actions whose authorization is more than "is there a principal" — ownership scoping
      still gets its own case.
- [x] **C39** — **NFR26's second half protects the adversary, not the user.** It says a refusal
      returns rather than throws, so a crawler cannot spend the Sentry quota — and never says what a
      **legitimate** person gets when she hits a ceiling. No surface in the UX state table has a
      rate-limited state.
      **Risk if wrong:** a Worker who trips `publishProfile ≤ 3/day` after two failed attempts is
      stopped with no message, no retry-after and no path, by a requirement that passes green — the
      exact shape the second-half rule exists to catch. **Owner:** Design lead (with Tech lead).
      **Answer: every ceiling returns a typed refusal carrying a retry-after, and every limited surface
      gains a rate-limited state.** The refusal is an `AppError` with `code: "rate_limited"`, a
      `retryAfter`, and a `userMessage` in her terms — NFR26's return-don't-throw rule is unchanged, so a
      crawler still spends no Sentry quota, but a person now learns what happened and when she may try
      again.
      The UX state table gains one row per surface that has a ceiling. The case that motivated this is
      concrete: a Worker who trips `publishProfile ≤ 3/day` after two failed attempts currently gets
      nothing at all — no message, no retry-after, no path — from a requirement that passes green.
      **Follows:** the UX state table grows a rate-limited column entry per limited surface; the retry-after
      is part of the refusal shape in the API contract.
- [x] **C40** — **DD11's event list does not state what membership means.** "Every safety-relevant
      transition emits one `info` line…" followed by twelve events reads either as _exactly these_ or
      as _these plus any other safety-relevant transition_.
      **Risk if wrong:** Build picks one reading without asking, which is the failure effort 0001 paid
      a wrong implementation and a mid-Build amendment for. **Owner:** Tech lead.
      **Answer: exactly these — a closed list.** Adding a fourteenth event is a spec amendment, not a
      judgment call made at Build time by whoever is writing that action. This is the same discipline the
      cross-boundary types already use ("exactly these keys are present on the wire") and the same reason
      `CLAUDE.md` treats the guaranteed log field names as a stability contract: a drain's queries bind to
      the vocabulary, and a vocabulary that drifts silently is not one.
      It also closes the failure the concern names — Build picking one reading without asking, which
      effort 0001 paid a wrong implementation and a mid-Build amendment for.
      **Follows:** DD11 states membership explicitly and the list stands at thirteen with C27's
      `webhook_rejected`.
- [x] **C41** — **An obligation the intent placed on Design was not discharged.** [Intent
      Q3](./intent.md): "Design states what the queue does when one person is away for three days:
      Offers accumulate undelivered, and whether that is silent or visible to a waiting Hirer is a
      decision, not an implementation detail." NFR7 sets the bound and admits best-effort; the
      decision is made nowhere, and the Sent Offers row in the state table has no state for an Offer
      still unreviewed past 24 h.
      **Risk if wrong:** the Hirer — the scarce side, whose attention is the resource the whole effort
      is racing — waits with no signal and no expectation set. **Owner:** Design lead (with On-call
      lead).
      **Answer: visible, and derived rather than stored.** Sent Offers renders `pending_review` with the
      normal window stated from the moment he sends, and past the band renders a delayed variant computed
      from `deliveredAt IS NULL AND sentAt < now() - interval '24 hours'`. **No new enum value and no new
      column** — `SentOffer` gains a derived `reviewDelayed` boolean, which is a projection question of
      exactly the kind `photoUrl` already is. The Spanish is in the component; the state, the column and
      the field name are English
      ([ADR-0012](../../adr/0012-spanish-is-the-interface-english-is-the-code.md)).
      No email is sent, so this costs nothing against C45's warm-up on precisely the days the queue is
      already backed up. The Hirer is the scarce side, and leaving him to guess is how he is lost.
      **Follows:** the Sent Offers row of the UX state table gains the delayed state; `SentOffer` gains
      `reviewDelayed`; [intent Q3](./intent.md)'s obligation on Design is discharged here.
- [x] **C42** — **Story 18, the seven-day check-in, is bound by no NFR and cannot run until after
      launch.** [ADR-0007](../../adr/0007-the-platform-never-handles-money.md) calls it "the only
      evidence available" of whether any of this produced income, and no requirement measures whether
      it works — no response-rate number, no send-success number. The simplicity advisory separately
      noted it "cannot be needed until seven days after the first Contact Exchange… worth saying so it
      is not built before" — which is also its scheduling answer.
      **Risk if wrong:** the platform's only impact evidence ships unmeasured, and any figure published
      from it carries an unknown response rate on top of ADR-0007's self-reporting qualification.
      **Owner:** Tech lead (with On-call lead on the number).
      **Answer: bind an NFR, and schedule the ticket as late as it truly is.** The requirement: every
      Contact Exchange schedules a check-in to both sides at seven days; **send success is measured**; and
      any figure published from the responses carries its **response rate** alongside
      [ADR-0007](../../adr/0007-the-platform-never-handles-money.md)'s self-reporting qualification. Those
      two numbers are what turn the only impact evidence that exists into evidence rather than an
      anecdote.
      The simplicity advisory's scheduling point is adopted with it: this cannot be needed until seven
      days after the **first** Contact Exchange, so it is not built before launch — but it is a real
      deadline (first exchange + 7 days) rather than a backlog item, which is the distinction that keeps
      it from being forgotten.
      **Follows:** a new NFR binding story 18; the ticket is ordered after the announcement-gate work with
      that deadline stated on it.

### Appended after the Better Auth review (2026-08-25)

- [x] **C43** — **There is one Admin, and losing the TOTP device locks the platform's only moderator
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
      **Answer: all three.** (1) Ten backup codes generated at setup, **printed and stored offline**.
      (2) A **second Admin grant** held by the same person on a separate device with its own TOTP secret —
      this is the one that actually recovers the platform in minutes rather than hours. (3) A documented
      **break-glass** in the go-live runbook: an `UPDATE` disabling the second factor, executed over the
      direct connection, which is itself a credential C5's store and rotation list must name.
      The standing hazard is recorded with them: **rotating `BETTER_AUTH_SECRET` invalidates the second
      factor entirely**, so that rotation is a runbook procedure and never a routine credential refresh.
      **Follows:** the go-live runbook gains all three steps; the second grant is made by the same
      documented manual `UPDATE` as the first (DD7).
      **Amended 2026-08-30 with #96.** The answer stands and two of its three legs changed shape, because
      the Admin door no longer has a password. (1) The codes are still ten, and the storage rule is now
      **not reachable by the same unlock as the mailbox**, which is the other factor. "Printed and stored
      offline" was the first restatement and it did not survive shaping the enrolment screen, which
      settled on a clipboard button and no print affordance — a runbook demanding paper from a UI that
      offers none is a rule that loses. The medium was never the point; the separation is. (2) The second grant is `pnpm admin:enrol` run a
      second time rather than a manual `UPDATE`. (3) The break-glass is **re-enrolment** over the direct
      connection rather than an `UPDATE` disabling the second factor: with no password there is no
      one-factor door left to fall back to, so the old break-glass has no destination. That is stronger
      than what it replaces — it ends with a working authenticator instead of an account openable by a
      single secret. The standing `BETTER_AUTH_SECRET` hazard is unchanged: it still encrypts the TOTP
      secret and the codes, and rotating it still invalidates them.
- [x] **C44** — **`trustDevice` at its 30-day default contradicts NFR13's 8-hour Admin session.**
      Trusting a device skips the _second factor_ on re-authentication, so an 8-hour non-rolling
      session would be re-established on a password alone for a month — on the account that can take
      down a profile and read every phone number in the system. Proposal: **disable trusted devices
      for the Admin outright**; if that is judged too costly for a person moderating daily, cap
      `trustDeviceMaxAge` at the session length so the two numbers stop disagreeing.
      **Risk if wrong:** NFR14 is satisfied on paper — the session did complete 2FA once — while the
      practical factor count drops to one for thirty days at a time.
      **Owner:** Security owner.
      **Answer: trusted devices are disabled for the Admin outright.** `trustDevice: false`, so TOTP is
      entered on every Admin sign-in. Moderating daily means six digits once a day, which is the right
      price for the account that can take down a profile, unfreeze a Hirer, and read every exchanged phone
      number in the system.
      Capping `trustDeviceMaxAge` at the session length was the spec's fallback and is rejected: it still
      leaves a borrowed or stolen laptop as an Admin session on a password alone until the day ends, and
      it keeps two numbers in a relationship someone has to remember. Disabling removes the contradiction
      instead of negotiating it down.
      **Follows:** DD5's Better Auth configuration table gains the row; NFR14's "2FA on the session
      itself" now holds on every sign-in rather than on the first of a trusted month.
      **Amended 2026-08-30 with #96.** The conclusion is unchanged and its mechanism is now an absence.
      `trustDevice` was a body field on Better Auth's `twoFactor` plugin, and the Admin door no longer
      uses that plugin — so there is no setting to disable and no request field to strip. TOTP is entered
      on every Admin sign-in because the door has no other path through it. A resolved concern whose
      enforcement moves from a flag to a structural absence is worth recording rather than silently
      re-satisfying: the next person to read C44 should not go looking for the option.

### Appended after the Resend / React Email review (2026-08-25)

- [x] **C45** — **The announcement is a spike onto a sending domain that has never sent anything, and
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
      **Google sign-in (DD5) materially reduces this** — a Worker on Android never touches the email
      door — but it does not close it: Offer notifications, Contact Exchange deliveries and the
      seven-day check-in all still send, and a Hirer abroad may well have no Google account. The
      warm-up still has to happen; what changes is that a failure degrades the product instead of
      closing it.
      **Risk if wrong:** the platform opens, Workers publish, Hirers arrive, and the ones who came
      through email cannot sign in. It is silent: sends are accepted, not bounced, and NFR27's
      conversion metric is the only thing that would show it — after the window has closed.
      **Owner:** On-call lead (with Repo owner on the announcement plan).
      **Answer: all three mitigations; the deliverability measurement is a go-live runbook step rather
      than a `Must` gate.** (1) **Warm the sending domain from the first deploy** — every ticket's test
      sends count toward the curve, so warming costs no dedicated work. (2) **Stage the announcement**
      rather than making it one event, so volume tracks the warm-up rather than outrunning it. (3) **Hold
      a pre-warmed fallback subdomain**, so a reputation problem on the primary is a DNS change instead of
      a rebuild.
      The measured check into real Colombian Gmail and Hotmail inboxes — SPF, DKIM and DMARC verified,
      inbox-versus-spam confirmed by eye — is a numbered step in the go-live runbook and does not block
      the announcement. **The risk that carries is stated:** a runbook step taken under launch-day
      pressure is the one most likely to be ticked without being done, and this is the check whose failure
      is silent, since sends are accepted rather than bounced.
      **Google sign-in (DD5) reduces the blast radius and does not remove it** — a Worker on Android never
      touches the email door, but Offer notifications, Contact Exchange deliveries and the seven-day
      check-in all still send, and a Hirer abroad may have no Google account.
      **Follows:** the go-live runbook gains the warm-up curve, the staged announcement plan, the fallback
      subdomain, and the inbox check as separate numbered steps.

### Appended by `/spec-review` (2026-08-25, fidelity — second pass)

C46–C57. The first pass checked the **synthesis** against the advisories; this one checks the
**answer-and-reconcile round** that resolved C1–C45, because that round rewrote roughly a thousand
lines and is its own opportunity to lose something. C46–C53 come from the fidelity agent, C54–C57
from the three mechanical shape checks. Every box was unchecked when this section was appended, which
stopped tickets at the Design gate until an owner resolved them — the correct outcome of reviewing an
approved spec, not a problem to work around. **All twelve are now answered**, and each answer names
what it changed in the document above; two of them (C46's Block scope, C50's client-side instrument)
were decisions the repo owner took rather than findings with one obvious resolution.

- [x] **C46** — **C3's answer reversed two advisories, and Further Notes does not record it.** Both
      the security and the data advisory asked for the **opposite** of what C3 decided, and each was
      explicit that the gated read was the half the design _could_ deliver: security.md — "The design
      can deliver invisibility at `/perfil/[slug]` and refusal at `sendOffer`, and it cannot deliver
      it on the public list without giving up the cache"; data.md — "The design can honour 'he can
      send her nothing' **and** 'he cannot open her gated profile'; it cannot honour invisibility."
      The spec now says the reverse in three places, including "**A Blocked caller is served
      normally** — a Block reaches the send only". C3's answer carries the reasoning, and story 11's
      copy is honest, so nobody is sold a protection that does not exist. **Two things are still
      wrong.** First, **Further Notes** opens "Six, each recorded because a silent override is what
      `/spec-review` exists to catch" and this is not among the six — the same bookkeeping failure
      C36 was raised for, one round later. Second, it sits against C22's own argument: a _frozen_
      Hirer, accused and unreviewed, loses his gated reads, while a _Blocked_ one, permanently
      refused by name, keeps them.
      **Risk if wrong:** the person she refused reads her `about` and work history indefinitely, and
      the override list an approver trusts as complete is not. **Owner:** Security owner (with Data
      lead — both advisories raised it).
      **Answer: the decision stands, and the record is corrected.** C3's narrowing is kept — a Blocked
      caller is served normally and the Block is checked at `sendOffer` alone — and it is now
      **override 7** in Further Notes, quoting both advisories, naming what it costs her (the person she
      refused keeps reading her `about` and work history), and stating the C22 asymmetry as accepted
      rather than unnoticed. The bookkeeping failure is the part that was actually wrong: the list said
      "Six" one round after C36 was raised for an incomplete list.
      **Why not the other way.** Closing the gated read is cheap to build, and the reason against it is
      not cost: it makes a Block mean two different things on two surfaces — refused at the send,
      invisible at the profile, still visible on the Wall — and story 11 has to describe that to a woman
      deciding whether she is safe. One edge checked at one place is the version of this whose copy can
      be true. **The trigger that would reverse it is named**: a Report whose substance is "he kept
      reading my profile after I blocked him", arriving through `/triage`.
      **Follows:** Further Notes gains override 7; the API contract, the high-level design and the UX
      table already state the behaviour and are unchanged.
- [x] **C47** — **The fifth abuse case was dropped, and C4 made it worse.** DD7 carries four of the
      security advisory's five cases in substance and omits this one: "As an attacker I accept an
      Offer, so that a real person's name, phone and email are delivered to me for the cost of one
      email address." It is the case that runs **against the Worker's counterpart** rather than
      against her, which is the advisory's central charge — "almost every protective mechanism in
      the draft points at the bad Hirer." C4 now collects `hirerName` and `hirerPhone` and snapshots
      them into `ExchangedContact`, so a fake profile that accepts an Offer harvests self-asserted
      Hirer identity **as well as** an email. Nothing in the spec says why the case is absent.
      **Risk if wrong:** the exchange is a two-way disclosure and only one direction is threat-modelled
      — after this session widened what crosses in the undefended direction. **Owner:** Security owner.
      **Answer: the fifth case is restored to DD7, with one new control.** It is written as the case
      running **against the Worker's counterpart** — a profile that is not a person, accepting the
      Offers it attracts to harvest a real Hirer's name, phone and email — and it names why C4 widened
      it. The controls that already bound it are listed rather than assumed (the exchange happens only
      on **her** acceptance of **his** Offer, so the attacker cannot initiate; every Offer is
      human-reviewed before delivery; `publishProfile` ≤ 3/day and one profile per Account; the photo is
      reviewed before it is public; C30's duplicate-phone flag; story 11's plain statement that a
      Hirer's own name and phone are self-asserted). The gap that was real is closed with a **queue
      signal above 5 completed Contact Exchanges with distinct Hirers from one profile in 7 days** —
      informing, never blocking.
      **No ceiling on `acceptOffer`, deliberately.** Refusing a Worker the acceptance she has waited for,
      to slow an attacker who can simply wait a day, spends the wrong side's patience — and the same
      shape is what success looks like, which is why the answer is a signal a human reads.
      **Follows:** DD7 gains the fifth bullet; the `/admin` API row and story 7 gain the fourth signal.
- [x] **C48** — **C26 accepted half of what the advisory asked; the `href` half is nowhere.** The ask
      was "explicit escaping at the template seam **and no raw `<a href>` built from user text**".
      React Email's escaping — the mechanism C26 accepts as satisfying this — constrains element
      **content** and not an **attribute**, so a `javascript:` or attacker-controlled URL interpolated
      into a link survives it, as do both clauses of the replacement rule (no
      `dangerouslySetInnerHTML`, no `<Markdown>` over user text). The nearest text in the spec is an
      accessibility line about descriptive link text, which is a different requirement.
      **Risk if wrong:** stored injection into an inbox by attribute rather than by content, reaching
      both sides of an unverified market, past a control everyone believes is closed. **Owner:**
      Security owner.
      **Answer: the rule gains a third clause, and it is the attribute one.** DD7 and DD14 now read
      **no `dangerouslySetInnerHTML`, no `<Markdown>` over user text, and no `href` — or any other
      URL-valued attribute — built from user text**, in the app and in a template alike. The reasoning
      is stated where the rule is, because the mistake is subtle: React's escaping constrains element
      **content** and leaves an attribute alone, so `<a href={userText}>` carrying `javascript:` or an
      attacker-chosen host passes every mechanism C26 accepted. Every URL this product renders or sends
      is **constructed server-side from values the server owns** — the app origin, a route constant, a
      slug, an Offer or exchange id — and never from a field a person typed. Free text stays text: the
      rejector already refuses a messaging-app URL inside it, and what survives is rendered as content
      and never linkified.
      **Follows:** DD7's rule, DD14's rule, DD16's Tampering cell, and the Testing Decisions entry,
      which now renders each template twice — once for content escaping, once asserting **no rendered
      `href` derives from a `javascript:` payload** — with the same attribute assertion at seam 1 over
      every free-text field.
- [x] **C49** — **The Report-rate queue signal has a rate and still no threshold and no surface.**
      The advisory asked for "a Report rate per profile, **and a queue signal when one profile
      reports many Hirers**". The rate landed with a number (`reportOffer ≤ 10/day`, NFR26); the
      signal survives only as DD7 prose. This is the identical shape **C24** was raised for one pass
      ago and answered with a number — and the API contract's `/admin` row now enumerates its signals
      exhaustively ("plus two signals that are not queue items: the publish rate above 10/hour and
      the duplicate-phone flag"), so this one is excluded by a list that reads as closed.
      **Risk if wrong:** a handful of bad-faith Reports removes the scarce side of the market for a
      day, undetected. **Owner:** Security owner. **Proposal, by analogy with C24:** a signal above
      **3 Reports from one profile in 7 days**, informing rather than blocking.
      **Answer: the proposal, taken as written — more than 3 Reports from one profile in 7 days.**
      Informing rather than blocking, beside C24's publish rate on `/admin`, because the freeze is what
      protects her while she waits and a Report is never silently dropped. The rate half
      (`reportOffer` ≤ 10/day) was already there; what was missing was the number and the surface, which
      is the identical shape C24 was raised for and answered with.
      **Follows:** DD7's third bullet carries both halves; the `/admin` API row's signal enumeration
      grows from two to four and now **states its own membership** — exactly four, a fifth is a spec
      amendment — so this class of omission stops being possible in that row.
- [x] **C50** — **NFR2's user-measured number has no instrument, and Further Notes claims it as
      accepted.** The operability advisory's finding was the _absence of an instrument_ — "nothing in
      this design measures the user's experience of latency, anywhere, ever… a regression that
      doubles real Worker-side page load is invisible to every instrument this spec names." **Further
      Notes** #1 records it as "**accepted** and became NFR2's second number", and C12 has since made
      ≤ 1200 ms the inherited default. But nothing produces the figure: analytics and RUM are **Out of
      Scope**, the uptime monitor probes `/api/health` in ≤ 50 ms, and NFR28's load test runs against
      the machine. _What was not verified_ confirms the gap in passing.
      **Risk if wrong:** two policy keys and one NFR commit to a number nobody can read, and the users
      on the most constrained connections pay a latency tax no instrument reports. **Owner:** On-call
      lead.
      **Answer: the number stays and stops claiming an instrument it does not have.** NFR2 is rewritten
      to say that its two numbers are measured by different things and only one is continuous: the
      server-side p95 is read from the log line on every request; the client-side 1200 ms is a
      **measured figure on a cadence, not a monitored SLI** — taken at go-live from a real Colombian
      connection under 4× network and 4× CPU throttling, and re-taken monthly and after any change to
      the Wall's payload or the photo path.
      **Why not a beacon.** A ~1 KB `PerformanceObserver` posting to a Route Handler would close the gap
      and was considered. It was declined because it is product instrumentation on a page a displaced
      person loads, in a product whose `analytics-consent` is `UNSET` under Ley 1581, and because the
      thing it would buy — continuous p95 — is a number nobody is on call to read. **The residual risk
      is stated rather than closed:** a regression between two measurements is invisible, and the users
      on the most constrained connections are the ones who pay for it.
      **Follows:** NFR2 rewritten; NFR28 names the measurement in the announcement leg; the go-live
      runbook gains **§11**; Further Notes #1 is corrected from "accepted" to "accepted in part"; the
      `default-latency` row in the policy table — and the key itself in
      [`docs/policy/operability.md`](../../policy/operability.md) — say which half is monitored; the
      Pereira↔`iad` RTT moves out of _What was not verified_ and into §11 beside the figure it explains.
- [x] **C51** — **The 404 half of the Sentry-quota finding was dropped, and the spec has since
      multiplied 404s.** The advisory said "rate-limit refusals **and any throwing 404** will burn the
      Sentry error quota, and a spent quota means the second incident of the month is invisible."
      NFR26's second half answers the rate-limit clause exactly and the 404 clause is nowhere. Five
      surfaces in the UX state table now refuse with `404`, and C22 added another: a frozen caller at
      `GET /profile/[slug]` gets "the same response as a missing profile". An unauthenticated
      enumeration sweep of `/profile/[slug]` is precisely the shape the advisory named, against a
      5,000-error monthly allowance.
      **Risk if wrong:** a crawler spends the month's allowance in a day and the second real incident
      is invisible. **Owner:** On-call lead. **Proposal:** a not-found is a **returned** response, not
      a thrown error, on every one of those surfaces — which is DD11's "thrown is reported; returned
      is logged" applied to the case the advisory named.
      **Answer: the proposal, taken as written — a not-found is a returned response, never a thrown
      error.** NFR26's second half now counts both: **0** rate-limit refusals and **0** of the `404`
      surfaces reach `onRequestError`. That is six surfaces — the five in the UX state table plus C22's
      frozen caller at `GET /profile/[slug]` — and profile enumeration is the cheapest path there is to
      a 5,000-error monthly allowance, which is precisely the shape the advisory named. It is DD11's
      "thrown is reported; returned is logged" applied to the case the advisory named rather than a new
      rule.
      **Follows:** NFR26's second half; a line under the UX state table repeating it where a person
      implementing a `permission denied` cell will read it, because `notFound()` is the habit this
      overrides.
- [x] **C52** — **Story 15 grew where the simplicity advisory asked it to shrink, and the override is
      unrecorded.** The ask: "Story 15 shrinks to two files and a runbook line… What CI adds is the
      _human_ path and the deploy trigger." The CI and deploy half landed exactly as asked. The
      shrink was overridden by NFR30 and DD13 — a machine-checked migration-integrity suite **no
      advisory requested** — and story 15 now reads "**This story is expected to split into two
      PRs**", which is the opposite of the recommendation's direction. **Further Notes** records six
      overrides and this is not among them.
      **Risk if wrong:** the advisory's arithmetic — "The `Must` list is not a scope statement; it is
      a date. Every story kept in it is a day the Hirer side is not being asked for anything" — and an
      override list that is again incomplete. **Owner:** Tech lead (with Repo owner on the CI half).
      **Answer: the override stands and is recorded as override 8.** NFR30 and DD13 stay `Must`, for a
      reason the advisory's arithmetic does not reach: this repo has **no migration history yet**, and a
      guardrail is cheap on day zero and expensive after the first hand-edited migration reaches the
      default branch — building it later means building it against drift that already exists. The
      advisory's quoted arithmetic ("The `Must` list is not a scope statement; it is a date") is carried
      in the entry rather than paraphrased, because it is the strongest thing against this decision.
      **The two-PR split is not an exception to anything**: `stacked-prs` is **yes** for genuine chains,
      and the CI/deploy half blocking the guardrail half is exactly such a chain.
      **Follows:** Further Notes gains override 8; story 15 is unchanged.
- [x] **C53** — **NFR16 adopted the distinction and kept the binding.** The advisory: "NFR16 is a
      runbook, not an NFR… As an NFR it binds stories 13 and 14, and `/to-tickets` copies bound
      criteria onto tickets — producing an acceptance criterion no diff can satisfy and no reviewer
      can tick with evidence." The spec adopts the distinction in words ("**The clock is a runbook,
      not a diff.**"), routes the calendar correctly into the runbook's §7, and carves out a
      genuinely buildable half in `@repo/domain/export` — then keeps the business-day clocks **and**
      `**Binds:** 13, 14`, so the unsatisfiable criterion still travels to a ticket beside the
      satisfiable one.
      **Risk if wrong:** a `Must` ticket carries a criterion whose evidence is a calendar, which is
      how a definition of done stops meaning anything. **The weakest finding of this pass** — it may
      well be the right call, and nothing in the spec says it is a weaker commitment than the
      advisory asked for. **Owner:** Tech lead (with Security owner on the compliance half).
      **Answer: the binding is scoped to the half a diff can satisfy.** NFR16 is now the
      **subject-access export** and nothing else — one function, built from the same whitelist mechanism
      as the three projections, so a new `personal` column omitted from it fails the same class of
      sentinel test as NFR10 — and that is what `Binds: 13, 14` carries to a ticket. The business-day
      clocks move out of the requirement and into the go-live runbook's §7, where a step ending in a
      calendar belongs, and the NFR says in one line why: **a business-day clock binds no story, because
      no diff advances it and no reviewer can tick it with evidence.**
      Nothing is weakened — the clocks are still stated, still verified against Ley 1581 arts. 14–15,
      still owned — but they stop travelling to a ticket as an acceptance criterion nobody can satisfy.
      **Follows:** NFR16 rewritten in two parts; runbook §7 keeps the clocks.
- [x] **C54** — **Two stories are bound by no NFR, and one of them is now `Must`.** All 32 NFRs carry
      a non-empty `Binds:` and every story they name exists — but nothing binds **story 22** or
      **story 23**, and C25 promoted story 23 into the announcement gate this session. This is the
      defect class **C42** was raised for ("story 18 is bound by no NFR"), closed there by adding
      NFR31 and re-opened one story over by a promotion in the same round.
      **Risk if wrong:** a `Must` ticket ships with no requirement measuring whether it works — for
      story 23, the audit record a Ley 1581 _reclamo_ depends on. **Owner:** Tech lead.
      **Answer: two NFRs, one per unbound story.** **NFR33** binds story 23: **100%** of the eleven
      `/admin` actions write an `AdminAction` **in the same transaction as the action itself**, so **0**
      commit unaudited — asserted by a table-driven test over the same action registry C38's
      authorization table already enumerates, so an action added without a row is red rather than
      forgotten — carrying ids and enum values only, **0** of NFR10's sentinels, retained 24 months.
      **NFR34** binds story 22: **0** unresolved rows in `README.md`'s placeholder table, `PRODUCT.md`
      naming Recomencemos and the three municipalities, **0** statements in `CLAUDE.md` instructing a
      reader to judge a change by whether it improves a template.
      **NFR34 is a reading rather than a script, and the counts are what make it tickable.** A
      documentation story with no requirement is the one that quietly ships half-done, and this one
      exists because a future agent inheriting the template's judging criterion will apply it to product
      code.
      **Follows:** two NFRs added; the closing paragraph of the section says why, and names C42 as the
      same defect one story over.
- [x] **C55** — **The Admin queue's cap has no second half.** Each of the five branches is
      `` `LIMIT`-capped``, justified as "an unbounded union after three days away is exactly when the
      surface needs to still load" — and nothing states whether the **count and the age-of-oldest are
      computed over the whole branch or over the capped page**. NFR7's band and story 7's
      age-on-every-screen are both read off that number.
      **Risk if wrong:** the backlog is understated exactly when it is worst, by the instrument built
      to catch it — a bound that passes green while the thing it measures is lost. **Owner:** Tech
      lead (with On-call lead, whose band depends on it).
      **Answer: over the whole branch, always — the cap bounds the rows rendered, never the numbers
      read off them.** Each branch's count and age-of-oldest come from a separate `COUNT(*)` /
      `MIN(created_at)` over the **full** pending predicate, on the same partial index that serves the
      capped page, so both are index-only scans. A page capped at 50 that reported a depth of 50 would
      be an instrument that goes green exactly when the backlog is worst — and NFR7's band and story 7's
      age-on-every-screen are both read off that number.
      **Follows:** story 7 in the high-level design states it; the `/admin` API row states it in the same
      cell as the cap, so the two are read together.
- [x] **C56** — **DD16's boundary list states no membership.** It opens "Seven boundaries, and what
      authorizes each" without saying whether that is exhaustive or illustrative. DD11's event list
      received exactly this treatment at **C40** ("exactly these fourteen; a fifteenth is a spec
      amendment"); the boundary table added in the same round did not.
      **Risk if wrong:** a new egress is added at Build without anyone treating it as a boundary,
      because the table read as illustrative — and the table is also what `/security-audit` is handed
      as input. **Owner:** Tech lead.
      **Answer: closed — exactly these seven, and an eighth is a spec amendment.** The same rule DD11's
      event list carries since C40, written into DD16's opening for the same reason: the table is what
      `/security-audit` is handed as its input, and a table read as illustrative is an egress added at
      Build that nobody modelled.
      **Follows:** DD16's opening sentence.
- [x] **C57** — **NFR26's own rule contradicts the list that implements it.** The third half says
      "every surface with a ceiling carries a rate-limited state in the UX state table". NFR26 names
      seven action ceilings plus the read ceiling; the table covers seven of the eight and omits
      **`requestSkill`** (≤ 5/day) — which is story 3's path, hit by a Worker **mid-publish**, the
      exact moment C39 was raised about.
      **Risk if wrong:** the concern that existed to stop a Worker meeting silence at a ceiling leaves
      one ceiling meeting silence. **Owner:** Design lead (with Tech lead), matching C39.
      **Answer: `requestSkill` gains its row, and the rule gains a check.** The rate-limited table now
      covers all eight ceilings, and NFR26's third half says the coverage is **checked as a list against
      that table rather than by eye** — the omission was one ceiling out of eight, which is exactly what
      eye-checking misses. What she is told at `requestSkill ≤ 5/day`: that the requests already sent
      are queued and not lost, when she may ask again, and that she can publish now with the closest
      Skill on the list and edit later — she is **mid-publish** when she meets this, which is the moment
      silence costs the most, and the case C39 existed for.
      **Follows:** one row in the rate-limited state table; one clause in NFR26's third half.

### Policy keys set by this effort

C13's sweep, discharged. Every key below moved from `UNSET` to a value in the same change that
answered the concern naming it.

| Key                                | File                    | Set to                                                                                                                  | From      |
| ---------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------- |
| `session-lifetime`                 | security.md             | 30 d own device / 8 h shared / 8 h Admin, non-rolling                                                                   | NFR13     |
| `secret-store`                     | security.md             | `fly secrets`, mirrored in a password manager                                                                           | C5        |
| `csp-policy`                       | security.md             | `default-src 'self'; frame-ancestors 'none'; …`, enforced                                                               | C6        |
| `dependency-policy`                | security.md             | CI fails on `high`+ in a direct dependency                                                                              | C7        |
| `pentest-cadence`                  | security.md             | None external; two tiers of agent review                                                                                | C8        |
| `orm`                              | data.md                 | Drizzle, schema in the ORM, committed SQL migrations                                                                    | DD2       |
| `pk-strategy`                      | data.md                 | `BIGINT IDENTITY`; UUIDv7 only where an id reaches a URL                                                                | DD2       |
| `soft-delete`                      | data.md                 | No — hard delete plus objects plus reduction to counts                                                                  | DD8       |
| `migration-policy`                 | data.md                 | Expand/contract, forward-fix, no `down`                                                                                 | C14       |
| `retention-personal`               | data.md                 | NFR17's graph, purged leaf-first                                                                                        | NFR17     |
| `retention-internal`               | data.md                 | Monthly counts indefinite; `AdminAction` 24 mo                                                                          | C18, C25  |
| `retention-logs` / `log-retention` | data.md, operability.md | 30 days                                                                                                                 | NFR17     |
| `retention-backups`                | data.md                 | 7 days                                                                                                                  | C23       |
| `backup-rpo` / `backup-rto`        | data.md                 | ≤ 1 h / ≤ 4 h, proven by one real restore                                                                               | C17       |
| `alert-destination`                | operability.md          | Daily digest for human queues; `needs-triage` for machine                                                               | C10       |
| `default-availability`             | operability.md          | 99.5% monthly, externally measured                                                                                      | C9, C33   |
| `default-latency`                  | operability.md          | p95 ≤ 400 ms server, monitored; ≤ 1200 ms user-measured, on a cadence by a human (runbook §11) rather than instrumented | C12, C50  |
| `error-budget-policy`              | operability.md          | >50% burn → fixes only, daily cadence                                                                                   | C11       |
| `rollback-mechanism`               | operability.md          | Bluegreen, health-gated, ≤ 5 min by one command                                                                         | NFR25     |
| `required-checks`                  | build.md                | lint, check-types, test, build, dependency audit                                                                        | NFR25, C7 |
| `branch-protection`                | build.md                | Required status checks, no required reviews                                                                             | C16       |
| `stacked-prs`                      | build.md                | Yes, for genuine chains only                                                                                            | C16       |
| `browser-support`                  | ux.md                   | Baseline Widely Available                                                                                               | NFR5      |
| `voice-guide`                      | ux.md                   | **`UNSET` by decision** — blocks the first copy-bearing ticket                                                          | C2        |

`pr-merge-method` is set to **rebase** in the same sweep. It was not raised as a concern, but C16
turned `stacked-prs` on and the two interact directly: a stack is a chain of branches each based on
the one below, and squashing or merge-committing a lower PR rewrites the base every branch above it
was cut from. Rebase is the merge method a stack is built on.

Still `UNSET` and **not** raised by this spec: `motion-policy` and `analytics-consent` (ux.md), and
`coverage-floor` (build.md).

## Runbook obligations

**Sixteen of the answers above, plus DD10's scheduler, end in a step only a human can perform**, and a spec that names such a
step without producing a ticket has moved the work nowhere. They are collected in
[`docs/runbooks/recomencemos-go-live.md`](../../runbooks/recomencemos-go-live.md), which this effort
writes, and **`/to-tickets` cuts one ticket to execute it** — the document is written; running it is
the work, and several steps cannot be taken until the infrastructure they configure exists.

| Runbook § | What a human does                                                                                                                                                                                                                                | From              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| 1         | Set seven credentials in `fly secrets`, mirror them, keep them out of every `.env`                                                                                                                                                               | C5, C43           |
| 2         | Read the connection limit; enable extensions; set backup retention to 7 days; rehearse one restore                                                                                                                                               | C35, C17, C23     |
| 3         | Create **two** buckets — public access on the photos one, never turned on for the quarantine one; prove it with a control pair; enable Cloudflare transformations (amended by #251)                                                              | DD6               |
| 4         | Publish DNS, verify SPF/DKIM/DMARC with `dig`, warm the domain from the first deploy, hold a fallback subdomain, stage the announcement, measure into Colombian inboxes                                                                          | C45               |
| 5         | 1 GB machine, enforced CSP, uptime probe at 60 s / 2 failures, machine bands to `needs-triage`                                                                                                                                                   | C34, C6, C33, C10 |
| 5b        | Create the Trigger.dev project, set the shared secret in both places, deploy four schedules, prove each endpoint rejects an unsigned call and is idempotent, point Sentry's cron monitor at the digest                                           | DD10              |
| 6         | Enrol the first Admin end to end, print backup codes offline, enrol a second Admin device, rehearse break-glass. _Amended 2026-08-30 with #96: "grant, then enrol" is now one command that grants **last**, and the break-glass is re-enrolment_ | C43, C44          |
| 7         | Name every processor in the _aviso_, take express transmission consent, file each DPA, check Circular 005                                                                                                                                        | C15               |
| 8         | Required status checks, dependency audit, `gh-stack`, one rehearsed rollback                                                                                                                                                                     | C7, C16, NFR25    |
| 9         | Wire `/security-review` per PR; run `/security-audit` once before the announcement                                                                                                                                                               | C8                |
| 10        | Walk the announcement gate                                                                                                                                                                                                                       | NFR28             |
| 11        | Measure the client-side figure from a real Colombian connection under 4× network and 4× CPU throttling, record it beside NFR2's number, and re-take it monthly and after any change to the Wall's payload or the photo path                      | C50, NFR2         |

**The ordering constraint that matters: §4 starts at the first deploy, not at the end.** Domain warm-up
is the only step here with a lead time measured in weeks, and it is the one whose failure is silent.

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

### Amendments made during Build

**One, and it is a narrowing rather than a change of intent.**

1. **The gated read admits `active`, not "anything but `frozen`."** Story 5 and the `GET
/profile/[slug]` row both said _"whose `offerSendingState` is not `frozen`"_, which was written
   before `banned` existed as a third member and reads, literally, as serving the whole gated
   catalogue to the one principal an Admin removed on purpose. `banned` is the **stricter** state —
   C22's own argument is that a freeze may be stronger precisely because it expires, so a ban cannot
   be weaker than one. Both sentences now say `active`, and `mayReadGatedProfile` states the
   predicate positively over the registry, so a fourth member added later is refused rather than
   admitted by omission. Raised by `/code-review`'s Spec axis on #23, which is also where the
   argument for amending rather than reverting is set out.

### Advisor recommendations overridden, and why

Eight, each recorded because a silent override is what `/spec-review` exists to catch. The sixth was
added while resolving the flagged concerns, and it reverses a fifth-listed decision rather than
defending it — which is the point of keeping the list complete. **The seventh and eighth were added by
the second review pass** (C46, C52), which found the list incomplete one round after C36 was raised
for exactly that — the bookkeeping, not the decisions, is what keeps failing here.

1. **Operability C-OP8 — move the region from `iad` to `mia`.** Overridden on fact and on decision.
   **Fly has no Miami region**; its only South American region is `gru` (São Paulo), and Colombian
   international traffic routes north, so `gru` is worse for Pereira than `iad`. PlanetScale offers no
   Colombian region either. The repo owner confirmed N. Virginia. The advisory's underlying point —
   that a server-side p95 measures our comfort rather than hers — was **accepted in part**, and C50 is
   the correction to what this entry used to claim. It became NFR2's second number, but the advisory's
   actual finding was the **absence of an instrument**, and this product still has none: analytics and
   RUM are Out of Scope, the uptime monitor probes `/api/health`, and the load test runs against the
   machine. NFR2 now says so, and the number is measured on a cadence by a human (runbook §11) rather
   than monitored. **The residual risk is named rather than closed:** a regression between two
   measurements is invisible, and the users on the most constrained connections are the ones who pay
   for it.
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
6. **Simplicity — defer the retention purge job.** The draft overrode this **silently**, which C36
   caught. On review the advisory was right: every table in NFR17's graph has its first purgeable row
   around August 2027, so building the job now is twelve months of carrying cost. DD10's counter —
   that a silently-stopped purge is an undetected exposure — argued for monitoring it, not for
   building it early, and is answered by a test that fails once 2027-06-01 passes with no job
   registered. **The override is withdrawn**; the advisory's recommendation stands.
7. **Security and data — a Block closes the Blocked Hirer's gated read of her profile.** Overridden,
   knowingly, at C3 and recorded here at **C46**. Both advisories asked for this and both were explicit
   that it was the half the design _could_ deliver — security.md: "The design can deliver invisibility
   at `/perfil/[slug]` and refusal at `sendOffer`, and it cannot deliver it on the public list without
   giving up the cache"; data.md: "The design can honour 'he can send her nothing' **and** 'he cannot
   open her gated profile'; it cannot honour invisibility." The spec goes the other way: **a Blocked
   caller is served normally, and the Block is checked at `sendOffer` alone.** The reasoning is C3's —
   one edge, checked at one place, is a Block that behaves the way its copy says it does, and a partial
   protection is the kind a person relies on. **What this costs is stated rather than softened:** the
   person she refused can keep reading her `about` and her work history for as long as the profile is
   up, and story 11's copy says so in her words rather than implying more.
   **The asymmetry with C22 is real and is accepted.** A _frozen_ Hirer — accused, unreviewed — loses
   his gated reads, while a _Blocked_ one, permanently refused by name, keeps them. The freeze is a
   platform state with a human reviewing it on a 24-hour clock; the Block is her own permanent edge and
   is deliberately narrow, because a Block that quietly reshaped what the site serves would be a
   protection nobody could describe accurately on the notice. **If this is revisited, the trigger to
   watch for is a Report whose substance is "he kept reading my profile after I blocked him"** — that
   is the evidence this override was wrong, and it arrives through `/triage` rather than through
   prediction.
8. **Simplicity — story 15 shrinks to two files and a runbook line.** Overridden on the shrink,
   accepted on the CI-and-deploy half, recorded here at **C52**. The advisory's arithmetic is quoted
   because it is the strongest thing against this: "The `Must` list is not a scope statement; it is a
   date. Every story kept in it is a day the Hirer side is not being asked for anything." NFR30 and
   DD13 — a machine-checked migration-integrity suite no advisory requested — stay `Must` anyway, for
   one reason: this repo has **no migration history yet**, and a guardrail is cheap on day zero and
   expensive after the first hand-edited migration reaches the default branch. Building it later means
   building it against drift that already exists. The story is **expected to split into two PRs**,
   which `docs/policy/build.md`'s `stacked-prs` = yes makes an ordinary chain rather than an
   exception — the CI/deploy half is the blocker, the guardrail half sits on top of it.

### What was verified rather than recalled

Named so a reader knows which claims carry weight: PGlite's Postgres version (read from the shipped
`pglite.wasm`) and its bundled extensions (read from the package); PlanetScale's Postgres versions,
regions and extension support; Fly's region list and `flyctl` v0.4.87's `releases` / `deploy --image`
flags (run locally); Better Auth 1.7.1's magic-link options, session options, `dont_remember` cookie
and issue #4491's closure; Ley 1581's arts. 14–15 clocks and the RNBD threshold in Decreto 1074 de
2015; CUOC's establishing decree and resolution; Baseline's 30-month definition; the `engines.node` of
every dependency this spec pins; `CARRIER_PATHS` in the shipped `packages/errors/src/redaction.ts`;
and **Trigger.dev's free-tier figures and execution model**, read from its pricing and scheduled-tasks
documentation on 2026-08-25 — $5/month of credits, 20 concurrent runs, 10 schedules, minute-granularity
cron with IANA timezones, 1-day log retention, and the fact that **task code runs on Trigger.dev's
infrastructure rather than in the application**, which is the fact that decided DD10's shape.

### Appended with the passwordless Admin door (2026-08-30, #96)

- [x] **C58** — **The Admin's first factor is now email delivery, on a domain C45 says may not
      deliver.** Under the design this amendment replaces, the Admin held a password and could sign in
      with the mail path completely down. Now the first factor is a link to a mailbox, sent through
      Resend on a sending domain that C45 describes as cold, capped at 50–100 sends a day in week one,
      and carrying "unmeasured deliverability into Colombian inboxes" from [intent Q1](./intent.md). A
      delivery failure, a warm-up throttle, a hard bounce or a spam placement is now an **outage of the
      moderation queue**, and it arrives exactly when volume is highest — the announcement — which is
      also when the queue matters most. C43's second recovery path does not cover it: a second Admin
      grant on a separate device is still reached by an emailed link, and on the same address it is the
      same mailbox.
      **Risk if wrong:** the platform's only moderator cannot get in on the day the announcement lands.
      Every Offer stays undelivered behind NFR7's 24-hour band and every reported Hirer stays frozen —
      the same failure C43 was raised about, reached by a route C43 does not guard.
      **Options, and none is free.** (a) **A second Admin on a different provider's address**, enrolled
      at go-live — the cheapest, and it makes C43's second leg cover this too, at the cost of a second
      set of codes to store. (b) **Send the Admin link through a separate, already-warm channel** — a
      second Resend domain or a different provider for this one email — which is a real dependency for
      one message a day. (c) **A break-glass session minted by the CLI** over the direct connection,
      bypassing email entirely; strongest availability, and it re-introduces a door that a shell alone
      opens, which is exactly what DD7 warns about. (d) **Accept it**, on the grounds that the
      break-glass is re-enrolment and the operator holds the migration credential anyway.
      **Owner:** Security owner (with On-call lead).
      **Answer: (d), accepted.** The Security owner's judgement is that Resend delivers reliably from a
      cold domain and that this does not warrant a mitigation of its own. Recorded as a decision rather
      than as an omission, so that a future delivery incident is read against a position somebody took
      and not against a gap nobody saw.
      **What the acceptance does not cover, and is handled elsewhere.** The residual risk is not
      Resend's sending quality — it is the Admin's **mailbox** being unreachable for a reason that has
      nothing to do with the sender: a provider outage, a locked account, a deleted address. That is a
      C43 failure and C43's second Admin already answers it, on one condition worth stating: **the two
      Admin addresses are not in the same mailbox.** That line stays in runbook §6 as a C43 step, where
      it costs nothing and covers a failure this acceptance does not reach.
      **What would reopen this:** a delivery failure or a warm-up throttle observed against the Admin
      link specifically. `magic_link.requested` already carries the correlator that would show it.

### What was not verified, and should be before Build

- **Better Auth 1.7.1's actual generated schema** — table names, whether it indexes
  `session.account_id`, and whether `additionalFields` reaches the `verification` record as DD5
  assumes. **Session token hashing at rest moved out of this list** and into concern C31, with the
  Security owner on it and a discharge before the first auth ticket merges: the risk sentence was here
  and the owner was not, so it was not among the boxes a human checks.
- **Whether PlanetScale requires dashboard enablement** for `citext` and `pg_trgm` before
  `CREATE EXTENSION` works. If so it belongs in the go-live runbook.
- **PlanetScale's connection limit** on the chosen plan. DD2 now caps the pool at **10 per machine**
  (C35), so what remains unverified is the ceiling that cap sits under — a numbered go-live runbook
  check rather than a dangling forward reference.
- **Actual Pereira↔`iad` RTT.** The 90–110 ms in NFR2 is an estimate. It is measured at runbook §11
  alongside the client-side figure it explains (C50), rather than left as a dangling forward
  reference.
- **Whether SIC's Circular Externa 005 de 2017 lists the processors' countries as offering an adequate
  level of protection.** C15 deliberately does not depend on the answer — express authorization for the
  international transmission is taken either way — but the answer changes what the go-live runbook's
  per-processor contract step has to produce.
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

### Appended with editing a published CapabilityProfile (2026-09-02, #139)

This document assumed editing existed in four places and built it in none. NFR9 called the slug
"stable across **edits**", DD4 said `searchText` is written "on publish **and on edit**", the **Own
profile** row's `success` cell read "Edit saved", and the seventh-state copy for `requestSkill` told a
Worker she could publish with the closest Skill on the list and **edit later**. No user story asked
for it, the Worker table of the API contract carried no `updateProfile`, and no ticket under this
spec's issue built it — so #16 shipped `/my-profile` as a read-only view and said so in its brief.
Editing was also absent from **Out of Scope**, which is what makes this an omission rather than a
refusal. Story 24, the `updateProfile` row and the ceiling on it are the amendment.

**`publishedAt` is untouched, and it is the one rule the issue that raised this did not state.** The
Wall reads `capability_profile (published_at DESC, id DESC) WHERE state = 'published'`. C32 kept the
Wall newest-first knowing that bypasses NFR22's rotation, and promoted story 20 to `Must` so that the
realized attention spread is **measured** rather than asserted. An edit that stamped `publishedAt`
would make editing a free bump to the top of the most-linked, most-shared surface on the site — a
Worker who learned the trick would sit at the top of it indefinitely, and story 20 would go on
reporting a fairness property the site no longer had. `updatedAt` is a separate column and no index
reads it, so the Wall is safe today only by accident. It is written down so that it stays safe on
purpose.

**The rejector runs again, on every free-text field, on every edit.** DD3's rejector is what stops the
consent step being routed around by putting a phone number in the headline, and a field checked once
at publish and never again is a field with a documented way past it. NFR12 binds story 24 for that
reason. It remains what DD3 says it is — a speed bump, not a control.

**NFR4 was widened; NFR3 was not, and the asymmetry is deliberate.** NFR4 named publishing alone,
which left a Worker able to publish on a broken connection and unable to correct what she published on
the same one. The edit form is the publish form minus `consentVersion`, and this repo's form idiom is
already server-first, so the widening asks the ticket for nothing it was not going to build anyway.
NFR3 is different: its budget is stated per **named route**, and adding a route to a page-weight
requirement is a measurement obligation with a real cost. The edit surface inherits `/publish`'s
component budget in practice and is not a route this spec measures. If that turns out to be wrong, the
fix is an NFR3 amendment naming the route, not a silent reading of the existing one.

**What this amendment does not settle, and where it goes instead.** `publishProfile` collects
`consentVersion`; whether an edit made after that version has moved needs a fresh `Consent` row is a
Ley 1581 question, and the answer belongs to the owner of story 14 rather than to a passing sentence
here. It is filed as a `needs-triage` finding
([ADR-0001](../../adr/0001-findings-enter-through-triage.md), issue #143) rather than left in this
paragraph, because a paragraph is where a question like that gets lost. Two
further things stay out on purpose: **the photo**, because `attachPhoto` already swaps one and lands
with the photo ticket (#18) — the two are independent and carry no blocking edge between them; and **a
Worker taking her own profile down**, because `taken_down` is Admin-only moderation and the subject's
own deletion is story 13's Account-level hard delete. DD8's "two deletions, never one mechanism" is
what keeps a third from being invented here.
