"use client";

/**
 * PROTOTYPE — throwaway. Delete this file with the losing variants.
 *
 * The floating bar that cycles `?variant=` on a route hosting `/prototype` UI
 * variants. Deliberately not part of any design being judged: high-contrast,
 * fixed, obviously bolted on.
 *
 * **Hidden outside development.** A stray merge cannot ship the bar to anyone —
 * `NODE_ENV` is inlined at build time, so the whole component compiles away.
 *
 * Arrow keys cycle too, and are ignored while a field has focus — this sits on a
 * page whose whole point is a form, and stealing `←`/`→` from a `<textarea>`
 * would make the thing being judged untypable.
 */

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { PrototypeVariant } from "@/app/_lib/prototype-variants";
import { useCallback, useEffect } from "react";

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
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center print:hidden">
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
