import { type AppError, isAppError } from "@repo/errors/app-error";
import { Client } from "pg";
import {
  CONNECT_TIMEOUT_MS,
  type ConnectionConfig,
  type DatabaseEnv,
  directConfig,
  DIRECT_URL_VARIABLE,
  POOL_MAX,
  POOL_MIN,
  poolConfig,
  POOLED_URL_VARIABLE,
} from "#config";

const PASSWORD = "s3cret-connection-password";
const POOLED = `postgres://user:${PASSWORD}@localhost:6432/db`;
const DIRECT = `postgres://user:${PASSWORD}@localhost:5432/db`;
const BOTH = { [POOLED_URL_VARIABLE]: POOLED, [DIRECT_URL_VARIABLE]: DIRECT };

/** The `AppError` `resolve` throws. Fails the test when it throws nothing, or anything else. */
function thrown(resolve: () => unknown): AppError {
  try {
    resolve();
  } catch (error) {
    if (isAppError(error)) return error;
    throw error;
  }
  throw new Error("expected the connection string to be refused, and it was accepted");
}

describe("the two connections", () => {
  it("are distinguishable: each reads its own variable", () => {
    expect(poolConfig(BOTH).connectionString).toBe(POOLED);
    expect(directConfig(BOTH).connectionString).toBe(DIRECT);
  });

  it("do not fall back to each other when one is absent", () => {
    expect(() => poolConfig({ [DIRECT_URL_VARIABLE]: DIRECT })).toThrow();
    expect(() => directConfig({ [POOLED_URL_VARIABLE]: POOLED })).toThrow();
  });

  // Ten per machine is DD2's cap, and the go-live runbook checks the database's
  // own connection limit sits above it.
  it("caps the pooled connection at ten per machine, opening none until asked", () => {
    expect(poolConfig(BOTH).max).toBe(POOL_MAX);
    expect(POOL_MAX).toBe(10);
    expect(poolConfig(BOTH).min).toBe(POOL_MIN);
    expect(POOL_MIN).toBe(0);
  });

  it("gives the direct connection one client, because migrations are one caller", () => {
    expect(directConfig(BOTH).max).toBe(1);
  });

  it("bounds the wait for a connection on both, so a hung connect surfaces", () => {
    expect(poolConfig(BOTH).connectionTimeoutMillis).toBe(CONNECT_TIMEOUT_MS);
    expect(directConfig(BOTH).connectionTimeoutMillis).toBe(CONNECT_TIMEOUT_MS);
  });
});

describe("a missing connection string", () => {
  it("is an AppError naming the variable to set, not an undefined that fails at connect time", () => {
    expect(thrown(() => poolConfig({})).message).toContain(POOLED_URL_VARIABLE);
  });

  it("treats a blank value as absent, because an empty variable is the commoner mistake", () => {
    expect(() => poolConfig({ [POOLED_URL_VARIABLE]: "   " })).toThrow();
    expect(() => directConfig({ [DIRECT_URL_VARIABLE]: "" })).toThrow();
  });

  it("carries a user-facing string that is not the operator's", () => {
    const failure = thrown(() => poolConfig({}));
    expect(failure.userMessage).not.toBe(failure.message);
    expect(failure.userMessage).not.toContain(POOLED_URL_VARIABLE);
  });
});

// #327. `pg` 8 reads `sslmode=require` as `verify-full` and prints a warning
// that 9 will not: under libpq semantics `require` encrypts without checking
// whose certificate it is. Nothing in CI speaks TLS, so the major bump would go
// green while a production string stopped verifying. The check is the thing
// that makes that bump safe, and it reads `ENVIRONMENT` rather than `NODE_ENV`
// because a local `next start` is not the Fly machine (ADR-0022).
const CONNECTIONS = [
  {
    name: "the pooled connection",
    variable: POOLED_URL_VARIABLE,
    base: POOLED,
    resolve: poolConfig,
  },
  {
    name: "the direct connection",
    variable: DIRECT_URL_VARIABLE,
    base: DIRECT,
    resolve: directConfig,
  },
] satisfies ReadonlyArray<{
  name: string;
  variable: string;
  base: string;
  resolve: (env: DatabaseEnv) => ConnectionConfig;
}>;

