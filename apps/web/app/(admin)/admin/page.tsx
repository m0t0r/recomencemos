/**
 * `/admin` — the queue, as one list across every source, oldest first.
 *
 * **Every item is rendered in full before it can be decided, and the count and
 * the age are computed over each whole branch** (C55). There are no per-source
 * routes: a route per source is a place for the oldest item to wait unseen, so
 * narrowing the list is the table's own filter, chosen by the Admin and visible
 * in its control.
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdminPage } from "@/lib/admin";
import { QueueTable } from "./_components/queue-table";
import { QueueEmpty, QueueSkeleton, SourceFailed } from "./_components/queue";
import { ADMIN_PAGE_TITLE, QUEUE_LIST_LABEL, shownOfWaiting } from "./_lib/messages";
import { requestNow, settleEverySource } from "./_lib/queue-data";
import { queueView } from "./_lib/queue-sources";

export const metadata: Metadata = {
  title: ADMIN_PAGE_TITLE,
  robots: { index: false, follow: false },
};

/**
 * The list, once every source has answered.
 *
 * **One boundary for the whole list**: an order across every source cannot be
 * drawn until every source has said what it holds. The headline in the shell is
 * its own boundary and lands first, so a slow source cannot hide the day's state.
 */
async function QueueList() {
  const sources = await settleEverySource();

  /**
   * **The clock is read after the sources are awaited**, which puts it on the
   * request-time path: `loadSource` awaits the session, a dynamic read. Before the
   * `await` it would fail the build with `blocking-prerender-current-time`. It is
   * the shell's reading too — `requestNow` is `cache`d per request.
   */
  const view = queueView(sources, requestNow());

  return (
    <>
      {/*
        **Each failure named, above the rows that did arrive** — the rows that
        loaded fill the screen, and nothing else would say a branch is missing
        from among them.
      */}
      {view.failed.map((source) => (
        <SourceFailed key={source.key} label={source.label} />
      ))}

      {view.rows.length === 0 ? (
        // Empty is only the good news when nothing failed; with a source missing,
        // the failure is the whole of what can honestly be said.
        view.failed.length === 0 ? (
          <QueueEmpty />
        ) : null
      ) : (
        <>
          {/*
            C55: each branch is capped for display and counted whole, so when the
            caps hide rows the page says how many are on screen out of how many
            wait — the one place the two numbers meet.
          */}
          {view.rows.length < view.waiting ? (
            <p className="text-muted-foreground text-sm leading-5">
              {shownOfWaiting(view.rows.length, view.waiting)}
            </p>
          ) : null}

          <QueueTable rows={view.rows} filters={view.filters} />
        </>
      )}
    </>
  );
}

export default async function AdminPage() {
  /**
   * **The gate again, before this page renders anything** — not redundant with
   * the layout's. A layout and its page render concurrently, so without this the
   * page's skeleton would render beside the refusal and its label would ride in
   * the 403's payload; and if the layout's gate ever moved, this is what would
   * still keep the page empty for a stranger.
   */
  await requireAdminPage();

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <Suspense fallback={<QueueSkeleton label={QUEUE_LIST_LABEL} />}>
        <QueueList />
      </Suspense>
    </section>
  );
}
