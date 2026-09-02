/**
 * `/admin` — the moderation queue, and the shell every later source plugs into.
 *
 * **One source is wired and four are still absent.** Unreviewed Offers, photos,
 * Reports and profiles awaiting takedown review read tables stories 7, 8 and 10
 * create, so they are not in `QUEUE_SOURCES` and nothing here pretends they are —
 * a stubbed source with invented rows would make this screen look finished while
 * showing a moderator data that is not there. With no Skill request waiting, this
 * page renders the empty state, which the acceptance criterion calls _"a real and
 * good state"_.
 *
 * What is real and finished is everything around it: the gate, the oldest-item
 * figure, the per-source `<Suspense>` boundaries, the named failure state, and the
 * two actions that exist.
 *
 * **`noindex`** — `/admin*` is on NFR8's list, so the `X-Robots-Tag` arrives from
 * `next.config.ts`'s route table and this carries the `<meta>` half, because NFR8
 * wants both.
 */

import type { Metadata } from "next";
import { type ComponentType, Suspense } from "react";
import { requireAdminPage } from "@/lib/admin";
import {
  OldestItem,
  OldestItemSkeleton,
  QueueEmpty,
  SourceBranch,
  SourceFailed,
  SourceSkeleton,
} from "./_components/queue";
import { SessionsPanel } from "./_components/sessions-panel";
import { SkillRequestRow } from "./_components/skill-request-row";
import { ADMIN_PAGE_TITLE, ADMIN_TITLE } from "./_lib/messages";
import {
  oldestAgeInHours,
  QUEUE_SOURCES,
  type QueueBranch,
  type QueueItem,
  type QueueSource,
} from "./_lib/queue-sources";

export const metadata: Metadata = {
  title: ADMIN_PAGE_TITLE,
  robots: { index: false, follow: false },
};

/**
 * **`[block]` from Cache Components' own menu, and it is the right third of that
 * menu for this one route rather than the quick way to a green build.**
 *
 * The build's error offers `[stream]`, `[cache]` and `[block]`. Both alternatives
 * are wrong here for reasons specific to what this page is:
 *
 * - **`[stream]`** would put `requireAdminPage` inside a `<Suspense>` and let a
 *   shell paint first. That shell is a **200**, and the status is already on the
 *   wire by the time the gate answers — so NFR14's _"refused with 403"_ becomes a
 *   200 with a refusal drawn inside it, which is the one thing the requirement
 *   spells out that it must not be. Every other surface in this app streams its
 *   session read; this is the only one whose *status code* depends on it.
 * - **`[cache]`** is not available and would be a serious bug if it were: a cached
 *   session read serves one person's identity to the next (ADR-0011, and
 *   `apps/web/AGENTS.md`).
 *
 * What `[block]` costs is the static shell for this route, and this route has no
 * shell worth having: every element on it is behind the gate, so there is nothing
 * that could honestly render before the answer. The rest of the app is unaffected
 * — `instant` is per segment, and `(admin)` is the segment.
 *
 * The sources still stream inside the page, so the `partial` state the UX table
 * describes is intact. What blocks is the authorization, which is exactly the
 * thing that should.
 */
export const instant = false;

/**
 * A branch that has settled, either way.
 *
 * **Every source is loaded exactly once and its promise is shared**, which is what
 * this shape is for: three things on this page read the same branch — the
 * oldest-item figure, the source's own card, and the decision about whether the
 * queue is empty — and calling `load()` per reader would run each query three
 * times, once per render position.
 *
 * **It never rejects.** A promise created at the top of the page and awaited by a
 * component React has not rendered yet is an unhandled rejection waiting for a
 * slow source to fail; folding the failure into the value removes that window
 * entirely, and gives every reader the same answer about which sources are missing.
 */
type Settled = { readonly ok: true; readonly branch: QueueBranch } | { readonly ok: false };

interface Loading {
  readonly source: QueueSource;
  readonly settled: Promise<Settled>;
}

/**
 * NFR7's number, across every branch that arrived.
 *
 * **In its own boundary and rendered first** (story 7): it is the one figure that
 * says whether today is an ordinary day, and it is also the one thing here that
 * cannot stream per source, because it is a minimum over all of them.
 *
 * A failed source is simply absent from the arithmetic — the `SourceFailed` card
 * beside it is what says so out loud, and an age computed over four branches is
 * more use than no age at all.
 */
async function Oldest({ loading, now }: { loading: readonly Loading[]; now: Date }) {
  const settled = await Promise.all(loading.map((each) => each.settled));
  const branches = settled.filter((each) => each.ok).map((each) => each.branch);

  return <OldestItem hours={oldestAgeInHours(branches, now)} />;
}

