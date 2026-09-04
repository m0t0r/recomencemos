/**
 * PROTOTYPE — Variant C, "Los oficios": the vocabulary is the first viewport.
 *
 * Ninety-one things people here can do, set as one field of type on ink, each
 * sized by how many people hold it — real counts. Hover one and it fills; tap it
 * and the page scrolls to the people who can do it, the rest fading. The
 * proposition is a small paragraph in the corner; the field is the argument.
 */

import { buttonVariants } from "@repo/design-system/components/button";
import { cn } from "@repo/design-system/lib/utils";
import type { PublicProfile } from "@repo/domain/profiles";
import type { VocabularyEntryWithCount } from "@repo/domain/skills";
import Link from "next/link";
import { TO_BROWSE, TO_PUBLISH } from "../../../_lib/lists/messages";
import { COVER_LEAD, publishedRecently, RECENT_HEADING } from "../../../_lib/wall/messages";
import { Highlighter } from "./highlighter";
import { PeopleRows } from "./people-rows";

/** Four sizes by quartile of count, so the field has a hierarchy the data earns. */
function tier(count: number, thresholds: readonly number[]): string {
  if (count >= thresholds[2]!) return "text-2xl sm:text-5xl";
  if (count >= thresholds[1]!) return "text-xl sm:text-4xl";
  if (count >= thresholds[0]!) return "text-lg sm:text-2xl";
  return "text-base sm:text-lg";
}

export function VariantField({
  profiles,
  entries,
  recent,
}: {
  profiles: readonly PublicProfile[];
  entries: readonly VocabularyEntryWithCount[];
  recent: number;
}) {
  const counts = entries.map((e) => e.count).toSorted((a, b) => a - b);
  const at = (q: number) => counts[Math.min(counts.length - 1, Math.floor(counts.length * q))] ?? 0;
  const thresholds = [at(0.25), at(0.6), at(0.88)];
  // Deterministic mix so the big ones are spread through the field.
  const mixed = entries.toSorted(
    (a, b) =>
      ((a.slug.length * 7919) % 97) - ((b.slug.length * 7919) % 97) || a.slug.localeCompare(b.slug),
  );

  return (
    <Highlighter>
      <section className="bg-ink text-ink-foreground" aria-label="Lo que la gente sabe hacer">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pt-10 pb-10 sm:px-6 sm:pt-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <p className="text-ink-muted max-w-md text-lg leading-7 text-pretty">{COVER_LEAD}</p>
            <Link
              href="/publish"
              className={cn(
                buttonVariants({ size: "lg" }),
                "bg-background text-primary hover:bg-secondary hover:text-primary",
              )}
            >
              {TO_PUBLISH}
            </Link>
          </div>

          <p className="font-heading leading-[1.2] text-pretty">
            {mixed.map((entry) => (
              <button
                key={entry.slug}
                type="button"
                data-term={entry.slug}
                data-label={entry.labelEs}
                className={cn(
                  "mx-[0.2em] inline rounded-sm px-1 align-baseline font-medium transition-colors duration-200",
                  "hover:bg-ink-foreground hover:text-ink data-[state=active]:bg-ink-foreground data-[state=active]:text-ink data-[state=pinned]:bg-ink-foreground data-[state=pinned]:text-ink",
                  tier(entry.count, thresholds),
                )}
              >
                {entry.labelEs}
              </button>
            ))}
          </p>
        </div>
      </section>

      <section
        id="profiles"
        aria-labelledby="recent-heading"
        className="mx-auto flex w-full max-w-5xl scroll-mt-14 flex-col gap-6 px-4 pt-12 pb-4 sm:px-6"
      >
        <h2 id="recent-heading" className="font-heading text-3xl font-medium tracking-[-0.01em]">
          {RECENT_HEADING}
        </h2>
        <p className="text-muted-foreground min-h-6" aria-live="polite">
          <span data-status className="text-primary font-medium" />{" "}
          {recent > 0 ? publishedRecently(recent) : null}
        </p>
        <div className="max-w-3xl">
          <PeopleRows profiles={profiles} />
        </div>
        <Link href="/profiles" className={cn(buttonVariants({ variant: "outline" }), "self-start")}>
          {TO_BROWSE}
        </Link>
      </section>
    </Highlighter>
  );
}
