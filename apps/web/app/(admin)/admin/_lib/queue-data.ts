import "server-only";

/**
 * Every read the queue makes, behind the gate and made once per request.
 *
 * **Two things this module exists to stop, and the second is the one that is easy
 * to miss.**
 *
 * The first is a read on behalf of a stranger. NFR14's 403 is enforced at the
 * shell — `layout.tsx` awaits the gate before it returns anything — but a Next
 * layout and the page beneath it render **concurrently**, so a gate in the layout
 * alone leaves the section's own query racing the interrupt. Nothing would reach
 * the browser, and the query would still have run. So the read itself gates,
 * exactly as `adminActionClient` does for a Server Action: the surface that
 * rendered the shell is not trusted by the read underneath it.
 *
 * The second is the same branch being read five times. The shell needs every
 * section's count and the oldest arrival across all of them; the section page
 * needs its own rows; the empty-versus-late decision needs both. Each of those is
 * a separate render position, and a plain `load()` per position is a query per
 * position. React's `cache` collapses them to one call per key per request — which
 * is also what makes the session read a single round trip rather than one per
 * caller.
 *
 * **A failure is a value, not a rejection.** A promise created in the shell and
 * awaited by a component React has not rendered yet is an unhandled rejection
 * waiting for a slow source to fail; folding the failure into the result removes
 * that window and gives every reader the same answer about which sections are
 * missing. Nothing is reported from here — `load` reaches the domain, which has
 * already logged what it failed at, and a second event for one incident is the
 * quota argument NFR26 and C51 make everywhere else in this app.
 */

import { cache } from "react";
import { requireAdminPage } from "@/lib/admin";
import { QUEUE_SOURCES, type QueueBranch, type QueueSource } from "./queue-sources";

/**
 * What a section has to say about itself.
 *
 * Three states rather than two, and `absent` is the one that matters: a section
 * whose story has not landed is not an empty section. Collapsing the two would
 * report a depth of zero for a branch nobody counted.
 */
export type SectionState =
  | { readonly status: "absent" }
  | { readonly status: "loaded"; readonly branch: QueueBranch }
  | { readonly status: "failed" };

/**
 * The Admin behind this request, read once however many callers ask.
 *
 * `requireAdminPage` calls `forbidden()`, so a refusal interrupts the render of
 * whichever component asked first — and the cached rejection interrupts every
 * other, which is the same 403 arriving by the same route rather than five.
 */
const admin = cache(requireAdminPage);

/**
 * One section's branch, gated and deduplicated.
 *
 * Keyed on {@link QueueSource.key} rather than on the source object, because
 * `cache` compares arguments by identity and the registry is rebuilt by nobody —
 * but a key is a value, and a value is what makes the shell's call and the page's
 * call the same call.
 */
export const loadSection = cache(async (key: string): Promise<SectionState> => {
  await admin();

  const source = QUEUE_SOURCES.find((each) => each.key === key);
  if (!source?.load) return { status: "absent" };

  try {
    return { status: "loaded", branch: await source.load() };
  } catch {
    return { status: "failed" };
  }
});

/** Every section, paired with its promise, in nav order. */
export function loadEverySection(): readonly {
  readonly source: QueueSource;
  readonly state: Promise<SectionState>;
}[] {
  return QUEUE_SOURCES.map((source) => ({ source, state: loadSection(source.key) }));
}

/** The branches that answered, for the figures computed across all of them. */
export function branchesThatLoaded(states: readonly SectionState[]): readonly QueueBranch[] {
  return states.filter((state) => state.status === "loaded").map((state) => state.branch);
}
