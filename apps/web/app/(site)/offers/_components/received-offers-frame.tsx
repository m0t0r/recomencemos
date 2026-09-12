/**
 * The page both routes render: the heading and the count still waiting on her,
 * the ledger, and the standing notices at the foot.
 *
 * **`/offers/[id]` is this page with one row open** (#271). The delivery email
 * links there, so the address stays; what it renders is the ledger rather than
 * a second layout of the same Offer that would have to be kept in step.
 *
 * **One promise, two boundaries.** The page hands the ledger's read down
 * un-awaited; the count under the heading and the rows below each resolve it
 * inside their own `<Suspense>`, so the heading and the lead paint on the first
 * flush and neither half costs a second read.
 *
 * **The notices are a slot the page fills, not something this renders.**
 * `notice-surfaces.test.ts` reads each `page.tsx` for them — that is story 11's
 * "by construction", and a page that delegated them here would pass nothing that
 * test can see. This decides only where they sit: at the foot, outside every
 * boundary, so a failed or refused read still leaves them on screen.
 *
 * **`noindex`, both halves**: `/offers` is on `GATED_ROUTE_PREFIXES`, so
 * `next.config.ts` sends `X-Robots-Tag` for both routes, and each page sets its
 * own `<meta>`. **Nothing is cached** (DD1), and **no log line**: the terms are
 * `personal` and NFR18 allows them on none.
 */

import { Separator } from "@repo/design-system/components/separator";
import { Skeleton } from "@repo/design-system/components/skeleton";
import * as React from "react";
import type { LedgerView } from "../_lib/ledger";
import { RECEIVED_OFFERS_HEADING, RECEIVED_OFFERS_LEAD, waitingCount } from "../_lib/messages";
import { ReceivedOffersLedger } from "./received-offers-ledger";

type Ledger = Promise<LedgerView>;

/**
 * How many still wait on her, as part of the heading. Nothing when nothing has
 * arrived at all — the empty state below says that, and says it better.
 */
async function WaitingCount({ ledger }: { readonly ledger: Ledger }) {
  const { offers } = await ledger;
  if (offers.length === 0) return null;

  const waiting = offers.filter((offer) => offer.state === "delivered").length;

  return <p className="text-foreground font-medium">{waitingCount(waiting)}</p>;
}

async function Rows({ ledger }: { readonly ledger: Ledger }) {
  return <ReceivedOffersLedger {...await ledger} />;
}

/** Held at the shape a shut row takes, so the heading above does not move. */
function RowsSkeleton() {
  return (
    <div className="ruled-page" aria-hidden="true">
      {[0, 1, 2].map((row) => (
        <div key={row}>
          {row > 0 ? <Separator /> : null}
          <div className="flex flex-col gap-2 py-5">
            <div className="flex justify-between gap-3">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-5 w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReceivedOffersFrame({
  ledger,
  notices,
}: {
  readonly ledger: Ledger;
  /** The page's `<StandingNotices>`, rendered at the foot. */
  readonly notices: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="page-heading">{RECEIVED_OFFERS_HEADING}</h1>
        <p className="text-muted-foreground">{RECEIVED_OFFERS_LEAD}</p>
        <React.Suspense
          fallback={
            <div aria-hidden="true">
              <Skeleton className="h-6 w-48" />
            </div>
          }
        >
          <WaitingCount ledger={ledger} />
        </React.Suspense>
      </header>

      <React.Suspense fallback={<RowsSkeleton />}>
        <Rows ledger={ledger} />
      </React.Suspense>

      {notices}
    </main>
  );
}
