"use client";

/**
 * PROTOTYPE — Variant B, "La última línea": the check-in is not a page of its
 * own. On her own profile page, each accepted Offer is a row in the ledger,
 * and seven days on the row asks for its closing line. Bet: a question asked
 * where the record already lives is answered more often than one that arrives
 * in an inbox.
 */

import { useState } from "react";
import { daysAgo, ME, OFFERS } from "../../_lib/mock";

type Close = "paid" | "unpaid" | "not-done";

const CLOSES: readonly { value: Close; label: string }[] = [
  { value: "paid", label: "Se hizo y me pagaron" },
  { value: "unpaid", label: "Se hizo y no me han pagado" },
  { value: "not-done", label: "No se hizo" },
];

const accepted = [OFFERS[0], OFFERS[2]];

export function LastLine() {
  const [closes, setCloses] = useState<Record<string, Close>>({});

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="page-heading">Mi perfil</h1>
        <p className="text-muted-foreground">{ME.headline}</p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-2xl font-medium">Propuestas acordadas</h2>
        <ol className="ruled-page divide-border divide-y">
          {accepted.map((offer, index) =>
            offer ? (
              <li key={offer.id} className="flex flex-col gap-3 py-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-heading text-xl font-medium">{offer.hirerName}</span>
                  <span className="text-muted-foreground text-sm">
                    acordada {daysAgo(index === 0 ? 7 : 9)}
                  </span>
                </div>
                <p className="text-muted-foreground text-sm">
                  {offer.payTerms} · {offer.whenText}
                </p>

                {closes[offer.id] ? (
                  <p className="font-heading text-primary text-lg">
                    ✓ {CLOSES.find((close) => close.value === closes[offer.id])?.label}
                  </p>
                ) : (
                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-2 text-sm font-medium">
                      Ya pasó una semana. ¿Cómo cierra esta línea?
                    </legend>
                    <div className="flex flex-wrap gap-1.5">
                      {CLOSES.map((close) => (
                        <label
                          key={close.value}
                          className="border-border hover:bg-secondary cursor-pointer rounded-md border px-3 py-1.5 text-sm"
                        >
                          <input
                            type="radio"
                            name={`close-${offer.id}`}
                            className="sr-only"
                            onChange={() =>
                              setCloses((prev) => ({ ...prev, [offer.id]: close.value }))
                            }
                          />
                          {close.label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}
              </li>
            ) : null,
          )}
        </ol>
        <p className="text-muted-foreground text-sm text-pretty">
          La misma pregunta le llega a la otra persona. Nadie ve la respuesta del otro y no califica
          a nadie: es la única medida de si esto sirve.
        </p>
      </section>
    </main>
  );
}
