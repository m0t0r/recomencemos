---
stage: intent
status: approved
issue: 2
---

# Intent: Recomencemos — from a published CapabilityProfile to the first Contact Exchange

## Problem

Fifteen days ago the 10 August 2026 earthquake took the income of people in Pereira, Dosquebradas
and Santa Rosa de Cabal. Three positions feel what follows, and the third is the reason this cannot
wait for a better-resourced version of itself.

**A Worker** — a receptionist whose building is standing but whose employer is not, a cook whose
restaurant closed, a bricklayer whose contractor left the department. She is able to work today.
What she has lost is not a house but a customer, and the relief that exists is addressed to houses:
the Registro Único de Damnificados records **housing damage**, assessed by Bomberos or Cruz Roja,
and its registration window ends 26 August 2026 — she was never eligible for it
([ADR-0008](../../adr/0008-open-enrolment-with-published-non-verification.md)). Her working reach is
the neighbourhood that lost its income on the same morning she did. The people who could pay her are
elsewhere, and there is no way for them to learn she exists.

**A Hirer** — a Colombian abroad, a family in Bogotá, a company in Madrid, anyone moved by the news.
What is on offer to them is a donation to a fund. They cannot see a person, cannot know what she
does, and cannot choose to pay _her_ for something they actually need done. The instinct to help is
strongest in the weeks when attention is on the region, and there is nothing to point it at but a
bank account belonging to an institution.

**The operating team** is one unpaid person with no legal entity
([ADR-0007](../../adr/0007-the-platform-never-handles-money.md)), and the resource that is
disappearing is not money but attention. When the news cycle moves on, the Hirer side — the scarce
side — goes with it. Every week spent building a more complete platform is a week spent inside a
window that is closing, and a platform that opens after the window has closed has connected nobody.

Nothing about the shape of this problem is technically hard. What makes it hard is that the same
openness that lets a person publish in ten minutes lets anyone else publish too, and that the people
on one side of it are having the worst month of their lives.

## Proposed outcome

A person in Risaralda who lost her income publishes what she can do, and someone anywhere in the
world reads it and offers to pay her for it. The platform introduces them once and gets out of the
way.

From the **Worker's** position:

- She publishes a CapabilityProfile from a phone, in Spanish, in one sitting, with no document to
  produce and nobody to ask for permission
  ([ADR-0008](../../adr/0008-open-enrolment-with-published-non-verification.md)).
- The page describes **what she can do** — Skills from the platform's vocabulary, a photo, one line
  in her own words. There is no field for what she lost, and there will not be one
  ([ADR-0009](../../adr/0009-a-workers-full-identity-is-gated-and-never-indexed.md)).
- Her full name, her full self-description, and her work history are behind an Account; her full
  profile is `noindex`; her phone and email reach nobody until she accepts an Offer. She does not
  acquire a permanent search result describing her at her worst month.
- Every Offer she receives is concrete and immutable, has been read by a human before it reached
  her, and is hers to accept or reject. She can Report one as abusive and she can Block a Hirer
  outright, without explaining herself to anyone.
- She is told plainly, on the site, that the platform holds no money and can recover none for her
  ([ADR-0007](../../adr/0007-the-platform-never-handles-money.md)).

From the **Hirer's** position:

- He browses without an account, because he is the scarce side and registration is the wrong first
  ask. The Wall shows the newest CapabilityProfiles; the full browsable list is ordered to favour
  Workers who have received the **fewest** Offers, so attention spreads instead of concentrating on
  whoever is first.
- Reading a full profile costs him an Account. Sending an Offer costs him concrete terms — the work,
  the pay, the when — that he cannot revise after sending.
- The site tells him, prominently, that **nobody here is verified**, and what to do about that
  ([ADR-0008](../../adr/0008-open-enrolment-with-published-non-verification.md)).
- When she accepts, he gets her contact details and she gets his. That is the end of the platform's
  involvement; everything after it is between two people.

From the **operating team's** position:

- The daily queue — photos, Offers, Reports — is holdable by one person in the time one person has,
  and the platform is honest in its own copy about the review latency that implies.
- A Report freezes a Hirer's ability to send further Offers without waiting for a human, so the
  automatic response to an accusation is protective and the human response is corrective.