/**
 * One source, streamed on its own.
 *
 * **A boundary per source rather than one around the list**, which is what the
 * Suspense table asks for — _"skeleton rows per source, each labelled with its
 * source"_ — and what makes the `partial` state real: the Admin starts work on the
 * branch that arrived while a slow one is still coming.
 *
 * **A failure is rendered, never rethrown.** An error boundary around the page
 * would replace the whole queue with one message, and the acceptance criterion is
 * the opposite: a silently missing source is an unreviewed Offer, so the other
 * four must stay workable while this one says which it was. Nothing is reported
 * from here either — `load` is a domain call and the domain has already logged
 * what it failed at, so a second event for one incident is the quota argument NFR26
 * and C51 make everywhere else in this app.
 */
async function Source({ source, settled }: Loading) {
  const result = await settled;
  if (!result.ok) return <SourceFailed label={source.label} />;

  return <SourceBranch source={source} branch={result.branch} Item={QUEUE_ROWS[source.key]} />;
}

/**
 * Which sources have a row of their own, by key.
 *
 * **It is here rather than on the source itself**, and the reason is a real
 * import edge rather than taste: a row reaches a Server Action, which reaches
 * `lib/admin.ts` and `server-only`, and `QUEUE_SOURCES` is read by a pure test of
 * the oldest-item arithmetic that would then fail to import. The registry stays
 * data; this page, which is already a server module, is where a key becomes a
 * component.
 *
 * A source with no entry renders its summary and nothing to press — which is
 * every source that has no resolver yet, honestly.
 */
const QUEUE_ROWS: Record<string, ComponentType<{ readonly item: QueueItem }>> = {
  skillRequests: SkillRequestRow,
};

/**
 * The empty state, which can only be known once every source has answered.
 *
 * **It is its own boundary rather than a branch above the list**, because deciding
 * it at the top would mean awaiting all five sources before rendering any — which
 * is the `partial` state given up to compute a state that is only correct when
 * there is no `partial` to have. So the branches stream, and this resolves last and
 * says the thing none of them can say alone.
 *
 * A source that failed counts as *not* empty: the honest reading of "four branches
 * are clear and one did not load" is that the queue's depth is unknown, and
 * `QUEUE_EMPTY_TITLE` asserts it is zero.
 */
async function EmptyWhenNothingWaits({ loading }: { loading: readonly Loading[] }) {
  const settled = await Promise.all(loading.map((each) => each.settled));
  const quiet = settled.every((each) => each.ok && each.branch.total === 0);

  return quiet ? <QueueEmpty /> : null;
}

export default async function AdminPage() {
  /**
   * **First statement, before anything is read or rendered.** NFR14: every
   * `/admin/*` response requires a session that passed password **and** TOTP, and
   * the refusal is a 403 rather than a redirect. `requireAdminPage` calls
   * `forbidden()`, so nothing below this line runs for a caller who is not an
   * authenticated Admin — including the source loads, which is the half that
   * matters: a gate that rendered first and refused second would have read the
   * queue on behalf of a stranger.
   */
  await requireAdminPage();

  /**
   * **One clock reading for the whole page**, so no two figures disagree about
   * what "now" means. Reading it here is safe because `requireAdminPage` has
   * already made this render dynamic; a clock read on a prerendered path fails the
   * build with `blocking-prerender-current-time`.
   */
  const now = new Date();

  const loading: readonly Loading[] = QUEUE_SOURCES.map((source) => ({
    source,
    settled: source.load().then(
      (branch): Settled => ({ ok: true, branch }),
      (): Settled => ({ ok: false }),
    ),
  }));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-12">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-foreground text-2xl leading-8 font-semibold tracking-tight">
          {ADMIN_TITLE}
        </h1>
        <Suspense fallback={<OldestItemSkeleton />}>
          <Oldest loading={loading} now={now} />
        </Suspense>
      </div>

      <div className="flex flex-col gap-4">
        {loading.map((each) => (
          <Suspense key={each.source.key} fallback={<SourceSkeleton label={each.source.label} />}>
            <Source source={each.source} settled={each.settled} />
          </Suspense>
        ))}

        {/*
          No fallback: this renders either the empty card or nothing, and a
          skeleton for "possibly nothing" is a shape that would appear and then
          vanish on every load where the queue is not empty.
        */}
        <Suspense fallback={null}>
          <EmptyWhenNothingWaits loading={loading} />
        </Suspense>
      </div>

      <SessionsPanel />
    </main>
  );
}
