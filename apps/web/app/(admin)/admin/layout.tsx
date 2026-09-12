/**
 * The Admin queue's shell: the gate, the one figure that says how today is
 * going, and the two notices that are about the queue rather than about a row.
 *
 * **No nav, because there is nothing to navigate between.** The queue is one list
 * across every source (#277), so the counts a nav would carry are the one
 * headline below, and the one tool is a link in the header.
 *
 * **The gate is here, and it is also in front of every read.** NFR14 asks for one
 * answer for every caller that is not an authenticated Admin, enforced once and
 * covering every route under `/admin`, and this is where "once" is. What it cannot
 * do alone is stop the query: a Next layout and the page beneath it render
 * *concurrently*, so a gate in the layout is racing the page's own read rather
 * than preceding it. `_lib/queue-data.ts` closes that, and the two together are
 * the same shape `adminActionClient` has — the surface that rendered the shell is
 * not trusted by the read underneath it.
 *
 * **`noindex` is not set here.** `/admin` and `/admin/*` are on NFR8's list in
 * `lib/gated-routes.ts`, so the `X-Robots-Tag` header arrives from
 * `next.config.ts` for every route below — and each page still sets
 * `metadata.robots` for the `<meta>` half, because NFR8 wants both.
 */

import { buttonVariants } from "@repo/design-system/components/button-variants";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdminPage } from "@/lib/admin";
import { QueueHeadline, QueueHeadlineSkeleton } from "./_components/queue";
import { Coverage, PublishRateSignal } from "./_components/shell-notices";
import { ADMIN_TITLE, SESSIONS_HEADING } from "./_lib/messages";
import { requestNow, settleEverySource } from "./_lib/queue-data";
import { queueView } from "./_lib/queue-sources";

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
 * render before the answer. The list still streams inside the page, so the
 * `partial` state the UX table describes is intact. It sits on the layout rather
 * than on each page because the gate does, and placing it as low as covers the
 * routes is the rule — the rest of the app keeps validating.
 */
export const instant = false;

/**
 * NFR7's number and the count behind it, across every source that answered.
 *
 * **In its own boundary and rendered first** (story 7): it is the one figure that
 * says whether today is an ordinary day, and it is a minimum and a sum over every
 * branch, so it cannot stream per source.
 *
 * **Computed by the same `queueView` from the same reads and the same clock as
 * the page's list** — `loadSource` and `requestNow` are both `cache`d per request
 * — so the headline and the rows beneath it cannot disagree, and both figures are
 * over whole branches (C55), never over the rows the list renders.
 */
async function Headline() {
  const view = queueView(await settleEverySource(), requestNow());

  return <QueueHeadline hours={view.oldestHours} waiting={view.waiting} />;
}

export default async function AdminQueueLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  /**
   * **First statement, before anything is read or rendered.** NFR14: every
   * `/admin/*` response requires a session that presented a link to the mailbox
   * and a code from the authenticator, and the refusal is a 403 rather than a
   * redirect. `requireAdminPage` calls `forbidden()`, so nothing below this line
   * runs for a caller who is not an authenticated Admin — including anything that
   * would say which sources exist.
   */
  await requireAdminPage();

  return (
    <div className="flex min-w-0 flex-col">
      <div className="border-border bg-background border-b">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <h1 className="text-foreground text-lg leading-7 font-semibold tracking-tight">
            {ADMIN_TITLE}
          </h1>

          {/*
            **The one tool, in the header.** It is a tool rather than a backlog —
            nothing accumulates there — so it is never a row in the list, where it
            would be a control sitting inside an instrument.
          */}
          <Link
            href="/admin/sessions"
            className={buttonVariants({ variant: "link", size: "sm", className: "px-0" })}
          >
            {SESSIONS_HEADING}
          </Link>

          {/*
            **Its own boundary, and it renders first.** Nothing below waits on it
            and it waits on nothing below — which is what makes the `partial` state
            real: the figure that decides how to spend the next hour lands before
            the rows it describes.
          */}
          <div className="ml-auto">
            <Suspense fallback={<QueueHeadlineSkeleton />}>
              <Headline />
            </Suspense>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-4 px-4 py-6">
        <Coverage />

        {/*
          No fallback: this renders one notice or nothing, and a skeleton for
          "possibly nothing" is a shape that would appear and vanish on every
          load where the rate is ordinary — which is every ordinary day.

          The clock is read here, after the gate, so the read is on the request
          path rather than a prerendered one.
        */}
        <Suspense fallback={null}>
          <PublishRateSignal now={requestNow()} />
        </Suspense>

        {children}
      </div>
    </div>
  );
}
