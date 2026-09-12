/**
 * Her own profile — her whole side of the platform on one page — rendered. Sync
 * and prop-driven, so `own-profile-view.test.tsx` can render it under happy-dom;
 * the async page above it cannot be tested there. Two things worth pinning live
 * here: every free-text field is rendered as **content and never as a URL**
 * (DD7's third clause, with a `javascript:` sentinel), and the page says who
 * sees what.
 *
 * **The order is #275's, settled in the UX lab** (idea 7, variant A, _Una
 * página_): where she stands and the Pause switch; her card as the Wall shows
 * it, whose photo is the control that changes it; the Offers waiting; what
 * closed. **#16's three tiers follow**, because they are this page's original
 * answer — what the platform holds about her and who sees which part — and #275
 * adds to that answer rather than replacing it.
 *
 * **The composition is variant A, _Una columna_, picked by the owner on
 * 2026-09-12** from three phone-first layouts built on this route: everything
 * stacked, the full card in the first of #16's sheets, and all three sheets
 * open. The two that lost — B, _Compacta_, and C, _Renglones_ — are on
 * `prototype/275-phone-variants`; `.impeccable/briefs/own-profile.md` records
 * the pick.
 */

import { AlertDescription, AlertTitle } from "@repo/design-system/components/alert";
import { buttonVariants } from "@repo/design-system/components/button-variants";
import type { ReceivedOffer } from "@repo/domain/offers";
import { cityLabel, formatColombianPhone } from "@repo/domain/policy";
import type { OwnProfile } from "@repo/domain/profiles";
import { DoorOpenIcon, GlobeIcon, LockKeyholeIcon, type LucideIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { HerOffers } from "./her-offers";
import { OwnCard } from "./own-card";
import { PauseSwitch } from "./pause-switch";
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
  PAUSED_CONFIRMATION,
  PAUSED_EXPLANATION,
  pausedSince,
  PHONE_TERM,
  PHOTO_ABSENT,
  PHOTO_PENDING,
  PHOTO_REJECTED,
  PUBLIC_HEADING,
  PUBLISHED_CONFIRMATION,
  PUBLISHED_EXPLANATION,
  publishedOn,
  RESUMED_CONFIRMATION,
  RESUMED_EXPLANATION,
  SAVED_CONFIRMATION,
  SAVED_EXPLANATION,
  VISIBLE_LINE,
  WALL_LINK,
  WORK_HISTORY_TERM,
} from "../_lib/messages";

/**
 * A literal rather than a `useId`, because there is exactly one card on this
 * page and the id has to be identical in the server's HTML and the client's —
 * which a literal is by construction.
 */
const PHOTO_SENTENCE_ID = "own-photo-state";

/**
 * The sentence under her card that says what state her photo is in — or none.
 * **An approved photo needs no sentence**: it is on her card and on the Wall,
 * and the absent sentence it used to fall through to says "you have no photo"
 * beside the photo she has.
 */
function photoSentence(state: OwnProfile["photoState"]): string | null {
  switch (state) {
    case "pending":
      return PHOTO_PENDING;
    case "rejected":
      return PHOTO_REJECTED;
    case "approved":
      return null;
    default:
      return PHOTO_ABSENT;
  }
}

/**
 * **An arrival is announced only while the row still says it.** A pause or a
 * resume posted while the profile is taken down writes nothing and still
 * redirects, and so does one from a tab the state has since moved past — so the
 * confirmation is checked against the state this same render read, and a
 * sentence that would contradict the state line is not said. "Tu perfil volvió
 * al muro" to a Worker who is not on the Wall is the case this exists for.
 */
function arrivalThatHolds(arrival: Arrival, profile: OwnProfile): Arrival {
  if (arrival === "paused") return !profile.takenDown && profile.pausedAt ? arrival : null;
  if (arrival === "resumed") return !profile.takenDown && !profile.pausedAt ? arrival : null;
  return arrival;
}

/**
 * **Which redirect she arrived by**, one at a time: each comes from its own
 * action, so only one can be true. They share one focused `role="status"`
 * region, because they are the same thing to a screen reader — the announcement
 * she is waiting for on arrival — and different facts to read.
 */
export type Arrival = "published" | "saved" | "paused" | "resumed" | null;

export interface OwnProfileViewProps {
  readonly profile: OwnProfile;
  /** Every Offer that reached her, newest first — `offers.listReceived`. */
  readonly offers: readonly ReceivedOffer[];
  readonly arrival: Arrival;
}

const ARRIVALS = {
  published: { title: PUBLISHED_CONFIRMATION, body: PUBLISHED_EXPLANATION },
  saved: { title: SAVED_CONFIRMATION, body: SAVED_EXPLANATION },
  paused: { title: PAUSED_CONFIRMATION, body: PAUSED_EXPLANATION },
  resumed: { title: RESUMED_CONFIRMATION, body: RESUMED_EXPLANATION },
} as const;

