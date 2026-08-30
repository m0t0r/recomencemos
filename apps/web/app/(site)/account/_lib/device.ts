/**
 * Which browser and which kind of machine a session was opened from.
 *
 * **It returns values from its own table and never a slice of the input**, which
 * is the property that matters here: a `User-Agent` is attacker-controlled on a
 * request she made, and it reaches a page she reads. React escapes it either
 * way, but a resolver that echoed part of the header back would make the label
 * a second place to get that wrong. Everything below returns a constant.
 *
 * **Order is the whole algorithm.** Edge, Opera and Samsung Internet all carry
 * `Chrome/` in their strings and Chrome carries `Safari/`, so the first match
 * wins and the list is sorted most-specific first. `device.test.ts` pins each of
 * those three against real strings, because that is the case a naive `includes`
 * gets wrong.
 */

export interface DeviceIdentity {
  /** A name from the table below, or `null` where nothing matched. Never a guess. */
  readonly browser: string | null;
  readonly platform: string | null;
}

/** Most specific first — see the note above. */
const BROWSERS: readonly (readonly [token: string, name: string])[] = [
  ["Edg/", "Edge"],
  ["OPR/", "Opera"],
  ["SamsungBrowser/", "Samsung Internet"],
  ["Firefox/", "Firefox"],
  // Chrome on iOS reports `CriOS`, which carries no `Chrome/` token at all.
  ["CriOS/", "Chrome"],
  ["Chrome/", "Chrome"],
  ["Safari/", "Safari"],
];

/** `iPad` before `Macintosh`: an iPad's string mentions `Mac OS X`. */
const PLATFORMS: readonly (readonly [token: string, name: string])[] = [
  ["Android", "Android"],
  ["iPhone", "iPhone"],
  ["iPad", "iPad"],
  ["Windows", "Windows"],
  ["CrOS", "ChromeOS"],
  ["Macintosh", "Mac"],
];

function firstMatch(
  haystack: string,
  table: readonly (readonly [string, string])[],
): string | null {
  for (const [token, name] of table) {
    if (haystack.includes(token)) return name;
  }
  return null;
}

/**
 * Read a stored `User-Agent`.
 *
 * `null` in either field means "we do not know", and the surface has one honest
 * sentence for that rather than a placeholder that looks like a device name.
 */
export function readDevice(userAgent: string | null): DeviceIdentity {
  if (!userAgent) return { browser: null, platform: null };

  return {
    browser: firstMatch(userAgent, BROWSERS),
    platform: firstMatch(userAgent, PLATFORMS),
  };
}
