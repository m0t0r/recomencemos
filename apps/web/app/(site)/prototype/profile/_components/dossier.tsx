"use client";

/**
 * PROTOTYPE — Variant B, "El dossier": her identity stays fixed at the top and
 * the rest is three tabs — who she is, where she has worked, and the Offer
 * form — so on a phone nothing is more than one scroll away and the form is
 * a place he goes to rather than something under her words. Bet: a Hirer
 * reads a profile in visits, not in one scroll.
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/design-system/components/tabs";
import { Button } from "@repo/design-system/components/button";
import { WORKERS } from "../../_lib/mock";
import { Chips, Nameplate, OFFER_PROMISE } from "./shared";

const worker = WORKERS[2] ?? WORKERS[0]!;

export function Dossier() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-4">
        <Nameplate worker={worker} />
        <h1 className="font-heading text-foreground text-2xl leading-8 font-medium text-pretty">
          {worker.headline}
        </h1>
        <Chips worker={worker} />
      </header>

      <Tabs defaultValue="who">
        <TabsList className="w-full">
          <TabsTrigger value="who" className="grow">
            Quién es
          </TabsTrigger>
          <TabsTrigger value="where" className="grow">
            Dónde ha trabajado
          </TabsTrigger>
          <TabsTrigger value="write" className="grow">
            Escribirle
          </TabsTrigger>
        </TabsList>
        <TabsContent value="who" className="pt-4">
          <p className="whitespace-pre-line text-pretty">{worker.about}</p>
        </TabsContent>
        <TabsContent value="where" className="pt-4">
          <ol className="ruled-page divide-border divide-y">
            {worker.workHistory.map((line) => (
              <li key={line} className="py-3">
                {line}
              </li>
            ))}
          </ol>
        </TabsContent>
        <TabsContent value="write" className="flex flex-col gap-4 pt-4">
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
          <div>
            <Button type="button">Enviar tal como está</Button>
          </div>
        </TabsContent>
      </Tabs>

      <p className="text-muted-foreground border-border border-t pt-4 text-sm text-pretty">
        Nadie aquí está verificado, ni ella ni tú. Recomencemos no maneja el dinero. Lo que acuerden
        es entre ustedes.
      </p>
    </main>
  );
}
