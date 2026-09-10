"use client";

/**
 * PROTOTYPE — Variant A, "Paso a paso": one question per screen, a ruled
 * progress line, the keyboard's Next as the only forward control. The last
 * step is the Wall row she is about to publish. Bet: a phone form is easier
 * one question at a time than as one long page.
 */

import { Button } from "@repo/design-system/components/button";
import { Input } from "@repo/design-system/components/input";
import { Textarea } from "@repo/design-system/components/textarea";
import { useState } from "react";
import { Labeled } from "../../_components/labeled";
import { CITY_LABEL } from "../../_lib/mock";
import { CITIES, type Draft, EMPTY_DRAFT, Published, SkillPicker, WallRowPreview } from "./shared";

const STEPS = [
  "Tu línea",
  "Tus capacidades",
  "Tu ciudad",
  "Cómo te llaman",
  "Tus datos privados",
  "Revisar",
] as const;

export function Steps() {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);

  function patch(next: Partial<Draft>) {
    setDraft((prev) => ({ ...prev, ...next }));
  }

  const canNext = [
    draft.headline.trim().length >= 10,
    draft.skillSlugs.length > 0,
    draft.city !== "",
    draft.firstName.trim() !== "" && draft.lastInitial.trim() !== "",
    draft.fullName.trim() !== "" && draft.phone.trim().length >= 7,
    true,
  ][step];

  if (done) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col px-4 py-10">
        <Published draft={draft} />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-10">
      <ol className="flex items-center gap-1" aria-label="Pasos">
        {STEPS.map((label, index) => (
          <li
            key={label}
            aria-current={index === step ? "step" : undefined}
            className={`h-1 grow rounded-full ${index <= step ? "bg-primary" : "bg-border"}`}
          >
            <span className="sr-only">{label}</span>
          </li>
        ))}
      </ol>

      <form
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canNext) return;
          if (step === STEPS.length - 1) setDone(true);
          else setStep(step + 1);
        }}
      >
        <p className="text-muted-foreground text-sm">
          {step + 1} de {STEPS.length} · {STEPS[step]}
        </p>

        {step === 0 ? (
          <Labeled
            label="En una línea: ¿qué sabes hacer?"
            hint="Como se lo dirías a un vecino. Esta es la línea que todos leen primero."
            className="font-heading flex flex-col gap-3 text-2xl leading-8 font-medium text-pretty"
          >
            {(id) => (
              <Textarea
                id={id}
                rows={3}
                className="font-sans text-base font-normal"
                value={draft.headline}
                onChange={(event) => patch({ headline: event.target.value })}
                placeholder="Cocino almuerzos caseros para hasta veinte personas y dejo la cocina limpia."
              />
            )}
          </Labeled>
        ) : null}

        {step === 1 ? (
          <div className="flex flex-col gap-3">
            <p className="font-heading text-2xl leading-8 font-medium">
              ¿Cuáles de estas capacidades tienes?
            </p>
            <SkillPicker
              value={draft.skillSlugs}
              onChange={(skillSlugs) => patch({ skillSlugs })}
            />
          </div>
        ) : null}

        {step === 2 ? (
          <fieldset className="flex flex-col gap-3">
            <legend className="font-heading mb-3 text-2xl leading-8 font-medium">
              ¿En qué ciudad trabajas?
            </legend>
            {CITIES.map((city) => (
              <label
                key={city}
                className={`flex cursor-pointer items-center gap-3 rounded-md border px-4 py-3 ${
                  draft.city === city ? "border-primary bg-secondary" : "border-border"
                }`}
              >
                <input
                  type="radio"
                  name="city"
                  value={city}
                  checked={draft.city === city}
                  onChange={() => patch({ city })}
                />
                {CITY_LABEL[city]}
              </label>
            ))}
          </fieldset>
        ) : null}

        {step === 3 ? (
          <div className="flex flex-col gap-3">
            <p className="font-heading text-2xl leading-8 font-medium">¿Cómo te llaman?</p>
            <p className="text-muted-foreground text-sm text-pretty">
              En el muro aparece tu nombre y la inicial de tu apellido, nada más.
            </p>
            <div className="grid grid-cols-[1fr_5rem] gap-3">
              <Labeled label="Nombre">
                {(id) => (
                  <Input
                    id={id}
                    value={draft.firstName}
                    onChange={(event) => patch({ firstName: event.target.value })}
                  />
                )}
              </Labeled>
              <Labeled label="Inicial">
                {(id) => (
                  <Input
                    id={id}
                    maxLength={1}
                    value={draft.lastInitial}
                    onChange={(event) => patch({ lastInitial: event.target.value })}
                  />
                )}
              </Labeled>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="flex flex-col gap-3">
            <p className="font-heading text-2xl leading-8 font-medium">Tus datos privados</p>
            <p className="text-muted-foreground text-sm text-pretty">
              Nadie los ve. Solo los recibe la persona cuya propuesta tú aceptes.
            </p>
            <Labeled label="Nombre completo">
              {(id) => (
                <Input
                  id={id}
                  value={draft.fullName}
                  onChange={(event) => patch({ fullName: event.target.value })}
                />
              )}
            </Labeled>
            <Labeled label="Teléfono">
              {(id) => (
                <Input
                  id={id}
                  type="tel"
                  value={draft.phone}
                  onChange={(event) => patch({ phone: event.target.value })}
                />
              )}
            </Labeled>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="flex flex-col gap-3">
            <p className="font-heading text-2xl leading-8 font-medium">Así te van a ver</p>
            <div className="ruled-page">
              <WallRowPreview draft={draft} />
            </div>
            <p className="text-muted-foreground text-sm text-pretty">
              Puedes cambiar cualquier cosa después. Nadie aquí está verificado, ni tú ni quien te
              escriba, y lo decimos en cada página.
            </p>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            disabled={step === 0}
            onClick={() => setStep(step - 1)}
          >
            Atrás
          </Button>
          <Button type="submit" size="lg" disabled={!canNext}>
            {step === STEPS.length - 1 ? "Publicar" : "Siguiente"}
          </Button>
        </div>
      </form>
    </main>
  );
}
