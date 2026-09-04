/**
 * The Admin door's middle step: what exists between opening the link and typing
 * the code.
 *
 * **The link mints no session** (DD5). Opening it proves the mailbox and nothing
 * else, so what it leaves behind has to be enough to ask for the second factor
 * and not enough to be one. That is this value: an Account id, an expiry, and a
 * signature over both.
 *
 * **It carries the Account id and nothing else**, which is the requirement
 * stated as a shape. No address, no email, no grant state, no session token —
 * a browser holding this holds a claim about *which* Account is halfway through
 * a sign-in, and no capability at all until six digits are added to it.
 *
 * **Signed rather than stored, and that is the one design decision here.** A
 * random opaque token in a table would work and would cost a row, an index, a
 * sweep and a second thing to keep in step with the link's own row — for a value
 * whose whole life is the ten minutes between one click and one code. The
 * signature buys the same guarantee from arithmetic: only `BETTER_AUTH_SECRET`
 * can produce one, and the same secret already encrypts the TOTP secret this
 * challenge leads to, so nothing new becomes load-bearing.
 *
 * **What a signed value cannot do is be revoked**, and that is why the window is
 * ten minutes rather than the link's fifteen. It is stated here rather than left
 * implicit because it is the honest cost: a challenge captured in flight is good
 * until it expires, and nothing this module offers can shorten that — **including
 * a successful sign-in**. The endpoint clears the cookie afterwards, which asks
 * one browser to stop sending the value; it does not stop the value working. A
 * reader who needs "used once" to be enforced rather than requested needs a
 * stored nonce, and that is a different design from this one.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Where a granted Account is sent once its link is spent.
 *
 * **It names no admin surface, and the second draft is why.** It was
 * `/admin/continue`, on the argument that `/admin` would then appear only in a
 * `Location` header on a request the Admin herself had just made — and that
 * argument is wrong about who makes the request. This product's own code says
 * so: the magic link's `errorCallbackURL` exists because a `GET` verify URL is
 * fetched by _"corporate link scanners, WhatsApp previews and Outlook Safe
 * Links"_. Those clients consume the token, so they receive this redirect and
 * this challenge cookie, and a granted address became distinguishable from every
 * other in a gateway's logs.
 *
 * That is the same disclosure that moved the first factor onto the ordinary
 * magic link — the emailed URL no longer names the admin surface — arriving one
 * hop later. A neutral path costs nothing and closes it: an intermediary now
 * sees a redirect to a route that tells it nothing.
 *
 * It lives beside the cookie rather than beside the queries because the two
 * always travel on one response, and the module that decides one should decide
 * the other.
 */
export const SECOND_FACTOR_ROUTE = "/continue";

/**
 * Where the challenge rides. **Named for what it is and not for who it lets
 * in** — a cookie called `admin_challenge` in a devtools panel is a sign saying
 * which door this browser is halfway through, on a product whose whole Admin
 * design is that the door has no page to find.
 */
export const SIGN_IN_CHALLENGE_COOKIE = "recomencemos.sign_in_challenge";

/**
 * Ten minutes: long enough to unlock a phone and open an authenticator, short
 * enough that a value which cannot be revoked is not worth capturing.
 *
 * Deliberately **shorter than the link's fifteen** rather than equal to it. The
 * two windows bound different things — the link's is a mailbox round trip, this
 * one is a person already at their keyboard — and a person who takes longer than
 * this has an unspent link to click again.
 */
export const ADMIN_CHALLENGE_TTL_SECONDS = 10 * 60;

/** The separator, and the reason a value carrying one in its parts is refused. */
const SEPARATOR = ".";
const PARTS = 3;

/**
 * Mint one.
 *
 * The clock is a parameter, like every instant in this package, so seam 1 can
 * fix it and the expiry cases are arithmetic rather than waiting.
 */
export function signSignInChallenge(
  accountId: string,
  key: string,
  {
    now = new Date(),
    ttlSeconds = ADMIN_CHALLENGE_TTL_SECONDS,
  }: { readonly now?: Date; readonly ttlSeconds?: number } = {},
): string {
  const expiresAt = now.getTime() + ttlSeconds * 1000;
  const payload = `${accountId}${SEPARATOR}${expiresAt}`;

  return `${payload}${SEPARATOR}${sign(payload, key)}`;
}

/**
 * Read one back, or `null`.
 *
 * **One answer for every way of being wrong** — malformed, edited, expired,
 * signed with another key, or simply absent. The caller turns all of them into
 * the same refusal, and it can only do that honestly because there is nothing
 * richer here to leak: a return type distinguishing "expired" from "forged"
 * would be an oracle telling an attacker that their forgery was otherwise
 * well-formed.
 */
