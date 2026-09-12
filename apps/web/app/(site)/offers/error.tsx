"use client";

/**
 * The surface table's `error` cell for `/offers`: what failed, that retrying
 * helps, and — the sentence this boundary exists to carry — that **a failed read
 * is not a lost answer**. She may have answered one a minute ago.
 *
 * It is also `/offers/[id]`'s boundary: that route is the same ledger with a
 * row open, reading the same list, so a failure there is this failure.
 *
 * A `section` rather than a `main`: the site layout owns the landmark and this
 * replaces the segment inside it. `useErrorBoundary` is the focus and reporting
 * protocol every route-level boundary here shares.
 */

import { Button } from "@repo/design-system/components/button";
import type { BoundaryError } from "@/lib/report-client-error";
import { useErrorBoundary } from "@/lib/use-error-boundary";
import {
  OFFERS_FAILED_RETRY,
  OFFERS_FAILED_RETRYING,
  RECEIVED_OFFERS_FAILED_EXPLANATION,
  RECEIVED_OFFERS_FAILED_TITLE,
} from "./_lib/messages";

export default function ReceivedOffersError({
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
      <h1 ref={headingRef} tabIndex={-1} className="page-heading focus:outline-none">
        {RECEIVED_OFFERS_FAILED_TITLE}
      </h1>
      <p className="text-muted-foreground text-pretty">{RECEIVED_OFFERS_FAILED_EXPLANATION}</p>
      <Button onClick={onRetry}>{isRetrying ? OFFERS_FAILED_RETRYING : OFFERS_FAILED_RETRY}</Button>
    </section>
  );
}
