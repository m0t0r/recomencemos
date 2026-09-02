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
 * **Paging is a link, not a button.** The cursor rides in the URL, so the next
 * page works with JavaScript unavailable, survives a reload, and can be followed
 * by a crawler. No infinite scroll, and no page numbers: the ordering is keyset
 * and a page number would be a claim about a list that is rewritten daily.
 *
 * Indexable, like the Wall, and for the same reason: only the public projection
 * reaches it.
 */

import { buttonVariants } from "@repo/design-system/components/button";
import { profiles, SLUG_PATTERN } from "@repo/domain/profiles";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ListEmptyState } from "../_components/profile-grid/empty-state";
import { GridBoundary } from "../_components/profile-grid/grid-boundary";
import {
  NOBODY_PUBLISHED_BODY,
  NOBODY_PUBLISHED_TITLE,
  TO_PUBLISH,
} from "../_components/profile-grid/messages";
import { ProfileGrid } from "../_components/profile-grid/profile-grid";
import { PrototypeSwitcher } from "../_components/profile-grid/prototype/switcher";
import {
  DenseGrid,
  ProfileRows,
  QuietOpening,
  variantFrom,
} from "../_components/profile-grid/prototype/variants";
import { ProfileGridSkeleton } from "../_components/profile-grid/skeleton";
import {
  BROWSE_CLEAR,
  BROWSE_LEAD,
  BROWSE_LEAD_QUIET,
  BROWSE_MORE,
  BROWSE_NARROWED_BODY,
  BROWSE_NARROWED_TITLE,
  BROWSE_PAGE_TITLE,
  BROWSE_TITLE,
} from "./_lib/messages";

export const metadata: Metadata = { title: BROWSE_PAGE_TITLE };

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
 * narrowing the list and offers to clear it. Story 19's Skill and city filters
 * add their own narrowing to this same shape.
 */
function BrowseEmpty({ narrowed }: { readonly narrowed: boolean }) {
  return narrowed ? (
    <ListEmptyState
      title={BROWSE_NARROWED_TITLE}
      body={BROWSE_NARROWED_BODY}
      actionHref="/profiles"
      actionLabel={BROWSE_CLEAR}
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

function MoreLink({ cursor, variant }: { readonly cursor: string; readonly variant: string }) {
  const query = variant === "A" ? "" : `&variant=${variant}`;

  return (
    <Link
      href={`/profiles?after=${cursor}${query}`}
      className={buttonVariants({ variant: "outline", className: "self-start" })}
    >
      {BROWSE_MORE}
    </Link>
  );
}

async function BrowseBody({ searchParams }: { readonly searchParams: SearchParams }) {
  const params = await searchParams;
  const after = cursorFrom(params.after);
  const variant = variantFrom(params.variant);
  const page = await profiles.browse({ after });

  if (page.items.length === 0) return <BrowseEmpty narrowed={after !== null} />;

  /**
   * The three variants disagree about whether the ordering is named, and that
   * is deliberately part of what is being chosen. Never on a card — a count
   * beside a person would label her — only ever over the list, or not at all.
   */
  if (variant === "B") {
    return (
      <div className="flex flex-col gap-8">
        <h1 className="text-foreground text-3xl font-semibold tracking-tight">{BROWSE_TITLE}</h1>
        <DenseGrid profiles={page.items} />
        {page.nextCursor ? <MoreLink cursor={page.nextCursor} variant={variant} /> : null}
        <PrototypeSwitcher current={variant} />
      </div>
    );
  }

  if (variant === "C") {
    return (
      <div className="flex flex-col gap-6">
        <QuietOpening title={BROWSE_TITLE} lead={BROWSE_LEAD_QUIET} />
        <ProfileRows profiles={page.items} />
        {page.nextCursor ? <MoreLink cursor={page.nextCursor} variant={variant} /> : null}
        <PrototypeSwitcher current={variant} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1 className="text-foreground text-3xl font-semibold tracking-tight text-balance">
          {BROWSE_TITLE}
        </h1>
        <p className="text-muted-foreground max-w-prose text-lg text-pretty">{BROWSE_LEAD}</p>
      </div>

      {/* Story 11's two standing notices land here, above the grid, as on the Wall. */}

      <ProfileGrid profiles={page.items} />
      {page.nextCursor ? <MoreLink cursor={page.nextCursor} variant={variant} /> : null}
      <PrototypeSwitcher current={variant} />
    </div>
  );
}

export default function BrowsePage({ searchParams }: { readonly searchParams: SearchParams }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <GridBoundary>
        <Suspense fallback={<ProfileGridSkeleton />}>
          <BrowseBody searchParams={searchParams} />
        </Suspense>
      </GridBoundary>
    </main>
  );
}
