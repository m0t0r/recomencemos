/**
 * `/offers` — every Offer that has reached her, and where each one stands.
 *
 * **Scoped by profile ownership, and there is no not-the-owner case.** The read
 * takes the principal and scopes by it in its own `where` clause, so a caller who
 * is not the addressee of an Offer gets a list without it rather than somebody
 * else's. The spec's `permission denied` cell for this row is therefore
 * signed out → `/sign-in`, as `/sent-offers` found for the same reason.
 *
 * **No decision is taken here.** The list summarises; the Offer's own page holds
 * the full terms and the answer, because what she agrees to is what she can see.
 *
 * **`noindex`, both halves.** `/offers` has been on `GATED_ROUTE_PREFIXES` since
 * #12, so `next.config.ts` already sends `X-Robots-Tag`; this sets the `<meta>`.
 *
 * **Nothing is cached** (DD1), and the rows stream under their own boundary so the
 * heading and the lead paint on the first flush. **The page emits no log line**:
 * the terms are `personal` and NFR18 allows them on none.
 */

import { Skeleton } from "@repo/design-system/components/skeleton";
import { offers } from "@repo/domain/offers";
import { profiles } from "@repo/domain/profiles";
import type { Metadata } from "next";
import { Suspense } from "react";
import { StandingNotices } from "@/app/_components/notices/standing-notices";
import { requireAccountPage } from "@/lib/account";
import { ReceivedOfferList } from "./_components/received-offer-list";
import {
  RECEIVED_OFFERS_HEADING,
  RECEIVED_OFFERS_LEAD,
  RECEIVED_OFFERS_TITLE,
} from "./_lib/messages";

export const metadata: Metadata = {
  title: RECEIVED_OFFERS_TITLE,
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ readonly variant?: string }>;

async function ReceivedOffersPanel({ searchParams }: { readonly searchParams: SearchParams }) {
  const session = await requireAccountPage("/offers");

  /**
   * Both reads together: whether she holds a profile only decides which empty
   * state she meets, and it is one indexed lookup beside the list.
   */
  const [received, hasProfile] = await Promise.all([
    offers.listReceived(session.accountId),
    profiles.has(session.accountId),
  ]);

  // PROTOTYPE — throwaway, with the variants.
  const { variant } = await searchParams;

  return <ReceivedOfferList offers={received} hasProfile={hasProfile} variant={variant} />;
}

/** Held at the shape the rows take, so the heading above them does not move. */
function RowsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex flex-col gap-3">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-32" />
        </div>
      ))}
    </div>
  );
}

export default function ReceivedOffersPage({
  searchParams,
}: {
  readonly searchParams: SearchParams;
}) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="page-heading">{RECEIVED_OFFERS_HEADING}</h1>
        <p className="text-muted-foreground">{RECEIVED_OFFERS_LEAD}</p>
      </header>

      <Suspense fallback={<RowsSkeleton />}>
        <ReceivedOffersPanel searchParams={searchParams} />
      </Suspense>

      {/*
        Story 11's standing notices. `/offers` is a required prefix in
        `lib/notice-surfaces.ts`: she is reading what strangers wrote to her about
        paid work, which is exactly where "we verify nobody" and "we never handle
        the money" have to be in front of her. Outside the `<Suspense>`, so a
        failed read still leaves them on screen.
      */}
      <StandingNotices treatment="disclosure" />
    </main>
  );
}
