/**
 * The pin that stands in for `auth generate`. The full argument — why the
 * schema is hand-written, why the generator cannot express DD2's types, and how
 * DD5's three rules survive as red CI instead of discipline — is the header of
 * `auth-schema.ts`; this file is its enforcement. The oracle is `getSchema()`
 * from the installed `better-auth/db`, and the assertions pin fields,
 * nullability in both directions, uniqueness, every declared index, and the
 * deliberate deviations as data, so a deviation nobody declared fails rather
 * than drifting.
 */

import { getSchema } from "better-auth/db";
import { getTableColumns } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { getTableConfig } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import { authOptions } from "#auth/config";
import type { DomainDatabase } from "#database";
import * as schema from "#schema";

/**
 * A real Drizzle handle that never runs a query.
 *
 * `pg.Pool` opens nothing until the first statement, and `getSchema()` reads the
 * options rather than the database — so this is a genuine handle rather than a
 * mock, and the test still needs no `DATABASE_URL` and no running Postgres,
 * which is what lets it sit at seam 1 beside the pure ones.
 */
function connectionlessDatabase(): DomainDatabase {
  return drizzle(new Pool({ connectionString: "postgres://unused:unused@127.0.0.1:1/unused" }), {
    schema,
  });
}

const options = authOptions({
  db: connectionlessDatabase(),
  sendMagicLink: async () => {},
  logger: { info: () => {}, warn: () => {} },
  env: {
    BETTER_AUTH_SECRET: "a-secret-long-enough-for-the-configuration-to-build",
    BETTER_AUTH_URL: "https://recomencemos.test",
    // Both halves, so the Google door is configured and its tables are in scope.
    GOOGLE_CLIENT_ID: "client-id",
    GOOGLE_CLIENT_SECRET: "client-secret",
  },
});

const betterAuthSchema = getSchema(options);

/** Better Auth's model name → the Drizzle table this package exports for it. */
const TABLES = {
  user: schema.user,
  session: schema.session,
  account: schema.account,
  verification: schema.verification,
  rateLimit: schema.rateLimit,
} as const;

type Model = keyof typeof TABLES;

const MODELS = Object.keys(TABLES) as Model[];

/**
 * Where these tables are deliberately **stricter** than what Better Auth
 * declares.
 *
 * Listed as data rather than described in prose, because a check below reads
 * this set: an entry here is a deviation somebody chose, and a deviation that is
 * not here fails the run. The member has a column default and a writer that
 * always supplies a value, so the extra `NOT NULL` cannot be reached by any path
 * the library takes.
 *
 * - `verification.sharedDevice` — NFR13's answer.
 *   `databaseHooks.verification.create.before` writes a boolean on every row and
 *   the column defaults to `false`, so "absent" and "false" are the same state;
 *   the nullable third state the vendor allows would only ever mean "a bug wrote
 *   nothing".
 */
const STRICTER_NOT_NULL = new Set<string>(["verification.sharedDevice"]);

/**
 * `getSchema` reports the fields Better Auth writes; `id` is implicit in its
 * model and explicit in every table here.
 */
function drizzleFieldNames(table: (typeof TABLES)[Model]): string[] {
  return Object.keys(getTableColumns(table)).toSorted();
}

function betterAuthFieldNames(model: string): string[] {
  const definition = betterAuthSchema[model];
  if (!definition) throw new Error(`Better Auth reports no model named "${model}"`);
  return ["id", ...Object.keys(definition.fields)].toSorted();
}

/**
 * The column a Better Auth field name maps to.
 *
 * The adapter indexes the table object by **field** name, so this is the same
 * lookup it performs — which is why a missing entry here is the adapter
 * failing at runtime rather than a naming quibble.
 */
function columnFor(model: Model, field: string) {
  const columns = getTableColumns(TABLES[model]) as Record<
    string,
    | {
        name: string;
        notNull: boolean;
        hasDefault: boolean;
        isUnique?: boolean;
        getSQLType(): string;
      }
    | undefined
  >;
  return columns[field];
}

