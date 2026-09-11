"use client";

/**
 * PROTOTYPE — Variant B, "Una a la vez": the queue as a deck. The oldest item
 * fills the screen with everything the decision needs, two buttons, and the
 * count of what is left. No list to scan. Bet: moderation is a sequence of
 * single decisions, and a list invites cherry-picking the easy ones while
 * the oldest item ages.
 */

import { Button } from "@repo/design-system/components/button";
import { useMemo } from "react";
import { decisionsFor, formatAge, SOURCE_LABEL, useQueue, useQueueKeys } from "./shared";

export function TheDeck() {
  const { open, oldest, decide, done } = useQueue();
  const current = open[0];

  const handlers = useMemo(
    () => ({
      next: () => {},
      prev: () => {},
      decide: (key: "a" | "r") => {
        if (!current) return;
        const option = decisionsFor(current.source).find((d) => d.key === key);
        if (option) decide(current.id, option.value);
      },
    }),
    [current, decide],
  );
  useQueueKeys(handlers);

  if (!current) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-16">
        <h1 className="page-heading">Cola vacía</h1>
        <p className="text-muted-foreground">
          Lo más viejo lleva 0 h. {Object.keys(done).length} resueltos hoy.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3 font-mono text-xs">
        <span className="text-muted-foreground">
          {open.length} por revisar · lo más viejo lleva{" "}
          <span className={oldest > 24 ? "text-warning" : ""}>{formatAge(oldest)}</span>
        </span>
        <span className="text-muted-foreground">a / r</span>
      </div>

      <article className="ruled-page gap-5">
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground font-mono text-xs">
            {SOURCE_LABEL[current.source]} · {formatAge(current.ageHours)}
          </span>
          <h1 className="font-heading text-2xl leading-8 font-medium text-pretty">
            {current.title}
          </h1>
        </div>
        <p className="text-lg leading-7 text-pretty">{current.body}</p>
        <p className="text-muted-foreground text-sm">{current.meta}</p>
      </article>

      <div className="flex flex-wrap gap-2">
        {decisionsFor(current.source).map((option) => (
          <Button
            key={option.value}
            type="button"
            size="lg"
            variant={option.key === "a" ? "default" : "outline"}
            onClick={() => decide(current.id, option.value)}
          >
            {option.label} <kbd className="ml-1 font-mono text-xs opacity-70">{option.key}</kbd>
          </Button>
        ))}
      </div>

      <ol className="text-muted-foreground border-border flex flex-col gap-1 border-t pt-4 font-mono text-xs">
        {open.slice(1, 4).map((item) => (
          <li key={item.id}>
            luego: {SOURCE_LABEL[item.source]} · {item.title} · {formatAge(item.ageHours)}
          </li>
        ))}
      </ol>
    </main>
  );
}
