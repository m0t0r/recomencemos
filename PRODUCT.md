# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary user is a **Worker**: a person in **Pereira, Dosquebradas or Santa Rosa de
Cabal** (Risaralda, Colombia) who lost their source of income in the 10 August 2026
earthquake, can work today, and has no way to be found. She reads on a phone, often on a
slow connection, sometimes on a borrowed one. Her working reach is a neighbourhood that
lost its income on the same morning she did.

She is **not** a person in need of relief, and nothing here may describe her as one. The
relief that exists is addressed to housing damage, which she never had.
[`CONTEXT.md`](CONTEXT.md) fixes the vocabulary and its _Avoid_ list is binding:
_damnificado_, _víctima_, _afectado_, _beneficiario_, _candidato_, _hoja de vida_.

The second user is a **Hirer**: a person, family or organization, anywhere in the world,
willing to pay a Worker for a concrete piece of work. He may have been moved by the news,
but what he does here is not a donation — he is buying something he actually needs done.
He is not the person this product's voice protects, and the difference is written into
the tone matrix in [`docs/policy/voice.md`](docs/policy/voice.md).

The third is the **Admin**: one operator working a daily queue of photos, Offers and
Reports. Density over warmth. There is exactly one of them and they are unpaid.

The fourth reader of everything here is **Claude Code itself**. `CLAUDE.md`, `AGENTS.md`,
the vendored skills and the hooks are consumed by an agent, not skimmed by a human, and
they are as much the product as the code is.

## Product Purpose

**Recomencemos introduces two people and then steps out of the way.**

A Worker publishes a CapabilityProfile from a phone, in Spanish, in one sitting, with no
document to produce. It describes what she can do — Skills from the platform's
vocabulary, a photo, one line in her own words — and never what she lost. A Hirer browses
without an account, signs in to read a full profile, and sends an Offer with concrete
terms he cannot revise. A human reads every Offer before it reaches her. She accepts or
rejects. On acceptance each side receives the other's contact details, and the platform is
done.

The Contact Exchange is the **terminal event**. Everything after it — the work, the
payment, the relationship — happens off the platform, and that is the design rather than a
gap in it.

**Success is a Contact Exchange that leads to paid work**, measured by the only evidence
that is not an anecdote: a seven-day check-in asking both sides whether the work happened
and whether she was paid. Not sign-ups, not profile counts, not traffic.

**The resource running out is attention, not money.** A platform that opens after the news
cycle has moved on has connected nobody, and every scope decision in
[`docs/efforts/0002-profile-to-contact-exchange/spec.md`](docs/efforts/0002-profile-to-contact-exchange/spec.md)
was taken against that clock.

## Positioning

**The three refusals are the product.** A neighbouring product could copy the Wall, the
profile shape and the Offer form in a week. It could not copy what this one declines to
do, because each refusal is what makes the next thing honest:

- **It never handles money** ([ADR-0007](docs/adr/0007-the-platform-never-handles-money.md)).
  No payments, no escrow, no disputes desk. The operating team is one unpaid person with no
  legal entity, and payment processing would bring money-transmitter registration, KYC/AML
  obligations and chargebacks with it. The cost is stated rather than hidden: **a Worker has
  no recourse through us if she is not paid.**
- **It verifies nobody, and says so on every surface**
  ([ADR-0008](docs/adr/0008-open-enrolment-with-published-non-verification.md)). We do not
  check that a person publishing lost her income, and we do not check that a person sending
  an Offer is who he says he is. Open enrolment with the absence published beats a
  verification theatre nobody could staff.
- **It adjudicates nothing.** No ratings, no reviews, no reputation, no arbitration of who
  was right. A Report freezes a Hirer and reaches a human; it does not settle a dispute,
  and the platform holds nothing it could award to either side.

What it does instead is concrete and is said plainly: a human reads every Offer before it
is delivered, every photo is moderated before it is reachable, her full name and contact
details are withheld until she accepts, and free-text fields refuse phone numbers so the
consent step cannot be routed around.

**A Block is not invisibility, and the copy never implies it is.** It stops one Hirer
sending her anything further. Her card stays public, his reading stays open. Saying more
than that would be the kind of false a person relies on.

## Operating Context

- **One product surface**, `apps/web` — Next.js 16 App Router on React 19, Cache Components
  on, Server Components by default.
- **`es-CO` is the only language**, and it governs only what a person reads. Every
  identifier is English
  ([ADR-0012](docs/adr/0012-spanish-is-the-interface-english-is-the-code.md)): route
  segments, file names, tables, columns, enum values, log `event` names, test names. The
  route is `/offers`, the table is `offer`, the page says _Propuesta_.
