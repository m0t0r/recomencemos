/**
 * The device resolver, as a table.
 *
 * **It sits in `apps/web` rather than in `@repo/domain` on purpose.** A
 * `User-Agent` string is a fact about a transport header, not about a Worker, an
 * Offer or a session — the domain has no business holding an opinion about how
 * "Chrome en Windows" is spelled, and `@repo/domain/auth-handler` hands the raw
 * string across precisely so this decision lives with the surface that renders
 * it (ADR-0012 puts the Spanish here too).
 *
 * **And it is a table rather than a dependency.** The label is cosmetic and its
 * failure mode is one honest generic sentence, which does not justify a parser
 * in the graph `pnpm audit:direct` watches. The cases below are real strings,
 * copied from real clients, because a hand-written matcher tested against
 * hand-written input tests nothing.
 */

import { readDevice } from "./device";

describe("readDevice", () => {
  const cases: readonly { name: string; ua: string; browser: string; platform: string }[] = [
    {
      name: "Chrome on an Android phone — the Worker's most likely device",
      ua:
        "Mozilla/5.0 (Linux; Android 14; SM-A155M) AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/140.0.0.0 Mobile Safari/537.36",
      browser: "Chrome",
      platform: "Android",
    },
    {
      name: "Chrome on Windows — the cybercafé machine",
      ua:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/139.0.0.0 Safari/537.36",
      browser: "Chrome",
      platform: "Windows",
    },
    {
      name: "Safari on an iPhone",
      ua:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 " +
        "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      browser: "Safari",
      platform: "iPhone",
    },
    {
      name: "Safari on a Mac",
      ua:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 " +
        "(KHTML, like Gecko) Version/17.6 Safari/605.1.15",
      browser: "Safari",
      platform: "Mac",
    },
    {
      name: "Firefox on Windows",
      ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
      browser: "Firefox",
      platform: "Windows",
    },
    {
      /** Edge carries `Chrome/` too, so token order is what decides this one. */
      name: "Edge on Windows, which also claims to be Chrome",
      ua:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0",
      browser: "Edge",
      platform: "Windows",
    },
    {
      /** So does Samsung Internet, which is common on exactly the phones this product reaches. */
      name: "Samsung Internet on Android, which also claims to be Chrome",
      ua:
        "Mozilla/5.0 (Linux; Android 14; SM-A155M) AppleWebKit/537.36 (KHTML, like Gecko) " +
        "SamsungBrowser/25.0 Chrome/130.0.0.0 Mobile Safari/537.36",
      browser: "Samsung Internet",
      platform: "Android",
    },
    {
      name: "Opera, which claims to be Chrome as well",
      ua:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/139.0.0.0 Safari/537.36 OPR/113.0.0.0",
      browser: "Opera",
      platform: "Windows",
    },
    {
      name: "Chrome on an iPad, which reports CriOS rather than Chrome",
      ua:
        "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 " +
        "(KHTML, like Gecko) CriOS/126.0.0.0 Mobile/15E148 Safari/604.1",
      browser: "Chrome",
      platform: "iPad",
    },
  ];

  for (const { name, ua, browser, platform } of cases) {
    it(`reads ${name}`, () => {
      expect(readDevice(ua)).toEqual({ browser, platform });
    });
  }

  /**
   * **The cases that must degrade rather than guess.** Each of these is a real
   * state — a session opened by a scripted client, a stripped header, a browser
   * released after this table was written — and in every one the surface says
   * one honest sentence instead of naming something it does not know.
   */
  describe("says nothing rather than guessing", () => {
    it("returns nothing at all for a session that sent no User-Agent", () => {
      expect(readDevice(null)).toEqual({ browser: null, platform: null });
    });

    it("returns nothing for a string it cannot read", () => {
      expect(readDevice("curl/8.7.1")).toEqual({ browser: null, platform: null });
    });

    it("names the half it knows when the other half is unfamiliar", () => {
      const ua =
        "Mozilla/5.0 (X11; FreeBSD amd64) AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/139.0.0.0 Safari/537.36";
      expect(readDevice(ua)).toEqual({ browser: "Chrome", platform: null });
    });

    /**
     * A `User-Agent` is attacker-controlled on a request she made, so it reaches
     * a page she reads. React escapes it, but the resolver must not be the thing
     * that widens it — it returns values from its **own table**, never a slice
     * of the input.
     */
    it("never echoes the input back, whatever the input contains", () => {
      const hostile = "<img src=x onerror=alert(1)> Chrome/139.0.0.0 (Windows NT 10.0)";
      const { browser, platform } = readDevice(hostile);
      expect(browser).toBe("Chrome");
      expect(platform).toBe("Windows");
      expect(JSON.stringify({ browser, platform })).not.toContain("onerror");
    });
  });
});
