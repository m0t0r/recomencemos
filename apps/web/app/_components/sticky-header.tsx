"use client";

/**
 * The client wrapper for the header's one scrolling interaction, and
 * deliberately nothing more.
 *
 * **Everything visible in the header is a Server Component passed in as
 * `children`** — the donut pattern used for what it is for. This file owns the
 * `<header>` element, one sentinel, and one boolean; the product name, the
 * landmark's contents, the session branch and the row's layout all stay on the
 * server and never enter the client bundle.
 *
 * **`position: sticky` belongs on the `<header>` itself, and putting it on a
 * `<div>` inside was a real bug rather than a stylistic choice.** A sticky
 * element travels only within its **parent's** box: nested one level down, its
 * parent was exactly as tall as it was, so it had nowhere to travel and scrolled
 * away like any static element. It looks correct in the markup and does nothing.
 * Hence this component renders the landmark element rather than wrapping one.
 *
 * **Why any client code at all**, since the rest of the shell needs none: "has
 * the page scrolled" has no Baseline-safe CSS answer. `animation-timeline:
 * scroll()` is exactly this feature with no JavaScript and is **ruled out by
 * NFR5** — it reached the four engines between 2023 and 2025, short of the
 * 30-month Widely Available bar. `IntersectionObserver` cleared that bar years
 * ago. A scroll listener would also work and is worse: it fires every frame to
 * answer a question with two states.
 *
 * **Why the shadow is allowed**, given `DESIGN.md` says depth comes from borders
 * and that shadows mark "things that genuinely float — popovers, dialogs,
 * toasts — and nothing else": a stuck header *is* floating, over content passing
 * beneath it. The rule is about not faking depth on things that sit in the page,
 * and this stops sitting in the page the moment it sticks. `shadow-sm`, nothing
 * heavier, and absent until it is earned.
 *
 * **Sticky does not cost acceptance criterion 6**, which is the obvious worry: a
 * `position: sticky` element still occupies its space in normal flow, so nothing
 * below it reflows when it sticks.
 */

import * as React from "react";

export function StickyHeader({ children, ...props }: React.ComponentProps<"header">) {
  const sentinel = React.useRef<HTMLDivElement>(null);
  const [elevated, setElevated] = React.useState(false);

  React.useEffect(() => {
    const node = sentinel.current;
    if (!node) return;

    const observer = new IntersectionObserver(([entry]) => {
      // The sentinel sits above the header in normal flow, so it leaves the
      // viewport exactly when the header starts overlapping content.
      setElevated(entry ? !entry.isIntersecting : false);
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/*
        One pixel, cancelled by a negative margin so it costs no layout. A
        zero-height element is the tempting version and is unreliable: some
        engines never report an intersection for a box with no area.
      */}
      <div ref={sentinel} aria-hidden="true" className="-mb-px h-px" />

      <header
        {...props}
        data-elevated={elevated || undefined}
        /*
          No `relative` — `sticky` is itself a positioned value, so the two
          classes would be a `position` conflict resolved by stylesheet order. It
          still establishes the containing block the sign-out failure message
          positions against.
        */
        className="border-border bg-background data-elevated:shadow-sm sticky top-0 z-40 border-b transition-shadow duration-200 motion-reduce:transition-none"
      >
        {children}
      </header>
    </>
  );
}
