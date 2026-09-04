/**
 * Seam 1 for the Admin door's challenge — the value that stands between the link
 * in the mailbox and the code from the authenticator.
 *
 * It is pure by construction and that is the reason it is a module of its own:
 * the property worth testing is that **nothing but this key can produce one**,
 * and that is a table of tampered strings rather than a database.
 */

import {
  ADMIN_CHALLENGE_TTL_SECONDS,
  readSignInChallenge,
  readSignInChallengeFromHeaders,
  SIGN_IN_CHALLENGE_COOKIE,
  signSignInChallenge,
} from "#admin/challenge";

const KEY = "a-secret-long-enough-for-the-configuration-to-build";
const OTHER_KEY = "a-different-secret-long-enough-for-the-configuration";
const ACCOUNT = "0199bb2f-2b6d-7c1b-9b3a-6f4a1c0d5e42";

const noon = new Date("2026-08-30T12:00:00.000Z");
const later = (seconds: number) => new Date(noon.getTime() + seconds * 1000);

const withCookie = (line: string) => new Headers({ cookie: line });

function challenge(): string {
  return signSignInChallenge(ACCOUNT, KEY, { now: noon });
}

describe("signSignInChallenge", () => {
  test("carries the Account and nothing else", () => {
    /**
     * The whole of what the value is allowed to hold. Asserted over the string
     * rather than over a parsed shape, because what crosses to a browser is the
     * string — an address or an email smuggled into a later field would be
     * readable by anyone holding the cookie, and this is the assertion that would
     * fail.
     */
    const [carried, ...rest] = challenge().split(".");

    expect(carried).toBe(ACCOUNT);
    expect(rest).toHaveLength(2);
  });

  test("produces a different signature under a different key", () => {
    expect(signSignInChallenge(ACCOUNT, OTHER_KEY, { now: noon })).not.toBe(challenge());
  });
});

describe("readSignInChallenge", () => {
  test("returns the Account it was signed with", () => {
    expect(readSignInChallenge(challenge(), KEY, later(1))).toBe(ACCOUNT);
  });

  test("holds until the last second of its window", () => {
    expect(readSignInChallenge(challenge(), KEY, later(ADMIN_CHALLENGE_TTL_SECONDS - 1))).toBe(
      ACCOUNT,
    );
  });

  test("refuses one that has expired", () => {
    expect(
      readSignInChallenge(challenge(), KEY, later(ADMIN_CHALLENGE_TTL_SECONDS + 1)),
    ).toBeNull();
  });

  test("refuses one signed with another key", () => {
    expect(
      readSignInChallenge(signSignInChallenge(ACCOUNT, OTHER_KEY, { now: noon }), KEY, noon),
    ).toBeNull();
  });

  /**
   * **Each of the three parts, edited on its own.** The account is the part an
   * attacker would want to change — holding any challenge would otherwise be
   * holding every Account's — and the expiry is the part that would turn a
   * ten-minute window into an unbounded one.
   */
  test.each([
    [
      "the account",
      (parts: string[]) => ["0199bb2f-0000-7c1b-9b3a-6f4a1c0d5e42", parts[1], parts[2]],
    ],
    ["the expiry", (parts: string[]) => [parts[0], String(Number(parts[1]) + 60_000), parts[2]]],
    ["the signature", (parts: string[]) => [parts[0], parts[1], `${parts[2]?.slice(0, -1)}0`]],
  ])("refuses one whose %s has been edited", (_part, edit) => {
    expect(readSignInChallenge(edit(challenge().split(".")).join("."), KEY, noon)).toBeNull();
  });

  /**
   * Everything that is not a challenge at all reduces to the same `null`, which
   * is what lets the caller answer a bad cookie exactly as it answers no cookie.
   */
  test.each([
    ["empty", ""],
    ["no separators", "not-a-challenge"],
    ["too few parts", `${ACCOUNT}.1`],
    ["too many parts", `${ACCOUNT}.1.2.3`],
    ["a non-numeric expiry", `${ACCOUNT}.soon.abcdef`],
  ])("refuses %s", (_shape, value) => {
    expect(readSignInChallenge(value, KEY, noon)).toBeNull();
  });
});

/**
 * The header read, which is the half `apps/web` reaches.
 *
 * A `Cookie` header is a list, so the cases that matter are not about the
 * challenge at all: they are about picking the right member out of a line that
 * carries a session cookie, a shared-device cookie and whatever else a browser
 * has collected. Every one of them collapses to the same `null` a forged value
 * gets, which is what lets the page answer all of them with one 404.
 */
describe("readSignInChallengeFromHeaders", () => {
  test("reads a live challenge out of a header carrying several cookies", () => {
    const headers = withCookie(
      `theme=light; ${SIGN_IN_CHALLENGE_COOKIE}=${challenge()}; recomencemos.shared_device=1`,
    );

    expect(readSignInChallengeFromHeaders(headers, KEY, noon)).toBe(ACCOUNT);
  });

  test("reads one that is the only cookie", () => {
    expect(
      readSignInChallengeFromHeaders(
        withCookie(`${SIGN_IN_CHALLENGE_COOKIE}=${challenge()}`),
        KEY,
        noon,
      ),
    ).toBe(ACCOUNT);
  });

  /**
   * **A cookie whose name merely ends in ours is not ours.** `=` is what
   * terminates the name, so splitting on the first one is the whole of the rule
   * — and a line-wide `includes` would have let `x.recomencemos.sign_in_challenge`
   * vouch for a challenge nothing signed.
   */
  test("refuses a cookie whose name only ends with the challenge's", () => {
    expect(
      readSignInChallengeFromHeaders(
        withCookie(`x.${SIGN_IN_CHALLENGE_COOKIE}=${challenge()}`),
        KEY,
        noon,
      ),
    ).toBeNull();
  });

  test("refuses one that has expired", () => {
    expect(
      readSignInChallengeFromHeaders(
        withCookie(`${SIGN_IN_CHALLENGE_COOKIE}=${challenge()}`),
        KEY,
        later(ADMIN_CHALLENGE_TTL_SECONDS + 1),
      ),
    ).toBeNull();
  });

  test("refuses one signed with another key", () => {
    const forged = signSignInChallenge(ACCOUNT, OTHER_KEY, { now: noon });

    expect(
      readSignInChallengeFromHeaders(
        withCookie(`${SIGN_IN_CHALLENGE_COOKIE}=${forged}`),
        KEY,
        noon,
      ),
    ).toBeNull();
  });

  /**
   * The cleared cookie is the case this has to get right rather than an edge:
   * the door writes `<name>=` with `maxAge: 0` on success, and a browser that
   * sends the empty value back must not be read as still holding a challenge.
   */
  test.each([
    ["no cookie header at all", new Headers()],
    ["an empty cookie header", withCookie("")],
    ["other cookies only", withCookie("theme=light; recomencemos.shared_device=1")],
    ["the cleared cookie", withCookie(`${SIGN_IN_CHALLENGE_COOKIE}=`)],
    ["a name with no value at all", withCookie(SIGN_IN_CHALLENGE_COOKIE)],
  ])("refuses %s", (_shape, headers) => {
    expect(readSignInChallengeFromHeaders(headers, KEY, noon)).toBeNull();
  });
});
