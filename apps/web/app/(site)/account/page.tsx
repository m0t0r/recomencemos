/**
 * `/account` — where a Worker ends a session on a machine she no longer holds.
 *
 * Shaped at `.impeccable/briefs/account.md`; the state set is the spec's
 * (`## UX design`, the Account row). Mode is **Operate**: nobody wants to spend
 * time here, so scanability and familiar affordances outrank expression.
 *
 * **A sheet on the ruled page, not a card on a grey field.** The page is paper
 * at `/my-profile`'s measure — the two signed-in personal surfaces share one —
 * and the sessions are rows of one sheet, separated by the ruling with the rose
 * margin line beside them from `sm` up. The `Card` on `bg-muted` this replaced
 * was the last card-on-a-field left in the product, and it is the idiom the
 * visual world was chosen against.
 *
 * **This is the shell later tickets extend.** Email change and deletion (#29)
 * become further sections in this column; the section shape and the copy module
 * are what they inherit.
 *
 * **`noindex`.** `/account*` is on NFR8's list, so this carries both halves —
 * the `<meta>` below and the `X-Robots-Tag` header from `next.config.ts`, whose
 * route list `robots.test.ts` drives.
 */

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
    <Section>
      {/*
        Evidence first, control after — never the other way round. Both are rows
        of the same ruled page, so the note and the button continue the list's
        rhythm rather than sitting under it as separate blocks.
      */}
      <div className="ruled-page">
        <SessionList sessions={views} />
        <SessionsPanel otherCount={otherCount} />
      </div>
    </Section>
  );
}

/**
 * The heading and the sentence under it, which are the same in the fallback and
 * in the resolved panel — so they are written once, here, rather than in two
 * files kept in agreement by a comment saying they must be.
 *
 * The `<h2>` is in the display face at the 24 px step, which is the step
 * `/my-profile`'s tier headings carry. Neither is the page's own heading, and
 * both are the platform naming a region rather than her own words.
 */
function Section({ children }: { readonly children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-6" aria-labelledby="sessions-heading">
      <div className="flex flex-col gap-2">
        <h2
          id="sessions-heading"
          className="font-heading text-foreground text-2xl leading-8 font-medium"
        >
          {SESSIONS_HEADING}
        </h2>
        <p className="text-muted-foreground text-sm text-pretty">{SESSIONS_EXPLANATION}</p>
      </div>
      {children}
    </section>
  );
}

/**
 * The fallback holds the list's shape rather than showing a spinner, so nothing
 * moves when the real thing resolves — three rows and a control, on the same
 * ruled page the resolved panel is drawn on.
 */
function PanelSkeleton() {
  return (
    <Section>
      <div className="ruled-page" aria-hidden="true">
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="border-border flex flex-col gap-2 border-t py-4 first:border-t-0"
          >
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
        <div className="border-border border-t pt-5">
          <Skeleton className="h-9 w-44" />
        </div>
      </div>
    </Section>
  );
}

/**
 * The sheet, and the one line of display type on it.
 *
 * The `<h1>` sits **above** the boundary rather than inside the panel: it
 * depends on neither the session nor the query string, so it paints with the
 * shell instead of waiting behind a read it does not need. It is the shape
 * `/sign-in` and `/publish` already use, down to the `px-4 py-10` — one spacing
 * rhythm across the product's sheets.
 */
export default function AccountPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10">
      {/*
        **The heading and nothing under it.** Her address used to sit here as a
        subtitle, and the shell's session menu shows it too — so a signed-in
        person met it twice on one screen, once as chrome and once as page copy.
        The menu is the better of the two homes: it is on *every* page, it is
        where a borrowed-phone check is already made (`SIGNED_IN_AS`), and it is
        the thing the avatar in the corner is for.
      */}
      <h1 className="page-heading">{ACCOUNT_TITLE}</h1>

      <Suspense fallback={<PanelSkeleton />}>
        <AccountPanel />
      </Suspense>
    </main>
  );
}
