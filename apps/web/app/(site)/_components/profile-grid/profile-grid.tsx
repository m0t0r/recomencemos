/**
 * The card grid both public lists render, and the one place their column count
 * is written down.
 *
 * The two surfaces differ in their ordering and in what they say above the grid.
 * They do not differ in the card, and they must not: a person's card should not
 * change shape according to which list somebody reached her through.
 *
 * **A list, not a pile of `div`s.** The cards are semantically a list, so a
 * screen-reader user is told how many there are and can move card to card;
 * `role="list"` is restated because a `list-style: none` grid loses the implicit
 * role in Safari.
 *
 * The cards carry no link. `/profile/[slug]` is story 5, which this ticket
 * blocks — a card into a 404 would be worse than a card that is complete on its
 * own, which is what this one is until then.
 */

import { cityLabel } from "@repo/domain/policy";
import type { PublicProfile } from "@repo/domain/profiles";
import { displayName, ProfileCard } from "../profile-card";
import { CountAnnouncement } from "./count-announcement";
import { photoAlt } from "./messages";

/** One place, so the fallback cannot drift out of step with the content. */
export const GRID_COLUMNS = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3";

export function ProfileGrid({ profiles }: { readonly profiles: readonly PublicProfile[] }) {
  return (
    <>
      <CountAnnouncement count={profiles.length} />
      {/*
        oxlint-disable-next-line no-redundant-roles -- not redundant where it
        matters. Safari drops a `ul`'s implicit list role when `list-style: none`
        is applied, which Tailwind's preflight applies to every list — so on the
        one browser a Worker on an iPhone is using, restating it is the
        difference between "list, 24 items" and no list semantics at all.
      */}
      <ul className={GRID_COLUMNS} role="list">
        {profiles.map((profile) => (
          <li key={profile.slug} className="flex">
            <ProfileCard
              className="w-full"
              firstName={profile.firstName}
              lastInitial={profile.lastInitial}
              cityLabel={cityLabel(profile.city)}
              headline={profile.headline}
              skillLabels={profile.skills.map((skill) => skill.labelEs)}
              photoUrl={profile.photoUrl}
              photoAlt={photoAlt(displayName(profile.firstName, profile.lastInitial))}
            />
          </li>
        ))}
      </ul>
    </>
  );
}
