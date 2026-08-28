/**
 * Who NFR26's per-IP half is charged against.
 *
 * **A module of its own so it can be tested.** It lived inside the action
 * client, which carries `import "server-only"` and so cannot be imported from a
 * Vitest file at all — leaving the one function on this path whose logic is
 * genuinely non-obvious as the one function with no test. It needs no marker of
 * its own: it is a pure function over a `Headers`, it reads no environment and
 * holds no credential, and nothing here is unsafe in a browser.
 *
 * **`Fly-Client-IP` first**, because it is set by Fly's proxy to the address it
 * actually observed, is always a single value, and cannot be chosen by the
 * caller — the same reason `#auth/config` puts it first for Better Auth's own
 * limiter, so the two resolvers agree on who a request is.
 *
 * The `x-forwarded-for` fallback reads the **last entry, not the first**: that
 * header is a list each proxy *appends* to, so the leftmost entry is whatever
 * the original caller sent, and charging it would make the ≤ 20/hour bound
 * defeatable by putting a fresh value in a header. With one trusted proxy in
 * front, the rightmost entry is the only one nobody downstream can choose.
 *
 * **An absent header charges a shared bucket rather than skipping the charge.**
 * NFR26 says the counter *fails closed*, and returning "no principal" here used
 * to mean the per-IP ceiling silently did not apply — so stripping the header
 * removed the bound entirely. Every header-less caller now shares one counter:
 * bounded together, which is the closed answer, and harmless in development
 * where there is no proxy and one person.
 */

export const NO_PROXY_PRINCIPAL = "no-forwarded-for";

export function clientIp(requestHeaders: Headers): string {
  const flyClientIp = requestHeaders.get("fly-client-ip")?.trim();
  if (flyClientIp) return flyClientIp;

  const forwarded = requestHeaders.get("x-forwarded-for");
  if (!forwarded) return NO_PROXY_PRINCIPAL;

  const hops = forwarded
    .split(",")
    .map((hop) => hop.trim())
    .filter(Boolean);

  return hops.at(-1) ?? NO_PROXY_PRINCIPAL;
}
