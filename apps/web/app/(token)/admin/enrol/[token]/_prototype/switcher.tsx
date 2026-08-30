"use client";

/**
 * PROTOTYPE — throwaway. Not production code, and it leaves the main branch with
 * the losing variants when the question is settled.
 *
 * The floating variant switcher: `←`, the current variant's key and name, `→`.
 * It writes `?variant=` so a variant is shareable and reload-stable, and it is
 * gated on `NODE_ENV` so a stray merge cannot ship it.
 */

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { VARIANT_KEYS as KEYS, VARIANTS, type VariantKey } from "./keys";

export function PrototypeSwitcher({ current }: { readonly current: VariantKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  function go(step: number) {
    const next = KEYS[(KEYS.indexOf(current) + step + KEYS.length) % KEYS.length] as VariantKey;
    const params = new URLSearchParams(search.toString());
    params.set("variant", next);
    router.replace(`${pathname}?${params.toString()}`);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable]")) return;
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (process.env.NODE_ENV === "production") return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black px-4 py-2 text-white shadow-lg">
      <button type="button" onClick={() => go(-1)} aria-label="Variante anterior">
        ←
      </button>
      <span className="font-mono text-xs">
        {current} · {VARIANTS[current]}
      </span>
      <button type="button" onClick={() => go(1)} aria-label="Variante siguiente">
        →
      </button>
    </div>
  );
}