- A check-in to both sides seven days after a Contact Exchange is the only evidence that exists of
  whether any of this produced income, and doubles as the way a Worker reports a Hirer who did not
  pay without having to accuse anyone
  ([ADR-0007](../../adr/0007-the-platform-never-handles-money.md)).
- It runs on one machine, costs close to nothing, and nobody is paged.

## Affected users and systems

| Who / what                                      | How                                                                                                                                                                                                                                          |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workers in Pereira, Dosquebradas, Santa Rosa    | The entire product. Sign-in, publishing, receiving and answering Offers, Report and Block, the check-in                                                                                                                                      |
| Hirers, anywhere                                | Browse without an account; Account to read a full profile or send an Offer; the Contact Exchange                                                                                                                                             |
| Admin (one person)                              | A new daily queue surface: photo review, Offer review before delivery, Reports, takedown, unfreeze, Skill vocabulary promotion. The only role that reads contact data in bulk                                                                |
| `apps/web`                                      | Every route, every Server Action, the auth surface, the `noindex` on gated pages. **Gains a Vitest config for the first time** — `CLAUDE.md` defers that to the change that first puts real code in the app, and this is it                  |
| `packages/design-system`                        | Spanish-first components; the six-state set from `docs/policy/ux.md` per surface; WCAG 2.2 AA in one theme                                                                                                                                   |
| A data-access workspace (name TBD at Design)    | Schema, migrations, and queries against PlanetScale Postgres. Server-only. Owns Spanish full-text search over Skills and profile text                                                                                                        |
| The auth surface (workspace TBD at Design)      | Better Auth: magic link for Worker and Hirer, password + TOTP for Admin (`docs/policy/security.md`)                                                                                                                                          |
| A notification seam, over **Resend** (Q1)       | Magic links, Offer-received notice, Contact Exchange delivery, the seven-day check-in. Four sends, and the first is the only way anyone signs in. One channel today; a second is added by implementing the seam, never by editing call sites |
| `.github/workflows/` (Q8)                       | The repository's first CI, because continuous deployment makes the gate's location a correctness question rather than a convenience                                                                                                          |
| `@repo/errors`                                  | Every new cross-boundary type is bound by [ADR-0003](../../adr/0003-no-tojson-on-cross-boundary-types.md): no `toJSON`, one named projection per egress                                                                                      |
| `@repo/observability`                           | `context` may carry ids, counts, and Skill enum values. It may never carry a phone number, an email address, a full name, or an Offer body — which is most of what this effort's data is                                                     |
| `turbo.json`                                    | New `env` / `globalPassThroughEnv` / `passThroughEnv` declarations. Turborepo is in `strict` mode, so an undeclared variable is filtered out entirely, not merely unhashed                                                                   |
| `docs/policy/{security,data,ux,operability}.md` | The keys the open questions below settle must be written back in the same effort, or the next spec raises them again                                                                                                                         |
| `README.md`, `PRODUCT.md`, `CLAUDE.md`          | All three still describe a project template. See **Constraints**                                                                                                                                                                             |
| `CONTEXT.md`                                    | Gains terms as the design names them; the existing eleven are binding vocabulary, not suggestions                                                                                                                                            |
| PlanetScale, Fly.io, Sentry, the email provider | Four external accounts, four sets of credentials, and the first thing this repo has ever deployed                                                                                                                                            |

## Constraints

**This effort contradicts the repository's own governing framing, deliberately.** `CLAUDE.md` opens
with "a **project template**, not a product" and "product-specific code does not belong on `main`";
`PRODUCT.md` describes the primary user as "a developer starting a new product" and still records
"no test runner is wired up", which stopped being true at effort 0001. That framing was correct for
`ai-native-project` and is wrong for `m0t0r/recomencemos`. It is worth reopening because the
repository has already been renamed, rebranded, given a domain model, and given three product ADRs —
the framing is the last piece that has not caught up, and leaving it makes every future agent judge
product code by whether it "makes the template better for a downstream project". **Rewriting
`PRODUCT.md` and the template-facing sections of `CLAUDE.md` and `README.md` is part of this effort,
not a follow-up.**

Bound by ADR, and not reopened here:

- **[ADR-0007](../../adr/0007-the-platform-never-handles-money.md)** — no escrow, no payment rail,
  no fee, no held balance. Offer terms are text. There is no recourse through us and the site says
  so. The seven-day check-in is the only impact evidence, and any published figure carries that
  qualification.
