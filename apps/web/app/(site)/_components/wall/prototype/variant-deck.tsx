/**
 * PROTOTYPE — Variant G, "El tablero" as a one-column deck.
 *
 * On a phone the board is a deck of notes the thumb deals through, one per
 * flick: the page snaps note to note, so each person's words arrive whole and
 * at rest rather than half-cut at the fold. The proposition is the first note,
 * on ink; every other note is her headline large, who and where, and her
 * Skills; the last note is the way to the full list.
 *
 * The action is not on the first note, because a note scrolls away. It sits in
 * a bar pinned to the bottom of the viewport, reachable from any note without
 * scrolling back up. There is no vocabulary tape: on a phone it is a moving
 * thing at the top of a screen the thumb is about to leave.
 *
 * The snapping is `proximity`, not `mandatory`: a note taller than the viewport
 * must still be readable to its end, and a flick that lands between two notes
 * settles on one only when it is near.
 */

import { Avatar, AvatarFallback, AvatarImage } from "@repo/design-system/components/avatar";
import { buttonVariants } from "@repo/design-system/components/button";
import { cn } from "@repo/design-system/lib/utils";
import { cityLabel } from "@repo/domain/policy";
import type { PublicProfile } from "@repo/domain/profiles";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { photoAlt, TO_BROWSE } from "../../../_lib/lists/messages";
import { COVER_LEAD, COVER_TITLE, publishedRecently } from "../../../_lib/wall/messages";
import { displayName, initialOf } from "../../profile-card";
import { SkillChips } from "../../profile-list/skill-chips";
import { StickyAction } from "./sticky-action";

const TILTS = ["-0.6deg", "0.5deg", "-0.4deg", "0.6deg"];

function Note({
  tilt,
  snap = true,
  className,
  children,
}: {
  tilt: string;
  /** The first note is not a snap target: the page must open at its top, header and all. */
  snap?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <li
      style={{ "--tilt": tilt } as CSSProperties}
      className={cn(
        "relative rounded-sm border p-5 pt-6 shadow-sm rotate-(--tilt) sm:break-inside-avoid",
        snap && "snap-start scroll-mt-4",
        className,
      )}
    >
      {/* The pin. */}
      <span
        aria-hidden="true"
        className="bg-primary ring-background absolute -top-2 left-1/2 size-3.5 -translate-x-1/2 rounded-full shadow-sm ring-2"
      />
      {children}
    </li>
  );
}

export function VariantDeck({
  profiles,
  recent,
}: {
  profiles: readonly PublicProfile[];
  recent: number;
}) {
  return (
    <div className="bg-secondary/50">
      {/* Document-level snapping on a phone only; a prototype's one global rule. */}
      <style>{`@media (max-width: 639px) { html { scroll-snap-type: y proximity; } }`}</style>

      <ol className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-6 pb-8 sm:grid sm:grid-cols-2 sm:items-start sm:px-6 sm:pt-10 lg:grid-cols-3">
        <Note tilt="-0.8deg" snap={false} className="bg-ink text-ink-foreground border-ink">
          <h1 className="font-heading text-3xl leading-[1.1] font-medium tracking-[-0.01em] text-balance">
            {COVER_TITLE}
          </h1>
          <p className="text-ink-muted mt-3 leading-6 text-pretty">{COVER_LEAD}</p>
          {recent > 0 ? (
            <p className="text-ink-muted mt-4 text-sm">{publishedRecently(recent)}</p>
          ) : null}
        </Note>

        {profiles.map((profile, index) => {
          const name = displayName(profile.firstName, profile.lastInitial);
          return (
            <Note
              key={profile.slug}
              tilt={TILTS[index % TILTS.length]!}
              className="bg-background border-border"
            >
              <article className="flex flex-col gap-3">
                <h2 className="font-heading text-[1.75rem] leading-8 font-medium text-pretty">
                  {profile.headline}
                </h2>
                <div className="flex items-center gap-2">
                  <Avatar size="sm" aria-hidden={profile.photoUrl ? undefined : true}>
                    {profile.photoUrl ? (
                      <AvatarImage src={profile.photoUrl} alt={photoAlt(name)} />
                    ) : null}
                    <AvatarFallback>{initialOf(profile.firstName)}</AvatarFallback>
                  </Avatar>
                  <p className="text-muted-foreground text-sm">
                    {name} · {cityLabel(profile.city)}
                  </p>
                </div>
                <SkillChips skills={profile.skills} />
              </article>
            </Note>
          );
        })}

        <li className="snap-start scroll-mt-4 flex">
          <Link
            href="/profiles"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full sm:w-auto")}
          >
            {TO_BROWSE}
          </Link>
        </li>
      </ol>

      <StickyAction />
    </div>
  );
}
