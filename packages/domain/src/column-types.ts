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
 * **Both engines this repository runs against carry it**: PGlite bundles the
 * extension (`src/testing/database.ts` passes it on create *and* on restore) and
 * PlanetScale for Postgres supports it (spec 0002, `## Testing Decisions`). The
 * migration that first uses it is what installs it.
 */
export const citext = customType<{ data: string; driverData: string }>({
  dataType: () => "citext",
});
