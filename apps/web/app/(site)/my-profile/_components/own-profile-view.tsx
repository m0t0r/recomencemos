/**
 * Her own profile, rendered. Sync and prop-driven, so `own-profile-view.test.tsx`
 * can render it under happy-dom — the async page above it cannot be tested
 * there, and the two things worth pinning are here: that every free-text field
 * is rendered as **content and never as a URL** (DD7's third clause, with a
 * `javascript:` sentinel), and that the three tiers say who sees what.
 *
 * **Three `/prototype` UI variants**, switchable via `?variant=`, on the real
 * route with the real read behind them. Locking one is the human's call.
 */

import { AlertDescription, AlertTitle } from "@repo/design-system/components/alert";
import { Badge } from "@repo/design-system/components/badge";
import { Button } from "@repo/design-system/components/button";
import { Separator } from "@repo/design-system/components/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/design-system/components/tabs";
import { cityLabel, formatColombianPhone } from "@repo/domain/policy";
import type { OwnProfile } from "@repo/domain/profiles";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { ProfileCard, displayName } from "@/app/(site)/_components/profile-card";
import { PublishedConfirmation } from "./published-confirmation";
import {
  ABOUT_TERM,
  CITY_TERM,
  EMAIL_TERM,
  FULL_NAME_TERM,
  GATED_HEADING,
  HEADLINE_TERM,
  HELD_EXPLANATION,
  HELD_HEADING,
  NAME_TERM,
  NOTHING_MORE,
  PHONE_TERM,
  PHOTO_ABSENT,
  PHOTO_PENDING,
  PHOTO_REJECTED,
  PHOTO_TERM,
  PUBLIC_HEADING,
  PUBLISHED_CONFIRMATION,
  PUBLISHED_EXPLANATION,
  publishedOn,
  SKILLS_TERM,
  VISIBILITY_GATED,
  VISIBILITY_HELD,
  VISIBILITY_PUBLIC,
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
  readonly variant: OwnProfileVariantKey;
}

function Confirmation() {
  return (
    <PublishedConfirmation>
      <AlertTitle>{PUBLISHED_CONFIRMATION}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <p>{PUBLISHED_EXPLANATION}</p>
        <Button variant="outline" size="sm" className="self-start" render={<Link href="/" />}>
          {WALL_LINK}
        </Button>
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

/** Variant A — **"Tres niveles"**: the card, then two sections, headed by who sees them. */
function Tiers({ profile, justPublished }: OwnProfileViewProps) {
  return (
    <div className="flex flex-col gap-8">
      {justPublished ? <Confirmation /> : null}

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

type Tier = "public" | "gated" | "held";

const TIER_LABEL: Record<Tier, string> = {
  public: VISIBILITY_PUBLIC,
  gated: VISIBILITY_GATED,
  held: VISIBILITY_HELD,
};

function LedgerRow({ term, tier, children }: { term: string; tier: Tier; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <dt className="text-muted-foreground text-sm">{term}</dt>
        <Badge variant={tier === "held" ? "outline" : "secondary"}>{TIER_LABEL[tier]}</Badge>
      </div>
      <dd className="text-foreground text-pretty">{children}</dd>
    </div>
  );
}

/** Variant B — **"Ledger"**: one list, every row carrying who sees it as a badge. No card. */
function Ledger({ profile, justPublished }: OwnProfileViewProps) {
  return (
    <div className="flex flex-col gap-6">
      {justPublished ? <Confirmation /> : null}
      <dl className="divide-border flex flex-col divide-y">
        <LedgerRow term={NAME_TERM} tier="public">
          {displayName(profile.firstName, profile.lastInitial)}
        </LedgerRow>
        <LedgerRow term={CITY_TERM} tier="public">
          {cityLabel(profile.city)}
        </LedgerRow>
        <LedgerRow term={SKILLS_TERM} tier="public">
          <ul className="flex flex-wrap gap-1.5">
            {profile.skills.map((skill) => (
              <li key={skill.slug}>
                <Badge variant="secondary">{skill.labelEs}</Badge>
              </li>
            ))}
          </ul>
        </LedgerRow>
        <LedgerRow term={HEADLINE_TERM} tier="public">
          {profile.headline}
        </LedgerRow>
        <LedgerRow term={PHOTO_TERM} tier="public">
          {photoSentence(profile.photoState)}
        </LedgerRow>
        <LedgerRow term={ABOUT_TERM} tier="gated">
          {profile.about || NOTHING_MORE}
        </LedgerRow>
        {profile.workHistory.length > 0 ? (
          <LedgerRow term={WORK_HISTORY_TERM} tier="gated">
            <WorkHistoryList lines={profile.workHistory} />
          </LedgerRow>
        ) : null}
        <LedgerRow term={FULL_NAME_TERM} tier="held">
          {profile.fullName}
        </LedgerRow>
        <LedgerRow term={PHONE_TERM} tier="held">
          {formatColombianPhone(profile.phone)}
        </LedgerRow>
        <LedgerRow term={EMAIL_TERM} tier="held">
          {profile.email}
        </LedgerRow>
      </dl>
      <p className="text-muted-foreground text-sm text-pretty">{HELD_EXPLANATION}</p>
      <p className="text-muted-foreground text-sm">{publishedOn(profile.publishedAt)}</p>
    </div>
  );
}

/** Variant C — **"Tres pestañas"**: one tab per audience; the card is the first tab's whole content. */
function Audiences({ profile, justPublished }: OwnProfileViewProps) {
  return (
    <div className="flex flex-col gap-6">
      {justPublished ? <Confirmation /> : null}
      <Tabs defaultValue="public">
        <TabsList className="w-full">
          <TabsTrigger value="public">{VISIBILITY_PUBLIC}</TabsTrigger>
          <TabsTrigger value="gated">{VISIBILITY_GATED}</TabsTrigger>
          <TabsTrigger value="held">{VISIBILITY_HELD}</TabsTrigger>
        </TabsList>
        <TabsContent value="public" className="flex flex-col gap-3 pt-4">
          <Card profile={profile} />
          <p className="text-muted-foreground text-sm">{photoSentence(profile.photoState)}</p>
          <p className="text-muted-foreground text-sm">{publishedOn(profile.publishedAt)}</p>
        </TabsContent>
        <TabsContent value="gated" className="pt-4">
          <GatedTerms profile={profile} />
        </TabsContent>
        <TabsContent value="held" className="flex flex-col gap-4 pt-4">
          <p className="text-muted-foreground text-sm text-pretty">{HELD_EXPLANATION}</p>
          <HeldTerms profile={profile} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export const OWN_PROFILE_VARIANTS = {
  A: { name: "Tres niveles", component: Tiers },
  B: { name: "Ledger", component: Ledger },
  C: { name: "Tres pestañas", component: Audiences },
} as const satisfies Record<
  string,
  { name: string; component: ComponentType<OwnProfileViewProps> }
>;

export type OwnProfileVariantKey = keyof typeof OWN_PROFILE_VARIANTS;

export const OWN_PROFILE_VARIANT_KEYS = Object.keys(
  OWN_PROFILE_VARIANTS,
) as readonly OwnProfileVariantKey[];

export function isOwnProfileVariantKey(value: unknown): value is OwnProfileVariantKey {
  return typeof value === "string" && value in OWN_PROFILE_VARIANTS;
}

export function OwnProfileView(props: OwnProfileViewProps) {
  const Layout = OWN_PROFILE_VARIANTS[props.variant].component;
  return <Layout {...props} />;
}
