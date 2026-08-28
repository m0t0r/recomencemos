"use client";

/**
 * PROTOTYPE — throwaway. Ticket #80.
 *
 * The floating bar, and the client-side `?variant=` read. It sits in the header
 * rather than on a route because the thing being prototyped is **chrome**: it
 * has to be judged against the real page under it, at the real density, which is
 * the whole reason sub-shape A beats a throwaway route.
 *
 * Gated on `NODE_ENV !== "production"`, so a stray merge cannot ship the bar.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { VARIANTS, type VariantKey } from "./variants";

const KEYS = Object.keys(VARIANTS) as VariantKey[];

export function useVariant(): VariantKey {
  const params = useSearchParams();
  const requested = params.get("variant")?.toUpperCase();
  return KEYS.includes(requested as VariantKey) ? (requested as VariantKey) : "A";
}

export function PrototypeVariant({ email }: { email: string }) {
  const key = useVariant();
  const Render = VARIANTS[key].render;
  return <Render email={email} />;
}

export function PrototypeSwitcher() {
  const key = useVariant();
  const router = useRouter();

  const go = (step: number) => {
    const next = KEYS[(KEYS.indexOf(key) + step + KEYS.length) % KEYS.length];
    router.replace(`?variant=${next}`, { scroll: false });
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
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center">
      <div className="flex items-center gap-1 rounded-full bg-black px-2 py-1 text-white shadow-lg">
        <button type="button" onClick={() => go(-1)} className="px-2 py-1" aria-label="Anterior">
          ←
        </button>
        <span className="px-2 font-mono text-xs whitespace-nowrap">
          {key} · {VARIANTS[key].name}
        </span>
        <button type="button" onClick={() => go(1)} className="px-2 py-1" aria-label="Siguiente">
          →
        </button>
      </div>
    </div>
  );
}
