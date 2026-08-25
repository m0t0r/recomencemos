---
name: system-design
description: The spec architect's method — requirements to numbers, core entities, API contract, high-level design, deep dives, and where code lands in the monorepo. Load when writing a spec.md or deciding what a module exposes.
---

# System design

The method the **spec architect** works by. `/to-spec` owns the procedure; this owns the craft.

The shape is a system design interview: **requirements → core entities → API → high-level design →
deep dives**. It runs in that order because each step is the input to the next, and it ends in deep
dives because **that is where non-functional requirements get satisfied**. A design that stops at
the high-level diagram has described what the system *does* and said nothing about whether it holds.

---

## 1. Requirements

### Functional — the user stories

Derive them from the intent's **Proposed outcome**, not from the code you expect to write. Two
tests, and a story failing either is not a story yet:

- **Demoable alone.** `/to-tickets` turns each one into a tracer bullet — a narrow but complete path
  through every layer. "Add a `balances` table" fails; "see the balance on my accounts" passes.
- **User-visible.** The actor is a person or a named system, never a module.

**Prioritize `Must` / `Should` / `Could`.** This is not decoration: the markers give Build its
ordering and its blocking edges, and they are what a human cuts against when the effort has to
shrink. Three to seven `Must` stories is typical. Twenty `Must` stories means the intent covered
more than one effort and the honest move is to say so.

### Non-functional — the numbers

Walk this list explicitly and write down the ones that bind. A dimension you considered and
discarded is worth one line saying so; a dimension you never considered is the one that fails in
production.

| Dimension         | The question                                        | Written as                                    |
| ----------------- | --------------------------------------------------- | --------------------------------------------- |
| **Latency**       | How fast, at which percentile, measured where?      | `p95 < 200 ms server-side`                    |
| **Throughput**    | How many operations per second, steady and at peak? | `3 rps steady, 90 rps for 10 min post-release` |
| **Scale**         | How much data, how many users, growing how fast?    | `50k accounts, 2M rows, +15%/quarter`         |
| **Consistency**   | May a reader see stale data, and for how long?      | `60 s stale OK; read-your-writes on transfer` |
| **Availability**  | What uptime, and what does "down" mean here?        | `99.9% monthly on the read path`              |
| **Durability**    | What may be lost in a failure?                      | `RPO 5 min, RTO 1 h`                          |
| **Accessibility** | Which bar? Usually settled — see `docs/policy/ux.md` | `WCAG 2.2 AA`                                 |
| **Security**      | Which posture? See `docs/policy/security.md`        | Named, not implied                            |

**Every NFR gets a number or a concern.** "Fast" is not a requirement, it is a hope. Where the number
is genuinely not yours to pick, raise it as a concern **carrying the value you would defend** — a
concern with a proposed number gets answered, one asking "what should this be?" gets deferred.

**Every NFR also names the user stories it binds.** That `Binds:` line is what carries the number
into Build: `/to-tickets` cuts one ticket per story and copies the spec's criteria onto it, so a
bound NFR arrives as an acceptance criterion on the slice that has to meet it. Put the coupling in
the artifact, not in the consuming skill — a number that only lives in a section nobody re-reads at
implementation time is not a requirement, it is a note. An NFR binding no story is a finding.

### Back-of-envelope, when it earns the five minutes

Do the arithmetic when the answer changes the design — when it decides whether you need a cache, an
index, a queue, or nothing at all. Skip it when the load is obviously trivial, and say you skipped
it.

The chain is always the same: **users × actions per user per day ÷ 86,400 = average rps**, then
multiply by 2–10× for peak. Size is **rows × bytes per row**, and remember indexes are often as
large as the data.

Orders of magnitude worth knowing, because they decide designs:

| Operation                          | Rough cost      |
| ---------------------------------- | --------------- |
| In-process memory read             | ~100 ns         |
| Redis / remote cache round trip     | ~1 ms           |
| Indexed database read, same region | ~1–5 ms         |
| Unindexed scan over 1M rows        | ~100 ms–1 s     |
| Cross-region round trip            | ~50–150 ms      |
| Cold serverless start              | ~100 ms–1 s     |

The useful output is rarely a precise figure. It is a **sentence like "this is three orders of
magnitude below anything that needs a cache, so we are not adding one"** — which is a design
decision, recorded, that the simplicity advisor no longer has to argue for.

---

## 2. Core entities

The nouns before the schema. Name each entity, what identifies it, what it relates to, and the
cardinality of each relationship.

Use the glossary in `CONTEXT.md`. An entity the codebase already names is that entity — introducing
a synonym is how a domain model forks, and the second name always wins somewhere you did not expect.

**Where the product's UI language is not English, the glossary gives every term two names, and only
one of them is an identifier.** Check `CONTEXT.md` for the rule before naming anything: the localized
name belongs in rendered strings, and the English name belongs in every entity, field, table, column,
and enum value. A translated identifier reads as harmless at Design and is unrenameable afterwards.

Two questions that surface most modelling mistakes at zero cost:

- **What is the lifecycle?** Created by whom, changed by what, deleted or tombstoned when — and does
  anything reference it after that?
- **What is the ownership edge?** Which entity does authorization hang off? An entity with no owner
  is one nobody can scope a query by, and it becomes an IDOR the first time it is exposed.

Schema — columns, types, indexes, migrations — is a **deep dive**, informed by the access patterns
the API section is about to write down. Designing the schema before the access patterns is how you
get indexes for queries nobody runs.

---

## 3. API / interface contract

For each surface, name: **what it is, its shape, and who may call it.** All three, every time.

**Route segments, file paths, and field names are identifiers, not copy.** In a product whose UI is
not English this is the section where that goes wrong, because a route feels like something a user
reads. It is not: it is a URL in a runbook, an analytics key, and a directory on disk, and nobody
renames one after launch. Name them in English and let the page be localized — see `CONTEXT.md`.

