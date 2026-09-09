"use client";

/**
 * One Offer waiting to be read, and the two things an Admin may do about it.
 *
 * **The row is the section's whole design, because the section is one page of
 * these.** An Admin sees this shape more often than any other screen in the
 * product, so it is fixed: the same parts in the same order on every row, and the
 * two affordances last, together, in the same position every time. Nothing about
 * a row's content moves its buttons — a control whose position depends on how
 * long somebody's work description was is a control that gets pressed by mistake
 * on the twentieth row.
 *
 * **Both decisions are present on every row, and neither is bulk.** Delivering
 * many in one click is the mechanism by which something reaches a person unread,
 * and refusing many in one click is the same mistake with a worse outcome. There
 * is one row, one reading, one decision.
 *
 * **The body is rendered in full above them**, which is the rule this section
 * exists to enforce: the contact-detail rejector is a speed bump and *this
 * person* is what stands between a stranger's message and a Worker's phone. What
 * a row may carry is bounded — the body, and her display identity. Never a phone
 * number, hers or his.
 *
 * **Focus and the announcement are `use-queue-row.ts`'s**, including the part
 * that is new here: a decision that lands hands the keyboard to the next row
 * still waiting, rather than back to the row just finished with.
 */

import { Button } from "@repo/design-system/components/button";
import { useActionState, useMemo } from "react";
import {
  DELIVER_OFFER_SUBMIT,
  DELIVER_OFFER_SUBMITTING,
  offerDelivered,
  OFFER_REJECTED,
  OFFER_ROW_RESOLVED,
  offerSentOnQueue,
  REJECT_OFFER_SUBMIT,
  REJECT_OFFER_SUBMITTING,
} from "../_lib/messages";
import type { QueueItem } from "../_lib/queue-sources";
import { useQueueRow } from "../_lib/use-queue-row";
import { deliverOffer, rejectOffer } from "../actions";

type Delivery = Awaited<ReturnType<typeof deliverOffer>>;
type Refusal = Awaited<ReturnType<typeof rejectOffer>>;

const NOTHING_YET: Delivery & Refusal = {};

export function OfferRow({ item }: { readonly item: QueueItem }) {
  /**
   * **Two actions, two forms, and the Offer's id bound to each** (ADR-0015):
   * React encodes it into the action reference, each action validates it on
   * arrival, and this row's markup carries no copy of it.
   *
   * Two `<form>` elements rather than one form with two submit buttons, because
   * a button's `name`/`value` pair is a form field — and a decision nobody typed
   * is a bound argument, which is the same rule that keeps the id out of a hidden
   * input. It also keeps the two decisions two endpoints, each with its own audit
   * name, rather than one endpoint branching on a value in the body.
   */
  const [delivery, deliverAction, delivering] = useActionState(
    deliverOffer.bind(null, item.id),
    NOTHING_YET,
  );
  const [refusal, rejectAction, rejecting] = useActionState(
    rejectOffer.bind(null, item.id),
    NOTHING_YET,
  );

  /**
   * The row's outcome, whichever decision produced it.
   *
   * A fresh object per dispatch — which is what the focus effect reads for — and
   * it is a memo rather than a bare expression so that identity changes when one
   * of the two results does, and not on every render.
   */
  const outcome = useMemo(
    () => ({
      data: delivery.data ?? refusal.data,
      serverError: delivery.serverError ?? refusal.serverError,
      validationErrors: delivery.validationErrors ?? refusal.validationErrors,
    }),
    [delivery, refusal],
  );

  const { rowRef, announcementRef } = useQueueRow(outcome);

  const decided = Boolean(delivery.data ?? refusal.data);
  const working = delivering || rejecting;

  const announcement = delivery.data
    ? offerDelivered(delivery.data.workerFirstName)
    : refusal.data
      ? OFFER_REJECTED
      : outcome.serverError?.message;

  return (
    <div
      ref={rowRef}
      data-queue-row=""
      data-resolved={decided ? "true" : undefined}
      className="flex flex-col gap-3"
    >
      {/*
        **Where focus lands when the row above is decided**, which is why it is
        the line naming both people rather than a button: the next thing an Admin
        does is read, and a keyboard put straight onto *Entregar* would be a
        keyboard one press away from delivering something unread.
      */}
      <p
        tabIndex={-1}
        data-queue-anchor=""
        className="focus-visible:ring-ring/50 text-foreground rounded-md text-sm leading-5 outline-none focus-visible:ring-[3px]"
      >
        {item.summary}
      </p>

      {/*
        **The body in full, field by field.** The section's rule is that a branch
        renders so nothing is acted on unread, and on this source that is the
        whole control.
      */}
      <dl className="flex flex-col gap-2 text-sm leading-5">
        {(item.fields ?? []).map((field) => (
          <div key={field.label}>
            <dt className="text-muted-foreground">{field.label}</dt>
            <dd className="whitespace-pre-line">{field.value}</dd>
          </div>
        ))}
      </dl>

      <p className="text-muted-foreground text-xs">{offerSentOnQueue(item.arrivedAt)}</p>

      <p
        ref={announcementRef}
        tabIndex={-1}
        // See `sessions-panel.tsx`: `<output>`'s content model is phrasing
        // content, and the rule's suggestion is right in general and wrong here.
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="status"
        className="focus-visible:ring-ring/50 text-foreground rounded-md text-sm leading-5 outline-none focus-visible:ring-[3px]"
      >
        {announcement}
      </p>

      {/*
        **The affordances, last and together.** Deliver leads because it is the
        outcome most Offers get and the one the section's clock is about; refusing
        sits beside it as the quieter of the two, which is a difference in weight
        rather than in reach — both are one press, and the queue is worked at
        speed.

        A decided row keeps its place and says so. Removing it here would take the
        outcome off the screen and shift every row below it under a cursor that is
        mid-queue; leaving the buttons live would invite a second press against a
        state the server has already moved.
      */}
      {decided ? (
        <p className="text-muted-foreground text-sm leading-5">{OFFER_ROW_RESOLVED}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <form action={deliverAction}>
            <Button type="submit" disabled={working} aria-busy={delivering}>
              {delivering ? DELIVER_OFFER_SUBMITTING : DELIVER_OFFER_SUBMIT}
            </Button>
          </form>

          <form action={rejectAction}>
            <Button type="submit" variant="outline" disabled={working} aria-busy={rejecting}>
              {rejecting ? REJECT_OFFER_SUBMITTING : REJECT_OFFER_SUBMIT}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