/**
 * The SSL options the installed `pg` derives from a configuration, read
 * without connecting. `connectionParameters` is what `Client` builds from its
 * config in the constructor; `@types/pg` does not declare it.
 */
function sslOptionsOf(config: ConnectionConfig): unknown {
  const client = new Client(config) as unknown as { connectionParameters: { ssl: unknown } };
  return client.connectionParameters.ssl;
}

describe.each(CONNECTIONS)("in production, $name", ({ variable, base, resolve }) => {
  const production = (value: string): DatabaseEnv => ({
    ENVIRONMENT: "production",
    [variable]: value,
  });

  it("accepts a string that requires a verified certificate", () => {
    const value = `${base}?sslmode=verify-full`;
    expect(resolve(production(value)).connectionString).toBe(value);
  });

  it.each([
    ["no sslmode at all", base],
    [
      "sslmode=require, which stops verifying the certificate in the next major of pg",
      `${base}?sslmode=require`,
    ],
    ["sslmode=no-verify", `${base}?sslmode=no-verify`],
    ["sslmode=disable", `${base}?sslmode=disable`],
    [
      "sslrootcert=system, which pg opens as a file path",
      `${base}?sslmode=verify-full&sslrootcert=system`,
    ],
    [
      "a repeated sslmode whose last value, the one pg keeps, is weak",
      `${base}?sslmode=verify-full&sslmode=disable`,
    ],
    [
      "a percent-encoded sslmode that pg never decodes, beside a space",
      `${base}?ssl%6Dode=verify-full&x=a b`,
    ],
    [
      "a percent-encoded sslmode that pg never decodes, beside a malformed escape",
      `${base}?ssl%6Dode=verify-full&x=%zz`,
    ],
    [
      "a value that is not a URL, so its form cannot be read",
      `host=localhost password=${PASSWORD} sslmode=verify-full`,
    ],
  ])("refuses %s", (_, value) => {
    expect(thrown(() => resolve(production(value))).code).toBe("database_url_tls_unverified");
  });

  it("names the variable and the form it must take", () => {
    const { message } = thrown(() => resolve(production(`${base}?sslmode=require`)));
    expect(message).toContain(variable);
    expect(message).toContain("sslmode=verify-full");
    expect(message).toContain("sslrootcert=system");
  });

  it("carries the variable and the offending parameter, and nothing else of the string", () => {
    expect(thrown(() => resolve(production(`${base}?sslmode=require`))).context).toEqual({
      variable,
      parameter: "sslmode",
      value: "require",
    });
    expect(thrown(() => resolve(production(base))).context).toEqual({
      variable,
      parameter: "sslmode",
    });
  });

  it("gives the installed pg a configuration that verifies the server's certificate", () => {
    const ssl = sslOptionsOf(resolve(production(`${base}?sslmode=verify-full`)));
    expect(ssl).toBeTypeOf("object");
    expect(ssl).not.toHaveProperty("rejectUnauthorized", false);
  });
});

/** Whether `pg` would check the server's certificate for this string. */
function pgVerifies(connectionString: string): boolean {
  const ssl = sslOptionsOf(directConfig({ [DIRECT_URL_VARIABLE]: connectionString }));
  return (
    typeof ssl === "object" &&
    ssl !== null &&
    !("rejectUnauthorized" in ssl && ssl.rejectUnauthorized === false)
  );
}

/** Whether the production check lets this string through. */
function accepted(connectionString: string): boolean {
  try {
    directConfig({ ENVIRONMENT: "production", [DIRECT_URL_VARIABLE]: connectionString });
    return true;
  } catch {
    return false;
  }
}

