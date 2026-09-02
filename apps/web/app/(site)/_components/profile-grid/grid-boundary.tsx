"use client";

/**
 * The grid's error state, scoped to the grid.
 *
 * **Why this is not `error.tsx`.** A route-level boundary replaces the whole
 * segment, and on these two pages the segment includes the two standing notices
 * — nobody is verified, and the platform holds no money. The spec's `error` cell
 * for the Wall says those notices still render, so the boundary has to sit
 * *inside* the page, between the framing and the grid. A page that dropped both
 * notices the moment a query failed would be at its least honest exactly when
 * something was already wrong.
 *
 * The notices themselves are story 11's and are not here yet; this is the
 * structure that has somewhere to put them.
 *
 * **What it catches.** The grid is a streamed Suspense boundary, so a failure in
 * the server component inside it is re-thrown on the client and caught by the
 * nearest boundary above — this one. Recovery is `router.refresh()`, which
 * re-fetches the tree the server failed to produce; the caught error is cleared
 * in the same transition, so the children re-render against the new payload
 * rather than immediately against the old failed one.
 *
 * Reporting, focus and the busy state come from `useErrorBoundary`, the same
 * module the two route-level boundaries use — one focus protocol, not three.
 */

import { Button, buttonVariants } from "@repo/design-system/components/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Component, type ReactNode } from "react";
import type { BoundaryError } from "@/lib/report-client-error";
import { useErrorBoundary } from "@/lib/use-error-boundary";
import {
  GRID_ERROR_EXPLANATION,
  GRID_ERROR_RETRY,
  GRID_ERROR_RETRYING,
  GRID_ERROR_TITLE,
} from "../../_lib/lists/messages";

/**
 * A second way out, for a list that has one.
 *
 * The spec's `error` cell for Browse is _"Search failed; the unfiltered list is
 * still reachable"_ — so a page of `/profiles` that failed offers the whole list
 * beside the retry. The Wall has no narrower state to escape from and passes
 * none.
 */
export interface GridEscape {
  readonly href: string;
  readonly label: string;
}

function GridFailure({
  error,
  clear,
  escape,
}: {
  readonly error: BoundaryError;
  readonly clear: () => void;
  readonly escape?: GridEscape;
}) {
  const router = useRouter();
  const { isRetrying, onRetry, headingRef, containerRef } = useErrorBoundary(error, () => {
    router.refresh();
    clear();
  });

  return (
    <section
      ref={containerRef}
      role="alert"
      aria-busy={isRetrying}
      className="text-foreground flex flex-col items-start gap-3"
    >
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-xl font-semibold tracking-tight focus:outline-none"
      >
        {GRID_ERROR_TITLE}
      </h2>
      <p className="text-muted-foreground text-pretty">{GRID_ERROR_EXPLANATION}</p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={onRetry}>{isRetrying ? GRID_ERROR_RETRYING : GRID_ERROR_RETRY}</Button>
        {escape ? (
          <Link href={escape.href} className={buttonVariants({ variant: "outline" })}>
            {escape.label}
          </Link>
        ) : null}
      </div>
    </section>
  );
}

/**
 * The catch itself, which has to be a class: `getDerivedStateFromError` has no
 * hook equivalent, and React has shipped no function-component error boundary.
 * It holds no behaviour of its own beyond that — everything a person sees or
 * hears is in {@link GridFailure}.
 */
export class GridBoundary extends Component<
  { readonly children: ReactNode; readonly escape?: GridEscape },
  { readonly error: BoundaryError | null }
> {
  override state: { readonly error: BoundaryError | null } = { error: null };

  static getDerivedStateFromError(error: BoundaryError) {
    return { error };
  }

  override render() {
    const { error } = this.state;

    if (error === null) return this.props.children;

    return (
      <GridFailure
        error={error}
        escape={this.props.escape}
        clear={() => this.setState({ error: null })}
      />
    );
  }
}
