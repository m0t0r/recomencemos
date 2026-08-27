import { isAppError } from "@repo/errors/app-error";
import {
  NO_SIGN_IN_ATTEMPT,
  OWN_DEVICE_SESSION_SECONDS,
  readSignInAttempt,
  SHARED_DEVICE_SESSION_SECONDS,
  SIGN_IN_ATTEMPT_KEY,
  sessionExpiryFor,
  sessionSecondsFor,
  sharedDeviceFromHeader,
  signInMethodForPath,
} from "#auth/sign-in-attempt";

describe("signInMethodForPath", () => {
  it("names the magic-link door", () => {
    expect(signInMethodForPath("/magic-link/verify")).toBe("magic_link");
  });

  it("names the Google door", () => {
    expect(signInMethodForPath("/callback/:id")).toBe("google");
  });

  // NFR14 is the reason this throws instead of defaulting: Admin authentication
  // is a property of the session, so a door that has not declared itself must
  // not be able to mint one.
  it("refuses a path it does not know rather than guessing a method", () => {
    let thrown: unknown;
    try {
      signInMethodForPath("/sign-in/email");
    } catch (error) {
      thrown = error;
    }

    expect(isAppError(thrown)).toBe(true);
    expect((thrown as { code: string }).code).toBe("sign_in_method_unknown");
  });

  it("keeps the offending path out of the string a browser sees", () => {
    try {
      signInMethodForPath("/some/unknown/door");
    } catch (error) {
      expect((error as { userMessage: string }).userMessage).not.toContain("/some/unknown/door");
    }
    expect.hasAssertions();
  });
});

describe("session lifetime (NFR13)", () => {
  it("gives her own device thirty days", () => {
    expect(sessionSecondsFor({ sharedDevice: false })).toBe(OWN_DEVICE_SESSION_SECONDS);
    expect(OWN_DEVICE_SESSION_SECONDS).toBe(60 * 60 * 24 * 30);
  });

  it("gives a shared device eight hours", () => {
    expect(sessionSecondsFor({ sharedDevice: true })).toBe(SHARED_DEVICE_SESSION_SECONDS);
    expect(SHARED_DEVICE_SESSION_SECONDS).toBe(60 * 60 * 8);
  });

  it("computes the expiry from the clock it is given", () => {
    const now = new Date("2026-08-27T12:00:00.000Z");

    expect(sessionExpiryFor({ sharedDevice: true }, now).toISOString()).toBe(
      "2026-08-27T20:00:00.000Z",
    );
    expect(sessionExpiryFor({ sharedDevice: false }, now).toISOString()).toBe(
      "2026-09-26T12:00:00.000Z",
    );
  });
});

describe("readSignInAttempt", () => {
  it("reads the attempt a before-hook merged onto the context", () => {
    const attempt = readSignInAttempt({
      [SIGN_IN_ATTEMPT_KEY]: { sharedDevice: true, signInAttemptId: "abc" },
    });

    expect(attempt).toEqual({ sharedDevice: true, signInAttemptId: "abc" });
  });

  it("reads an own-device answer as own-device", () => {
    const attempt = readSignInAttempt({
      [SIGN_IN_ATTEMPT_KEY]: { sharedDevice: false, signInAttemptId: "abc" },
    });

    expect(attempt.sharedDevice).toBe(false);
  });

  // No attempt carried is an answer, not a failure: she did not tick the box.
  // Reading it as shared would put every Worker on an 8-hour session.
  it.each([
    ["a null context", null],
    ["an undefined context", undefined],
    ["a context that is not an object", "nope"],
    ["a context with no attempt", {}],
    ["an attempt that is not an object", { [SIGN_IN_ATTEMPT_KEY]: "true" }],
  ])("reads %s as own device", (_name, context) => {
    expect(readSignInAttempt(context).sharedDevice).toBe(false);
  });

  // An attempt that *is* carried but whose flag is unreadable is a bug in our
  // own hook, and there the safe direction is the other one: a lost answer costs
  // her the shorter session, never a 30-day one left open on a shared machine.
  it.each([
    ["an attempt missing the flag", { [SIGN_IN_ATTEMPT_KEY]: {} }],
    ["a flag that is a string", { [SIGN_IN_ATTEMPT_KEY]: { sharedDevice: "false" } }],
    ["a flag that is undefined", { [SIGN_IN_ATTEMPT_KEY]: { sharedDevice: undefined } }],
    ["a flag that is null", { [SIGN_IN_ATTEMPT_KEY]: { sharedDevice: null } }],
  ])("fails safe on %s", (_name, context) => {
    expect(readSignInAttempt(context).sharedDevice).toBe(true);
  });

  it("has no attempt id when none was carried", () => {
    expect(
      readSignInAttempt({ [SIGN_IN_ATTEMPT_KEY]: { sharedDevice: false } }).signInAttemptId,
    ).toBeUndefined();
    expect(
      readSignInAttempt({ [SIGN_IN_ATTEMPT_KEY]: { sharedDevice: false, signInAttemptId: "" } })
        .signInAttemptId,
    ).toBeUndefined();
  });

  it("reads a bare absence as an own-device attempt", () => {
    expect(NO_SIGN_IN_ATTEMPT.sharedDevice).toBe(false);
  });
});

describe("sharedDeviceFromHeader", () => {
  it.each([
    ["1", true],
    ["true", true],
    ["0", false],
    ["false", false],
    ["", false],
    [null, false],
    [undefined, false],
    ["yes", false],
  ])("reads %o as %o", (value, expected) => {
    expect(sharedDeviceFromHeader(value)).toBe(expected);
  });
});
