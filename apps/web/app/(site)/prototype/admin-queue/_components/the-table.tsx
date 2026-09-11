"use client";

/**
 * PROTOTYPE — Variant A, "La tabla": every source in one dense list, oldest
 * first, the age of the oldest item as the page's one number. A row expands
 * on focus; `j`/`k` move, `a`/`r` decide. Bet: an unpaid operator wants the
 * whole day on one screen and a keyboard, not five sections to visit.
 */

import { Button } from "@repo/design-system/components/button";
import { useCallback, useMemo, useState } from "react";
import { decisionsFor, formatAge, SOURCE_LABEL, useQueue, useQueueKeys } from "./shared";

export function TheTable() {
  const { open, oldest, decide, done } = useQueue();
  const [cursor, setCursor] = useState(0);
  const current = open[Math.min(cursor, Math.max(open.length - 1, 0))];

  const handlers = useMemo(
    () => ({
      next: () => setCursor((c) => Math.min(c + 1, open.length - 1)),
      prev: () => setCursor((c) => Math.max(c - 1, 0)),
      decide: (key: "a" | "r") => {
        if (!current) return;
        const option = decisionsFor(current.source).find((d) => d.key === key);
        if (option) decide(current.id, option.value);
      },
    }),
    [open.length, current, decide],
  );
  useQueueKeys(handlers);
  const select = useCallback((index: number) => setCursor(index), []);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="page-heading">Cola del día</h1>
        <p className="font-mono text-sm">
          <span className="text-muted-foreground">lo más viejo lleva</span>{" "}
          <span className={oldest > 24 ? "text-warning font-medium" : "font-medium"}>
            {formatAge(oldest)}
          </span>
          <span className="text-muted-foreground"> · {open.length} por revisar</span>
        </p>
      </div>
      <p className="text-muted-foreground font-mono text-xs">
        j / k para moverte · a / r para decidir · {Object.keys(done).length} resueltos hoy
      </p>

      <ol className="ruled-page divide-border divide-y">
        {open.map((item, index) => {
          const selected = index === cursor;
          return (
            <li key={item.id} className={selected ? "bg-secondary -mx-3 rounded-md px-3" : ""}>
              <button
                type="button"
                onClick={() => select(index)}
                aria-current={selected ? "true" : undefined}
                className="grid w-full grid-cols-[6rem_1fr_4rem] items-baseline gap-3 py-3 text-left text-sm"
              >
                <span className="text-muted-foreground font-mono text-xs">
                  {SOURCE_LABEL[item.source]}
                </span>
                <span className="font-medium">{item.title}</span>
                <span
                  className={`text-right font-mono text-xs ${item.ageHours > 24 ? "text-warning" : "text-muted-foreground"}`}
                >
                  {formatAge(item.ageHours)}
                </span>
              </button>
              {selected ? (
                <div className="flex flex-col gap-3 pb-4">
                  <p className="text-pretty">{item.body}</p>
                  <p className="text-muted-foreground text-xs">{item.meta}</p>
                  <div className="flex flex-wrap gap-2">
                    {decisionsFor(item.source).map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        size="sm"
                        variant={option.key === "a" ? "default" : "outline"}
                        onClick={() => decide(item.id, option.value)}
                      >
                        {option.label}{" "}
                        <kbd className="ml-1 font-mono text-xs opacity-70">{option.key}</kbd>
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
        {open.length === 0 ? (
          <li className="py-6">
            <p className="font-heading text-2xl">Cola vacía. Lo más viejo lleva 0 h.</p>
          </li>
        ) : null}
      </ol>
    </main>
  );
}
