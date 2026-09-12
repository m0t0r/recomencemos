/**
 * One ruled row of the ledger: shut, it is who signed, how long ago, the first
 * lines of the work, where it stands and the pay; open, it is the whole Offer
 * and — while it waits on her — her answer, at its foot.
 *
 * **A native `<details>`, not the registry's accordion, and the reason is the
 * one the standing notices gave.** It opens with the script tag removed and
 * before hydration, and the server sets `open` on the row a link names — which
 * is how the delivery email's `/offers/<id>` lands on that Offer open. An
 * accordion needs JavaScript to open at all. `RowSummary` is a client component
 * only to take focus on a deep link; opening and shutting are the browser's.
 *
 * **The summary carries one heading and phrasing content only**, which is
 * `summary`'s content model: the `h2` keeps every row in the document outline,
 * so a screen-reader user listing headings finds one per Offer.
 *
 * **Inside an open row the terms and who claims to have written them come
 * before the answer**: what she agrees to is what she can see above the button.
 * Reporting joins _Aceptar_ and _No aceptar_ in the answer with story 10.
 *
 * **The ruling is the registry's `Separator`, inside the `<li>`** — the shape
 * `profile-list/profile-row.tsx` uses, since a `<ul>` may not hold a divider
 * as a direct child.
 */

import { Separator } from "@repo/design-system/components/separator";
import type { ReceivedOffer } from "@repo/domain/offers";
import { ChevronDownIcon } from "lucide-react";
import type { OpenRow } from "../_lib/ledger";
import {
  OFFER_PAY_LABEL,
  OFFER_WHEN_LABEL,
  OFFER_WORK_LABEL,
  offerSentOn,
  RECEIVED_STATE_SENTENCES,
  rowSignature,
  SENDER_ABSENCE,
  SENDER_LABEL,
  SENDER_NAMED_NOTE,
  SENDER_UNNAMED,
  sentAgo,
} from "../_lib/messages";
import { asReceivedState } from "../_lib/received-state";
import { AnswerControls } from "./answer-controls";
import { ArrivalStatus } from "./arrival-status";
import { OfferStateBadge, OfferTerm } from "./offer-parts";
import { RowSummary } from "./row-summary";

export interface LedgerRowProps {
  readonly offer: ReceivedOffer;
  readonly now: Date;
  /** Every row but the first is ruled off from the one above it. */
  readonly separated: boolean;
  /** Present when a link named this row: it renders open, with any answer's result. */
  readonly opened?: OpenRow | undefined;
}

/**
 * Who claims to be asking. **The absence leads, whether or not there is a
 * name** — she reads that nobody here is verified before she reads who says
 * they wrote this, beside the decision the claim bears on.
 */
function Sender({ offerId, hirerName }: { offerId: string; hirerName: string | null }) {
  const headingId = `offer-sender-${offerId}`;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-1">
      <h3 id={headingId} className="text-muted-foreground text-sm">
        {SENDER_LABEL}
      </h3>
      <p className="text-muted-foreground text-sm">{SENDER_ABSENCE}</p>
      <p className="text-foreground font-medium">{hirerName ?? SENDER_UNNAMED}</p>
      {hirerName === null ? null : (
        <p className="text-muted-foreground text-sm">{SENDER_NAMED_NOTE}</p>
      )}
    </section>
  );
}

export function LedgerRow({ offer, now, separated, opened }: LedgerRowProps) {
  // The read only returns received states; this narrows the type and refuses
  // to render anything the read should not have handed over.
  const state = asReceivedState(offer.state);
  if (!state) return null;

  const arrival = opened?.arrival;

  return (
    <li>
      {separated ? <Separator /> : null}
      <details open={opened !== undefined} className="group">
        {/*
          A deep link with no answer to announce focuses the open row's summary,
          which also scrolls it into view. After an answer the result takes focus
          instead, so exactly one thing is asked to.
        */}
        <RowSummary focusOnMount={opened !== undefined && arrival === undefined}>
          <h2 className="font-heading text-foreground min-w-0 text-xl leading-7 font-medium text-pretty">
            {rowSignature(offer.hirerName)}
          </h2>
          <time
            dateTime={offer.sentAt.toISOString()}
            className="text-muted-foreground pt-1 text-sm whitespace-nowrap"
          >
            {sentAgo(offer.sentAt, now)}
          </time>
          {/* Shut, the first lines of the work; open, the work is in full below. */}
          <span className="text-foreground col-span-2 line-clamp-2 whitespace-pre-line group-open:hidden">
            {offer.workDescription}
          </span>
          <span className="col-span-2 flex min-w-0 items-center gap-2 pt-1">
            <OfferStateBadge state={state} />
            <span className="text-muted-foreground min-w-0 truncate text-sm group-open:hidden">
              {offer.payTerms}
            </span>
            <ChevronDownIcon
              aria-hidden="true"
              className="text-muted-foreground ml-auto size-4 shrink-0 transition-transform group-open:rotate-180"
            />
          </span>
        </RowSummary>

        <div className="flex flex-col gap-5 pb-6">
          {/*
            The result of her answer, in the row it answered, focused so it is
            heard. The state line after it is what stays on every later visit,
            which is what "stays confirmed rather than vanishing" asks for.
          */}
          {arrival ? <ArrivalStatus>{arrival}</ArrivalStatus> : null}

          <p className="text-foreground text-sm">{RECEIVED_STATE_SENTENCES[state]}</p>

          <dl className="flex flex-col gap-4">
            <OfferTerm label={OFFER_WORK_LABEL} value={offer.workDescription} />
            <OfferTerm label={OFFER_PAY_LABEL} value={offer.payTerms} />
            <OfferTerm label={OFFER_WHEN_LABEL} value={offer.whenText} />
          </dl>

          {/* `es-CO` long form; `dateTime` carries the machine-readable value. */}
          <time dateTime={offer.sentAt.toISOString()} className="text-muted-foreground text-xs">
            {offerSentOn(offer.sentAt)}
          </time>

          <Sender offerId={offer.id} hirerName={offer.hirerName} />

          {/* Only while there is an answer to give; an answered row has its state above. */}
          {state === "delivered" ? (
            <AnswerControls offerId={offer.id} hirerName={offer.hirerName} />
          ) : null}
        </div>
      </details>
    </li>
  );
}
