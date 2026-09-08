/**
 * `/profiles` — the browsable list, fewest delivered Offers first.
 *
 * Shaped at `.impeccable/briefs/wall.md` alongside the Wall; the state set is
 * the spec's `## UX design`, Browse row.
 *
 * **This is the catalogue and the Wall is the teaser.** The ordering is the
 * attention spread this product commits to: a Hirer who browses meets the people
 * nobody has contacted before he meets the ones everybody has. It is a pure
 * function of stored columns, which is what keeps it index-ordered and
 * keyset-paginable — see `@repo/domain/policy`.
 *
 * **Paging is a link that scrolling enhances, never a scroll that replaces it.**
 * The first page is server-rendered and the cursor rides in the URL, so with
 * JavaScript unavailable the whole list is still reachable and still indexable —
 * which two of this ticket's criteria are about. `_components/more-profiles.tsx`
 * is the enhancement; it appends further pages in place and leaves the link
 * standing.
 *
 * No page numbers: the ordering is keyset and a page number would be a claim
 * about a list that is rewritten daily.
 */

import { Skeleton } from "@repo/design-system/components/skeleton";
import { cityLabel } from "@repo/domain/policy";
import { profiles, SLUG_PATTERN } from "@repo/domain/profiles";
import { skills } from "@repo/domain/skills";
import type { Metadata } from "next";
import { connection } from "next/server";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Suspense } from "react";
import { StandingNotices } from "@/app/_components/notices/standing-notices";
import { CountAnnouncement } from "../_components/profile-list/count-announcement";
import { ListEmptyState } from "../_components/profile-list/empty-state";
import { ListBoundary } from "../_components/profile-list/list-boundary";
import { ProfileList } from "../_components/profile-list/profile-list";
import { ProfileListSkeleton } from "../_components/profile-list/skeleton";
import {
  NOBODY_PUBLISHED_BODY,
  NOBODY_PUBLISHED_TITLE,
  TO_BROWSE,
  TO_PUBLISH,
} from "../_lib/lists/messages";
import { BrowseFiltersForm, SkillOptionsFallback } from "./_components/browse-filters";
import { MoreProfiles } from "./_components/more-profiles";
import { type BrowseFilters, browseFiltersFrom, browseHref, isNarrowed } from "./_lib/filters";
import {
  BROWSE_LEAD,
  BROWSE_NARROWED_BODY,
  BROWSE_NARROWED_TITLE,
  BROWSE_TITLE,
  FILTER_CLEAR,
  FILTER_EMPTY_TITLE,
  narrowedBy,
  typedTerm,
} from "./_lib/messages";

export const metadata: Metadata = { title: BROWSE_TITLE };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/**
 * The cursor, or nothing.
 *
 * Checked against the minter's own pattern before it reaches a query — not
 * because the query would be unsafe (it is parameterised) but because a
 * malformed cursor should produce the first page rather than an empty one that
 * looks like a bug.
 */
function cursorFrom(value: string | string[] | undefined): string | null {
  return typeof value === "string" && SLUG_PATTERN.test(value) ? value : null;
}

/**
 * The list is empty for one of three reasons, and they are three different
 * states rather than one sentence with three causes.
 *
 * Nothing on *this page* is a fact about **where the reader is standing**, which
 * a link they followed put them at. Nothing matching what somebody chose is a
 * fact about **the filters**, so it names them and offers to clear them. Nothing
 * published at all is a fact about the **platform**.
 *
 * **The cursor is read first, and the order is the finding rather than a
 * preference.** Filters and a cursor can both be set at once — that is the end
 * of a filtered list — and testing the filters first told a reader who had paged
 * to the end that their filters matched nobody, when their filters had matched
 * three pages of people. The cursor is the immediate cause whenever it is
 * present, so it answers first, and its way out is the **first page of the list
 * she is actually reading** rather than a route that also throws her filters
 * away.
 *
 * **It announces the empty result**, and that is the one place this surface
 * needs its own live region. `ProfileList` carries the count announcement and is
 * rendered only when there are rows, so a filter that takes twenty-four profiles
 * down to none used to swap the list for this panel in silence — and *Quitar los
 * filtros* is a `<Link>`, so there is no document load to re-read the page.
 */
