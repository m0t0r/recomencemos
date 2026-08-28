/**
 * The `Set-Cookie` re-write, which is the one part of the Google door a machine
 * without Google credentials can verify.
 *
 * **This file exists because a review found the module functionally broken and
 * nothing else could have.** `check-types` was green, the suite was green, and
 * the seam-3 run that verified the email door end to end never reached this code
 * — the Google door is absent without credentials. The first case below is that
 * bug.
 */

import { parseSetCookie } from "./set-cookie";

/** A realistic Better Auth state cookie, as `better-call` actually writes it. */
const SIGNED_VALUE = "abc123-state-token.Pe68wh/O+DEuAIP6vUngCQ4Ip70k3LLOWabcwb4VWnE=";
const STATE_LINE =
  `__Secure-better-auth.state=${encodeURIComponent(SIGNED_VALUE)}` +
  "; Max-Age=300; Path=/; HttpOnly; Secure; SameSite=Lax";

describe("the signed value's round trip", () => {
  /**
   * **The regression.** `better-call` percent-encodes the value into the line;
   * Next percent-encodes again on write. Handing the encoded substring straight
   * to `cookies().set()` therefore double-encodes it, and the server — which
   * decodes once — reads a signature 50 characters long that does not end in
   * `=`. `getSignedCookie` refuses anything but 44-ending-in-`=`, so
   * `parseGenericState` throws `state_security_mismatch` and every Google
   * sign-in fails.
   */
  it("decodes the value so Next's own encoding restores it exactly", () => {
    const cookie = parseSetCookie(STATE_LINE);

    expect(cookie?.value).toBe(SIGNED_VALUE);

    // What Next will write, and what the server will then read back.
    const written = encodeURIComponent(cookie?.value ?? "");
    expect(decodeURIComponent(written)).toBe(SIGNED_VALUE);
  });

  // The property that actually breaks, named directly rather than left implicit
  // in the string above: a base64 HMAC-SHA256 signature is 44 chars ending `=`.
  it("keeps the signature the length and shape better-call requires", () => {
    const signature = parseSetCookie(STATE_LINE)?.value?.split(".").pop() ?? "";

    expect(signature).toHaveLength(44);
    expect(signature.endsWith("=")).toBe(true);
  });

  it("does not double-encode a value carrying no escapes", () => {
    const cookie = parseSetCookie("recomencemos.shared_device=1; Max-Age=600; Path=/");

    expect(cookie?.value).toBe("1");
  });
});

describe("the attributes a security property depends on", () => {
  it("carries every attribute Better Auth set on the state cookie", () => {
    expect(parseSetCookie(STATE_LINE)).toEqual({
      name: "__Secure-better-auth.state",
      value: SIGNED_VALUE,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 300,
    });
  });

  // Dropping either of these downgrades the cookie: a state cookie readable by
  // script, or one sent over plain HTTP.
  it.each([
    ["HttpOnly", "httpOnly"],
    ["Secure", "secure"],
  ] as const)("does not lose %s", (attribute, key) => {
    const withIt = parseSetCookie(`a=b; ${attribute}`);
    const without = parseSetCookie("a=b");

    expect(withIt?.[key]).toBe(true);
    expect(without?.[key]).toBe(false);
  });

  it.each([
    ["SameSite=Strict", "strict"],
    ["SameSite=None", "none"],
    ["SameSite=Lax", "lax"],
  ] as const)("reads %s", (attribute, expected) => {
    expect(parseSetCookie(`a=b; ${attribute}`)?.sameSite).toBe(expected);
  });

  // A browser treats an absent `SameSite` as Lax, so this is not a guess.
  it("defaults SameSite to lax when the line declares none", () => {
    expect(parseSetCookie("a=b")?.sameSite).toBe("lax");
  });

  /**
   * Carried even though both cookies on this path also send `Max-Age`. A cookie
   * is not ours and its attributes are not ours to drop — see the note on
   * `expiresOf`.
   */
  it("carries Expires as well as Max-Age", () => {
    const cookie = parseSetCookie("a=b; Expires=Wed, 09 Jun 2027 10:18:14 GMT; Max-Age=300");

    expect(cookie?.maxAge).toBe(300);
    expect(cookie?.expires).toEqual(new Date("Wed, 09 Jun 2027 10:18:14 GMT"));
  });

  it("omits an unparseable Expires rather than passing an Invalid Date", () => {
    expect(parseSetCookie("a=b; Expires=not-a-date")).not.toHaveProperty("expires");
  });

  it("omits a non-numeric Max-Age rather than passing NaN", () => {
    expect(parseSetCookie("a=b; Max-Age=soon")).not.toHaveProperty("maxAge");
  });

  it("defaults the path to / when the line declares none", () => {
    expect(parseSetCookie("a=b")?.path).toBe("/");
  });

  it("reads a narrower path", () => {
    expect(parseSetCookie("a=b; Path=/api/auth")?.path).toBe("/api/auth");
  });
});

describe("lines that are not a cookie", () => {
  it.each(["", "novalue", "=orphaned", "; Path=/"])("refuses %o", (line) => {
    expect(parseSetCookie(line)).toBeUndefined();
  });

  // A value may legitimately contain `=` — base64 padding does.
  it("splits on the first = only", () => {
    expect(parseSetCookie("a=b=c=")?.value).toBe("b=c=");
  });

  // A malformed escape must not throw and take the whole sign-in down with it.
  it("passes a value through when it cannot be decoded", () => {
    expect(parseSetCookie("a=%E0%A4%A")?.value).toBe("%E0%A4%A");
  });
});
