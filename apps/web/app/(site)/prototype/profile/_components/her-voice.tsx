"use client";

/**
 * PROTOTYPE — Variant C, "Su voz": the page is built around what she wrote.
 * Her paragraph is set as a large quotation in the display italic, her work
 * history runs down the margin line as dated entries, and writing to her is
 * a letter-shaped card at the end addressed by her name. Bet: a Hirer decides
 * on her words, so the page should be mostly her words.
 */

import { Button } from "@repo/design-system/components/button";
import { WORKERS } from "../../_lib/mock";
import { Chips, Nameplate, OFFER_PROMISE } from "./shared";

const worker = WORKERS[2] ?? WORKERS[0]!;

export function HerVoice() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-10">
      <header className="flex flex-col gap-5">
        <Nameplate worker={worker} />
        <h1 className="font-heading text-foreground text-3xl leading-10 font-medium text-pretty">
          {worker.headline}
        </h1>
      </header>

      <blockquote className="border-margin flex flex-col gap-4 border-l-2 pl-5">
        {worker.about.split("\n\n").map((paragraph) => (
          <p
            key={paragraph}
            className="font-heading text-foreground text-xl leading-8 italic text-pretty"
          >
            {paragraph}
          </p>
        ))}
        <footer className="text-muted-foreground text-sm not-italic">— {worker.firstName}</footer>
      </blockquote>

      <section className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Dónde ha trabajado
        </h2>
        <ol className="flex flex-col gap-3">
          {worker.workHistory.map((line) => {
            const [place, when] = line.split(" — ");
            return (
              <li key={line} className="grid grid-cols-[6rem_1fr] gap-3">
                <span className="text-muted-foreground font-mono text-xs leading-6">
                  {when?.split(", ").at(-1)}
                </span>
                <span className="text-pretty">
                  {place}
                  {when ? (
                    <span className="text-muted-foreground"> · {when.split(", ")[0]}</span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Lo que sabe hacer
        </h2>
        <Chips worker={worker} />
      </section>

      <section className="border-border bg-muted flex flex-col gap-3 rounded-lg border p-5">
        <h2 className="font-heading text-2xl font-medium">Escríbele a {worker.firstName}</h2>
        <p className="text-muted-foreground text-sm text-pretty">
          {OFFER_PROMISE} Nadie la ha verificado y nadie te ha verificado a ti; lo decimos porque es
          verdad.
        </p>
        <div>
          <Button type="button" size="lg">
            Escribirle una propuesta
          </Button>
        </div>
      </section>
    </main>
  );
}
