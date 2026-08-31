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
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { ADMIN_ACTION_NAMES } from "#admin/names";
// Imported as well as re-exported below: the two Admin tables at the foot of
// this file reference `user.id`, and a re-export creates no local binding.
import { user } from "#auth-schema";
import { inList } from "#column-types";
import { CONSENT_SIDES } from "#consent/registry";
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
/**
 * **`Consent`** — the *prueba de la autorización*, and the reason story 14 is
 * ordered before the form it protects.
 *
 * Deployment is continuous from the first ticket, so shipping the publishing
 * form first and the consent second would collect a displaced person's phone
 * number in production with no *autorización* behind it. The order is the
 * requirement, and this table is the half of it that survives the session.
 *
 * **It records what was consented to and when, per side.** Written for the
 * Worker at publish and for the Hirer at first Offer send — the second half is
 * the one the draft missed: the platform collects and then discloses his name,
 * phone and email too, and he was consenting to nothing.
 *
 * **Append-only, and deliberately without a `UNIQUE (account_id, side)`.** A
 * *reclamo* asks what a person agreed to *at the time*, so a version bump has to
 * write a second row rather than update the first. An upsert would destroy
 * exactly the fact the table exists to hold, and it would do it silently.
 *
 * **`ON DELETE CASCADE`, with no exception** (C19). The proposal on the table
 * was that this row survive the purge of the Account it authorizes, reduced to
 * versions and a hash. It does not: story 13 tells her deletion removes
 * everything from the platform, and a retained proof row is a record she was told
 * did not survive. What that costs is stated rather than hidden — the evidence
 * that we were permitted to hold her data is gone while a Report about her may
 * still be inside its 24-month window — and the answer to a *reclamo* about a
 * deleted Account is that the record was deleted at the *titular*'s request,
 * which is defensible precisely because it is what she was promised.
 */
