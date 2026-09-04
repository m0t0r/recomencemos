/**
 * PROTOTYPE — the ruled page of rows, each row carrying the slugs of its Skills
 * so the {@link Highlighter} can dim or match it. Shared by variants A, C, E, F.
 *
 * `dim` says what a non-matching row does once a term is pinned: `fade` keeps
 * it in place at a quarter opacity (the desktop spread, where the eye scans);
 * `hide` collapses it, because on a phone a faded row is still a row the thumb
 * has to scroll past.
 */

import type { PublicProfile } from "@repo/domain/profiles";
import { ProfileRow } from "../../profile-list/profile-row";

export function PeopleRows({
  profiles,
  dim = "fade",
}: {
  profiles: readonly PublicProfile[];
  dim?: "fade" | "hide";
}) {
  return (
    <ul className="ruled-page">
      {profiles.map((profile, index) => (
        <li
          key={profile.slug}
          data-skills={profile.skills.map((skill) => skill.slug).join(" ")}
          className={
            dim === "hide"
              ? "scroll-mt-4 data-[state=dim]:hidden"
              : "scroll-mt-4 transition-opacity duration-300 data-[state=dim]:opacity-25 data-[state=match]:opacity-100"
          }
        >
          <ProfileRow profile={profile} separated={index > 0} />
        </li>
      ))}
    </ul>
  );
}
