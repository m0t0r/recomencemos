---
name: to-spec
description: Turn an approved intent into a spec.md and publish it — the Design-stage artifact of the AI-native SDLC. Runs the system design interview, consults four advisors, and synthesizes.
disable-model-invocation: true
---

# To Spec

Design starts from an **approved intent**, never from the conversation alone. You are the **spec
architect**: you draft the design, you consult the advisors, and you write every line of the spec.

Thinking that isn't finished yet belongs in `/grill-with-docs` or `/research`. This skill does not
interview the user about the problem — that was Plan's job. It does make two calls out to the human
where a judgment is genuinely theirs: the seams, and the design direction for a new surface.

The issue tracker should have been provided to you — run `/setup-matt-pocock-skills` if not.

## Why three phases

The interview is a **pipeline, not a fan-out**. Core entities depend on the requirements; the API
depends on the entities; the high-level design depends on the API. An advisor spawned before that
exists is guessing — security cannot name trust boundaries before there is an interface, and data
cannot index for access patterns nobody has written.

So you draft a skeleton alone, fan out to advisors once there is something concrete to react to,
then synthesize. **Advisors advise; you write.** An advisory that arrives as a finished section gets
read for its analysis and rewritten in your own prose — five authors produce five documents stapled
together, and the conflicts between them get buried instead of surfaced.

---

## Phase A — draft the skeleton

### A1. Read the intent

Work in the effort folder the user names. Where they name none, take the one
`docs/efforts/<NNNN>-<slug>/` holding an `intent.md` with no `spec.md` beside it, and ask when more
than one qualifies.

The intent must be `status: approved` with every open question checked. Against a `draft` intent,
report its unresolved open questions **verbatim** and stop. Approval is the human's act;
`.claude/hooks/plan-to-design-gate.sh` refuses the spec write regardless of what you conclude.

Carry the intent's **Constraints** and **Out of scope** into the spec intact. Design narrows an
intent; it does not reopen one.

### A2. Read the ground

- `CLAUDE.md` and `CONTEXT.md` — conventions and the domain glossary. Use its vocabulary throughout.
- The ADRs under `docs/adr/` that touch this area.
- `docs/policy/` — every file. You need to know which values are `UNSET` before you design against
  them.
- The code the change lands in.

### A3. Size the effort

**The artifact is proportional to the work** (ADR-0001). A one-surface copy change does not get
non-functional requirements and deep dives, and padding it with them teaches the next reader that
those sections are decoration.

Omit what does not apply — and **state the omission** under the heading rather than deleting it:
`_Not applicable: no data is stored or read._` A section that is silently missing is
indistinguishable from one nobody thought about.

### A4. Draft, in this order

Each step feeds the next. Do not skip ahead.

1. **User stories**, prioritized `Must` / `Should` / `Could`. These are the functional requirements
   and they are what `/to-tickets` slices into tracer bullets, so each one must be demoable on its
   own. An unprioritized list of forty stories is how a spec produces a breakdown with no shape. A
   story whose first slice carries a package-level foundation with its own test seam is two stories —
   the template says how and why.
2. **Non-functional requirements**, with numbers, **each naming the user stories it binds**. That
   `Binds:` line is the whole coupling to Build: `/to-tickets` cuts one ticket per story and copies
   the spec's criteria onto it, so a bound NFR becomes an acceptance criterion by construction and
   needs nothing added to that skill. See `system-design` for how to derive the numbers and where a
   back-of-envelope estimate is worth the five minutes. An NFR that bounds output (a cap, a limit, a
   truncation, a timeout) states **both halves** — the bound and what the constrained output must
   still contain; the template says why.
3. **Core entities** — the nouns, their relationships and cardinality. Before schema, not instead of
   it.
4. **API / interface contract** — what each surface exposes, its shape, and who may call it.
5. **High-level design** — the components and the flow, one pass per `Must` story.

Leave **Deep dives** empty and the **UX design** section unrouted. Phase C fills them.

### A5. Check the seams

Sketch the seams at which this feature is tested. Prefer an existing seam to a new one, and the
highest seam available. The fewer seams across the codebase the better; the ideal number is one.

**Check them with the user before Phase B.** This is the last point where the spec's shape is cheap
to change, and a seam that forces the placement rules in `system-design` to bend is a concern rather
than a preference.

