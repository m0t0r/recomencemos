/**
 * PROTOTYPE — Variant A, "El índice": the notebook open as a spread.
 *
 * On a wide screen the left page is the ink cover and stays put while the right
 * page scrolls: the proposition, the action, and the vocabulary as an *index* —
 * every Skill with how many people hold it. Hover a line and the people on the
 * right who can do it stay lit while the rest fade; tap to pin. On a phone the
 * index is a snapping rail of chips under the cover.
 */

import { buttonVariants } from "@repo/design-system/components/button";
import { cn } from "@repo/design-system/lib/utils";
import type { PublicProfile } from "@repo/domain/profiles";
import type { VocabularyEntryWithCount } from "@repo/domain/skills";
import Link from "next/link";
import { TO_BROWSE, TO_PUBLISH } from "../../../_lib/lists/messages";
import {
  COVER_LEAD,
  COVER_TITLE,
  publishedRecently,
  RECENT_HEADING,
} from "../../../_lib/wall/messages";
import { Highlighter } from "./highlighter";
import { PeopleRows } from "./people-rows";

const termClass =
  "data-[state=active]:bg-ink-foreground data-[state=active]:text-ink data-[state=pinned]:bg-ink-foreground data-[state=pinned]:text-ink";

export function VariantIndex({
  profiles,
  entries,
  recent,
}: {
  profiles: readonly PublicProfile[];
  entries: readonly VocabularyEntryWithCount[];
  recent: number;
}) {
  const held = entries.filter((entry) => entry.count > 0);

  return (
    <Highlighter>
      <div className="lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* The left page: the cover, and it stays while the right page scrolls. */}
        <aside className="bg-ink text-ink-foreground flex flex-col gap-6 px-4 pt-10 pb-6 sm:px-8 lg:sticky lg:top-14 lg:h-[calc(100svh-3.5rem)] lg:overflow-hidden lg:pt-14">
          <h1 className="font-heading text-4xl leading-[1.1] font-medium tracking-[-0.01em] text-balance xl:text-5xl">
            {COVER_TITLE}
          </h1>
          <p className="text-ink-muted max-w-prose text-lg leading-7 text-pretty">{COVER_LEAD}</p>
          <Link
            href="/publish"
            className={cn(
              buttonVariants({ size: "lg" }),
              "bg-background text-primary hover:bg-secondary hover:text-primary self-start",
            )}
          >
            {TO_PUBLISH}
          </Link>

          {/* The index. A rail on a phone, a column on a wide screen. */}
          <div className="border-ink-muted/30 -mx-4 mt-2 border-t pt-4 sm:-mx-8 lg:mx-0 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-2">
            <p className="text-ink-muted px-4 pb-3 text-sm sm:px-8 lg:px-0" aria-hidden="true">
              Índice
            </p>
            <ul
              className="flex snap-x gap-2 overflow-x-auto px-4 pb-2 sm:px-8 lg:flex-col lg:gap-0 lg:overflow-visible lg:px-0"
              aria-label="Lo que la gente sabe hacer, con cuántas personas"
            >
              {held.map((entry) => (
                <li key={entry.slug} className="snap-start shrink-0 lg:shrink">
                  <button
                    type="button"
                    data-term={entry.slug}
                    data-label={entry.labelEs}
                    className={cn(
                      "border-ink-muted/40 flex items-baseline gap-3 rounded-full border px-3 py-1.5 text-left text-sm whitespace-nowrap transition-colors lg:w-full lg:justify-between lg:rounded-none lg:border-0 lg:border-b lg:px-1 lg:py-2 lg:text-base lg:whitespace-normal",
                      "font-heading lg:text-lg",
                      termClass,
                    )}
                  >
                    <span>{entry.labelEs}</span>
                    <span className="text-ink-muted font-sans text-xs tabular-nums data-[state=active]:text-inherit">
                      {entry.count}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* The right page: the people. */}
        <section
          id="profiles"
          aria-labelledby="recent-heading"
          className="flex flex-col gap-6 px-4 pt-10 pb-4 sm:px-8 lg:pt-14"
        >
          <h2 id="recent-heading" className="font-heading text-3xl font-medium tracking-[-0.01em]">
            {RECENT_HEADING}
          </h2>
          <p className="text-muted-foreground min-h-6" aria-live="polite">
            <span data-status className="text-primary font-medium" />
            <span className="data-[hidden]:hidden">
              {recent > 0 ? ` ${publishedRecently(recent)}` : null}
            </span>
          </p>
          <PeopleRows profiles={profiles} />
          <Link
            href="/profiles"
            className={cn(buttonVariants({ variant: "outline" }), "self-start")}
          >
            {TO_BROWSE}
          </Link>
        </section>
      </div>
    </Highlighter>
  );
}