function ArrivalConfirmation({ arrival }: { arrival: Exclude<Arrival, null> }) {
  const { title, body } = ARRIVALS[arrival];

  return (
    <PublishedConfirmation>
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <p>{body}</p>
        {/*
          Only publishing links the Wall. `buttonVariants` on a plain `<Link>`,
          not `<Button render={<Link/>}>`, for the reason `sign-in-link.tsx`
          sets out: this navigates, so it must announce as a link.
        */}
        {arrival === "published" ? (
          <Link
            href="/"
            className={buttonVariants({ variant: "outline", size: "sm", className: "self-start" })}
          >
            {WALL_LINK}
          </Link>
        ) : null}
      </AlertDescription>
    </PublishedConfirmation>
  );
}

/**
 * **Where she stands, and the switch** — the first thing on the page, and the
 * focal moment the brief names.
 *
 * **While the profile is taken down this renders nothing.** The switch is not
 * offered, because neither half would write anything; and neither state line is
 * true — she is not on the Wall, and the reason is not her pause. What the page
 * says instead is story 20's copy (#28), and a line here would be a second,
 * wrong source for it.
 */
function Standing({ profile }: { profile: OwnProfile }) {
  if (profile.takenDown) return null;

  const paused = profile.pausedAt !== null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="text-foreground text-lg leading-7 text-pretty">
          {profile.pausedAt ? pausedSince(profile.pausedAt) : VISIBLE_LINE}
        </p>
        {paused ? <p className="text-muted-foreground text-pretty">{PAUSED_EXPLANATION}</p> : null}
      </div>
      <PauseSwitch paused={paused} />
    </div>
  );
}

function Term({ term, children }: { term: string; children: React.ReactNode }) {
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

function Tier({
  id,
  heading,
  icon: Icon,
  children,
}: {
  id: string;
  heading: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="border-border grid grid-cols-[1.5rem_1fr] gap-x-3 gap-y-4 border-t py-7 first:border-t-0 first:pt-0 sm:gap-x-4"
    >
      <Icon aria-hidden="true" className="text-primary mt-1 size-6" />
      <h2 id={id} className="font-heading text-foreground text-2xl leading-8 font-medium">
        {heading}
      </h2>
      <div className="col-start-2 flex flex-col gap-3">{children}</div>
    </section>
  );
}

export function OwnProfileView({ profile, offers, arrival }: OwnProfileViewProps) {
  const announced = arrivalThatHolds(arrival, profile);
  const sentence = photoSentence(profile.photoState);

  return (
    <div className="flex flex-col gap-10">
      {announced ? <ArrivalConfirmation arrival={announced} /> : null}

      <Standing profile={profile} />

      {/*
        Her card, as the Wall shows it — the first of #16's three sheets, so the
        margin line and the icon still say who reaches it. Its photo is the
        control that changes it (the owner's answer on #275), and the sentence
        under it, which carries the photo's state, is joined to that control.
        `OwnCard` puts the control's own progress lines below the card rather
        than in its header.
      */}
      <div className="ruled-page">
        <Tier id="public-heading" heading={PUBLIC_HEADING} icon={GlobeIcon}>
          <OwnCard
            firstName={profile.firstName}
            lastInitial={profile.lastInitial}
            cityLabel={cityLabel(profile.city)}
            headline={profile.headline}
            skills={profile.skills}
            photoUrl={profile.photoUrl}
            {...(sentence ? { describedBy: PHOTO_SENTENCE_ID } : {})}
          />
          {sentence ? (
            <p id={PHOTO_SENTENCE_ID} className="text-muted-foreground text-sm">
              {sentence}
            </p>
          ) : null}
          <p className="text-muted-foreground text-sm">{publishedOn(profile.publishedAt)}</p>
          {/*
            A link rather than a button because it navigates, for the reason
            `sign-in-link.tsx` sets out.
          */}
          <Link
            href="/my-profile/edit"
            className={buttonVariants({ variant: "outline", size: "sm", className: "self-start" })}
          >
            {EDIT_LINK}
          </Link>
        </Tier>
      </div>

      <HerOffers offers={offers} />

      <div className="ruled-page">
        <Tier id="gated-heading" heading={GATED_HEADING} icon={DoorOpenIcon}>
          <GatedTerms profile={profile} />
        </Tier>

        <Tier id="held-heading" heading={HELD_HEADING} icon={LockKeyholeIcon}>
          <p className="text-muted-foreground text-sm text-pretty">{HELD_EXPLANATION}</p>
          <HeldTerms profile={profile} />
        </Tier>
      </div>
    </div>
  );
}
