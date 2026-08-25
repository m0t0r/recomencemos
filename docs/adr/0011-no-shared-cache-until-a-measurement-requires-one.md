---
status: proposed
---

# No shared cache until a measurement requires one

Cache Components is on, so `use cache` and `use cache: remote` are available on every read path — and
this codebase uses neither. Public reads are plain indexed queries against Postgres, served
dynamically. The decision is not "caching is bad"; it is that a shared cache may be introduced only by
a **measurement showing a stated latency number is missed**, and that it arrives with a test proving
what the cached function returns.

## Considered options

**Cache the public read paths, which is the obvious move.** The Wall and the browsable list are
public, identical for every visitor, and read on every page load — the textbook case. Rejected on
three grounds that compound.

_The dangerous leak is the one that compiles._ The reassuring argument is that a gated read cannot sit
inside a cached scope because it calls `cookies()`. That is true only of reads that call `cookies()`.
The shape this codebase would actually produce is the compliant-looking one: authorize **outside** the
cache, pass the account id or the profile id in as an **argument**, return the gated shape. It
compiles, it type-checks, it passes review — and it serves one person's private data to everyone who
hits the entry, on a shared key. The framework is not a control against that; only a test asserting a
cached function's output against a whitelist is, and that test is a standing obligation on every
cached function anyone ever writes.

_Nothing showed the cache was needed._ At the scale this system was designed for — three
municipalities, hundreds of published profiles — a keyset query over a partial B-tree index returning
a page of rows, with its joins aggregated in the same statement, is a single-digit-millisecond read,
and the application and the database sit in the same metro. The latency target is orders of magnitude
above that. Adding a cache to meet a number already met is complexity bought with no receipt.

_It would rarely be warm._ Cache entries key on the build id, so every deploy empties them. Under
continuous deployment on a single machine, entries are discarded several times a day — so the cache
would pay its full correctness cost for a fraction of its benefit, and the release moment would become
the peak load on everything upstream.

**Cache with a strict lint rule instead of a prohibition.** Rejected because no lint rule
distinguishes "an id used to build a cache key" from "an id whose row is private": both are a string
parameter. The property is semantic and only a test reaches it.

## Consequences

**A whole class of disclosure bug is absent rather than guarded.** There is no shared cache, so there
is no shared-cache leak to review for, and no proof obligation inherited by future code.

**The latency target is now load-bearing and must actually be measured.** Removing the cache means the
database is on the critical path of every public read, so the indexes that serve those reads are not
an optimization — they are the design. A read pattern arriving without its index is the regression to
catch.

**Cache Components stays on, and its other half still binds.** Uncached data outside a `<Suspense>`
boundary still fails the build, so every streaming boundary and its fallback remains a designed state.
Nothing here relaxes that.

**The terms of return are stated, so this is a decision rather than a taboo.** A shared cache may be
introduced when a measurement shows a stated number is missed. It arrives with: the measurement, the
narrowest possible cached function, and a test asserting its return value against the public
whitelist. Re-read the first rejected option before writing it — the failure mode is not obvious while
you are writing it, which is the whole reason this is an ADR.

**One machine is doing quiet work in this argument.** With a single instance there is no
cross-instance invalidation problem to solve and no `refreshTags()` handler to write. A second
instance reintroduces both, and would be the moment to re-read this decision rather than to route
around it.
