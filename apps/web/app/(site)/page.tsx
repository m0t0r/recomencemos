/**
 * `/` — the Wall: the most recently published CapabilityProfiles, newest first.
 *
 * Shaped at `.impeccable/briefs/wall.md`; the state set is the spec's `## UX
 * design`, Wall row. It replaces the holding page story 4 was always going to
 * replace.
 *
 * **It is a teaser, not the catalogue.** `CONTEXT.md` says so, and `/profiles`
 * is the catalogue — ordered so the people nobody has contacted are met first.
 * This page shows one page of the newest and links there.
 *
 * **Nothing is cached, so the read sits inside a designed `<Suspense>`
 * boundary**, and the fallback holds the grid's layout exactly: the standing
 * notices story 11 adds will sit above it, and a fallback of a different shape
 * would move them when the cards arrive.
 *
 * **The error boundary is inside the page rather than at the route**, for the
 * same reason — see `_components/profile-grid/grid-boundary.tsx`.
 *
 * Indexable, deliberately: it carries only the public projection, so there is
 * nothing here a crawler may not read. It is not on NFR8's gated list and
 * `gated-routes.test.ts` asserts that it stays off it.
 *
 * **`?variant=` is a live prototype and is temporary** — see
 * `_components/profile-grid/prototype/`. While it stands, the framing renders
 * inside the boundary rather than above it, because the variant decides the
 * framing and reading a search parameter is dynamic. Folding the winner in puts
 * the framing back in the shell.
 */

import { buttonVariants } from "@repo/design-system/components/button";
import { profiles } from "@repo/domain/profiles";
import Link from "next/link";
import { Suspense } from "react";
import { ListEmptyState } from "./_components/profile-grid/empty-state";
import { GridBoundary } from "./_components/profile-grid/grid-boundary";
import {
  NOBODY_PUBLISHED_BODY,
  NOBODY_PUBLISHED_TITLE,
  TO_PUBLISH,
} from "./_components/profile-grid/messages";
import { ProfileGrid } from "./_components/profile-grid/profile-grid";
import { PrototypeSwitcher } from "./_components/profile-grid/prototype/switcher";
import {
  DenseGrid,
  ProfileRows,
  QuietOpening,
  TwoDoors,
  variantFrom,
} from "./_components/profile-grid/prototype/variants";
import { ProfileGridSkeleton } from "./_components/profile-grid/skeleton";
import { WALL_LEAD, WALL_TITLE, WALL_TO_BROWSE, WALL_TO_BROWSE_HINT } from "./_lib/wall/messages";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function WallEmpty() {
  return (
    <ListEmptyState
      title={NOBODY_PUBLISHED_TITLE}
      body={NOBODY_PUBLISHED_BODY}
      actionHref="/publish"
      actionLabel={TO_PUBLISH}
    />
  );
}

/** The way into the catalogue, under the grid. */
function ToBrowse() {
  return (
    <div className="flex flex-col items-start gap-2">
      <Link href="/profiles" className={buttonVariants({ variant: "outline" })}>
        {WALL_TO_BROWSE}
      </Link>
      <p className="text-muted-foreground text-sm">{WALL_TO_BROWSE_HINT}</p>
    </div>
  );
}

async function WallBody({ searchParams }: { readonly searchParams: SearchParams }) {
  const variant = variantFrom((await searchParams).variant);
  const page = await profiles.wall();

  if (page.items.length === 0) return <WallEmpty />;

  if (variant === "B") {
    return (
      <div className="flex flex-col gap-8">
        <TwoDoors
          title={WALL_TITLE}
          lead={WALL_LEAD}
          publishLabel={TO_PUBLISH}
          browseLabel={WALL_TO_BROWSE}
        />
        <DenseGrid profiles={page.items} />
        <PrototypeSwitcher current={variant} />
      </div>
    );
  }

  if (variant === "C") {
    return (
      <div className="flex flex-col gap-6">
        <QuietOpening title={WALL_TITLE} lead={WALL_LEAD} />
        <ProfileRows profiles={page.items} />
        <ToBrowse />
        <PrototypeSwitcher current={variant} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1 className="text-foreground text-3xl font-semibold tracking-tight text-balance">
          {WALL_TITLE}
        </h1>
        <p className="text-muted-foreground max-w-prose text-lg text-pretty">{WALL_LEAD}</p>
      </div>

      {/*
        Story 11's two standing notices land here, above the grid: nobody is
        verified, and the platform holds no money. The boundary is scoped so a
        failed read leaves them on screen.
      */}

      <ProfileGrid profiles={page.items} />
      <ToBrowse />
      <PrototypeSwitcher current={variant} />
    </div>
  );
}

export default function WallPage({ searchParams }: { readonly searchParams: SearchParams }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <GridBoundary>
        <Suspense fallback={<ProfileGridSkeleton />}>
          <WallBody searchParams={searchParams} />
        </Suspense>
      </GridBoundary>
    </main>
  );
}
