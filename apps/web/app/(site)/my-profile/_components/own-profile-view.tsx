/**
 * Her own profile, rendered. Sync and prop-driven, so `own-profile-view.test.tsx`
 * can render it under happy-dom — the async page above it cannot be tested
 * there, and the two things worth pinning are here: that every free-text field
 * is rendered as **content and never as a URL** (DD7's third clause, with a
 * `javascript:` sentinel), and that the three tiers say who sees what.
 *
 * **"Tres niveles"**, locked after `/prototype` UI: the card a stranger sees,
 * then two sections, each headed by who sees it. The two losing layouts — a
 * single ledger with a visibility badge per row, and one tab per audience —
 * live on `prototype/16-ui-variants`.
 */

import { AlertDescription, AlertTitle } from "@repo/design-system/components/alert";
import { buttonVariants } from "@repo/design-system/components/button";
import { Separator } from "@repo/design-system/components/separator";
import { cityLabel, formatColombianPhone } from "@repo/domain/policy";
import type { OwnProfile } from "@repo/domain/profiles";
import Link from "next/link";
import type { ReactNode } from "react";
import { ProfileCard } from "@/app/(site)/_components/profile-card";
import { PublishedConfirmation } from "./published-confirmation";
import {
  ABOUT_TERM,
  EDIT_LINK,
  EMAIL_TERM,
  FULL_NAME_TERM,
  GATED_HEADING,
  HELD_EXPLANATION,
  HELD_HEADING,
  NOTHING_MORE,
  PHONE_TERM,
  PHOTO_ABSENT,
  PHOTO_PENDING,
  PHOTO_REJECTED,
  PUBLIC_HEADING,
  PUBLISHED_CONFIRMATION,
  PUBLISHED_EXPLANATION,
  publishedOn,
  SAVED_CONFIRMATION,
  SAVED_EXPLANATION,
  WALL_LINK,
  WORK_HISTORY_TERM,
} from "../_lib/messages";

function photoSentence(state: OwnProfile["photoState"]): string {
  switch (state) {
    case "pending":
      return PHOTO_PENDING;
    case "rejected":
      return PHOTO_REJECTED;
    default:
      return PHOTO_ABSENT;
  }
}

export interface OwnProfileViewProps {
  readonly profile: OwnProfile;
  /** Arrived from `/publish`: render the confirmation, focused. */
  readonly justPublished: boolean;
  /** Arrived from a saved edit: the same region, a different sentence. */
  readonly justSaved: boolean;
}

/**
 * **One region, two arrivals.** Publishing and saving are different facts and
 * say different sentences, but they are the same thing to a screen reader —
 * the announcement she is waiting for on arrival — so they share the focused
 * `role="status"` region rather than competing for it. Only one can be true:
 * each comes from its own redirect.
 */
function SavedConfirmation() {
  return (
    <PublishedConfirmation>
      <AlertTitle>{SAVED_CONFIRMATION}</AlertTitle>
      <AlertDescription>
        <p>{SAVED_EXPLANATION}</p>
      </AlertDescription>
    </PublishedConfirmation>
  );
}

function Confirmation() {
  return (
    <PublishedConfirmation>
      <AlertTitle>{PUBLISHED_CONFIRMATION}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <p>{PUBLISHED_EXPLANATION}</p>
        {/*
          `buttonVariants` on a plain `<Link>`, not `<Button render={<Link/>}>`,
          for the reason `sign-in-link.tsx` sets out at length: this navigates,
          so it is a link and must announce as one. Handing the registry's
          `Button` a link made Base UI warn on every render that native button
          semantics had been stripped — observed in `next dev` stdout, which is
          where `logging.browserToTerminal` puts it — and the flag it suggests
          stamps `role="button"` onto the `<a>`, hiding a working link from
          anyone navigating by links.
        */}
        <Link
          href="/"
          className={buttonVariants({ variant: "outline", size: "sm", className: "self-start" })}
        >
          {WALL_LINK}
        </Link>
      </AlertDescription>
    </PublishedConfirmation>
  );
}

