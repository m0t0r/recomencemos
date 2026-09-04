"use client";

/**
 * PROTOTYPE — the floating variant switcher. Throwaway; never ships.
 * Four variants of `/`, switchable via `?variant=`, on the existing route.
 */

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { variantFrom, VARIANTS } from "./variants";

export function PrototypeSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = variantFrom(params.get("variant"));

  const index = VARIANTS.findIndex((v) => v.key === current);
  const go = (delta: number) => {
    const next = VARIANTS[(index + delta + VARIANTS.length) % VARIANTS.length]!;
    const search = new URLSearchParams(params.toString());
    search.set("variant", next.key);
    router.replace(`${pathname}?${search.toString()}`);
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
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-neutral-900 px-2 py-1 font-mono text-xs text-white shadow-lg">
      <button
        type="button"
        onClick={() => go(-1)}
        className="rounded-full px-2 py-1 hover:bg-white/10"
      >
        ←
      </button>
      <span className="px-2">
        {current} ({VARIANTS[index]?.name})
      </span>
      <button
        type="button"
        onClick={() => go(1)}
        className="rounded-full px-2 py-1 hover:bg-white/10"
      >
        →
      </button>
    </div>
  );
}