---

## Phase B — consult

### B1. Route the UX edge yourself

This one runs **in the main session**, not as a subagent, because its third case interviews the
user. Load `ux-design` and follow its router. Four outcomes, and the conclusion is always written
down — "this change has no UI" is a finding, not a silence.

### B2. Dispatch four advisors

Send all four in **one message** so they run concurrently. Each gets the draft spec's path, the
intent's path, and nothing else — the isolation is the point. An advisor that could see the other
three would reconcile with them, and two edges reaching opposite conclusions is exactly what you
need surfaced.

| Advisor              | Skill                | Brings                                                              |
| -------------------- | -------------------- | ------------------------------------------------------------------- |
| `security-advisor`   | `security-design`    | Trust boundaries, STRIDE, authz placement, what crosses to the client |
| `data-advisor`       | `data-design`        | Entities → schema, indexes for the access patterns, cache ownership, classification |
| `operability-advisor` | `operability-design` | SLIs, control bands, logging, rollback, the release moment          |
| `simplicity-advisor` | `simplicity`         | The counterweight — the fewest moving parts that satisfy the intent |

Dispatch all four even where one looks irrelevant. Deciding an advisor has nothing to say is you
holding a lens you were supposed to have given away. `simplicity-advisor` matters most here: it is
the only one arguing *against* the draft while the other three propose additions.

### B3. Keep the advisories

Write each returned advisory to `docs/efforts/<NNNN>-<slug>/advisories/<lens>.md`, verbatim, before
you synthesize. They are committed, and they are what `/spec-review` reads to check whether the
synthesis dropped anything. An advisory you summarized is an advisory you have already begun to
edit.

---

## Phase C — synthesize

### C1. Resolve

Work through the advisories. Every recommendation ends one of three ways:

- **Settled** — you accept it and write it into the spec in your own prose, under whichever section
  owns it.
- **Overridden** — you reject it, and say so in **Further Notes** with the reason. A silent override
  is what `/spec-review` exists to catch.
- **Flagged** — it needs a decision that is not yours, and becomes a concern under **Flagged
  concerns** in the format `docs/policy/owners.md` gives.

**Two advisors reaching opposite conclusions is a concern, not a coin toss.** Write it as one
concern stating both positions, with `**Owner:** Tech lead (arbitrating <edge> vs <edge>).`

**A recommendation blocked by an `UNSET` policy value** becomes a concern carrying the
`**Unblocks by setting:**` line, so the second spec to hit the same gap finds the key already set.

### C2. Write the deep dives

One deep dive per non-functional requirement the high-level design does not already satisfy. This is
where infrastructure lives — deployment topology, runtime, regions, queues, cron, cold-cache
behaviour at release. Not as a checklist section, but as the answer to a specific number you wrote
in A4.2. An NFR with no deep dive is a claim that the obvious design already meets it; say that
explicitly where it is true.

**A deep dive that states how a dependency behaves verifies the claim against the installed version,
or labels it.** Mechanism-level prose — "the schema is generated, never hand-edited"; "the session is
rolling" — written from recall or the vendor's docs binds Build to behaviour nobody has run: four of
effort 0002 DD5's rows differed from the installed better-auth's actual behaviour, and two became
spec amendments after Build discovered them (#79 rows 4–5). Run the installed package (a
`/prototype` LOGIC throwaway is the bounded way) or read its installed source; where neither is
worth the cost, write `assumed, unverified against <version>` beside the claim, so Build inherits a
question rather than a fact.

### C3. Propose ADRs where a deep dive sets precedent

A deep dive that decides something **durable and beyond this effort** — the store, the auth model,
the caching topology — belongs in `docs/adr/`, not buried in an effort folder nobody opens again.

Write it as `docs/adr/<NNNN>-<slug>.md` with `status: proposed` in its frontmatter, following the
shape of ADR-0001: the decision, the options considered with why each was rejected, and the
consequences. The spec's deep dive then links it rather than restating it. **You never set
`status: accepted`** — that is the same human act as approving the spec.

Where the spec contradicts an existing ADR, say so in the deep dive with the reason it is worth
reopening. A contradiction recorded is a decision; a contradiction unmentioned is a regression.

### C4. Write the spec

