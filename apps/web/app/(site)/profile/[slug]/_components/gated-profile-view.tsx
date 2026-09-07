/**
 * One Worker's profile, as a signed-in Hirer reads it.
 *
 * **Sync and prop-driven**, which is the shape `own-profile-view.tsx` set and
 * for the same reason: the async page above it cannot be tested under happy-dom,
 * and what is worth pinning is here — that her free-text fields render as
 * **content and never as a URL**, and that the four held fields are absent from
 * the markup whatever the projection did.
 *
 * **Her headline is the `<h1>`.** That is the same hierarchy the row on the Wall
 * argues for — she is described by what she can do — carried through to the page
 * the row leads to. Her name is under it, in the working face, beside her city.
 * A page whose heading was her name would be a page about a person rather than
 * about a capability, and the one thing this product will not do is describe
 * someone by what happened to her.
 *
 * **The work history arrives as a promise**, not as an array. The page streams
 * it inside its own Suspense boundary, so this component takes what it can
 * render now and hands the rest to {@link WorkHistorySection}, which suspends on
 * it. Passing the resolved array instead would make that boundary decorative.
 */

import { Avatar, AvatarFallback, AvatarImage } from "@repo/design-system/components/avatar";
import { Skeleton } from "@repo/design-system/components/skeleton";
import { cityLabel } from "@repo/domain/policy";
import type { GatedIdentity } from "@repo/domain/profiles";
import { Suspense, use } from "react";
import { displayName, initialOf } from "@/app/(site)/_components/profile-card";
import { SkillChips } from "@/app/(site)/_components/profile-list/skill-chips";
import { photoAlt } from "@/app/(site)/_lib/lists/messages";
import { ABOUT_HEADING, NOTHING_MORE, WORK_HISTORY_HEADING } from "../_lib/messages";
import { BackToList } from "./back-to-list";

export interface GatedProfileViewProps {
  readonly profile: GatedIdentity;
  /**
   * Her work history, still in flight. A promise rather than an array so the
   * boundary below it is real — see the class comment.
   */
  readonly workHistory: Promise<readonly string[]>;
}

function Section({
  id,
  heading,
  children,
}: {
  readonly id: string;
  readonly heading: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="border-border flex flex-col gap-3 border-t py-7 first:border-t-0 first:pt-0"
    >
      <h2 id={id} className="font-heading text-foreground text-2xl leading-8 font-medium">
        {heading}
      </h2>
      {children}
    </section>
  );
}

/**
 * Lines are positional data with no id of their own and never reorder on the
 * client, so a duplicate line is keyed by how many times it has appeared — the
 * same rule `own-profile-view.tsx` states, because it is the same data read from
 * the other side.
 */
function WorkHistoryList({ lines }: { readonly lines: readonly string[] }) {
  const seen = new Map<string, number>();
  return (
    <ul className="text-foreground flex list-disc flex-col gap-2 pl-5">
      {lines.map((line) => {
        const occurrence = (seen.get(line) ?? 0) + 1;
        seen.set(line, occurrence);
        return (
          <li key={`${line}#${occurrence}`} className="text-pretty">
            {line}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The streamed half. `use()` suspends here rather than in the parent, so the
 * heading above it and everything before it paint on the first flush.
 *
 * A profile with no lines renders **nothing at all** rather than an empty
 * section: she published without a work history, which is a complete profile,
 * and a heading over a blank space would read as something that failed to load.
 * {@link NOTHING_MORE} covers the case where she wrote neither field, and it
 * sits with the self-description because that is the section the reader is
 * looking at when both are missing.
 */
function WorkHistorySection({ lines }: { readonly lines: Promise<readonly string[]> }) {
  const history = use(lines);
  if (history.length === 0) return null;

  return (
    <Section id="work-history-heading" heading={WORK_HISTORY_HEADING}>
      <WorkHistoryList lines={history} />
    </Section>
  );
}

/**
 * The fallback, at the entry height — the spec's boundary table asks for
 * "skeleton lines at the entry height", and holding the layout is what stops the
 * link at the foot of the page moving under a thumb that is reaching for it.
 *
 * The heading is **in** the fallback rather than above the boundary, because the
 * section may resolve to nothing at all: a heading painted outside it would
 * announce a section that then never arrives.
 */
function WorkHistorySkeleton() {
  return (
    <div className="border-border flex flex-col gap-3 border-t py-7" aria-hidden="true">
      <Skeleton className="h-8 w-56" />
      <div className="flex flex-col gap-2 pl-5">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-5 w-2/3" />
      </div>
    </div>
  );
}

export function GatedProfileView({ profile, workHistory }: GatedProfileViewProps) {
  const name = displayName(profile.firstName, profile.lastInitial);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex gap-4">
        {/*
          The initial is the approved-photo-absent state and it is also the
          pending state: one shape, two causes, never a badge. `aria-hidden`
          while it holds an initial, because the name is announced anyway.
        */}
        <Avatar size="lg" className="shrink-0" aria-hidden={profile.photoUrl ? undefined : true}>
          {profile.photoUrl ? <AvatarImage src={profile.photoUrl} alt={photoAlt(name)} /> : null}
          <AvatarFallback>{initialOf(profile.firstName)}</AvatarFallback>
        </Avatar>

        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            {/* Her own words, in the display face. The one line nobody else could have written. */}
            <h1 className="page-heading">{profile.headline}</h1>
            <p className="text-muted-foreground text-sm">
              {name} · {cityLabel(profile.city)}
            </p>
          </div>
          <SkillChips skills={profile.skills} />
        </div>
      </header>

      {/* Story 11's two standing notices land here, above her own words. */}

      <div className="ruled-page">
        <Section id="about-heading" heading={ABOUT_HEADING}>
          {profile.about ? (
            /*
              `whitespace-pre-line`, because she typed paragraphs and the form
              kept them. Rendered as text and never as markup or a URL — the
              guarantee `gated-profile-view.test.tsx` pins with a `javascript:`
              sentinel.
            */
            <p className="text-foreground whitespace-pre-line text-pretty">{profile.about}</p>
          ) : (
            <p className="text-muted-foreground text-pretty">{NOTHING_MORE}</p>
          )}
        </Section>

        <Suspense fallback={<WorkHistorySkeleton />}>
          <WorkHistorySection lines={workHistory} />
        </Suspense>
      </div>

      <BackToList />
    </div>
  );
}