export const consent = pgTable(
  "consent",
  {
    /**
     * `BIGINT IDENTITY`, for `rate_counter`'s reason: DD2 reserves a UUIDv7 for
     * ids that reach a URL or a browser, and this one reaches neither. Reading it
     * as a `BigInt` also makes `JSON.stringify` throw on it, so a key never meant
     * to cross a boundary cannot be serialised into one by accident.
     */
    id: bigint("id", { mode: "bigint" }).generatedAlwaysAsIdentity().primaryKey(),

    /** The Account whose data the *autorización* covers. */
    accountId: text("account_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    /**
     * Which of the two collections this row authorizes. `TEXT` with a `CHECK`
     * over the sides registry, per DD2 — widening the set is then a constraint
     * change rather than a type alteration.
     */
    side: text("side").notNull(),

    /**
     * Which *aviso de privacidad* was in force. The text itself is published at
     * `/privacy`, which is what makes this column answer a question rather than
     * merely record that a question was asked.
     */
    noticeVersion: text("notice_version").notNull(),

    /** Which *autorización* she actually read. Versioned apart from the notice. */
    authorizationVersion: text("authorization_version").notNull(),

    /**
     * **Express consent to international transmission** (C15), and the column is
     * the evidence rather than a flag a caller sets.
     *
     * Every processor this product uses — PlanetScale, Fly, Cloudflare, Google,
     * Resend, Sentry — is outside Colombia, so each is a *transmisión* requiring
     * disclosure in the *autorización*. Express authorization is the path that
     * holds however SIC adequacy is read, which is why it is taken rather than
     * made to depend on that reading.
     *
     * It is always true, and the `CHECK` below is what makes that structural. A
     * nullable or freely-`false` column would let a later caller write a row that
     * claims an authorization it does not carry, and nothing downstream could
     * tell the two apart.
     */
    transmissionAcknowledged: boolean("transmission_acknowledged").notNull(),

    /** The *when* half of the criterion. `TIMESTAMPTZ`, like every instant here. */
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /**
     * DD2's rule that every foreign key column carries its own index — Postgres
     * creates none, and an unindexed FK turns NFR17's leaf-first purge into a
     * sequential scan per parent row. `created_at` rides along because both reads
     * this table has are per-Account and ordered: the subject-access export, and
     * the "has this side already consented" check `sendOffer` makes to know an
     * Offer is his first.
     */
    index("consent_account_id_idx").on(table.accountId, table.createdAt),

    /** DD2's rule for an enum-shaped column, written from the registry itself. */
    check("consent_side_known", inList(table.side, CONSENT_SIDES)),

    /**
     * A backstop that must never fire, and the one constraint here that is about
     * meaning rather than shape. See the column comment: a row recording consent
     * without the transmission acknowledgement is not a weaker row, it is a row
     * that misrepresents what was authorized.
     */
    check("consent_transmission_acknowledged", sql`${table.transmissionAcknowledged}`),
  ],
);

/**
 * **The Admin's second factor** — ours, rather than Better Auth's `two_factor`
 * beside it, and the difference is not a preference.
 *
 * The plugin that owns that other table can only challenge a credential path:
 * its sign-in interception matches `/sign-in/email`, `/sign-in/username` and
 * `/sign-in/phone-number` and nothing else. The Admin door has no password to
 * put on any of those paths, so a factor the plugin holds is a factor the door
 * can never ask for. DD5 says so as the cause rather than as the symptom, and
 * this table is what taking the second factor back costs: two encrypted columns
 * and the code that reads them.
 *
 * **Both credential columns are encrypted at rest** with `symmetricEncrypt` from
 * `better-auth/crypto`, keyed on `BETTER_AUTH_SECRET` — the same primitive and
 * the same key the plugin used, so the standing rotation hazard is unchanged
 * rather than newly introduced: rotating that variable invalidates every
 * enrolled factor, which makes it an operational event with a recovery step and
 * not routine hygiene. Both belong to C28's `secret` class: no log line, no
 * Sentry event, no subject-access export.
 *
 * **One row per Account, by unique constraint.** Re-enrolment replaces rather
 * than accumulates, which is what makes runbook §6's break-glass — run the
 * command again — a complete recovery rather than a second factor competing with
 * the one that was lost. The constraint is also the index DD2 asks for on every
 * foreign key column, which is why there is no separate `index()` here.
 *
 * **`BIGINT GENERATED ALWAYS AS IDENTITY`**, for `rate_counter`'s reason: DD2
 * reserves a UUIDv7 for ids that reach a URL or a browser, and this one reaches
 * neither.
 */
export const adminSecondFactor = pgTable(
  "admin_second_factor",
  {
    id: bigint("id", { mode: "bigint" }).generatedAlwaysAsIdentity().primaryKey(),

    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    /** The TOTP secret, encrypted. Decrypted on the verify path and nowhere else. */
    secret: text("secret").notNull(),

    /**
     * The codes that have **not** been used yet, encrypted, as one JSON array.
     *
     * Storing the remainder rather than the whole set plus a used-list is what
     * makes "each code works once" a property of the column instead of a rule a
     * query has to remember: consuming one is a rewrite of this value with that
     * member gone, inside the transaction that establishes the session.
     */
    backupCodes: text("backup_codes").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("admin_second_factor_user_id_key").on(table.userId)],
);

/**
 * **The setup link, and the two values it renders**, held between the moment
 * `pnpm admin:enrol` prints a link and the moment somebody types six digits back
 * into the terminal.
 *
 * **It exists because the grant is the last step.** The command mints the secret
 * and the ten codes, shows them once through the browser, and only writes
 * {@link adminSecondFactor} and sets `isAdmin` once a code has proved the
 * authenticator works — so a link opened and abandoned leaves no Admin behind and
 * a half-enrolled Admin is unrepresentable. That ordering needs somewhere to keep
 * the two values in the meantime, and this is it.
 *
 * **The token is hashed at rest**, for the reason C28 gives the magic link: a
 * single read of a table holding live tokens in the clear is every outstanding
 * link. The row carries the hash and the browser carries the token.
 *
 * **There is no `consumed_at` column, and its absence is the design.** The row
 * is deleted when the command confirms, so "spent" and "never existed" are the
 * same answer — which is what the surface needs anyway, since an expired, spent,
 * unknown or malformed token is all one 404 with no message. It is also what
 * makes a refresh re-render the same values until the terminal closes the token:
 * rendering reads, it does not consume, and there is no flag for a render to set.
 *
 * **At most one live link per Account, by unique constraint.** Minting deletes
 * whatever the Account already had, so running the command twice is a person
 * starting over rather than a person holding two enrolments — but that delete is
 * a query remembering to check, and the guarantee is the constraint underneath
 * it. Without the constraint, a second `admin:enrol` racing the first leaves two
 * live links against one Account, and the abandoned one's codes stay enrollable
 * by whoever holds that URL.
 */
export const adminEnrolment = pgTable(
  "admin_enrolment",
  {
    id: bigint("id", { mode: "bigint" }).generatedAlwaysAsIdentity().primaryKey(),

    /** `sha256` of the token in the printed link. Never the token itself. */
    tokenHash: text("token_hash").notNull(),

    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    /** Encrypted, exactly as in {@link adminSecondFactor}, and moved across unchanged. */
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),

    /**
     * Short, and short for a different reason than the magic link's fifteen
     * minutes. That window is sized against a mailbox round trip and the link
     * scanners that fetch a `GET` on the way; this one is printed to a terminal
     * that is sitting at a prompt waiting for the person who ran it, so the
     * window is bounded by one person's attention rather than by delivery.
     */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /**
     * The lookup **is** the constraint: the page reads exactly one row by token
     * hash, and a second row under one hash is a collision this table must
     * refuse rather than resolve.
     */
    unique("admin_enrolment_token_hash_key").on(table.tokenHash),

    /**
     * **One live link per Account, said by the engine.** See the class comment:
     * the delete in `mintAdminEnrolment` is what makes re-running the command
     * work, and this is what makes "at most one" true whether or not a caller
     * remembered it.
     *
     * It is also DD2's index on a foreign key column — a `UNIQUE` constraint
     * creates one, which is why there is no separate `index()` here.
     */
    unique("admin_enrolment_user_id_key").on(table.userId),
  ],
);
