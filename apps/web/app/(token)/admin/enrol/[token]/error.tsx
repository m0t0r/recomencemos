"use client";

/**
 * The `failed` state the surface brief lists, and the only state this route can
 * reach that is not the page or a 404.
 *
 * **It exists because the app's boundaries above it say the wrong thing here.**
 * `app/error.tsx` is written for a Worker's surface, in English, and it offers a
 * support reference — none of which is what the person at this prompt needs. The
 * brief asks for something narrower: *"Enrolment failed: say so plainly **and**
 * say the command can simply be run again, because nothing has been granted
 * yet."* That second clause is the whole reassurance, it is true by construction
 * — the grant is the last step and this render is well before it — and it is
 * information no generic boundary could know to give.
 *
 * **What reaches it is our fault, not the token's.** A bad token is `notFound()`
 * and never arrives here; what does is a secret that will not decrypt or a
 * database that is not answering.
 *
 * **No `reference` line.** The root boundary offers one because a Worker's
 * failure is something support has to look up. The person reading this ran the
 * command themselves thirty seconds ago and has the terminal open behind the
 * browser; the correlator they need is on the line the server already logged.
 */

import { Button } from "@repo/design-system/components/button";
import type { BoundaryError } from "@/lib/report-client-error";
import { useErrorBoundary } from "@/lib/use-error-boundary";
import {
  ENROL_FAILED_EXPLANATION,
  ENROL_FAILED_RETRY,
  ENROL_FAILED_RETRYING,
  ENROL_FAILED_TITLE,
} from "./_lib/messages";

export default function EnrolError({ error, retry }: { error: BoundaryError; retry: () => void }) {
  const { isRetrying, onRetry, headingRef, containerRef } = useErrorBoundary(error, retry);

  return (
    <main
      ref={containerRef}
      role="alert"
      aria-busy={isRetrying}
      className="text-foreground mx-auto flex max-w-prose flex-col items-start gap-4 px-6 py-16"
    >
      {/*
        A `main` rather than the `section` the app-level boundary renders. That
        one replaces a segment inside a shell that already owns the landmark;
        this route has no layout above it but the root's, so if this does not
        carry `main` nothing does.

        `focus:outline-none` because the heading takes focus on mount and is not
        in the tab order — an indicator drawn around a heading reads as a
        rendering fault rather than as focus.
      */}
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl font-semibold tracking-tight focus:outline-none"
      >
        {ENROL_FAILED_TITLE}
      </h1>

      <p className="text-muted-foreground leading-5 text-pretty">{ENROL_FAILED_EXPLANATION}</p>

      {/*
        Not disabled while the retry is in flight: disabling the element that
        has focus drops focus to the document body. `aria-busy` on the container
        and the label carry the state instead.
      */}
      <Button onClick={onRetry}>{isRetrying ? ENROL_FAILED_RETRYING : ENROL_FAILED_RETRY}</Button>
    </main>
  );
}
