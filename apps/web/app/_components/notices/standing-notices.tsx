/**
 * The three standing notices — the product's honesty surface.
 *
 * Shaped at `.impeccable/briefs/standing-notices.md`; every string is
 * `app/_lib/notices/messages.ts`, which quotes `voice.md`, ADR-0007 and
 * `CONTEXT.md` rather than writing anything of its own.
 *
 * **A product component in `apps/web`, not a design-system primitive.** The
 * spec's package table says so directly, and the reason is that nothing about
 * this is reusable: it is three specific sentences about one specific platform.
 *
 * **Not the registry's `Alert`, and that is semantic rather than visual.**
 * `Alert` carries `role="alert"` — a live region that interrupts whatever is
 * being read. These are standing facts, true on every page every time, so
 * announcing them on arrival at every route would be a warning nobody trusts
 * twice. `app/(admin)/admin/_components/shell-notices.tsx` made the same call for
 * the publish-rate signal and wrote down the same reason. A `<section>` with an
 * accessible name, headings, and no live region.
 *
 * **A Server Component that ships no client JavaScript**, which is how NFR4 and
 * NFR3 are met structurally rather than by measurement: there is no bundle to add
 * to the first load, and nothing has to hydrate before the text is readable. The
 * `open` treatment's disclosure is `<details>`, which is native HTML and opens
 * with the script tag removed.
 *
 * **Nothing here is `destructive`.** `DESIGN.md` reserves that triad for a limit
 * of the platform — which these are — but painting three of them on the first
 * screen of the Wall would make the product read as a warning label. The mark
 * beside each statement is `aria-hidden` and redundant with a heading that says
 * the same thing in words, which is how "not conveyed by colour alone" is met
 * rather than argued.
 */

import { BanknoteIcon, ChevronDownIcon, MessageSquareOffIcon, ShieldOffIcon } from "lucide-react";
import type { ComponentType } from "react";
import {
  NOTICES_HEADING,
  STANDING_NOTICES,
  type StandingNotice,
} from "@/app/_lib/notices/messages";

/**
 * The two treatments, and the rule that decides between them.
 *
 * The brief marked prominence `[open]` and it was taken by looking at three
 * candidates on the real Wall at 390 × 844. What was chosen is **not one of
 * them** — it is `disclosure` where the notices sit above content the reader came
 * for, and `expanded` where they do not:
 *
 * - `disclosure` — the three absence sentences are always on screen and tappable;
 *   what follows from each is one tap away. Used on `/` and `/profiles`, where the
 *   fully expanded form pushed the first profile row entirely below the fold, and
 *   the Wall's whole job is that a reader meets three or four people and forms a
 *   view.
 * - `expanded` — all three read in full, separated by the ruling. Used on
 *   `/my-profile`, where the notices sit at the foot and compete with nothing.
 *
 * **The prop is required rather than defaulted, deliberately.** A default would
 * let the next surface take a prominence decision by omission, which is exactly
 * what `.impeccable/briefs/standing-notices.md` says this decision is not.
 */
export type NoticesTreatment = "disclosure" | "expanded";

/**
 * The mark beside each statement, keyed by the statement rather than chosen at
 * the call site, so the pairing cannot drift between surfaces.
 *
 * `MessageSquareOffIcon` for the Block is the one worth naming: a Block stops
 * **sending** and reaches nothing else, so the mark has to say "no more messages"
 * and must not say "hidden" — `CONTEXT.md` bans that description in words and it
 * would be just as false in a glyph.
 */
const MARKS: Record<StandingNotice["key"], ComponentType<{ className?: string }>> = {
  verification: ShieldOffIcon,
  money: BanknoteIcon,
  block: MessageSquareOffIcon,
};

const HEADING_ID = "standing-notices-heading";

/**
 * The heading level the region takes, because it varies and getting it wrong
 * costs a screen-reader user the document outline.
 *
 * On `/profiles` and `/my-profile` the region sits directly under the page's
 * `<h1>`, so it is an `h2`. On the Wall it sits **inside** the recent-profiles
 * section, under that section's own `<h2>`, so it is an `h3`. The statements take
 * the next level down either way.
 */
