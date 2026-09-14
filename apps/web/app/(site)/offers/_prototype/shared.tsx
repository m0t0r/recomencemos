/**
 * PROTOTYPE — the pieces every mailbox variant shares: one item type for both
 * directions, the words that say which direction, the state label, and the
 * body of an opened Offer on either side. Real data, real copy where the
 * product already has it; the answer controls are a stub that posts nothing.
 */

import { Badge } from "@repo/design-system/components/badge";
import { Button } from "@repo/design-system/components/button";
import type { ContactExchange } from "@repo/domain/exchange";
import type { ReceivedOffer, SentOffer } from "@repo/domain/offers";
import Link from "next/link";
import {
  ContactExchangePanel,
  FoldedTerms,
} from "@/app/(site)/_components/contact-exchange/contact-exchange";
import { OFFER_STATE_SENTENCES, OFFER_REVIEW_DELAYED } from "../../sent-offers/_lib/messages";
import { offerBadge } from "../../sent-offers/_lib/state-badge";
import { OfferStateBadge, OfferTerm } from "../_components/offer-parts";
import {
  ACCEPT,
  DECLINE,
  OFFER_PAY_LABEL,
  OFFER_WHEN_LABEL,
  OFFER_WORK_LABEL,
  offerSentOn,
  RECEIVED_STATE_SENTENCES,
  SENDER_ABSENCE,
  SENDER_LABEL,
  SENDER_NAMED_NOTE,
  SENDER_UNNAMED,
} from "../_lib/messages";
import { asReceivedState } from "../_lib/received-state";
import type { Mailbox } from "./mailbox-data";

export type Item =
  | {
      readonly direction: "in";
      readonly offer: ReceivedOffer;
      readonly exchange?: ContactExchange | undefined;
    }
  | {
      readonly direction: "out";
      readonly offer: SentOffer;
      readonly exchange?: ContactExchange | undefined;
    };

/** Both directions, newest first. Date order is the only order: the platform ranks nothing. */
export function allItems(mailbox: Mailbox): Item[] {
  const incoming: Item[] = mailbox.received.map((offer) => ({
    direction: "in",
    offer,
    exchange: mailbox.workerExchanges.get(offer.id),
  }));
  const outgoing: Item[] = mailbox.sent.map((offer) => ({
    direction: "out",
    offer,
    exchange: mailbox.hirerExchanges.get(offer.id),
  }));

  return [...incoming, ...outgoing].toSorted(
    (a, b) => b.offer.sentAt.getTime() - a.offer.sentAt.getTime(),
  );
}

/** The other person on the Offer: who signed it, or who it went to. */
export function counterpart(item: Item): string {
  if (item.direction === "out") {
    return `${item.offer.worker.firstName} ${item.offer.worker.lastInitial}.`;
  }
  return item.offer.hirerName ?? "Alguien sin nombre";
}

/** Waiting on her: a received Offer she has not answered. */
export function waitsOnHer(item: Item): boolean {
  return item.direction === "in" && item.offer.state === "delivered";
}

/** Waiting on the other side: something she sent that is still open. */
export function waitsOnThem(item: Item): boolean {
  return (
    item.direction === "out" &&
    (item.offer.state === "pending_review" ||
      item.offer.state === "on_hold" ||
      item.offer.state === "delivered")
  );
}

export function StateTag({ item }: { readonly item: Item }) {
  if (item.direction === "in") {
    const state = asReceivedState(item.offer.state);
    return state ? <OfferStateBadge state={state} className="shrink-0" /> : null;
  }

  const badge = offerBadge(item.offer.state, item.offer.reviewDelayed);
  return (
    <Badge variant={badge.variant} className="shrink-0">
      {badge.label}
    </Badge>
  );
}

function Terms({ offer }: { readonly offer: ReceivedOffer | SentOffer }) {
  return (
    <dl className="flex flex-col gap-4">
      <OfferTerm label={OFFER_WORK_LABEL} value={offer.workDescription} />
      <OfferTerm label={OFFER_PAY_LABEL} value={offer.payTerms} />
      <OfferTerm label={OFFER_WHEN_LABEL} value={offer.whenText} />
    </dl>
  );
}

