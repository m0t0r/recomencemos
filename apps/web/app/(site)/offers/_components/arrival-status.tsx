"use client";

/**
 * The sentence she lands on after answering: a status that takes focus when it
 * mounts.
 *
 * **A live region mounted already full is not reliably announced** — it has to
 * exist before its text changes, and after the action's redirect this one
 * arrives with its text in it. Focusing it on mount is what makes a screen
 * reader read it, and it is the same answer `/my-profile`'s published
 * confirmation reached for the same reason: `autoFocus` on server-rendered markup
 * is not honoured once the segment streams in after the shell.
 *
 * `status` rather than `alert`: it is the outcome of something she did, and it
 * is good news or neutral news, never a fault.
 */

import { type ReactNode, useEffect, useRef } from "react";

export function ArrivalStatus({ children }: { readonly children: ReactNode }) {
  const ref = useRef<HTMLOutputElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <output
      ref={ref}
      tabIndex={-1}
      className="border-border text-foreground focus-visible:ring-ring/50 border-l-2 pl-4 font-medium outline-none focus-visible:ring-[3px]"
    >
      {children}
    </output>
  );
}
