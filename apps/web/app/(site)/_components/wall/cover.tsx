/**
 * The cover: the one region in the product painted solid ink (`DESIGN.md` →
 * The world). It carries the proposition, one primary action — hers — and the
 * vocabulary strip beneath.
 *
 * **One primary, and it is hers.** A Hirer needs no button: the list below is
 * what he came for, so his way down the page is a link that names it. That is
 * the decision the brief took at `/prototype` and it survives the redesign —
 * two primaries in one viewport is no primary at all.
 *
 * **The action is paper on ink.** On the cover the default button would be ink
 * on ink, so the variant inverts at the call site: paper ground, ink text. It is
 * still the registry's button and still its `lg` size.
 *
 * The heading is the only type in the product above the ladder: 36 px on a
 * phone, larger above, because the cover is the one place display type has a
 * region to fill. `text-balance` keeps three lines from ending on a single word.
 */

import { buttonVariants } from "@repo/design-system/components/button-variants";
import { cn } from "@repo/design-system/lib/utils";
import Link from "next/link";
import type { ReactNode } from "react";
import { TO_PUBLISH } from "../../_lib/lists/messages";
import { COVER_LEAD, COVER_TITLE, COVER_TO_PROFILES } from "../../_lib/wall/messages";

export function Cover({ strip, profilesId }: { strip: ReactNode; profilesId: string }) {
  return (
    <section className="bg-ink text-ink-foreground" aria-labelledby="cover-heading">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pt-14 pb-10 sm:gap-10 sm:pt-24 sm:pb-14">
        <div className="flex max-w-3xl flex-col gap-5">
          <h1
            id="cover-heading"
            className="font-heading text-4xl leading-[1.1] font-medium tracking-[-0.01em] text-balance sm:text-5xl lg:text-6xl"
          >
            {COVER_TITLE}
          </h1>
          <p className="text-ink-muted max-w-prose text-lg leading-7 text-pretty sm:text-xl sm:leading-8">
            {COVER_LEAD}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link
            href="/publish"
            /*
              `cn`, not `buttonVariants({ className })`: the variant function
              concatenates, so its own `bg-primary` and this `bg-background` both
              reached the element and the stylesheet's order decided — ink on
              ink, which is what the first screenshot showed. `cn` merges, and
              the later class wins.
            */
            className={cn(
              buttonVariants({ size: "lg" }),
              "bg-background text-primary hover:bg-secondary hover:text-primary focus-visible:ring-ink-muted/60",
            )}
          >
            {TO_PUBLISH}
          </Link>
          <a
            href={`#${profilesId}`}
            className="text-ink-foreground hover:text-ink-muted focus-visible:ring-ink-muted/60 rounded-sm underline underline-offset-4 focus-visible:ring-3 focus-visible:outline-none"
          >
            {COVER_TO_PROFILES}
          </a>
        </div>
      </div>

      <div className="pb-8 sm:pb-10">{strip}</div>
    </section>
  );
}