describe("the Drizzle tables match the installed Better Auth's schema", () => {
  // A plugin whose tables nobody created shows up here first.
  it("creates a table for every model Better Auth expects, and no others", () => {
    expect(Object.keys(betterAuthSchema).toSorted()).toEqual(MODELS.toSorted());
  });

  it.each(MODELS)("has exactly %s's fields", (model) => {
    expect(drizzleFieldNames(TABLES[model])).toEqual(betterAuthFieldNames(model));
  });

  /**
   * **Both directions**, which is the half a field-name comparison cannot cover.
   *
   * A field Better Auth calls required must not be nullable here, or the adapter
   * writes a value the column rejects. A field it calls optional must not be
   * `NOT NULL` here either, or the adapter writes `null` into a column that
   * refuses it — a runtime constraint violation on a path no test exercises,
   * which is the more dangerous of the two because it only fires for the user
   * who takes the unusual branch.
   *
   * `created_at` and its kind are why the first check reads
   * `!attribute.defaultValue`, and why the second skips a column that has one:
   * a default makes `NOT NULL` unreachable by the adapter, so it cannot produce
   * the constraint violation this case is about. That is a statement about
   * *safety*, not about whether it is a deviation — the next test counts it as
   * one either way, because it is still a state the vendor allows and this
   * schema does not.
   */
  it.each(MODELS)("agrees with %s on which fields may be null", (model) => {
    const fields = betterAuthSchema[model]?.fields ?? {};

    for (const [name, attribute] of Object.entries(fields)) {
      const column = columnFor(model, name);
      expect(column, `${model}.${name} has no column`).toBeDefined();

      if (attribute.required && !attribute.defaultValue) {
        expect(column?.notNull, `${model}.${name} should be NOT NULL`).toBe(true);
        continue;
      }

      if (attribute.required || column?.hasDefault) continue;

      expect(
        column?.notNull,
        `${model}.${name} is optional in Better Auth but NOT NULL here with no default, so the ` +
          "adapter writing null is a constraint violation. Give the column a default — that is " +
          "the only thing that closes this, since an entry in STRICTER_NOT_NULL records a " +
          "deviation without making the write safe.",
      ).toBe(false);
    }
  });

  /**
   * The deviations, held to the list. An entry that stops being stricter is as
   * much a finding as an undeclared one — it means the list has started
   * describing something that is no longer true.
   *
   * **Every** `NOT NULL` where the vendor calls the field optional counts here,
   * whether or not the column has a default. The default decides whether the
   * strictness is *safe*, which is the previous test's question; it does not
   * decide whether it is a deviation. So a later DD2-conforming column of that
   * shape earns a line in `STRICTER_NOT_NULL` saying which writer fills it,
   * which is the sentence worth having.
   */
  it("is stricter than Better Auth in exactly the declared places", () => {
    const stricter: string[] = [];

    for (const model of MODELS) {
      for (const [name, attribute] of Object.entries(betterAuthSchema[model]?.fields ?? {})) {
        if (!attribute.required && columnFor(model, name)?.notNull)
          stricter.push(`${model}.${name}`);
      }
    }

    expect(stricter.toSorted()).toEqual([...STRICTER_NOT_NULL].toSorted());
  });

  it.each(MODELS)("carries every uniqueness Better Auth declares on %s", (model) => {
    const { uniqueConstraints } = getTableConfig(TABLES[model]);

    for (const [name, attribute] of Object.entries(betterAuthSchema[model]?.fields ?? {})) {
      if (!attribute.unique) continue;

      const column = columnFor(model, name);
      const onTheColumn = column?.isUnique === true;
      const onTheTable = uniqueConstraints.some(
        (constraint) =>
          constraint.columns.length === 1 && constraint.columns[0]?.name === column?.name,
      );

      expect(onTheColumn || onTheTable, `${model}.${name} is unique in Better Auth, not here`).toBe(
        true,
      );
    }
  });

  /**
   * The indexes the library declares. `account`'s identity constraint on
   * (`issuer`, `account_id`) is the one that exists today, and it is what keeps
   * one provider identity to one row — so its absence would not be a
   * performance regression but a duplicate-account bug.
   *
   * Matched on columns and uniqueness rather than on name: Better Auth names it
   * `account_issuer_accountId_uidx`, this repository names its constraints in
   * `snake_case`, and the name is the half nothing depends on. A `UNIQUE`
   * constraint satisfies a declared unique index — Postgres implements the one
   * with the other.
   */
  it.each(MODELS)("carries every index Better Auth declares on %s", (model) => {
    const declared = betterAuthSchema[model]?.indexes ?? [];
    const { indexes, uniqueConstraints } = getTableConfig(TABLES[model]);

    for (const index of declared) {
      const columns = index.columns.map((field) => columnFor(model, field)?.name);

      const asIndex = indexes.some(
        (candidate) =>
          candidate.config.unique === index.unique &&
          candidate.config.columns.length === columns.length &&
          candidate.config.columns.every(
            (column, at) => (column as { name?: string }).name === columns[at],
          ),
      );

      const asConstraint =
        index.unique &&
        uniqueConstraints.some(
          (constraint) =>
            constraint.columns.length === columns.length &&
            constraint.columns.every((column, at) => column.name === columns[at]),
        );

      expect(
        asIndex || asConstraint,
        `${model} is missing Better Auth's ${index.unique ? "unique " : ""}index on ` +
          `(${columns.join(", ")})`,
      ).toBe(true);
    }
  });
});