function Card({ profile }: { profile: OwnProfile }) {
  return (
    <ProfileCard
      firstName={profile.firstName}
      lastInitial={profile.lastInitial}
      cityLabel={cityLabel(profile.city)}
      headline={profile.headline}
      skillLabels={profile.skills.map((skill) => skill.labelEs)}
      photoUrl={profile.photoUrl}
    />
  );
}

function Term({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground text-sm">{term}</dt>
      <dd className="text-foreground text-pretty">{children}</dd>
    </div>
  );
}

/**
 * Lines are positional data with no id of their own and never reorder on the
 * client, so a duplicate line is keyed by how many times it has appeared.
 */
function WorkHistoryList({ lines }: { lines: readonly string[] }) {
  const seen = new Map<string, number>();
  return (
    <ul className="flex list-disc flex-col gap-1 pl-5">
      {lines.map((line) => {
        const occurrence = (seen.get(line) ?? 0) + 1;
        seen.set(line, occurrence);
        return <li key={`${line}#${occurrence}`}>{line}</li>;
      })}
    </ul>
  );
}

function GatedTerms({ profile }: { profile: OwnProfile }) {
  const nothing = !profile.about && profile.workHistory.length === 0;
  return (
    <dl className="flex flex-col gap-4">
      {profile.about ? <Term term={ABOUT_TERM}>{profile.about}</Term> : null}
      {profile.workHistory.length > 0 ? (
        <Term term={WORK_HISTORY_TERM}>
          <WorkHistoryList lines={profile.workHistory} />
        </Term>
      ) : null}
      {nothing ? <p className="text-muted-foreground">{NOTHING_MORE}</p> : null}
    </dl>
  );
}

function HeldTerms({ profile }: { profile: OwnProfile }) {
  return (
    <dl className="flex flex-col gap-4">
      <Term term={FULL_NAME_TERM}>{profile.fullName}</Term>
      <Term term={PHONE_TERM}>{formatColombianPhone(profile.phone)}</Term>
      <Term term={EMAIL_TERM}>{profile.email}</Term>
    </dl>
  );
}

function Tiers({ profile, justPublished, justSaved }: OwnProfileViewProps) {
  return (
    <div className="flex flex-col gap-8">
      {justPublished ? <Confirmation /> : null}
      {justSaved ? <SavedConfirmation /> : null}

      {/*
        The way into the edit form. A link rather than a button because it
        navigates, for the reason `sign-in-link.tsx` sets out — and placed
        above the tiers rather than beside each one, because what she is
        changing is the profile, and the tiers are a rule about who sees it
        rather than four things to edit separately.
      */}
      <Link
        href="/my-profile/edit"
        className={buttonVariants({ variant: "outline", size: "sm", className: "self-start" })}
      >
        {EDIT_LINK}
      </Link>

      <section className="flex flex-col gap-3" aria-labelledby="public-heading">
        <h2 id="public-heading" className="text-foreground text-lg font-semibold">
          {PUBLIC_HEADING}
        </h2>
        <Card profile={profile} />
        <p className="text-muted-foreground text-sm">{photoSentence(profile.photoState)}</p>
        <p className="text-muted-foreground text-sm">{publishedOn(profile.publishedAt)}</p>
      </section>

      <Separator />

      <section className="flex flex-col gap-3" aria-labelledby="gated-heading">
        <h2 id="gated-heading" className="text-foreground text-lg font-semibold">
          {GATED_HEADING}
        </h2>
        <GatedTerms profile={profile} />
      </section>

      <Separator />

      <section className="flex flex-col gap-3" aria-labelledby="held-heading">
        <h2 id="held-heading" className="text-foreground text-lg font-semibold">
          {HELD_HEADING}
        </h2>
        <p className="text-muted-foreground text-sm text-pretty">{HELD_EXPLANATION}</p>
        <HeldTerms profile={profile} />
      </section>
    </div>
  );
}

export function OwnProfileView(props: OwnProfileViewProps) {
  return <Tiers {...props} />;
}
