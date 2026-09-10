"use client";

/**
 * PROTOTYPE — Variant C, "Sus palabras": the list is nothing but headlines,
 * set large, one after another like lines in a book. No chips, no photo, the
 * name in small type under each. A search box searches only what she wrote.
 * The bet: the product's own principle taken to its edge — she is described
 * by what she can do, so show *only* that and see whether the page still
 * works for the person hiring.
 */

import { useState } from "react";
import { CITY_LABEL, displayName, WORKERS } from "../../_lib/mock";

export function HerWords() {
  const [query, setQuery] = useState("");
  const q = query.trim().toLocaleLowerCase("es-CO");
  const people = WORKERS.filter(
    (worker) => !q || worker.headline.toLocaleLowerCase("es-CO").includes(q),
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-4">
        <h1 className="page-heading">Lo que cada persona dice que sabe hacer</h1>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Busca una palabra en sus líneas: cocina, moto, niños…"
          aria-label="Buscar en sus palabras"
          className="border-input h-11 rounded-md border bg-transparent px-4"
        />
      </div>

      <ol className="ruled-page divide-border divide-y" aria-live="polite">
        {people.map((worker) => (
          <li key={worker.slug} className="py-6">
            <button type="button" className="group flex flex-col gap-2 text-left">
              <span className="font-heading group-hover:text-primary text-3xl leading-9 font-medium text-pretty">
                {worker.headline}
              </span>
              <span className="text-muted-foreground text-sm">
                — {displayName(worker)}, {CITY_LABEL[worker.city]}
              </span>
            </button>
          </li>
        ))}
        {people.length === 0 ? (
          <li className="text-muted-foreground py-6">Nadie escribió esa palabra en su línea.</li>
        ) : null}
      </ol>
    </main>
  );
}
