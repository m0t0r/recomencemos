/**
 * Where a sign-in is allowed to land afterwards.
 *
 * The API contract fixes the rule: `returnPath` must be a **single-leading-slash
 * relative path**, and `//host` and `/\host` are rejected. Both of those are
 * absolute URLs that a person reads as relative — `//evil.co` is
 * scheme-relative, and a backslash is treated as a slash by every browser's URL
 * parser even though the standard does not require it — so an open redirect
 * built from an unvalidated `returnPath` would send a Worker who just signed in
 * to somebody else's page.
 *
 * **This is a different guard from Better Auth's `trustedOrigins`**, and both are
 * needed. `trustedOrigins` validates `callbackURL`, `redirectTo` and friends
 * against the origins we configured; this validates *our* post-sign-in redirect
 * before it ever becomes one. DD5 says so explicitly, because the two look like
 * the same check and guard different hops.
 */

/** Where a sign-in lands when she did not come from anywhere in particular. */
export const DEFAULT_RETURN_PATH = "/";

/**
 * Reduce a caller-supplied return path to one this product will actually
 * redirect to, or to {@link DEFAULT_RETURN_PATH}.
 *
 * **A whitelist of shape rather than a blocklist of attacks.** Enumerating
 * `//`, `/\`, `https:` and the rest means the next spelling somebody finds
 * passes by default — and there are more spellings than anyone remembers,
 * because browsers normalise backslashes, tabs and newlines inside URLs. So the
 * rule is stated positively: one leading slash, not a second slash or a
 * backslash after it, and no control characters anywhere.
 */
export function safeReturnPath(candidate: string | null | undefined): string {
  if (typeof candidate !== "string") return DEFAULT_RETURN_PATH;

  const path = candidate.trim();

  // One leading slash, and exactly one. `//host` and `/\host` are absolute.
  if (!path.startsWith("/")) return DEFAULT_RETURN_PATH;
  if (path.startsWith("//") || path.startsWith("/\\")) return DEFAULT_RETURN_PATH;

  // A tab, newline or NUL inside a URL is stripped by browsers before parsing,
  // so `/\t/evil.co` reaches the network as `//evil.co`. Refuse them all rather
  // than reproduce each browser's stripping rules.
  // oxlint-disable-next-line no-control-regex -- the control characters are the point.
  if (/[\u0000-\u001f\u007f]/.test(path)) return DEFAULT_RETURN_PATH;

  return path;
}