function BrowseEmpty({
  filters,
  narrowing,
  cursor,
}: {
  readonly filters: BrowseFilters;
  /** What is narrowing the list, in the words a person reads. */
  readonly narrowing: readonly string[];
  /** The page cursor the reader arrived with, or nothing. */
  readonly cursor: string | null;
}) {
  const empty =
    cursor !== null ? (
      <ListEmptyState
        title={BROWSE_NARROWED_TITLE}
        body={BROWSE_NARROWED_BODY}
        actionHref={browseHref(filters)}
        actionLabel={TO_BROWSE}
        actionVariant="outline"
      />
    ) : isNarrowed(filters) ? (
      <ListEmptyState
        title={FILTER_EMPTY_TITLE}
        body={narrowedBy(narrowing)}
        actionHref="/profiles"
        actionLabel={FILTER_CLEAR}
        actionVariant="outline"
      />
    ) : (
      <ListEmptyState
        title={NOBODY_PUBLISHED_TITLE}
        body={NOBODY_PUBLISHED_BODY}
        actionHref="/publish"
        actionLabel={TO_PUBLISH}
      />
    );

  return (
    <>
      <CountAnnouncement count={0} />
      {empty}
    </>
  );
}

/**
 * The results.
 *
 * **The Skill's label is read here rather than passed down from the controls**,
 * and the two reads are deliberately not shared: the controls and the list are
 * separate Suspense boundaries precisely so the controls paint without waiting
 * on the list, and one awaited value shared between them would join them back
 * together. The vocabulary read is a single indexed statement over ninety rows,
 * and it is only reached at all when the empty state has something to name.
 */
async function BrowseList({ searchParams }: { readonly searchParams: SearchParams }) {
  const params = await searchParams;
  const after = cursorFrom(params.after);
  const filters = browseFiltersFrom(params);

  const page = await profiles.browse({ ...filters, after });

  if (page.items.length === 0) {
    return <BrowseEmpty filters={filters} narrowing={await narrowingOf(filters)} cursor={after} />;
  }

  return (
    <ProfileList profiles={page.items}>
      {page.nextCursor ? <MoreProfiles initialCursor={page.nextCursor} filters={filters} /> : null}
    </ProfileList>
  );
}

/**
 * The controls.
 *
 * **They take no `filters` prop**: the panel reads the query string itself
 * through `nuqs`, which is the same string this file reads for the list, so
 * there is one reading and no second copy to keep in step. It is rendered on the
 * server like any client component, so the controls arrive in the document
 * already holding what the URL says.
 */
function BrowseFiltersPanel() {
  return (
    /*
      `nuqs`' adapter is mounted **here**, on the one route that has query state,
      rather than in the root layout — the reason #157 moved the toast region out
      of it: a provider above every route is paid for by every route, and `/` and
      `/privacy` have nothing to keep in the URL.
    */
    <NuqsAdapter>
      <BrowseFiltersForm
        skillOptions={
          /*
            The one database read on this half of the page, in a boundary of its
            own **inside** the `<select>`. The control is complete without it —
            `Cualquier capacidad` is what an unfiltered search sends — so holding
            the whole panel for it would trade three ready controls for one.
          */
          <Suspense fallback={<SkillOptionsFallback />}>
            <SkillOptions />
          </Suspense>
        }
      />
    </NuqsAdapter>
  );
}

/**
 * **`await connection()` first**, which is `[dynamic]` from Cache Components'
 * own menu and the same boundary `VocabularyStrip` puts in front of this exact
 * read on the Wall.
 *
 * Without it the list is resolved while the shell is prerendered and baked into
 * it, so a Skill promoted through the Admin queue would not appear in this
 * control until the next deploy. It is also the one thing standing between a
 * build and a database: the read reaches `#connection`, which wants
 * `DATABASE_URL`, and a build machine has none — that failure surfaces as a
 * complaint about `crypto.randomUUID()`, because the missing variable becomes an
 * `AppError` and an `AppError` mints a reference number. A build with a local
 * `.env.local` beside it hides both halves.
 */
async function SkillOptions() {
  await connection();

  const vocabulary = await skills.listActive();

  return vocabulary.map((skill) => (
    <option key={skill.slug} value={skill.slug}>
      {skill.labelEs}
    </option>
  ));
}

/**
 * Holds the controls' box for the tick `searchParams` takes to resolve.
 *
 * Mirrored piece for piece rather than measured to a number, for the reason
 * `ProfileListSkeleton` gives: a height written down goes stale the first time a
 * control gains a line, and nothing says so. `aria-hidden`, because the controls
 * announce themselves when they arrive.
 */
function FiltersSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-hidden="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-full" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-16" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-44" />
        </div>
      </div>
      <Skeleton className="h-9 w-24" />
    </div>
  );
}

