/**
 * `/offers/[id]` — the ledger, with this Offer's row open (#271).
 *
 * **The address stays because the delivery email links to it**, and because a
 * browser without JavaScript needs somewhere a row can be a link to. What it
 * renders is `/offers` with one `<details open>`, so arriving from the email
 * lands her on that Offer, open, among the others — and the actions' redirect
 * back here after an answer lands her on the same row with the result in it.
 *
 * The spec's **One Offer** cells, decided in this order before any row renders:
 *
 * 1. **A segment that is not an Offer id → 404, before the session is read.**
 *    The return path is built from it, so checking first means the only string
 *    that can reach `/sign-in?returnPath=` is thirty-six characters of hex and
 *    dashes — the same reason `/profile/[slug]` checks its slug first.
 * 2. **Signed out → `/sign-in` with a way back.**
 * 3. **Not the addressee → the same 404.** Her list is scoped by her ownership
 *    and carries no `LIMIT`, so an Offer absent from it is a missing id, one
 *    somebody else received, one not yet let through and one she Reported alike
 *    — "indistinguishable" is a property of one read rather than of several
 *    agreeing.
 *
 * **Every refusal is returned, never thrown** (C51). `notFound()` is a framework
 * interrupt of the same class as `redirect()`, and costs no Sentry event.
 */

import { OFFER_ID_PATTERN } from "@repo/domain/offers";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StandingNotices } from "@/app/_components/notices/standing-notices";
import { ReceivedOffersFrame } from "../_components/received-offers-frame";
import { type LedgerView, readLedger } from "../_lib/ledger";
import {
  ALREADY_ANSWERED,
  JUST_ACCEPTED,
  JUST_DECLINED,
  RECEIVED_OFFERS_TITLE,
} from "../_lib/messages";

export const metadata: Metadata = {
  title: RECEIVED_OFFERS_TITLE,
  robots: { index: false, follow: false },
};

type Params = Promise<{ readonly id: string }>;
type SearchParams = Promise<{ readonly answered?: string | string[] }>;

/**
 * The sentence she lands on after answering, keyed by the `answered` parameter
 * the actions redirect with. Anything else in it is ignored rather than echoed —
 * `Object.hasOwn`, so `?answered=toString` is not a key either.
 */
const ARRIVALS: Readonly<Record<string, string>> = {
  accepted: JUST_ACCEPTED,
  declined: JUST_DECLINED,
  already: ALREADY_ANSWERED,
};

function arrivalFor(answered: string | string[] | undefined): string | undefined {
  return typeof answered === "string" && Object.hasOwn(ARRIVALS, answered)
    ? ARRIVALS[answered]
    : undefined;
}

async function readOpenLedger(params: Params, searchParams: SearchParams): Promise<LedgerView> {
  const { id } = await params;

  if (!OFFER_ID_PATTERN.test(id)) notFound();

  const ledger = await readLedger(`/offers/${id}`);
  if (!ledger.offers.some((offer) => offer.id === id)) notFound();

  const { answered } = await searchParams;

  return { ...ledger, openId: id, arrival: arrivalFor(answered) };
}

export default function ReceivedOfferPage({
  params,
  searchParams,
}: {
  readonly params: Params;
  readonly searchParams: SearchParams;
}) {
  return (
    <ReceivedOffersFrame
      // Not awaited: both boundaries in the frame resolve this one read.
      ledger={readOpenLedger(params, searchParams)}
      /*
        Story 11's standing notices — the safety guidance and the no-money
        notice, at the moment they matter most: she may be about to give a
        stranger her number.
      */
      notices={<StandingNotices treatment="disclosure" />}
    />
  );
}
