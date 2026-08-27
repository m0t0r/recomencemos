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
 * **The copy here is still English, and that is an open row.** It was settled at
 * Design before `docs/policy/voice.md` existed; rewriting it in `es-CO` under the
 * voice guide is listed in the repo README under "Still to replace". Keep the
 * shape when it is rewritten — the reference line is what support asks for.
 */

import { Button } from "@repo/design-system/components/button";

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
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl font-semibold tracking-tight focus:outline-none"
      >
        Something went wrong
      </h1>

      <p className="text-muted-foreground">
        We hit an unexpected problem. Trying again may fix it.
      </p>

      {/*
        Not disabled while the retry is in flight: disabling the element that
        has focus drops focus to the document body, which is the one thing a
        keyboard user cannot afford here. The container's `aria-busy` and the
        label carry the state instead, and a second click during a transition
        costs nothing.
      */}
      <Button onClick={onRetry}>{isRetrying ? "Trying again…" : "Try again"}</Button>

      {reference !== undefined && (
        <p className="text-muted-foreground text-sm">
          Reference: <code className="font-mono">{reference}</code>
        </p>
      )}
    </section>
  );
}
