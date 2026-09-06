"use client";

/**
 * The root error boundary: what a user sees when the root layout itself failed.
 *
 * **It replaces the root layout**, so nothing the app normally mounts is
 * available to it — no design-system stylesheet, no fonts, and no theme
 * provider. Every rule it needs it carries, which is why the colours below are
 * literal hex rather than tokens: the token layer is one of the pieces that did
 * not mount.
 *
 * **The six values are the product's own palette, and there is no dark scheme.**
 * They were Tailwind's zinc defaults with a `prefers-color-scheme: dark` block
 * beside them, which was wrong twice over: the greys belonged to no palette this
 * product ships, and the dark block made the one screen a visitor sees when
 * everything else has failed the only dark surface in a product that is
 * deliberately light-only (`globals.css` binds Tailwind's `dark` variant to a
 * class nothing sets, precisely so the OS cannot decide this). A root boundary
 * that does not look like the product is a second failure layered on the first.
 *
 * So the values are `background`, `foreground`, `mutedForeground`, `muted`,
 * `primary` and `primaryForeground`, converted from `globals.css`'s `oklch()`
 * exactly as `@repo/notifications` converts them for email — and for the same
 * reason, that this surface cannot read the stylesheet either.
 * `apps/web/design-tokens.test.ts` is what keeps all three in step.
 *
 * **It still clears WCAG 2.2 AA on its own**, because it cannot borrow the token
 * layer's guarantee: 16.49:1 for body text, 5.86:1 for the muted reference line,
 * and 7.42:1 for the button. Those are the same three numbers the email palette
 * tabulates, which is what being one palette means.
 *
 * `color-scheme: light` is now stated rather than `light dark`, so form controls
 * and scrollbars match the page instead of following the OS on a page that does
 * not.
 *
 * **The copy is `es-CO` and is imported like any other module's.** What this
 * boundary loses by replacing the root layout is the *stylesheet* and the fonts,
 * not the module graph — so the colours below have to be literal and the words do
 * not. `_lib/boundary/messages.ts` holds them beside the other two boundaries'.
 *
 * **The heading stays in the system stack, and that is honest rather than
 * unfinished.** Alegreya is self-hosted by `next/font`, which injects it through
 * the stylesheet this file replaces, so a display face named here would render as
 * whatever serif the browser happened to have. It is the same argument `DESIGN.md`
 * already makes for email keeping Inter alone.
 */

import {
  REFERENCE_TERM,
  ROOT_ERROR_EXPLANATION,
  ROOT_ERROR_PAGE_TITLE,
  ROOT_ERROR_RETRY,
  ROOT_ERROR_RETRYING,
  ROOT_ERROR_TITLE,
} from "./_lib/boundary/messages";
import type { BoundaryError } from "../lib/report-client-error";
import { useErrorBoundary } from "../lib/use-error-boundary";

const styles = `
  :root {
    color-scheme: light;

    /* The product's palette, from globals.css. Custom properties with inline
     * var() fallbacks below, so a browser that drops this block still renders
     * legible text rather than transparent-on-transparent. */
    --bg: #fafcfe;          /* --background      oklch(0.99 0.004 250)  */
    --fg: #161c2d;          /* --foreground      oklch(0.23 0.035 268)  */
    --muted: #58637b;       /* --muted-foreground oklch(0.5 0.04 265)   */
    --surface: #eff4fa;     /* --muted           oklch(0.965 0.01 250)  */
    --button-bg: #334db0;   /* --primary         oklch(0.46 0.16 268)   */
    --button-fg: #ffffff;   /* --primary-foreground oklch(1 0 0)        */
  }

  body {
    margin: 0;
    background: var(--bg, #fafcfe);
    color: var(--fg, #161c2d);
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
    color: var(--muted, #58637b);
  }

  .reference {
    font-size: 0.875rem;
  }

  .reference code {
    background: var(--surface, #eff4fa);
    /* DESIGN.md's rounded.sm. It was 0.25rem — Tailwind's step, not this
       product's — which is the same class of drift as the zinc palette that used
       to be here, and the design hook caught it for the same reason. */
    border-radius: 0.3rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    padding: 0.125rem 0.375rem;
  }

  .boundary button {
    background: var(--button-bg, #334db0);
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
    outline: 2px solid var(--fg, #161c2d);
    outline-offset: 2px;
  }
`;

export default function GlobalError({ error, retry }: { error: BoundaryError; retry: () => void }) {
  const { reference, isRetrying, onRetry, headingRef, containerRef } = useErrorBoundary(
    error,
    retry,
  );

  return (
    /*
      `es-CO`, for the reason the root layout carries it: every string below is
      Spanish, and `lang` is what a screen reader takes its phonemes from. It said
      `en` while the copy was English and would have gone on saying it — the two
      had to move together, and this is the one file where nothing else would have
      caught the mismatch.
    */
    <html lang="es-CO">
      <body>
        {/*
          A document with no title fails WCAG 2.4.2, and this boundary replaces
          the root layout — so the app's `metadata` export is not in play and
          nothing else supplies one. `metadata` is unavailable to a Client
          Component anyway; React's own `title` element is what Next's reference
          points to here.
        */}
        <title>{ROOT_ERROR_PAGE_TITLE}</title>

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
              {ROOT_ERROR_TITLE}
            </h1>

            <p className="muted">{ROOT_ERROR_EXPLANATION}</p>

            {/* See `app/error.tsx` for why this is not disabled while busy. */}
            <button type="button" onClick={onRetry}>
              {isRetrying ? ROOT_ERROR_RETRYING : ROOT_ERROR_RETRY}
            </button>

            {reference !== undefined && (
              <p className="reference muted">
                {REFERENCE_TERM} <code>{reference}</code>
              </p>
            )}
          </div>
        </main>
      </body>
    </html>
  );
}
