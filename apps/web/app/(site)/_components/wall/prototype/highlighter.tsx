"use client";

/**
 * PROTOTYPE — links a Skill term to the people who hold it.
 *
 * Any `[data-term=<slug>]` inside this wrapper is a term; any `[data-skills="a b"]`
 * is a person. Hovering a term dims everyone without it; clicking pins it (and
 * scrolls to the list); clicking again unpins. One listener, DOM state only.
 */

import { type ReactNode, useEffect, useRef } from "react";

export function Highlighter({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    let pinned: string | null = null;
    let hovered: string | null = null;

    const apply = () => {
      const active = hovered ?? pinned;
      for (const el of root.querySelectorAll<HTMLElement>("[data-skills]")) {
        const has = active ? (el.dataset.skills ?? "").split(" ").includes(active) : false;
        el.dataset.state = active ? (has ? "match" : "dim") : "";
      }
      for (const el of root.querySelectorAll<HTMLElement>("[data-term]")) {
        el.dataset.state =
          el.dataset.term === pinned ? "pinned" : el.dataset.term === active ? "active" : "";
      }
      const status = root.querySelector<HTMLElement>("[data-status]");
      if (status) {
        const label = active
          ? root.querySelector<HTMLElement>(`[data-term="${active}"]`)?.dataset.label
          : undefined;
        status.textContent = label ? `Personas que saben: ${label}` : "";
      }
    };

    const termOf = (event: Event) =>
      (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-term]") ?? null;

    const onOver = (event: Event) => {
      const term = termOf(event);
      if (!term) return;
      hovered = term.dataset.term ?? null;
      apply();
    };
    const onOut = (event: Event) => {
      if (!termOf(event)) return;
      hovered = null;
      apply();
    };
    const onClick = (event: Event) => {
      const term = termOf(event);
      if (!term) return;
      event.preventDefault();
      const slug = term.dataset.term ?? null;
      pinned = pinned === slug ? null : slug;
      hovered = null;
      apply();
      if (pinned) document.getElementById("profiles")?.scrollIntoView({ behavior: "smooth" });
    };

    root.addEventListener("mouseover", onOver);
    root.addEventListener("mouseout", onOut);
    root.addEventListener("focusin", onOver);
    root.addEventListener("focusout", onOut);
    root.addEventListener("click", onClick);
    return () => {
      root.removeEventListener("mouseover", onOver);
      root.removeEventListener("mouseout", onOut);
      root.removeEventListener("focusin", onOver);
      root.removeEventListener("focusout", onOut);
      root.removeEventListener("click", onClick);
    };
  }, []);

  return <div ref={ref}>{children}</div>;
}
