---
status: proposed
---

# The domain package is the only door to the database

A Server Action authorizes, parses its input once at the boundary, and calls one module in
`@repo/domain`. It never builds a query, never opens a transaction, and never imports a schema.
`@repo/domain` owns the Drizzle schema, the connection, the migrations and the Better Auth instance,
and **does not export any of them** — its `exports` map publishes only per-aggregate model subpaths
plus two pure ones, `./projections` and `./policy`.

The boundary is enforced by the export map rather than by convention: an unexported subpath is
unresolvable under pnpm's isolated store, so reaching past the domain layer is a module-resolution
error rather than a review comment somebody has to notice.

Every function that reads or writes an owned row takes the **principal as its first required
parameter**, and no unscoped finder is exported. Ownership is therefore a type error to omit rather
than a rule to remember.

## Considered options

**Queries inline in Server Actions and route files.** Fewest moving parts, and the default a Build
session reaches for. Rejected on testability, which in this stack is not a preference: Vitest cannot
test `async` Server Components, and an imported Server Action is not the compiled POST endpoint an
attacker reaches — so a business rule written inline in `apps/web` is a rule **nothing can
automatically verify**. In a product whose characteristic bug is disclosing a displaced person's
phone number, that is the wrong place to put the rules.

**A separate `@repo/db` package beneath a separate `@repo/domain`.** The first draft of effort 0002's
spec proposed exactly this. Rejected because its stated invariant — "nothing imports `@repo/db`
except `@repo/domain`" — was already violated by the auth package in the same table, and because two
packages enforce one edge while enforcing nothing about the rest. A withholding export map inside one
package is a stronger guarantee and three fewer `package.json`, `tsconfig.json`, `vitest.config.mts`
and lint configs.

**A repository/unit-of-work abstraction over the ORM.** Rejected as the layer that buys nothing here:
Drizzle is already the seam, and wrapping it would add indirection without adding a boundary the
export map does not already give.

## Consequences

**Business rules become testable at the highest available seam.** Pure functions — projections, state
machines, validators, ordering — sit in `./projections` and `./policy` and are covered by an ordinary
Node-environment Vitest suite. Transaction-owning modules are covered against an in-process Postgres.
Neither needs a running Next.js server.

**One projection discipline covers every egress.** Because the shapes that cross a boundary are built
in one package, [ADR-0003](0003-no-tojson-on-cross-boundary-types.md)'s whitelist rule has a single
home, and a fourth egress — a subject-access export, an admin view — inherits it rather than
reinventing it.

**A domain package is a place things accrete.** The rule that keeps it honest: `./policy` and
`./projections` import nothing from the connection, so "is this a rule or a query?" has a mechanical
answer. If that stops being true, the split into two packages is the fix and it costs a day of moving
files.

**`apps/web` importing the schema is now a resolution failure**, which is the behaviour we wanted —
but it also means a legitimate need (a one-off script, a migration tool) has to widen the export map,
and widening it "just for a script" removes the boundary with no compile error anywhere. That widening
is the thing to watch in review.
