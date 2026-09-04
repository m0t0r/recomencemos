"use client";

/**
 * PROTOTYPE — links a Skill term to the people who hold it.
 *
 * Any `[data-term=<slug>]` inside this wrapper is a term; any `[data-skills="a b"]`
 * is a person. Hovering a term dims everyone without it; tapping pins it and
 * scrolls to the first person who holds it; tapping again unpins. One listener,
 * DOM state only. A `[data-status]` element receives the pinned label and the
 * number of people on this page who hold it, and a `[data-clear]` element
 * clears the pin.
 *
 * A term may be an `<a href="#profiles">`: without JavaScript the tap still
 * lands on the list, which is what keeps the page usable before hydration.
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
      let matches = 0;
      for (const el of root.querySelectorAll<HTMLElement>("[data-skills]")) {
        const has = active ? (el.dataset.skills ?? "").split(" ").includes(active) : false;
        if (has) matches += 1;
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
        status.textContent = label
          ? matches === 1
            ? `En esta página, 1 persona sabe: ${label}`
            : `En esta página, ${matches} personas saben: ${label}`
          : "";
      }
      const clear = root.querySelector<HTMLElement>("[data-clear]");
      if (clear) clear.hidden = !pinned;
      root.dataset.pinned = pinned ? "true" : "";
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
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-clear]")) {
        event.preventDefault();
        pinned = null;
        hovered = null;
        apply();
        return;
      }
      const term = termOf(event);
      if (!term) return;
      event.preventDefault();
      const slug = term.dataset.term ?? null;
      pinned = pinned === slug ? null : slug;
      hovered = null;
      apply();
      if (pinned) {
        const first =
          root.querySelector<HTMLElement>('[data-skills][data-state="match"]') ??
          document.getElementById("profiles");
        first?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
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
