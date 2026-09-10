/**
 * `/offers/[id]` — one Offer she has received, in full, and her answer to it.
 *
 * The state set is the spec's **One Offer** row. Three of its cells are decided
 * before anything worth reading is rendered, in this order:
 *
 * 1. **A segment that is not an Offer id → 404, before the session is read.**
 *    The return path below is built from it, so checking first means the only
 *    string that can reach `/sign-in?returnPath=` is thirty-six characters of
 *    hex and dashes — the same reason `/profile/[slug]` checks its slug first.
 * 2. **Signed out → `/sign-in` with a way back.**
 * 3. **Not the addressee → the same 404.** One read, scoped by her ownership,
 *    answers a missing id, an Offer somebody else received, one not yet let
 *    through and one she Reported alike — so "indistinguishable" is a property
 *    of there being one code path rather than of several agreeing.
 *
 * **Every refusal is returned, never thrown** (C51). `notFound()` is a framework
 * interrupt of the same class as `redirect()`, and costs no Sentry event.
 *
 * **Terms first, identity streaming** — the spec's `partial` cell. The terms
 * are awaited behind a skeleton at their own height; the Hirer's declared name
 * is a second read, handed down un-awaited and resolved inside its own
 * boundary, so the terms are on screen before anything about him is. The
 * answer waits on the same promise, because its confirmation names him.
 *
 * **`noindex`, both halves**, and **no log line**: the terms are `personal`.
 */

import { Skeleton } from "@repo/design-system/components/skeleton";
import { OFFER_ID_PATTERN, offers, type ReceivedOfferSender } from "@repo/domain/offers";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StandingNotices } from "@/app/_components/notices/standing-notices";
import { PrototypeSwitcher } from "@/app/_components/prototype-switcher";
import { type PrototypeVariant, variantFrom } from "@/app/_lib/prototype-variants";
import { requireAccountPage } from "@/lib/account";
import { OfferStateBadge, OfferTerm } from "../_components/offer-parts";
import {
  ALREADY_ANSWERED,
  asReceivedState,
  BACK_TO_OFFERS,
  JUST_ACCEPTED,
  JUST_DECLINED,
  OFFER_PAY_LABEL,
  OFFER_WHEN_LABEL,
  OFFER_WORK_LABEL,
  offerSentOn,
  RECEIVED_OFFER_HEADING,
  RECEIVED_OFFER_TITLE,
  RECEIVED_STATE_SENTENCES,
  SENDER_DECLARED,
  SENDER_LABEL,
  SENDER_UNNAMED,
} from "../_lib/messages";
import { AnswerControls } from "./_components/answer-controls";

export const metadata: Metadata = {
  title: RECEIVED_OFFER_TITLE,
  robots: { index: false, follow: false },
};

type Params = Promise<{ readonly id: string }>;
type SearchParams = Promise<{ readonly answered?: string; readonly variant?: string }>;

/** PROTOTYPE — throwaway, with the variants. */
const VARIANTS: readonly PrototypeVariant[] = [
  { key: "a", name: "Diálogo encima" },
  { key: "b", name: "En la página" },
  { key: "c", name: "Barra abajo" },
];

/** The sentence she lands on after answering, keyed by the `answered` parameter. */
const ARRIVALS: Readonly<Record<string, string>> = {
  accepted: JUST_ACCEPTED,
  declined: JUST_DECLINED,
  already: ALREADY_ANSWERED,
};

/** Who claims to be asking. The absence leads; the name is his claim. */
async function Sender({ sender }: { readonly sender: Promise<ReceivedOfferSender | undefined> }) {
  const found = await sender;
  if (!found) return null;

  return (
    <section aria-labelledby="offer-sender" className="flex flex-col gap-1">
      <h2 id="offer-sender" className="text-muted-foreground text-sm">
        {SENDER_LABEL}
      </h2>
      <p className="text-foreground font-medium">{found.hirerName ?? SENDER_UNNAMED}</p>
      {found.hirerName === null ? null : (
        <p className="text-muted-foreground text-sm">{SENDER_DECLARED}</p>
      )}
    </section>
  );
}