- **[ADR-0008](../../adr/0008-open-enrolment-with-published-non-verification.md)** — no eligibility
  check, and the **absence is published** on the Wall and on every CapabilityProfile. Everything
  protective is downstream of that: human review of every Offer before delivery, standing safety
  guidance on every profile and every Offer, contact details released only at Contact Exchange, and
  free-text fields that **reject phone numbers and email addresses** so the consent step cannot be
  routed around. Verification cannot be added quietly later.
- **[ADR-0009](../../adr/0009-a-workers-full-identity-is-gated-and-never-indexed.md)** — the Wall is
  public and indexable and carries first name, last initial, city, photo, Skills, one line. Full
  profiles are behind an Account and served `noindex`. Full name crosses at Contact Exchange and
  nowhere else. The `noindex` is load-bearing and easy to lose to a share link or an SEO push.
- **[ADR-0003](../../adr/0003-no-tojson-on-cross-boundary-types.md)** — every type crossing the RSC
  boundary is built field by field from a whitelist. This effort is where that precedent gets its
  real test: `CapabilityProfile` has a public shape, a gated shape, and a post-Contact-Exchange
  shape, and they differ by exactly the fields that must not leak.
- **[ADR-0001](../../adr/0001-findings-enter-through-triage.md)** — this effort was opened by a
  human, not promoted from a finding. Nothing here contradicts it.

Settled policy, not reopened at Design:

- **Auth is asymmetric** (`docs/policy/security.md`): magic link with no password for Worker and
  Hirer; password **and** TOTP for Admin. Requiring an authenticator app from a displaced person
  trades a lost phone for a lost profile.
- **The adversary may arrive as a Worker or as a Hirer.** `threat-model-scope` is "anyone on the
  internet", and under ADR-0008 neither side is verified. A design that models only the bad Hirer
  has modelled half the system.
- **`compliance-regime` is Ley 1581 de 2012** (habeas data). It applies because the platform
  collects and publishes personal data about identifiable people. The _responsable del tratamiento_
  is unnamed — see Q4.
- **`store` is PlanetScale Postgres**; `remote-cache-handler` is **none**. `orm`, `pk-strategy`,
  `soft-delete`, and `migration-policy` are explicitly the spec's call, not this intent's.
- **`hosting-target` is Fly.io, one machine**; **`on-call-rotation` is nobody, best effort**. Every
  number a spec proposes is set against a system with no one watching it. Cache entries do not
  survive a deploy, so the release moment is the peak load on that one machine.
- **`locales` is `es-CO` only**, `rtl-support` **no**, `theme-parity` **light only**, `wcag-level`
  **WCAG 2.2 AA**. Spanish is the product's language, not a translation of an English one.
- **Logs are `info`-floor structured JSON to stdout, undrained.** A `trace_id` correlates with a
  Sentry event only once someone wires a drain — `docs/runbooks/observability-go-live.md` is the
  procedure, and it has never been run.

Technical, from the repository as it stands:

- **Cache Components is on**, and `use cache` / `use cache: remote` are **shared across all users**
  while `personal` data may **never** sit in a shared cache (`docs/policy/data.md`). The public Wall
  and a Hirer's own Offer list are opposite answers to the same question, and getting it wrong
  serves one person's data to another.
- **Every Server Action is a public endpoint and authorizes independently.** Middleware is not an
  authorization boundary. Anything passed to a client component is in the browser payload.
- **`apps/web` has no Vitest and its runtime leg is `next-dev-loop`** — Vitest cannot test `async`
  Server Components, so a green build there is not a verification.
- Node 24.x, pnpm 11, TypeScript 7 (a `tsc` binary only — no `tsserver`, no JS compiler API), Next
  16, React 19. A dependency whose `engines` narrows the Node floor fails installs under
  `engineStrict` — that has already disqualified one library here.
- `pnpm lint` is `oxlint . --max-warnings 0`; `pr-size-ceiling` is **1000** reviewed lines;
  `stacked-prs` is `UNSET`, so `/implement` opens one independent PR per ticket.
- **There is still no CI**, and `required-checks`, `branch-protection`, and `rollback-mechanism` are
  all `UNSET`. Q8 makes closing that gap part of this effort rather than a later one: continuous
  deployment moves the gate off a developer's terminal by necessity.

## Open questions

