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
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { v7 } from "uuid";
import { ADMIN_ACTION_NAMES } from "#admin/names";
// Imported as well as re-exported below: the two Admin tables at the foot of
// this file reference `user.id`, and a re-export creates no local binding.
import { user } from "#auth-schema";
import { inList } from "#column-types";
import { CONSENT_SIDES } from "#consent/registry";
import { CITY_IDS } from "#policy/cities";
import { INITIAL_OFFER_STATE, OFFER_STATES } from "#policy/offer-states";
import { PHOTO_STATES, PROFILE_STATES } from "#policy/profile-states";
import { SKILL_REQUEST_STATES } from "#policy/skill-request-states";
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

/**
 * **`Skill`** — the closed vocabulary a CapabilityProfile is built from, and the
 * one table in this schema whose rows are *copy*.
 *
 * **The seed is a source, not the vocabulary** (DD12). CUOC — the *Clasificación
 * Única de Ocupaciones para Colombia*, established by Decreto 654 de 2021 and
 * Resolución 771 de 2021, maintained by DANE — is written in the register of a
 * labour statistician, and the person reading the publishing form is a cook
 * deciding whether a phrase describes her. {@link skill.cuocCode} records where
 * an entry came from; {@link skill.labelEs} is what she reads, and the two are
 * deliberately not the same sentence.
 *
 * **`slug` is English and `labelEs` is Spanish, in one row.** That is NFR29's
 * identifier/value line at its sharpest: the slug is what a browse filter carries
 * in a query parameter, so it is an identifier and stays English
 * ([ADR-0012](../../../docs/adr/0012-spanish-is-the-interface-english-is-the-code.md));
 * the label is the only value in this schema a person reads directly.
 *
 * **Seeded by an idempotent migration** rather than by application code, so the
 * list seam 2 tests against and the list production serves are the same file.
 * `INSERT … ON CONFLICT (slug) DO NOTHING` is what makes running it twice a
 * no-op.
 *
 * **`BIGINT GENERATED ALWAYS AS IDENTITY`**, for `rate_counter`'s reason: DD2
 * reserves a UUIDv7 for ids that reach a URL or a browser, and this one reaches
 * neither — the public handle is the slug. Reading it as a `BigInt` also makes
 * `JSON.stringify` throw on it, so a key never meant to cross a boundary cannot
 * be serialised into one by accident.
 *
 * **Growth is by Admin promotion, and `active` is why there is no delete.** A
 * Skill a profile already holds cannot be removed without rewriting what a Worker
 * said about herself, so retiring one is a flag rather than a `DELETE` — and the
 * `CHECK`-free boolean is the whole mechanism.
 */
