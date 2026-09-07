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
 * **The heading is a link into `/profile/[slug]`**, which story 5 built. Three
 * things about it were decided rather than defaulted:
 *
 * - **The link is the headline, not the row.** A row is an `<article>` holding a
 *   heading, a name and a list of Skills; wrapping the whole of it would give a
 *   screen reader one link whose accessible name is every Skill she listed, and
 *   would make the chips unselectable text. The heading is the one line that
 *   says what following it leads to.
 * - **Its accessible name is the headline itself, and there is no `aria-label`.**
 *   The obvious improvement — naming it "Ver el perfil de Ana María R." so a
 *   list read link by link is a list of destinations — is a **WCAG 2.5.3
 *   failure**: Label in Name asks that the accessible name contain the visible
 *   text, and a speech-input user saying what he can see would then match
 *   nothing. The headline is already unique per row and already says where the
 *   link goes, so the accessible name it gives is the right one anyway.
 * - **The row still says everything it said before.** The link is an addition to
 *   the hierarchy and not a replacement for it: a reader who never follows it
 *   has lost nothing, which is what kept these rows complete on their own while
 *   `/profile/[slug]` did not exist.
 *
 * The destination is gated — an anonymous reader arrives at `/sign-in` with a
 * way back — and the list itself is public and stays that way (NFR8 gates
 * `/profile` and deliberately not `/profiles`).
 *
 * It lives in its own module because `/profiles` appends rows from the browser
 * as the reader scrolls, and a client component may not import the server list
 * that renders the first page.
 */

import { Avatar, AvatarFallback, AvatarImage } from "@repo/design-system/components/avatar";
import { Separator } from "@repo/design-system/components/separator";
import { cityLabel } from "@repo/domain/policy";
import type { PublicProfile } from "@repo/domain/profiles";
import Link from "next/link";
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
            {/*
              Her own words, in the display face — the one line on the page
              nobody else could have written, and the only thing in a row set in
              Alegreya (`DESIGN.md` → Typography). 24 px is the `h3` step.
            */}
            <h2 className="font-heading text-foreground text-2xl leading-7 font-medium text-pretty">
              <Link
                href={`/profile/${profile.slug}`}
                className="hover:text-primary focus-visible:ring-ring/50 rounded-xs outline-none focus-visible:ring-[3px]"
              >
                {profile.headline}
              </Link>
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
