/**
 * `/admin/sessions` — ending an Account's open sessions (NFR13).
 *
 * **It is a tool, not a sixth section, and the distinction is the reason it has a
 * route of its own rather than a place in the queue.** A section is a backlog: it
 * has a count, an oldest item and a band, and the shell measures the queue's
 * health across all five of them. This has none of those — nothing accumulates
 * here and nobody is waiting. Putting it in the queue would put a control into an
 * instrument, and the count it would have to report is zero forever.
 *
 * **It had to move somewhere.** It lived on `/admin`, which is now a redirect,
 * and the alternative — repeating it under every section — would put a
 * destructive control on five screens an Admin scans at speed. The nav reaches it
 * from a group of its own, below the five.
 *
 * Story 10 invokes the same action from a Report's row, where an Admin handling
 * the Report already is. This stays the way to reach it without one.
 */

import type { Metadata } from "next";
import { SessionsPanel } from "../_components/sessions-panel";
import { SESSIONS_HEADING, sectionPageTitle } from "../_lib/messages";

export const metadata: Metadata = {
  title: sectionPageTitle(SESSIONS_HEADING),
  robots: { index: false, follow: false },
};

export default function AdminSessionsPage() {
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <SessionsPanel />
    </section>
  );
}
