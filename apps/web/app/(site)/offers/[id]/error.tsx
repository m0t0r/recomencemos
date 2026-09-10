"use client";

/**
 * The **One Offer** row's `error` cell: what failed, that retrying helps, and
 * that **her answer has not changed** — a failed read is not a lost decision,
 * and on this page it is the first thing somebody who just pressed a button
 * needs to know.
 */

import { Button } from "@repo/design-system/components/button";
import type { BoundaryError } from "@/lib/report-client-error";
import { useErrorBoundary } from "@/lib/use-error-boundary";
import {
  OFFERS_FAILED_RETRY,
  OFFERS_FAILED_RETRYING,
  RECEIVED_OFFER_FAILED_TITLE,
  RECEIVED_OFFERS_FAILED_EXPLANATION,
} from "../_lib/messages";

export default function ReceivedOfferError({
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
        {RECEIVED_OFFER_FAILED_TITLE}
      </h1>
      <p className="text-muted-foreground text-pretty">{RECEIVED_OFFERS_FAILED_EXPLANATION}</p>
      <Button onClick={onRetry}>{isRetrying ? OFFERS_FAILED_RETRYING : OFFERS_FAILED_RETRY}</Button>
    </section>
  );
}
