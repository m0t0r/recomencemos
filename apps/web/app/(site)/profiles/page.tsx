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

import { profiles, SLUG_PATTERN } from "@repo/domain/profiles";
import type { Metadata } from "next";
import { Suspense } from "react";
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
import { MoreProfiles } from "./_components/more-profiles";
import {
  BROWSE_LEAD,
  BROWSE_NARROWED_BODY,
  BROWSE_NARROWED_TITLE,
  BROWSE_TITLE,
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
 * The list is empty for one of two reasons, and they are different states.
 *
 * Nothing published at all is a fact about the platform; nothing on *this* page
 * is a fact about where the reader is standing — so the second names what is
 * narrowing the list and offers to clear it.
 *
 * **Today the narrowing it can name is the page cursor**, because that is the
 * only one that exists. Story 19's Skill and city filters add their own to this
 * same shape, and when they do this condition has to widen with them — a filter
 * set and no cursor would otherwise fall to the "nobody has published" branch.
 */
function BrowseEmpty({ narrowed }: { readonly narrowed: boolean }) {
  return narrowed ? (
    <ListEmptyState
      title={BROWSE_NARROWED_TITLE}
      body={BROWSE_NARROWED_BODY}
      actionHref="/profiles"
      actionLabel={TO_BROWSE}
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
}

async function BrowseList({ searchParams }: { readonly searchParams: SearchParams }) {
  const after = cursorFrom((await searchParams).after);
  const page = await profiles.browse({ after });

  if (page.items.length === 0) return <BrowseEmpty narrowed={after !== null} />;

  return (
    <ProfileList profiles={page.items}>
      {page.nextCursor ? <MoreProfiles initialCursor={page.nextCursor} /> : null}
    </ProfileList>
  );
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

      {/* Story 11's two standing notices land here, above the list, as on the Wall. */}

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
