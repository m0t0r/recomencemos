"use client";

/**
 * PROTOTYPE — throwaway. Delete this file with the losing variants.
 *
 * The floating bar that cycles `?variant=` on a route hosting `/prototype` UI
 * variants. Deliberately not part of any design being judged: high-contrast,
 * fixed, obviously bolted on. Lifted from #24's prototype commit (`e387d02`).
 *
 * **Hidden outside development.** A stray merge cannot ship the bar to anyone —
 * `NODE_ENV` is inlined at build time, so the whole component compiles away.
 *
 * Arrow keys cycle too, and are ignored while a field has focus.
 */

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
import type { PrototypeVariant } from "@/app/_lib/prototype-variants";

export function PrototypeSwitcher({
  variants,
  current,
}: {
  readonly variants: readonly PrototypeVariant[];
  readonly current: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const at = Math.max(
    0,
    variants.findIndex((variant) => variant.key === current),
  );

  const go = useCallback(
    (step: number) => {
      const next = variants[(at + step + variants.length) % variants.length];
      if (!next) return;

      const params = new URLSearchParams(searchParams.toString());
      params.set("variant", next.key);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [at, pathname, router, searchParams, variants],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable === true;

      if (typing) return;
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  if (process.env.NODE_ENV === "production") return null;

  const variant = variants[at];

  return (
    // In the header's empty middle rather than #24's bottom-centre: one variant
    // here is a bar fixed to the foot of the screen, and a switcher on it would
    // hide the very controls being judged. The header row has nothing between
    // the wordmark and the avatar at 390 px, so this covers nothing that is.
    <div className="fixed inset-x-0 top-2 z-50 flex justify-center print:hidden">
      <div className="flex items-center gap-1 rounded-full bg-black/90 px-2 py-1.5 text-white shadow-lg">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Variante anterior"
          className="rounded-full px-3 py-1 text-lg leading-none hover:bg-white/20"
        >
          ←
        </button>
        <span className="px-2 text-sm tabular-nums">
          {variant?.key.toUpperCase()} · {variant?.name}
        </span>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Variante siguiente"
          className="rounded-full px-3 py-1 text-lg leading-none hover:bg-white/20"
        >
          →
        </button>
      </div>
    </div>
  );
}
