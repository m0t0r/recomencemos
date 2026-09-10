"use client";

/**
 * PROTOTYPE — a label wired to a registry `Input`/`Textarea` by id. The lint
 * gate cannot see through a component to the control it renders, and it is
 * right not to guess, so the pairing is explicit here.
 */

import { useId } from "react";

export function Labeled({
  label,
  hint,
  children,
  className = "flex flex-col gap-1 text-sm",
}: {
  readonly label: string;
  readonly hint?: string;
  readonly children: (id: string) => React.ReactNode;
  readonly className?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id}>{label}</label>
      {hint ? <span className="text-muted-foreground text-sm text-pretty">{hint}</span> : null}
      {children(id)}
    </div>
  );
}
