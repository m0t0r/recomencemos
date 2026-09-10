/**
 * PROTOTYPE — the frame every lab page sits in: a strip naming the idea, the
 * question it answers and the current variant's bet, then the floating
 * switcher. Deliberately off-palette (mono, muted strip) so nobody mistakes
 * the frame for the design being judged.
 */

import Link from "next/link";
import { PrototypeSwitcher } from "@/app/_components/prototype-switcher";
import type { LabVariant } from "../_lib/variant";

export function LabFrame({
  idea,
  question,
  variants,
  current,
  children,
}: {
  readonly idea: string;
  readonly question: string;
  readonly variants: readonly LabVariant[];
  readonly current: LabVariant;
  readonly children: React.ReactNode;
}) {
  return (
    <>
      <div className="border-border bg-muted border-b px-4 py-2 font-mono text-xs">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-baseline gap-x-4 gap-y-1">
          <Link href="/prototype" className="underline underline-offset-2">
            laboratorio
          </Link>
          <span className="text-foreground font-medium">{idea}</span>
          <span className="text-muted-foreground">{question}</span>
        </div>
        <div className="text-muted-foreground mx-auto mt-1 w-full max-w-5xl">
          <span className="text-foreground">
            {current.key} · {current.name}:
          </span>{" "}
          {current.bet}
        </div>
      </div>
      {children}
      <div className="h-20" aria-hidden="true" />
      <PrototypeSwitcher variants={variants} current={current.key} />
    </>
  );
}
