/**
 * What a key looks like — the prefixes, and the two predicates that recognise
 * them.
 *
 * **A leaf split out of `#keys`, and the split is load-bearing rather than
 * tidiness.** `#keys` imports `nanoid` because it mints; `#photo-url` is
 * resolved into a *browser* bundle by `next/image`'s custom loader and needs
 * only to recognise. Left in one module, the loader would drag a key-minting
 * dependency into the client graph to run one regular expression — and the
 * alternative that was written first, a second spelling of the pattern inside
 * `#photo-url`, is the drift this repository refuses everywhere else it counts a
 * closed set once.
 *
 * Imports nothing. Reads no environment. Both of its consumers can be anywhere.
 */

/**
 * The prefix nothing may read.
 *
 * **NFR6 is a statement about this prefix's bucket policy, not about our
 * routing.** _"**0** unmoderated photo **objects** are retrievable by an
 * unauthenticated request"_ — which is true because the bucket refuses, and
 * would be false the moment it were true only because no page links there.
 */
export const QUARANTINE_PREFIX = "quarantine";

/** The prefix the transformation URL reads from. Public by bucket policy. */
export const PUBLIC_PREFIX = "photos";

/**
 * The random part of a key, in characters.
 *
 * Twenty-one is `nanoid`'s own default and is ~126 bits over its 64-character
 * alphabet. The bound that matters is not collision but **guessing**: a
 * quarantined object is refused by policy, and a public one is a photo its owner
 * published, so the length is here to make enumeration pointless rather than to
 * be the thing standing between a stranger and an unreviewed face.
 */
export const KEY_LENGTH = 21;

/** What the re-encode always produces, and therefore the only suffix a public key has. */
export const PUBLIC_SUFFIX = ".webp";

/**
 * The two shapes, as one spelling each, built from the constants above so that a
 * prefix and the pattern enforcing it cannot drift. The failure that would
 * produce is a key minted under one prefix and validated against another, which
 * reads as an unreachable photo rather than as a bug.
 */
export const QUARANTINE_KEY = new RegExp(`^${QUARANTINE_PREFIX}/([A-Za-z0-9_-]{${KEY_LENGTH}})$`);
export const PUBLIC_KEY = new RegExp(
  `^${PUBLIC_PREFIX}/([A-Za-z0-9_-]{${KEY_LENGTH}})\\${PUBLIC_SUFFIX}$`,
);

/**
 * Whether the pattern matched the **whole** string.
 *
 * `$` in JavaScript matches *before* a trailing newline, so `"quarantine/<21>\n"`
 * satisfies `/^…$/` and would otherwise be concatenated into a request with the
 * newline still on it. There is no `\z` in this dialect; comparing the whole
 * match against the whole input is the equivalent that exists, and it is why
 * neither predicate below is a bare `.test()`.
 */
export function wholeMatch(pattern: RegExp, key: string): string | null {
  const match = pattern.exec(key);

  return match && match[0] === key ? (match[1] as string) : null;
}

/** Whether a string is a key the quarantine minter could have produced. */
export function isQuarantineKey(key: string): boolean {
  return wholeMatch(QUARANTINE_KEY, key) !== null;
}

/** Whether a string is a key the public derivation could have produced. */
export function isPublicKey(key: string): boolean {
  return wholeMatch(PUBLIC_KEY, key) !== null;
}