`docs/efforts/<NNNN>-<slug>/spec.md`, from the template below, `issue:` and `reviewed:` empty,
`status: draft`.

**Every normative list states what membership means.** A list of files, calls, or fields is read by
a cold Build session with none of your context, and "these are the vendor-specific parts" has two
readings — *a vendor swap rewrites these* and *application code may not touch these* — that produce
different implementations. One sentence above the list ("membership here means: …") is the whole
cost. Effort 0001 paid a wrong implementation, a review that read the same ambiguity the same way,
and a mid-Build spec amendment for the lack of it. The spec's sole consumer is someone who cannot
ask you what you meant.

### C5. Publish

Follow "Publishing an intent or a spec" in `docs/agents/issue-tracker.md`, with `stage: spec`.

### C6. Report

- The file path and the issue number.
- How many concerns are unresolved, and which owner each waits on.
- Every advisor recommendation you **overrode**, and why. This is the part a human most needs to see
  and the part it is most tempting to leave out.
- Any ADR you proposed.
- Which policy keys came back `UNSET` and blocked something.
- **Any non-functional requirement whose `Binds:` line is empty** — it reaches no ticket, so either
  a story is missing or the requirement is.

Then recommend `/spec-review`, which checks the finished spec against the four advisories for
anything the synthesis lost.

Finally, say plainly that the spec is `draft`, and that a human resolving the concerns with their
owners and setting `status: approved` is what lets `/to-tickets` run.

---

## Prototypes at Design

Everything else about this stage says "no code yet — that's Build." Prototyping is the deliberate
exception, and it stays an exception by being bounded:

- **Propose, never auto-run.** When you cannot settle the entity model or the API shape on paper,
  say so and offer `/prototype`. The user decides.
- **Throwaway from day one.** The code lands on a throwaway branch, never on the default branch. The
  spec carries the *answer*, not the implementation.
- **`/prototype` LOGIC** answers "does this state model or API shape hold up" — a Phase A or C
  question. Inline the validated reducer, state machine, or type shape under the decision it
  encodes, and note it came from a prototype.
- **`/prototype` UI** answers "which concrete alternative wins" — and only for a change to an
  **existing** surface, where its variants can sit against real data and real density. A new surface
  goes through `impeccable shape` instead; see `ux-design`.

---

<spec-template>

---
stage: spec
status: draft
reviewed:
issue:
intent: ./intent.md
---

## Problem Statement

The problem the user faces, from the user's perspective. Inherited from the intent's **Problem**.

## Solution

The solution to that problem, from the user's perspective. Inherited from the intent's **Proposed
outcome**.

## User Stories

The functional requirements, prioritized. Each is demoable on its own, because each becomes a
tracer-bullet ticket.

**Must**

1. As a mobile bank customer, I want to see the balance on my accounts, so that I can make better
   informed decisions about my spending

**Should** / **Could** — same form, below the line.

Cover the feature completely, but the priority markers are what give Build its order and its
blocking edges. Everything below **Must** is a candidate for **Out of Scope** if the effort has to
shrink.

**A story whose first slice carries a package-level foundation is two stories.** The tell is at
Design time: the high-level design puts real machinery — new tables, a config factory, a migration, a
shared mechanism — inside a package, and that machinery has a test seam of its own that no person
sees on a screen. Write the foundation as its own story, demoed at that seam (its suite passing *is*
the demo — "demoable on its own" includes "verifiable at its own seam"), and the surface story after
it; the story order gives `/to-tickets` the blocking edge with nothing added to that skill. Effort
0002's story 1 kept the auth foundation inside the sign-in story and shipped ~5,000 reviewable lines
against `docs/policy/build.md`'s 1,000-line `pr-size-ceiling` — the ceiling and the tracer-bullet
rule conflicted, and the ticket resolved it silently. This is where the conflict is resolved instead,
by the party that can still see both halves.

## Non-functional requirements

The numbers. One line each: the requirement, its value, and **which user stories it binds**.

- **NFR1 — Latency.** p95 under 200 ms for the account list, measured server-side. **Binds:** 1, 2.
- **NFR2 — Scale.** 50k accounts, ~3 reads/sec steady, 30x that in the ten minutes after a release.
  **Binds:** 1, 4.
- **NFR3 — Consistency.** A balance may be up to 60 s stale; a transfer is read-your-writes.
  **Binds:** 4.
