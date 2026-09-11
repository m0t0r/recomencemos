"use client";

/**
 * PROTOTYPE — Variant B, "Pestañas": three tabs, one per thing she does here —
 * her profile, her Offers, her account — with the Offers count on the tab so
 * the number is visible from any of them. Bet: a fixed three-tab bar is what
 * a phone user expects from an app, and the count on the tab is the only
 * notification the product will ever have.
 */

import { Button } from "@repo/design-system/components/button";
import { Switch } from "@repo/design-system/components/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/design-system/components/tabs";
import { useId, useState } from "react";
import { daysAgo, ME, ME_CONTACT, OFFERS } from "../../_lib/mock";
import { Card } from "./shared";

export function TabsPage() {
  const [paused, setPaused] = useState(false);
  const switchId = useId();
  const pending = OFFERS.filter((offer) => offer.state === "delivered");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="page-heading">Mi cuaderno</h1>
      <Tabs defaultValue="offers">
        <TabsList className="w-full">
          <TabsTrigger value="profile" className="grow">
            Perfil
          </TabsTrigger>
          <TabsTrigger value="offers" className="grow">
            Propuestas{" "}
            <span className="bg-primary text-primary-foreground ml-1 rounded-full px-1.5 text-xs">
              {pending.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="account" className="grow">
            Cuenta
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="flex flex-col gap-4 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground text-sm">
              {paused ? "En pausa desde hoy." : `Visible desde ${daysAgo(ME.publishedDaysAgo)}.`}
            </p>
            <label htmlFor={switchId} className="flex items-center gap-2 text-sm">
              <Switch id={switchId} checked={paused} onCheckedChange={setPaused} />
              Pausar
            </label>
          </div>
          <div className="ruled-page">
            <Card worker={ME} />
          </div>
          <div>
            <Button type="button" variant="outline">
              Editar
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="offers" className="flex flex-col gap-4 pt-4">
          <ol className="ruled-page divide-border divide-y">
            {pending.map((offer) => (
              <li key={offer.id} className="flex flex-col gap-1 py-4">
                <div className="flex justify-between gap-3">
                  <span className="font-heading text-lg font-medium">{offer.hirerName}</span>
                  <span className="text-muted-foreground text-sm">
                    {daysAgo(offer.receivedDaysAgo)}
                  </span>
                </div>
                <p className="text-muted-foreground line-clamp-2 text-sm">
                  {offer.workDescription}
                </p>
                <p className="text-sm">{offer.payTerms}</p>
                <div className="mt-1">
                  <Button type="button" size="sm">
                    Leer y responder
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        </TabsContent>

        <TabsContent value="account" className="flex flex-col gap-3 pt-4 text-sm">
          <p>
            Correo: <span className="text-muted-foreground">{ME_CONTACT.email}</span>
          </p>
          <p>
            Teléfono: <span className="text-muted-foreground">{ME_CONTACT.phone}</span> · solo lo
            recibe quien tú aceptes
          </p>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" size="sm">
              Cerrar sesión en todos lados
            </Button>
            <Button type="button" variant="ghost" size="sm">
              Eliminar mi cuenta
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </main>
  );
}
