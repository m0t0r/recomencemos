/**
 * `/sent-offers` — every Offer one Hirer has sent, and where each one is.
 *
 * **This is the only surface where the platform's own delay is visible to the
 * person waiting on it.** NFR7 gives every Offer a 24-hour review band and there
 * is nobody on call, so a queue depth only the operator can see is a queue depth
 * nobody outside is told about. The row states the normal window before it is
 * exceeded and says plainly, past it, that this one is taking longer than usual.
 *
 * **State only** (the API contract's own words): no contact detail of hers
 * appears here at any state, because none has crossed. `SentOffer` is what
 * enforces it — the projection carries her `PublicProfile`-shaped identity and
 * nothing more — and this page reaches around nothing.
 *
 * **`noindex`, both halves.** `/sent-offers` has been on `GATED_ROUTE_PREFIXES`
 * since #12, so `next.config.ts` already sends `X-Robots-Tag`; this sets the
 * `<meta>`.
 *
 * **Nothing is cached** (DD1) and the rows stream under their own boundary, so
 * the heading and the lead paint on the first flush and the list arrives after.
 * The clock is read **here**, once, at the dynamic boundary — every row on the
 * screen then agrees about what "24 hours ago" means, and nothing below this
 * reads the current time, which is what fails a prerender with
 * `blocking-prerender-current-time`.
 *
 * **The page emits no log line of its own.** The Offers' terms are `personal`
 * and NFR18 allows them on **0** lines, so there is nothing here worth writing
 * and everything here worth not writing.
 */

import { Skeleton } from "@repo/design-system/components/skeleton";
import { exchanges } from "@repo/domain/exchange";
import { offers } from "@repo/domain/offers";
import type { Metadata } from "next";
import * as React from "react";
import { StandingNotices } from "@/app/_components/notices/standing-notices";
import { requireAccountPage } from "@/lib/account";
import { SentOfferList } from "./_components/sent-offer-list";
import {
  OFFER_JUST_SENT_HEADING,
  OFFER_JUST_SENT_IMMUTABLE,
  OFFER_JUST_SENT_REVIEW,
  SENT_OFFERS_HEADING,
  SENT_OFFERS_LEAD,
  SENT_OFFERS_TITLE,
} from "./_lib/messages";

export const metadata: Metadata = {
  title: SENT_OFFERS_TITLE,
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ readonly sent?: string }>;

async function SentOffersPanel() {
  /**
   * Signed out → `/sign-in` with a way back. There is no not-the-sender case on
   * this route: the read is scoped by the principal in its own `where` clause, so
   * a caller who is not the sender gets an empty list rather than somebody
   * else's.
   */
  const session = await requireAccountPage("/sent-offers");

  /**
   * **Her details reach this page through the exchange read and nowhere else.**
   * `SentOffer` stays state-only, so no Offer in any other state can carry a
   * detail of hers here; an accepted row gets the Contact Exchange beside it,
   * read as he is party to it. Only his side's: an Account that is also a Worker
   * holds exchanges `/offers` shows instead.
   */
  const [sent, exchanged] = await Promise.all([
    offers.listSent(session.accountId, new Date()),
    exchanges.listForParty(session.accountId),
  ]);

  return (
    <SentOfferList
      offers={sent}
      exchanges={exchanged.filter((exchange) => exchange.side === "hirer")}
    />
  );
}

/** Held at the shape the rows take, so the heading above them does not move. */
function RowsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex flex-col gap-3">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-32" />
        </div>
      ))}
    </div>
  );
}

/**
 * The line he lands on after sending, and the whole of why it is its own
 * component.
 *
 * **`await searchParams` at the page's top level fails the build** — Cache
 * Components refuses a route that reads request data outside a `<Suspense>`,
 * and it names the three ways out: `[stream]`, `[cache]`, `[block]`. This is
 * `[stream]`, chosen because the other two are wrong here rather than merely
 * unnecessary: nothing about one person's `?sent=1` may be cached, and blocking
 * the route would cost `pnpm page-weight` its prerendered document for a line
 * that renders on one arrival in twenty.
 *
 * Measured at seam 3 rather than predicted: the page built, and the first real
 * redirect into it rendered the error boundary.
 *
 * The fallback is `null` because there is nothing to hold: the line is absent on
 * every arrival but one, so a skeleton would promise a row that is not coming.
 */
async function SentConfirmation({ searchParams }: { readonly searchParams: SearchParams }) {
  const { sent } = await searchParams;

  if (sent !== "1") return null;

  /**
   * `status` rather than `alert`: it is the outcome of something he did, and it
   * is good news. It interrupts nothing.
   *
   * **All three clauses, because that is the criterion.** The page's lead
   * carries the human review and the row carries the window; neither says he
   * cannot change it, so without this the one thing he was warned about before
   * writing would never be confirmed after sending.
   */
  return (
    <output className="border-border flex flex-col gap-1 border-l-2 pl-4">
      <span className="text-foreground font-medium">{OFFER_JUST_SENT_HEADING}</span>
      <span className="text-muted-foreground text-sm">{OFFER_JUST_SENT_REVIEW}</span>
      <span className="text-muted-foreground text-sm">{OFFER_JUST_SENT_IMMUTABLE}</span>
    </output>
  );
}

export default function SentOffersPage({ searchParams }: { readonly searchParams: SearchParams }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="page-heading">{SENT_OFFERS_HEADING}</h1>
        <p className="text-muted-foreground">{SENT_OFFERS_LEAD}</p>
      </header>

      <React.Suspense fallback={null}>
        <SentConfirmation searchParams={searchParams} />
      </React.Suspense>

      <React.Suspense fallback={<RowsSkeleton />}>
        <SentOffersPanel />
      </React.Suspense>

      {/*
        Story 11's standing notices. `/sent-offers` is a required prefix in
        `lib/notice-surfaces.ts`, and this is a surface where the no-money notice
        is doing real work: he is waiting on an answer about work he offered to
        pay for, and this platform holds none of that money.

        Outside the `<Suspense>`, so a failed read still leaves them on screen.
      */}
      <StandingNotices treatment="disclosure" />
    </main>
  );
}
