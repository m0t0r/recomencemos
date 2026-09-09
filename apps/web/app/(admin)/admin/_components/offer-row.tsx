"use client";

/**
 * One Offer waiting to be read, and the one action that lets it through.
 *
 * **It is a queue item with its resolver attached**, which is `skill-request-row`'s
 * argument one section over and the reason story 6 carries this at all: an Offer
 * nobody can deliver is an Offer that only accumulates, and NFR7's age-of-oldest
 * then measures how long the feature has been half-built rather than how long a
 * person has been waiting.
 *
 * **This is the plain version of a row, on purpose.** The shaped section — the
 * fixed row rhythm, the same affordances in the same position every time, and
 * `rejectOffer`, which is the other half — belongs to the Admin queue's own
 * ticket. What is here is what has to be true whatever that section looks like:
 * the body in full so nothing is delivered unread, both people named the way
 * NFR11 permits, one action, and an answer that is announced.
 *
 * **Focus returns to the row, not to the top of the page.** The queue is worked
 * top to bottom by one person, and a page that scrolled home after every
 * delivery would cost that person their position all day. Third instance of the
 * rule `sessions-panel.tsx` set, and the point at which a shared hook stops
 * being a guess — named here rather than extracted, because the extraction
 * belongs with the section that will hold five of these.
 */

import { Button } from "@repo/design-system/components/button";
import { useActionState, useEffect, useRef } from "react";
import {
  DELIVER_OFFER_SUBMIT,
  DELIVER_OFFER_SUBMITTING,
  offerDelivered,
  offerSentOn,
} from "../_lib/messages";
import type { QueueItem } from "../_lib/queue-sources";
import { deliverOffer } from "../actions";

type Result = Awaited<ReturnType<typeof deliverOffer>>;

const INITIAL: Result = {};

export function OfferRow({ item }: { readonly item: QueueItem }) {
  /**
   * **The Offer's id is bound rather than mirrored into a hidden input**
   * (ADR-0015): React encodes it into the action reference, the action validates
   * it on arrival, and this row's markup carries no copy of it.
   */
  const [result, formAction, pending] = useActionState(deliverOffer.bind(null, item.id), INITIAL);
  const announcementRef = useRef<HTMLParagraphElement>(null);

  // Read from `result` rather than a derived boolean, so a second outcome moves
  // focus too — `result` is a fresh object per dispatch.
  useEffect(() => {
    if (result.data ?? result.serverError ?? result.validationErrors) {
      announcementRef.current?.focus();
    }
  }, [result]);

  const announcement = result.data
    ? offerDelivered(result.data.workerFirstName)
    : result.serverError?.message;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-foreground text-sm leading-5">{item.summary}</p>

      {/*
        **The body in full, field by field.** The section's rule is that a branch
        renders so nothing is acted on unread, and on this source that is the
        whole control: NFR12's rejector is a speed bump and *this person* is what
        stands between a stranger's message and a Worker's phone.
      */}
      <dl className="flex flex-col gap-2 text-sm leading-5">
        {(item.fields ?? []).map((field) => (
          <div key={field.label}>
            <dt className="text-muted-foreground">{field.label}</dt>
            <dd className="whitespace-pre-line">{field.value}</dd>
          </div>
        ))}
      </dl>

      <p className="text-muted-foreground text-xs">{offerSentOn(item.arrivedAt)}</p>

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
        **No bulk action, here or anywhere on this queue.** Delivering many in one
        click is the mechanism by which something reaches a person unread, and it
        is the one affordance this section may never grow.
      */}
      {result.data ? null : (
        <form action={formAction}>
          <Button type="submit" disabled={pending} className="self-start">
            {pending ? DELIVER_OFFER_SUBMITTING : DELIVER_OFFER_SUBMIT}
          </Button>
        </form>
      )}
    </div>
  );
}
