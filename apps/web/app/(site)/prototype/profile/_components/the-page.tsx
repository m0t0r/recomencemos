"use client";

/**
 * PROTOTYPE — Variant A, "La página": today's composition (nameplate, her
 * sentence, Skills, about, work history) with one change: the Offer control
 * is a bar that stays at the bottom of the screen while he reads, and only
 * opens into the form when tapped. Bet: the way to write to her should never
 * be below the fold, and never be a form hanging open under her words.
 */

import { Button } from "@repo/design-system/components/button";
import { useState } from "react";
import { WORKERS } from "../../_lib/mock";
import { Chips, Nameplate, OFFER_PROMISE } from "./shared";

const worker = WORKERS[2] ?? WORKERS[0]!;

export function ThePage() {
  const [open, setOpen] = useState(false);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <div className="ruled-page">
        <header className="flex flex-col gap-4 py-7 pt-0">
          <Nameplate worker={worker} />
          <h1 className="font-heading text-foreground text-2xl leading-8 font-medium text-pretty">
            {worker.headline}
          </h1>
          <Chips worker={worker} />
        </header>
        <section className="border-border flex flex-col gap-3 border-t py-7">
          <h2 className="font-heading text-xl leading-7 font-medium">Sobre {worker.firstName}</h2>
          <p className="whitespace-pre-line text-pretty">{worker.about}</p>
        </section>
        <section className="border-border flex flex-col gap-3 border-t py-7">
          <h2 className="font-heading text-xl leading-7 font-medium">Dónde ha trabajado</h2>
          <ul className="flex list-disc flex-col gap-2 pl-5">
            {worker.workHistory.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      </div>

      {open ? (
        <section className="border-primary flex flex-col gap-4 rounded-lg border p-4">
          <h2 className="font-heading text-xl font-medium">Escribirle una propuesta</h2>
          <p className="text-muted-foreground text-sm">{OFFER_PROMISE}</p>
          <textarea
            rows={4}
            placeholder="Qué necesitas que haga"
            className="border-input rounded-md border bg-transparent px-3 py-2"
          />
          <input
            placeholder="Cuánto pagas y cómo"
            className="border-input h-10 rounded-md border bg-transparent px-3"
          />
          <input
            placeholder="Cuándo"
            className="border-input h-10 rounded-md border bg-transparent px-3"
          />
          <div className="flex gap-2">
            <Button type="button">Enviar tal como está</Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
          </div>
        </section>
      ) : (
        <div className="bg-background border-border sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t px-4 py-3">
          <p className="text-muted-foreground text-sm text-pretty">{OFFER_PROMISE}</p>
          <Button type="button" size="lg" className="shrink-0" onClick={() => setOpen(true)}>
            Escribirle
          </Button>
        </div>
      )}
    </main>
  );
}
