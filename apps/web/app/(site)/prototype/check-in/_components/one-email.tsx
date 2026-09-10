"use client";

/**
 * PROTOTYPE — Variant C, "Un correo": there is no page at all. The check-in
 * is one email with three links; each link *is* the answer, and tapping it
 * lands on a page that only says thank you. Rendered here as the email would
 * look in a phone's mail app. Bet: the answer should not require signing in,
 * loading the site or reading anything twice.
 */

import { useState } from "react";
import { OFFERS } from "../../_lib/mock";

const offer = OFFERS[0];

const ANSWERS = [
  { key: "paid", label: "Se hizo y me pagaron" },
  { key: "unpaid", label: "Se hizo y no me han pagado" },
  { key: "not-done", label: "No se hizo" },
] as const;

export function OneEmail() {
  const [answer, setAnswer] = useState<string | null>(null);

  if (answer) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-16">
        <p className="font-heading text-3xl leading-9 font-medium">Gracias. Eso era todo.</p>
        <p className="text-muted-foreground text-pretty">
          {ANSWERS.find((entry) => entry.key === answer)?.label}. No hay nada más que hacer aquí, y
          esta página no se guarda en ninguna parte visible.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-10">
      <p className="text-muted-foreground font-mono text-xs">
        Así se ve en el correo, en el teléfono:
      </p>
      <div className="border-border bg-background rounded-lg border shadow-sm">
        <div className="border-border flex flex-col gap-1 border-b px-4 py-3 text-sm">
          <div className="flex justify-between">
            <span className="font-medium">Recomencemos</span>
            <span className="text-muted-foreground">hoy 9:00</span>
          </div>
          <span className="text-muted-foreground">Para: Ana María</span>
          <span className="font-medium">¿Cómo te fue con {offer?.hirerName.split(" ")[0]}?</span>
        </div>
        <div className="flex flex-col gap-4 px-4 py-5">
          <p className="text-pretty">
            Hola, Ana María. Hace una semana aceptaste la propuesta de {offer?.hirerName} (
            {offer?.payTerms}). Una sola pregunta, y la respuesta es tocar un enlace:
          </p>
          <ol className="flex flex-col gap-2">
            {ANSWERS.map((entry) => (
              <li key={entry.key}>
                <a
                  href={`#${entry.key}`}
                  onClick={(event) => {
                    event.preventDefault();
                    setAnswer(entry.key);
                  }}
                  className="text-primary block rounded-md border border-current px-4 py-3 text-center font-medium underline-offset-4 hover:underline"
                >
                  {entry.label}
                </a>
              </li>
            ))}
          </ol>
          <p className="text-muted-foreground text-sm text-pretty">
            Nadie ve tu respuesta. No califica a nadie. Es lo único que medimos para saber si
            Recomencemos sirve. Si no respondes, no volvemos a preguntar.
          </p>
        </div>
      </div>
    </main>
  );
}
