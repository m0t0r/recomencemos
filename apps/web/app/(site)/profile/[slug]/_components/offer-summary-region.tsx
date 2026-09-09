"use client";

/**
 * Where focus lands on a failed submit: the count, then the list, each item a
 * link to its field.
 *
 * A screen-reader user hears *how many* things are wrong before being dropped
 * into one (spec, Keyboard and announcement), and a sighted one on a phone gets
 * a table of contents for a form that is now taller than the screen.
 *
 * `role="alert"` rather than `status`, because a failed submit is the one moment
 * on this form that should interrupt. The ceiling and the transport fault render
 * in the same region: they are the outcome too, and one place to look is the
 * whole point.
 *
 * **This is `FormSummary` without the work-history branch**, which is the only
 * thing that made that component profile-shaped. Sharing it would have meant
 * either a field-label map keyed by two different unions or an index parameter
 * no Offer field has.
 */

import { Alert, AlertDescription, AlertTitle } from "@repo/design-system/components/alert";
import type { RefObject } from "react";
import type { Feedback } from "@/app/_lib/form/use-action-form";
import {
  OFFER_FIELD_LABELS,
  OFFER_SUMMARY_KEPT,
  OFFER_SUMMARY_LABEL,
} from "../_lib/offer-messages";
import type { OfferSummary } from "../_lib/offer-summary";

export interface OfferSummaryRegionProps {
  readonly summary: OfferSummary | undefined;
  readonly feedback: Feedback | undefined;
  readonly summaryRef: RefObject<HTMLDivElement | null>;
  /** The id of the control a summary item links to. */
  readonly idFor: (field: keyof typeof OFFER_FIELD_LABELS) => string;
}

export function OfferSummaryRegion({
  summary,
  feedback,
  summaryRef,
  idFor,
}: OfferSummaryRegionProps) {
  return (
    <div
      ref={summaryRef}
      tabIndex={-1}
      // `prefer-tag-over-role` asks for `<output>`, whose content model is
      // phrasing content; this region holds lists and headings.
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="alert"
      aria-label={OFFER_SUMMARY_LABEL}
      className="focus-visible:ring-ring/50 rounded-md outline-none empty:hidden focus-visible:ring-[3px]"
    >
      {feedback ? (
        <Alert variant="destructive">
          <AlertTitle>{feedback.message}</AlertTitle>
          {/*
            The ceiling's sentence already says when the window resets; this
            carries the same fact as a number a machine can read (C39).
          */}
          {feedback.retryAfter === undefined ? null : (
            <time
              dateTime={`PT${feedback.retryAfter}S`}
              data-retry-after={feedback.retryAfter}
              className="sr-only"
            />
          )}
        </Alert>
      ) : null}

      {summary ? (
        <Alert variant="destructive">
          <AlertTitle>{summary.heading}</AlertTitle>
          <AlertDescription>
            <p>{OFFER_SUMMARY_KEPT}</p>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-4">
              {summary.items.map((item) => (
                <li key={item.field}>
                  <a href={`#${idFor(item.field)}`} className="underline underline-offset-4">
                    {OFFER_FIELD_LABELS[item.field]}
                  </a>
                  <span>: {item.message}</span>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
