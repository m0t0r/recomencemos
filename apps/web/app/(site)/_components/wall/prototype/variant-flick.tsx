/**
 * PROTOTYPE — Variant F, "Los oficios" as a phone gesture.
 *
 * The first thing on the screen is the field of type on ink: everything people
 * here can do, sized by how many of them can do it — real counts. On a phone it
 * is tall, and that is the point: the thumb flicks through it the way it flicks
 * through anything, and the big phrases surface as it goes. Tap one and the bar
 * at the bottom says how many people on this page hold it, and the page scrolls
 * to the first of them.
 *
 * The proposition is one short paragraph above the field. The action is not in
 * the cover at all: it sits in a bar pinned to the bottom of the viewport, so
 * it is under the thumb at the top of the field and at the bottom of the list
 * alike. Every phrase is a link to the list, which is the tap's meaning with
 * JavaScript unavailable.
 */

import { buttonVariants } from "@repo/design-system/components/button";
import { cn } from "@repo/design-system/lib/utils";
import type { PublicProfile } from "@repo/domain/profiles";
import type { VocabularyEntryWithCount } from "@repo/domain/skills";
import Link from "next/link";
import { TO_BROWSE } from "../../../_lib/lists/messages";
import {
  COVER_LEAD,
  COVER_TITLE,
  publishedRecently,
  RECENT_HEADING,
} from "../../../_lib/wall/messages";
import { Highlighter } from "./highlighter";
import { PeopleRows } from "./people-rows";
import { StickyAction } from "./sticky-action";

/** Four sizes by quartile of count, so the field has a hierarchy the data earns. */
function tier(count: number, thresholds: readonly number[]): string {
  if (count >= thresholds[2]!) return "text-4xl sm:text-6xl";
  if (count >= thresholds[1]!) return "text-2xl sm:text-4xl";
  if (count >= thresholds[0]!) return "text-xl sm:text-3xl";
  return "text-lg sm:text-2xl";
}

export function VariantFlick({
  profiles,
  entries,
  recent,
}: {
  profiles: readonly PublicProfile[];
  entries: readonly VocabularyEntryWithCount[];
  recent: number;
}) {
  const held = entries.filter((entry) => entry.count > 0);
  const counts = held.map((e) => e.count).toSorted((a, b) => a - b);
  const at = (q: number) => counts[Math.min(counts.length - 1, Math.floor(counts.length * q))] ?? 0;
  const thresholds = [at(0.25), at(0.6), at(0.88)];
  // Deterministic mix so the big ones are spread through the field.
  const mixed = held.toSorted(
    (a, b) =>
      ((a.slug.length * 7919) % 97) - ((b.slug.length * 7919) % 97) || a.slug.localeCompare(b.slug),
  );

  return (
    <Highlighter>
      <section className="bg-ink text-ink-foreground" aria-label="Lo que la gente sabe hacer">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-8 pb-12 sm:px-6 sm:pt-12">
          {/* The field is the title a sighted reader gets; this one is for everyone else. */}
          <h1 className="sr-only">{COVER_TITLE}</h1>
          <p className="text-ink-muted max-w-md leading-6 text-pretty sm:text-lg sm:leading-7">
            {COVER_LEAD}
          </p>

          <p className="font-heading leading-[1.15] text-pretty">
            {mixed.map((entry) => (
              <a
                key={entry.slug}
                href="#profiles"
                data-term={entry.slug}
                data-label={entry.labelEs}
                className={cn(
                  "mx-[0.15em] inline-block max-w-full rounded-sm px-1 py-0.5 align-baseline font-medium transition-colors duration-200",
                  "hover:bg-ink-foreground hover:text-ink data-[state=active]:bg-ink-foreground data-[state=active]:text-ink data-[state=pinned]:bg-ink-foreground data-[state=pinned]:text-ink",
                  tier(entry.count, thresholds),
                )}
              >
                {entry.labelEs}
              </a>
            ))}
          </p>
        </div>
      </section>

      <section
        id="profiles"
        aria-labelledby="recent-heading"
        className="mx-auto flex w-full max-w-5xl scroll-mt-4 flex-col gap-4 px-4 pt-8 pb-6 sm:px-6 sm:pt-12"
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
        <div className="max-w-3xl">
          <PeopleRows profiles={profiles} dim="hide" />
        </div>
        <Link href="/profiles" className={cn(buttonVariants({ variant: "outline" }), "self-start")}>
          {TO_BROWSE}
        </Link>
      </section>

      <StickyAction>
        <p
          className="flex flex-wrap items-baseline gap-x-3 text-sm has-[span:empty]:hidden"
          aria-live="polite"
        >
          <span data-status className="text-primary font-medium" />
          <button
            type="button"
            data-clear
            hidden
            className="text-muted-foreground rounded-sm underline underline-offset-4"
          >
            Ver todos
          </button>
        </p>
      </StickyAction>
    </Highlighter>
  );
}