- **Monorepo:** Turborepo on pnpm 11, TypeScript 7 throughout. `apps/web`,
  `@repo/design-system`, `@repo/errors`, `@repo/observability`, `@repo/domain`,
  `@repo/typescript-config`. Node 24.x and pnpm 11, both enforced rather than suggested.
- **Data:** PlanetScale Postgres through Drizzle, reached only through `@repo/domain`
  ([ADR-0010](docs/adr/0010-the-domain-package-is-the-only-door-to-the-database.md)). Two
  connections: pooled for every request path, direct for migrations. Local development runs
  Postgres 18 behind PgBouncer in transaction-pooling mode, because that is the mode
  production's pooler runs in.
- **Hosting:** Fly.io, **one machine**, bluegreen and health-gated. There is no second
  thing to fail over to, and that is a decision rather than an omission.
- **On call is nobody**, best effort. Every SLO in the spec is written against that answer.
- **Three municipalities and no others.** Any wider geography is a different product.
- **Issue tracker:** GitHub Issues via the `gh` CLI. SDLC artifacts live under
  `docs/efforts/<NNNN>-<slug>/`; a folder there means a human decided something is work.
  Findings enter through `/triage`, never as auto-created intents
  ([ADR-0001](docs/adr/0001-findings-enter-through-triage.md)).

## Capabilities and Constraints

**Fixed — future design work must preserve these:**

- **The three refusals above.** Money, verification, adjudication. Each has an ADR or an
  Out of Scope line behind it; reopening one is a spec amendment, not a ticket.
- **Nothing unreviewed is ever reachable.** A profile reaches the Wall in seconds; its
  photo does not. Until a human approves it, the photo slot shows her initial, **described
  as under review rather than badged as suspect**. The bound is over the stored object, not
  the page — a pending photo at a publicly-readable storage URL that nothing links to would
  satisfy the page-shaped version of this rule and defeat its purpose.
- **Three shapes of one profile, differing by exactly the fields that must not leak.**
  Public is the Wall card. Gated adds her full self-description and work history, is served
  `noindex`, and costs a Hirer an Account. Exchanged adds her full name, phone and email,
  and exists only after she has accepted. Each is built field by field from a whitelist
  under [ADR-0003](docs/adr/0003-no-tojson-on-cross-boundary-types.md); nothing on the path
  defines `toJSON`.
- **A Worker's full identity is gated and never indexed**
  ([ADR-0009](docs/adr/0009-a-workers-full-identity-is-gated-and-never-indexed.md)). Her
  full name is collected at publish and withheld until she accepts, so the exchange is the
  same whichever door she signed in through.
- **An Offer is immutable once sent**, and the Hirer is told so before he writes it rather
  than after he submits it.
- **A Server Action never touches the database.** It authorizes, parses its input once at
  the boundary, and calls one domain module.
- **Nothing is cached across users.** No `use cache`, no `use cache: remote`
  ([ADR-0011](docs/adr/0011-no-shared-cache-until-a-measurement-requires-one.md)).
- **`CONTEXT.md` is the binding vocabulary**, _Avoid_ lists included, and
  [`docs/policy/voice.md`](docs/policy/voice.md) is the binding register for every string a
  person reads.

**Undecided — do not invent an answer:**

- **Every `UNSET` value under [`docs/policy/`](docs/policy/)** is a real open question.
  `grep -rn UNSET docs/policy/` is the whole list, and a skill that needs one raises a
  flagged concern naming the file and the key rather than guessing.
- **Analytics and product instrumentation.** `analytics-consent` is `UNSET`, and under Ley
  1581 that gate precedes instrumentation. Nothing ships until it is answered.
- **Light/dark parity is not a stated commitment.** `theme-parity` in
  [`docs/policy/ux.md`](docs/policy/ux.md) is **light only** today; whether every future
  surface must also be correct in dark is an open call, not an established rule.
- **`secrets-in-url-paths`** — whether a credential may appear in a URL path segment. The
  request-completion log line carries `context.path` verbatim, and
  [ADR-0006](docs/adr/0006-name-the-exposure-rather-than-ship-a-heuristic.md) is why nothing
  ships to guess at it.

**Terminology:** [`CONTEXT.md`](CONTEXT.md) is the glossary and it is binding — Worker,
Hirer, CapabilityProfile, Skill, Offer, Contact Exchange, Account, Wall, Report, Block,
Admin. Each entry carries its Spanish UI rendering and the words to avoid. _Effort_ is the
one term that lives here instead: a numbered folder under `docs/efforts/` holding one
`intent.md` and one `spec.md`, whose existence means a human decided it is work.

## Brand Commitments

**The voice is written down and it is binding.**
[`docs/policy/voice.md`](docs/policy/voice.md) is the value of `voice-guide`, set by a
`brand-voice` session after being held `UNSET` **by decision** through Plan and Design. Its
archetype is **Caregiver**, bounded by the one rule that makes it survive ADR-0009:

