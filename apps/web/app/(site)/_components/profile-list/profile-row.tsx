/**
 * One row of a public list: her own words, then who and where, then her Skills.
 *
 * **Rows rather than cards, chosen from `/prototype` variant C** — carrying
 * variant B's Skill chips rather than C's `·`-joined text, which is the
 * recombination the prototype existed to produce. What it buys on a phone is
 * density: a card's padding and border cost about a third of a row's height and
 * say nothing, and the reader is scanning for a capability rather than admiring
 * a container.
 *
 * **The headline is the heading and the name sits under it.** That is the
 * hierarchy the whole product argues for — she is described by what she can do —
 * and it is the only line on the page nobody else could have written. `h2`, so
 * the list is navigable heading to heading; the page's `h1` is its own title.
 *
 * The row carries no link: story 5 builds `/profile/[slug]`, and a row into a
 * 404 would be worse than a row that is complete on its own.
 *
 * It lives in its own module because `/profiles` appends rows from the browser
 * as the reader scrolls, and a client component may not import the server list
 * that renders the first page.
 */

import { Avatar, AvatarFallback, AvatarImage } from "@repo/design-system/components/avatar";
import { Separator } from "@repo/design-system/components/separator";
import { cityLabel } from "@repo/domain/policy";
import type { PublicProfile } from "@repo/domain/profiles";
import { photoAlt } from "../../_lib/lists/messages";
import { displayName, initialOf } from "../profile-card";
import { SkillChips } from "./skill-chips";

/**
 * @param separated draws the rule that belongs *above* this row. The first row
 * of a list passes nothing, so the list never opens on a line dividing it from
 * the heading above it.
 */
export function ProfileRow({
  profile,
  separated = false,
}: {
  readonly profile: PublicProfile;
  readonly separated?: boolean;
}) {
  const name = displayName(profile.firstName, profile.lastInitial);

  return (
    <>
      {separated ? <Separator /> : null}
      <article className="flex gap-4 py-5">
        {/*
          The initial is the approved-photo-absent state and it is also the
          pending state: one shape, two causes, never a badge. `aria-hidden`
          while it holds an initial, because the name is the next thing
          announced anyway.
        */}
        <Avatar size="lg" className="shrink-0" aria-hidden={profile.photoUrl ? undefined : true}>
          {profile.photoUrl ? <AvatarImage src={profile.photoUrl} alt={photoAlt(name)} /> : null}
          <AvatarFallback>{initialOf(profile.firstName)}</AvatarFallback>
        </Avatar>

        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="text-foreground text-lg leading-6 font-medium text-pretty">
              {profile.headline}
            </h2>
            <p className="text-muted-foreground text-sm">
              {name} · {cityLabel(profile.city)}
            </p>
          </div>
          <SkillChips skills={profile.skills} />
        </div>
      </article>
    </>
  );
}
