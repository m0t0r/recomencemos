"use client";

/**
 * The root error boundary: what a user sees when the root layout itself failed.
 *
 * **It replaces the root layout**, so nothing the app normally mounts is
 * available to it — no design-system stylesheet, no fonts, and no theme
 * provider. Every rule it needs it carries, and it follows the **OS** colour
 * scheme rather than the app's theme, because the thing that reads the app's
 * theme is one of the pieces that did not mount.
 *
 * **Two `prefers-color-scheme` media queries, not one colour function.** The
 * same amount of code as `light-dark()`, and it raises no question about which
 * browsers are in the floor. The `light` query is the one that carries a user
 * who has expressed no preference, and every value also has an inline fallback
 * in its `var()` so that a browser matching neither query still renders legible
 * text rather than transparent-on-transparent.
 *
 * The palette clears WCAG 2.2 AA in both schemes on its own — it cannot borrow
 * the token layer's guarantee, because the token layer is not here.
 *
 * **The copy here is still English, and so is the palette an open row.** Both
 * are listed in the repo README under "Still to replace"; the copy is rewritten
 * in `es-CO` under `docs/policy/voice.md`, and whatever replaces these six hex
 * values must clear AA in both schemes on its own.
 */

import type { BoundaryError } from "../lib/report-client-error";
import { useErrorBoundary } from "../lib/use-error-boundary";

const styles = `
  :root {
    color-scheme: light dark;
  }

  @media (prefers-color-scheme: light) {
    :root {
      --bg: #ffffff;
      --fg: #18181b;
      --muted: #52525b;
      --surface: #f4f4f5;
      --button-bg: #18181b;
      --button-fg: #ffffff;
    }
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #09090b;
      --fg: #fafafa;
      --muted: #a1a1aa;
      --surface: #27272a;
      --button-bg: #fafafa;
      --button-fg: #09090b;
    }
  }

  body {
    margin: 0;
    background: var(--bg, #ffffff);
    color: var(--fg, #18181b);
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 1rem;
    line-height: 1.5;
  }

  .boundary {
    box-sizing: border-box;
    margin: 0 auto;
    max-width: 34rem;
    padding: 4rem 1.5rem;
  }

  .boundary-alert {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .boundary h1 {
    margin: 0;
    font-size: 1.5rem;
    line-height: 1.25;
  }

  /* The heading takes focus on mount so a keyboard user has somewhere to be.
     It is not in the tab order, so no indicator is owed for it — and drawing
     one around a heading reads as a rendering fault rather than as focus. */
  .boundary h1:focus {
    outline: none;
  }

  .boundary p {
    margin: 0;
  }

  .muted {
    color: var(--muted, #52525b);
  }

  .reference {
    font-size: 0.875rem;
  }

  .reference code {
    background: var(--surface, #f4f4f5);
    border-radius: 0.25rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    padding: 0.125rem 0.375rem;
  }

  .boundary button {
    background: var(--button-bg, #18181b);
    border: 1px solid transparent;
    border-radius: 0.375rem;
    color: var(--button-fg, #ffffff);
    cursor: pointer;
    font: inherit;
    font-weight: 500;
    /* WCAG 2.2 target size (minimum) is 24 by 24 CSS pixels; this is well past it. */
    min-height: 2.5rem;
    min-width: 2.5rem;
    padding: 0.5rem 1rem;
  }

  .boundary button:focus-visible {
    /* Offset so the indicator sits on the page background rather than on the
       button it outlines, where it would have the button's own contrast. */
    outline: 2px solid var(--fg, #18181b);
    outline-offset: 2px;
  }
`;

export default function GlobalError({ error, retry }: { error: BoundaryError; retry: () => void }) {
  const { reference, isRetrying, onRetry, headingRef, containerRef } = useErrorBoundary(
    error,
    retry,
  );

  return (
    <html lang="en">
      <body>
        {/*
          A document with no title fails WCAG 2.4.2, and this boundary replaces
          the root layout — so the app's `metadata` export is not in play and
          nothing else supplies one. `metadata` is unavailable to a Client
          Component anyway; React's own `title` element is what Next's reference
          points to here.
        */}
        <title>Something went wrong</title>

        {/* In the body rather than a head this boundary does not own: a `style`
            element applies wherever it is parsed, and the root layout that
            would have carried one is precisely what failed. */}
        <style>{styles}</style>

        {/* A `main` rather than a bare `section`: this boundary replaces the
            root layout, so it *is* the document, and nothing else is left to
            carry the one landmark every document owes a screen-reader user.
            The alert is inside it because `role="alert"` on the `main` element
            would override the landmark rather than add to it. */}
        <main className="boundary">
          <div ref={containerRef} role="alert" aria-busy={isRetrying} className="boundary-alert">
            <h1 ref={headingRef} tabIndex={-1}>
              Something went wrong
            </h1>

            <p className="muted">This page could not be loaded. Reloading may fix it.</p>

            {/* See `app/error.tsx` for why this is not disabled while busy. */}
            <button type="button" onClick={onRetry}>
              {isRetrying ? "Trying again…" : "Reload"}
            </button>

            {reference !== undefined && (
              <p className="reference muted">
                Reference: <code>{reference}</code>
              </p>
            )}
          </div>
        </main>
      </body>
    </html>
  );
}
