"use client";

/**
 * Where focus lands on a failed submit: the count, then the list, each item a
 * link to its field. A screen-reader user hears *how many* things are wrong
 * before being dropped into one (spec, Keyboard and announcement), and a
 * sighted one on a phone gets a table of contents for a form that is now
 * taller than the screen.
 *
 * `role="alert"` rather than `status`, because a failed submit is the one
 * moment on this form that should interrupt. The ceiling and the transport
 * fault render in the same region: they are the outcome too, and one place to
 * look is the whole point.
 */

import { Alert, AlertDescription, AlertTitle } from "@repo/design-system/components/alert";
import * as React from "react";
import { FIELD_LABELS, SUMMARY_KEPT, workHistoryLineLabel } from "@/app/_lib/profile-form/messages";
import type { Summary } from "@/app/_lib/profile-form/summary";
import type { Feedback } from "@/app/_lib/profile-form/use-profile-form";

export interface FormSummaryProps {
  readonly summary: Summary | undefined;
  readonly feedback: Feedback | undefined;
  readonly summaryRef: React.RefObject<HTMLDivElement | null>;
  /** The id of the control a summary item links to. */
  readonly idFor: (field: keyof typeof FIELD_LABELS, index?: number) => string;
  /** Accessible name for the region. */
  readonly label: string;
}

export function FormSummary({ summary, feedback, summaryRef, idFor, label }: FormSummaryProps) {
  return (
    <div
      ref={summaryRef}
      tabIndex={-1}
      // `prefer-tag-over-role` asks for `<output>`, whose content model is
      // phrasing content; this region holds lists and headings.
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="alert"
      aria-label={label}
      className="focus-visible:ring-ring/50 rounded-md outline-none focus-visible:ring-[3px]"
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
            <p>{SUMMARY_KEPT}</p>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-4">
              {summary.items.map((item) => (
                <li key={`${item.field}:${item.index ?? ""}`}>
                  <a
                    href={`#${idFor(item.field, item.index)}`}
                    className="underline underline-offset-4"
                  >
                    {item.index === undefined
                      ? FIELD_LABELS[item.field]
                      : `${FIELD_LABELS[item.field]}, ${workHistoryLineLabel(item.index + 1).toLowerCase()}`}
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
