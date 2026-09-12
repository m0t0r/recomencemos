/**
 * The 404, and the first one this app has had.
 *
 * **Until now every `notFound()` in the tree served Next.js's own English
 * default** — `404 / This page could not be found.` — and there are callers
 * already: `(site)/my-profile/page.tsx`, `(token)/continue/page.tsx` and
 * `(token)/admin/enrol/[token]/page.tsx`. Plus every mistyped URL, which since
 * #277 includes the five per-source Admin routes that no longer exist.
 *
 * **Those callers do not sit against C51.** That concern is about a `404` costing
 * a Sentry event — *"every `404` is a returned response, not a thrown error"* —
 * and `notFound()` is a framework interrupt of the same class as `redirect()` and
 * `forbidden()`, caught by the router before `onRequestError`. It is what
 * `lib/admin.ts` already relies on for the 403. What C51 refuses is a hand-thrown
 * `Error` used to mean "missing", and there is none in the tree.
 *
 * **Root, and one page for all three route groups, because that is what the copy
 * requires rather than what the file convention makes easy.** Three of those four
 * callers are the spec's `permission denied` cell answered as a 404 deliberately
 * — the spec's own words about the token routes are that a legible refusal *"is
 * an oracle for which tokens existed"* — so the page has to read identically to
 * a Worker who mistyped, a signed-out visitor probing `/my-profile`, and someone
 * holding a spent token. One page is the mechanism for that, not a compromise
 * with it. `_lib/boundary/boundary-copy.test.ts` holds the rule.
 *
 * **No chrome, and that follows from the same sentence.** `SiteHeader` answers
 * "am I signed in, as whom, how do I leave" and `AdminHeader` links to the queue;
 * either one above this page would tell part of its audience something the
 * refusal is arranged not to say. It is the argument `app/(token)/` was created
 * for, one level up — so this carries its own `main`, since with no group layout
 * above it nothing else does.
 *
 * **`experimental.globalNotFound` is deliberately not enabled.** Next's own
 * reference scopes it to an app with multiple root layouts or a top-level dynamic
 * segment; this app has one root layout, so the root `not-found.tsx` already
 * handles both `notFound()` and unmatched URLs, and turning the flag on would
 * cost this page the stylesheet and the fonts for nothing.
 */

import { buttonVariants } from "@repo/design-system/components/button-variants";
import { cn } from "@repo/design-system/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";
import {
  NOT_FOUND_EXPLANATION,
  NOT_FOUND_LINK,
  NOT_FOUND_ONWARD,
  NOT_FOUND_PAGE_TITLE,
  NOT_FOUND_TITLE,
} from "@/app/_lib/boundary/messages";

/**
 * **One limit, measured rather than assumed.** This title lands for an unmatched
 * URL and for a `notFound()` thrown from a route whose own metadata has not
 * resolved — which covers both token routes: `/admin/enrol/<spent>` and
 * `/continue` with no challenge each answer *No encontramos esta página* in the
 * tab as well as on the page, and those are the two the spec calls oracles,
 * because their path segment carries a credential.
 *
 * It does **not** land for `/my-profile` signed out: that route streams, its
 * metadata resolves before the segment throws, and the tab keeps reading *Tu
 * perfil*. That is a cosmetic inconsistency rather than a leak — the path is
 * fixed and public, so it discloses no secret and says nothing about whether a
 * profile exists or whose it is. Closing it would mean making that route's
 * metadata depend on the session, which is a change to the page and not to this
 * file.
 *
 * Without this export the tab reads `Recomencemos` — the root layout's title,
 * which is what a working page says. The title is the one part of this surface a person
 * sees before the page paints and the only part that survives into their history,
 * so it carries the same sentence the heading does.
 *
 * It is subject to the same rule as the copy: it names no cause, so it cannot
 * tell a prober which of the four ways here they took.
 */
export const metadata: Metadata = {
  title: NOT_FOUND_PAGE_TITLE,
};

export default function NotFound() {
  return (
    /*
      No `grow`: this renders under the root layout's bare `<body>`, and the
      `flex min-h-svh flex-col` wrapper that would give `grow` something to grow
      inside belongs to `(site)/layout.tsx` — deliberately not in this tree, since
      the page answers for all three route groups.
    */
    <main className="mx-auto flex w-full max-w-prose flex-col items-start gap-4 px-6 py-16">
      <h1 className="page-heading">{NOT_FOUND_TITLE}</h1>

      <p className="text-muted-foreground text-pretty">{NOT_FOUND_EXPLANATION}</p>
      <p className="text-pretty">{NOT_FOUND_ONWARD}</p>

      {/*
        A link and not a button: this navigates, so it works with JavaScript
        unavailable and offers the browser's own open-in-new-tab. `cn` wraps
        `buttonVariants` because that helper concatenates rather than merges —
        passing `className` through its argument object silently loses the
        conflict resolution, which cost #178's first landing a real contrast bug.
      */}
      <Link href="/" className={cn(buttonVariants(), "mt-2")}>
        {NOT_FOUND_LINK}
      </Link>
    </main>
  );
}
