/**
 * PROTOTYPE — `/prototype/notices`: three placements for the three standing
 * notices, against the disclosure block on the Wall and every profile today.
 * Mock only; the binding strings are untouched. Throwaway.
 */

import { LabPage } from "../_components/lab-page";
import type { LabVariant, SearchParams } from "../_lib/variant";
import { TheBlock } from "./_components/the-block";
import { TheMoment } from "./_components/the-moment";
import { TheStrip } from "./_components/the-strip";

const VARIANTS: readonly LabVariant[] = [
  {
    key: "A",
    name: "El bloque",
    bet: "lo de hoy: tres desplegables sobre la lista, el control de la comparación",
  },
  {
    key: "B",
    name: "La franja",
    bet: "una línea bajo el encabezado en todas las páginas, tres cláusulas que se abren",
  },
  {
    key: "C",
    name: "En el momento",
    bet: "sin bloque: cada frase aparece pegada al botón donde esa decisión se toma",
  },
];

export default function NoticesLabPage({ searchParams }: { readonly searchParams: SearchParams }) {
  return (
    <LabPage
      searchParams={searchParams}
      idea="8 · Las tres cosas claras"
      question="¿Dónde deben vivir las tres negativas del producto para que la persona que decide las lea, y la que solo mira no las pague en scroll?"
      variants={VARIANTS}
      render={(current) => (
        <>
          {current.key === "A" ? <TheBlock /> : null}
          {current.key === "B" ? <TheStrip /> : null}
          {current.key === "C" ? <TheMoment /> : null}
        </>
      )}
    />
  );
}
