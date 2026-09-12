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
 * disclosure is `<details>`, which is native HTML and opens with the script tag
 * removed.
 *
 * **Nothing here is `destructive`.** `DESIGN.md` reserves that triad for a limit
 * of the platform — which these are — but painting three of them on the first
 * screen of the Wall would make the product read as a warning label. The mark
 * beside each statement is `aria-hidden` and redundant with a heading that says
 * the same thing in words, which is how "not conveyed by colour alone" is met
 * rather than argued.
 */

import { Separator } from "@repo/design-system/components/separator";
import { cn } from "@repo/design-system/lib/utils";
import { BanknoteIcon, ChevronDownIcon, MessageSquareOffIcon, ShieldOffIcon } from "lucide-react";
import * as React from "react";
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
 * them** — it is `disclosure` where the notices sit next to content the reader
 * came for, and `expanded` where they do not:
 *
 * - `disclosure` — every heading and every lead is on screen; only the detail is
 *   a tap away. Used on `/` and `/profiles`, where — above the list, as they
 *   were until #276 — showing the detail too pushed the first profile row
 *   entirely below the fold, and the Wall's whole job is that a reader meets
 *   three or four people and forms a view. At the foot it stays `disclosure`,
 *   so the explanation is one tap away rather than a run of platform prose
 *   after the last person.
 * - `expanded` — heading, lead and detail all read in full. Used on
 *   `/my-profile`, where the notices sit at the foot and compete with nothing.
 *
 * **What a tap hides is never a criterion.** `messages.ts` splits each statement
 * into a `lead` that is always on screen and a `detail` that is not, precisely so
 * this prop cannot decide what the product does or does not say — only how much
 * of the explanation is in front of the reader before they ask for it.
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
const MARKS: Record<StandingNotice["key"], React.ComponentType<{ className?: string }>> = {
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
 * section, under that section's own `<h2>`, so it is an `h3`.
 */
export type NoticesHeadingLevel = 2 | 3;

/**
 * The two tags a level implies, resolved in one place.
 *
 * They were two ternaries in two components, which is one switch on one primitive
 * written twice — so admitting a level 4 meant editing both and agreeing with
 * yourself. Here the statement's level is the region's plus one by construction.
 */
function headingTags(level: NoticesHeadingLevel) {
  return level === 2
    ? ({ region: "h2", statement: "h3" } as const)
    : ({ region: "h3", statement: "h4" } as const);
}

/**
 * One statement's heading and mark — the part both treatments render identically,
 * so the two cannot drift.
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
  const Heading = headingTags(level).statement;
  const Mark = MARKS[notice.key];

  return (
    <Heading
      className={cn(
        "font-heading text-foreground flex flex-row items-start gap-3 text-lg leading-6 font-medium text-pretty",
        className,
      )}
    >
      <Mark aria-hidden="true" className="text-primary mt-1 size-4 shrink-0" />
      <span className="min-w-0 grow">{notice.heading}</span>
    </Heading>
  );
}

/**
 * Everything below a statement's heading in the expanded treatment, indented past
 * the mark so the text hangs off the heading rather than off the edge of the
 * column.
 *
 * The lead comes first and the detail follows it. The split itself lives in
 * `messages.ts` and the reason is there — a criterion may never be the thing a
 * tap hides — and this treatment hides nothing, so it simply reads them in order.
 */
function StatementText({ notice }: { readonly notice: StandingNotice }) {
  return (
    <div className="flex flex-col gap-2 pl-7">
      {[notice.lead, ...notice.detail].map((paragraph) => (
        <p key={paragraph} className="text-muted-foreground text-sm leading-5 text-pretty">
          {paragraph}
        </p>
      ))}
    </div>
  );
}

/**
 * Both treatments are a ruled list, which is `DESIGN.md` → Layout: _"Every list
 * is a ruled page. Rows are separated by the ruling."_
 *
 * `Separator` from the registry rather than a `border-t`, and it sits **inside**
 * the `<li>` rather than between two of them — the shape
 * `profile-list/profile-row.tsx` already uses, because a `<ul>` may not hold a
 * `<div>` as a direct child. The `ruled-page` utility is deliberately not used:
 * it carries the rose margin line, and on the Wall this list sits directly above
 * the profile list that owns one, so a second would read as two margins rather
 * than as one page.
 */
function StatementList({ children }: { readonly children: React.ReactNode }) {
  return <ul className="flex flex-col">{children}</ul>;
}

function ExpandedStatements({ level }: { readonly level: NoticesHeadingLevel }) {
  return (
    <StatementList>
      {STANDING_NOTICES.map((notice, index) => (
        <li key={notice.key} className="flex flex-col gap-2">
          {index > 0 ? <Separator className="my-5" /> : null}
          <StatementHeading notice={notice} level={level} />
          <StatementText notice={notice} />
        </li>
      ))}
    </StatementList>
  );
}

/**
 * The disclosure treatment.
 *
 * **What sits behind the summary is the detail and never a criterion.** Each
 * statement's heading and its lead are always on screen; only the elaboration is
 * a tap away. The first cut of this component put the whole body behind the
 * summary, and `/code-review` found that two clauses the ticket names by hand —
 * a Hirer's details being self-asserted, and a Block not removing her from the
 * Wall — were then hidden by default on the two surfaces where they matter most.
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
    <StatementList>
      {STANDING_NOTICES.map((notice, index) => (
        <li key={notice.key}>
          {index > 0 ? <Separator className="my-4" /> : null}
          <details className="group">
            {/*
              `list-none` plus an explicit chevron, because `display: flex` on the
              summary removes the browser's own marker. Measured rather than
              predicted: the first capture of this treatment had no affordance at
              all — three headings that looked like static text and opened when
              tapped. The chevron is `aria-hidden`; `<summary>` already reports its
              expanded state to the accessibility tree.
            */}
            {/*
              **The lead is in the `<summary>`, and it has to be.** Everything
              after the summary inside a `<details>` is what the disclosure hides,
              so a lead placed there would be exactly the bug this split was
              introduced to fix — which is what happened on the first attempt.

              A grid rather than a flex row because the summary now carries two
              rows, and because its children have to stay valid: `summary` admits
              phrasing content intermixed with **one heading**, so the heading
              element, the chevron and a `<span>` are all allowed where a wrapping
              `<div>` would not be. The lead is therefore a `span` here and a `p`
              in the expanded treatment — same sentence, same source.
            */}
            <summary className="focus-visible:ring-ring grid cursor-pointer list-none grid-cols-[1fr_auto] items-start gap-x-3 gap-y-2 rounded-sm py-3 focus-visible:ring-2 focus-visible:outline-none">
              <StatementHeading notice={notice} level={level} />
              <ChevronDownIcon
                aria-hidden="true"
                className="text-muted-foreground mt-1 size-4 shrink-0 transition-transform group-open:rotate-180"
              />
              <span className="text-muted-foreground col-span-2 pl-7 text-sm leading-5 text-pretty">
                {notice.lead}
              </span>
            </summary>
            <div className="flex flex-col gap-2 pb-4 pl-7">
              {notice.detail.map((paragraph) => (
                <p key={paragraph} className="text-muted-foreground text-sm leading-5 text-pretty">
                  {paragraph}
                </p>
              ))}
            </div>
          </details>
        </li>
      ))}
    </StatementList>
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
  const RegionHeading = headingTags(level).region;

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
