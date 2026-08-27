/**
 * Column types Drizzle does not ship, defined once so two tables cannot spell
 * the same thing differently.
 */

import { customType } from "drizzle-orm/pg-core";

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