export function readSignInChallenge(
  value: string | null | undefined,
  key: string,
  now: Date = new Date(),
): string | null {
  if (!value) return null;

  const parts = value.split(SEPARATOR);
  if (parts.length !== PARTS) return null;

  const [accountId, expiresAt, signature] = parts as [string, string, string];
  if (!accountId) return null;

  /**
   * **The signature is checked before the expiry**, which is the order that
   * keeps the two indistinguishable from outside: checking the clock first would
   * answer faster for an expired challenge than for a forged one, and that
   * difference is a thing an attacker can measure.
   */
  if (!verify(`${accountId}${SEPARATOR}${expiresAt}`, signature, key)) return null;

  const deadline = Number(expiresAt);
  if (!Number.isFinite(deadline) || deadline <= now.getTime()) return null;

  return accountId;
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("hex");
}

/**
 * **Constant-time, and length-checked first** because `timingSafeEqual` throws
 * on buffers of different lengths rather than answering `false`. A signature of
 * the wrong length is refused here rather than by an exception escaping into a
 * caller that would report it as a fault on our side.
 */
function verify(payload: string, signature: string, key: string): boolean {
  const expected = Buffer.from(sign(payload, key), "utf8");
  const given = Buffer.from(signature, "utf8");

  return expected.length === given.length && timingSafeEqual(expected, given);
}

/**
 * Everything about the cookie except its value, in one object.
 *
 * **Two writers, one source, and that is a bug this closed rather than
 * symmetry.** The endpoint that clears the challenge hand-wrote these and
 * derived `secure` from a second place —
 * `ctx.context.options?.advanced?.useSecureCookies ?? true`, which is
 * `undefined ?? true` because this product's `advanced` block declares only
 * `ipAddress`. So on any origin that is not https the cookie was **set** without
 * `Secure` and **cleared** with it, browsers dropped the clear, and "the
 * challenge is spent on success" was false for the whole ten minutes.
 *
 * A cookie is deleted by matching its name, path and attributes with an expiry
 * in the past. Two places writing those attributes is two chances for that match
 * to be wrong, and it is silent in both directions.
 *
 * It stops short of `secure` and `maxAge` because those are the two a caller
 * genuinely varies — see {@link secureCookies} for the first.
 *
 * **There was a `signInChallengeCookie(value, …)` here that built the whole
 * `Set-Cookie` line, and it is deleted rather than kept for symmetry.** Both
 * writers reach the browser through `ctx.setCookie`, which appends — a header
 * built by hand had to be written with `setHeader`, which *replaces*, and doing
 * that discarded the session cookie written one line earlier. So the string
 * builder had no caller, and the five cases testing its attributes asserted a
 * string nothing emitted. The attributes are asserted on the real
 * `Set-Cookie` in `auth/admin-door.integration.test.ts` now, which is where they
 * are actually observable.
 */
export const SIGN_IN_CHALLENGE_COOKIE_ATTRIBUTES = {
  path: "/",
  httpOnly: true,
  sameSite: "lax",
} as const;

/**
 * Whether cookies on this origin carry `Secure`, from the one variable that
 * decides it.
 *
 * **Better Auth derives its own `useSecureCookies` from `baseURL` the same way**,
 * so the session cookie and the challenge agree about what kind of origin this
 * is — which they must, because they are written onto the same response.
 */
export function secureCookies(baseUrl: string | undefined): boolean {
  return (baseUrl ?? "").startsWith("https://");
}

/**
 * The same read, from the request's own headers.
 *
 * **It exists so that `apps/web` can answer "is this page a 404" without being
 * handed anything else.** The route that asks for the code has to refuse a
 * browser holding no live challenge — no message, no resend offer, no route
 * onward — and the only honest way to decide that is with the key. ADR-0010
 * withholds this module, so what crosses the boundary is a boolean built from
 * this: not the Account id, not the expiry, and not the cookie's value.
 *
 * **Splitting each pair on its first `=` is the rule, and it is not
 * incidental.** `=` terminates a cookie's name, so a scan for the name anywhere
 * in the line would let `x.recomencemos.sign_in_challenge` — a cookie any site
 * on a parent domain can set — vouch for a challenge this product never signed.
 * The name is compared whole.
 *
 * A cleared cookie arrives as `<name>=` and reads as an empty value, which
 * {@link readSignInChallenge} already answers `null` to. That is the ordinary
 * case rather than an edge: the door writes exactly that on success.
 */
export function readSignInChallengeFromHeaders(
  headers: Headers,
  key: string,
  now: Date = new Date(),
): string | null {
  const line = headers.get("cookie");
  if (!line) return null;

  for (const pair of line.split(";")) {
    const separator = pair.indexOf("=");
    if (separator === -1) continue;
    if (pair.slice(0, separator).trim() !== SIGN_IN_CHALLENGE_COOKIE) continue;

    return readSignInChallenge(pair.slice(separator + 1).trim(), key, now);
  }

  return null;
}
