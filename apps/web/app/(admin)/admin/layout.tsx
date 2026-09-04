/**
 * The Admin queue's shell: five sections behind one nav, and the age of the
 * oldest item on every screen.
 *
 * **This is the part that is true regardless of which sections exist yet** — the
 * nav, the counts, the oldest-item figure, the gate, the coverage line, and the
 * one signal that is about the platform rather than about a profile. A section
 * arrives by gaining a resolver; it decides none of this again.
 *
 * **The gate is here, and it is also in front of every read.** NFR14 asks for one
 * answer for every caller that is not an authenticated Admin, enforced once and
 * covering all five routes, and this is where "once" is. What it cannot do alone
 * is stop the query: a Next layout and the page beneath it render *concurrently*,
 * so a gate in the layout is racing the section's own read rather than preceding
 * it. `_lib/queue-data.ts` closes that, and the two together are the same shape
 * `adminActionClient` has — the surface that rendered the shell is not trusted by
 * the read underneath it.
 *
 * **`noindex` is not set here.** `/admin` and `/admin/*` are on NFR8's list in
 * `lib/gated-routes.ts`, so the `X-Robots-Tag` header arrives from
 * `next.config.ts` for every route below — and each page still sets
 * `metadata.robots` for the `<meta>` half, because NFR8 wants both.
 */

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@repo/design-system/components/sidebar";
import { Suspense } from "react";
import { requireAdminPage } from "@/lib/admin";
import { QueueNav, type QueueNavItem } from "./_components/queue-nav";
import {
  OldestItem,
  OldestItemSkeleton,
  SectionBadge,
  SectionBadgeAbsent,
  SectionBadgeSkeleton,
} from "./_components/queue";
import { Coverage, PublishRateSignal } from "./_components/shell-notices";
import { ADMIN_TITLE, SIDEBAR_TOGGLE_LABEL } from "./_lib/messages";
import { branchesThatLoaded, loadEverySection, type SectionState } from "./_lib/queue-data";
import { isPastBand, oldestAgeInHours } from "./_lib/queue-sources";

/**
 * **`[block]` from Cache Components' own menu, and the right third of that menu
 * for this one subtree rather than the quick way to a green build.**
 *
 * What actually blocks is the `await` below, before this component returns
 * anything: nothing can be flushed until the gate has answered, so NFR14's
 * _"403, returned, not a redirect"_ is a real status line rather than a refusal
 * drawn inside a 200. This export is what stops the framework asking for that
 * `await` to be streamed instead.
 *
 * Both alternatives are wrong here for reasons specific to what this is:
 *
 * - **`[stream]`** would put `requireAdminPage` inside a `<Suspense>` and let a
 *   shell paint first. That shell is a **200**, and the status is already on the
 *   wire by the time the gate answers. Every other surface in this app streams
 *   its session read; this is the only one whose *status code* depends on it.
 * - **`[cache]`** is not available and would be a serious bug if it were: a
 *   cached session read serves one person's identity to the next (ADR-0011, and
 *   `apps/web/AGENTS.md`).
 *
 * What `[block]` costs is a static shell for these routes, and there is none
 * worth having: every element here is behind the gate, so nothing could honestly
 * render before the answer. The sections still stream inside the page, so the
 * `partial` state the UX table describes is intact. It sits on the layout rather
 * than on each page because the gate does, and placing it as low as covers the
 * routes is the rule — the rest of the app keeps validating.
 */
export const instant = false;

/**
 * One nav item's figure, once its branch has answered.
 *
 * A section with no resolver reports **no count**, which is the coverage rule
 * seen at the smallest scale: a `0` beside a branch nobody queried would be the
 * instrument that lies. A section that *failed* reports no count either — the
 * card on the section's own page is what says which one it was, one fact per
 * element.
 */
async function NavBadge({
  state,
  bandHours,
  now,
}: {
  state: Promise<SectionState>;
  bandHours: number | null;
  now: Date;
}) {
  const settled = await state;
  if (settled.status !== "loaded") return <SectionBadgeAbsent />;

  return (
    <SectionBadge total={settled.branch.total} late={isPastBand(settled.branch, bandHours, now)} />
  );
}