/** What is narrowing the list, in the order the controls sit, and in her words. */
async function narrowingOf(filters: BrowseFilters): Promise<string[]> {
  if (!isNarrowed(filters)) return [];

  const terms: string[] = [];
  if (filters.query) terms.push(typedTerm(filters.query));

  if (filters.skill) {
    const label = (await skills.listActive()).find((skill) => skill.slug === filters.skill);
    // A well-formed slug naming no Skill matched nothing, which is why this
    // state is on screen at all. It is named by its slug rather than dropped:
    // "you are filtering by something" is more use than a silent omission.
    terms.push(label?.labelEs ?? filters.skill);
  }

  if (filters.city) terms.push(cityLabel(filters.city));

  return terms;
}

/**
 * The framing is the Wall's own, and it is copied deliberately rather than
 * merely resembling it.
 *
 * The two surfaces are one list seen twice — the teaser and the whole ledger —
 * and until #184 they said so in the copy and denied it in the geometry: this
 * page held everything at `max-w-3xl`, so arriving from `/` moved the column
 * 128 px across the screen, and its one sentence over the list was a step
 * larger than the Wall's and half the distance below the heading. So the
 * measurements below are the Wall's `#profiles` section — the wide column with
 * the rows held at a reading measure inside it, `gap-6` under the heading,
 * `gap-8` over the rows, and the sentence in the working face at the body step.
 *
 * **Three things are deliberately not copied, and each is named where it sits**
 * rather than left for a reader to notice as a drift. `py-10`, because the
 * Wall's asymmetric `pt-12 pb-4 sm:pt-16` exists to clear the cover above it
 * and this page opens on the shell, so it takes the sheet rhythm `/sign-in` and
 * `/publish` use. `min-h-6`, because the Wall's line holds its box against a
 * count that can be absent and this sentence is never absent. And `max-w-prose`
 * is *added*, because the ladder caps prose and this sentence is long enough to
 * reach the cap where the Wall's is not.
 */
export default function BrowsePage({ searchParams }: { readonly searchParams: SearchParams }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <h1 className="page-heading">{BROWSE_TITLE}</h1>

      {/*
        Story 11's three standing notices, in the slot this comment reserved —
        above the list and outside `ListBoundary`, as on the Wall and for the
        same reason. `h2` here, where the Wall renders `h3`: this sits directly
        under the page's `h1` rather than inside a section of its own.
      */}
      <div className="max-w-3xl">
        <StandingNotices treatment="disclosure" />
      </div>

      {/* Rows stay at a reading measure; the column is wide so the heading lands where the Wall's does. */}
      <div className="flex max-w-3xl flex-col gap-8">
        {/*
          The ordering, named once, over the list — never on a card, which would
          label a person by what has not happened to her.

          It sits **above** the boundary rather than inside it, which is where
          it differs from the Wall's count line: that one is a read and goes
          when the read fails, while this is a fact about how the list is built
          and is still true of the list a reader is being offered a second route
          to. It is the same reason the notice slot above is outside it.

          `max-w-prose` is the one thing here the Wall's line does not carry,
          and it is the ladder's rule rather than a departure from the Wall:
          `DESIGN.md` → Typography holds prose at 65–75ch, and the Wall's line
          is a short sentence that never reaches the cap while this one is 118
          characters and would run to ~92ch in the column without it.
        */}
        <p className="text-muted-foreground max-w-prose text-pretty">{BROWSE_LEAD}</p>

        {/*
          The controls, in a boundary of their own and **outside** `ListBoundary`.

          Three things follow from that placement. They wait on nothing but the
          query string, so they paint and become usable while the list is still
          streaming into the skeleton below them. A list read that fails leaves
          them standing — the search that failed is the one thing a reader would
          want to change, so putting them inside the failing boundary would take
          away the way out at the moment it is needed. And the boundary is
          **required** rather than chosen: the panel reads the query string
          through `nuqs`, which is `useSearchParams` underneath, and a client
          component reading that outside a boundary opts the whole route out of
          the static shell.
        */}
        <Suspense fallback={<FiltersSkeleton />}>
          <BrowseFiltersPanel />
        </Suspense>

        {/*
          The escape the Wall does not need: a page of this list that failed still
          offers the whole list, which is the spec's `error` cell for Browse —
          "the unfiltered list is still reachable".
        */}
        <ListBoundary escape={{ href: "/profiles", label: TO_BROWSE }}>
          <Suspense fallback={<ProfileListSkeleton />}>
            <BrowseList searchParams={searchParams} />
          </Suspense>
        </ListBoundary>
      </div>
    </main>
  );
}
