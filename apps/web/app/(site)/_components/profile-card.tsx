/**
 * The public card: what anyone sees of a CapabilityProfile — first name, last
 * initial, city, Skills, one line, and a photo or the initial in its place.
 *
 * Presentational and server-compatible, so `/my-profile` renders it as the
 * proof of what she published and `/publish`'s preview variant renders it live
 * as she types. Story 4's Wall is where it becomes `PublicProfileCard` proper;
 * until then it carries no link, because there is no public route to link to.
 *
 * **The initial is the approved-photo-absent state, and it is also the
 * pending state** (spec, Wall row): one shape, two causes, never a badge.
 */

import { Avatar, AvatarFallback, AvatarImage } from "@repo/design-system/components/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/card";
import type { VocabularyEntry } from "@repo/domain/skills";
import { SkillChips } from "./profile-list/skill-chips";

export interface ProfileCardProps {
  readonly firstName: string;
  readonly lastInitial: string;
  readonly cityLabel: string;
  readonly headline: string;
  /**
   * The Skills themselves, not their labels.
   *
   * **It took `readonly string[]` and rebuilt entries from it** —
   * `skillLabels.map((label) => ({ slug: label, labelEs: label }))` — which
   * put a Spanish display string in a `slug`, against ADR-0012's
   * identifier-versus-value line, and then keyed a list on it so two Skills
   * sharing a label collided. Both callers already hold the entries and were
   * throwing them away one line before handing them over.
   */
  readonly skills: readonly VocabularyEntry[];
  readonly photoUrl?: string | null;
  /** The `alt` for a real photo. Never a description of her circumstances. */
  readonly photoAlt?: string;
  readonly className?: string;
}

export function initialOf(firstName: string): string {
  return [...firstName.trim()][0]?.toLocaleUpperCase("es-CO") ?? "";
}

export function displayName(firstName: string, lastInitial: string): string {
  const name = firstName.trim();
  const initial = lastInitial.trim();
  if (!name) return "";
  return initial ? `${name} ${initial}.` : name;
}

export function ProfileCard({
  firstName,
  lastInitial,
  cityLabel,
  headline,
  skills,
  photoUrl,
  photoAlt = "",
  className,
}: ProfileCardProps) {
  return (
    <Card className={className}>
      {/*
        The same hierarchy as a row on the Wall (`profile-list/profile-row.tsx`):
        her own words first, in the display face, then who and where. A person's
        identity should not depend on which surface she was reached through, and
        this card is how she sees what everyone else sees.
      */}
      <CardHeader className="flex flex-row items-start gap-4">
        <Avatar size="lg" aria-hidden={photoUrl ? undefined : true}>
          {photoUrl ? <AvatarImage src={photoUrl} alt={photoAlt} /> : null}
          <AvatarFallback>{initialOf(firstName)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-1">
          {headline ? (
            <CardTitle className="font-heading text-2xl leading-7 font-medium text-pretty">
              {headline}
            </CardTitle>
          ) : null}
          <CardDescription className="font-sans">
            {displayName(firstName, lastInitial)} · {cityLabel}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {/*
          The same chips the public list renders, and for the same reason: a
          Skill label is a verb phrase, and the registry's `Badge` is
          `shrink-0 whitespace-nowrap`, so a long one used to escape the card's
          border rather than wrap. See `profile-list/skill-chips.tsx`.
        */}
        <SkillChips skills={skills} />
      </CardContent>
    </Card>
  );
}
