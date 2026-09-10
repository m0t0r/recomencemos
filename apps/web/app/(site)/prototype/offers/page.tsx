/**
 * PROTOTYPE — `/prototype/offers`: the Worker's received Offers, the decision
 * and the Contact Exchange, which the spec's surface table names at `/offers`
 * and `/offers/[id]` and which do not exist yet. Three variants, mock data,
 * `?variant=` switches. Throwaway.
 */

import { LabPage } from "../_components/lab-page";
import type { LabVariant, SearchParams } from "../_lib/variant";
import { Compare } from "./_components/compare";
import { Ledger } from "./_components/ledger";
import { Letters } from "./_components/letters";

const VARIANTS: readonly LabVariant[] = [
  {
    key: "A",
    name: "El cuaderno",
    bet: "un solo cuaderno de filas; abrir, decidir y acordar sin salir de la lista",
  },
  {
    key: "B",
    name: "Una a la vez",
    bet: "cada propuesta es una carta a pantalla completa; una decisión y pasa la siguiente",
  },
  {
    key: "C",
    name: "Lado a lado",
    bet: "columnas alineadas por qué / cuánto / cuándo; ella elige entre varias, no una por una",
  },
];

export default function OffersLabPage({ searchParams }: { readonly searchParams: SearchParams }) {
  return (
    <LabPage
      searchParams={searchParams}
      idea="1 · Decidir una propuesta"
      question="¿Cómo lee y decide una Trabajadora sus propuestas desde el teléfono, y qué ve en el momento del intercambio de contacto?"
      variants={VARIANTS}
      render={(current) => (
        <>
          {current.key === "A" ? <Ledger /> : null}
          {current.key === "B" ? <Letters /> : null}
          {current.key === "C" ? <Compare /> : null}
        </>
      )}
    />
  );
}
