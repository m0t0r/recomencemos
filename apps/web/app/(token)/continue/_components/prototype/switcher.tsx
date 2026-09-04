"use client";

/** PROTOTYPE — the floating variant bar. Throwaway; never on `dev`. */

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { VARIANT_NAMES, type VariantKey } from "./variants";

const KEYS = Object.keys(VARIANT_NAMES) as VariantKey[];

export function PrototypeSwitcher({ current }: { readonly current: VariantKey }) {
  const router = useRouter();
  const params = useSearchParams();

  const go = (step: number) => {
    const next = KEYS[(KEYS.indexOf(current) + step + KEYS.length) % KEYS.length] as VariantKey;
    const search = new URLSearchParams(params.toString());
    search.set("variant", next);
    router.replace(`/continue?${search.toString()}`);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (process.env.NODE_ENV === "production") return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black px-4 py-2 text-sm text-white shadow-lg">
      <button type="button" onClick={() => go(-1)} aria-label="Variante anterior">
        ←
      </button>
      <span className="tabular-nums">
        {current} ({VARIANT_NAMES[current]})
      </span>
      <button type="button" onClick={() => go(1)} aria-label="Variante siguiente">
        →
      </button>
    </div>
  );
}
