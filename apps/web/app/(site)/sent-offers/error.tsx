"use client";

/**
 * The surface table's `error` cell for this page: what failed, that retrying
 * helps, and — the sentence this boundary exists to carry — that **a failed read
 * is not a failed send**.
 *
 * He may be here five seconds after sending. A page that only said "we could not
 * load this" would leave him wondering whether the Offer he just wrote exists,
 * which is the one question this surface is for.
 *
 * A `section` rather than a `main`: the site layout above owns the landmark, and
 * this replaces the segment inside it. `useErrorBoundary` is the same focus and
 * reporting protocol `/my-profile` and the two route-level boundaries use — one
 * protocol, not four.
 */

import { Button } from "@repo/design-system/components/button";
import type { BoundaryError } from "@/lib/report-client-error";
import { useErrorBoundary } from "@/lib/use-error-boundary";
import {
  SENT_OFFERS_FAILED_EXPLANATION,
  SENT_OFFERS_FAILED_RETRY,
  SENT_OFFERS_FAILED_RETRYING,
  SENT_OFFERS_FAILED_TITLE,
} from "./_lib/messages";

export default function SentOffersError({
  error,
  retry,
}: {
  error: BoundaryError;
  retry: () => void;
}) {
  const { isRetrying, onRetry, headingRef, containerRef } = useErrorBoundary(error, retry);

  return (
    <section
      ref={containerRef}
      role="alert"
      aria-busy={isRetrying}
      className="text-foreground mx-auto flex w-full max-w-3xl flex-col items-start gap-4 px-4 py-10"
    >
      {/*
        `page-heading`, the same step the page itself renders, because this
        replaces that page rather than sitting beside it — a failed read should
        not change the size or the face of the heading he was reading a second
        ago. `focus:outline-none` because the heading takes focus on mount and is
        not in the tab order.
      */}
      <h1 ref={headingRef} tabIndex={-1} className="page-heading focus:outline-none">
        {SENT_OFFERS_FAILED_TITLE}
      </h1>
      <p className="text-muted-foreground text-pretty">{SENT_OFFERS_FAILED_EXPLANATION}</p>
      <Button onClick={onRetry}>
        {isRetrying ? SENT_OFFERS_FAILED_RETRYING : SENT_OFFERS_FAILED_RETRY}
      </Button>
    </section>
  );
}
