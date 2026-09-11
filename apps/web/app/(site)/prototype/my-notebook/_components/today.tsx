"use client";

/**
 * PROTOTYPE — Variant C, "Hoy": the page a notebook opens to. Only what is new
 * since she last looked — new Offers, a photo approved, a line waiting to be
 * closed — each with one action, and nothing else. Her profile is a link.
 * Bet: the product's own principle (introduce, then leave) applied to her own
 * page: it should take ten seconds to know whether anything needs her.
 */

import { Button } from "@repo/design-system/components/button";
import Link from "next/link";
import { useState } from "react";
import { daysAgo, ME, OFFERS } from "../../_lib/mock";

interface Entry {
  readonly id: string;
  readonly when: string;
  readonly text: string;
  readonly action: string;
}

const TODAY: readonly Entry[] = [
  {
    id: "of-1",
    when: daysAgo(0),
    text: "Patricia Londoño te envió una propuesta: $180.000 por el día, el sábado.",
    action: "Leerla",
  },
  {
    id: "photo",
    when: daysAgo(0),
    text: "Tu foto ya se ve en el muro.",
    action: "Ver mi tarjeta",
  },
  {
    id: "of-2",
    when: daysAgo(1),
    text: "Fundación Café y Vida te envió una propuesta: $1.400.000 al mes por dos meses.",
    action: "Leerla",
  },
  {
    id: "close",
    when: daysAgo(7),
    text: "Hace una semana aceptaste la propuesta de Miguel Restrepo. ¿Se hizo y te pagaron?",
    action: "Responder",
  },
];

export function Today() {
  const [seen, setSeen] = useState<ReadonlySet<string>>(new Set());
  const open = TODAY.filter((entry) => !seen.has(entry.id));
  const pending = OFFERS.filter((offer) => offer.state === "delivered").length;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground font-mono text-xs">jueves 10 de septiembre</p>
        <h1 className="page-heading">Hola, {ME.firstName}</h1>
        <p className="text-muted-foreground text-pretty">
          {open.length === 0
            ? "Nada nuevo. Tu perfil sigue visible."
            : `${open.length} ${open.length === 1 ? "cosa" : "cosas"} desde la última vez.`}
        </p>
      </div>

      <ol className="ruled-page divide-border divide-y">
        {open.map((entry) => (
          <li key={entry.id} className="flex flex-col gap-2 py-4">
            <span className="text-muted-foreground text-xs">{entry.when}</span>
            <p className="font-heading text-xl leading-7 text-pretty">{entry.text}</p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => setSeen((prev) => new Set([...prev, entry.id]))}
              >
                {entry.action}
              </Button>
            </div>
          </li>
        ))}
      </ol>

      <nav className="text-muted-foreground border-border flex flex-wrap gap-x-5 gap-y-2 border-t pt-4 text-sm">
        <Link href="/prototype/my-notebook?variant=A" className="underline underline-offset-4">
          Mi tarjeta
        </Link>
        <Link href="/prototype/my-notebook?variant=A" className="underline underline-offset-4">
          Todas las propuestas ({pending})
        </Link>
        <Link href="/prototype/my-notebook?variant=A" className="underline underline-offset-4">
          Pausar mi perfil
        </Link>
        <Link href="/prototype/my-notebook?variant=A" className="underline underline-offset-4">
          Cuenta
        </Link>
      </nav>
    </main>
  );
}