/**
 * The requirements that are the reason this file is written by hand, asserted
 * over every table rather than over the two columns that prompted them — so a
 * table added later cannot quietly take the generator's shape.
 */
describe("the places DD2 requires more than the pg generator can emit", () => {
  it.each(MODELS)("stores every instant on %s as timestamptz", (model) => {
    const naive: string[] = [];

    for (const [name, attribute] of Object.entries(betterAuthSchema[model]?.fields ?? {})) {
      if (attribute.type !== "date") continue;

      const column = columnFor(model, name);
      if (column?.getSQLType() !== "timestamp with time zone") naive.push(column?.name ?? name);
    }

    // A `TIMESTAMP` without a zone is read back in whatever the session's
    // timezone happens to be. For a session that expires and a link that must
    // not outlive its window, that is an off-by-hours bug that never throws.
    expect(naive, `${model} has instants stored without a timezone`).toEqual([]);
  });

  it("stores the email as citext, so one person cannot hold two Accounts", () => {
    // `citext` is what makes the unique index case-insensitive, which is the
    // whole mechanism — see `#column-types`.
    expect(getTableColumns(schema.user).email.getSQLType()).toBe("citext");
  });
});

describe("the two additional fields DD5 declares", () => {
  // Never a hand-added column: a hand-added column on a vendor table is
  // invisible to the schema generator, and this is the assertion that says the
  // declaration and the column are the same thing.
  it("declares sharedDevice on the verification model", () => {
    expect(betterAuthSchema.verification?.fields.sharedDevice).toMatchObject({ type: "boolean" });
    expect(getTableColumns(schema.verification).sharedDevice.name).toBe("shared_device");
  });

  it("declares signInAttemptId on the verification model", () => {
    expect(betterAuthSchema.verification?.fields.signInAttemptId).toMatchObject({ type: "string" });
    expect(getTableColumns(schema.verification).signInAttemptId.name).toBe("sign_in_attempt_id");
  });

  // NFR14: Admin authentication is a property of the session, and this is the
  // column `requireAdmin` will read instead of `twoFactorEnabled`.
  it("declares signInMethod on the session model", () => {
    expect(betterAuthSchema.session?.fields.signInMethod).toMatchObject({ type: "string" });
    expect(getTableColumns(schema.session).signInMethod.notNull).toBe(true);
  });

  /**
   * DD2's rule for an enum-shaped column, and the third thing the generator
   * cannot emit — it has no concept of a `CHECK`. Adding a passwordless door
   * means adding a member here, which is the constraint change NFR14's rule is
   * written over.
   */
  it("constrains sign_in_method to the doors that exist", () => {
    const checks = getTableConfig(schema.session).checks.map((check) => check.name);
    expect(checks).toContain("session_sign_in_method_known");
  });
});

