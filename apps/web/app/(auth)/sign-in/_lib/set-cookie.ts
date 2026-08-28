/**
 * One `Set-Cookie` line, as the object Next's `cookies().set()` takes.
 *
 * **This exists because a Server Action cannot pass a `Set-Cookie` header
 * through.** Better Auth writes its OAuth `state` cookie onto the response of a
 * call `startGoogleSignIn` makes internally; the only way to get it onto *our*
 * response is `next/headers`' cookie store, which takes a name, a value and
 * options rather than a serialised line. So the line has to be taken apart and
 * put back together, and that is the whole job here.
 *
 * It is a module of its own rather than a loop inside the action for one
 * reason: **the action cannot be tested and this can.** The Google door needs
 * credentials no development machine has, so the seam-3 run that verifies the
 * email door end to end reaches none of this. Extracted, it is a pure function
 * over a string and every property below is a test.
 *
 * **It deliberately carries no `import "server-only"`**, and the first draft's
 * did — which made it unimportable from Vitest and undid the entire reason for
 * extracting it. ADR-0013's table is the check: mechanism 2 is for a module that
 * is Next-only, and this one is a pure function over a string that reads no
 * environment, opens no connection and holds no credential. Nothing here is
 * unsafe in a browser; it simply has no reason to be there.
 */

import type { ResponseCookie } from "@edge-runtime/cookies";

/**
 * **`@edge-runtime/cookies` ships its own `parseSetCookie`, and this module
 * deliberately does not use it.** That is worth writing down, because the
 * duplication is the first thing a reader notices and the reason not to is not
 * visible from the type import above.
 *
 * It is the same package Next vendors at
 * `next/dist/compiled/@edge-runtime/cookies`, at the same version — so the type
 * is taken from the public one rather than reaching into `dist/compiled`, and
 * the function is not. Measured against every case in `set-cookie.test.ts`, the
 * library's parser differs on six, and one of them is a crash on this path:
 *
 * | line | library | here |
 * | --- | --- | --- |
 * | `a=%E0%A4%A` | **throws** | value passed through |
 * | `novalue` | `{ name: "novalue", value: "true" }` | `undefined` |
 * | `=orphaned` | `{ value: "orphaned" }`, no name | `undefined` |
 * | `; Path=/` | `{ name: "Path", value: "/" }` | `undefined` |
 * | `Expires=not-a-date` | `expires: null` | omitted |
 * | no `Path` / `SameSite` | omitted | `/` and `lax` |
 *
 * The first row is the one that decides it. A malformed escape anywhere in a
 * `Set-Cookie` Better Auth writes would throw out of the action, and this door
 * has no test that could see it — which is the same shape of failure the module
 * was extracted to fix. The rest are a parser that answers where it should
 * refuse, and an object with no `name` reaching `cookies().set()` is not a
 * failure this surface should discover in production.
 */

/**
 * **The value is decoded, and that is not tidying — it is the bug this module
 * was extracted to fix.**
 *
 * `better-call` percent-encodes a signed cookie value before it writes the line
 * (`crypto.mjs:29`, `value = encodeURIComponent(value)`), and Next percent-
 * encodes again on the way out (`@edge-runtime/cookies/index.js:45`,
 * `encodeURIComponent(c.value)`). Lifting the already-encoded substring out of
 * the line and handing it straight to `cookies().set()` therefore encodes it
 * twice, and the browser sends back something the server decodes only once.
 *
 * A signed cookie's signature is base64 of an HMAC-SHA256, so it is 44
 * characters and always ends in `=`. Double-encoded it comes back 50 characters
 * ending in `%3D`, `getSignedCookie` refuses anything that is not 44-ending-in-
 * `=`, and `parseGenericState` then throws `state_security_mismatch`
 * (`better-auth@1.7.1/dist/state.mjs`) because `skipStateCookieCheck` defaults
 * to `false`. **Every Google sign-in would have failed**, landing on
 * `/sign-in?error=…` instead of a session.
 *
 * It failed *closed*, which is why it was a correctness bug and not a
 * vulnerability — but it was a total one, and neither `check-types` nor the
 * suite could see it. `set-cookie.test.ts` pins the round trip.
 */
export function parseSetCookie(line: string): ResponseCookie | undefined {
  const [pair] = line.split(";");
  if (!pair) return undefined;

  const separator = pair.indexOf("=");
  // A name is required and may not be empty, so `=` at index 0 is not a cookie.
  if (separator < 1) return undefined;

  const name = pair.slice(0, separator).trim();
  if (!name) return undefined;

  return {
    name,
    // Decoded here so Next's own encoding restores exactly what was written.
    value: decodeCookieValue(pair.slice(separator + 1)),
    httpOnly: /;\s*httponly/i.test(line),
    secure: /;\s*secure/i.test(line),
    sameSite: sameSiteOf(line),
    path: attribute(line, "path") ?? "/",
    ...maxAgeOf(line),
    ...expiresOf(line),
  };
}

/**
 * A malformed escape makes `decodeURIComponent` throw, and a cookie we cannot
 * decode is one we must not silently mangle — passing the raw text through is
 * the reading that preserves whatever the writer meant, since the alternative
 * is dropping the cookie and failing the flow for a different reason.
 */
function decodeCookieValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function attribute(line: string, name: string): string | undefined {
  return new RegExp(`;\\s*${name}=([^;]*)`, "i").exec(line)?.[1]?.trim();
}

function sameSiteOf(line: string): ResponseCookie["sameSite"] {
  const value = attribute(line, "samesite")?.toLowerCase();

  // `lax` is the default rather than a guess: it is what Better Auth sets on
  // both cookies this path carries, and it is what a browser applies to a
  // cookie that declares no `SameSite` at all.
  if (value === "strict" || value === "none") return value;
  return "lax";
}

function maxAgeOf(line: string): { maxAge?: number } {
  const value = attribute(line, "max-age");
  if (value === undefined) return {};

  const maxAge = Number(value);
  return Number.isFinite(maxAge) ? { maxAge } : {};
}

/**
 * **`Expires` is carried even though both cookies on this path also send
 * `Max-Age`.** A cookie is not ours and its attributes are not ours to choose:
 * dropping one because today's writer happens to send a second is how a change
 * in the library silently becomes a session cookie where a persistent one was
 * meant. `Max-Age` wins in the browser where both are present, so carrying both
 * changes nothing today and stays correct if that stops being true.
 */
function expiresOf(line: string): { expires?: Date } {
  const value = attribute(line, "expires");
  if (value === undefined) return {};

  const expires = new Date(value);
  return Number.isNaN(expires.getTime()) ? {} : { expires };
}