/**
 * NFR7's number, across every section that answered.
 *
 * **In its own boundary and rendered first** (story 7): it is the one figure that
 * says whether today is an ordinary day, and it is also the one thing here that
 * cannot stream per section, because it is a minimum over all of them.
 *
 * **It sits in the shell's own header rather than in the nav**, which is the half
 * of the criterion that is easy to lose: the nav collapses on a narrow viewport
 * and this figure has to survive that, because it is the number that decides
 * whether this person keeps working or stops.
 *
 * A section that failed or has no resolver is simply absent from the arithmetic —
 * the coverage line and the failure card are what say so out loud, and an age
 * computed over the sections that answered is more use than no age at all.
 */
async function OldestAcrossQueue({
  sections,
  now,
}: {
  sections: readonly { readonly state: Promise<SectionState> }[];
  now: Date;
}) {
  const settled = await Promise.all(sections.map((section) => section.state));

  return <OldestItem hours={oldestAgeInHours(branchesThatLoaded(settled), now)} />;
}

export default async function AdminQueueLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  /**
   * **First statement, before anything is read or rendered.** NFR14: every
   * `/admin/*` response requires a session that presented a link to the mailbox
   * and a code from the authenticator, and the refusal is a 403 rather than a
   * redirect. `requireAdminPage` calls `forbidden()`, so nothing below this line
   * runs for a caller who is not an authenticated Admin.
   */
  await requireAdminPage();

  /**
   * **One clock reading for the whole shell**, so no two figures disagree about
   * what "now" means — the counts, the late markers and the oldest-item figure
   * are all measured against this one instant. Reading it here is safe because
   * `requireAdminPage` has already made this render dynamic; a clock read on a
   * prerendered path fails the build with `blocking-prerender-current-time`.
   */
  const now = new Date();

  /**
   * Every section's branch, started once. The section page beneath this awaits
   * the same promise for its own rows — `loadSection` is `cache`d per request, so
   * the nav's five figures and the page's list are five queries rather than six.
   */
  const sections = loadEverySection();

  const items: readonly QueueNavItem[] = sections.map(({ source, state }) => ({
    href: `/admin/${source.segment}`,
    label: source.label,
    badge: (
      <Suspense fallback={<SectionBadgeSkeleton />}>
        <NavBadge state={state} bandHours={source.bandHours} now={now} />
      </Suspense>
    ),
  }));

  return (
    /*
      The shell sits below `(admin)/layout.tsx`'s header, which is `h-14` and
      sticky at `z-40`. Both heights are stated against that one number so the
      nav's own scroll region ends where the viewport does rather than 56 px past
      it.
    */
    <SidebarProvider className="min-h-[calc(100svh-3.5rem)]">
      <QueueNav items={items} />

      <SidebarInset className="min-w-0 bg-transparent">
        <div className="border-border bg-background flex items-center gap-3 border-b px-4 py-3">
          <SidebarTrigger label={SIDEBAR_TOGGLE_LABEL} />
          <h1 className="text-foreground text-lg leading-7 font-semibold tracking-tight">
            {ADMIN_TITLE}
          </h1>

          {/*
            **Its own boundary, and it renders first.** Nothing below waits on it
            and it waits on nothing below — which is what makes the `partial`
            state the UX table describes real: the figure that decides how to
            spend the next hour lands before the rows it describes.
          */}
          <div className="ml-auto">
            <Suspense fallback={<OldestItemSkeleton />}>
              <OldestAcrossQueue sections={sections} now={now} />
            </Suspense>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4 px-4 py-6">
          <Coverage />

          {/*
            No fallback: this renders one notice or nothing, and a skeleton for
            "possibly nothing" is a shape that would appear and vanish on every
            load where the rate is ordinary — which is every ordinary day.
          */}
          <Suspense fallback={null}>
            <PublishRateSignal now={now} />
          </Suspense>

          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