describe("the configuration DD5 says is not the default", () => {
  it("keeps the session cookie cache off, so revocation does not lag", () => {
    expect(options.session?.cookieCache?.enabled).toBe(false);
  });

  /**
   * NFR13's shared-device promise rests on this one flag. Better Auth measures a
   * session's age as `expiresAt - expiresIn + updateAge <= now`, and the create
   * hook deliberately writes an `expiresAt` shorter than `expiresIn` — so with
   * refresh on, the *first* `/get-session` promotes an 8-hour shared-device
   * session to 30 rolling days and re-persists its cookie. See `#auth/config`.
   *
   * `session-lifetime.database.test.ts` proves the behaviour end to end; this
   * asserts the mechanism, so the reason survives next to the other DD5 rows.
   */
  it("refuses Better Auth's session refresh, which would extend a shared device", () => {
    expect(options.session?.disableSessionRefresh).toBe(true);
    // Gone with it: its only reader outside the cookie-cache path is the
    // expression above, and leaving it would imply a rolling session there is
    // not one.
    expect(options.session?.updateAge).toBeUndefined();
  });

  it("puts Better Auth's own limiter in the database, not in memory", () => {
    expect(options.rateLimit?.storage).toBe("database");
    expect(options.rateLimit?.enabled).toBe(true);
  });

  it("sets the magic-link paths' rules explicitly rather than inheriting 3-per-10s", () => {
    expect(options.rateLimit?.customRules?.["/sign-in/magic-link"]).toBeDefined();
    expect(options.rateLimit?.customRules?.["/magic-link/verify"]).toBeDefined();
  });

  // `fly-client-ip` first: 1.7.1 refuses a multi-entry forwarded header, and
  // Fly appends to a caller-sent `x-forwarded-for` — so that header alone
  // collapses to a shared bucket exactly when a caller wants it to. The
  // argument is at the option in `#auth/config`.
  it("reads the client IP from the single-value header Fly's proxy sets", () => {
    expect(options.advanced?.ipAddress?.ipAddressHeaders).toEqual([
      "fly-client-ip",
      "x-forwarded-for",
    ]);
  });

  // Naming Google here is what would let a Google identity link into an
  // unverified local row — the account-takeover primitive DD5 names.
  it("trusts no provider for implicit linking", () => {
    expect(options.account?.accountLinking?.enabled).toBe(true);
    expect(options.account?.accountLinking?.trustedProviders).toEqual([]);
  });

  it("forces Google's account chooser, for the borrowed-Android hazard", () => {
    const google = options.socialProviders?.google;
    // Better Auth types a provider as the options object *or* a function
    // returning one. The config builds a literal; a function-valued provider
    // would defer `prompt` to call time and put it out of this test's reach,
    // so the narrowing is the assertion rather than a cast around it.
    if (typeof google === "function") {
      throw new TypeError("the Google provider is configured as a function, not a literal");
    }
    expect(google?.prompt).toBe("select_account");
  });

  it("stores the magic-link token hashed rather than in the clear", () => {
    expect(options.plugins[0].options.storeToken).toMatchObject({ type: "custom-hasher" });
  });

  it("gives the magic link a fifteen-minute life", () => {
    expect(options.plugins[0].options.expiresIn).toBe(15 * 60);
  });
});