// The check exists to answer what the installed `pg` will do with a string, so
// it is held against `pg` itself rather than against a restatement of its
// parser. A `pg` major that parses differently from the parser the check asks
// fails here, not in production.
describe("the production check, against the installed pg", () => {
  it("tells a string pg verifies from one it does not", () => {
    expect(pgVerifies(`${DIRECT}?sslmode=verify-full`)).toBe(true);
    expect(pgVerifies(`${DIRECT}?sslmode=no-verify`)).toBe(false);
    expect(pgVerifies(`${DIRECT}?sslmode=disable`)).toBe(false);
  });

  it.each([
    ["verify-full", `${DIRECT}?sslmode=verify-full`],
    ["verify-full beside a space", `${DIRECT}?sslmode=verify-full&x=a b`],
    ["a percent-encoded key beside a space", `${DIRECT}?ssl%6Dode=verify-full&x=a b`],
    ["a percent-encoded key beside a malformed escape", `${DIRECT}?ssl%6Dode=verify-full&x=%zz`],
    ["a weak sslmode after verify-full", `${DIRECT}?sslmode=verify-full&sslmode=disable`],
    ["verify-full after a weak sslmode", `${DIRECT}?sslmode=disable&sslmode=verify-full`],
    ["verify-full in capitals", `${DIRECT}?sslmode=VERIFY-FULL`],
    ["verify-full beside ssl=0", `${DIRECT}?sslmode=verify-full&ssl=0`],
    ["verify-full under libpq semantics", `${DIRECT}?uselibpqcompat=true&sslmode=verify-full`],
    ["require under libpq semantics", `${DIRECT}?uselibpqcompat=true&sslmode=require`],
    ["ssl=true and no sslmode", `${DIRECT}?ssl=true`],
  ])("never accepts a string pg would open without verifying: %s", (_, value) => {
    expect({ accepted: accepted(value), verifies: pgVerifies(value) }).not.toEqual({
      accepted: true,
      verifies: false,
    });
  });

  it.each([
    ["verify-full", `${DIRECT}?sslmode=verify-full`],
    [
      "verify-full after a weak sslmode, which is the one pg keeps",
      `${DIRECT}?sslmode=disable&sslmode=verify-full`,
    ],
  ])("accepts %s, which pg verifies", (_, value) => {
    expect(accepted(value)).toBe(true);
    expect(pgVerifies(value)).toBe(true);
  });
});

describe("outside production", () => {
  // The local Docker database speaks no TLS at all.
  it.each([
    ["unset", {}],
    ["development", { ENVIRONMENT: "development" }],
  ])("accepts a string with no sslmode when ENVIRONMENT is %s", (_, environment) => {
    expect(poolConfig({ ...environment, ...BOTH }).connectionString).toBe(POOLED);
    expect(directConfig({ ...environment, ...BOTH }).connectionString).toBe(DIRECT);
  });
});

describe("the connection string itself", () => {
  // A connection string carries a password. It reaches `pg` and nothing else —
  // not an error message, not a `context`, not a log line. `redaction.ts` matches
  // key *names*, so it would not catch this one at `message`.
  it("never reaches the error a missing sibling variable throws", () => {
    const failure = thrown(() => directConfig({ [POOLED_URL_VARIABLE]: POOLED }));
    expect(failure.message).not.toContain(POOLED);
    expect(JSON.stringify(failure.context)).not.toContain(POOLED);
  });

  it.each([
    ["a weak sslmode", `${DIRECT}?sslmode=no-verify`],
    ["sslrootcert=system", `${DIRECT}?sslmode=verify-full&sslrootcert=system`],
    ["a value that is not a URL", `host=localhost password=${PASSWORD} sslmode=verify-full`],
  ])("never reaches the error that refuses %s in production", (_, value) => {
    const failure = thrown(() =>
      directConfig({ ENVIRONMENT: "production", [DIRECT_URL_VARIABLE]: value }),
    );
    for (const field of [failure.message, JSON.stringify(failure.context)]) {
      expect(field).not.toContain(value);
      expect(field).not.toContain(PASSWORD);
    }
  });
});
