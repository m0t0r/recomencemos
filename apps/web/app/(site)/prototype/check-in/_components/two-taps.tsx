"use client";

/**
 * PROTOTYPE — Variant A, "Dos toques": the page an emailed link lands on,
 * seven days after a Contact Exchange. Two questions, one tap each, and it
 * says plainly what the answer is for and what it cannot do. Bet: the check-in
 * is the product's only measurement, so it should cost less than ten seconds.
 */

import { Button } from "@repo/design-system/components/button";
import { useState } from "react";
import { OFFERS } from "../../_lib/mock";

const offer = OFFERS[0];

export function TwoTaps() {
  const [happened, setHappened] = useState<"yes" | "no" | null>(null);
  const [paid, setPaid] = useState<"yes" | "partly" | "no" | null>(null);

  const done: boolean = happened === "no" || (happened === "yes" && paid !== null);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-sm">
          Hace una semana aceptaste la propuesta de {offer?.hirerName}.
        </p>
        <h1 className="page-heading">Dos preguntas, y ya</h1>
      </div>

      {done ? (
        <section className="ruled-page gap-4">
          <p className="font-heading text-2xl leading-8 font-medium">Gracias.</p>
          <p className="text-pretty">
            {happened === "no"
              ? "Anotamos que el trabajo no se hizo. No te preguntamos por qué."
              : paid === "yes"
                ? "Anotamos que se hizo y te pagaron. Es lo único que medimos, y es lo que importa."
                : paid === "partly"
                  ? "Anotamos que se hizo y te pagaron una parte."
                  : "Anotamos que se hizo y no te han pagado."}
          </p>
          {happened === "yes" && paid !== "yes" ? (
            <p className="text-muted-foreground text-pretty">
              Lo decimos desde el principio y lo repetimos aquí: Recomencemos no maneja el dinero y
              no puede cobrarlo por ti. Si quieres que esta persona no vuelva a escribirte, puedes
              bloquearla desde tus propuestas.
            </p>
          ) : null}
        </section>
      ) : (
        <div className="flex flex-col gap-8">
          <fieldset className="flex flex-col gap-3">
            <legend className="font-heading mb-3 text-2xl leading-8 font-medium">
              ¿Se hizo el trabajo?
            </legend>
            <div className="flex gap-2">
              <Button
                type="button"
                size="lg"
                variant={happened === "yes" ? "default" : "outline"}
                aria-pressed={happened === "yes"}
                onClick={() => setHappened("yes")}
              >
                Sí
              </Button>
              <Button
                type="button"
                size="lg"
                variant={happened === "no" ? "default" : "outline"}
                aria-pressed={happened === "no"}
                onClick={() => setHappened("no")}
              >
                No
              </Button>
            </div>
          </fieldset>

          {happened === "yes" ? (
            <fieldset className="flex flex-col gap-3">
              <legend className="font-heading mb-3 text-2xl leading-8 font-medium">
                ¿Te pagaron lo acordado?
              </legend>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["yes", "Sí, completo"],
                    ["partly", "Una parte"],
                    ["no", "Todavía no"],
                  ] as const
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    size="lg"
                    variant="outline"
                    onClick={() => setPaid(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </fieldset>
          ) : null}

          <p className="text-muted-foreground text-sm text-pretty">
            Tu respuesta no se le muestra a nadie más y no califica a nadie. Sirve para saber si
            Recomencemos está haciendo lo único que promete.
          </p>
        </div>
      )}
    </main>
  );
}
