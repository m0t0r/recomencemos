"use client";

/**
 * PROTOTYPE — Variant A, "El espejo": the three fields as they are today, with
 * her side of the page rendered live beside them. He writes on the left and
 * watches what she will read on the right; on a phone the mirror sits under
 * the form. Bet: seeing the Offer in her shape is what makes a Hirer concrete.
 */

import { Button } from "@repo/design-system/components/button";
import { Input } from "@repo/design-system/components/input";
import { Textarea } from "@repo/design-system/components/textarea";
import { useState } from "react";
import { Labeled } from "../../_components/labeled";
import {
  AsSheReadsIt,
  EMPTY_OFFER,
  isConcrete,
  type OfferDraft,
  Sent,
  ToWhom,
  TWO_FACTS,
} from "./shared";

export function Mirror() {
  const [draft, setDraft] = useState<OfferDraft>(EMPTY_OFFER);
  const [from, setFrom] = useState("");
  const [sent, setSent] = useState(false);

  function patch(next: Partial<OfferDraft>) {
    setDraft((prev) => ({ ...prev, ...next }));
  }

  if (sent) return <Sent draft={draft} from={from} />;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-3">
        <h1 className="page-heading">Escribirle una propuesta</h1>
        <ToWhom />
        <ul className="text-muted-foreground flex list-disc flex-col gap-1 pl-5 text-sm">
          {TWO_FACTS.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (isConcrete(draft)) setSent(true);
          }}
        >
          <Labeled
            label="Qué necesitas que haga"
            hint="Dónde, para cuántas personas, qué incluye. Lo concreto es lo que ella puede aceptar."
            className="flex flex-col gap-1.5 font-medium"
          >
            {(id) => (
              <Textarea
                id={id}
                rows={5}
                value={draft.workDescription}
                onChange={(event) => patch({ workDescription: event.target.value })}
              />
            )}
          </Labeled>
          <Labeled label="Cuánto pagas y cómo" className="flex flex-col gap-1.5 font-medium">
            {(id) => (
              <Input
                id={id}
                value={draft.payTerms}
                placeholder="$180.000 por el día, en efectivo al terminar"
                onChange={(event) => patch({ payTerms: event.target.value })}
              />
            )}
          </Labeled>
          <Labeled label="Cuándo" className="flex flex-col gap-1.5 font-medium">
            {(id) => (
              <Input
                id={id}
                value={draft.whenText}
                placeholder="Sábado 19 de septiembre, de 8 a.m. a 3 p.m."
                onChange={(event) => patch({ whenText: event.target.value })}
              />
            )}
          </Labeled>
          <Labeled
            label="Tu nombre"
            hint="Como tú lo digas. Aquí nadie está verificado, y ella lo sabe."
            className="flex flex-col gap-1.5 font-medium"
          >
            {(id) => (
              <Input id={id} value={from} onChange={(event) => setFrom(event.target.value)} />
            )}
          </Labeled>
          <div>
            <Button type="submit" size="lg" disabled={!isConcrete(draft) || !from.trim()}>
              Enviar tal como está
            </Button>
          </div>
        </form>

        <aside className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">Así lo leerá {"Ana María"}:</p>
          <div className="border-border rounded-lg border p-5">
            <AsSheReadsIt draft={draft} from={from} />
          </div>
        </aside>
      </div>
    </main>
  );
}
