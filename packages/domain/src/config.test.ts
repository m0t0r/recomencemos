import { isAppError } from "@repo/errors/app-error";
import {
  CONNECT_TIMEOUT_MS,
  directConfig,
  DIRECT_URL_VARIABLE,
  POOL_MAX,
  POOL_MIN,
  poolConfig,
  POOLED_URL_VARIABLE,
} from "#config";

const POOLED = "postgres://user:pw@localhost:6432/db";
const DIRECT = "postgres://user:pw@localhost:5432/db";
const BOTH = { [POOLED_URL_VARIABLE]: POOLED, [DIRECT_URL_VARIABLE]: DIRECT };

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
    let thrown: unknown;
    try {
      poolConfig({});
    } catch (error) {
      thrown = error;
    }

    expect(isAppError(thrown)).toBe(true);
    expect((thrown as { message: string }).message).toContain(POOLED_URL_VARIABLE);
  });

  it("treats a blank value as absent, because an empty variable is the commoner mistake", () => {
    expect(() => poolConfig({ [POOLED_URL_VARIABLE]: "   " })).toThrow();
    expect(() => directConfig({ [DIRECT_URL_VARIABLE]: "" })).toThrow();
  });

  it("carries a user-facing string that is not the operator's", () => {
    try {
      poolConfig({});
    } catch (error) {
      const failure = error as { message: string; userMessage: string };
      expect(failure.userMessage).not.toBe(failure.message);
      expect(failure.userMessage).not.toContain(POOLED_URL_VARIABLE);
    }
  });
});

describe("the connection string itself", () => {
  // A connection string carries a password. It reaches `pg` and nothing else —
  // not an error message, not a `context`, not a log line. `redaction.ts` matches
  // key *names*, so it would not catch this one at `message`.
  it("never reaches the error a missing sibling variable throws", () => {
    try {
      directConfig({ [POOLED_URL_VARIABLE]: POOLED });
    } catch (error) {
      const failure = error as { message: string; context: Record<string, unknown> };
      expect(failure.message).not.toContain(POOLED);
      expect(JSON.stringify(failure.context)).not.toContain(POOLED);
    }
  });
});