> **The care is directed at the process. Never at the person.**

Three dimensions are pushed to an extreme — Humor **1**, Warmth **5**, Directness **5** —
and Directness is the one that keeps Caregiver honest: every absence is stated first and
plainly. Register is `tú` throughout, to both sides. Grammatical gender is handled by
rephrasing, never by slash forms or the `-e` form.

**The failure mode that guide exists to prevent is not blandness. It is othering.** Copy
that is warm, well-meant, fluent, and describes the person reading it as someone that
things happened to.

**The visual authority is [`DESIGN.md`](DESIGN.md)**, and
`packages/design-system/src/styles/globals.css` holds the values it names. Eleven
`--brand-*` shades at hue 248 carry the whole palette behind a semantic seam; swapping the
brand hue is one edit. Typefaces are Inter and Geist Mono. **Light only — there is no dark
mode.** The palette and the icon set came from a preset and from
[`m0t0r/workforpereira`](https://github.com/m0t0r/workforpereira) rather than from a brand
exercise, which is why `README.md` still lists them as open.

**The name is Recomencemos.** There is no logo and no wordmark yet.

## Evidence on Hand

- [`docs/efforts/0002-profile-to-contact-exchange/spec.md`](docs/efforts/0002-profile-to-contact-exchange/spec.md)
  — the approved design: 23 user stories, 34 numbered non-functional requirements, sixteen
  deep dives, and the resolved concern log. This is the authority on what the product does.
- [`docs/efforts/0002-profile-to-contact-exchange/intent.md`](docs/efforts/0002-profile-to-contact-exchange/intent.md)
  — the problem, and the six open questions a human answered.
- [`docs/efforts/0002-profile-to-contact-exchange/advisories/`](docs/efforts/0002-profile-to-contact-exchange/advisories/)
  — four advisories, committed verbatim, never edited after the fact.
- [`CONTEXT.md`](CONTEXT.md) — the binding vocabulary, both languages.
- [`docs/adr/`](docs/adr/) — twelve recorded decisions.
- [`docs/policy/voice.md`](docs/policy/voice.md) — the voice guide, with six before/after
  pairs on real product strings.
- [`docs/runbooks/`](docs/runbooks/) — the go-live procedures, with vendor figures pinned
  at a date so a stale number is visible as stale.

**Absences future work must not fabricate.** There are **no users, no Workers, no Hirers,
no Contact Exchanges, no testimonials, no press and no benchmarks.** Nothing has been
announced. The product has never run outside a developer's machine. Two numbers in
particular do not exist yet and may not be quoted as if they did: the client-side figure
NFR2 names, which has to be measured from a real Colombian connection under 4× network and
CPU throttling, and anything derived from the seven-day check-in, which requires a Contact
Exchange to have happened. The earthquake and the three municipalities are real; every
number about this platform's use is not yet.

## Product Principles

1. **Introduce, then leave.** The Contact Exchange is the terminal event. Any feature that
   keeps the two sides on the platform afterwards is a different product.
2. **Name the absence before the reassurance.** No verification, no money, no recourse,
   what a Block does not reach — each is stated first and plainly. An implied guarantee is
   worse than none, because it is relied upon.
3. **Describe her by what she can do.** Every noun, verb and heading on a profile, a card
   or a form is about capability. The earthquake is a fact about why this platform exists
   and never a property of a person.
4. **Enforce, don't advise.** A rule that matters becomes a hook, an `exports` map, an
   engine constraint, or a failing exit code. Documentation states it; something executable
   holds it.
5. **Approval is a human act.** The agent proposes, gates refuse, and a person decides —
   for an intent, for a spec, for a merge, and for every Offer that reaches a Worker.

## Accessibility & Inclusion

**WCAG 2.2 AA**, committed here and read as `wcag-level` from
[`docs/policy/ux.md`](docs/policy/ux.md). It binds the token layer in particular: any
preset or palette applied to `packages/design-system/src/styles/globals.css` must clear AA
contrast, since every surface reads from those tokens.

The accessibility obligations that are **sentence-level writing rules** live in
[`docs/policy/voice.md`](docs/policy/voice.md) rather than here, because a writer who never
opens an accessibility spec will still open the voice guide: an error names what happened
and what to do; nothing refers to meaning carried by colour or position; every meaningful
image has a Spanish `alt`; no ALL CAPS; link text names its destination.

Inclusion here is concrete rather than aspirational. She is on a phone, possibly a borrowed
one, possibly on mobile data, deciding something that matters. That is why the publish flow
is one sitting with no document to produce, why the page weight is a numbered requirement,
and why no surface asks her for anything the platform does not need.
