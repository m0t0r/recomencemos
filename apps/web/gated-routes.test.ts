/**
 * NFR8 as a table over the route list, which is the shape the requirement asks
 * for in as many words: _"asserted by a table-driven test over the route list
 * rather than a per-page attribute"_.
 *
 * **This belongs in `web:test` and not at seam 3.** `CLAUDE.md` names "table-driven
 * assertions over a route list" as one of the three things that live here, and
 * the reason holds: the question is whether the *configuration* covers every
 * route NFR8 names, and a running server can only answer it for routes that
 * exist. Five of the six do not exist yet, and those are exactly the ones a
 * regression would silently drop.
 *
 * The `<meta>` half is a per-page `metadata.robots` export and is verified
 * running, against the one page that exists.
 */

import nextConfig from "./next.config";
import { GATED_ROUTE_PREFIXES, NOINDEX_HEADER, gatedRouteSources } from "./lib/gated-routes";

/** What `next.config.ts` actually hands Next, resolved once. */
async function configuredHeaders() {
  const headers = await nextConfig.headers?.();
  expect(headers, "next.config.ts declares no headers()").toBeDefined();
  return headers ?? [];
}

describe("NFR8 — every gated route carries X-Robots-Tag", () => {
  for (const source of gatedRouteSources()) {
    it(`configures ${source}`, async () => {
      const entry = (await configuredHeaders()).find((rule) => rule.source === source);

      expect(entry, `no headers() rule for ${source}`).toBeDefined();
      expect(entry?.headers).toContainEqual({ ...NOINDEX_HEADER });
    });
  }

  /**
   * **The index route of each prefix is the case a single pattern loses.**
   * Next's `:path*` is zero-or-more but the pattern carries a separating slash,
   * so `/account/:path*` does not match a bare `/account` — and a bare
   * `/account` is the page. This asserts both forms are present rather than
   * trusting the helper that generates them.
   */
  it.each(GATED_ROUTE_PREFIXES)("covers %s itself, not only its children", async (prefix) => {
    const sources = (await configuredHeaders()).map((rule) => rule.source);

    expect(sources).toContain(prefix);
    expect(sources).toContain(`${prefix}/:path*`);
  });

  it("names every route NFR8 lists and nothing else", async () => {
    // Verbatim from the requirement, retyped rather than imported, so a change
    // to the source list fails here instead of silently agreeing with itself.
    expect(GATED_ROUTE_PREFIXES.toSorted()).toEqual([
      "/account",
      "/admin",
      "/my-profile",
      "/offers",
      "/profile",
      "/sent-offers",
    ]);
  });

  /**
   * `/sign-in` is deliberately absent. It sets `metadata.robots` for its own
   * reasons (#12) and NFR8's list never named it — asserted so that "add it
   * while you are there" is a decision someone has to take on purpose.
   */
  it("does not silently extend to /sign-in", async () => {
    const sources = (await configuredHeaders()).map((rule) => rule.source);
    expect(sources).not.toContain("/sign-in");
  });
});
