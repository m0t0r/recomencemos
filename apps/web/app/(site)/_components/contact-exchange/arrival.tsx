"use client";

/**
 * The two things the moment of acceptance asks of a screen reader: focus on the
 * Contact Exchange's heading, and the details announced through a polite live
 * region — once, on the visit that followed her answer, and never again.
 *
 * **Why the details move into the region rather than start in it.** A live
 * region mounted already holding its text is not reliably announced
 * (`ArrivalStatus` records the same finding), and the details have to be in the
 * server-rendered markup: without JavaScript this row is still where she reads
 * them (NFR4). So on the arrival visit the server renders an empty region with
 * the details directly after it, and once hydrated the details are rendered
 * *inside* the region instead — one commit, in the same place on screen. The
 * insertion is what a screen reader announces; a sighted reader sees nothing
 * move.
 *
 * **Hydration is read through `useSyncExternalStore`**, whose server snapshot is
 * `false` and whose client snapshot is `true`: React renders the hydration pass
 * with the server's answer, so the markup matches, and re-renders with the
 * client's straight after. No state is set inside an effect.
 *
 * **Focus on mount, not `autoFocus`**, for `RowSummary`'s reason: `autoFocus` on
 * server-rendered markup is not honoured once the segment streams in after the
 * shell.
 */

import { type ReactNode, useEffect, useRef, useSyncExternalStore } from "react";

export function ExchangeHeading({
  id,
  focusOnMount,
  children,
}: {
  readonly id: string;
  readonly focusOnMount: boolean;
  readonly children: ReactNode;
}) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (focusOnMount) ref.current?.focus();
  }, [focusOnMount]);

  return (
    <h3
      ref={ref}
      id={id}
      tabIndex={-1}
      className="font-heading text-foreground focus-visible:ring-ring/50 rounded-sm text-lg font-medium outline-none focus-visible:ring-[3px]"
    >
      {children}
    </h3>
  );
}

/** Nothing to subscribe to: hydration happens once and is never undone. */
const subscribeToNothing = () => () => {};

export function AnnouncedDetails({
  announce,
  children,
}: {
  /** True on the visit that followed her answer, and on no other. */
  readonly announce: boolean;
  readonly children: ReactNode;
}) {
  const hydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );

  // Every later visit: no live region at all. A page of exchanges — his list
  // holds one per accepted Offer — is not a page of things to announce.
  if (!announce) return children;

  // `status` is a polite live region by definition, and a role is what lets the
  // accessibility tree — and a test — find it.
  return (
    <>
      {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- `<output>` admits phrasing content only, and this region holds a description list. */}
      <div role="status">{hydrated ? children : null}</div>
      {hydrated ? null : children}
    </>
  );
}
