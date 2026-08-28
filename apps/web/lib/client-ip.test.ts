/**
 * The per-IP principal, which is the half of NFR26 that stops the per-address
 * half being defeated by rotating addresses.
 *
 * **Two of these cases are regressions from `/code-review` round 1 on
 * [#12](https://github.com/m0t0r/recomencemos/issues/12)**, where the ceiling
 * was found both *bypassable* and *failing open*: it keyed on the caller-supplied
 * first hop of `x-forwarded-for`, and it skipped the charge entirely when the
 * header was absent. The function was fixed then and moved here later; the tests
 * are new, because until it had a module of its own it could not have any.
 */

import { clientIp, NO_PROXY_PRINCIPAL } from "./client-ip";

function headers(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

describe("clientIp", () => {
  it("prefers Fly-Client-IP, which the proxy sets and a caller cannot choose", () => {
    expect(
      clientIp(headers({ "fly-client-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1" })),
    ).toBe("203.0.113.7");
  });

  it("trims whitespace around it", () => {
    expect(clientIp(headers({ "fly-client-ip": "  203.0.113.7  " }))).toBe("203.0.113.7");
  });

  it("falls back to x-forwarded-for when there is no Fly header", () => {
    expect(clientIp(headers({ "x-forwarded-for": "203.0.113.7" }))).toBe("203.0.113.7");
  });

  /**
   * **The bypass.** `x-forwarded-for` is a list each proxy *appends* to, so the
   * leftmost entry is whatever the original caller sent. Charging it makes the
   * ≤ 20/hour bound defeatable by putting a fresh value in a header on every
   * request.
   */
  it("charges the last hop, not the first the caller supplied", () => {
    const forged = "1.1.1.1, 2.2.2.2, 203.0.113.7";

    expect(clientIp(headers({ "x-forwarded-for": forged }))).toBe("203.0.113.7");
  });

  it("ignores empty entries in the list", () => {
    expect(clientIp(headers({ "x-forwarded-for": "1.1.1.1, , 203.0.113.7 ,," }))).toBe(
      "203.0.113.7",
    );
  });

  /**
   * **Failing open.** Returning "no principal" for a header-less caller meant
   * the per-IP ceiling silently did not apply, so stripping the header removed
   * the bound entirely. A shared bucket is the closed answer: header-less
   * callers are bounded together.
   */
  it("charges a shared bucket rather than skipping the charge", () => {
    expect(clientIp(headers({}))).toBe(NO_PROXY_PRINCIPAL);
  });

  it.each(["", "   ", ",", " , "])(
    "charges the shared bucket for an unusable x-forwarded-for (%o)",
    (value) => {
      expect(clientIp(headers({ "x-forwarded-for": value }))).toBe(NO_PROXY_PRINCIPAL);
    },
  );

  // An empty Fly header is not an answer; fall through rather than charge "".
  it("falls through an empty Fly-Client-IP", () => {
    expect(clientIp(headers({ "fly-client-ip": "   ", "x-forwarded-for": "203.0.113.7" }))).toBe(
      "203.0.113.7",
    );
  });

  it("is case-insensitive about the header name, as Headers is", () => {
    expect(clientIp(headers({ "Fly-Client-IP": "203.0.113.7" }))).toBe("203.0.113.7");
  });
});
