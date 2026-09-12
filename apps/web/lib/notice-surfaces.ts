/**
 * Which surfaces carry the standing notices, as data.
 *
 * **This exists because story 11's first acceptance criterion asks for a
 * mechanism rather than a habit** — the notices go on the surfaces named below
 * "and surfaces built afterwards carry them by construction". A list of routes
 * somebody edited once is not that; a list plus a test that fails when a page
 * appears on neither side of it is.
 *
 * `lib/gated-routes.ts` is the prior art and it was written for the same shape of
 * problem, with the same reasoning: _"the alternative is that the next surface to
 * land is unprotected until somebody remembers this file."_ Two differences.
 * That one's list is consumed at runtime by `next.config.ts`; this one is
 * consumed only by `notice-surfaces.test.ts`, because there is no configuration
 * to generate — a page renders a component or it does not. And this one carries
 * an **exemption** list as well as a requirement list, which is the half that
 * makes it a gate: a new `page.tsx` matching neither turns the suite red, so the
 * decision is taken rather than defaulted.
 *
 * **Routes that do not exist yet are listed anyway.** A prefix matching nothing
 * costs nothing, and the alternative is that the surface which lands next is the
 * one nobody remembers. `/profile`, `/offers` and `/sent-offers` are all in the
 * spec and none of them is built; `/profile/[slug]` is in flight as this lands.
 *
 * English identifiers throughout, per ADR-0012 — a URL is not UI copy.
 */

/**
 * The route prefixes whose pages must render `StandingNotices`.
 *
 * The rule behind the list, so a later reader can extend it rather than guess at
 * it: **a surface where a person meets another person, or decides what to give
 * one.** ADR-0008 states it as _"standing safety guidance sits on every profile
 * and every Offer"_, and the two public lists are where somebody first meets
 * anybody at all.
 *
 * `/my-profile` is on it and that is a judgement rather than a reading of the
 * spec. It is a profile surface by any plain reading of the criterion, it is
 * already an honest account of who sees what, and it is where a Worker is most
 * likely to be deciding whether she is safe — which is the question all three
 * statements answer.
 */
export const NOTICE_ROUTE_PREFIXES = [
  "/",
  "/profiles",
  "/profile",
  "/my-profile",
  "/offers",
  "/sent-offers",
] as const;

/**
 * Why a route is exempt, in one line, because an exemption with no reason is an
 * omission somebody will copy.
 */
export interface NoticeExemption {
  readonly route: string;
  readonly reason: string;
}

/**
 * The pages that deliberately do not carry the notices.
 *
 * **Every one of these is a decision, and the test is what forces the next one to
 * be taken.** Three groups, and the grouping is the argument:
 *
 * - **`/admin` and its door.** An operator working a queue is not deciding
 *   whether to trust a stranger, and `voice.md`'s tone matrix drops warmth to 2
 *   and raises density on those surfaces for exactly that reason. The notices
 *   there would be furniture.
 * - **The forms and the doors.** `/publish`, `/my-profile/edit`, `/sign-in`,
 *   `/continue`. A person mid-task is the one reader the notices should not
 *   interrupt — and `/publish` in particular already carries the contact-detail
 *   rejector and the consent text, which say the specific version of the same
 *   thing at the moment it applies.
 * - **`/privacy`.** A different document with a different owner, saying more and
 *   in the register Ley 1581 requires. Two statements of the same fact in two
 *   registers on one page is the second source this component exists to prevent.
 */
export const NOTICE_EXEMPT_ROUTES: readonly NoticeExemption[] = [
  { route: "/account", reason: "settings, not a surface where anybody meets anybody" },
  { route: "/admin", reason: "an operator's queue; the tone matrix drops warmth here" },
  { route: "/admin/sessions", reason: "the queue's one tool, under the same shell" },
  { route: "/admin/enrol/[token]", reason: "a token-reached door with no session yet" },
  { route: "/continue", reason: "the Admin door's second step" },
  { route: "/my-profile/edit", reason: "a form; a person mid-task is not deciding whom to trust" },
  { route: "/privacy", reason: "the same facts at length, in the register the statute requires" },
  { route: "/publish", reason: "a form, and it already says the applicable half where it applies" },
  { route: "/sign-in", reason: "a door; nothing has been decided or disclosed yet" },
];

/**
 * Whether a route sits under one of the prefixes above, before exemptions are
 * applied.
 *
 * **`/` is the one prefix that must not behave like one.** Every route begins
 * with it, so a bare `startsWith` would mark the whole application required and
 * make the exemption list unreachable — a gate that passes by demanding the
 * impossible everywhere, which reads exactly like a gate that works.
 */
function underNoticePrefix(route: string): boolean {
  return NOTICE_ROUTE_PREFIXES.some(
    (prefix) => route === prefix || (prefix !== "/" && route.startsWith(`${prefix}/`)),
  );
}

/** Whether a route has been deliberately excused. */
export function noticesExemptOn(route: string): boolean {
  return NOTICE_EXEMPT_ROUTES.some((exemption) => exemption.route === route);
}

/**
 * Whether a route's page must render the notices.
 *
 * **An exemption wins over a prefix, and the ordering is the design.** The
 * prefixes are deliberately coarse so that a route added under one — `/offers/2`,
 * `/profile/[slug]` — is required by default rather than by somebody noticing.
 * That default is only safe if there is a way to say no, and `NOTICE_EXEMPT_ROUTES`
 * is it: `/my-profile/edit` is a form sitting under a profile prefix, and a person
 * mid-task is the one reader these three statements should not interrupt.
 *
 * The escape is not a hole, because it is visible from three sides: the exemption
 * carries a written reason, `notice-surfaces.test.ts` pins the set of exemptions
 * that override a prefix so a second one cannot be added quietly, and the diff
 * that adds one is a diff a reviewer reads.
 */
export function noticesRequiredOn(route: string): boolean {
  return underNoticePrefix(route) && !noticesExemptOn(route);
}

/**
 * The exemptions that sit **inside** a required prefix, rather than simply
 * outside every one of them.
 *
 * These are the carve-outs — the only entries where saying "exempt" actually
 * takes something away. Pinning the set is what stops the list above from being
 * widened one quiet line at a time.
 */
export function noticeCarveOuts(): readonly string[] {
  return NOTICE_EXEMPT_ROUTES.filter((exemption) => underNoticePrefix(exemption.route))
    .map((exemption) => exemption.route)
    .toSorted();
}
