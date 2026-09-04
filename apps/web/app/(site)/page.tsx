/**
 * PROTOTYPE — `/` with seven variants, switchable via `?variant=`, on the real
 * route with the real reads (#178). E, F, G are the phone-first rethinks of A,
 * C and B: the index as a thumb rail, the field as a flick with a pinned
 * action, the board as a snapping deck. A: the index spread. B: the notice
 * board. C: the field of type. D: what is on the branch today.
 *
 * Throwaway: the winner is folded back into the real page; the rest stay on
 * `prototype/178-ui-variants`.
 */

import { buttonVariants } from "@repo/design-system/components/button";
import { profiles } from "@repo/domain/profiles";
import { skills } from "@repo/domain/skills";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ListEmptyState } from "./_components/profile-list/empty-state";
import { ListBoundary } from "./_components/profile-list/list-boundary";
import { ProfileList } from "./_components/profile-list/profile-list";
import { ProfileListSkeleton } from "./_components/profile-list/skeleton";
import { Cover } from "./_components/wall/cover";
import { HowItWorks } from "./_components/wall/how-it-works";
import { PrototypeSwitcher } from "./_components/wall/prototype/switcher";
import { variantFrom } from "./_components/wall/prototype/variants";
import { VariantBoard } from "./_components/wall/prototype/variant-board";
import { VariantDeck } from "./_components/wall/prototype/variant-deck";
import { VariantField } from "./_components/wall/prototype/variant-field";
import { VariantFlick } from "./_components/wall/prototype/variant-flick";
import { VariantIndex } from "./_components/wall/prototype/variant-index";
import { VariantRail } from "./_components/wall/prototype/variant-rail";
import { VocabularyStrip, VocabularyStripPlaceholder } from "./_components/wall/vocabulary-strip";
import {
  NOBODY_PUBLISHED_BODY,
  NOBODY_PUBLISHED_TITLE,
  TO_BROWSE,
  TO_PUBLISH,
} from "./_lib/lists/messages";
import { publishedRecently, RECENT_HEADING, WALL_TO_BROWSE_HINT } from "./_lib/wall/messages";

const PROFILES_ID = "profiles";
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

function recentWindowStart(): Date {
  return new Date(Date.now() - SEVEN_DAYS);
}

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

async function Variants({ searchParams }: { searchParams: SearchParams }) {
  const variant = variantFrom((await searchParams).variant);
  await connection();

  const [page, recent, entries] = await Promise.all([
    profiles.wall(),
    profiles.publishedSince(recentWindowStart()),
    skills.listActiveWithCounts(),
  ]);

  if (page.items.length === 0) {
    return (
      <ListEmptyState
        title={NOBODY_PUBLISHED_TITLE}
        body={NOBODY_PUBLISHED_BODY}
        actionHref="/publish"
        actionLabel={TO_PUBLISH}
      />
    );
  }

  if (variant === "E") {
    return <VariantRail profiles={page.items} entries={entries} recent={recent} />;
  }
  if (variant === "F") {
    return <VariantFlick profiles={page.items} entries={entries} recent={recent} />;
  }
  if (variant === "G") {
    return <VariantDeck profiles={page.items} recent={recent} />;
  }
  if (variant === "A") {
    return <VariantIndex profiles={page.items} entries={entries} recent={recent} />;
  }
  if (variant === "B") {
    return <VariantBoard profiles={page.items} recent={recent} strip={<VocabularyStrip />} />;
  }
  if (variant === "C") {
    return <VariantField profiles={page.items} entries={entries} recent={recent} />;
  }

  return (
    <>
      <Cover
        profilesId={PROFILES_ID}
        strip={
          <Suspense fallback={<VocabularyStripPlaceholder />}>
            <VocabularyStrip />
          </Suspense>
        }
      />
      <section
        id={PROFILES_ID}
        aria-labelledby="recent-heading"
        className="mx-auto flex w-full max-w-5xl scroll-mt-14 flex-col gap-6 px-4 pt-12 pb-4 sm:pt-16"
      >
        <h2
          id="recent-heading"
          className="font-heading text-3xl font-medium tracking-[-0.01em] text-balance"
        >
          {RECENT_HEADING}
        </h2>
        <div className="max-w-3xl">
          <div className="flex flex-col gap-8">
            <p className="text-muted-foreground min-h-6 text-pretty">
              {recent > 0 ? publishedRecently(recent) : null}
            </p>
            <ProfileList profiles={page.items} />
            <div className="flex flex-col items-start gap-2">
              <Link href="/profiles" className={buttonVariants({ variant: "outline" })}>
                {TO_BROWSE}
              </Link>
              <p className="text-muted-foreground text-sm">{WALL_TO_BROWSE_HINT}</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default function WallPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="flex flex-col">
      <ListBoundary>
        <Suspense fallback={<ProfileListSkeleton />}>
          <Variants searchParams={searchParams} />
        </Suspense>
      </ListBoundary>
      <HowItWorks />
      <Suspense fallback={null}>
        <PrototypeSwitcher />
      </Suspense>
    </main>
  );
}
