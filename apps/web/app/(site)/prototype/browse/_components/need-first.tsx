"use client";

/**
 * PROTOTYPE — Variant A, "¿Qué necesitas?": the Hirer starts from the work,
 * not from a list of people. One sentence in, the vocabulary answers with the
 * Skills it recognises, and the people who hold them appear under it — fewest
 * Offers first, and the page says that is the order. Nothing here is an
 * algorithm ranking people; it is a filter she can see and undo.
 */

import { Button } from "@repo/design-system/components/button";
import { useState } from "react";
import { WORKERS } from "../../_lib/mock";
import { skillsForNeed, WorkerRow } from "./shared";

const EXAMPLES = [
  "Alguien que cocine para 12 personas el sábado",
  "Pintar dos habitaciones en Dosquebradas",
  "Acompañar a mi mamá tres tardes por semana",
  "Clases de matemáticas para mi hijo de 9",
];

export function NeedFirst() {
  const [need, setNeed] = useState("");
  const [asked, setAsked] = useState("");
  const [showAll, setShowAll] = useState(false);

  const matched = skillsForNeed(asked);
  const slugs = matched.map((skill) => skill.slug);
  const people = showAll
    ? WORKERS
    : WORKERS.filter((worker) => worker.skillSlugs.some((slug) => slugs.includes(slug)));
  const sorted = [...people].toSorted((a, b) => a.offersReceived - b.offersReceived);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setAsked(need);
          setShowAll(false);
        }}
      >
        <label className="flex flex-col gap-3">
          <span className="page-heading">¿Qué necesitas que se haga?</span>
          <input
            value={need}
            onChange={(event) => setNeed(event.target.value)}
            placeholder="Escríbelo como se lo dirías a alguien"
            className="border-input font-heading h-14 rounded-md border bg-transparent px-4 text-xl"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="lg" disabled={need.trim().length < 3}>
            Buscar a alguien
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setShowAll(true);
              setAsked("");
            }}
          >
            Ver a todos
          </Button>
        </div>
        {!asked && !showAll ? (
          <ul className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((example) => (
              <li key={example}>
                <button
                  type="button"
                  onClick={() => {
                    setNeed(example);
                    setAsked(example);
                  }}
                  className="border-border rounded-md border px-3 py-1.5 text-sm"
                >
                  {example}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </form>

      {asked || showAll ? (
        <section className="flex flex-col gap-4" aria-live="polite">
          {asked ? (
            <p className="text-muted-foreground text-pretty">
              {matched.length === 0
                ? "No reconocimos ninguna capacidad en lo que escribiste. Prueba con otras palabras, o mira a todas las personas."
                : `Entendimos: ${matched.map((skill) => skill.labelEs.toLocaleLowerCase("es-CO")).join(", ")}. ${sorted.length} ${sorted.length === 1 ? "persona" : "personas"}, primero a quienes menos les han escrito.`}
            </p>
          ) : (
            <p className="text-muted-foreground">
              Todas las personas, primero a quienes menos les han escrito.
            </p>
          )}
          <div className="ruled-page divide-border divide-y">
            {sorted.map((worker) => (
              <WorkerRow key={worker.slug} worker={worker} highlight={slugs} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