export const skill = pgTable(
  "skill",
  {
    id: bigint("id", { mode: "bigint" }).generatedAlwaysAsIdentity().primaryKey(),

    /**
     * The natural key, and the value a browse filter puts in a query parameter.
     * English, kebab-case, stable for the life of the entry — a slug that changes
     * breaks every link a Hirer saved.
     */
    slug: text("slug").notNull(),

    /**
     * What she reads. `es-CO`, a verb phrase or a capability noun so that it needs
     * no slash form, and short enough to be a label — `docs/policy/voice.md` sets
     * both rules and the test: read it aloud after *"Sé…"*, and if it does not
     * finish the sentence the way a person would say it, it is still CUOC.
     */
    labelEs: text("label_es").notNull(),

    /**
     * The five-digit CUOC *Ocupación* code this entry was translated from —
     * provenance, never displayed. Two entries may share one code where the
     * granularity a Hirer searches at is finer than CUOC's: cutting hair and
     * barbering are both `51410`, and a Hirer looking for one is not looking for
     * the other.
     *
     * **Nullable since the vocabulary gained its second source.** Every seeded
     * entry was translated from CUOC and carries its code; an entry an Admin
     * promoted from a {@link skillRequest} was translated from a sentence a
     * Worker typed, and may correspond to no CUOC *Ocupación* at all — that is
     * the whole reason she had to ask. `NULL` is that fact, stated: this column
     * says where an entry came from, and inventing a code to keep it `NOT NULL`
     * would make it say something false about half the list.
     */
    cuocCode: text("cuoc_code"),

    /**
     * Whether the entry may still be chosen. Retiring a Skill flips this; nothing
     * deletes a row a CapabilityProfile may already point at.
     */
    active: boolean("active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /**
     * The constraint **is** the lookup: every read of this table other than the
     * full list is by slug, and a second row under one slug is a collision the
     * engine must refuse rather than a duplicate a query has to resolve. It is
     * also what `ON CONFLICT (slug) DO NOTHING` conflicts against, which is how
     * the seed migration is idempotent at all.
     */
    unique("skill_slug_key").on(table.slug),

    /**
     * The picker and the browse filter both read the active list in label order,
     * and both read it on a page a person is waiting on. Partial, because the
     * retired entries are never in that answer.
     */
    index("skill_active_label_es_idx")
      .on(table.labelEs)
      .where(sql`${table.active}`),
  ],
);

/**
 * **`CapabilityProfile`** — a Worker's public page, 1:1 with an Account, and
 * the table this whole effort exists to fill.
 *
 * **`BIGINT GENERATED ALWAYS AS IDENTITY`**, per DD2: its public handle is the
 * opaque {@link capabilityProfile.slug}, so the primary key never crosses a
 * boundary and has no reason to be wide. **One profile per Account, by unique
 * constraint rather than by the form** — that constraint is half of NFR26's
 * Sybil answer, and it is also DD2's index on the foreign key column.
 *
 * **The columns are classified, and the classification is the design** (Core
 * entities, ADR-0009). `firstName`, `lastInitial`, `city`, `headline` and an
 * approved photo are `public`; `fullName`, `about`, `phone` and the Account's
 * `email` are `personal`. `fullName` is collected here and released only at
 * Contact Exchange (C1), which is why it sits in this table beside the public
 * fields and reaches neither `PublicProfile` nor `GatedProfile` — the
 * projection, not the table, is where the split is enforced.
 *
 * **There is no column for what she lost, and there will not be one**
 * (ADR-0009).
 *
 * Enum-shaped columns are `TEXT` + `CHECK` built from the registries in
 * `#policy/cities` and `#projections`, per DD2. `deleted` is not a state:
 * moderation takedown and the data subject's own deletion never share a
 * mechanism (DD8).
 */
export const capabilityProfile = pgTable(
  "capability_profile",
  {
    id: bigint("id", { mode: "bigint" }).generatedAlwaysAsIdentity().primaryKey(),

    /** The Account that holds it. Cascade, because story 13's deletion reaches everything. */
    accountId: text("account_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    /**
     * The public handle (NFR9): server-generated, opaque, derived from no part
     * of her name, city or Skills, and stable across edits. Minted by
     * `#profiles/slug` from random bytes and nothing else.
     */
    slug: text("slug").notNull(),

    /** `personal`. Collected at publish, crosses only at Contact Exchange (C1). */
    fullName: text("full_name").notNull(),

    /** `public`. What a card shows. */
    firstName: text("first_name").notNull(),

    /** `public`. One letter. */
    lastInitial: text("last_initial").notNull(),

    /** `public`. One of the three municipalities, by identifier. */
    city: text("city").notNull(),

    /** `public`. The one line in her own words. Passed the rejector (DD3). */
    headline: text("headline").notNull(),

    /** `personal`, gated. The longer self-description. Empty when she wrote none. */
    about: text("about").notNull().default(""),

    /** `personal`. E.164, normalised by `#policy/phone`. */
    phone: text("phone").notNull(),

    /** Where the photo is in its life (DD6). `absent` until she attaches one. */
    photoState: text("photo_state").notNull().default("absent"),

    /**
     * `personal` always: the public URL is derived only at `approved` (DD6).
     *
     * **One column holding whichever key the current state names** — the
     * quarantine key while `pending`, the public one once approved, and `NULL`
     * at `absent` and `rejected`. A second column for the quarantine key was
     * considered and is not needed: `promoteToPublic` deliberately leaves the
     * quarantined object in place for recovery, and the bucket's own lifecycle
     * rule (runbook §3) is what collects it. A column tracking an object nobody
     * reads and nothing deletes would be a second source of truth about which
     * bytes are current.
     */
    photoKey: text("photo_key"),

    /**
     * When the photo now waiting became this Admin queue's problem — set by
     * `attachPhoto`, cleared when the photo leaves `pending`.
     *
     * **Not `updatedAt`, and not `publishedAt`.** The queue's branch reports
     * age-of-oldest over the whole branch (C55), and both of those move for
     * reasons that have nothing to do with a photo — an edit to her headline
     * would silently reset how long an Admin has been sitting on her picture.
     * It is nullable because only a `pending` row has an answer.
     */
    photoAttachedAt: timestamp("photo_attached_at", { withTimezone: true }),

    state: text("state").notNull().default("published"),

    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),

    /**
     * NFR22's ordering input, kept as a column rather than an inference: `state`
     * moves past `delivered`, so a count over Offer state would drift the moment
     * one is accepted.
     */
    deliveredOfferCount: integer("delivered_offer_count").notNull().default(0),

    /**
     * A daily-rewritten integer (DD2), so the browse sort stays index-ordered
     * and keyset-paginable. Zero until the rotation job first runs.
     */
    rotationKey: integer("rotation_key").notNull().default(0),

    /** DD4: lowercased, accents folded, written at publish and on edit. */
    searchText: text("search_text").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /** One profile per Account, said by the engine. Also the FK index DD2 asks for. */
    unique("capability_profile_account_id_key").on(table.accountId),

    /** The lookup for `/profile/[slug]`. */
    unique("capability_profile_slug_key").on(table.slug),

    /** The Wall: newest published first (DD2). */
    index("capability_profile_wall_idx")
      .on(sql`${table.publishedAt} DESC`, sql`${table.id} DESC`)
      .where(sql`${table.state} = 'published'`),

    /** Browse: fewest delivered Offers first, rotated daily (DD2, NFR22). */
    index("capability_profile_browse_idx")
      .on(table.deliveredOfferCount, table.rotationKey, table.id)
      .where(sql`${table.state} = 'published'`),

    /** Browse + city: the equality column leads (DD2). */
    index("capability_profile_browse_city_idx")
      .on(table.city, table.deliveredOfferCount, table.rotationKey, table.id)
      .where(sql`${table.state} = 'published'`),

    /**
     * Browse + typed words: a `pg_trgm` GIN index over the folded column (DD4).
     *
     * **This is the whole of why `searchText` is a plain column.** `unaccent()`
     * is `STABLE` rather than `IMMUTABLE`, so Postgres refuses an index over it
     * and refuses a generated column over it too; the folklore fix is to
     * redeclare it `IMMUTABLE` by hand, which works and lies — change the
     * dictionary and the index goes on answering from entries it no longer
     * matches. Folding at write time instead leaves an ordinary text column
     * that an ordinary index can serve, and the read compares two strings that
     * were folded by the same function.
     *
     * **`gin_trgm_ops` is what makes `LIKE '%…%'` index-served at all.** A
     * B-tree cannot answer a leading wildcard; the trigram index looks the
     * pattern's three-character runs up directly, which is why the read spells
     * the comparison as `LIKE` rather than as anything that would wrap the
     * column in a function.
     *
     * Partial on the same predicate as the two browse indexes above it: every
     * read that reaches this one is already reading published rows only.
     *
     * `pg_trgm` itself is enabled out of band on all three engines — never in a
     * migration, because a managed provider gates extensions behind its own
     * dashboard. See `#testing/global-setup`.
     */
    index("capability_profile_search_idx")
      .using("gin", table.searchText.op("gin_trgm_ops"))
      .where(sql`${table.state} = 'published'`),

    /**
     * The duplicate-phone signal (C30): **non-unique**, because families and
     * shared households genuinely share one handset. A moderation signal, never
     * a constraint.
     */
    index("capability_profile_phone_idx").on(table.phone),

    /**
     * The photo queue's branch: every profile waiting on a person, oldest
     * first.
     *
     * **Partial, on `pending` alone**, which is the same shape
     * `skill_request_pending_idx` already has and for the same reason — the
     * branch an Admin works is a small fraction of the table, and both figures
     * C55 asks for (the count and the age of the oldest) are computed over the
     * whole branch rather than over a capped display.
     */
    index("capability_profile_photo_pending_idx")
      .on(table.photoAttachedAt, table.id)
      .where(sql`${table.photoState} = 'pending'`),

    check("capability_profile_city_known", inList(table.city, CITY_IDS)),
    check("capability_profile_photo_state_known", inList(table.photoState, PHOTO_STATES)),
    check("capability_profile_state_known", inList(table.state, PROFILE_STATES)),

    /** One letter, upper-cased by the boundary parse. The `CHECK` is the backstop. */
    check("capability_profile_last_initial_one_letter", sql`char_length(${table.lastInitial}) = 1`),
  ],
);

/**
 * **`WorkHistoryEntry`** — 0..n per profile, `personal`, gated, with an explicit
 * `position` and `UNIQUE (capability_profile_id, position)`. "Ordered" with no
 * ordering column means an edit silently reorders her history (Core entities);
 * the constraint is also DD2's index on the foreign key column.
 */
export const workHistoryEntry = pgTable(
  "work_history_entry",
  {
    id: bigint("id", { mode: "bigint" }).generatedAlwaysAsIdentity().primaryKey(),

    capabilityProfileId: bigint("capability_profile_id", { mode: "bigint" })
      .notNull()
      .references(() => capabilityProfile.id, { onDelete: "cascade" }),

    /** Zero-based, in the order she wrote them. */
    position: integer("position").notNull(),

    /** One line, in her words. Passed the rejector (DD3). */
    text: text("text").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("work_history_entry_capability_profile_id_position_key").on(
      table.capabilityProfileId,
      table.position,
    ),
    check("work_history_entry_position_non_negative", sql`${table.position} >= 0`),
  ],
);

/**
 * **`ProfileSkill`** — many-to-many, composite natural PK, indexed **in both
 * directions**: the browse filter reads it the reverse way from the profile
 * render (Core entities, DD2). A pure join table takes no surrogate at all.
 */
export const profileSkill = pgTable(
  "profile_skill",
  {
    capabilityProfileId: bigint("capability_profile_id", { mode: "bigint" })
      .notNull()
      .references(() => capabilityProfile.id, { onDelete: "cascade" }),

    skillId: bigint("skill_id", { mode: "bigint" })
      .notNull()
      .references(() => skill.id),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "profile_skill_pkey",
      columns: [table.capabilityProfileId, table.skillId],
    }),
    /** Browse + skill: the reverse of the natural PK (DD2). */
    index("profile_skill_skill_id_idx").on(table.skillId, table.capabilityProfileId),
  ],
);

