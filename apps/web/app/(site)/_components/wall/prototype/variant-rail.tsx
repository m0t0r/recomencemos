/**
 * PROTOTYPE — Variant E, "El índice" rethought for the thumb.
 *
 * The cover is a short ink band — the proposition, and the one action, full
 * width so the thumb cannot miss it. The index is the thing the phone does that
 * a desktop cannot: a rail pinned to the bottom of the viewport, in the zone one
 * hand reaches, snapping chip to chip, most-held Skills first, each with its
 * real count. Tap a chip and the page keeps only the people who hold it and
 * scrolls to the first; tap it again, or "Ver todos", and everyone is back.
 *
 * The rail is `sticky` and the last child of the variant, so it holds the bottom
 * edge while the list is on screen and leaves with it. Each chip is a link to
 * the list, which is what the tap does with JavaScript unavailable.
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

export function VariantRail({
  profiles,
  entries,
  recent,
}: {
  profiles: readonly PublicProfile[];
  entries: readonly VocabularyEntryWithCount[];
  recent: number;
}) {
  const held = entries
    .filter((entry) => entry.count > 0)
    .toSorted((a, b) => b.count - a.count || a.labelEs.localeCompare(b.labelEs));

  return (
    <Highlighter>
      <section className="bg-ink text-ink-foreground" aria-labelledby="cover-heading">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 pt-8 pb-8 sm:pt-12 sm:pb-10">
          <h1
            id="cover-heading"
            className="font-heading text-3xl leading-[1.1] font-medium tracking-[-0.01em] text-balance sm:text-5xl"
          >
            {COVER_TITLE}
          </h1>
          <p className="text-ink-muted max-w-prose leading-6 text-pretty sm:text-lg sm:leading-7">
            {COVER_LEAD}
          </p>
          <Link
            href="/publish"
            className={cn(
              buttonVariants({ size: "lg" }),
              "bg-background text-primary hover:bg-secondary hover:text-primary focus-visible:ring-ink-muted/60 w-full sm:w-auto sm:self-start",
            )}
          >
            {TO_PUBLISH}
          </Link>
        </div>
      </section>

      <section
        id="profiles"
        aria-labelledby="recent-heading"
        className="mx-auto flex w-full max-w-5xl scroll-mt-4 flex-col gap-4 px-4 pt-8 pb-6 sm:pt-12"
      >
        <h2
          id="recent-heading"
          className="font-heading text-2xl font-medium tracking-[-0.01em] sm:text-3xl"
        >
          {RECENT_HEADING}
        </h2>
        <p className="text-muted-foreground text-sm">
          {recent > 0 ? publishedRecently(recent) : null}
        </p>
        <p
          className="flex flex-wrap items-baseline gap-x-3 has-[span:empty]:hidden"
          aria-live="polite"
        >
          <span data-status className="text-primary font-medium" />
          <button
            type="button"
            data-clear
            hidden
            className="text-muted-foreground rounded-sm text-sm underline underline-offset-4"
          >
            Ver todos
          </button>
        </p>
        <div className="max-w-3xl">
          <PeopleRows profiles={profiles} dim="hide" />
        </div>
        <Link href="/profiles" className={cn(buttonVariants({ variant: "outline" }), "self-start")}>
          {TO_BROWSE}
        </Link>
      </section>

      {/* The rail: the index, where the thumb is. */}
      <nav
        aria-label="Índice: lo que la gente sabe hacer, con cuántas personas"
        className="bg-background/95 border-border sticky bottom-0 z-10 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <ul className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <li className="text-muted-foreground flex shrink-0 items-center pr-1 text-xs font-medium tracking-wide uppercase">
            Índice
          </li>
          {held.map((entry) => (
            <li key={entry.slug} className="snap-start shrink-0">
              <a
                href="#profiles"
                data-term={entry.slug}
                data-label={entry.labelEs}
                className={cn(
                  "border-primary/40 text-foreground flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-sm whitespace-nowrap transition-colors",
                  "hover:bg-secondary data-[state=active]:bg-secondary",
                  "data-[state=pinned]:bg-primary data-[state=pinned]:text-primary-foreground data-[state=pinned]:border-primary",
                )}
              >
                <span>{entry.labelEs}</span>
                <span className="text-muted-foreground text-xs tabular-nums in-data-[state=pinned]:text-primary-foreground/80">
                  {entry.count}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </Highlighter>
  );
}