### Choosing the surface, in this stack

| Need                                    | Reach for                          | Because                                                                                     |
| --------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------- |
| Render data on a page                   | Server Component, reading directly | No endpoint, no serialization, no auth surface. The default                                 |
| A mutation from a form or a handler     | Server Action                      | Colocated and typed — but it compiles to a **POST endpoint reachable directly**, not only through your UI |
| A caller that is not this app           | Route Handler                      | Webhooks, third parties, anything needing a stable URL, headers, or a non-React client      |
| Shared logic between the above          | A module export in `packages/*`    | Not a network boundary at all                                                               |

**A Server Action is not "an internal function."** It compiles to an endpoint reachable by direct
POST. Next generates encrypted, non-deterministic action IDs and eliminates unused actions from the
bundle, which lowers the risk — but the docs are explicit that this is not authorization, and that a
page-level check does **not** extend to the actions defined on that page. Every action authorizes
independently, validates its own input, and appears in the API contract section like any other
route. This is the single most common design error in this stack.

### The shapes

Name the request and response for each. Where a value is untrusted, say it is parsed into a typed
value **at the boundary, once** — validation scattered past the boundary means some path reaches the
data before the check, and finding which one is a runtime exercise.

Say which side of the **server/client line** each module sits on. Server Components are the default;
state, effects, and handlers force `"use client"`. Everything a client component receives as props
is serialized into the browser payload — `security-design` decides whether what crosses is allowed
to, but this section is where the crossing is named.

---

## 4. High-level design

One pass per `Must` story: the components it touches, in order, from the user's action to the
response. Prose or a list beats a diagram nobody updates.

Name the components, not the files. A file path in a spec goes stale within a session; "the account
read path" does not.

**Where the flow crosses a boundary, mark it** — process, network, trust, or cache. Those marks are
what the advisors read.

---

## 5. Deep dives

**One per NFR the high-level design does not already satisfy.** That is the selection rule, and it
is what keeps this section from becoming a grab-bag. An NFR that the obvious design already meets
gets one line saying so.

This is where **infrastructure** enters — not as a section called "infra", but as the answer to a
number:

| NFR pressure           | The deep dive it forces                                                    |
| ---------------------- | -------------------------------------------------------------------------- |
| Latency                | Caching topology, indexes, denormalization, streaming and Suspense boundaries |
| Throughput             | Connection pooling, queues, batching, rate limits                          |
| Scale                  | Partitioning, pagination strategy, archival                                |
| Consistency            | Transaction boundaries, idempotency keys, read-your-writes handling        |
| Availability           | Timeouts, retries with backoff, circuit breakers, graceful degradation     |
| Durability             | Backups, replication, what a restore actually costs                        |
| Deployment reality     | Runtime, regions, cold starts, environment promotion, secret delivery      |

Two facts about **the release moment** belong in any deep dive that leans on caching, because they
are counter-intuitive and this stack makes them load-bearing:

- **Cache entries do not survive a deploy** — the key includes the build ID. Every release starts
  cold, so the release moment is the peak load on everything upstream, which is the opposite of the
  steady state you just reasoned about.
- Where stages rebuild rather than promote one artifact, `generateBuildId` has to pin a consistent
  ID across containers, or every instance disagrees about its own cache.

---

## 6. Placement in the monorepo

**Name the workspace every new module lands in, and why that one.** `apps/*` is a deployable
surface; `packages/*` is shared code with no deployment of its own. Code that two apps need and one
app holds is a boundary violation the spec should catch, because moving it later is a rename across
every import site.

**A new workspace is a graph change, not a directory.** A spec proposing one names all of it:

- the `@repo/<name>` package name, and whether it is consumed as source or built
- its `tsconfig.json` extending `@repo/typescript-config`, never restating those options
- the `turbo.json` tasks it adds, and what they `dependsOn`
- a `@source` glob in `packages/design-system/src/styles/globals.css` if it carries Tailwind classes
  — without one its classes are silently missing from the build

**Prefer extending config to copying it.** A compiler option every workspace should hold belongs in
`@repo/typescript-config`; a lint rule everyone should follow belongs in the root `.oxlintrc.json`.
A spec that tightens a rule says which level it tightens it at.

### Boundaries

**The export map is the public interface.** `@repo/design-system` has no build step: its `exports`
point straight at source, so the file name *is* the public subpath and there is no barrel to update.
A spec adding to a package like this names the subpath consumers will import, because renaming the
file later is a breaking change with no deprecation path.

**Dependencies point one way.** `packages/*` does not import from `apps/*`. A spec needing that
inversion has found shared code in the wrong place — move it, or flag it.

---

## 7. ADRs

**Read the ADRs under `docs/adr/` that touch this area before designing.** Where the spec
contradicts one, say so in the deep dive that contradicts it, with the reason it is worth reopening.
Where that reason is not yours to judge, flag it — overturning an ADR is the Tech lead's call.

**Propose an ADR when a deep dive decides something durable and beyond this effort**: the store, the
auth model, the caching topology, a new deployment target. Effort folders are archived and never
reopened; `docs/adr/` is read by every future spec.

Write `docs/adr/<NNNN>-<slug>.md` with `status: proposed`, following ADR-0001's shape — the decision
as a title sentence, the options considered with why each was rejected, and the consequences
including the ones you dislike. **Never set `status: accepted`**; that is the human's act, the same
as approving a spec.

---

**Done when** every `Must` story is demoable alone, every non-functional requirement carries a
number or a concern **and names the stories it binds**, every API entry names its shape and its
authorization, every NFR has a deep
dive or an explicit line saying the design already satisfies it, and every new module names its
workspace and its public subpath.
