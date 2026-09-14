/**
 * `/offers/[id]` — the page with this Offer open, received or sent (#304).
 *
 * **The address stays because the delivery email links to it**, and because a
 * browser without JavaScript needs somewhere a row can be a link to. What it
 * renders is `/offers` with the Offer in the reading pane — beside the list from
 * `lg` up, the whole screen on a phone — so arriving from the email lands her on
 * that Offer, open, and the actions' redirect back here after an answer lands
 * her on it with the result in it.
 *
 * The spec's **One Offer** cells, decided in this order before anything renders:
 *
 * 1. **A segment that is not an Offer id → not found, before the session is read.**
 *    The return path is built from it, so checking first means the only string
 *    that can reach `/sign-in?returnPath=` is thirty-six characters of hex and
 *    dashes — the same reason `/profile/[slug]` checks its slug first.
 * 2. **Signed out → `/sign-in` with a way back.**
 * 3. **Not a party to it → the same not-found answer.** Both of her lists are
 *    scoped by the principal and carry no `LIMIT`, so an Offer absent from both is
 *    a missing id, one somebody else received or sent, one not yet let through
 *    and one she Reported alike — "indistinguishable" is a property of the reads
 *    rather than of several checks agreeing.
 *
 * **Every refusal is returned, never thrown** (C51). `notFound()` is a framework
 * interrupt of the same class as `redirect()`, and costs no Sentry event. **It
 * fires inside the streamed body, after the shell has gone out**, so what
 * reaches the browser is the not-found page under the shell's `200` rather than a
 * `404` status — the shape story 8's page had too.
 */

import { OFFER_ID_PATTERN } from "@repo/domain/offers";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StandingNotices } from "@/app/_components/notices/standing-notices";
import { MailboxFrame } from "../_components/mailbox-frame";
import { readMailbox } from "../_lib/mailbox";
import { type MailboxPage, viewMailbox } from "../_lib/mailbox-view";
import { ALREADY_ANSWERED, JUST_ACCEPTED, JUST_DECLINED, OFFERS_TITLE } from "../_lib/messages";

export const metadata: Metadata = {
  title: OFFERS_TITLE,
  robots: { index: false, follow: false },
};

type Params = Promise<{ readonly id: string }>;
type SearchParams = Promise<{
  readonly answered?: string | string[];
  readonly box?: string | string[];
}>;

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

async function readOpenPage(params: Params, searchParams: SearchParams): Promise<MailboxPage> {
  const { id } = await params;

  if (!OFFER_ID_PATTERN.test(id)) notFound();

  const mailbox = await readMailbox(`/offers/${id}`);
  const { answered, box } = await searchParams;

  const view = viewMailbox(mailbox, { box, open: id });
  if (!view.opened) notFound();

  // Only an Offer she answers can land with an answer's sentence.
  if (view.opened.direction !== "received") return view;

  return { ...view, arrival: arrivalFor(answered), justAccepted: answered === "accepted" };
}

export default function OfferPage({
  params,
  searchParams,
}: {
  readonly params: Params;
  readonly searchParams: SearchParams;
}) {
  return (
    <MailboxFrame
      // Not awaited: both boundaries in the frame resolve this one read.
      page={readOpenPage(params, searchParams)}
      detail
      /*
        Story 11's standing notices — the safety guidance and the no-money
        notice, at the moment they matter most: she may be about to give a
        stranger her number.
      */
      notices={<StandingNotices treatment="disclosure" />}
    />
  );
}
