"use client";

/**
 * One photo waiting on a person, and the two decisions that clear it.
 *
 * **The image is the row.** Every other source here has words to read; this one's
 * item is a picture, and the only text beside it is how long it has been
 * waiting. No name, no city, no headline — an Admin is deciding whether an image
 * may be public, and every extra field is a fact about a person the decision does
 * not need. `.impeccable/briefs/photo.md` fixes that under _Interaction and
 * layout_.
 *
 * **A plain `<img>`, not `next/image`.** The source is a signed URL that expires
 * in a minute and is different on every render, so the optimizer has nothing it
 * can cache and a `next/image` loader pointed at the transformation origin would
 * be pointed at the wrong origin entirely — this object is in the prefix
 * Cloudflare cannot read. Width and height are fixed by the container rather
 * than known, because a photo under review has not been re-encoded yet and its
 * dimensions are whatever her phone produced.
 *
 * **Focus returns to the row, not to the top of the page.** The queue is worked
 * top to bottom by one person, and a page that scrolled home after every decision
 * would cost them their position several hundred times a day. Third instance of
 * this rule after `sessions-panel.tsx` and `skill-request-row.tsx` — which is
 * where a hook stops being a guess, and is noted for whoever adds the fourth.
 */

import { Button } from "@repo/design-system/components/button";
import { FieldDescription, FieldLegend, FieldSet } from "@repo/design-system/components/field";
import { useActionState, useEffect, useRef } from "react";
import { approvePhoto, rejectPhoto } from "../actions";
import {
  PHOTO_APPROVE,
  PHOTO_APPROVED,
  PHOTO_APPROVING,
  PHOTO_DECISION_FAILED,
  PHOTO_REJECT,
  PHOTO_REJECT_WARNING,
  PHOTO_REJECTED,
  PHOTO_REJECTING,
  PHOTO_REVIEW_ALT,
  PHOTO_REVIEW_HEADING,
} from "../_lib/messages";
import type { QueueItem } from "../_lib/queue-sources";

type ApproveResult = Awaited<ReturnType<typeof approvePhoto>>;
type RejectResult = Awaited<ReturnType<typeof rejectPhoto>>;

const INITIAL_APPROVE: ApproveResult = {};
const INITIAL_REJECT: RejectResult = {};

export function PhotoRow({ item }: { readonly item: QueueItem }) {
  /**
   * **Two `useActionState`s rather than one form with two submit buttons**, and
   * the reason is NFR4 rather than preference: a `formAction` on a button is how
   * one form carries two verbs, and it is also the shape whose unhydrated
   * behaviour differs between browsers. Two forms, each with one action, works
   * identically with and without JavaScript — and this surface is behind a login
   * an Admin reaches with JavaScript, so the cost of the simpler shape is zero.
   *
   * **The profile id is bound, not mirrored into a hidden input** (ADR-0015):
   * React encodes it into the action reference and the action validates it on
   * arrival, so the row's markup carries no copy of it.
   */
  const [approved, approveAction, approving] = useActionState(
    approvePhoto.bind(null, item.id),
    INITIAL_APPROVE,
  );
  const [rejected, rejectAction, rejecting] = useActionState(
    rejectPhoto.bind(null, item.id),
    INITIAL_REJECT,
  );
  const announcementRef = useRef<HTMLParagraphElement>(null);

  // Read from the result objects rather than a derived boolean, so a second
  // outcome moves focus too — each dispatch produces a fresh object.
  useEffect(() => {
    const settled =
      approved.data ??
      approved.serverError ??
      rejected.data ??
      rejected.serverError ??
      approved.validationErrors ??
      rejected.validationErrors;

    if (settled) announcementRef.current?.focus();
  }, [approved, rejected]);

  /**
   * **A validation failure is announced too, and that clause is not
   * defensive.** These actions take no typed payload, so a `validationErrors`
   * result means the boundary parse refused something the browser composed —
   * which is a bug rather than a person's mistake. Reading only `serverError`
   * made exactly that invisible: an approve button that did nothing, logged
   * nothing and said nothing, found by pressing it against the running server.
   */
  const announcement =
    (approved.data ? PHOTO_APPROVED : undefined) ??
    (rejected.data ? PHOTO_REJECTED : undefined) ??
    approved.serverError?.message ??
    rejected.serverError?.message ??
    ((approved.validationErrors ?? rejected.validationErrors) ? PHOTO_DECISION_FAILED : undefined);

  const pending = approving || rejecting;

  return (
    <FieldSet className="flex min-w-0 flex-col gap-3">
      <FieldLegend>{PHOTO_REVIEW_HEADING}</FieldLegend>

      {/*
        A fixed square the photo is cropped into, so a row's height does not
        depend on whether she held the phone upright. The queue is scanned
        vertically and a ragged rhythm is what makes that scan slow.
      */}
      {item.imageUrl ? (
        // The rule is right about the general case and wrong about this one, and
        // the reasons are in the class comment above: the source is a signed URL
        // that expires in a minute and differs on every render, so the optimizer
        // has nothing to cache; and the loader `next/image` would use points at
        // the transformation origin, which cannot read the quarantine prefix at
        // all. LCP is not at stake either — this is one authenticated operator's
        // queue, not a Worker's phone on mobile data.
        // oxlint-disable-next-line next/no-img-element
        <img
          src={item.imageUrl}
          alt={PHOTO_REVIEW_ALT}
          className="bg-muted size-48 rounded-md object-cover"
        />
      ) : null}

      <FieldDescription>{item.summary}</FieldDescription>

      {/*
        **Said before it is pressed, not after.** Rejecting deletes the object
        and there is no undo — the voice guide puts `no se puede deshacer` on its
        Say list for exactly this, and a confirmation dialog would be a second
        thing to click several hundred times a day rather than a second thought.
      */}
      <FieldDescription>{PHOTO_REJECT_WARNING}</FieldDescription>

      <div className="flex flex-wrap gap-2">
        <form action={approveAction}>
          <Button type="submit" disabled={pending}>
            {approving ? PHOTO_APPROVING : PHOTO_APPROVE}
          </Button>
        </form>

        <form action={rejectAction}>
          <Button type="submit" variant="outline" disabled={pending}>
            {rejecting ? PHOTO_REJECTING : PHOTO_REJECT}
          </Button>
        </form>
      </div>

      {/*
        `tabIndex={-1}` so focus can be moved here programmatically without
        putting the paragraph in the tab order — the same shape the other two
        rows use. `role="status"` announces the outcome to a screen reader
        without stealing focus from anyone who did not press anything.
      */}
      <p
        ref={announcementRef}
        tabIndex={-1}
        // See `sessions-panel.tsx`: `<output>`'s content model is phrasing
        // content, and the rule's suggestion is right in general and wrong here.
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="status"
        className="text-foreground text-sm leading-5"
      >
        {announcement}
      </p>
    </FieldSet>
  );
}
