/**
 * The one reader of where this process is running (ADR-0022).
 *
 * Unset has to read as development and a typo has to stop the process, and the
 * two pull in opposite directions — so both are pinned here, beside the three
 * values that are simply read.
 */

import { AppError } from "@repo/errors/app-error";
import { ENVIRONMENT_VARIABLE, readEnvironment } from "@repo/errors/environment";

function refusal(value: string): AppError {
  try {
    readEnvironment({ [ENVIRONMENT_VARIABLE]: value });
  } catch (error) {
    return error as AppError;
  }

  throw new Error(`readEnvironment() accepted ${JSON.stringify(value)}`);
}

describe("readEnvironment", () => {
  // The developer never sets anything; the image sets production in git.
  it("reads an unset variable as development", () => {
    expect(readEnvironment({})).toBe("development");
  });

  it.each(["", "   "])("reads a blank value %o as development", (blank) => {
    expect(readEnvironment({ [ENVIRONMENT_VARIABLE]: blank })).toBe("development");
  });

  it.each(["development", "production"] as const)("reads %s as itself", (value) => {
    expect(readEnvironment({ [ENVIRONMENT_VARIABLE]: value })).toBe(value);
  });

  // Build mode is not where the process runs, and a local `next start` is not production.
  it("does not read NODE_ENV at all", () => {
    expect(readEnvironment({ NODE_ENV: "production" })).toBe("development");
  });

  it.each(["prod", "staging", "Production", "test"])(
    "refuses %s rather than treating it as one of the two",
    (value) => {
      expect(() => readEnvironment({ [ENVIRONMENT_VARIABLE]: value })).toThrow(AppError);
    },
  );

  describe("the refusal", () => {
    it("names the variable and both accepted values", () => {
      const { message } = refusal("prod");

      expect(message).toContain(ENVIRONMENT_VARIABLE);
      expect(message).toContain("development");
      expect(message).toContain("production");
    });

    it("carries the variable and the value it refused as context", () => {
      expect(refusal("prod").context).toEqual({ variable: ENVIRONMENT_VARIABLE, value: "prod" });
    });

    it("truncates a long value rather than putting all of it on the line", () => {
      const value = String(refusal("x".repeat(500)).context.value);

      expect(value.length).toBeLessThanOrEqual(64);
    });
  });
});
