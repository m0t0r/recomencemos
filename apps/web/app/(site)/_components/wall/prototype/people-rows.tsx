/**
 * PROTOTYPE — the ruled page of rows, each row carrying the slugs of its Skills
 * so the {@link Highlighter} can dim or match it. Shared by variants A and C.
 */

import type { PublicProfile } from "@repo/domain/profiles";
import { ProfileRow } from "../../profile-list/profile-row";

export function PeopleRows({ profiles }: { profiles: readonly PublicProfile[] }) {
  return (
    <ul className="ruled-page">
      {profiles.map((profile, index) => (
        <li
          key={profile.slug}
          data-skills={profile.skills.map((skill) => skill.slug).join(" ")}
          className="transition-opacity duration-300 data-[state=dim]:opacity-25 data-[state=match]:opacity-100"
        >
          <ProfileRow profile={profile} separated={index > 0} />
        </li>
      ))}
    </ul>
  );
}
