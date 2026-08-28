"use client";

/**
 * PROTOTYPE — the floating variant switcher. **Throwaway; does not merge.**
 *
 * Deliberately ugly and deliberately unlike the page: it is scaffolding for
 * judging the design, so it must never be mistaken for part of it.
 *
 * Gated on `NODE_ENV !== "production"` so a stray merge cannot ship it, which is
 * belt-and-braces on top of the file never reaching `dev` at all.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { VARIANT_NAMES, VARIANTS, type Variant } from "./prototype-session-lists";

export function PrototypeSwitcher({ current }: { readonly current: Variant }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const step = (delta: number) => {
    const index = VARIANTS.indexOf(current);
    const next = VARIANTS[(index + delta + VARIANTS.length) % VARIANTS.length]!;
    const params = new URLSearchParams(searchParams.toString());
    params.set("variant", next);
    router.replace(`/account?${params.toString()}`);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (process.env.NODE_ENV === "production") return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 12px",
        borderRadius: 999,
        background: "#111",
        color: "#fff",
        fontFamily: "ui-monospace, monospace",
        fontSize: 12,
        boxShadow: "0 6px 24px rgba(0,0,0,.35)",
        zIndex: 9999,
      }}
    >
      <button type="button" onClick={() => step(-1)} style={buttonStyle} aria-label="Anterior">
        ←
      </button>
      <span>
        {current} — {VARIANT_NAMES[current]}
      </span>
      <button type="button" onClick={() => step(1)} style={buttonStyle} aria-label="Siguiente">
        →
      </button>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #555",
  borderRadius: 6,
  color: "#fff",
  cursor: "pointer",
  padding: "2px 8px",
};
