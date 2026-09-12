/**
 * `/` — the Wall: the cover, the ruled page of the most recently published
 * CapabilityProfiles, and how the product works.
 *
 * Shaped at `.impeccable/briefs/wall.md`; the state set is the spec's `## UX
 * design`, Wall row. The list's layout was chosen by `/prototype` UI on this
 * route (#21); the cover and the three steps were added with #178, which
 * amended the brief and is where the visual world is recorded.
 *
 * **It is a teaser, not the catalogue.** `CONTEXT.md` says so, and `/profiles`
 * is the catalogue — ordered so the people nobody has contacted are met first.
 * This page shows one page of the newest and links there under the list.
 *
 * **The cover carries one action, and it is hers.** A Hirer needs no button:
 * the list below *is* what he came for, and his way there is a link that names
 * it. So *Publicar lo que sabes hacer* is the page's only primary weight —
 * which is why the header's _Entrar_ is a ghost link.
 *
 * **Nothing is cached, so each read sits inside a designed `<Suspense>`
 * boundary**: the vocabulary strip on the cover, and the list. The framing
 * sits between them, and story 11's standing notices go below the list; both
 * fallbacks hold their layout so nothing after them moves when the rows arrive.
 *
 * **The error boundary is inside the page rather than at the route**, for the
 * same reason — see `_components/profile-list/list-boundary.tsx`.
 *
 * Indexable, deliberately: it carries only the public projection, so there is
 * nothing here a crawler may not read. It is not on NFR8's gated list and
 * `gated-routes.test.ts` asserts that it stays off it.
 */

import { buttonVariants } from "@repo/design-system/components/button-variants";
import { profiles } from "@repo/domain/profiles";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { StandingNotices } from "@/app/_components/notices/standing-notices";
import { ListEmptyState } from "./_components/profile-list/empty-state";
import { ListBoundary } from "./_components/profile-list/list-boundary";
import { ProfileList } from "./_components/profile-list/profile-list";
import { ProfileListSkeleton } from "./_components/profile-list/skeleton";
import { Cover } from "./_components/wall/cover";
import { HowItWorks } from "./_components/wall/how-it-works";
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

/**
 * The window's start. Reading the clock is impure, so it lives in a named
 * helper rather than inline in the render — the call still happens per request,
 * which is what a seven-day window from "now" needs.
 *
 * The count behind it is every publish in the window, whatever state the
 * profile is in today. Nothing can leave `published` yet — story 20 is what
 * takes a profile down — and the sentence says people *published*, which stays
 * true after one does. When story 20 lands, whether this should count only what
 * the Wall still shows is that ticket's call, and this comment is where it is
 * asked.
 */
function recentWindowStart(): Date {
  return new Date(Date.now() - SEVEN_DAYS);
}

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

    The recent count is a second query, and it is a count rather than a page:
    NFR2's "one query per page" is about the rows, and a `COUNT(*)` over a
    seven-day window is what makes a true number the page can show.
  */
  await connection();

  const [page, recent] = await Promise.all([
    profiles.wall(),
    profiles.publishedSince(recentWindowStart()),
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

  return (
    <div className="flex flex-col gap-8">
      {/*
        A real number, and only when it is above zero: before launch and in a
        quiet week the line is absent rather than reading "0 personas", which
        would be true and would say the opposite of what a reader takes it to
        mean. Held in the same box either way, so the rows do not move.
      */}
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
  );
}

export default function WallPage() {
  return (
    <main className="flex flex-col">
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
        <h2 id="recent-heading" className="page-heading">
          {RECENT_HEADING}
        </h2>

        {/* Rows stay at a reading measure; the section is wide so the heading lines up with the cover. */}
        <div className="max-w-3xl">
          <ListBoundary>
            <Suspense fallback={<ProfileListSkeleton />}>
              <WallList />
            </Suspense>
          </ListBoundary>
        </div>

        {/*
          Story 11's three standing notices, **below the list** (#276). They
          used to sit above it, and the UX lab's notices idea kept the block as
          it was, with one change in the owner's words: _"displayed at the
          bottom, not at the top."_ A reader who came to look reaches the people
          first; a reader who wants the three statements still finds all three
          together, at the foot of the list they just read. There is
          deliberately no link down to them from the top — the owner's call,
          recorded in `.impeccable/briefs/standing-notices.md`.

          Still **outside `ListBoundary`**: the spec's Wall `error` cell asks
          for the notices to still render when the read fails, and outside the
          boundary is the only place that is true.

          Below the grid, the skeleton's height is what keeps them still. A
          fallback of the wrong height now moves this block and everything
          after it when the rows arrive — below the fold on a phone, so it is
          not a first-screen shift, but it is one under a reader who has already
          scrolled down while the list streams.

          `h3`, not `h2`: this is inside the recent-profiles section, under that
          section's own heading. `/profiles` renders the same component at `h2`
          because there it sits directly in the page's `main`.
        */}
        <div className="max-w-3xl pt-4">
          <StandingNotices treatment="disclosure" level={3} />
        </div>
      </section>

      <HowItWorks />
    </main>
  );
}
