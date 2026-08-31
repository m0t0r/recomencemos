import { isAppError } from "@repo/errors/app-error";
import { ADMIN_SIGN_IN_METHOD, SIGN_IN_METHODS } from "#auth-schema";
import {
  ADMIN_SECOND_FACTOR_PATH,
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
    [ADMIN_SECOND_FACTOR_PATH, "link_totp"],
  ] as const)("names %s as %s", (path, method) => {
    expect(signInMethodForPath(path)).toBe(method);
  });

  /**
   * DD5 makes ten printed backup codes one of three required recovery paths, and
   * a session established with one has to be able to moderate — losing the TOTP
   * device otherwise leaves every reported Hirer frozen (C43). What NFR14 asks
   * is that two factors were presented, not which second one.
   *
   * **Both codes go through one path now**, which is what the door's single field
   * is: the shape of what was typed picks the factor, so there is no second
   * endpoint for the two to agree with each other about.
   */
  it("treats a backup code as the second factor, exactly as TOTP is", () => {
    expect(signInMethodForPath(ADMIN_SECOND_FACTOR_PATH)).toBe(ADMIN_SIGN_IN_METHOD);
  });

  /**
   * **Exactly one path mints the method NFR14 accepts.** This is the assertion
   * that carries "an Admin session presented two factors": a second producer
   * added without a thought about the requirement would fail here rather than
   * ship authority behind a door nobody reviewed.
   */
  it("mints an Admin session from one path and no other", () => {
    const producers = ["/magic-link/verify", "/callback/:id", ADMIN_SECOND_FACTOR_PATH].filter(
      (path) => signInMethodForPath(path) === ADMIN_SIGN_IN_METHOD,
    );

    expect(producers).toEqual([ADMIN_SECOND_FACTOR_PATH]);
  });

  /**
   * **The credential door's three paths are not merely refused an Admin session —
   * they are refused a session.** They named `password` and `password_totp` while
   * the door stood; the contract half of DD5 removed the door, the two members and
   * these rows together, so the table no longer knows the paths at all and the
   * throw above is what they meet.
   *
   * That is a stronger statement than the one it replaces, and it is the reason
   * this case survived the deletion rather than going with it: re-enabling
   * `emailAndPassword` would put `/sign-in/email` back on the wire, and this says
   * that a session behind it does not quietly acquire a method.
   */
  it.each(["/sign-in/email", "/two-factor/verify-totp", "/two-factor/verify-backup-code"] as const)(
    "mints no session at all from %s",
    (path) => {
      expect(() => signInMethodForPath(path)).toThrow();
    },
  );

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

// The two numbers are NFR13's.
describe("session lifetime", () => {
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
    expect(sessionSecondsFor(ADMIN_SIGN_IN_METHOD, { sharedDevice: false })).toBe(
      ADMIN_SESSION_SECONDS,
    );
    expect(ADMIN_SESSION_SECONDS).toBe(60 * 60 * 8);
  });

  /**
   * **The case the ordering exists for.** An Admin signing in from her own laptop
   * carries no shared-device answer, so an attempt-first reading would hand the
   * account that can read every phone number in the system a thirty-day session —
   * the one lifetime NFR13 refuses it outright.
   */
  it("holds an Admin session to eight hours even on her own device", () => {
    expect(sessionSecondsFor(ADMIN_SIGN_IN_METHOD, { sharedDevice: false })).toBe(
      ADMIN_SESSION_SECONDS,
    );
    expect(sessionSecondsFor(ADMIN_SIGN_IN_METHOD, { sharedDevice: false })).not.toBe(
      OWN_DEVICE_SESSION_SECONDS,
    );
  });

  it("computes the expiry from the clock it is given", () => {
    const now = new Date("2026-08-27T12:00:00.000Z");

    expect(sessionExpiryFor("magic_link", { sharedDevice: true }, now).toISOString()).toBe(
      "2026-08-27T20:00:00.000Z",
    );
    expect(sessionExpiryFor("magic_link", { sharedDevice: false }, now).toISOString()).toBe(
      "2026-09-26T12:00:00.000Z",
    );
    expect(sessionExpiryFor(ADMIN_SIGN_IN_METHOD, { sharedDevice: false }, now).toISOString()).toBe(
      "2026-08-27T20:00:00.000Z",
    );
  });
});

/**
 * **The class every door but one falls into.** NFR14's rule is written over
 * _"every door that is not the Admin door"_, and this is that sentence as a
 * test: exactly one member is admitted and the other four are refused, whatever
 * `SIGN_IN_METHODS` grows to hold.
 *
 * It replaces a `PASSWORDLESS_SIGN_IN_METHODS` list that used to be pinned here,
 * and the replacement is the finding rather than a tidy-up: a list of the doors
 * that are wrong left `password` and `password_totp` outside it, so the
 * credential door minted a real session on an Admin's own Account. Written as a
 * complement, a door added later cannot fall through — it is refused for not
 * being one string.
 *
 * **The two members that motivated it are gone and the complement is what
 * survives them.** Nothing here names a door: this reads whatever
 * `SIGN_IN_METHODS` holds, so the assertion is about the shape of the rule rather
 * than about the doors that happen to exist today.
 */
describe("the doors an Admin-granted Account is refused at", () => {
  const refused = SIGN_IN_METHODS.filter((method) => method !== ADMIN_SIGN_IN_METHOD);

  it("is every door but the Admin's, with none left outside the rule", () => {
    expect([...refused].toSorted()).toEqual(["google", "magic_link"]);
  });

  it("admits exactly one, and it is the one the door mints", () => {
    expect(SIGN_IN_METHODS.filter((method) => method === ADMIN_SIGN_IN_METHOD)).toEqual([
      ADMIN_SIGN_IN_METHOD,
    ]);
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
