"use client";

/**
 * PROTOTYPE — throwaway. The floating variant bar.
 *
 * Hidden outside development, so a stray merge cannot ship it. Left and right
 * cycle and wrap; the arrow keys do the same unless a field has focus.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { type Variant, VARIANT_NAMES, VARIANTS } from "./variants";

export function PrototypeSwitcher({ current }: { readonly current: Variant }) {
  const router = useRouter();
  const params = useSearchParams();

  const go = (step: number) => {
    const index = (VARIANTS.indexOf(current) + step + VARIANTS.length) % VARIANTS.length;
    const next = new URLSearchParams(params.toString());
    next.set("variant", VARIANTS[index] as string);
    router.replace(`?${next.toString()}`);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable]")) return;
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (process.env.NODE_ENV === "production") return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/90 px-3 py-2 text-sm text-white shadow-lg">
      <button type="button" onClick={() => go(-1)} className="px-2" aria-label="Variante anterior">
        ←
      </button>
      <span className="font-mono">
        {current} — {VARIANT_NAMES[current]}
      </span>
      <button type="button" onClick={() => go(1)} className="px-2" aria-label="Variante siguiente">
        →
      </button>
    </div>
  );
}
