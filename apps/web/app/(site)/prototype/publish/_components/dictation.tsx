"use client";

/**
 * PROTOTYPE — Variant B, "Cuéntalo": she writes one paragraph the way she
 * would say it, and the platform proposes the headline and the Skills from it.
 * The "proposal" is mocked: keyword matching against the vocabulary and the
 * first sentence as the headline. She confirms or edits every proposal; the
 * platform writes nothing on her behalf that she has not seen.
 *
 * Bet: a person who has never filled a form can still talk about what she
 * does, and the structure can come second.
 */

import { Button } from "@repo/design-system/components/button";
import { Input } from "@repo/design-system/components/input";
import { Textarea } from "@repo/design-system/components/textarea";
import { useState } from "react";
import { Labeled } from "../../_components/labeled";
import { CITY_LABEL, type MockCity, SKILLS } from "../../_lib/mock";
import { CITIES, type Draft, EMPTY_DRAFT, Published, SkillPicker, WallRowPreview } from "./shared";

const KEYWORDS: Record<string, readonly string[]> = {
  "home-cooking": ["cocin", "almuerzo", "comida"],
  "traditional-cooking": ["típic", "sancocho", "frijol", "bandeja"],
  "baking-and-pastry": ["pan", "torta", "reposter", "postre"],
  "kitchen-assistance": ["ayud", "cocina"],
  "home-cleaning": ["aseo", "limpi", "casa"],
  "laundry-and-ironing": ["lav", "planch", "ropa"],
  "odd-jobs": ["arregl", "oficios", "todero", "reparo"],
  plumbing: ["plomer", "tuber", "destap"],
  painting: ["pint"],
  electrical: ["eléctric", "electric", "luz"],
  masonry: ["obra", "muro", "enchape", "albañil"],
  "child-care": ["niñ", "bebé", "cuidar"],
  "elder-care": ["mayor", "abuel", "anciano", "cuidar"],
  "patient-companionship": ["paciente", "clínica", "hospital"],
  "motorcycle-delivery": ["moto", "domicilio"],
  driving: ["conduc", "manej", "carro"],
  hairdressing: ["pelo", "peluquer", "manicure", "corte"],
  tutoring: ["clase", "enseñ", "matemát", "lectura"],
  spreadsheets: ["excel", "hoja de cálculo", "factur"],
  "customer-service": ["cliente", "teléfono", "whatsapp", "atenci"],
  sewing: ["cos", "costura", "arreglo de ropa"],
  gardening: ["jardín", "jardin", "poda", "plantas"],
};

function propose(text: string): { headline: string; skillSlugs: readonly string[] } {
  const lower = text.toLocaleLowerCase("es-CO");
  const skillSlugs = SKILLS.filter((skill) =>
    (KEYWORDS[skill.slug] ?? []).some((word) => lower.includes(word)),
  )
    .map((skill) => skill.slug)
    .slice(0, 5);
  const first = text.split(/(?<=[.!?])\s+/)[0]?.trim() ?? "";
  return { headline: first.slice(0, 120), skillSlugs };
}

export function Dictation() {
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [done, setDone] = useState(false);

  function patch(next: Partial<Draft>) {
    setDraft((prev) => (prev ? { ...prev, ...next } : prev));
  }

  if (done && draft) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col px-4 py-10">
        <Published draft={draft} />
      </main>
    );
  }

  if (!draft) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-10">
        <h1 className="page-heading">Cuéntanos qué sabes hacer</h1>
        <p className="text-muted-foreground text-pretty">
          Escríbelo como se lo contarías a alguien del barrio. Nosotros te proponemos cómo ordenarlo
          y tú decides qué queda.
        </p>
        <Textarea
          rows={7}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Ejemplo: Cocino almuerzos caseros para grupos grandes y dejo la cocina limpia. Trabajé doce años en un restaurante. También sé hacer arepas y tortas para vender."
        />
        <div>
          <Button
            type="button"
            size="lg"
            disabled={text.trim().length < 20}
            onClick={() => setDraft({ ...EMPTY_DRAFT, about: text, ...propose(text) })}
          >
            Ordenarlo
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="page-heading">Esto es lo que entendimos</h1>
        <p className="text-muted-foreground text-pretty">
          Corrige lo que quieras. Nada se publica hasta que tú lo digas.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-medium">Tu línea</h2>
        <p className="text-muted-foreground text-sm">La primera frase que escribiste.</p>
        <Textarea
          rows={2}
          value={draft.headline}
          onChange={(event) => patch({ headline: event.target.value })}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-medium">Capacidades que reconocimos</h2>
        <p className="text-muted-foreground text-sm text-pretty">
          {draft.skillSlugs.length === 0
            ? "No encontramos ninguna en la lista. Elige las tuyas."
            : "Marcadas en tinta. Quita las que no sean y agrega las que falten."}
        </p>
        <SkillPicker value={draft.skillSlugs} onChange={(skillSlugs) => patch({ skillSlugs })} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-medium">Lo que faltó preguntarte</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled label="Nombre">
            {(id) => (
              <Input
                id={id}
                value={draft.firstName}
                onChange={(event) => patch({ firstName: event.target.value })}
              />
            )}
          </Labeled>
          <Labeled label="Inicial del apellido">
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
        <fieldset className="flex flex-wrap gap-2">
          <legend className="mb-2 text-sm">Ciudad</legend>
          {CITIES.map((city) => (
            <label
              key={city}
              className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm ${
                draft.city === city ? "border-primary bg-secondary" : "border-border"
              }`}
            >
              <input
                type="radio"
                name="city"
                className="sr-only"
                checked={draft.city === city}
                onChange={() => patch({ city: city as MockCity })}
              />
              {CITY_LABEL[city]}
            </label>
          ))}
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled label="Nombre completo (privado)">
            {(id) => (
              <Input
                id={id}
                value={draft.fullName}
                onChange={(event) => patch({ fullName: event.target.value })}
              />
            )}
          </Labeled>
          <Labeled label="Teléfono (privado)">
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

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-medium">Así te van a ver</h2>
        <div className="ruled-page">
          <WallRowPreview draft={draft} />
        </div>
        <p className="text-muted-foreground text-sm text-pretty">
          Tu párrafo completo lo lee solo quien entre con cuenta a tu perfil.
        </p>
      </section>

      <div className="flex gap-3">
        <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
          Volver a escribir
        </Button>
        <Button
          type="button"
          size="lg"
          disabled={
            !draft.headline.trim() ||
            draft.skillSlugs.length === 0 ||
            !draft.city ||
            !draft.firstName.trim() ||
            !draft.fullName.trim() ||
            !draft.phone.trim()
          }
          onClick={() => setDone(true)}
        >
          Publicar
        </Button>
      </div>
    </main>
  );
}