/** The answer, once his name is known — the confirmation says it. */
async function Answer({
  offerId,
  sender,
  variant,
}: {
  readonly offerId: string;
  readonly sender: Promise<ReceivedOfferSender | undefined>;
  readonly variant: string;
}) {
  const found = await sender;
  if (!found) return null;

  return <AnswerControls offerId={offerId} hirerName={found.hirerName} variant={variant} />;
}

/** Skeleton rows at the height of the identity block, so nothing below it moves. */
function SenderSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-4 w-full" />
    </div>
  );
}

/** At the height of the two answer buttons. */
function AnswerSkeleton() {
  return (
    <div className="flex gap-3" aria-hidden="true">
      <Skeleton className="h-10 w-28" />
      <Skeleton className="h-10 w-28" />
    </div>
  );
}

async function OfferPanel({
  params,
  searchParams,
}: {
  readonly params: Params;
  readonly searchParams: SearchParams;
}) {
  const { id } = await params;

  if (!OFFER_ID_PATTERN.test(id)) notFound();

  const session = await requireAccountPage(`/offers/${id}`);

  const terms = await offers.receivedTerms(session.accountId, id);
  const state = terms ? asReceivedState(terms.state) : undefined;
  if (!terms || !state) notFound();

  /**
   * **Not awaited**, which is the whole of the streaming criterion: both
   * boundaries below suspend on this one promise, and the terms paint first.
   */
  const sender = offers.receivedSender(session.accountId, id);

  const { answered, variant: rawVariant } = await searchParams;
  const variant = variantFrom(rawVariant, VARIANTS);
  const arrival = answered ? ARRIVALS[answered] : undefined;

  const senderBlock = (
    <Suspense fallback={<SenderSkeleton />}>
      <Sender sender={sender} />
    </Suspense>
  );

  return (
    <>
      {/*
        `status` rather than `alert`: it is the outcome of something she did. It
        is shown on arrival; the state line below is what stays on every later
        visit, which is what "stays confirmed rather than vanishing" asks for.
      */}
      {arrival ? (
        <output className="border-border text-foreground border-l-2 pl-4 font-medium">
          {arrival}
        </output>
      ) : null}

      {variant === "b" ? senderBlock : null}

      {/*
        No heading of its own: the page's `<h1>` already names this, and a
        second copy under it was announced twice to a screen reader.
      */}
      <article className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-foreground text-sm">{RECEIVED_STATE_SENTENCES[state]}</p>
          <OfferStateBadge state={state} className="mt-0.5" />
        </div>

        <dl className="flex flex-col gap-4">
          <OfferTerm label={OFFER_WORK_LABEL} value={terms.workDescription} />
          <OfferTerm label={OFFER_PAY_LABEL} value={terms.payTerms} />
          <OfferTerm label={OFFER_WHEN_LABEL} value={terms.whenText} />
        </dl>

        <time dateTime={terms.sentAt.toISOString()} className="text-muted-foreground text-xs">
          {offerSentOn(terms.sentAt)}
        </time>
      </article>

      {variant === "b" ? null : senderBlock}

      {/*
        The answer, only while there is one to give. An answered or expired
        Offer shows its state above and no controls.
      */}
      {state === "delivered" ? (
        <Suspense fallback={<AnswerSkeleton />}>
          <Answer offerId={terms.id} sender={sender} variant={variant} />
        </Suspense>
      ) : null}

      <PrototypeSwitcher variants={VARIANTS} current={variant} />
    </>
  );
}

/** The page boundary's fallback: the heading row and the terms, at their height. */
function TermsSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <Skeleton className="h-4 w-40" />
      {[0, 1, 2].map((term) => (
        <div key={term} className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export default function ReceivedOfferPage({
  params,
  searchParams,
}: {
  readonly params: Params;
  readonly searchParams: SearchParams;
}) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-3">
        <Link
          href="/offers"
          className="text-muted-foreground w-fit text-sm underline underline-offset-4"
        >
          {BACK_TO_OFFERS}
        </Link>
        <h1 className="page-heading">{RECEIVED_OFFER_HEADING}</h1>
      </header>

      <Suspense fallback={<TermsSkeleton />}>
        <OfferPanel params={params} searchParams={searchParams} />
      </Suspense>

      {/*
        Story 11's standing notices — the safety guidance and the no-money
        notice, at the moment they matter most. Outside every boundary, so a
        refused or failed read still leaves them on screen.
      */}
      <StandingNotices treatment="disclosure" />
    </main>
  );
}
