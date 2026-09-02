/**
 * PROTOTYPE — throwaway. Three structurally different readings of the two public
 * lists, switchable with `?variant=`, on the real routes against real data.
 *
 * The question: what should `/` and `/profiles` look like, given that a card is
 * the whole unit of information until story 5 gives it somewhere to link?
 *
 * - **A — Muro.** The locked-in default: a three-column card grid, complete
 *   cards, a title and one line above. `/profiles` names its ordering.
 * - **B — Dos puertas.** A fuller opening carrying both doors, then a denser
 *   four-column grid: headline clamped to two lines, Skills capped at three with
 *   a `+N`. More faces per screen, less of anyone's own words. `/profiles` says
 *   nothing about how it is ordered.
 * - **C — Lista.** No cards at all: full-width rows, the headline leading and the
 *   name secondary, Skills as inline text. Phone-first density. `/profiles`
 *   frames why the list exists rather than how it sorts.
 *
 * Variant A is the real code; B and C live only here. When one wins, the winner
 * is written properly into the page and this whole directory goes to the
 * prototype branch.
 */

import { Avatar, AvatarFallback } from "@repo/design-system/components/avatar";
import { Badge } from "@repo/design-system/components/badge";
import { Separator } from "@repo/design-system/components/separator";
import { buttonVariants } from "@repo/design-system/components/button";
import { cityLabel } from "@repo/domain/policy";
import type { PublicProfile } from "@repo/domain/profiles";
import Link from "next/link";
import { displayName } from "../../profile-card";
import { CountAnnouncement } from "../count-announcement";

export const VARIANTS = ["A", "B", "C"] as const;
export type Variant = (typeof VARIANTS)[number];

export const VARIANT_NAMES: Record<Variant, string> = {
  A: "Muro — tarjetas completas",
  B: "Dos puertas — rejilla densa",
  C: "Lista — filas, sin tarjetas",
};

/** The variant a search parameter names, defaulting to the locked design. */
export function variantFrom(value: string | string[] | undefined): Variant {
  return typeof value === "string" && (VARIANTS as readonly string[]).includes(value)
    ? (value as Variant)
    : "A";
}

function initialOf(firstName: string): string {
  return [...firstName.trim()][0]?.toLocaleUpperCase("es-CO") ?? "";
}

/* ------------------------------------------------------------------ B ---- */

const SKILLS_SHOWN = 3;
const DENSE_COLUMNS = "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

function DenseCard({ profile }: { readonly profile: PublicProfile }) {
  const shown = profile.skills.slice(0, SKILLS_SHOWN);
  const hidden = profile.skills.length - shown.length;

  return (
    <article className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center gap-3">
        <Avatar size="sm" aria-hidden="true">
          <AvatarFallback>{initialOf(profile.firstName)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col">
          <span className="text-foreground truncate font-medium">
            {displayName(profile.firstName, profile.lastInitial)}
          </span>
          <span className="text-muted-foreground truncate text-sm">{cityLabel(profile.city)}</span>
        </div>
      </div>
      <p className="text-foreground line-clamp-2 text-sm text-pretty">{profile.headline}</p>
      <ul className="flex flex-wrap gap-1.5">
        {shown.map((skill) => (
          <li key={skill.slug}>
            <Badge variant="secondary">{skill.labelEs}</Badge>
          </li>
        ))}
        {hidden > 0 ? (
          <li>
            <Badge variant="outline">{`+${hidden}`}</Badge>
          </li>
        ) : null}
      </ul>
    </article>
  );
}

export function DenseGrid({ profiles }: { readonly profiles: readonly PublicProfile[] }) {
  return (
    <>
      <CountAnnouncement count={profiles.length} />
      {/* oxlint-disable-next-line no-redundant-roles -- see profile-grid.tsx. */}
      <ul className={DENSE_COLUMNS} role="list">
        {profiles.map((profile) => (
          <li key={profile.slug} className="flex">
            <div className="w-full">
              <DenseCard profile={profile} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/** B's opening: both doors, stated before the grid. */
export function TwoDoors({
  title,
  lead,
  publishLabel,
  browseLabel,
}: {
  readonly title: string;
  readonly lead: string;
  readonly publishLabel: string;
  readonly browseLabel: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-foreground text-3xl font-semibold tracking-tight text-balance">
        {title}
      </h1>
      <p className="text-muted-foreground max-w-prose text-lg text-pretty">{lead}</p>
      <div className="flex flex-wrap gap-3">
        <Link href="/publish" className={buttonVariants()}>
          {publishLabel}
        </Link>
        <Link href="/profiles" className={buttonVariants({ variant: "outline" })}>
          {browseLabel}
        </Link>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ C ---- */

function ProfileRow({ profile }: { readonly profile: PublicProfile }) {
  return (
    <article className="flex gap-4 py-4">
      <Avatar size="lg" aria-hidden="true" className="shrink-0">
        <AvatarFallback>{initialOf(profile.firstName)}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col gap-1">
        {/* The headline leads: it is the only thing nobody else could have written. */}
        <p className="text-foreground text-lg leading-6 text-pretty">{profile.headline}</p>
        <p className="text-muted-foreground text-sm">
          {displayName(profile.firstName, profile.lastInitial)} · {cityLabel(profile.city)}
        </p>
        <p className="text-muted-foreground text-sm">
          {profile.skills.map((skill) => skill.labelEs).join(" · ")}
        </p>
      </div>
    </article>
  );
}

export function ProfileRows({ profiles }: { readonly profiles: readonly PublicProfile[] }) {
  return (
    <>
      <CountAnnouncement count={profiles.length} />
      {/* oxlint-disable-next-line no-redundant-roles -- see profile-grid.tsx. */}
      <ul className="flex flex-col" role="list">
        {profiles.map((profile, index) => (
          <li key={profile.slug}>
            {index > 0 ? <Separator /> : null}
            <ProfileRow profile={profile} />
          </li>
        ))}
      </ul>
    </>
  );
}

/** C's opening: an eyebrow rather than a headline block. */
export function QuietOpening({ title, lead }: { readonly title: string; readonly lead: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-muted-foreground text-sm">{lead}</p>
      <h1 className="text-foreground text-2xl font-semibold tracking-tight">{title}</h1>
    </div>
  );
}
