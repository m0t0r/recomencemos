"use client";

/**
 * The opened Offer's heading, which takes focus when it arrives from a link.
 *
 * **Focus on mount, not `autoFocus`**, for the reason `ArrivalStatus` gives:
 * `autoFocus` on server-rendered markup is not honoured once the segment streams
 * in after the shell. Focusing it is what tells a screen reader which Offer
 * opened, and on the phone it is what scrolls the detail screen to its top.
 *
 * The pane is keyed by the Offer, so opening another one mounts this again and
 * focuses again. After an answer the caller passes `false` and the result takes
 * focus instead, so exactly one thing asks to be read.
 */

import * as React from "react";

export function PaneHeading({
  id,
  focusOnMount,
  children,
}: {
  readonly id: string;
  readonly focusOnMount: boolean;
  readonly children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLHeadingElement>(null);

  React.useEffect(() => {
    if (focusOnMount) ref.current?.focus();
  }, [focusOnMount]);

  return (
    <h2
      ref={ref}
      id={id}
      tabIndex={-1}
      // No ring: it is focused by code and never tabbed to, the shape the route
      // boundaries give the heading they focus.
      className="font-heading text-foreground text-2xl leading-8 font-medium text-pretty focus:outline-none"
    >
      {children}
    </h2>
  );
}
