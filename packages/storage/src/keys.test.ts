import {
  isPublicKey,
  isQuarantineKey,
  mintPublicKey,
  mintQuarantineKey,
  PUBLIC_PREFIX,
  QUARANTINE_PREFIX,
  randomPartOf,
} from "#keys";

describe("mintQuarantineKey", () => {
  it("puts every key under the prefix nothing may read", () => {
    for (let i = 0; i < 50; i++) {
      expect(mintQuarantineKey().startsWith(`${QUARANTINE_PREFIX}/`)).toBe(true);
    }
  });

  it("does not repeat itself", () => {
    const minted = new Set(Array.from({ length: 500 }, mintQuarantineKey));

    expect(minted.size).toBe(500);
  });

  /**
   * The requirement DD6 states as a sentence: the client's filename never
   * reaches the key. There is no parameter to pass one through, so this asserts
   * the observable half — nothing a caller holds can steer where the object
   * lands.
   */
  it("takes no input at all, so nothing a caller holds can steer the key", () => {
    expect(mintQuarantineKey).toHaveLength(0);
  });
});

describe("randomPartOf", () => {
  it("reads back the random part of a key it minted", () => {
    const key = mintQuarantineKey();

    expect(key).toBe(`${QUARANTINE_PREFIX}/${randomPartOf(key)}`);
  });

  /**
   * Each of these is a way a key that came out of a column could become part of
   * a request, and each has to be refused before it is concatenated rather than
   * after. The traversal cases are the reason this function validates instead of
   * splitting on a slash.
   */
  it.each([
    ["a traversal out of the prefix", "quarantine/../photos/aaaaaaaaaaaaaaaaaaaaa"],
    ["a traversal inside the random part", "quarantine/..%2Faaaaaaaaaaaaaaaa"],
    ["a nested path", "quarantine/a/aaaaaaaaaaaaaaaaaaaa"],
    ["the public prefix", "photos/aaaaaaaaaaaaaaaaaaaaa"],
    ["no prefix at all", "aaaaaaaaaaaaaaaaaaaaa"],
    ["a prefix that merely starts the same", "quarantined/aaaaaaaaaaaaaaaaaaaaa"],
    ["one character short", "quarantine/aaaaaaaaaaaaaaaaaaaa"],
    ["one character long", "quarantine/aaaaaaaaaaaaaaaaaaaaaa"],
    ["a character outside the alphabet", "quarantine/aaaaaaaaaaaaaaaaaaaa."],
    ["a trailing newline, which anchors alone would admit", "quarantine/aaaaaaaaaaaaaaaaaaaaa\n"],
    ["empty", ""],
  ])("refuses %s", (_case, key) => {
    expect(() => randomPartOf(key)).toThrow(/did not mint/);
  });
});

describe("mintPublicKey", () => {
  it("puts every key under the prefix that is publicly readable", () => {
    for (let i = 0; i < 50; i++) {
      expect(mintPublicKey().startsWith(`${PUBLIC_PREFIX}/`)).toBe(true);
    }
  });

  it("does not repeat itself", () => {
    expect(new Set(Array.from({ length: 500 }, mintPublicKey)).size).toBe(500);
  });

  /**
   * **The security property this function exists for.** It used to derive the
   * public key from the quarantine one — same random part, different prefix — so
   * every approved photo's `src` on the Wall was an oracle for its own private
   * key: read it out of the DOM, swap the prefix, and you hold the quarantine
   * key. `/security-review` traced that into a cross-account exploit.
   *
   * Asserted as "shares no random part with any quarantine key", which is the
   * property, rather than as "takes no argument", which is the implementation.
   */
  it("shares no random part with the quarantine keys minted beside it", () => {
    const quarantineRandoms = new Set(
      Array.from({ length: 200 }, () => randomPartOf(mintQuarantineKey())),
    );

    for (let i = 0; i < 200; i++) {
      const random = mintPublicKey().slice(`${PUBLIC_PREFIX}/`.length, -".webp".length);

      expect(quarantineRandoms.has(random)).toBe(false);
    }
  });

  it("never mints a key that sits under the quarantine prefix", () => {
    expect(mintPublicKey().startsWith(`${QUARANTINE_PREFIX}/`)).toBe(false);
  });
});

describe("the two shape predicates", () => {
  it("recognise what this module mints, and each other's keys as not their own", () => {
    const quarantine = mintQuarantineKey();
    const published = mintPublicKey();

    expect(isQuarantineKey(quarantine)).toBe(true);
    expect(isPublicKey(published)).toBe(true);
    expect(isPublicKey(quarantine)).toBe(false);
    expect(isQuarantineKey(published)).toBe(false);
  });

  it.each([
    "quarantine/aaaaaaaaaaaaaaaaaaaaa\nphotos/bbbbbbbbbbbbbbbbbbbbb.webp",
    "photos/aaaaaaaaaaaaaaaaaaaaa.webp\n",
  ])("refuse a trailing newline (%s)", (key) => {
    expect(isQuarantineKey(key)).toBe(false);
    expect(isPublicKey(key)).toBe(false);
  });
});
