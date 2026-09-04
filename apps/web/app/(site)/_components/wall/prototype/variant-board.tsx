/**
 * PROTOTYPE — Variant B, "El tablero": the tienda's notice board.
 *
 * No rows. Every profile is a note pinned to the board — her words large, a pin
 * in ink, a small tilt that straightens when you reach for it. The proposition
 * is the first note, on ink. The vocabulary runs as a tape along the top.
 */

import { Avatar, AvatarFallback, AvatarImage } from "@repo/design-system/components/avatar";
import { buttonVariants } from "@repo/design-system/components/button";
import { cn } from "@repo/design-system/lib/utils";
import { cityLabel } from "@repo/domain/policy";
import type { PublicProfile } from "@repo/domain/profiles";
import Link from "next/link";
import type { CSSProperties } from "react";
import { photoAlt, TO_BROWSE, TO_PUBLISH } from "../../../_lib/lists/messages";
import { COVER_LEAD, COVER_TITLE, publishedRecently } from "../../../_lib/wall/messages";
import { displayName, initialOf } from "../../profile-card";
import { SkillChips } from "../../profile-list/skill-chips";
import { VocabularyStrip } from "../vocabulary-strip";

const TILTS = ["-1.2deg", "0.9deg", "-0.5deg", "1.1deg", "-0.9deg", "0.6deg", "-1.4deg", "0.4deg"];

function Note({
  tilt,
  className,
  children,
}: {
  tilt: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{ "--tilt": tilt } as CSSProperties}
      className={cn(
        "relative mb-6 break-inside-avoid rounded-sm border p-5 pt-6 shadow-sm transition-transform duration-300 ease-out rotate-(--tilt) hover:-translate-y-1 hover:rotate-0 hover:shadow-md motion-reduce:transition-none",
        className,
      )}
    >
      {/* The pin. */}
      <span
        aria-hidden="true"
        className="bg-primary ring-background absolute -top-2 left-1/2 size-3.5 -translate-x-1/2 rounded-full shadow-sm ring-2"
      />
      {children}
    </div>
  );
}

export function VariantBoard({
  profiles,
  recent,
  strip,
}: {
  profiles: readonly PublicProfile[];
  recent: number;
  strip: React.ReactNode;
}) {
  return (
    <div className="bg-secondary/50 flex flex-col">
      <div className="bg-ink py-2">{strip}</div>

      <div className="mx-auto w-full max-w-6xl px-4 pt-10 pb-6 sm:px-6">
        <div className="columns-1 gap-6 sm:columns-2 lg:columns-3">
          <Note tilt="-1deg" className="bg-ink text-ink-foreground border-ink">
            <h1 className="font-heading text-3xl leading-[1.1] font-medium tracking-[-0.01em] text-balance">
              {COVER_TITLE}
            </h1>
            <p className="text-ink-muted mt-3 text-pretty">{COVER_LEAD}</p>
            <Link
              href="/publish"
              className={cn(
                buttonVariants({ size: "lg" }),
                "bg-background text-primary hover:bg-secondary hover:text-primary mt-5",
              )}
            >
              {TO_PUBLISH}
            </Link>
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
                <div className="flex flex-col gap-3">
                  <p className="font-heading text-2xl leading-7 font-medium text-pretty">
                    {profile.headline}
                  </p>
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
                </div>
              </Note>
            );
          })}
        </div>

        <Link href="/profiles" className={cn(buttonVariants({ variant: "outline" }), "mt-2")}>
          {TO_BROWSE}
        </Link>
      </div>
    </div>
  );
}

export { VocabularyStrip };