/** Stub: equal weight, posts nothing. The real controls are `AnswerControls`. */
function StubAnswer() {
  return (
    <section className="flex flex-col gap-3 pt-1">
      <h3 className="text-foreground text-sm font-medium">Tu respuesta</h3>
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline">
          {ACCEPT}
        </Button>
        <Button type="button" variant="outline">
          {DECLINE}
        </Button>
      </div>
      <p className="text-muted-foreground font-mono text-xs">
        prototipo: estos botones no envían nada
      </p>
    </section>
  );
}

/** An opened Offer she received: state, terms, who claims to have sent it, the answer. */
export function ReceivedBody({
  offer,
  exchange,
}: {
  readonly offer: ReceivedOffer;
  readonly exchange?: ContactExchange | undefined;
}) {
  const state = asReceivedState(offer.state);
  if (!state) return null;

  const rest = (
    <>
      <Terms offer={offer} />
      <time dateTime={offer.sentAt.toISOString()} className="text-muted-foreground text-xs">
        {offerSentOn(offer.sentAt)}
      </time>
      <section className="flex flex-col gap-1">
        <h3 className="text-muted-foreground text-sm">{SENDER_LABEL}</h3>
        <p className="text-muted-foreground text-sm">{SENDER_ABSENCE}</p>
        <p className="text-foreground font-medium">{offer.hirerName ?? SENDER_UNNAMED}</p>
        {offer.hirerName === null ? null : (
          <p className="text-muted-foreground text-sm">{SENDER_NAMED_NOTE}</p>
        )}
      </section>
    </>
  );

  return (
    <div className="flex flex-col gap-5">
      <p className="text-foreground text-sm">{RECEIVED_STATE_SENTENCES[state]}</p>
      {exchange ? (
        <>
          <ContactExchangePanel exchange={exchange} />
          <FoldedTerms side={exchange.side}>{rest}</FoldedTerms>
        </>
      ) : (
        rest
      )}
      {state === "delivered" ? <StubAnswer /> : null}
    </div>
  );
}

/** An opened Offer she sent: where it is, the window, what she wrote, her contact once accepted. */
export function SentBody({
  offer,
  exchange,
}: {
  readonly offer: SentOffer;
  readonly exchange?: ContactExchange | undefined;
}) {
  const terms = (
    <>
      <Terms offer={offer} />
      <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
        <time dateTime={offer.sentAt.toISOString()}>{offerSentOn(offer.sentAt)}</time>
        <Link href={`/profile/${offer.worker.slug}`} className="underline underline-offset-4">
          Ver el perfil de {offer.worker.firstName}
        </Link>
      </div>
    </>
  );

  return (
    <div className="flex flex-col gap-5">
      <p className="text-foreground text-sm">
        {offer.reviewDelayed ? OFFER_REVIEW_DELAYED : OFFER_STATE_SENTENCES[offer.state]}
      </p>
      {exchange ? (
        <>
          <ContactExchangePanel exchange={exchange} />
          <FoldedTerms side={exchange.side}>{terms}</FoldedTerms>
        </>
      ) : (
        terms
      )}
    </div>
  );
}

export function ItemBody({ item }: { readonly item: Item }) {
  return item.direction === "in" ? (
    <ReceivedBody offer={item.offer} exchange={item.exchange} />
  ) : (
    <SentBody offer={item.offer} exchange={item.exchange} />
  );
}

/** Nothing either way yet: what makes one arrive, and how to send one. */
export function EmptyMailbox({ hasProfile }: { readonly hasProfile: boolean }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <h2 className="text-lg font-medium">Todavía no hay propuestas</h2>
      <p className="text-muted-foreground">
        {hasProfile
          ? "Aquí verás las que te lleguen y las que envíes. Una persona lee cada una antes de que llegue."
          : "Aquí verás las propuestas que envíes, y las que te lleguen cuando publiques tu perfil."}
      </p>
      <Link href="/profiles" className="underline underline-offset-4">
        Ver todos los perfiles
      </Link>
    </div>
  );
}