- **NFR4 — Accessibility.** WCAG 2.2 AA (`docs/policy/ux.md`). **Binds:** every story with a surface.

An NFR with no number is a wish. Where the number is not yours to pick, raise it as a concern
carrying the value you would defend.

**An NFR that bounds output has two halves: the bound, and what survives it.** A cap, limit,
truncation, or timeout stated alone passes green when everything is lost — the requirement is
satisfiable by emptiness. So NFR16-shaped requirements ("a log line is at most N bytes") must also
say what the constrained output still contains ("…and still carries the ids that identify the
request"). Effort 0001 shipped three bugs through one bound with no second half; each passed the
requirement green.

**An NFR that names an operation binds it on every door, and says so in its own line.** An operation
reachable through more than one surface — a Server Action and the vendor's direct endpoint, say —
gets the qualifier inside the NFR ("≤ 5/hour per address, **on every door**"), because the NFR's
line is what Build copies onto a ticket and prose elsewhere in the spec does not travel with it.
Effort 0002's NFR26 named `requestMagicLink` per address, the spec elsewhere called the vendor's
endpoint "a second door", and that door shipped bounded per-IP only — the qualifier existed, one
section too far from the number it qualified.

**The `Binds:` line is what carries the number into Build.** `/to-tickets` cuts one ticket per user
story, and an NFR that names its stories arrives as an acceptance criterion on each of them rather
than sitting in a document nobody re-reads at implementation time. An NFR binding no story is a
finding: either the story list is incomplete or the spec is carrying a requirement nothing
implements.

## Core entities

The nouns, their relationships, and cardinality. Prose or a list; no DDL. Schema is a deep dive.

Each entity states its **lifecycle in one findable sentence: the act that creates it, and the path
that deletes it.** A lifecycle left inferable reads as a missing story: effort 0002 had no sign-up
story *by design* — the first magic link creates the Account when it is opened — but the spec never
said so in one place, and "why is there no sign-up?" was asked at review and will be asked again
anywhere the sentence is absent.

## API / interface contract

What each surface exposes and who may call it. Server Actions, Route Handlers, and module exports
are different things with different exposure — say which. Name the request and response shapes.
Every entry states its authorization.

## High-level design

The components and the flow, one pass per **Must** story. Say which side of the server/client line
each module sits on.

## Deep dives

One per non-functional requirement the high-level design does not already satisfy. Infrastructure
lives here — topology, runtime, regions, queues, cold-cache behaviour at release. Link any ADR this
proposes; do not restate it.

## UX design

The router's outcome, always stated. One of: `_No consumed surface._` with the reason; the existing
surface and the states this change adds; a link to the surface brief for a new surface; or the agent
consumer and its failure mode.

Where the spec ships more than one surface, this section also answers **how a person gets between
them**: which persistent chrome (navigation, header, signed-in state) connects the surfaces, or which
existing shell they hang off. Surfaces enumerated without their connective tissue ship as
destinations nobody can reach — effort 0002 put sign-out on a page nothing linked to, and the gap
surfaced at review of story 1 rather than at Design (#79 row 9, cut late as #80).

## Testing Decisions

The seams from A5, what makes a good test here (external behaviour, never implementation details),
which modules are tested, and the prior art in this codebase for those tests.

## Flagged concerns

The decisions this spec cannot settle on its own, in the format `docs/policy/owners.md` gives:

- [ ] **C1** — <the decision>. **Risk if wrong:** <what it costs>. **Owner:** <role>.

Leave every box unchecked; the owner checks one and appends the answer inline. Write
`_No concerns raised._` when every advisory came back clean — the section is always present, because
it is what a human approves against.

## Out of Scope

What this spec deliberately leaves out, and why. Inherited from the intent, plus whatever Design
ruled out.

## Further Notes

Anything else worth carrying into Build — including **every advisor recommendation you overrode, and
why**.

</spec-template>

---

## The Design gate

A spec carries `status: draft` while any concern is unchecked, and a human moves it to `approved`
once their owners have resolved them all. That transition is the Design → Build gate:
`.claude/hooks/design-to-build-gate.sh` refuses to hang a ticket off the spec's issue until it is
approved and clean, refuses a spec with no `## Flagged concerns` section, and refuses any attempt by
you to set `status: approved` yourself.
