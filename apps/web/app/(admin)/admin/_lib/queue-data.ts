import "server-only";

/**
 * Every read the queue makes, behind the gate and made once per request.
 *
 * **Three things this module exists to stop, and the last two are easy to miss.**
 *
 * The first is a read on behalf of a stranger. NFR14's 403 is enforced at the
 * shell — `layout.tsx` awaits the gate before it returns anything — but a Next
 * layout and the page beneath it render **concurrently**, so a gate in the layout
 * alone leaves the page's own query racing the interrupt. Nothing would reach the
 * browser, and the query would still have run. So the read itself gates, exactly
 * as `adminActionClient` does for a Server Action: the surface that rendered the
 * shell is not trusted by the read underneath it.
 *
 * The second is the same branch being read twice. The shell's headline and the
 * page's list are separate render positions that both need every source, and a
 * plain `load()` per position is a query per position. React's `cache` collapses
 * them to one call per key per request — which is also what makes the session
 * read a single round trip rather than one per caller.
 *
 * The third is the two of them disagreeing about the time; see
 * {@link requestNow}.
 *
 * **A failure is a value, not a rejection.** A promise created in the shell and
 * awaited by a component React has not rendered yet is an unhandled rejection
 * waiting for a slow source to fail; folding the failure into the result removes
 * that window and gives every reader the same answer about which sources are
 * missing. Nothing is reported from here — `load` reaches the domain, which has
 * already logged what it failed at, and a second event for one incident is the
 * quota argument NFR26 and C51 make everywhere else in this app.
 */

import * as React from "react";
import { requireAdminPage } from "@/lib/admin";
import { QUEUE_SOURCES, type SettledSource, type SourceState } from "./queue-sources";

/**
 * The Admin behind this request, read once however many callers ask.
 *
 * `requireAdminPage` calls `forbidden()`, so a refusal interrupts the render of
 * whichever component asked first — and the cached rejection interrupts every
 * other, which is the same 403 arriving by the same route rather than several.
 */
const admin = React.cache(requireAdminPage);

/**
 * This request's clock, read once however many callers ask.
 *
 * **The shell's headline and the page's list are siblings with no way to pass a
 * value between them**, and both show ages in whole hours — so two readings
 * milliseconds apart can straddle an hour and have the headline say 23 h above a
 * first row that says 24 h and is marked late. `cache` makes them one reading.
 *
 * Call it only after the gate or a gated read: a clock read on a prerendered path
 * fails the build with `blocking-prerender-current-time`.
 */
export const requestNow = React.cache(() => new Date());

/**
 * One source's branch, gated and deduplicated.
 *
 * Keyed on the source's key rather than on the source object, because `cache`
 * compares arguments by identity — and a key is a value, which is what makes the
 * shell's call and the page's call the same call.
 */
export const loadSource = React.cache(async (key: string): Promise<SourceState> => {
  await admin();

  const source = QUEUE_SOURCES.find((each) => each.key === key);
  if (!source?.load) return { status: "absent" };

  try {
    return { status: "loaded", branch: await source.load() };
  } catch {
    return { status: "failed" };
  }
});

/**
 * Every source and what it answered — what the list, the headline and the filter
 * are all computed from.
 *
 * Nothing here rejects: a failure is already a value.
 */
export async function settleEverySource(): Promise<readonly SettledSource[]> {
  return Promise.all(
    QUEUE_SOURCES.map(async (source) => ({ source, state: await loadSource(source.key) })),
  );
}
