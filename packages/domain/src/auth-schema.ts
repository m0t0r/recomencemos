/**
 * Better Auth's four tables plus its rate-limit table, as Drizzle.
 *
 * **Read this before editing, because DD5 says these are generated and they are
 * not.** DD5's three rules assume `auth generate` derives this file from the
 * auth config.
 *
 * **A version-matched generator does exist.** The CLI ships as the `auth`
 * package — `@better-auth/cli` is its former name and stopped at `1.4.21` — and
 * `auth@1.7.1` depends on `better-auth@1.7.1` exactly, the version this package
 * pins, so pnpm resolves both to one directory in the store. It was run against
 * this configuration and it emits these five tables with these column names.
 * Availability is not the reason this file is hand-written.
 *
 * **The reason is that its pg type map cannot express what DD2 requires.** Every
 * `date` field becomes `timestamp('…')` and every `string` field becomes
 * `text('…')`, both hardcoded with no option — while DD2 requires `TIMESTAMPTZ`
 * for every instant and `citext` for the email, the type that stops one person
 * holding two Accounts by capitalising. The generator also has no concept of a
 * `CHECK`, which is DD2's rule for an enum-shaped column and what
 * `session.sign_in_method` needs. Generated output would therefore have to be
 * hand-edited on every regeneration — which is exactly what DD5's "never
 * hand-edit the generated schema" rule exists to prevent.
 *
 * **So the mechanism is inverted rather than dropped, and it is stronger.** The
 * tables are written by hand here, and `auth-schema.test.ts` pins them to
 * `getSchema()` from the **installed** `better-auth/db` — the same core the
 * generator reads — on fields, on nullability in both directions, on uniqueness,
 * on every index the library declares, and on the places this repository is
 * deliberately stricter. DD5's three rules survive intact and get sharper:
 *
 * 1. A hand-added column is caught, because it is not in `getSchema()`'s answer.
 * 2. Adding a plugin without adding its tables is caught, because its tables
 *    appear in `getSchema()`'s answer and not here. (This is DD5's "the common
 *    Better Auth mistake" — and under generation it is caught only if someone
 *    remembers to re-run the CLI, while here it is red CI.)
 * 3. An upgrade that changes Better Auth's own tables is caught on the version
 *    bump rather than in production, and produces an ordinary Drizzle migration
 *    reviewed under the expand/contract rule like any other (NFR30).
 *
 * **The vocabulary collision is worth naming once.** `CONTEXT.md`'s **Account**
 * is Better Auth's `user` row — one identity keyed by email. Better Auth's
 * `account` table is something else entirely: the link between that identity and
 * an external provider, one row per Google sign-in. Neither name is ours to
 * choose; the model names are Better Auth's and the adapter looks the tables up
 * by them.
 *
 * **Drizzle property names are Better Auth's field names; column names are
 * ours.** The adapter indexes the table object by field name
 * (`schemaModel[getFieldName(...)]`), so `emailVerified` must be the property.
 * The column it maps to is `email_verified`, which is this repository's
 * convention and invisible to Better Auth.
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
import { citext } from "#column-types";

/**
 * The sign-in methods a session can be established by, and the reason the column
 * exists at all.
 *
 * NFR14: Admin authentication is a property of the **session**, not of the
 * principal. Better Auth records 2FA on the user (`twoFactorEnabled`) and its 2FA
 * flow guards only the credential path, so a magic-link session on an Admin
 * account would carry full Admin authority having presented no second factor.
 * `requireAdmin` reads this field rather than `twoFactorEnabled` — and it is
 * written here, on the session row, by a `databaseHooks.session.create.before`
 * hook that cannot be bypassed by a door that forgets to set it.
 *
 * **Both members are passwordless**, which is the whole of story 1. The
 * credential door arrives with the Admin (story 7) and adds a third member here
 * plus a row in the `CHECK` — and NFR14's rule is written over the *class* of
 * passwordless doors rather than over the two that exist today, because adding a
 * third is exactly when this gets forgotten.
 *
 * English enum values under ADR-0012, like every other identifier.
 */
