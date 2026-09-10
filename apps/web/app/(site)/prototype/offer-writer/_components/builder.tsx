"use client";

/**
 * PROTOTYPE — Variant B, "El constructor": the pay and the when are built
 * from parts — a unit, an amount in pesos, how it is paid, a day and a slot —
 * and the platform assembles the sentence she reads. Only the work itself is
 * free text. Bet: structure is what makes an Offer concrete, and a vague one
 * cannot be sent because there is no field for vagueness.
 */

import { Button } from "@repo/design-system/components/button";
import { Input } from "@repo/design-system/components/input";
import { Textarea } from "@repo/design-system/components/textarea";
import { useState } from "react";
import { formatCop } from "../../_lib/mock";
import { AsSheReadsIt, isConcrete, type OfferDraft, Sent, ToWhom, TWO_FACTS } from "./shared";

const UNITS = ["por hora", "por día", "por el trabajo completo", "al mes"] as const;
const METHODS = [
  "en efectivo al terminar",
  "por transferencia o Nequi",
  "la mitad antes y la mitad al terminar",
] as const;
const SLOTS = ["en la mañana", "en la tarde", "todo el día", "en la noche"] as const;

function Chips<T extends string>({
  options,
  value,
  onChange,
  name,
}: {
  readonly options: readonly T[];
  readonly value: T | "";
  readonly onChange: (next: T) => void;
  readonly name: string;
}) {
  return (
    <fieldset className="flex flex-wrap gap-1.5">
      <legend className="sr-only">{name}</legend>
      {options.map((option) => (
        <button
          key={option}
          type="button"

          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={`rounded-md border px-3 py-1.5 text-sm ${
            value === option ? "border-primary bg-primary text-primary-foreground" : "border-border"
          }`}
        >
          {option}
        </button>
      ))}
    </fieldset>
  );
}

export function Builder() {
  const [work, setWork] = useState("");
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState<(typeof UNITS)[number] | "">("");
  const [method, setMethod] = useState<(typeof METHODS)[number] | "">("");
  const [day, setDay] = useState("");
  const [slot, setSlot] = useState<(typeof SLOTS)[number] | "">("");
  const [from, setFrom] = useState("");
  const [sent, setSent] = useState(false);

  const pesos = Number(amount.replaceAll(/\D/g, ""));
  const draft: OfferDraft = {
    workDescription: work,
    payTerms: pesos > 0 && unit && method ? `${formatCop(pesos)} ${unit}, ${method}` : "",
    whenText: day.trim() && slot ? `${day.trim()}, ${slot}` : "",
  };

  if (sent) return <Sent draft={draft} from={from} />;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-3">
        <h1 className="page-heading">Escribirle una propuesta</h1>
        <ToWhom />
        <ul className="text-muted-foreground flex list-disc flex-col gap-1 pl-5 text-sm">
          {TWO_FACTS.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      </div>

      <form
        className="flex flex-col gap-8"
        onSubmit={(event) => {
          event.preventDefault();
          if (isConcrete(draft) && from.trim()) setSent(true);
        }}
      >
        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-xl font-medium">Qué necesitas que haga</h2>
          <Textarea
            rows={4}
            value={work}
            onChange={(event) => setWork(event.target.value)}
            placeholder="Almuerzo para 12 personas en mi casa en Pinares. Yo pongo el mercado."
          />
          <p className="text-muted-foreground text-sm">{work.trim().length} de 600</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl font-medium">Cuánto pagas</h2>
          <div className="flex items-center gap-2">
            <span className="font-heading text-2xl">$</span>
            <Input
              inputMode="numeric"
              value={pesos > 0 ? pesos.toLocaleString("es-CO") : amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="180.000"
              aria-label="Monto en pesos"
              className="font-heading h-12 max-w-48 text-2xl"
            />
          </div>
          <Chips options={UNITS} value={unit} onChange={setUnit} name="Por qué unidad" />
          <h3 className="text-sm font-medium">Cómo</h3>
          <Chips options={METHODS} value={method} onChange={setMethod} name="Cómo pagas" />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl font-medium">Cuándo</h2>
          <Input
            value={day}
            onChange={(event) => setDay(event.target.value)}
            placeholder="Sábado 19 de septiembre"
            aria-label="Qué día"
          />
          <Chips options={SLOTS} value={slot} onChange={setSlot} name="En qué momento" />
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-xl font-medium">Tu nombre</h2>
          <Input value={from} onChange={(event) => setFrom(event.target.value)} />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-muted-foreground text-sm">Así lo leerá ella:</h2>
          <div className="border-border rounded-lg border p-5">
            <AsSheReadsIt draft={draft} from={from} />
          </div>
        </section>

        <div>
          <Button type="submit" size="lg" disabled={!isConcrete(draft) || !from.trim()}>
            Enviar tal como está
          </Button>
        </div>
      </form>
    </main>
  );
}
