/**
 * `/admin` — the queue, as one list across every source, oldest first (#277).
 *
 * **This was a redirect to `/admin/offers`**, the door into five routes behind a
 * sidebar (#96). The UX lab compared that shape against one list and the list
 * won, because with five routes the oldest item could still sit behind a section
 * nobody opened. So this page is the whole queue again — the shape before #96 —
 * with what #96 got right kept: every item rendered in full before it can be
 * decided, and the count and the age computed over each whole branch.
 *
 * **The per-source routes are gone rather than kept as deep links.** A link to one
 * source is the hiding this page exists to remove; the filter in the list is the
 * way to narrow it, and it is the Admin's choice rather than the page's default.
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import { QueueTable, type QueueFilter } from "./_components/queue-table";
import { QueueEmpty, QueueSkeleton, SourceFailed } from "./_components/queue";
import { ADMIN_PAGE_TITLE, QUEUE_LIST_LABEL, shownOfWaiting } from "./_lib/messages";
import { settleEverySection } from "./_lib/queue-data";
import { branchesThatLoaded, queueRows, waitingAcross } from "./_lib/queue-sources";

export const metadata: Metadata = {
  title: ADMIN_PAGE_TITLE,
  robots: { index: false, follow: false },
};

/**
 * The list, once every source has answered.
 *
 * **One boundary for the whole list, where there used to be one per section**,
 * and that is the cost of oldest-first rather than an oversight: an order across
 * every source cannot be drawn until every source has said what it holds. What
 * keeps a slow source from hiding the day's state is the headline above, which is
 * its own boundary and lands first.
 */
async function QueueList() {
  const settled = await settleEverySection();

  /**
   * **The clock is read after the sources are awaited**, which is what puts it on
   * the request-time path: `loadSection` awaits the session, a dynamic read, so no
   * `connection()` is needed to say so. Reading it before the `await` fails the
   * build with `blocking-prerender-current-time` — which is how the per-section
   * page this replaced learned it first.
   */
  const now = new Date();

  const rows = queueRows(settled, now);
  const waiting = waitingAcross(branchesThatLoaded(settled.map(({ state }) => state)));
  const failed = settled.filter(({ state }) => state.status === "failed");

  const filters: readonly QueueFilter[] = settled.flatMap(({ source, state }) =>
    state.status === "loaded" && state.branch.total > 0
      ? [{ key: source.key, label: source.label, total: state.branch.total }]
      : [],
  );

  return (
    <>
      {/*
        **Each failure named, above the rows that did arrive.** In one list this
        matters more than it did per section: the rows that loaded fill the
        screen, and nothing else would say a branch is missing from among them.
      */}
      {failed.map(({ source }) => (
        <SourceFailed key={source.key} label={source.label} />
      ))}

      {rows.length === 0 ? (
        // Empty is only the good news when nothing failed; with a source missing,
        // the failure is the whole of what can honestly be said.
        failed.length === 0 ? (
          <QueueEmpty />
        ) : null
      ) : (
        <>
          {/*
            C55: each branch is capped for display and counted whole, so when the
            caps hide rows the page says how many are on screen out of how many
            wait — the one place the two numbers meet.
          */}
          {rows.length < waiting ? (
            <p className="text-muted-foreground text-sm leading-5">
              {shownOfWaiting(rows.length, waiting)}
            </p>
          ) : null}

          <QueueTable rows={rows} filters={filters} />
        </>
      )}
    </>
  );
}

export default function AdminPage() {
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <Suspense fallback={<QueueSkeleton label={QUEUE_LIST_LABEL} />}>
        <QueueList />
      </Suspense>
    </section>
  );
}
