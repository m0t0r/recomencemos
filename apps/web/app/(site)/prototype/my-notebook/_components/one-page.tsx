"use client";

/**
 * PROTOTYPE — Variant A, "Una página": her whole side of the platform on one
 * scroll. The state line and the Pause switch first, then the card as the
 * Wall shows it, then the Offers waiting, then the lines that closed. Bet: a
 * Worker opens this once a day from a phone and wants everything on one page.
 */

import { Button } from "@repo/design-system/components/button";
import { Switch } from "@repo/design-system/components/switch";
import { useId, useState } from "react";
import { daysAgo, ME, OFFERS } from "../../_lib/mock";
import { Card } from "./shared";

export function OnePage() {
  const [paused, setPaused] = useState(false);
  const switchId = useId();
  const pending = OFFERS.filter((offer) => offer.state === "delivered");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="page-heading">Mi perfil</h1>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground text-pretty">
            {paused
              ? "En pausa desde hoy. Nadie puede encontrarte ni escribirte; lo que ya te enviaron sigue llegando."
              : `Visible en el muro desde ${daysAgo(ME.publishedDaysAgo)}.`}
          </p>
          <label htmlFor={switchId} className="flex items-center gap-2 text-sm">
            <Switch id={switchId} checked={paused} onCheckedChange={setPaused} />
            Pausar mi perfil
          </label>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-2xl font-medium">Así te ven</h2>
        <div className="ruled-page">
          <Card worker={ME} />
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline">
            Editar
          </Button>
          <Button type="button" variant="ghost">
            Cambiar la foto
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-2xl font-medium">
          Propuestas <span className="text-muted-foreground">· {pending.length} sin responder</span>
        </h2>
        <ol className="ruled-page divide-border divide-y">
          {pending.map((offer) => (
            <li key={offer.id} className="flex flex-col gap-1 py-4">
              <div className="flex justify-between gap-3">
                <span className="font-heading text-lg font-medium">{offer.hirerName}</span>
                <span className="text-muted-foreground text-sm">
                  {daysAgo(offer.receivedDaysAgo)}
                </span>
              </div>
              <p className="text-muted-foreground line-clamp-1 text-sm">{offer.workDescription}</p>
              <p className="text-sm">{offer.payTerms}</p>
            </li>
          ))}
        </ol>
        <div>
          <Button type="button">Ver y responder</Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-2xl font-medium">Cerradas</h2>
        <p className="text-muted-foreground text-sm">
          Restaurante Doña Rosa · rechazada {daysAgo(9)}
        </p>
      </section>
    </main>
  );
}