/**
 * **`SkillRequest`** — what a Worker asked for when the closed list did not hold
 * her trade, and the queue item that resolves it.
 *
 * **A closed vocabulary needs a way in, or it is a way of excluding people.**
 * ADR-0008 publishes that this platform verifies nobody; a list that silently
 * left out the woman who repairs sewing machines would be verifying her out of
 * the product by omission. So the request is a row, it enters the Admin queue as
 * its own source, and promotion turns it into vocabulary.
 *
 * **`BIGINT GENERATED ALWAYS AS IDENTITY`**, not a UUIDv7, and the exception DD2
 * grants `Offer.id` does not reach here. That exception is argued from two
 * harms — a sequential key *"publishes the platform's total Offer count to every
 * Hirer"* and *"hands an enumerator a clean `/offers/1..N` sweep"*. This id
 * reaches no URL, and the only browser it reaches is an Admin's, who is already
 * being shown this branch's total on the same screen. There is no third party to
 * publish a count to, and nothing to enumerate behind NFR14's 403.
 *
 * **The text is hers, and it has passed the rejector.** `#skills` runs
 * `rejectContactDetails` before the insert (NFR12, DD3), so a request carrying a
 * phone number never becomes a row — which matters more here than on the fields
 * beside it, because this one is read by an Admin rather than published, and a
 * field nobody publishes is the field where a rejector is easiest to forget.
 *
 * **`resolvedAt` is a column rather than an inference**, for the reason
 * `deliveredAt` is one on `Offer`: a queue's health is measured on how long its
 * items waited, and a `state` that has moved cannot say when it moved.
 */
