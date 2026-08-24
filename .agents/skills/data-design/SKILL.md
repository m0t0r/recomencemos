---
name: data-design
description: The data lens on a spec — entities to schema, indexes derived from access patterns, migration safety, cache ownership per read path, classification and retention. Load when writing or advising on a spec.md.
---

# Data design

Data design runs **after** the API contract, never before it. The access patterns are the input: you
index for the queries the spec actually writes down, and a schema designed before them gets indexes
for queries nobody runs and misses the one that matters.

Policy — the store, the ORM, primary keys, retention, migration reversibility — lives in
`docs/policy/data.md`. A value recorded there as `UNSET` becomes a **flagged concern naming the file
and the key**.

**This template ships no database.** No `packages/db`, no Postgres, no Redis, no ORM. Until one
lands, a spec touching data states the store it assumes and flags what the absent layer would have
settled. Say that plainly rather than designing against an imagined stack.

---

## 1. Entities to schema

`system-design` produced the nouns. Turn each into a table.

**Derive indexes from the access patterns, in writing.** List every query the API contract implies —
the filter, the sort, the join — then name the index that serves it. An index with no query and a
query with no index are both findings.

- The leading column of a composite index is the one you filter by equality; the sort column comes
  after. Getting that order backwards produces an index the planner will not use.
- **Every foreign key gets an index** unless you can name the reason it does not. Deletes and joins
  both scan without one.
- A `UNIQUE` constraint is an index. Do not add a second one over the same columns.

**Normalize until it hurts, denormalize until it works** — and when you denormalize, say **what
keeps the copies in agreement** and what happens when they disagree. A denormalized column with no
stated reconciliation path is a bug with a schedule.

**Name the authoritative shape.** The database constraint and the application-side schema will both
describe a column. Say which one a violation is reported against; two authorities means an invalid
row is rejected twice or nowhere.

For engine-specific depth once a store is chosen, the `planetscale:postgres`, `planetscale:mysql`,
and `planetscale:vitess` skills carry it. Load the one that matches `store` in the policy file
rather than reasoning from memory about a database this repo has not chosen.

---

## 2. Migrations

**Every schema change is a migration**, named in the spec, and either reversible or explicitly
one-way with the reason.

**A change with a wide blast radius is expand–contract, not one migration.** Add the new form beside
the old so nothing breaks; migrate readers and writers over; delete the old form once no caller
remains. Each step is its own ticket, and `/to-tickets` already knows this sequence — the spec's job
is to say which changes need it.

The tells that a change needs expand–contract: renaming or dropping a column in use, narrowing a
type, adding a `NOT NULL` without a default, or changing the meaning of an existing value.

**Where a migration is one-way, `operability-design` owns the forward fix**, because "roll back"
will not be available when it is needed. Hand it over explicitly.

---

## 3. Cache ownership

**One cache owner per read path, named in the spec.** A read path with two owners is the bug this
lens exists to prevent: two caches disagree about one row, and which answer a user gets depends on
which instance served them.

| Read path                           | Owner                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------ |
| Rendered output                     | Next. Your store appears only as the handler beneath it, never beside it |
| Domain data that is not rendered    | Your store — and it is then **not** also wrapped in `use cache: remote`  |
| Per-user or per-session             | `use cache: private`, or your store keyed by session                     |
| Locks, rate limits, queues, pub/sub | Your store. Not a caching question at all                                |

Redis is not a competitor to Cache Components. It is the storage engine *under* `use cache: remote`,
wired through `cacheHandlers` in `next.config.ts`. The three directives differ in **storage and
reach**, not in purpose:

- `use cache` and `use cache: remote` are **shared across all users**, and neither can read
  `cookies()`, `headers()`, or `searchParams` — runtime values must be passed in as arguments.
  `remote` adds durability and a hit rate that survives across instances, at the cost of
  infrastructure and a lookup on the request path.
- `use cache: private` is **never stored on the server** — browser memory only, gone on reload. It
  reads runtime APIs directly, takes no custom handler, and is unavailable in Route Handlers.

Per-user data in the shared remote handler is a cross-user leak. That is where this lens hands off to
`security-design`; a read path mixing an identity into a shared key is one concern under both.

### Two traps to write into the spec

**Tag invalidation does not cross instances.** `revalidateTag()` on one instance invalidates only
that instance; the others serve stale content until they independently discover it. The fix is
`refreshTags()` in the custom handler, syncing tag state from shared storage before each request.
This is invisible with one container and a one-in-N data bug behind a load balancer, so a spec that
revalidates by tag says which handler carries `refreshTags()`.

**Cache entries do not survive a deploy** — neither `use cache` nor `use cache: remote`, by design:
the key includes the build ID. A spec treating the cache as a warm store is wrong on every release.
Where stages rebuild rather than promote one artifact, `generateBuildId` has to pin a consistent ID
across containers, or every instance disagrees about its own cache.

---

## 4. Classification and retention

**Classify every new column** — `public`, `internal`, `personal`, or `secret`. The vocabulary and its
consequences are fixed in `docs/policy/data.md`. An unclassified column is a flag, not an omission.

The classification is not a label, it decides three things:

- whether the column may sit in a **shared cache** (`personal` and `secret`: never),
- whether it may appear in a **log line** — a log inherits the classification of what it contains,
  and a spec that logs a whole request object has logged everything in it,
- whether it may **cross to the client**, which `security-design` decides against the same
  classification.

**Personal or secret data carries a retention period and a deletion path**, or a concern naming the
regime that decides it. "Deleted" also has to mean something specific: rows, backups, logs, and
caches are four different places, and a deletion path that only names the first is incomplete.

---

## Advisory output

When running as `data-advisor`, return analysis — never spec prose, never a finished section. The
architect writes the spec.

- **Recommend** — what the spec should settle, with the access pattern or constraint that makes it
  decidable.
- **Risk** — what the draft as written gets wrong, and the concrete failure it produces.
- **Concern** — what only the Data lead can settle, in `docs/policy/owners.md`'s format, with the
  `**Unblocks by setting:**` line where a policy key is the blocker.
- **Handoff** — what you need from another edge. Cache ownership and classification both hand off to
  `security-design`; one-way migrations hand off to `operability-design`.

---

**Done when** every query in the API contract names the index that serves it, every schema change
names its migration and whether it is reversible, every read path names exactly one cache owner,
every new column carries a classification, and everything `personal` or `secret` carries a retention
period and a deletion path.
