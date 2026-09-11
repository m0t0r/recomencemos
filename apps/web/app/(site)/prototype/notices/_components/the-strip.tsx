"use client";

/**
 * PROTOTYPE — Variant B, "La franja": one line under the header on every page,
 * three short clauses, each a control that opens its detail in place. Costs
 * one line of scroll instead of three disclosures, and is the same line
 * everywhere, so a person who has read it once recognises it. Bet: the three
 * refusals are a stamp on the notebook's cover, not a section on each page.
 */

import { useState } from "react";
import { WORKERS } from "../../_lib/mock";
import { NOTICES, type Notice, Row } from "./shared";

export function TheStrip() {
  const [open, setOpen] = useState<Notice["key"] | null>(null);
  const current = NOTICES.find((notice) => notice.key === open);

  return (
    <>
      <div className="bg-muted border-border border-b">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-2">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {NOTICES.map((notice) => (
              <li key={notice.key}>
                <button
                  type="button"
                  aria-expanded={open === notice.key}
                  onClick={() => setOpen(open === notice.key ? null : notice.key)}
                  className={`underline-offset-4 hover:underline ${
                    open === notice.key ? "text-primary underline" : "text-foreground"
                  }`}
                >
                  {notice.short}
                </button>
              </li>
            ))}
          </ul>
          {current ? (
            <p className="text-muted-foreground max-w-prose text-sm text-pretty">
              <span className="text-foreground font-medium">{current.heading}</span>{" "}
              {current.detail}
            </p>
          ) : null}
        </div>
      </div>
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
        <h1 className="page-heading">Publicaron esta semana</h1>
        <div className="ruled-page divide-border divide-y">
          {WORKERS.slice(0, 4).map((worker) => (
            <Row key={worker.slug} worker={worker} />
          ))}
        </div>
      </main>
    </>
  );
}
