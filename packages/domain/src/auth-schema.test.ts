/**
 * The pin that replaces `@better-auth/cli generate`.
 *
 * `auth-schema.ts` explains why generation is not available at the versions this
 * repository runs — `better-auth@1.7.1` against a CLI whose latest release is
 * `1.4.21`, and no `bin` in the library itself. This file is the mechanism that
 * takes its place, and it is stronger than the rule it replaces: DD5's "never
 * hand-edit the generated schema" is a discipline, while this is red CI.
 *
 * It reads `getSchema()` out of the **installed** `better-auth/db` — the same
 * function the CLI calls — and compares it to the Drizzle tables, field by
 * field. Three failures it is here to catch:
 *
 * 1. A column added here that Better Auth does not know about.
 * 2. A plugin added to the config whose tables nobody created — DD5 calls this
 *    "the common Better Auth mistake", and under generation it is caught only if
 *    somebody remembers to re-run the CLI.
 * 3. An upgrade that changes Better Auth's own tables, caught on the version
 *    bump rather than in production.
 */

import { getTableColumns } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { getSchema } from "better-auth/db";
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

/**
 * `getSchema` reports the fields Better Auth writes; `id` is implicit in its
 * model and explicit in every table here.
 */
function drizzleFieldNames(table: (typeof TABLES)[keyof typeof TABLES]): string[] {
  return Object.keys(getTableColumns(table)).toSorted();
}

function betterAuthFieldNames(model: string): string[] {
  const definition = betterAuthSchema[model];
  if (!definition) throw new Error(`Better Auth reports no model named "${model}"`);
  return ["id", ...Object.keys(definition.fields)].toSorted();
}

describe("the Drizzle tables match the installed Better Auth's schema", () => {
  // Failure 2. A plugin whose tables nobody created shows up here first.
  it("creates a table for every model Better Auth expects, and no others", () => {
    expect(Object.keys(betterAuthSchema).toSorted()).toEqual(Object.keys(TABLES).toSorted());
  });

  it.each(Object.keys(TABLES))("has exactly %s's fields", (model) => {
    const table = TABLES[model as keyof typeof TABLES];

    expect(drizzleFieldNames(table)).toEqual(betterAuthFieldNames(model));
  });

  it.each(Object.keys(TABLES))("agrees with %s on which fields may be null", (model) => {
    const table = TABLES[model as keyof typeof TABLES];
    const columns = getTableColumns(table);
    const fields = betterAuthSchema[model]?.fields ?? {};

    for (const [name, attribute] of Object.entries(fields)) {
      const column = columns[name as keyof typeof columns];
      expect(column, `${model}.${name} has no column`).toBeDefined();

      // A field Better Auth calls required must not be nullable here, or the
      // adapter writes a value the column rejects. The reverse — a column that
      // is NOT NULL with a default where Better Auth calls the field optional —
      // is fine and deliberate: `created_at` is DD2's rule for every table.
      if (attribute.required && !attribute.defaultValue) {
        expect(column?.notNull, `${model}.${name} should be NOT NULL`).toBe(true);
      }
    }
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
});

describe("the configuration DD5 says is not the default", () => {
  it("keeps the session cookie cache off, so revocation does not lag", () => {
    expect(options.session?.cookieCache?.enabled).toBe(false);
  });

  it("puts Better Auth's own limiter in the database, not in memory", () => {
    expect(options.rateLimit?.storage).toBe("database");
    expect(options.rateLimit?.enabled).toBe(true);
  });

  it("sets the magic-link paths' rules explicitly rather than inheriting 3-per-10s", () => {
    expect(options.rateLimit?.customRules?.["/sign-in/magic-link"]).toBeDefined();
    expect(options.rateLimit?.customRules?.["/magic-link/verify"]).toBeDefined();
  });

  it("reads the client IP from the header Fly's proxy sets", () => {
    expect(options.advanced?.ipAddress?.ipAddressHeaders).toEqual(["x-forwarded-for"]);
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
