/**
 * The 404, and the first one this app has had.
 *
 * **Until now every `notFound()` in the tree served Next.js's own English
 * default** — `404 / This page could not be found.` — and there are four callers
 * already: `(site)/my-profile/page.tsx`, `(token)/continue/page.tsx`,
 * `(token)/admin/enrol/[token]/page.tsx` and `(admin)/admin/_components/section.tsx`.
 * Plus every mistyped URL.
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

import { buttonVariants } from "@repo/design-system/components/button";
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
 * Without this the tab reads `Recomencemos` — the root layout's title, which is
 * what a working page says. The title is the one part of this surface a person
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
    <main className="mx-auto flex w-full max-w-prose grow flex-col items-start gap-4 px-6 py-16">
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
