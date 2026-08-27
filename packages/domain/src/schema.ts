/**
 * The Drizzle schema. **Withheld from the `exports` map on purpose** — `apps/web`
 * importing this is a module-resolution error rather than a review comment
 * ([ADR-0010](../../../docs/adr/0010-the-domain-package-is-the-only-door-to-the-database.md)).
 *
 * This is also the file every later slice's migration is generated from, so it
 * carries DD2's three per-table rules by demonstration rather than by
 * restatement: `NOT NULL` wherever feasible, `created_at TIMESTAMPTZ NOT NULL
 * DEFAULT now()` on every table, and an index on every foreign key column
 * (there are none here yet — Postgres does not create them, and an unindexed FK
 * turns NFR17's leaf-first purge into a sequential scan per parent row).
 */

import { sql } from "drizzle-orm";
import { bigint, check, integer, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";

/**
 * **`RateCounter`** — per principal, per action, per window. The spec's own
 * description is "boring, and NFR26 rests on it", and boring is why it is the
 * first table: it is the only entity in this effort that is plumbing rather than
 * a story, so it does not take DDL out of a later slice's vertical cut. The
 * `./rate-limit` module that reads and writes it ships with its first ceiling
 * (#12, `requestMagicLink ≤ 5/hour per address`).
 *
 * **`BIGINT GENERATED ALWAYS AS IDENTITY`, and `mode: "bigint"`.** DD2 makes a
 * UUIDv7 the exception rather than the rule — 16 bytes against 8, widening every
 * index and every foreign key that references it — and reserves it for ids that
 * reach a URL or a browser. Nothing about a rate counter does. Reading the key
 * as a JavaScript `BigInt` rather than a `number` is exact where `number` is
 * lossy past 2^53, and it has a second effect worth keeping: `JSON.stringify`
 * throws on a `BigInt`, so a key that was never meant to cross a boundary cannot
 * be serialised into one by accident.
 *
 * **`action` carries no `CHECK` yet, and that is not an oversight.** DD2 makes
 * enum-shaped columns `TEXT` with a `CHECK (col IN (...))` precisely so that
 * widening the set is a constraint change rather than a type alteration — and
 * the set of ceilinged actions is empty until the slice that adds the first one.
 * A `CHECK` enumerating nothing would refuse every row.
 */
export const rateCounter = pgTable(
  "rate_counter",
  {
    id: bigint("id", { mode: "bigint" }).generatedAlwaysAsIdentity().primaryKey(),

    /**
     * Whoever the ceiling is charged against — an account id, an email address,
     * an IP. Deliberately a `TEXT` key rather than a foreign key: NFR26's first
     * ceiling is `requestMagicLink`, which is charged **before** an Account
     * exists, so a foreign key would make the one case it is needed for
     * unrepresentable.
     */
    principal: text("principal").notNull(),

    /** The ceilinged action's name. English identifier, per ADR-0012. */
    action: text("action").notNull(),

    /** The window's opening instant. `TIMESTAMPTZ`, like every instant here. */
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),

    /** How many times the action has been taken inside the window. */
    count: integer("count").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /**
     * The constraint **is** the lookup: a ceiling check reads exactly one row by
     * (principal, action, window), and an upsert needs a unique index to conflict
     * against. One object doing both jobs is why there is no separate index here.
     */
    unique("rate_counter_principal_action_window_start_key").on(
      table.principal,
      table.action,
      table.windowStart,
    ),

    /**
     * A backstop that must never fire. DD2: the boundary parse is where
     * validation is authoritative and produces `fieldErrors` for a person; a
     * `CHECK` firing is a 500, not a field error.
     */
    check("rate_counter_count_non_negative", sql`${table.count} >= 0`),
  ],
);
