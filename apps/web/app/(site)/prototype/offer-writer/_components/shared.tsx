"use client";

/**
 * PROTOTYPE — what the three Offer-writing variants share: the Worker being
 * written to, the "as she will read it" rendering, and the sent state.
 */

import { Avatar, AvatarFallback } from "@repo/design-system/components/avatar";
import { Button } from "@repo/design-system/components/button";
import { CITY_LABEL, displayName, initialOf, ME } from "../../_lib/mock";

export interface OfferDraft {
  workDescription: string;
  payTerms: string;
  whenText: string;
}

export const EMPTY_OFFER: OfferDraft = { workDescription: "", payTerms: "", whenText: "" };

export function isConcrete(draft: OfferDraft): boolean {
  return (
    draft.workDescription.trim().length >= 20 &&
    draft.payTerms.trim().length > 0 &&
    draft.whenText.trim().length > 0
  );
}

export function ToWhom() {
  return (
    <div className="flex items-center gap-3">
      <Avatar size="lg" aria-hidden="true">
        <AvatarFallback>{initialOf(ME.firstName)}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col">
        <span className="font-medium">{displayName(ME)}</span>
        <span className="text-muted-foreground text-sm">{CITY_LABEL[ME.city]}</span>
      </div>
    </div>
  );
}

export const TWO_FACTS = [
  "Una persona la lee antes de que le llegue.",
  "Una vez enviada no se puede cambiar: lo que escribas es lo que ella lee.",
] as const;

/** The Offer exactly as she will read it on her side. */
export function AsSheReadsIt({
  draft,
  from,
}: {
  readonly draft: OfferDraft;
  readonly from: string;
}) {
  const blank = <span className="text-muted-foreground">…</span>;
  return (
    <article className="ruled-page gap-5" aria-label="Así lo leerá ella">
      <p className="text-muted-foreground text-sm">De {from || "ti"} · llegó hoy</p>
      <Line label="Qué">{draft.workDescription.trim() || blank}</Line>
      <Line label="Cuánto y cómo">{draft.payTerms.trim() || blank}</Line>
      <Line label="Cuándo">{draft.whenText.trim() || blank}</Line>
    </article>
  );
}

function Line({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </span>
      <p className="font-heading text-xl leading-7 text-pretty">{children}</p>
    </div>
  );
}

export function Sent({ draft, from }: { readonly draft: OfferDraft; readonly from: string }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="page-heading">Enviada</h1>
        <p className="text-muted-foreground text-pretty">
          Una persona la lee primero, normalmente en menos de un día. Después le llega a{" "}
          {displayName(ME)} y ella decide. Te avisamos por correo en cualquiera de los dos casos.
        </p>
      </div>
      <AsSheReadsIt draft={draft} from={from} />
      <div>
        <Button type="button" variant="outline" onClick={() => globalThis.location.reload()}>
          Escribir otra
        </Button>
      </div>
    </main>
  );
}
