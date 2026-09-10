"use client";

/**
 * PROTOTYPE — Variant B, "Una a la vez": each Offer is a letter that fills the
 * screen, oldest unanswered first. Three terms in large type, one decision at
 * the foot, and the next letter after it. The confirmation is inline, never a
 * modal, so the terms she is accepting stay on screen while she reads what
 * crosses.
 */

import { Button } from "@repo/design-system/components/button";
import { useState } from "react";
import { daysAgo, type MockOffer, type MockOfferState, OFFERS } from "../../_lib/mock";
import { ConfirmAccept, ExchangedContact, Term } from "./shared";

export function Letters() {
  const [states, setStates] = useState<Record<string, MockOfferState>>(
    Object.fromEntries(OFFERS.map((offer) => [offer.id, offer.state])),
  );
  const [cursor, setCursor] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [lastAccepted, setLastAccepted] = useState<MockOffer | null>(null);

  const queue = OFFERS.filter((offer) => states[offer.id] === "delivered").toSorted(
    (a, b) => b.receivedDaysAgo - a.receivedDaysAgo,
  );
  const answered = OFFERS.filter((offer) => states[offer.id] !== "delivered");
  const current = queue[Math.min(cursor, Math.max(queue.length - 1, 0))];

  function decide(offer: MockOffer, state: MockOfferState) {
    setStates((prev) => ({ ...prev, [offer.id]: state }));
    setConfirming(false);
    setLastAccepted(state === "accepted" ? offer : null);
    setCursor(0);
  }

  if (lastAccepted) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
        <ExchangedContact offer={lastAccepted} />
        <div>
          <Button type="button" variant="outline" onClick={() => setLastAccepted(null)}>
            {queue.length > 0
              ? `Ver la siguiente (${queue.length} sin responder)`
              : "Volver a mis propuestas"}
          </Button>
        </div>
      </main>
    );
  }

  if (!current) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
        <h1 className="page-heading">No tienes propuestas sin responder</h1>
        <p className="text-muted-foreground text-pretty">
          Cuando alguien te escriba, una persona la lee primero y después te avisamos por correo.
        </p>
        <Answered answered={answered} states={states} />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="page-heading">Propuesta</h1>
        <p className="text-muted-foreground text-sm">
          {cursor + 1} de {queue.length} sin responder
        </p>
      </div>

      <article className="ruled-page gap-6">
        <header className="flex flex-col gap-1">
          <p className="text-muted-foreground text-sm">
            De {current.hirerName} · {current.hirerWhere} · llegó {daysAgo(current.receivedDaysAgo)}
          </p>
          <p className="text-muted-foreground text-sm text-pretty">
            Una persona la leyó antes de mostrártela. Lo que dice no se puede cambiar.
          </p>
        </header>

        <Term label="Qué" large>
          {current.workDescription}
        </Term>
        <Term label="Cuánto y cómo" large>
          {current.payTerms}
        </Term>
        <Term label="Cuándo" large>
          {current.whenText}
        </Term>
      </article>

      {confirming ? (
        <ConfirmAccept
          offer={current}
          onConfirm={() => decide(current, "accepted")}
          onCancel={() => setConfirming(false)}
        />
      ) : (
        <div className="bg-background border-border sticky bottom-0 -mx-4 flex flex-wrap gap-2 border-t px-4 py-3">
          <Button type="button" size="lg" onClick={() => setConfirming(true)}>
            Aceptar
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={() => decide(current, "rejected")}
          >
            No, gracias
          </Button>
          {queue.length > 1 ? (
            <Button
              type="button"
              size="lg"
              variant="ghost"
              onClick={() => setCursor((cursor + 1) % queue.length)}
            >
              Ver la siguiente
            </Button>
          ) : null}
        </div>
      )}

      <Answered answered={answered} states={states} />
    </main>
  );
}

function Answered({
  answered,
  states,
}: {
  readonly answered: readonly MockOffer[];
  readonly states: Record<string, MockOfferState>;
}) {
  if (answered.length === 0) return null;
  return (
    <section className="border-border flex flex-col gap-2 border-t pt-6">
      <h2 className="text-muted-foreground text-sm font-medium">Ya respondidas</h2>
      <ul className="flex flex-col gap-1 text-sm">
        {answered.map((offer) => (
          <li key={offer.id} className="flex justify-between gap-4">
            <span>{offer.hirerName}</span>
            <span className="text-muted-foreground">
              {states[offer.id] === "accepted" ? "acordada" : "rechazada"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
