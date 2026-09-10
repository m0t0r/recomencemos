"use client";

/**
 * PROTOTYPE — Variant C, "La carta": a fill-in-the-blank letter addressed to
 * her by name. The prompts are the sentence around each blank, so the Hirer
 * never sees a field label — he completes sentences. Bet: writing to a named
 * person, in her language, produces terms that are humane *and* concrete,
 * and the two facts read as part of the letter rather than as a warning box.
 */

import { Button } from "@repo/design-system/components/button";
import { useState } from "react";
import { ME } from "../../_lib/mock";
import { EMPTY_OFFER, isConcrete, type OfferDraft, Sent } from "./shared";

function Blank({
  value,
  onChange,
  placeholder,
  wide = false,
}: {
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly placeholder: string;
  readonly wide?: boolean;
}) {
  const size = Math.max(placeholder.length, value.length, 8);
  return wide ? (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      rows={3}
      aria-label={placeholder}
      className="placeholder:text-muted-foreground/70 border-primary/50 focus:border-primary w-full resize-none border-0 border-b border-dashed bg-transparent p-0 font-[inherit] text-[inherit] leading-[inherit] outline-none focus:border-solid"
    />
  ) : (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      size={size}
      aria-label={placeholder}
      className="placeholder:text-muted-foreground/70 border-primary/50 focus:border-primary max-w-full border-0 border-b border-dashed bg-transparent p-0 font-[inherit] text-[inherit] outline-none focus:border-solid"
    />
  );
}

export function Letter() {
  const [draft, setDraft] = useState<OfferDraft>(EMPTY_OFFER);
  const [from, setFrom] = useState("");
  const [sent, setSent] = useState(false);

  function patch(next: Partial<OfferDraft>) {
    setDraft((prev) => ({ ...prev, ...next }));
  }

  if (sent) return <Sent draft={draft} from={from} />;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10">
      <h1 className="page-heading">Una propuesta para {ME.firstName}</h1>

      <form
        className="ruled-page font-heading gap-6 text-xl leading-9"
        onSubmit={(event) => {
          event.preventDefault();
          if (isConcrete(draft) && from.trim()) setSent(true);
        }}
      >
        <p>Hola, {ME.firstName}.</p>
        <p>
          Leí lo que escribiste — <em>{ME.headline}</em> — y necesito esto:{" "}
          <Blank
            wide
            value={draft.workDescription}
            onChange={(workDescription) => patch({ workDescription })}
            placeholder="qué, dónde, para cuántas personas, qué incluye"
          />
        </p>
        <p>
          Te pago{" "}
          <Blank
            value={draft.payTerms}
            onChange={(payTerms) => patch({ payTerms })}
            placeholder="cuánto, por qué y cómo"
          />
          .
        </p>
        <p>
          Sería{" "}
          <Blank
            value={draft.whenText}
            onChange={(whenText) => patch({ whenText })}
            placeholder="qué día y a qué hora"
          />
          .
        </p>
        <p className="text-muted-foreground text-base leading-7">
          Antes de que te llegue, una persona de Recomencemos la lee. Y una vez la envíe no la puedo
          cambiar: lo que dice aquí es lo que te prometo. Nadie ha verificado quién soy, así que
          decides tú.
        </p>
        <p>
          — <Blank value={from} onChange={setFrom} placeholder="tu nombre, como tú lo digas" />
        </p>

        <div className="font-sans text-base">
          <Button type="submit" size="lg" disabled={!isConcrete(draft) || !from.trim()}>
            Enviar la carta tal como está
          </Button>
        </div>
      </form>
    </main>
  );
}
