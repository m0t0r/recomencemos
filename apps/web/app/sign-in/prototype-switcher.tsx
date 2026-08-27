"use client";

/**
 * PROTOTYPE — throwaway. Delete with `sign-in-variants.tsx` when a variant is
 * locked (#12).
 *
 * A floating bar for flipping between variants. Deliberately ugly relative to
 * the page: high contrast, pinned, obviously not part of the design being
 * judged.
 *
 * **Hidden outside development**, so a stray merge cannot ship it. That check is
 * belt to the braces of deleting the file, because a prototype that can reach a
 * Worker is not a prototype.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
import { VARIANTS, type VariantKey } from "./variant-keys";

const KEYS = Object.keys(VARIANTS) as VariantKey[];

export function PrototypeSwitcher({ current }: { current: VariantKey }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const go = useCallback(
    (step: number) => {
      const index = KEYS.indexOf(current);
      const next = KEYS[(index + step + KEYS.length) % KEYS.length];
      if (!next) return;

      const params = new URLSearchParams(searchParams.toString());
      params.set("variant", next);
      router.replace(`/sign-in?${params.toString()}`);
    },
    [current, router, searchParams],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      // Never steal an arrow key from a field she is typing in.
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;

      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  if (process.env.NODE_ENV === "production") return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-black/90 px-2 py-1.5 text-white shadow-lg">
        <button
          type="button"
          onClick={() => go(-1)}
          className="rounded-full px-3 py-1 text-sm hover:bg-white/15"
          aria-label="Variante anterior"
        >
          ←
        </button>
        <span className="px-2 font-mono text-xs tabular-nums">
          {current} · {VARIANTS[current]}
        </span>
        <button
          type="button"
          onClick={() => go(1)}
          className="rounded-full px-3 py-1 text-sm hover:bg-white/15"
          aria-label="Variante siguiente"
        >
          →
        </button>
      </div>
    </div>
  );
}
