"use client";

/**
 * The nested error boundary: the `error` state of the app shell.
 *
 * It renders **inside** the shell. Under partial prerendering the static shell
 * may have rendered successfully and only a dynamic segment beneath it failed,
 * so this is a region on someone else's page — it sets no background, mounts no
 * layout, and uses the design system's semantic tokens so it inherits whichever
 * theme the shell resolved. Restyling the page from here would make a failed
 * segment look like a failed site.
 *
 * The root boundary is `global-error.tsx`, which replaces the root layout and
 * therefore cannot share any of that.
 *
 * **A `section`, not a `main`.** The root boundary renders a `main` because it
 * *is* the document and nothing else is left to carry the landmark. This one is
 * not: it replaces a segment inside a shell whose markup it cannot see. If that
 * shell's layout already renders a `main`, a second one here is a worse
 * outcome than the missing one — so the landmark stays the shell's to own, and
 * a project whose `main` lived in the replaced page renders one in its own
 * copy of this file.
 *
 * **The copy is `es-CO` and lives in `_lib/boundary/messages.ts`**, beside the
 * root boundary's and the not-found page's, under the voice guide's `A refusal`
 * row: the failure is our rule and never her mistake. The shape is unchanged from
 * the English it replaced — the reference line is what support asks for.
 */

import { Button } from "@repo/design-system/components/button";

import {
  APP_ERROR_EXPLANATION,
  APP_ERROR_RETRY,
  APP_ERROR_RETRYING,
  APP_ERROR_TITLE,
  REFERENCE_TERM,
} from "@/app/_lib/boundary/messages";
import type { BoundaryError } from "../lib/report-client-error";
import { useErrorBoundary } from "../lib/use-error-boundary";

export default function AppError({ error, retry }: { error: BoundaryError; retry: () => void }) {
  const { reference, isRetrying, onRetry, headingRef, containerRef } = useErrorBoundary(
    error,
    retry,
  );

  return (
    <section
      ref={containerRef}
      role="alert"
      aria-busy={isRetrying}
      className="text-foreground mx-auto flex max-w-prose flex-col items-start gap-4 px-6 py-16"
    >
      {/* `focus:outline-none` because the heading takes focus on mount and is
          not in the tab order: no indicator is owed for it, and one drawn
          around a heading reads as a rendering fault rather than as focus. */}
      <h1 ref={headingRef} tabIndex={-1} className="page-heading focus:outline-none">
        {APP_ERROR_TITLE}
      </h1>

      <p className="text-muted-foreground text-pretty">{APP_ERROR_EXPLANATION}</p>

      {/*
        Not disabled while the retry is in flight: disabling the element that
        has focus drops focus to the document body, which is the one thing a
        keyboard user cannot afford here. The container's `aria-busy` and the
        label carry the state instead, and a second click during a transition
        costs nothing.
      */}
      <Button onClick={onRetry}>{isRetrying ? APP_ERROR_RETRYING : APP_ERROR_RETRY}</Button>

      {reference !== undefined && (
        <p className="text-muted-foreground text-sm">
          {REFERENCE_TERM} <code className="font-mono">{reference}</code>
        </p>
      )}
    </section>
  );
}
