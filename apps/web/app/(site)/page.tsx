/**
 * `/` — the Wall: the most recently published CapabilityProfiles, newest first.
 *
 * Shaped at `.impeccable/briefs/wall.md`; the state set is the spec's `## UX
 * design`, Wall row. The layout was chosen by `/prototype` UI on this route —
 * variant C's rows carrying variant B's Skill chips, with B's opening reduced to
 * a single primary action. The losers live on `prototype/21-ui-variants`.
 *
 * **It is a teaser, not the catalogue.** `CONTEXT.md` says so, and `/profiles`
 * is the catalogue — ordered so the people nobody has contacted are met first.
 * This page shows one page of the newest and links there under the list.
 *
 * **The opening carries one action, and it is hers.** A Hirer needs no button:
 * the list below *is* what he came for, and he is asked for nothing. The one
 * person on this page who needs a route somewhere else is a Worker who has not
 * published yet, so *Publicar lo que sabes hacer* is the page's only primary
 * weight — which is why the header's _Entrar_ stopped being a button in the same
 * change.
 *
 * **Nothing is cached, so the read sits inside a designed `<Suspense>`
 * boundary**, and the framing sits above it: the standing notices story 11 adds
 * go between them, and the fallback holds the list's layout so neither moves
 * when the rows arrive.
 *
 * **The error boundary is inside the page rather than at the route**, for the
 * same reason — see `_components/profile-list/list-boundary.tsx`.
 *
 * Indexable, deliberately: it carries only the public projection, so there is
 * nothing here a crawler may not read. It is not on NFR8's gated list and
 * `gated-routes.test.ts` asserts that it stays off it.
 */

import { buttonVariants } from "@repo/design-system/components/button";
import { profiles } from "@repo/domain/profiles";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ListEmptyState } from "./_components/profile-list/empty-state";
import { ListBoundary } from "./_components/profile-list/list-boundary";
import { ProfileList } from "./_components/profile-list/profile-list";
import { ProfileListSkeleton } from "./_components/profile-list/skeleton";
import {
  NOBODY_PUBLISHED_BODY,
  NOBODY_PUBLISHED_TITLE,
  TO_BROWSE,
  TO_PUBLISH,
} from "./_lib/lists/messages";
import { WALL_LEAD, WALL_TITLE, WALL_TO_BROWSE_HINT } from "./_lib/wall/messages";

async function WallList() {
  /*
    **The read is request-time, and saying so is what keeps `next build` green
    without a database.**

    Cache Components prerenders this subtree until something tells it not to.
    Nothing here does: the read is uncached by design (ADR-0011), but "uncached"
    is not a signal the prerender can see, so `next build` calls `profiles.wall()`
    itself. With `DATABASE_URL` unset — which is every CI run, because NFR24
    forbids it as a build input — `poolConfig` throws, and the `AppError`
    constructor's `crypto.randomUUID()` is an unstable value the prerender
    rejects. The reported error names the randomness rather than the missing
    variable, and a local build hides all of it because `.env.local` is loaded.

    `connection()` is `[dynamic]` from the framework's own menu, and the same
    boundary `privacy/page.tsx` and `app/api/health/route.ts` already use. It
    changes nothing about how the page renders — `/` is still partially
    prerendered, the shell is still static and this list still streams into the
    `<Suspense>` below.

    `/profiles` needs no such line: it awaits `searchParams` before its read,
    which is already a dynamic access.
  */
  await connection();

  const page = await profiles.wall();

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

  return (
    <div className="flex flex-col gap-8">
      <ProfileList profiles={page.items} />
      <div className="flex flex-col items-start gap-2">
        <Link href="/profiles" className={buttonVariants({ variant: "outline" })}>
          {TO_BROWSE}
        </Link>
        <p className="text-muted-foreground text-sm">{WALL_TO_BROWSE_HINT}</p>
      </div>
    </div>
  );
}

export default function WallPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <div className="flex flex-col items-start gap-5">
        <div className="flex flex-col gap-3">
          <h1 className="text-foreground text-3xl font-semibold tracking-tight text-balance">
            {WALL_TITLE}
          </h1>
          <p className="text-muted-foreground max-w-prose text-lg text-pretty">{WALL_LEAD}</p>
        </div>
        <Link href="/publish" className={buttonVariants({ size: "lg" })}>
          {TO_PUBLISH}
        </Link>
      </div>

      {/*
        Story 11's two standing notices land here, above the list and below the
        opening: nobody is verified, and the platform holds no money. The
        boundary below is scoped so a failed read leaves them on screen.
      */}

      <ListBoundary>
        <Suspense fallback={<ProfileListSkeleton />}>
          <WallList />
        </Suspense>
      </ListBoundary>
    </main>
  );
}
