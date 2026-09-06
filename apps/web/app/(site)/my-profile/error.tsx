"use client";

/**
 * The surface table's `error` cell for this page: what failed, and that a
 * reload helps. The profile is untouched by a failed read, and the sentence
 * says so — the one fact that matters to someone who just published.
 *
 * A `section` rather than a `main`: the site layout above owns the landmark,
 * and this replaces the segment inside it.
 */

import { Button } from "@repo/design-system/components/button";
import type { BoundaryError } from "@/lib/report-client-error";
import { useErrorBoundary } from "@/lib/use-error-boundary";
import {
  LOAD_FAILED_EXPLANATION,
  LOAD_FAILED_RETRY,
  LOAD_FAILED_RETRYING,
  LOAD_FAILED_TITLE,
} from "./_lib/messages";

export default function MyProfileError({
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
      className="text-foreground mx-auto flex w-full max-w-2xl flex-col items-start gap-4 px-4 py-10"
    >
      {/*
        `page-heading`, the same step `my-profile/page.tsx` renders, because this
        replaces that page rather than sitting beside it — a failed read should
        not change the size or the face of the heading a person was reading a
        second ago. `focus:outline-none` because the heading takes focus on mount
        and is not in the tab order.
      */}
      <h1 ref={headingRef} tabIndex={-1} className="page-heading focus:outline-none">
        {LOAD_FAILED_TITLE}
      </h1>
      <p className="text-muted-foreground text-pretty">{LOAD_FAILED_EXPLANATION}</p>
      <Button onClick={onRetry}>{isRetrying ? LOAD_FAILED_RETRYING : LOAD_FAILED_RETRY}</Button>
    </section>
  );
}
