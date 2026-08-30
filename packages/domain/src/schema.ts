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
import {
  bigint,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { ADMIN_ACTION_NAMES } from "#admin/names";
import { inList } from "#column-types";
import { CEILINGED_ACTIONS } from "#rate-limit";

/**
 * Better Auth's tables, re-exported so `drizzle(client, { schema })` sees one
 * object holding every table this package owns — which is what its adapter looks
 * models up in. They live in their own file because they are pinned to a vendor's
 * definition rather than designed here; `auth-schema.ts` says how that pin works.
 */
export {
  account,
  ADMIN_SIGN_IN_METHOD,
  PASSWORDLESS_SIGN_IN_METHODS,
  rateLimit,
  session,
  SIGN_IN_METHODS,
  type SignInMethod,
  twoFactor,
  user,
  verification,
} from "#auth-schema";

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
 * **`action` now carries the `CHECK` this comment used to promise.** DD2 makes
 * enum-shaped columns `TEXT` with a `CHECK (col IN (...))` precisely so that
 * widening the set is a constraint change rather than a type alteration, and the
 * set was empty until the slice that added the first ceiling. #12 is that slice:
 * `requestMagicLink` is the one member, and the other seven NFR26 names arrive
 * as one-line constraint changes beside the ceiling they belong to. The
 * authority on the set is `CEILINGS` in `./rate-limit`; this constraint is the
 * database refusing what that registry does not know.
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

    /**
     * DD2's rule for an enum-shaped column. See the class comment above.
     *
     * Through `inList` rather than a literal since #17, which is what that helper
     * is for: `CEILINGS` in `./rate-limit` is the authority on the set, and a
     * literal here was a second spelling of it. The emitted SQL is unchanged, so
     * this is not a migration.
     */
    check("rate_counter_action_known", inList(table.action, CEILINGED_ACTIONS)),
  ],
);

/**
 * **`AdminAction`** — NFR33's audit record, and the reason it is a table rather
 * than a log line.
 *
 * Two numbers decide that. NFR17 gives log lines **30 days**; a Report lives
 * **24 months**, and the incident an audit reconstructs may not surface for a
 * year. And NFR18 forbids the payload on a line at all, so an audit that lived in
 * the log would be an audit with the identifiers stripped out of it. DD16's
 * STRIDE walk names Repudiation as the one letter with no other answer here.
 *
 * **It carries ids, an enum value and an instant. Nothing else, ever.** The
 * `Must` in the spec's Core entities is "actor, action, target id, timestamp; ids
 * and enum values only", and NFR33 adds the reason: _"an audit table that
 * accumulates personal data is a second copy of the thing NFR11 counts"_. A
 * column here holding a name, an address, a phone number or an Offer body would
 * make this table a `personal` store with a 24-month retention — the longest in
 * the system — which is the exact opposite of what it is for.
 *
 * **There are no foreign keys, and their absence is the requirement.** The audit
 * has to survive what it audits: a taken-down profile, a banned Hirer, a deleted
 * Account under story 13's habeas data path. A `REFERENCES … ON DELETE CASCADE`
 * would delete the record of the act at the moment the act took effect, and
 * `ON DELETE SET NULL` would keep a row that can no longer say who or what. So
 * both ids are plain `TEXT` — deliberately unjoined, which is also why
 * `## Testing Decisions`' leaf-first purge never reaches this table.
 *
 * **Nothing writes it directly.** `runAdminAction` in `#admin` is the only
 * writer, and it writes inside the transaction of the action it records — so **0**
 * *registered* Admin actions can commit unaudited. See that module for why the
 * handlers are unexported, and for what that claim does and does not cover.
 */
export const adminAction = pgTable(
  "admin_action",
  {
    /**
     * `BIGINT GENERATED ALWAYS AS IDENTITY`, for `rate_counter`'s reason: DD2
     * reserves a UUIDv7 for ids that reach a URL or a browser, and an audit row's
     * id reaches neither. `mode: "bigint"` makes `JSON.stringify` throw on it,
     * so a key never meant to cross a boundary cannot be serialised into one.
     */
    id: bigint("id", { mode: "bigint" }).generatedAlwaysAsIdentity().primaryKey(),

    /**
     * The Admin who acted — `user.id`, and **not** a foreign key. See the class
     * comment: an Admin whose Account is later deleted must not take the record
     * of what they did with them.
     */
    actorAccountId: text("actor_account_id").notNull(),

    /** Which action. English identifier, per ADR-0012. */
    action: text("action").notNull(),

    /**
     * What it acted on: an Account id, an Offer id, a profile slug. **One column
     * rather than one per target type**, because the row's job is to name the
     * thing, and the `action` beside it already says what kind of thing it is.
     */
    targetId: text("target_id").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /**
     * The two questions this table is asked, and they are asked at incident time
     * rather than on a request path: *what did this Admin do* and *what has been
     * done to this thing*. Both are reads over an append-only table that grows by
     * one row per moderation act, so the indexes are cheap and the queries are
     * the reconstruction NFR33 exists to make possible.
     */
    index("admin_action_actor_account_id_idx").on(table.actorAccountId, table.createdAt),
    index("admin_action_target_id_idx").on(table.targetId, table.createdAt),

    /**
     * DD2's rule for an enum-shaped column, written from the registry's own names
     * rather than restated — see `inList` in `#column-types` for why the second
     * spelling is the bug. This is the database refusing an action the registry
     * does not know, and `#admin/handlers`' `satisfies` is the compiler refusing
     * the reverse.
     */
    check("admin_action_action_known", inList(table.action, ADMIN_ACTION_NAMES)),
  ],
);
