"use client";

/**
 * PROTOTYPE — Variant C, "Escribe en la tarjeta": the Wall row itself is the
 * form. She types into the exact place each word will appear, so there is no
 * gap between what she fills and what she publishes. The private fields
 * (full name, phone) sit *under* the card in a plainly separate box, because
 * they are the two things the card never shows.
 *
 * Bet: the strongest preview is no preview — write on the thing itself.
 */

import { Avatar, AvatarFallback } from "@repo/design-system/components/avatar";
import { Button } from "@repo/design-system/components/button";
import { Input } from "@repo/design-system/components/input";
import { useState } from "react";
import { Labeled } from "../../_components/labeled";
import { CITY_LABEL, initialOf, SKILLS } from "../../_lib/mock";
import { CITIES, type Draft, EMPTY_DRAFT, Published, SkillPicker } from "./shared";

export function FillTheCard() {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [pickingSkills, setPickingSkills] = useState(false);
  const [done, setDone] = useState(false);

  function patch(next: Partial<Draft>) {
    setDraft((prev) => ({ ...prev, ...next }));
  }

  const ready =
    draft.headline.trim().length >= 10 &&
    draft.skillSlugs.length > 0 &&
    draft.city !== "" &&
    draft.firstName.trim() !== "" &&
    draft.fullName.trim() !== "" &&
    draft.phone.trim().length >= 7;

  if (done) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col px-4 py-10">
        <Published draft={draft} />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="page-heading">Escribe tu tarjeta</h1>
        <p className="text-muted-foreground text-pretty">
          Lo que escribas aquí es exactamente lo que se ve en el muro. Toca cada parte y llénala.
        </p>
      </div>

      <div className="ruled-page">
        <article className="flex gap-4 py-5">
          <Avatar size="lg" className="shrink-0" aria-hidden="true">
            <AvatarFallback>{initialOf(draft.firstName) || "?"}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 grow flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="sr-only">Tu línea, en tus palabras</span>
              <textarea
                rows={2}
                value={draft.headline}
                onChange={(event) => patch({ headline: event.target.value })}
                placeholder="Escribe aquí qué sabes hacer, en una línea."
                className="font-heading text-foreground placeholder:text-muted-foreground w-full resize-none border-0 border-b border-dashed border-current bg-transparent p-0 text-2xl leading-7 font-medium outline-none focus:border-solid"
              />
            </label>

            <div className="text-muted-foreground flex flex-wrap items-center gap-x-1 text-sm">
              <input
                value={draft.firstName}
                onChange={(event) => patch({ firstName: event.target.value })}
                placeholder="Nombre"
                aria-label="Nombre"
                className="w-28 border-0 border-b border-dashed border-current bg-transparent p-0 outline-none focus:border-solid"
              />
              <input
                value={draft.lastInitial}
                onChange={(event) => patch({ lastInitial: event.target.value.slice(0, 1) })}
                placeholder="A"
                aria-label="Inicial del apellido"
                className="w-4 border-0 border-b border-dashed border-current bg-transparent p-0 text-center outline-none focus:border-solid"
              />
              <span>. ·</span>
              <select
                value={draft.city}
                onChange={(event) => patch({ city: event.target.value as Draft["city"] })}
                aria-label="Ciudad"
                className="border-0 border-b border-dashed border-current bg-transparent p-0 outline-none focus:border-solid"
              >
                <option value="">Ciudad</option>
                {CITIES.map((city) => (
                  <option key={city} value={city}>
                    {CITY_LABEL[city]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {draft.skillSlugs.map((slug) => {
                const skill = SKILLS.find((entry) => entry.slug === slug);
                return skill ? (
                  <button
                    key={slug}
                    type="button"
                    onClick={() =>
                      patch({ skillSlugs: draft.skillSlugs.filter((entry) => entry !== slug) })
                    }
                    aria-label={`Quitar ${skill.labelEs}`}
                    className="bg-secondary text-secondary-foreground rounded-md px-2 py-1 text-xs"
                  >
                    {skill.labelEs} ×
                  </button>
                ) : null;
              })}
              <button
                type="button"
                onClick={() => setPickingSkills((open) => !open)}
                aria-expanded={pickingSkills}
                className="border-input rounded-md border border-dashed px-2 py-1 text-xs"
              >
                {draft.skillSlugs.length === 0 ? "+ Agrega tus capacidades" : "+ Agregar"}
              </button>
            </div>
          </div>
        </article>
      </div>

      {pickingSkills ? (
        <section className="border-border rounded-lg border p-4">
          <SkillPicker value={draft.skillSlugs} onChange={(skillSlugs) => patch({ skillSlugs })} />
          <div className="mt-3">
            <Button type="button" variant="outline" onClick={() => setPickingSkills(false)}>
              Listo
            </Button>
          </div>
        </section>
      ) : null}

      <section className="bg-muted flex flex-col gap-3 rounded-lg p-4">
        <h2 className="font-heading text-xl font-medium">Lo que la tarjeta no muestra</h2>
        <p className="text-muted-foreground text-sm text-pretty">
          Solo lo recibe la persona cuya propuesta aceptes. Nadie más.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
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
      </section>

      <div>
        <Button type="button" size="lg" disabled={!ready} onClick={() => setDone(true)}>
          Publicar esta tarjeta
        </Button>
      </div>
    </main>
  );
}
