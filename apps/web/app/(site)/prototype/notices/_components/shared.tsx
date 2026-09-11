"use client";

/**
 * PROTOTYPE — the three refusals as copy, shared by the three notice variants,
 * and a mock Wall row for the surfaces they sit on. The wording here is the
 * lab's paraphrase; the binding strings live in `app/_lib/notices/messages.ts`.
 */

import { Avatar, AvatarFallback } from "@repo/design-system/components/avatar";
import { CITY_LABEL, displayName, initialOf, type MockWorker } from "../../_lib/mock";

export interface Notice {
  readonly key: "verification" | "money" | "block";
  readonly short: string;
  readonly heading: string;
  readonly lead: string;
  readonly detail: string;
}

export const NOTICES: readonly Notice[] = [
  {
    key: "verification",
    short: "Nadie está verificado",
    heading: "Nadie aquí está verificado.",
    lead: "Ni quien publica ni quien escribe.",
    detail:
      "No comprobamos que una persona perdió su ingreso ni que quien envía una propuesta es quien dice ser. El nombre y el teléfono de un Contratante son lo que él mismo escribió.",
  },
  {
    key: "money",
    short: "No manejamos dinero",
    heading: "Recomencemos no maneja el dinero.",
    lead: "El pago es entre ustedes.",
    detail:
      "No cobramos, no guardamos ni garantizamos ningún pago. Si no te pagan, no hay un reclamo que puedas hacer a través de nosotros.",
  },
  {
    key: "block",
    short: "Bloquear solo detiene mensajes",
    heading: "Bloquear a alguien detiene sus mensajes.",
    lead: "Nada más.",
    detail:
      "Tu tarjeta sigue en el muro y esa persona puede seguir leyendo perfiles. Lo que ya leyó, ya lo sabe.",
  },
];

export function Row({ worker }: { readonly worker: MockWorker }) {
  return (
    <article className="flex gap-4 py-5">
      <Avatar size="lg" className="shrink-0" aria-hidden="true">
        <AvatarFallback>{initialOf(worker.firstName)}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="font-heading text-2xl leading-7 font-medium text-pretty">{worker.headline}</p>
        <p className="text-muted-foreground text-sm">
          {displayName(worker)} · {CITY_LABEL[worker.city]}
        </p>
      </div>
    </article>
  );
}
