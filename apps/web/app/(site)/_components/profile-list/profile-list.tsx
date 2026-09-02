/**
 * The list both public surfaces render: one {@link ProfileRow} per profile.
 *
 * It owns two things the row does not — the count announcement, and the rule
 * between rows — and nothing else. `/profiles` appends further rows below this
 * one from the browser, which is why the row is its own module and why the
 * separator is the row's own business rather than this list's.
 */

import type { PublicProfile } from "@repo/domain/profiles";
import { CountAnnouncement } from "./count-announcement";
import { ProfileRow } from "./profile-row";

export function ProfileList({
  profiles,
  children,
}: {
  readonly profiles: readonly PublicProfile[];
  /** What `/profiles` appends: further pages, loaded in the browser. */
  readonly children?: React.ReactNode;
}) {
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
      <ul className="flex flex-col" role="list">
        {profiles.map((profile, index) => (
          <li key={profile.slug}>
            <ProfileRow profile={profile} separated={index > 0} />
          </li>
        ))}
        {children}
      </ul>
    </>
  );
}