export const SIGN_IN_METHODS = ["magic_link", "google"] as const;

export type SignInMethod = (typeof SIGN_IN_METHODS)[number];

/** Every passwordless door. NFR14's refusal for an Admin is written over this set. */
export const PASSWORDLESS_SIGN_IN_METHODS: readonly SignInMethod[] = SIGN_IN_METHODS;

/**
 * **Account** in `CONTEXT.md`'s vocabulary, `user` in Better Auth's.
 *
 * Not typed at sign-up: it becomes a Worker by holding a CapabilityProfile and a
 * Hirer by having sent an Offer. Nothing here says which, and nothing should.
 */
export const user = pgTable("user", {
  id: text("id").primaryKey(),

  /**
   * Google returns a real name at sign-up and the magic link returns none, so
   * this is `""` for half of the Accounts in this system. That asymmetry is
   * spec concern C1 and is **not** resolved here: `CapabilityProfile.fullName`
   * is what a Contact Exchange discloses, collected at publish (story 2), so
   * both doors produce the same exchange whatever this column holds.
   */
  name: text("name").notNull(),

  /** `citext`, so one person cannot hold two Accounts by capitalising. `personal`. */
  email: citext("email").notNull().unique(),

  /**
   * Load-bearing for account linking, not decoration. A Google sign-in links to
   * an existing Account only on a **verified** email match (DD5); linking on an
   * unverified one is an account-takeover primitive. The magic-link door sets
   * this `true` on creation, because opening a link sent to an address *is* the
   * proof.
   */
  emailVerified: boolean("email_verified").notNull().default(false),

  /** Google's avatar URL. Nothing renders it yet; the profile photo is story 2's. */
  image: text("image"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * **Session**, classified `secret` (C28): `token` never reaches a log line, a
 * Sentry event, or the subject-access export. Handing a *titular* her own session
 * token is a credential disclosure, not habeas data.
 */
export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),

    /**
     * **The half of NFR13 that is actually true.** Own device 30 days, shared
     * device 8 hours — enforced here, on the row, and not only by a
     * non-persistent cookie, because a cybercafé browser may not close for a
     * week. Written by `databaseHooks.session.create.before` from the choice she
     * made at sign-in.
     */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    token: text("token").notNull().unique(),

    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),

    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    /** NFR14's mechanism. See {@link SIGN_IN_METHODS}. */
    signInMethod: text("sign_in_method").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /**
     * DD2: an index on every foreign key column. Postgres does not create one,
     * and `signOutEverywhere` (story 12) plus NFR17's leaf-first purge both read
     * this table *by user*.
     */
    index("session_user_id_idx").on(table.userId),

    /**
     * DD2's rule for an enum-shaped column: `TEXT` with a `CHECK`, so widening
     * the set is a constraint change rather than a type alteration. Unlike
     * `rate_counter.action` this one has members from the first migration,
     * because both doors exist in the slice that creates the table.
     */
    check("session_sign_in_method_known", sql`${table.signInMethod} IN ('magic_link', 'google')`),
  ],
);

/**
 * The link between an Account and an external provider. One row per Google
 * sign-in; the magic-link door creates none.
 *
 * **The token columns exist and stay empty**, and that is deliberate rather than
 * an oversight. Better Auth's schema declares them and the adapter writes through
 * them, so omitting the columns would break the adapter — but this design never
 * acts on Google's API on her behalf, so there is no access token worth keeping
 * and the safest handling of a credential is not to hold one (DD5). A
 * `databaseHooks.account` pair strips them on create and on update; these columns
 * are the shape that discipline is enforced *against*, and
 * `auth-schema.test.ts` is where the emptiness is asserted.
 */
