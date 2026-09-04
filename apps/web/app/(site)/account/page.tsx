/**
 * `/account` — where a Worker ends a session on a machine she no longer holds.
 *
 * Shaped at `.impeccable/briefs/account.md`; the state set is the spec's
 * (`## UX design`, the Account row). Mode is **Operate**: nobody wants to spend
 * time here, so scanability and familiar affordances outrank expression.
 *
 * **This is the shell later tickets extend.** Email change and deletion (#29)
 * become further sections in this column; the section shape and the copy module
 * are what they inherit.
 *
 * **What is deliberately absent, because it belongs to #80:** every piece of
 * navigation, the signed-in identity chrome, and _salir_ — single-session
 * sign-out. Until that ticket lands this page is reachable only by typing its
 * URL, which is the gap #80 exists to close and is stated on this ticket's PR
 * rather than papered over with a second sign-out control here.
 *
 * **`noindex`.** `/account*` is on NFR8's list, so this carries both halves —
 * the `<meta>` below and the `X-Robots-Tag` header from `next.config.ts`, whose
 * route list `robots.test.ts` drives.
 */

import { Card } from "@repo/design-system/components/card";
import { Separator } from "@repo/design-system/components/separator";
import { Skeleton } from "@repo/design-system/components/skeleton";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { SessionList } from "./_components/session-list";
import { SessionsPanel } from "./_components/sessions-panel";
import {
  ACCOUNT_PAGE_TITLE,
  ACCOUNT_TITLE,
  SESSIONS_EXPLANATION,
  SESSIONS_HEADING,
} from "./_lib/messages";
import { toSessionViews } from "./_lib/view";

export const metadata: Metadata = {
  title: ACCOUNT_PAGE_TITLE,
  robots: { index: false, follow: false },
};

/**
 * The dynamic half.
 *
 * Cache Components makes data dynamic by default and fails the build on uncached
 * data outside a `<Suspense>` boundary. The session read is exactly that — it
 * reads request headers and must never be cached, because a cached session read
 * is one person's session served to another. So the boundary is `[stream]` from
 * the framework's own menu, chosen over `[cache]` (impossible here, and
 * [ADR-0011](../../../../docs/adr/0011-no-shared-cache-until-a-measurement-requires-one.md)
 * refuses a shared cache anyway) and over `[block]`, because the page's heading
 * can paint before the list resolves.
 */
async function AccountPanel() {
  const sessions = await auth().listSessions(await headers());

  /**
   * The surface table's empty state for this page: **signed out → `/sign-in`**.
   * `listSessions` answers `null` rather than `[]` for "no session", which is
   * what keeps that different from "no other sessions" — the two would otherwise
   * render the same page.
   *
   * **One read, not two.** This panel used to `getSession` alongside the list to
   * render her address under the heading; with the address gone that call
   * answered nothing the list does not, so it went with it rather than staying
   * on as a second opinion about whether she is signed in.
   */
  if (!sessions) redirect("/sign-in");

  /**
   * **One clock reading for the whole page.** Every relative phrase is formatted
   * from this instant, so two rows cannot disagree about what "hoy" means, and
   * no component reads the current time — which under Cache Components is what
   * would fail a prerender with `blocking-prerender-current-time`.
   */
  const views = toSessionViews(sessions, new Date());
  const otherCount = views.filter((view) => !view.current).length;

  return (
    <Card className="flex w-full flex-col gap-6 p-6 sm:p-8">
      {/*
        **The heading and nothing under it.** The address used to sit here as a
        subtitle, and the shell's session menu shows it too — so a signed-in
        person met it twice on one screen, once as chrome and once as page copy.
        The menu is the better of the two homes: it is on *every* page, it is
        where a borrowed-phone check is already made (`SIGNED_IN_AS`), and it is
        the thing the avatar in the corner is for. Repeating it here said nothing
        the corner of the same screen was not already saying.
      */}
      <h1 className="page-heading">{ACCOUNT_TITLE}</h1>

      <Separator />

      <section className="flex flex-col gap-4" aria-labelledby="sessions-heading">
        <div className="flex flex-col gap-1">
          <h2 id="sessions-heading" className="text-foreground text-lg font-semibold">
            {SESSIONS_HEADING}
          </h2>
          <p className="text-muted-foreground text-sm text-pretty">{SESSIONS_EXPLANATION}</p>
        </div>

        {/* Evidence first, control after — never the other way round. */}
        <SessionList sessions={views} />
        <SessionsPanel otherCount={otherCount} />
      </section>
    </Card>
  );
}

/**
 * The fallback holds the panel's shape rather than showing a spinner, so nothing
 * moves when the real thing resolves. Same wrappers and same `Card` as
 * `AccountPanel`, so the two cannot drift apart in outline.
 */
function PanelSkeleton() {
  return (
    <Card className="flex w-full flex-col gap-6 p-6 sm:p-8" aria-hidden="true">
      <Skeleton className="h-8 w-40" />
      <Separator />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-full" />
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      <Skeleton className="h-9 w-44" />
    </Card>
  );
}

export default function AccountPage() {
  return (
    <main className="bg-muted flex grow flex-col items-center px-4 py-12">
      <div className="w-full max-w-md">
        <Suspense fallback={<PanelSkeleton />}>
          <AccountPanel />
        </Suspense>
      </div>
    </main>
  );
}