export const skillRequest = pgTable(
  "skill_request",
  {
    id: bigint("id", { mode: "bigint" }).generatedAlwaysAsIdentity().primaryKey(),

    /**
     * Who asked. Cascade, because story 13's deletion reaches everything she
     * wrote — and what she typed here is hers even though only an Admin reads it.
     */
    accountId: text("account_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    /** The capability in her own words. Passed the rejector (DD3, NFR12). */
    text: text("text").notNull(),

    state: text("state").notNull().default("pending"),

    /** When an Admin resolved it. `NULL` for as long as it is waiting. */
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /**
     * DD2's index on the foreign key column: without it NFR17's leaf-first purge
     * is a sequential scan of this table per Account deleted.
     */
    index("skill_request_account_id_idx").on(table.accountId),

    /**
     * **Partial, on the pending predicate**, which is the only predicate anything
     * asks about: the queue reads the oldest few, counts the branch, and takes
     * `MIN(created_at)` over it — three questions the resolved rows are never
     * part of. Partial rather than plain so the index stays the size of the
     * backlog instead of the size of the history, and so the age of the oldest
     * item is an index-only scan for the life of the product rather than one that
     * grows with every request ever made.
     */
    index("skill_request_pending_idx")
      .on(table.createdAt)
      .where(sql`${table.state} = 'pending'`),

    check("skill_request_state_known", inList(table.state, SKILL_REQUEST_STATES)),
  ],
);

/**
 * **`Offer`** — from one Account to one CapabilityProfile, and **immutable after
 * send**. It is the row story 6 exists to write, and the row story 8, story 9
 * and the Admin queue all read.
 *
 * **`id` is a UUIDv7, and it is the one exception DD2 makes.** Every other key in
 * this schema is a `BIGINT IDENTITY` because a UUID is 16 bytes against 8 and
 * widens every index that references it; this table earns the exception because
 * `/offers/[id]` puts the value in a URL. A `BIGINT` there would publish the
 * platform's total Offer count to every Hirer on his first send and hand an
 * enumerator a clean `/offers/1..N` sweep — authorization stops the read, and it
 * does not stop the existence oracle.
 *
 * **The value is minted in the application, never by the engine** (DD2). The id
 * has to exist *before* the insert, because `sendOffer` writes the Offer and then
 * references it in the same transaction; a column default would force a
 * `RETURNING` round trip to learn it. It also removes a version dependency —
 * `uuidv7()` is Postgres 18 only, and PGlite 18.3 and PlanetScale 18.4 agreeing
 * today is an alignment being relied on rather than a guarantee.
 *
 * **Immutability is the product, and no constraint here can enforce it.** There
 * is no `updated_at`, no revision column, and no function in `#offers` that
 * writes a text field twice — but a `CHECK` cannot see a previous row, so the
 * guarantee is that no such path exists, and `offers.integration.test.ts` is
 * where that is asserted rather than implied.
 *
 * **One instant, not two.** DD2's index sketch names a `sent_at` column and this
 * table carries `created_at` instead, because for a row nothing ever updates the
 * two are the same moment — and two columns holding one instant can only diverge
 * by a bug. The projection publishes it as `sentAt`, which is the vocabulary a
 * person reads; `skill_request` already does exactly this with `requestedAt`.
 * `delivered_at` is a second instant and a genuinely second fact: `NULL` until a
 * human has read the Offer, which is NFR7's queue metric and NFR22's window, and
 * a column rather than an inference because `state` moves past `delivered` the
 * moment she answers.
 *
 * **The three free-text fields have passed the rejector** (NFR12, DD3) and the
 * boundary parse's length bounds. They are `personal`: they are what one person
 * wrote to another, and only she, he, and the Admin who reviews it read them.
 *
 * **His name and phone are not here.** They are collected once, on his first
 * Offer, and stored on the Account (C4) — a copy per Offer would be a second
 * place for a correction to fail to reach, and a self-asserted identity is a
 * property of the sender rather than of the message.
 */
export const offer = pgTable(
  "offer",
  {
    /** DD2's one UUIDv7, from `uuid`'s `v7()` in the application. See above. */
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => v7()),

    /** Who it is for. Cascade: deleting her Account reaches everything about her. */
    capabilityProfileId: bigint("capability_profile_id", { mode: "bigint" })
      .notNull()
      .references(() => capabilityProfile.id, { onDelete: "cascade" }),

    /** Who sent it. Cascade, for the same reason from the other side. */
    hirerAccountId: text("hirer_account_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    /** `personal`. What he is asking for. Passed the rejector (DD3, NFR12). */
    workDescription: text("work_description").notNull(),

    /** `personal`. What he is offering to pay. Passed the rejector. */
    payTerms: text("pay_terms").notNull(),

    /** `personal`. When he needs it. Passed the rejector. */
    whenText: text("when_text").notNull(),

    state: text("state").notNull().default(INITIAL_OFFER_STATE),

    /**
     * When a person read it and let it through. `NULL` for as long as it is
     * waiting, which is what the queue's depth, its age-of-oldest and
     * `SentOffer.reviewDelayed` are all computed over.
     */
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /** The Offers she has received, newest first (DD2). Also the FK index on her side. */
    index("offer_capability_profile_id_created_at_idx").on(
      table.capabilityProfileId,
      sql`${table.createdAt} DESC`,
    ),

    /** `/sent-offers`, newest first (DD2). Also the FK index on his side. */
    index("offer_hirer_account_id_created_at_idx").on(
      table.hirerAccountId,
      sql`${table.createdAt} DESC`,
    ),

    /**
     * **The first of DD2's five partial queue indexes**, and the one with a
     * deadline attached: NFR7 bounds the age of the oldest undelivered Offer at
     * 24 hours, and the queue asks three questions of this predicate on every
     * Admin render — the oldest few rows, `COUNT(*)` over the branch, and
     * `MIN(created_at)` over it.
     *
     * Partial rather than plain, so the index stays the size of the backlog
     * instead of the size of the history. Without it, story 7's age-of-oldest is
     * a sequential scan that grows with total Offers forever while the pending
     * set stays near zero — the instrument getting slower exactly as the product
     * succeeds.
     *
     * **The predicate is both undelivered states**, not `pending_review` alone.
     * An Offer held because its sender is frozen (C22) is still work a human owes
     * an answer on, and leaving it out would let a Report quietly shrink the
     * number the operator is measured by.
     */
    index("offer_pending_idx")
      .on(table.createdAt)
      .where(sql`${table.state} IN ('pending_review', 'on_hold')`),

    check("offer_state_known", inList(table.state, OFFER_STATES)),

    /**
     * A backstop that must never fire, in the shape DD2 fixes: the boundary parse
     * is where an empty field becomes a `fieldError`, and a `CHECK` firing is a
     * 500. It is here because these three fields are the whole of what she reads
     * — an Offer naming no work, no pay and no when is not an Offer, and a row
     * that reached this table without them would be one nobody could answer.
     */
    check(
      "offer_terms_present",
      sql`char_length(btrim(${table.workDescription})) > 0
        AND char_length(btrim(${table.payTerms})) > 0
        AND char_length(btrim(${table.whenText})) > 0`,
    ),

    /*
      **A Worker may not be sent an Offer by her own Account** (DD9). Nothing in
      the draft refused it, and it inflates `delivered_offer_count`, which is
      NFR22's ordering input — so the fairness mechanism would be defeatable by
      the person it protects, in one request.

      There is no constraint here because a `CHECK` cannot reach the other table
      to compare her Account id. It is enforced in `#offers`, where both rows are
      in hand, and named here so the absence reads as a decision rather than as
      an omission.
    */
  ],
);

/**
 * **`Block`** — a Worker → Hirer edge. Permanent, no reason, and **keyed from the
 * Offer** rather than from a Hirer account id a browser supplied.
 *
 * **What it reaches is bounded, stated, and narrower than the draft had it**
 * (C3): *he cannot send her anything, and that is all*. It does not remove her
 * from the public Wall — the Wall is public and cannot be selectively invisible —
 * and it does not close his gated read of her profile. Her phone and email are
 * untouched, because those cross only at Contact Exchange, which he can no longer
 * reach. One rule, explainable to a Worker in one sentence.
 *
 * **The table arrives with the read rather than with the write.** `sendOffer` has
 * to consult this edge under its row lock (NFR15, DD9), and story 10 is where
 * `blockFromOffer` puts a row in it — the same expand shape
 * `user.offer_sending_state` had, which existed for a slice before the actions
 * that write it. A read against an empty table answers correctly.
 *
 * **A pure edge, so a composite natural primary key and no surrogate** — the
 * shape `profile_skill` already takes, and DD2's `UNIQUE (worker_profile_id,
 * hirer_account_id)` said by the engine rather than beside it. The uniqueness is
 * not decoration: blocking twice is the same fact, and a second row would make
 * "is he Blocked" a count rather than an existence check.
 */
export const block = pgTable(
  "block",
  {
    /** Whose Block it is. Cascade: her deletion reaches everything she decided. */
    workerProfileId: bigint("worker_profile_id", { mode: "bigint" })
      .notNull()
      .references(() => capabilityProfile.id, { onDelete: "cascade" }),

    /** Who is Blocked. Cascade, so a deleted Account leaves no dangling edge. */
    hirerAccountId: text("hirer_account_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /**
     * The natural key, and the index `sendOffer` reads on every send: both
     * columns are equalities, so one lookup answers it.
     */
    primaryKey({
      name: "block_worker_profile_id_hirer_account_id_pk",
      columns: [table.workerProfileId, table.hirerAccountId],
    }),

    /**
     * DD2's index on the *other* foreign key column. The primary key leads with
     * her profile, so nothing serves a read keyed on his Account — which is what
     * NFR17's leaf-first purge does when an Account is deleted.
     */
    index("block_hirer_account_id_idx").on(table.hirerAccountId),
  ],
);

/**
 * **`PhotoUpload`** — which Account a quarantine key was minted for, and the
 * only thing that makes attaching a photo an authorized act.
 *
 * **It exists because a shape check is not an authorization check.** The first
 * version of the photo path validated that an attached key *looked like* one
 * this repository mints and stopped there — so any account could attach any
 * key, and `/security-review` traced a full exploit: read an approved photo's
 * public URL off the Wall, derive the quarantine key it was named from, and
 * publish a profile pointing at somebody else's face. The derivation is closed
 * separately (`mintPublicKey`), but unguessability is not authorization, and a
 * key that leaks any other way must not be attachable either. This table is the
 * check that does not depend on a secret staying secret.
 *
 * **One row per Account, replaced on each mint.** She picks a photo, dislikes
 * it, picks another; only the last one she uploaded may be attached. The
 * primary key is the Account, so a second `createPhotoUpload` overwrites rather
 * than accumulating, and `attachPhoto` deletes the row it consumes — a key is
 * good for exactly one attach.
 *
 * **It is deliberately not an audit trail**, which is why the row is deleted
 * rather than kept: the enduring record of which object a profile holds is
 * `capability_profile.photo_key`, and NFR33's audit is `admin_action`. What
 * this holds is a short-lived intent, and it holds nothing about the picture.
 */
export const photoUpload = pgTable("photo_upload", {
  /**
   * The Account, as the primary key. There is at most one photo in flight per
   * person by construction rather than by a rule anybody has to enforce.
   *
   * `ON DELETE cascade`, so an erasure request takes these with it (NFR17) —
   * and so the leaf-first purge has one fewer table to remember.
   */
  accountId: text("account_id")
    .notNull()
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),

  /** The key `presignUpload` minted. Opaque, server-generated, and about no one. */
  photoKey: text("photo_key").notNull(),

  /**
   * When it was minted, so a row nobody attached can be swept.
   *
   * The presigned PUT it belongs to lives five minutes; the row is kept longer
   * than that because she may fill in the rest of the form before submitting,
   * and the attach happens at publish rather than at upload.
   */
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
