"use client";

/**
 * The surface table's `error` cell for `/offers`: what failed, that retrying
 * helps, and — the sentence this boundary exists to carry — **what a failed read
 * is not**, said for the side being read.
 *
 * - **Received:** a failed read is not a lost answer. She may have answered one
 *   a minute ago.
 * - **Sent:** a failed read is not a failed send. He may be here five seconds
 *   after sending.
 * - **No folder in the address** — _Todas_, or an Account on one side reached
 *   from the menu or an email: a sentence that claims neither, since either
 *   could be about something this person never did.
 *
 * The folder is read from the address rather than from the read that just
 * failed, which is the one thing this boundary cannot ask.
 *
 * It is also `/offers/[id]`'s boundary: that route is the same page with an
 * Offer open, reading the same lists, so a failure there is this failure.
 *
 * A `section` rather than a `main`: the site layout owns the landmark and this
 * replaces the segment inside it. `useErrorBoundary` is the focus and reporting
 * protocol every route-level boundary here shares.
 */

import { Button } from "@repo/design-system/components/button";
import { useSearchParams } from "next/navigation";
import type { BoundaryError } from "@/lib/report-client-error";
import { useErrorBoundary } from "@/lib/use-error-boundary";
import {
  OFFERS_FAILED_EXPLANATION,
  OFFERS_FAILED_RETRY,
  OFFERS_FAILED_RETRYING,
  OFFERS_FAILED_TITLE,
  RECEIVED_OFFERS_FAILED_EXPLANATION,
} from "./_lib/messages";
import { SENT_OFFERS_FAILED_EXPLANATION } from "./_lib/sent-messages";

function explanationFor(box: string | null): string {
  if (box === "received") return RECEIVED_OFFERS_FAILED_EXPLANATION;
  if (box === "sent") return SENT_OFFERS_FAILED_EXPLANATION;

  return OFFERS_FAILED_EXPLANATION;
}

export default function OffersError({ error, retry }: { error: BoundaryError; retry: () => void }) {
  const { isRetrying, onRetry, headingRef, containerRef } = useErrorBoundary(error, retry);
  const box = useSearchParams().get("box");

  return (
    <section
      ref={containerRef}
      role="alert"
      aria-busy={isRetrying}
      className="text-foreground mx-auto flex w-full max-w-3xl flex-col items-start gap-4 px-4 py-10"
    >
      <h1 ref={headingRef} tabIndex={-1} className="page-heading focus:outline-none">
        {OFFERS_FAILED_TITLE}
      </h1>
      <p className="text-muted-foreground text-pretty">{explanationFor(box)}</p>
      <Button onClick={onRetry}>{isRetrying ? OFFERS_FAILED_RETRYING : OFFERS_FAILED_RETRY}</Button>
    </section>
  );
}
