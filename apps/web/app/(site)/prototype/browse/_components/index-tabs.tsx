"use client";

/**
 * PROTOTYPE — Variant B, "El índice": the notebook's index tabs. Skill groups
 * run down the left (across the top on a phone), each with its count; one tap
 * shows that page of the book. No search box at all — the bet is that eight
 * groups are faster to scan than a query is to type on a phone.
 */

import { useState } from "react";
import { SKILLS, WORKERS } from "../../_lib/mock";
import { WorkerRow } from "./shared";

const GROUPS = [...new Set(SKILLS.map((skill) => skill.group))];

function workersIn(group: string) {
  const slugs = new Set(SKILLS.filter((skill) => skill.group === group).map((skill) => skill.slug));
  return WORKERS.filter((worker) => worker.skillSlugs.some((slug) => slugs.has(slug))).toSorted(
    (a, b) => a.offersReceived - b.offersReceived,
  );
}

export function IndexTabs() {
  const [group, setGroup] = useState<string>("Todo");
  const people = group === "Todo" ? [...WORKERS] : workersIn(group);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:flex-row sm:gap-10">
      <nav aria-label="Índice" className="sm:w-52 sm:shrink-0">
        <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:flex-col sm:px-0">
          {["Todo", ...GROUPS].map((entry) => {
            const count = entry === "Todo" ? WORKERS.length : workersIn(entry).length;
            const on = entry === group;
            return (
              <li key={entry} className="shrink-0">
                <button
                  type="button"
                  aria-current={on ? "page" : undefined}
                  onClick={() => setGroup(entry)}
                  className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm ${
                    on ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                  }`}
                >
                  <span className="font-heading text-base">{entry}</span>
                  <span className={on ? "text-primary-foreground/80" : "text-muted-foreground"}>
                    {count}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <section className="flex min-w-0 grow flex-col gap-4" aria-live="polite">
        <div className="flex flex-col gap-1">
          <h1 className="page-heading">{group === "Todo" ? "Todas las personas" : group}</h1>
          <p className="text-muted-foreground text-sm">
            {people.length} {people.length === 1 ? "persona" : "personas"}, primero a quienes menos
            les han escrito.
          </p>
        </div>
        <div className="ruled-page divide-border divide-y">
          {people.map((worker) => (
            <WorkerRow key={worker.slug} worker={worker} />
          ))}
        </div>
      </section>
    </main>
  );
}
