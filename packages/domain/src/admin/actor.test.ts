/**
 * NFR14's gate, driven as a table over every session shape that can reach it.
 *
 * Seam 1: `requireAdminSession` is a pure function over a session, which is why
 * this file can enumerate the cases rather than paying for a real sign-in each.
 * `admin-door.integration.test.ts` is the other half — that a session with these
 * field values is one Better Auth actually produces.
 */

import { SIGN_IN_METHODS, type SignInMethod } from "#auth-schema";
import { type AdminCandidateSession, requireAdminSession } from "#admin/actor";

function session(over: Partial<AdminCandidateSession> = {}): AdminCandidateSession {
  return { accountId: "account-1", signInMethod: "password_totp", isAdmin: true, ...over };
}

describe("requireAdminSession", () => {
  it("admits a session that presented password and TOTP on an Admin Account", () => {
    expect(requireAdminSession(session())).toEqual({ accountId: "account-1" });
  });

  it("has no session to admit when there is none", () => {
    expect(requireAdminSession(null)).toBeNull();
  });

  /**
   * **The requirement, stated as one case.** _"An Admin who signed in through the
   * magic link every Account can use is not an authenticated Admin."_ The grant
   * is real and `twoFactorEnabled` on the user would read `true`; the session
   * presented no second factor, and that is the fact NFR14 gates on.
   */
  it("refuses an Admin who arrived through a passwordless door", () => {
    expect(requireAdminSession(session({ signInMethod: "magic_link" }))).toBeNull();
    expect(requireAdminSession(session({ signInMethod: "google" }))).toBeNull();
  });

  /**
   * The bootstrap window. An Admin granted by runbook §6's `UPDATE` holds one of
   * these until enrolment finishes, and it must reach the enrolment surface and
   * nothing else.
   */
  it("refuses an Admin who presented a password and no second factor", () => {
    expect(requireAdminSession(session({ signInMethod: "password" }))).toBeNull();
  });

  it("refuses a two-factor session on an Account holding no grant", () => {
    expect(requireAdminSession(session({ isAdmin: false }))).toBeNull();
  });

  /**
   * **The table is driven off `SIGN_IN_METHODS` rather than off a list written
   * here**, so a door added to the product without a decision about NFR14 shows
   * up as a failure in this file rather than as an admission nobody made. Exactly
   * one member may be admitted.
   */
  it("admits exactly one of the product's sign-in methods", () => {
    const admitted = SIGN_IN_METHODS.filter(
      (method: SignInMethod) => requireAdminSession(session({ signInMethod: method })) !== null,
    );

    expect(admitted).toEqual(["password_totp"]);
  });

  /**
   * A method the column's `CHECK` would refuse cannot reach this function in
   * production — but the field is typed `SignInMethod | string` because it is
   * read back off a driver, and "unrecognised" must fall on the refusing side
   * rather than through a gap.
   */
  it.each(["", "admin", "PASSWORD_TOTP", "password_totp "])(
    "refuses the unrecognised method %o",
    (signInMethod) => {
      expect(requireAdminSession(session({ signInMethod }))).toBeNull();
    },
  );

  /**
   * NFR18 and the Core entities rule for `AdminAction`: the actor is an id and
   * nothing else. A field added to `AdminCandidateSession` later must not travel
   * into the audit by being copied along with it.
   */
  it("carries the actor's id and nothing else", () => {
    const actor = requireAdminSession(session());
    expect(Object.keys(actor ?? {})).toEqual(["accountId"]);
  });
});