- [x] **Q1** — Which channel actually reaches a Worker, and which provider carries it? Sign-in is a
      magic link with no password, so **email is currently the only key to her account** — and it is
      also the Offer notification, the Contact Exchange delivery, and the seven-day check-in. A
      displaced person on a borrowed phone may have no working email and may live entirely in
      WhatsApp. **Blocks:** whether Better Auth's magic link stays the sole sign-in or gains a phone
      channel; the account-recovery story when the address is wrong; the provider, its sending
      domain, and its deliverability into Colombian inboxes; four `turbo.json` env declarations; and
      whether "she has an email address" is an eligibility bar we did not intend to set.
      **Answer: email only, carried by Resend — and her phone number is captured at publish time
      rather than at Contact Exchange.** Those are one decision, not two. The phone is already the
      thing that crosses at Contact Exchange, so holding it from publish costs no new consent
      conversation and makes SMS or WhatsApp a **new send path later rather than a data migration**.
      Design's obligation is to keep it that way: notification is a seam with one implementation
      today, and a channel is added by implementing the seam, never by editing call sites.
      Three consequences this accepts openly. **A Worker with no working email cannot participate at
      launch, and that is an eligibility bar** — ADR-0008's own logic ("state the absence rather than
      let a clean site imply otherwise") applies to it, so the sign-up surface says plainly that she
      needs an address she can open, rather than letting her discover it at the magic link.
      **A hard bounce locks her out with no recovery path**, because there is no password to fall
      back to; Design must say what happens on bounce and what the Admin can do about it, and that is
      a fifth thing arriving in the daily queue. And **her phone sits in the database, classified
      `personal`, from the moment she publishes and before any Offer exists** — which raises the
      stake on Q4's retention answer and on the Admin being the only role that reads it in bulk.
      Resend brings `RESEND_API_KEY`, a sending domain, and SPF/DKIM/DMARC records. Turborepo is in
      `strict` mode, so the variable is declared or it is filtered out of the task entirely.
      Deliverability into Colombian inboxes is a launch risk to measure, not to assume.

