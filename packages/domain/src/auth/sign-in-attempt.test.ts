import { isAppError } from "@repo/errors/app-error";
import { ADMIN_SIGN_IN_METHOD, PASSWORDLESS_SIGN_IN_METHODS } from "#auth-schema";
import {
  ADMIN_SESSION_SECONDS,
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
  it.each([
    ["/magic-link/verify", "magic_link"],
    ["/callback/:id", "google"],
    ["/sign-in/email", "password"],
    ["/two-factor/verify-totp", "password_totp"],
    ["/two-factor/verify-backup-code", "password_totp"],
  ] as const)("names %s as %s", (path, method) => {
    expect(signInMethodForPath(path)).toBe(method);
  });

  /**
   * DD5 makes ten printed backup codes one of three required recovery paths, and
   * a session established with one has to be able to moderate — losing the TOTP
   * device otherwise leaves every reported Hirer frozen (C43). What NFR14 asks
   * is that two factors were presented, not which second one.
   */
  it("treats a backup code as the second factor, exactly as TOTP is", () => {
    expect(signInMethodForPath("/two-factor/verify-backup-code")).toBe(ADMIN_SIGN_IN_METHOD);
  });

  /**
   * The password-only session is the enrolment window and nothing more. If this
   * ever equalled {@link ADMIN_SIGN_IN_METHOD}, an Admin would hold full
   * authority having typed a password and no code — which is NFR14 inverted.
   */
  it("does not call a password-only session an Admin session", () => {
    expect(signInMethodForPath("/sign-in/email")).not.toBe(ADMIN_SIGN_IN_METHOD);
  });

  // NFR14 is the reason this throws instead of defaulting: Admin authentication
  // is a property of the session, so a door that has not declared itself must
  // not be able to mint one.
  it("refuses a path it does not know rather than guessing a method", () => {
    let thrown: unknown;
    try {
      signInMethodForPath("/sign-in/passkey");
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
    expect(sessionSecondsFor("magic_link", { sharedDevice: false })).toBe(
      OWN_DEVICE_SESSION_SECONDS,
    );
    expect(OWN_DEVICE_SESSION_SECONDS).toBe(60 * 60 * 24 * 30);
  });

  it("gives a shared device eight hours", () => {
    expect(sessionSecondsFor("magic_link", { sharedDevice: true })).toBe(
      SHARED_DEVICE_SESSION_SECONDS,
    );
    expect(SHARED_DEVICE_SESSION_SECONDS).toBe(60 * 60 * 8);
  });

  it("gives an Admin eight hours", () => {
    expect(sessionSecondsFor("password_totp", { sharedDevice: false })).toBe(ADMIN_SESSION_SECONDS);
    expect(ADMIN_SESSION_SECONDS).toBe(60 * 60 * 8);
  });

  /**
   * **The case the ordering exists for.** An Admin signing in from her own laptop
   * carries no shared-device answer, so an attempt-first reading would hand the
   * account that can read every phone number in the system a thirty-day session —
   * the one lifetime NFR13 refuses it outright.
   */
  it.each(["password", "password_totp"] as const)(
    "holds a %s session to eight hours even on her own device",
    (method) => {
      expect(sessionSecondsFor(method, { sharedDevice: false })).toBe(ADMIN_SESSION_SECONDS);
      expect(sessionSecondsFor(method, { sharedDevice: false })).not.toBe(
        OWN_DEVICE_SESSION_SECONDS,
      );
    },
  );

  it("computes the expiry from the clock it is given", () => {
    const now = new Date("2026-08-27T12:00:00.000Z");

    expect(sessionExpiryFor("magic_link", { sharedDevice: true }, now).toISOString()).toBe(
      "2026-08-27T20:00:00.000Z",
    );
    expect(sessionExpiryFor("magic_link", { sharedDevice: false }, now).toISOString()).toBe(
      "2026-09-26T12:00:00.000Z",
    );
    expect(sessionExpiryFor("password_totp", { sharedDevice: false }, now).toISOString()).toBe(
      "2026-08-27T20:00:00.000Z",
    );
  });
});

/**
 * NFR14's rule is written over the **class** of passwordless doors, so the class
 * itself is worth pinning: a door added to `SIGN_IN_METHODS` without a thought
 * about which side of this line it falls on is the failure the requirement names.
 */
describe("the passwordless class", () => {
  it("holds exactly the two doors that present no second factor", () => {
    expect([...PASSWORDLESS_SIGN_IN_METHODS].toSorted()).toEqual(["google", "magic_link"]);
  });

  it("does not hold the credential doors", () => {
    const passwordless: readonly string[] = PASSWORDLESS_SIGN_IN_METHODS;
    expect(passwordless).not.toContain("password");
    expect(passwordless).not.toContain(ADMIN_SIGN_IN_METHOD);
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
