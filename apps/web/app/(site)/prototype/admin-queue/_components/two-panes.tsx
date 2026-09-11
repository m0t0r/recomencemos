"use client";

/**
 * PROTOTYPE — Variant C, "Dos paneles": the list on the left grouped by
 * source with counts, the selected item on the right with its decision. On a
 * phone the list comes first and the detail under it. Bet: the operator
 * wants to see the shape of the day (how many of what) *and* one item at a
 * time, and neither a flat table nor a deck gives both.
 */

import { Button } from "@repo/design-system/components/button";
import { useMemo, useState } from "react";
import {
  decisionsFor,
  formatAge,
  type Source,
  SOURCE_LABEL,
  useQueue,
  useQueueKeys,
} from "./shared";

const ORDER: readonly Source[] = ["report", "offer", "photo", "skill", "bounce"];

export function TwoPanes() {
  const { open, oldest, decide } = useQueue();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const current = open.find((item) => item.id === selectedId) ?? open[0];

  const handlers = useMemo(
    () => ({
      next: () => {
        const index = open.findIndex((item) => item.id === current?.id);
        setSelectedId(open[Math.min(index + 1, open.length - 1)]?.id ?? null);
      },
      prev: () => {
        const index = open.findIndex((item) => item.id === current?.id);
        setSelectedId(open[Math.max(index - 1, 0)]?.id ?? null);
      },
      decide: (key: "a" | "r") => {
        if (!current) return;
        const option = decisionsFor(current.source).find((d) => d.key === key);
        if (option) decide(current.id, option.value);
      },
    }),
    [open, current, decide],
  );
  useQueueKeys(handlers);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="page-heading">Cola del día</h1>
        <p className="font-mono text-sm">
          <span className="text-muted-foreground">lo más viejo lleva</span>{" "}
          <span className={oldest > 24 ? "text-warning font-medium" : "font-medium"}>
            {formatAge(oldest)}
          </span>
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[20rem_1fr]">
        <nav aria-label="Cola" className="flex flex-col gap-4">
          {ORDER.map((source) => {
            const items = open.filter((item) => item.source === source);
            return (
              <section key={source} className="flex flex-col gap-1">
                <h2 className="text-muted-foreground flex justify-between font-mono text-xs">
                  <span>{SOURCE_LABEL[source]}</span>
                  <span>{items.length}</span>
                </h2>
                {items.length === 0 ? (
                  <p className="text-muted-foreground text-xs">—</p>
                ) : (
                  <ul className="flex flex-col">
                    {items.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(item.id)}
                          aria-current={item.id === current?.id ? "true" : undefined}
                          className={`flex w-full items-baseline justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                            item.id === current?.id
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-secondary"
                          }`}
                        >
                          <span className="line-clamp-1">{item.title}</span>
                          <span className="shrink-0 font-mono text-xs opacity-80">
                            {formatAge(item.ageHours)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </nav>

        {current ? (
          <article className="ruled-page gap-5" aria-live="polite">
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground font-mono text-xs">
                {SOURCE_LABEL[current.source]} · {formatAge(current.ageHours)}
              </span>
              <h2 className="font-heading text-2xl leading-8 font-medium text-pretty">
                {current.title}
              </h2>
            </div>
            <p className="text-lg leading-7 text-pretty">{current.body}</p>
            <p className="text-muted-foreground text-sm">{current.meta}</p>
            <div className="flex flex-wrap gap-2">
              {decisionsFor(current.source).map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={option.key === "a" ? "default" : "outline"}
                  onClick={() => decide(current.id, option.value)}
                >
                  {option.label}{" "}
                  <kbd className="ml-1 font-mono text-xs opacity-70">{option.key}</kbd>
                </Button>
              ))}
            </div>
          </article>
        ) : (
          <p className="font-heading text-2xl">Cola vacía. Lo más viejo lleva 0 h.</p>
        )}
      </div>
    </main>
  );
}
