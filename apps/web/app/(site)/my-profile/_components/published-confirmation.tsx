"use client";

/**
 * The confirmation's shell: a status region that takes focus when it mounts.
 *
 * A Client Component for that one effect. `autoFocus` on the server-rendered
 * element was not honoured when the page arrived through the action's
 * redirect — the panel streams in after the shell, and the browser's autofocus
 * moment has passed by then (measured at seam 3). Focusing on mount is what the
 * spec's success cell asks for: the confirmation is the thing she is waiting to
 * hear, and `role="status"` announces it to anyone not focused on it.
 */

import { Alert } from "@repo/design-system/components/alert";
import { type ReactNode, useEffect, useRef } from "react";

export function PublishedConfirmation({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <Alert
      ref={ref}
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- `<output>` takes phrasing content only; this holds a title, a paragraph and a button
      role="status"
      tabIndex={-1}
      className="focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]"
    >
      {children}
    </Alert>
  );
}
