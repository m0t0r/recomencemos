"use client";

/**
 * The `/prototype` UI floating bar: previous, the current variant's key and
 * name, next. Arrow keys cycle too, unless a field is focused. It rewrites
 * `?variant=` through the router so a variant is shareable and reload-stable.
 *
 * **Never in production.** The check is on `NODE_ENV`, so a stray prototype
 * merge cannot ship the bar. Shared by every route that hosts variants; the
 * variants themselves stay beside the page they belong to and leave `main` once
 * one is locked.
 */

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export interface PrototypeVariant {
  readonly key: string;
  readonly name: string;
}

export interface PrototypeSwitcherProps {
  readonly variants: readonly PrototypeVariant[];
  readonly current: string;
}

export function PrototypeSwitcher({ variants, current }: PrototypeSwitcherProps) {
  const router = useRouter();
  const index = Math.max(
    0,
    variants.findIndex((variant) => variant.key === current),
  );

  useEffect(() => {
    function step(offset: number) {
      const next = variants[(index + offset + variants.length) % variants.length];
      if (next) router.replace(`?variant=${next.key}`);
    }

    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, variants, router]);

  if (process.env.NODE_ENV === "production") return null;

  const variant = variants[index];

  function go(offset: number) {
    const next = variants[(index + offset + variants.length) % variants.length];
    if (next) router.replace(`?variant=${next.key}`);
  }

  return (
    <div
      role="toolbar"
      aria-label="Prototype variants"
      className="bg-foreground text-background fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full px-4 py-2 font-mono text-sm shadow-lg"
    >
      <button type="button" onClick={() => go(-1)} aria-label="Previous variant" className="px-1">
        ←
      </button>
      <span>
        {variant?.key} ({variant?.name})
      </span>
      <button type="button" onClick={() => go(1)} aria-label="Next variant" className="px-1">
        →
      </button>
    </div>
  );
}
