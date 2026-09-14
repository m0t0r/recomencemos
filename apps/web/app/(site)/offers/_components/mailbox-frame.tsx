/**
 * The page both routes render: the heading, the body streaming under it off one
 * read, and the standing notices at the foot.
 *
 * **`/offers/[id]` is this page with one Offer open.** The delivery email links
 * there, so the address stays; what it renders is the same folders and list with
 * the Offer beside them — or, on the phone, the Offer alone — rather than a
 * second layout of the same thing to be kept in step.
 *
 * **One promise, two boundaries.** The page hands its read down un-awaited; the
 * lead under the heading and the body below each resolve it inside their own
 * `<Suspense>`, so the heading paints on the first flush and neither half costs a
 * second read. A refusal thrown inside it — `notFound()` for somebody else's id —
 * arrives in the streamed body, under the shell's `200`.
 *
 * **The notices are a slot the page fills.** `notice-surfaces.test.ts` reads each
 * `page.tsx` for them; this decides only where they sit — at the foot, outside
 * every boundary, so a failed or refused read still leaves them on screen.
 *
 * **`noindex`, both halves** — `/offers` is on `GATED_ROUTE_PREFIXES` and each
 * page sets its own `<meta>`. **Nothing is cached** (DD1), and **no log line**:
 * the terms are `personal` and NFR18 allows them on none.
 */

import { Separator } from "@repo/design-system/components/separator";
import { Skeleton } from "@repo/design-system/components/skeleton";
import { cn } from "@repo/design-system/lib/utils";
import * as React from "react";
import type { MailboxPage } from "../_lib/mailbox-view";
import { OFFERS_HEADING } from "../_lib/messages";
import { Mailbox, MailboxLead } from "./mailbox";

type PagePromise = Promise<MailboxPage>;

async function Lead({ page }: { readonly page: PagePromise }) {
  return <MailboxLead view={await page} />;
}

async function Body({ page }: { readonly page: PagePromise }) {
  return <Mailbox view={await page} />;
}

function LeadSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      <Skeleton className="h-5 w-full max-w-xl" />
      <Skeleton className="h-6 w-48" />
    </div>
  );
}

/** Held at a row's height, and at the pane's where one opens, so nothing above moves. */
function BodySkeleton({ detail }: { readonly detail: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8" aria-hidden="true">
      <div className={cn("flex flex-col lg:col-span-5", detail && "max-lg:hidden")}>
        {[0, 1, 2, 3].map((row) => (
          <div key={row}>
            {row > 0 ? <Separator /> : null}
            <div className="flex flex-col gap-2 px-3 py-2.5">
              <div className="flex justify-between gap-3">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-5 w-40" />
            </div>
          </div>
        ))}
      </div>
      <div className={cn("flex flex-col gap-3 lg:col-span-7", !detail && "max-lg:hidden")}>
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

export function MailboxFrame({
  page,
  detail,
  notices,
}: {
  readonly page: PagePromise;
  /** The `/offers/[id]` route: on the phone, the opened Offer is the whole screen. */
  readonly detail: boolean;
  /** The page's `<StandingNotices>`, rendered at the foot. */
  readonly notices: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
      {/*
        On the phone's detail screen the heading block is hidden from the eye and
        kept for a screen reader: the Offer is the screen, and the page still has
        its `h1`.
      */}
      <header className={cn("flex flex-col gap-2", detail && "max-lg:sr-only")}>
        <h1 className="page-heading">{OFFERS_HEADING}</h1>
        <React.Suspense fallback={<LeadSkeleton />}>
          <Lead page={page} />
        </React.Suspense>
      </header>

      <React.Suspense fallback={<BodySkeleton detail={detail} />}>
        <Body page={page} />
      </React.Suspense>

      {notices}
    </main>
  );
}
