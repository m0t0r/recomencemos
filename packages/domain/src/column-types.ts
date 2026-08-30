/**
 * Column types Drizzle does not ship, defined once so two tables cannot spell
 * the same thing differently — plus the one constraint builder DD2's rule for an
 * enum-shaped column needs.
 */

import { type SQL, sql } from "drizzle-orm";
import { type AnyPgColumn, customType } from "drizzle-orm/pg-core";

/**
 * `citext` — case-insensitive text, and the type **Core entities** fixes for an
 * Account's email.
 *
 * The alternative is a `UNIQUE` index over `lower(email)` plus a discipline that
 * every read lowercases first. That discipline holds until one query does not,
 * and the symptom is a second Account for a person who capitalised her address
 * on a phone keyboard — which on this product means her CapabilityProfile is on
 * the other one. The type is the mechanism; the discipline is the thing being
 * replaced.
 *
 * **The extension is enabled out of band on all three engines, and a
 * `CREATE EXTENSION` never appears in a migration.** That is this repository's
 * existing decision, not a gap: `docker/postgres/initdb/10-extensions.sql` does
 * it for the Compose stack, `src/testing/global-setup.ts` does it for PGlite,
 * and go-live runbook §2 does it by hand on PlanetScale — because a
 * `CREATE EXTENSION` in a committed migration is a statement that cannot run
 * against a managed provider gating extensions behind a dashboard toggle.
 *
 * So a migration using this type depends on a step outside itself, and the
 * runbook is where that step lives.
 */
export const citext = customType<{ data: string; driverData: string }>({
  dataType: () => "citext",
});

/**
 * `col IN ('a', 'b', …)` built from a TypeScript tuple — DD2's rule for an
 * enum-shaped column, with the set stated once.
 *
 * **The duplication this removes is not cosmetic.** DD2 makes an enum-shaped
 * column `TEXT` with a `CHECK` "precisely so that widening the set is a
 * constraint change rather than a type alteration", and every such column
 * therefore has two spellings of one set: the `as const` array the application
 * validates against, and the literal inside the constraint. They agree until
 * somebody adds a member to one of them, and the failure is asymmetric — a
 * member added to the array alone type-checks, passes every pure test, and
 * throws a constraint violation in production on the first row that uses it.
 *
 * Passing the array is what makes that unrepresentable. `session.sign_in_method`
 * is the first reader; `rate_counter.action` and `admin_action.action` are the
 * others, and NFR26's seven remaining ceilings arrive through the same door.
 *
 * **The values are inlined as literals rather than bound as parameters, and that
 * is the only shape that works here.** Measured rather than assumed: the obvious
 * `` sql`${column} IN ${values}` `` type-checks and produces a correct *query* —
 * but a `CHECK` constraint is not a query, it is DDL that `drizzle-kit generate`
 * serialises to a file, and the placeholders serialise with it. The first attempt
 * emitted `CHECK ("action" IN ($1))` into `0002_…sql`, which is a migration that
 * fails on the engine at the moment it matters. There is no parameter to bind at
 * `ALTER TABLE` time; a constraint's values are part of the schema.
 *
 * So the escaping is this function's job, and {@link assertLiteral} is how it is
 * discharged rather than assumed: every caller passes a compile-time `as const`
 * tuple of English identifiers (ADR-0012), and anything else is refused loudly at
 * module load — which is `pnpm db:generate` and `pnpm check-types` failing, not a
 * migration shipping. A `TEXT` list built from a value a person typed has no
 * business in DDL at all, and this is the guard that says so.
 */
export function inList(column: AnyPgColumn, values: readonly string[]): SQL {
  const literals = values.map((value) => `'${assertLiteral(value)}'`).join(", ");
  return sql`${column} IN (${sql.raw(literals)})`;
}

/**
 * The shape every enum member in this schema has, and the reason `sql.raw` above
 * is safe rather than merely convenient.
 *
 * Deliberately narrower than "escape the quotes". Escaping would make an
 * arbitrary string safe to inline and would therefore invite one; this refuses
 * anything that is not already an identifier, which is what DD2's enum-shaped
 * columns hold and what ADR-0012 requires them to hold. A member that needs a
 * space, a quote or an accent is a member that has stopped being an identifier,
 * and the right response is to notice rather than to quote it correctly.
 */
function assertLiteral(value: string): string {
  if (/^[A-Za-z][A-Za-z0-9_]*$/.test(value)) return value;

  throw new TypeError(
    `"${value}" is not an English identifier, so it may not be inlined into a CHECK constraint. ` +
      "An enum-shaped column holds English identifiers; a value from outside this " +
      "repository's own `as const` registries does not belong in DDL.",
  );
}