export type NoticesHeadingLevel = 2 | 3;

/**
 * One statement's heading and one statement's mark — the part both treatments
 * render identically, so the two cannot drift.
 */
function StatementHeading({
  notice,
  level,
  className,
}: {
  readonly notice: StandingNotice;
  readonly level: NoticesHeadingLevel;
  readonly className?: string;
}) {
  const Heading = level === 2 ? "h3" : "h4";
  const Mark = MARKS[notice.key];

  return (
    <Heading
      className={`font-heading text-foreground flex flex-row items-start gap-3 text-lg leading-6 font-medium text-pretty${className ? ` ${className}` : ""}`}
    >
      <Mark aria-hidden="true" className="text-primary mt-1 size-4 shrink-0" />
      <span className="min-w-0 grow">{notice.heading}</span>
    </Heading>
  );
}

/** One statement's body: what is absent, then what follows from it. */
function StatementBody({ notice }: { readonly notice: StandingNotice }) {
  return notice.body.map((paragraph) => (
    <p key={paragraph} className="text-muted-foreground text-sm leading-5 text-pretty">
      {paragraph}
    </p>
  ));
}

function ExpandedStatements({ level }: { readonly level: NoticesHeadingLevel }) {
  return (
    <ul className="flex flex-col gap-5">
      {STANDING_NOTICES.map((notice) => (
        <li key={notice.key} className="flex flex-col gap-2">
          <StatementHeading notice={notice} level={level} />
          <div className="flex flex-col gap-2 pl-7">
            <StatementBody notice={notice} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * The disclosure treatment.
 *
 * **What sits behind the summary is the elaboration and never the absence.** The
 * heading — which is the absence, stated whole — is the `<summary>` and is always
 * on screen; only the two paragraphs that follow from it are one tap away. A
 * treatment that hid a heading would be answering a different question than the
 * one the brief asked.
 *
 * **The heading element goes *inside* `<summary>`**, which is valid — `summary`'s
 * content model admits one heading — and it is what keeps this treatment's
 * statements in the document outline. Without it the accessibility tree reports
 * three bare disclosure triangles, so a screen-reader user listing the page's
 * headings would not find the three things the page most wants to tell them. That
 * was read out of the tree during the prototype, not predicted.
 */
function DisclosedStatements({ level }: { readonly level: NoticesHeadingLevel }) {
  return (
    <ul className="flex flex-col">
      {STANDING_NOTICES.map((notice) => (
        <li key={notice.key} className="border-border border-t">
          <details className="group">
            {/*
              `list-none` plus an explicit chevron, because `display: flex` on the
              summary removes the browser's own marker. Measured rather than
              predicted: the first capture of this treatment had no affordance at
              all — three headings that looked like static text and opened when
              tapped. The chevron is `aria-hidden`; `<summary>` already reports its
              expanded state to the accessibility tree.
            */}
            <summary className="focus-visible:ring-ring flex cursor-pointer list-none flex-row items-start gap-3 rounded-sm py-3 focus-visible:ring-2 focus-visible:outline-none">
              <StatementHeading notice={notice} level={level} className="grow" />
              <ChevronDownIcon
                aria-hidden="true"
                className="text-muted-foreground mt-1 size-4 shrink-0 transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="flex flex-col gap-2 pb-4 pl-7">
              <StatementBody notice={notice} />
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}

/** The three notices, as one region with one accessible name. */
export function StandingNotices({
  treatment,
  level = 2,
}: {
  readonly treatment: NoticesTreatment;
  readonly level?: NoticesHeadingLevel;
}) {
  const RegionHeading = level === 2 ? "h2" : "h3";

  return (
    <section aria-labelledby={HEADING_ID}>
      <RegionHeading
        id={HEADING_ID}
        className="font-heading text-foreground text-xl leading-7 font-medium text-pretty"
      >
        {NOTICES_HEADING}
      </RegionHeading>
      <div className="mt-4">
        {treatment === "disclosure" ? (
          <DisclosedStatements level={level} />
        ) : (
          <ExpandedStatements level={level} />
        )}
      </div>
    </section>
  );
}
