/**
 * NFR8's route list, and the header every one of them must carry.
 *
 * **`/account` is the first route on this list that exists**, which is why the
 * mechanism lands with story 12 rather than with the story that wrote the
 * requirement. `/sign-in` is *not* on it — that surface sets
 * `metadata.robots` for its own reasons (#12) and NFR8 never named it.
 *
 * **`/continue` is the second such route, and it is here in a comment rather
 * than in the list for the same reason** (#125). It is the Admin door's second
 * step, and it is not under `/admin`: the redirect that lands a browser there is
 * received by whatever consumed the emailed link — a corporate scanner, a
 * WhatsApp preview, Outlook Safe Links — so a path naming the admin surface
 * would make a granted address distinguishable in a gateway's logs. Adding it
 * below would be adding a row NFR8 did not write, and the header it would buy is
 * one nothing needs: **a request to `/continue` with no live challenge is a
 * `404`**, so there is no document for a crawler to hold in the first place. The
 * page carries `metadata.robots` for the case where there is one.
 *
 * **NFR8 asks for both halves and for one particular shape of test:** the header
 * *and* a `<meta name="robots">` equivalent, "asserted by a table-driven test
 * over the route list rather than a per-page attribute". So the list is data
 * here, `next.config.ts` turns it into `headers()`, each page keeps its own
 * `metadata.robots`, and `gated-routes.test.ts` drives the table.
 *
 * **The header is configured for all six patterns now, including the five whose
 * routes do not exist yet.** A pattern matching nothing costs nothing — Next
 * still 404s — and the alternative is that the next surface to land is
 * unprotected until somebody remembers this file. Rows are removed only if NFR8
 * changes, never because a route is "not built yet".
 */

/** Verbatim from NFR8. English identifiers, per ADR-0012 — the URL is not UI copy. */
export const GATED_ROUTE_PREFIXES = [
  "/profile",
  "/offers",
  "/my-profile",
  "/sent-offers",
  "/account",
  "/admin",
] as const;

export const NOINDEX_HEADER = { key: "X-Robots-Tag", value: "noindex, nofollow" } as const;

/**
 * Each prefix as the two `source` patterns Next needs to cover it.
 *
 * **Two, not one, and this is the part that is easy to get wrong.** Next's
 * `:path*` segment is zero-or-more, but the pattern is written with a separating
 * slash — so `/account/:path*` matches `/account/security` and does **not**
 * match a bare `/account`. A single-pattern version of this file would leave
 * every index route in the list indexable, which is precisely the set of pages
 * NFR8 is about.
 */
export function gatedRouteSources(): readonly string[] {
  return GATED_ROUTE_PREFIXES.flatMap((prefix) => [prefix, `${prefix}/:path*`]);
}

/** What `next.config.ts` assigns to `headers()`. */
export function gatedRouteHeaders() {
  return gatedRouteSources().map((source) => ({
    source,
    headers: [{ ...NOINDEX_HEADER }],
  }));
}