- [x] **Q2** — What is in the initial Skill vocabulary, who authored it, and what does a Worker do
      when hers is not in it? `CONTEXT.md` fixes the vocabulary as closed with Admin-held promotion,
      which means the list decides who can describe themselves at all on day one. **Blocks:** the
      publishing form, the browse and filter surface, what Spanish full-text search indexes, the
      fourth item in the Admin queue, and whether launch waits on someone with local labour-market
      knowledge writing the list.
      **Answer: we seed it ourselves, drawn from a recognized occupational classification rather
      than invented.** Launch does not wait on a local expert. Design evaluates the candidates and
      cites the one it takes — **CIUO-08 A.C.** (DANE's Colombian adaptation of ISCO-08) and the
      **SENA** occupational catalogue are the two to check first, and the choice is recorded rather
      than assumed.
      **The seed is a source, not the vocabulary.** A classification built for labour statistics is
      written in the register of a statistician, and the person reading the publishing form is a cook
      deciding whether "Actividades de los cocineros" describes her. Design's work is translating the
      seed into the words a Worker would use about herself, at the granularity a Hirer would search
      for — which is craft, and is exactly what the Q6 voice session exists to hold to a standard.
      **"Mine isn't listed" already has a mechanism**: `CONTEXT.md` gives the Admin vocabulary
      promotion, so a Worker requests a Skill and the request joins the daily queue. That makes it
      the **fifth** queue item alongside the bounce path from Q1, and it is the vocabulary's only
      growth path — a closed list with no way in is a list that silently excludes.

- [x] **Q3** — What is the review latency a human queue can hold, and what is visible before review?
      ADR-0008 makes **every Offer** human-read before delivery and every photo moderated, with
      `on-call-rotation` = **nobody**. Does a CapabilityProfile reach the Wall before its photo is
      reviewed? May an Offer sit unread overnight, or over a weekend? **Blocks:** the Offer and
      profile state models, the copy that sets both sides' expectations, the control band
      `docs/policy/operability.md` requires of every spec, and whether the queue degrades gracefully
      or silently when one person is unavailable for three days.
      **Answer: 24 hours for Offer review, and photo moderation never blocks profile visibility.**
      The two queues therefore have **different blocking semantics**, which is the substance of this
      answer: an unreviewed Offer is undelivered, an unreviewed profile is live.
      **The photo is held; the profile is not.** She publishes and reaches the Wall in seconds —
      nothing about her waits on a person. Until the photo is approved her photo slot shows her
      initial, so **nothing unreviewed is ever public or indexable**, which is what keeps ADR-0009's
      public, Google-indexed Wall from carrying an abusive or stolen image for a day. She sees her
      own photo pending on her own view. Design owns making that pending state **dignified** — an
      initial, not a moderation badge, because a badge on the Wall reads as suspicion of her.
      **The control band is: metric = age of the oldest unreviewed Offer; normal range ≤ 24 h.** The
      third element `docs/policy/operability.md` demands — who learns, through what, how fast — is
      not answerable yet because `alert-destination` is `UNSET`, and this effort should set it rather
      than ship a band that is two-thirds of a band.
      **24 hours is best effort against `on-call-rotation` = nobody, and the copy says so** to both
      sides. Design states what the queue does when one person is away for three days: Offers
      accumulate undelivered, and whether that is silent or visible to a waiting Hirer is a decision,
      not an implementation detail.

- [x] **Q4** — Who is the _responsable del tratamiento_ under Ley 1581, and what are the retention
      and deletion answers that follow? `docs/policy/security.md` records the controller as the repo
      owner **personally** until a partner organization takes it, and `retention-personal`,
      `retention-logs`, and `log-retention` are all `UNSET`. **Blocks:** the privacy notice and the
      _autorización_ text a Worker consents to at publish time; the account- and profile-deletion
      path and whether deletion reaches an already-completed Contact Exchange; the three retention
      keys; and whether one person is willing to hold personal liability for a database of displaced
      people's phone numbers.
      **Answer: the repo owner personally is the _responsable del tratamiento_, accepted knowingly.**
      That is now a decision rather than a gap, and it has obligations attached that Design must
      surface rather than discover: the privacy notice and the _autorización_ name **him**, and
      habeas data requests — _consulta_ and _reclamo_ — arrive to a person, on Ley 1581's statutory
      clocks. Design **verifies those deadlines and the Registro Nacional de Bases de Datos (RNBD)
      registration threshold against the current SIC guidance** rather than against recall; they are
      the kind of number that changes and the kind that is expensive to get wrong.
      **The retention numbers below are proposed, not settled** — they are written here in the shape
      `docs/policy/owners.md` asks for, a range the author would defend rather than a question, and
      the controller confirms or replaces them at Design. **Account, CapabilityProfile and photo:**
      purged 12 months after last sign-in. **Offers:** 12 months from send. **Contact Exchange
      records:** 12 months, then reduced to non-identifying counts. **Reports:** 24 months, because a
      pattern across time is the whole point of keeping them. **Logs:** 30 days once a drain exists.
      `retention-logs` and `log-retention` are the same number and are set together or not at all.
      Today logs go to stdout on one Fly machine and nowhere else, so the honest current value is
      "whatever the machine holds", and the 30 days applies from the moment the go-live runbook is
      run.
      **Deletion has a hard edge and the site must state it.** She can delete her Account, and that
      removes her profile, her Skills, her photo, and her contact data from us. It **cannot reach a
      Hirer who already holds her phone number from a completed Contact Exchange** — the same
      asymmetry ADR-0007 states about money and ADR-0009 states about Block. Design writes that
      sentence into the deletion surface rather than letting deletion imply a reach it does not have.

- [x] **Q5** — What is `session-lifetime`, including how a session is revoked **before** it expires?
      The realistic Worker device is shared, borrowed, or a cybercafé machine, and a passwordless
      magic-link session that outlives her use of the phone hands her account to whoever holds it
      next. **Blocks:** the Better Auth session configuration, whether a sign-out-everywhere surface
      exists, what the Admin can revoke during a Report, and the `session-lifetime` key.
      **Answer: ask whose phone it is.** A flat lifetime is the wrong shape — **the risk is the
      device, not the clock.** On her own phone a week means re-requesting a magic link constantly
      through the channel Q1 just confirmed is the fragile one; on a borrowed phone a week is
      forever. One checkbox at sign-in — _"este no es mi teléfono"_ — puts the choice where the
      knowledge is, because she knows whose phone it is and we never will.
      **Worker or Hirer on her own device:** 30 days, rolling. **Worker or Hirer on a shared
      device:** ~8 hours, non-persistent — gone when the browser closes. **Admin:** 8 hours, no
      rolling.
      **Revocation before expiry is the half that makes this real**, and `docs/policy/security.md`
      says the key is not set without it: a sign-out-everywhere surface she can reach herself, and
      Admin revocation available while handling a Report. Freezing a Hirer's ability to send Offers
      is not the same act as ending his sessions, and Design says whether a Report does both.
      Design **verifies the mechanism against the pinned Better Auth version** rather than against
      this answer's vocabulary — the shape is the decision, the option names are not.
      One dependency worth naming: the checkbox needs copy that reads as ordinary care rather than as
      a warning about her circumstances, and that copy has no authority until Q6's session runs.

- [x] **Q6** — Where is the Spanish voice written down (`voice-guide`)? `CONTEXT.md`'s _Avoid_ lists
      already encode half of it — _damnificado_, _víctima_, _beneficiario_ are ruled out — but
      `docs/policy/ux.md` says microcopy has no authority until the key is set, and this is a product
      where the difference between "trabajadora" and "damnificada" is the product. **Blocks:** every
      string in the app, the non-verification notice, the no-money notice, the standing safety
      guidance, the four email templates, and the error copy for a form that rejects a phone number.
      **Answer: a dedicated session, using the `brand-voice` skill, which is already installed.** No
      new skill needs finding — `brand-voice` produces exactly the artifact this key names (an
      archetype, dimension settings, do/don't rules, a tone matrix by context, and before/after
      rewrites), and `ux-writing` and `copywriting` are installed alongside it for the microcopy and
      the notices. That session sets `voice-guide` in `docs/policy/ux.md` to the path it writes.
      **The sequencing is what unblocks Design now.** The voice binds **strings**, and strings are
      written at Build; Design names surfaces, states, and entities, none of which need the voice to
      exist. So `voice-guide` stays `UNSET` through `/to-spec` and **must be set before Build writes
      its first user-facing string** — that is the deadline, and it belongs in the spec as a stated
      dependency rather than as an assumption.
      **The session must be given `CONTEXT.md` and ADR-0009 as input**, because this product's voice
      problem is not the one a brand-voice exercise usually solves. The risk here is not sounding
      generic; it is othering the person reading. `CONTEXT.md`'s _Avoid_ lists are already binding
      vocabulary and are the seed, and ADR-0009's framing — _this is who I am, this is what I know
      how to do_ — is the thing the voice has to carry.

- [x] **Q7** — What is `browser-support`? The Worker side is cheap Android phones on mobile data in
      Risaralda; the Hirer side is anything, anywhere. The floor decides whether a CSS or platform
      feature is available or needs a fallback, and it also decides what page weight is defensible.
      **Blocks:** the design system's available feature set, whether the publishing flow works
      without JavaScript, and the performance numbers a spec is allowed to promise.
      **Answer: delegated, so the value below is proposed and the controller of `docs/policy/ux.md`
      confirms it at Design.** The rule is **Baseline Widely Available** — a platform feature is
      available here once it has been in every major browser long enough to have reached the phones
      in question, which is the only formulation that stays true as devices turn over without anyone
      editing this key. Concretely that floor is **Chrome on Android 10+** and **Safari on iOS 16+**,
      plus current evergreen desktop browsers for the Hirer side.
      **The browser list is the less important half.** The demographic constraint that actually binds
      is the **network**, not the engine: a mid-range Android on Colombian mobile data. Design owns a
      page-weight and interaction budget for the two Worker-critical paths — the Wall and the
      publishing flow — and states it as a number, because "reasonable per demographics" is not
      something a spec can be checked against.
      **Whether publishing works without JavaScript is a separate call Design makes explicitly.** The
      Wall and profile reads are Server Components and work without it by construction; a Server
      Action form can be progressively enhanced, but photo upload realistically cannot. The honest
      target is that **she can publish everything except her photo with JavaScript unavailable or
      still loading**, and Design confirms or rejects that rather than discovering it at Build.

- [x] **Q8** — What must be true to go live, and does anything ship before everything? The attention
      window is the scarce resource (ADR-0008), which argues for the Wall and publishing to open
      before Offers exist — and that also means the first Workers publish into a site where nobody
      can hire them yet. **Blocks:** whether this effort is one release or two, the ticket
      decomposition `/to-tickets` produces, whether `stacked-prs` gets set, and what the go-live
      runbook for this platform must contain beyond the observability one that already exists.
      **Answer: deploy continuously from the first ticket; announce once an agreed feature list is
      done.** Those are two different events and separating them is what makes the answer work.
      **Deployment is continuous.** Every merged ticket reaches Fly.io. There is no release train and
      no big-bang launch, so the platform is publicly reachable long before it is finished — which is
      exactly the hazard this question named, and the announcement gate is the answer to it. Nobody
      is told the site exists until the list is done, so the first Workers do not publish into a
      shipping site where no Hirer can reach them.
      **The agreed list is the spec's `Must` user stories.** `/to-spec` already produces prioritized
      `Must`/`Should`/`Could`, so the list is a Design artifact this effort already generates rather
      than a separate document to maintain, and the announcement gate is "every `Must` story's ticket
      is closed" — computable from the tracker, which is what `PRODUCT.md`'s "the plan is a query,
      not a document" asks for.
      **This reopens CI, and the Out of scope section below has been corrected accordingly.**
      Continuous deployment with `on-call-rotation` = nobody is not a workflow preference; it makes
      three `UNSET` keys load-bearing. `required-checks` — the gate has to run somewhere other than a
      developer's terminal before a merge reaches production. `branch-protection` — without it the
      gate is advisory, and `docs/policy/build.md`'s hooks stop being the only enforcement the moment
      a deploy is automatic. `rollback-mechanism` — with nobody watching, the ability to undo is the
      only mitigation available, and it decides whether "behind a flag" is even a strategy. This
      effort sets all three.
      **One operability consequence to design against:** cache entries do not survive a deploy, so on
      one Fly machine **every deploy is a cold start and the release moment is the peak load**.
      Deploying many times a day multiplies that, and the spec's control bands are set against a
      system that is repeatedly cold rather than one that warms up and stays warm.

## Out of scope

- **Payments, escrow, fees, held balances, and disputes** —
  [ADR-0007](../../adr/0007-the-platform-never-handles-money.md). Not a deferred feature: adding it
  changes the legal entity, the regulatory surface, and the trust model in one move, and needs its
  own decision.
- **Verification of any kind** — RUD numbers, document checks, partner vouching as a precondition.
  [ADR-0008](../../adr/0008-open-enrolment-with-published-non-verification.md) settles this, and a
  future verified tier must be additive and visibly dated rather than a silent upgrade.
- **Ratings, reviews, and reputation scores.** With no money flow there is no ground truth to rate
  against, and a public score attaches permanently to the side of the market that can least afford
  one — the same asymmetry
  [ADR-0009](../../adr/0009-a-workers-full-identity-is-gated-and-never-indexed.md) rejects for loss
  narratives. The seven-day check-in is the only feedback mechanism this effort builds.
- **In-platform messaging.** Contact Exchange is the platform's terminal event; a chat surface
  reopens it, and makes us the moderator of every conversation that follows.
- **Hirer-side postings.** An Offer goes from one Hirer to **one named Worker**. There is no job
  board, no vacancy, and no application — the direction of the ask is a property of the design, not
  an omission.
- **Any municipality beyond Pereira, Dosquebradas and Santa Rosa de Cabal**, and any language beyond
  `es-CO`. Both are `docs/policy/ux.md` and `CONTEXT.md` as they stand.
- **Dark mode.** `theme-parity` is light only.
- **Native or installable apps.** The Worker's device is a browser.
- **Analytics and product instrumentation.** `analytics-consent` in `docs/policy/ux.md` is `UNSET`,
  and under Ley 1581 that gate precedes the instrumentation rather than following it.
- ~~**CI, branch protection, and a rollback mechanism.**~~ **Moved in scope by Q8.** Continuous
  deployment makes all three load-bearing rather than deferrable: without CI the gate runs only in a
  developer's terminal, without branch protection the gate is advisory, and without a rollback
  mechanism a system with nobody on call has no mitigation at all. This effort sets `required-checks`,
  `branch-protection`, and `rollback-mechanism` and ships `.github/workflows/`.
- **Wiring the log drain.** `docs/runbooks/observability-go-live.md` exists and has never been run.
  It becomes runnable the moment `hosting-target` stops being theoretical, which is inside this
  effort — but running it is a deploy-time act, not a build-time one.
