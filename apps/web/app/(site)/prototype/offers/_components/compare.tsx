"use client";

/**
 * PROTOTYPE — Variant C, "Lado a lado": the unanswered Offers as columns with
 * the three terms aligned in rows, so she decides *between* them rather than
 * one at a time. On a phone the columns scroll and snap sideways. She can mark
 * several as interesting; accepting one leaves the others open, and the page
 * says so — the platform decides nothing on her behalf.
 */

import { Button } from "@repo/design-system/components/button";
import { useState } from "react";
import { daysAgo, type MockOffer, type MockOfferState, OFFERS } from "../../_lib/mock";
import { ConfirmAccept, ExchangedContact } from "./shared";

export function Compare() {
  const [states, setStates] = useState<Record<string, MockOfferState>>(
    Object.fromEntries(OFFERS.map((offer) => [offer.id, offer.state])),
  );
  const [interested, setInterested] = useState<ReadonlySet<string>>(new Set());
  const [confirming, setConfirming] = useState<MockOffer | null>(null);
  const [exchanged, setExchanged] = useState<readonly MockOffer[]>([]);

  const open = OFFERS.filter((offer) => states[offer.id] === "delivered");

  function toggle(id: string) {
    setInterested((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function accept(offer: MockOffer) {
    setStates((prev) => ({ ...prev, [offer.id]: "accepted" }));
    setExchanged((prev) => [...prev, offer]);
    setConfirming(null);
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="page-heading">Tus propuestas, una al lado de la otra</h1>
        <p className="text-muted-foreground max-w-prose text-pretty">
          Puedes aceptar más de una. Aceptar una no rechaza las otras: cada persona sigue esperando
          tu respuesta hasta que se la des.
        </p>
      </div>

      {exchanged.map((offer) => (
        <section key={offer.id} className="border-primary rounded-lg border p-4">
          <ExchangedContact offer={offer} />
        </section>
      ))}

      {confirming ? (
        <ConfirmAccept
          offer={confirming}
          onConfirm={() => accept(confirming)}
          onCancel={() => setConfirming(null)}
        />
      ) : null}

      {open.length === 0 ? (
        <p className="text-muted-foreground">No tienes propuestas sin responder.</p>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4">
          <div
            className="grid snap-x snap-mandatory gap-4"
            style={{ gridTemplateColumns: `repeat(${open.length}, minmax(280px, 1fr))` }}
          >
            {open.map((offer) => {
              const marked = interested.has(offer.id);
              return (
                <article
                  key={offer.id}
                  className={`flex snap-start flex-col gap-4 rounded-lg border p-4 ${
                    marked ? "border-primary bg-secondary" : "border-border"
                  }`}
                >
                  <header className="flex flex-col gap-0.5">
                    <h2 className="font-heading text-xl leading-7 font-medium">
                      {offer.hirerName}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                      {offer.hirerWhere} · {daysAgo(offer.receivedDaysAgo)}
                    </p>
                  </header>

                  <Row label="Qué">{offer.workDescription}</Row>
                  <Row label="Cuánto y cómo">
                    <span className="font-heading text-lg">{offer.payTerms}</span>
                  </Row>
                  <Row label="Cuándo">{offer.whenText}</Row>

                  <div className="mt-auto flex flex-col gap-2 pt-2">
                    <Button
                      type="button"
                      variant={marked ? "secondary" : "outline"}
                      aria-pressed={marked}
                      onClick={() => toggle(offer.id)}
                    >
                      {marked ? "Me interesa ✓" : "Me interesa"}
                    </Button>
                    <div className="flex gap-2">
                      <Button type="button" className="grow" onClick={() => setConfirming(offer)}>
                        Aceptar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setStates((prev) => ({ ...prev, [offer.id]: "rejected" }))}
                      >
                        Rechazar
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}

function Row({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  return (
    <div className="border-border flex flex-col gap-1 border-t pt-3">
      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </span>
      <p className="text-pretty">{children}</p>
    </div>
  );
}
