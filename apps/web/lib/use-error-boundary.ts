"use client";

/**
 * The behaviour both error boundaries share, in one place.
 *
 * `app/error.tsx` and `app/global-error.tsx` differ in exactly two ways — their
 * copy, and the fact that the root one mounts no stylesheet and therefore
 * carries its own — and in no way at all in what they *do*. The subtle half is
 * here: report once and only once, show the reference identifier the report
 * site chose, and keep the keyboard and the screen reader with the user across
 * a failure and a recovery.
 *
 * Kept out of the boundaries themselves because two copies of a focus protocol
 * drift, and the copy that drifts is the one nobody opens until an incident.
 */

import * as React from "react";

import { reportClientError, type BoundaryError } from "./report-client-error";

export interface ErrorBoundaryState {
  /** The reference identifier to show, or `undefined` when there is none. */
  reference: string | undefined;
  /** True while a retry is in flight — the boundary's `aria-busy` and its button label. */
  isRetrying: boolean;
  /** The retry button's handler. */
  onRetry: () => void;
  /** Attach to the boundary's heading: it takes focus when the boundary mounts. */
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  /**
   * Attach to the element carrying `role="alert"`. It is how the boundary
   * knows *where on the page it was* — which is where the restored content
   * appears, and therefore where focus has to go afterwards.
   *
   * A callback rather than an object ref so one `HTMLElement` ref serves a
   * `section` in one boundary and a `div` in the other.
   */
  containerRef: (node: HTMLElement | null) => void;
}

const HEADINGS = "h1, h2, h3, h4, h5, h6";

/**
 * Where the boundary stood, as the two things that survive its removal: the
 * parent that outlives it, and the sibling it sat after — `null` when it was
 * the first child.
 */
interface Position {
  parent: HTMLElement;
  after: Element | null;
}

/**
 * The first heading of whatever now occupies the boundary's old position.
 *
 * Document order alone is not enough, and neither is the parent element: a
 * shell that renders its own heading *above* the failed segment has that
 * heading first in both. What recovered is what sits between where the boundary
 * started and the end of its parent, so the walk starts at the sibling the
 * boundary sat after and runs forward.
 */
function firstRestoredHeading({ parent, after }: Position): HTMLElement | null {
  let node = after === null ? parent.firstElementChild : after.nextElementSibling;

  while (node !== null) {
    if (node.matches(HEADINGS)) return node as HTMLElement;

    const nested = node.querySelector<HTMLElement>(HEADINGS);
    if (nested !== null) return nested;

    node = node.nextElementSibling;
  }

  return null;
}

/**
 * Moves focus to the first heading of whatever replaced the boundary.
 *
 * The boundary is being torn down, so this is the last thing it can do for the
 * user: without it, focus falls to `document.body` when the retry button
 * unmounts and a keyboard or screen-reader user is returned to the top of the
 * document with no announcement of what changed.
 *
 * The whole-document search is the fallback for the **root** boundary, whose
 * tree — the captured position included — is replaced rather than filled in.
 *
 * The heading is not ours to author — it belongs to the restored content — so
 * `tabindex="-1"` is added only when the author set none, which makes it
 * programmatically focusable without putting it in the tab order.
 */
function focusRestoredContent(position: Position | null): void {
  // Deferred by a frame: React commits the replacement tree around this
  // cleanup, and the heading being looked for may not be in the document yet.
  requestAnimationFrame(() => {
    const heading =
      position !== null && position.parent.isConnected
        ? firstRestoredHeading(position)
        : (document.querySelector("main") ?? document.body).querySelector<HTMLElement>(HEADINGS);

    if (heading === null) return;

    if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");

    heading.focus();
  });
}

/**
 * @param error the error the boundary was handed
 * @param retry the framework's recovery: it re-fetches and re-renders the
 * boundary's children, which is what lets a *server*-thrown error recover at
 * all. It is also what Next 16's reference prescribes — `error.md` documents
 * `retry` as the prop the examples use and says of the alternative, "in most
 * cases, you should use `retry()` instead" of `reset()`, which re-renders
 * without re-fetching. A boundary wired to `reset()` would offer the user a
 * button that reliably does nothing to a server error.
 */
export function useErrorBoundary(error: BoundaryError, retry: () => void): ErrorBoundaryState {
  const [reference, setReference] = React.useState<string | undefined>(undefined);
  const [isRetrying, startRetry] = React.useTransition();
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  /** The error this boundary has already reported, so it reports each one once. */
  const reportedError = React.useRef<BoundaryError | undefined>(undefined);
  /** Whether the unmount about to happen is a recovery rather than a navigation. */
  const isRecovering = React.useRef(false);
  const container = React.useRef<HTMLElement | null>(null);
  /** Where the boundary stood, captured while it is still mounted. */
  const position = React.useRef<Position | null>(null);

  React.useEffect(() => {
    // Identity, not a boolean. An effect can run more than once for one error —
    // React's development Strict Mode invokes it twice on purpose, and a
    // remounted subtree does the same in production — and each extra run would
    // be an extra event for one incident, which is the count NFR3 fixes at one.
    if (reportedError.current === error) return;

    reportedError.current = error;

    setReference(reportClientError(error));
  }, [error]);

  React.useEffect(() => {
    // Keyed on the transition ending rather than on a new error arriving: a
    // retry that fails may re-throw the *same* error object, which the report
    // guard above short-circuits. Clearing it there would leave this stuck
    // `true`, and the next unmount — a navigation away — would steal focus,
    // which is the one thing the flag exists to prevent.
    if (!isRetrying) isRecovering.current = false;
  }, [isRetrying]);

  React.useEffect(() => {
    // The container is `role="alert"`, so it is announced on mount; moving
    // focus into it is what gives a keyboard user somewhere to be afterwards.
    headingRef.current?.focus();

    return () => {
      if (isRecovering.current) focusRestoredContent(position.current);
    };
  }, []);

  return {
    reference,
    isRetrying,
    headingRef,
    containerRef: (node) => {
      container.current = node;
    },
    onRetry: () => {
      isRecovering.current = true;

      // Read now, while the boundary is still on the page: by the time the
      // unmount cleanup runs, the container has neither a parent nor a sibling
      // left to ask.
      const parent = container.current?.parentElement ?? null;
      position.current =
        parent === null
          ? null
          : { parent, after: container.current?.previousElementSibling ?? null };

      // A transition rather than a second piece of state: `isRetrying` is
      // React's own view of whether the retried render has committed, so the
      // busy state cannot disagree with what is on screen.
      startRetry(() => {
        retry();
      });
    },
  };
}
