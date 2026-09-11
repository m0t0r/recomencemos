"use client";

/**
 * PROTOTYPE — the floating variant switcher. Throwaway; never ships.
 *
 * Adapted from `prototype/178-mobile-variants`: under the header on the right,
 * out of the thumb zone; arrow keys cycle unless a field has focus; `?clean=1`
 * hides it for a capture; and it renders nothing in a production build.
 */

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { variantFrom, VARIANTS } from "./variant-keys";

export function PrototypeSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = variantFrom(params.get("variant"));
  const index = VARIANTS.findIndex((variant) => variant.key === current);

  const go = (delta: number) => {
    const next = VARIANTS[(index + delta + VARIANTS.length) % VARIANTS.length];
    if (!next) return;
    const search = new URLSearchParams(params.toString());
    search.set("variant", next.key);
    router.replace(`${pathname}?${search.toString()}`);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      // oxlint-disable-next-line testing-library/no-node-access -- not a test; the switcher asks whether a field has focus
      if (target?.closest("input, textarea, [contenteditable]")) return;
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (process.env.NODE_ENV === "production") return null;
  if (params.get("clean") === "1") return null;

  return (
    <div className="fixed top-16 right-2 z-50 flex items-center gap-1 rounded-full bg-neutral-900 px-2 py-1 font-mono text-xs text-white shadow-lg">
      <button
        type="button"
        onClick={() => go(-1)}
        className="rounded-full px-2 py-1 hover:bg-white/10"
      >
        ←
      </button>
      <span className="px-1">
        {current} · {VARIANTS[index]?.name}
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