export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),

    /** New in Better Auth 1.7 and part of the identity key below. */
    issuer: text("issuer").notNull(),

    /** The provider's own subject id — Google's `sub`. */
    accountId: text("account_id").notNull(),

    providerId: text("provider_id").notNull(),

    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),

    /**
     * Better Auth's column for a credential account. No door in story 1 writes
     * it; the Admin's password (story 7) is what fills it, for exactly one row.
     */
    password: text("password"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /**
     * Better Auth's own identity constraint, named in this repository's
     * convention rather than in the library's camelCase. The columns and the
     * uniqueness are what the adapter relies on; the name is not.
     */
    unique("account_issuer_account_id_key").on(table.issuer, table.accountId),

    index("account_user_id_idx").on(table.userId),
  ],
);

/**
 * **Verification**, classified `secret` (C28) for the same reason as Session, and
 * the carrier for two things this ticket needs across a round trip a browser may
 * not survive.
 *
 * `identifier` holds the magic-link token **hashed**, never in the clear — see
 * `#auth/config`. Better Auth's default is `"plain"`, which would make a read of
 * this table account takeover for every outstanding link.
 */
export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),

    /** The hashed magic-link token, or an OAuth state value. */
    identifier: text("identifier").notNull(),

    /** Better Auth writes `JSON.stringify({ email, name })` here. `personal`. */
    value: text("value").notNull(),

    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    /**
     * **NFR13's shared-device choice, carried where the round trip cannot lose
     * it.** She ticks the box on `/sign-in`; the session is created minutes later
     * in whatever browser opened the link, which on a phone is frequently a mail
     * app's webview with none of the cookies the first request set. The row is
     * the only carrier that survives that, which is why DD5 puts the choice on
     * the verification record and not on a cookie.
     *
     * Declared through Better Auth's own `additionalFields` mechanism and
     * **never** as a hand-added column — a hand-added column on a vendor table
     * is invisible to the schema generator and the next regeneration drops it,
     * silently reverting every borrowed phone to a 30-day session. Here that
     * declaration is what `auth-schema.test.ts` checks this column against.
     */
    sharedDevice: boolean("shared_device").notNull().default(false),

    /**
     * **NFR27's correlator, and the reason it is not the email address.** The
     * requirement is that ≥ 70% of `requestMagicLink` calls are followed by a
     * completed sign-in within 30 minutes — which needs the request line and the
     * completion line to name the same thing. The address would do it and is
     * `personal`, so NFR18 forbids it on a line. This id is minted per request,
     * means nothing outside these two lines, and is what
     * `magic_link.requested` and `magic_link.consumed` both carry.
     */
    signInAttemptId: text("sign_in_attempt_id"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /**
     * Every read of this table is by identifier — the consume on verify, and the
     * lookup that reads the two fields above *before* the consume deletes the
     * row.
     */
    index("verification_identifier_idx").on(table.identifier),
  ],
);

/**
 * Better Auth's **own** limiter, which is a different thing from `rate_counter`
 * and both are needed.
 *
 * `rate_counter` and `./rate-limit` bound the actions this product defines —
 * `requestMagicLink` as a Server Action, and the seven ceilings that follow.
 * `/api/auth/*` is a **second door** that no Server Action ceiling reaches
 * (NFR26), so Better Auth's limiter guards it, and it is pointed at this table
 * rather than at its default in-memory map: deploys are continuous, so an
 * in-memory limiter resets several times a day, which is the exact defect NFR26
 * already rejects for our own counter.
 *
 * The columns are Better Auth's and the library reads and writes them.
 */
export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),

  /** Better Auth's composite of path and client identity. Unique by construction. */
  key: text("key").notNull().unique(),

  count: integer("count").notNull(),

  /**
   * Milliseconds since the epoch, as Better Auth writes it (`Date.now()`).
   * `BIGINT` and not `INTEGER`: the value passed 2^31 in 2038 — and passed it in
   * *milliseconds* in 1970 — so an `INTEGER` here overflows on the first write.
   */
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});
