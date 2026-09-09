import { notFound } from "next/navigation";
import { type ComponentType, Suspense } from "react";
import {
  PastBandMarker,
  QueueEmpty,
  SectionNotLive,
  SourceBranch,
  SourceFailed,
  SourceSkeleton,
} from "./queue";
import { OfferRow } from "./offer-row";
import { SkillRequestRow } from "./skill-request-row";
import { sectionWaiting } from "../_lib/messages";
import { loadSection } from "../_lib/queue-data";
import {
  isPastBand,
  sourceForSegment,
  type QueueItem,
  type QueueSource,
} from "../_lib/queue-sources";

/**
 * One section, rendered in full.
 *
 * **A page dedicated to one concern can afford to show each item whole**, which
 * is why there is no detail view and no third column: the reason to open one was
 * context a mixed list could not fit, and a single-concern page fits it. Nothing
 * is approved unread.
 *
 * The five routes are five files rather than one `[section]` segment, and that is
 * deliberate: an unknown segment is then a **404** from the router rather than a
 * lookup this component has to get right, and each section ticket edits its own
 * file instead of adding a branch to a shared one.
 */

/**
 * Which sections have a row of their own, by key.
 *
 * **Here rather than on the registry**, and the reason is a real import edge
 * rather than taste: a row reaches a Server Action, which reaches `lib/admin.ts`
 * and `server-only`, and the registry is read by a pure test of the oldest-item
 * arithmetic that would then fail to import. The registry stays data; this
 * module, which is already a server module, is where a key becomes a component.
 *
 * A section with no entry renders its summary and nothing to press — which is the
 * shape a section ticket replaces with its own row.
 */
const SECTION_ROWS: Record<string, ComponentType<{ readonly item: QueueItem }>> = {
  offers: OfferRow,
  skillRequests: SkillRequestRow,
};

async function SectionBody({ source }: { source: QueueSource }) {
  const state = await loadSection(source.key);

  /**
   * **The clock is read here, after the gate, and that placement is the fix
   * rather than a detail.** Reading it in {@link QueueSection} put it on the
   * page's prerendered path, and the framework refused the build with
   * `blocking-prerender-current-time` — correctly: the shell blocks on the gate,
   * but the page beneath it is a separate segment with nothing dynamic in it
   * until the branch is loaded. `loadSection` awaits the session, which is a
   * dynamic read, so everything after this line is request-time by construction
   * and no `connection()` is needed to say so.
   *
   * It is this render's reading rather than the shell's, and the two cannot
   * disagree: a layout and a page are siblings in the tree with no way to pass a
   * value between them, and both are dynamic renders of the same request —
   * milliseconds apart, on a figure measured in whole hours.
   */
  const now = new Date();

  if (state.status === "absent") return <SectionNotLive />;
  if (state.status === "failed") return <SourceFailed label={source.label} />;
  if (state.branch.total === 0) return <QueueEmpty />;

  return (
    <>
      <p className="text-muted-foreground flex items-center gap-2 text-sm leading-5">
        <span className="tabular-nums">{sectionWaiting(state.branch.total)}</span>
        {isPastBand(state.branch, source.bandHours, now) ? <PastBandMarker /> : null}
      </p>

      <SourceBranch branch={state.branch} Item={SECTION_ROWS[source.key]} />
    </>
  );
}

export function QueueSection({ segment }: { segment: string }) {
  const source = sourceForSegment(segment);
  if (!source) notFound();

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <h2 className="text-foreground text-xl leading-7 font-semibold tracking-tight">
        {source.label}
      </h2>

      {/*
        **A boundary per section, which is what the Suspense table asks for.** It
        is the section's own now that each has a route, and it is still what makes
        the `partial` state real: the shell's oldest-item figure and the nav's
        counts resolve independently of these rows.
      */}
      <Suspense fallback={<SourceSkeleton label={source.label} />}>
        <SectionBody source={source} />
      </Suspense>
    </section>
  );
}
