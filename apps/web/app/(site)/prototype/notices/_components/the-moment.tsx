"use client";

/**
 * PROTOTYPE — Variant C, "En el momento": no standing block anywhere. Each
 * refusal is one sentence that appears exactly where it bites — "no money"
 * on the submit of an Offer, "nobody verified" on the accept confirmation,
 * "block only stops messages" on the block confirmation — and nowhere else.
 * Shown as the three moments side by side, because the idea *is* the
 * placement. Bet: a sentence read at the moment of decision is worth more
 * than a section read on arrival and forgotten.
 */

import { Button } from "@repo/design-system/components/button";
import { NOTICES } from "./shared";

const money = NOTICES[1]!;
const verification = NOTICES[0]!;
const block = NOTICES[2]!;

function Moment({
  title,
  who,
  children,
}: {
  readonly title: string;
  readonly who: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="border-border flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-muted-foreground font-mono text-xs">{who}</span>
        <h2 className="font-heading text-xl font-medium">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function TheMoment() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="page-heading">Tres momentos, tres frases</h1>
        <p className="text-muted-foreground max-w-prose text-pretty">
          Ningún bloque en el muro. Cada frase aparece una sola vez, en la pantalla donde la
          decisión se toma, y no se puede pasar sin leerla porque está pegada al botón.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Moment title="Al enviar una propuesta" who="Contratante">
          <div className="text-muted-foreground flex flex-col gap-2 text-sm">
            <p className="bg-muted rounded-md px-3 py-2">Qué: almuerzo para 12 el sábado…</p>
            <p className="bg-muted rounded-md px-3 py-2">Cuánto: $180.000, en efectivo</p>
          </div>
          <p className="text-sm text-pretty">
            <span className="font-medium">{money.heading}</span> {money.detail}
          </p>
          <Button type="button">Enviar tal como está</Button>
        </Moment>

        <Moment title="Al aceptar" who="Trabajadora">
          <p className="text-sm text-pretty">
            Patricia Londoño recibe tu nombre completo, tu teléfono y tu correo. No se puede
            deshacer.
          </p>
          <p className="text-sm text-pretty">
            <span className="font-medium">{verification.heading}</span> {verification.detail}
          </p>
          <Button type="button">Sí, aceptar y compartir mis datos</Button>
        </Moment>

        <Moment title="Al bloquear" who="Trabajadora">
          <p className="text-sm text-pretty">Restaurante Doña Rosa no podrá enviarte nada más.</p>
          <p className="text-sm text-pretty">
            <span className="font-medium">{block.heading}</span> {block.detail}
          </p>
          <Button type="button" variant="outline">
            Bloquear
          </Button>
        </Moment>
      </div>

      <p className="text-muted-foreground text-sm text-pretty">
        Lo que se pierde: una persona que solo mira el muro nunca lee ninguna de las tres. Lo que se
        gana: la que decide, la lee en el momento justo.
      </p>
    </main>
  );
}
