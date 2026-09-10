"use client";

/**
 * PROTOTYPE — Variant A, "El cuaderno": received Offers as ruled rows in one
 * ledger. A row opens in place; the decision sits at its foot; acceptance
 * turns the row into the exchanged contact. Nothing leaves the page.
 */

import { Badge } from "@repo/design-system/components/badge";
import { Button } from "@repo/design-system/components/button";
import { useState } from "react";
import { daysAgo, type MockOffer, type MockOfferState, OFFERS } from "../../_lib/mock";
import { ConfirmAccept, ExchangedContact, Term } from "./shared";

const STATE_LABEL: Record<MockOfferState, string> = {
  delivered: "Sin responder",
  accepted: "Acordada",
  rejected: "Rechazada",
};

export function Ledger() {
  const [states, setStates] = useState<Record<string, MockOfferState>>(
    Object.fromEntries(OFFERS.map((offer) => [offer.id, offer.state])),
  );
  const [open, setOpen] = useState<string | null>(OFFERS[0]?.id ?? null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const pending = OFFERS.filter((offer) => states[offer.id] === "delivered").length;

  function decide(offer: MockOffer, state: MockOfferState) {
    setStates((prev) => ({ ...prev, [offer.id]: state }));
    setConfirming(null);
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="page-heading">Propuestas que has recibido</h1>
        <p className="text-muted-foreground text-pretty">
          {pending === 0
            ? "No tienes propuestas sin responder."
            : `${pending} sin responder. Una persona leyó cada una antes de que te llegara.`}
        </p>
      </div>

      <ol className="ruled-page">
        {OFFERS.map((offer, index) => {
          const state = states[offer.id] ?? "delivered";
          const isOpen = open === offer.id;
          return (
            <li
              key={offer.id}
              className={`border-border flex flex-col gap-4 py-5 ${index > 0 ? "border-t" : ""}`}
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : offer.id)}
                aria-expanded={isOpen}
                className="flex w-full flex-col items-start gap-1 text-left"
              >
                <span className="flex w-full flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-heading text-xl leading-7 font-medium">
                    {offer.hirerName}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {daysAgo(offer.receivedDaysAgo)}
                  </span>
                </span>
                <span className="text-muted-foreground text-sm">{offer.hirerWhere}</span>
                {!isOpen ? (
                  <span className="mt-1 line-clamp-2 text-pretty">{offer.workDescription}</span>
                ) : null}
                <span className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge variant={state === "delivered" ? "default" : "secondary"}>
                    {STATE_LABEL[state]}
                  </Badge>
                  <span className="text-muted-foreground text-sm">{offer.payTerms}</span>
                </span>
              </button>

              {isOpen ? (
                <div className="flex flex-col gap-5">
                  <Term label="Qué">{offer.workDescription}</Term>
                  <Term label="Cuánto y cómo">{offer.payTerms}</Term>
                  <Term label="Cuándo">{offer.whenText}</Term>

                  {state === "delivered" && confirming !== offer.id ? (
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" onClick={() => setConfirming(offer.id)}>
                        Aceptar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => decide(offer, "rejected")}
                      >
                        Rechazar
                      </Button>
                      <Button type="button" variant="ghost">
                        Reportar
                      </Button>
                    </div>
                  ) : null}

                  {state === "delivered" && confirming === offer.id ? (
                    <ConfirmAccept
                      offer={offer}
                      onConfirm={() => decide(offer, "accepted")}
                      onCancel={() => setConfirming(null)}
                    />
                  ) : null}

                  {state === "accepted" ? <ExchangedContact offer={offer} /> : null}
                  {state === "rejected" ? (
                    <p className="text-muted-foreground text-sm">
                      Rechazaste esta propuesta. {offer.hirerName} lo sabe y no puede cambiarla.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </main>
  );
}
