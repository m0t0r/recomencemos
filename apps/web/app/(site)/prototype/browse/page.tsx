/**
 * PROTOTYPE — `/prototype/browse`: three ways for a Hirer to find someone,
 * against the filter bar at `/profiles`. Mock only. Throwaway.
 */

import { LabPage } from "../_components/lab-page";
import type { LabVariant, SearchParams } from "../_lib/variant";
import { HerWords } from "./_components/her-words";
import { IndexTabs } from "./_components/index-tabs";
import { NeedFirst } from "./_components/need-first";

const VARIANTS: readonly LabVariant[] = [
  {
    key: "A",
    name: "¿Qué necesitas?",
    bet: "empezar por el trabajo, no por la lista; el vocabulario responde y la gente aparece debajo",
  },
  {
    key: "B",
    name: "El índice",
    bet: "las pestañas del cuaderno: ocho grupos con su cuenta, sin buscador",
  },
  {
    key: "C",
    name: "Sus palabras",
    bet: "solo las líneas que ellas escribieron, en grande; nada más en la fila",
  },
];

export default function BrowseLabPage({ searchParams }: { readonly searchParams: SearchParams }) {
  return (
    <LabPage
      searchParams={searchParams}
      idea="3 · Encontrar a alguien"
      question="¿Debería un Contratante empezar por lo que necesita en vez de por una lista de personas?"
      variants={VARIANTS}
      render={(current) => (
        <>
          {current.key === "A" ? <NeedFirst /> : null}
          {current.key === "B" ? <IndexTabs /> : null}
          {current.key === "C" ? <HerWords /> : null}
        </>
      )}
    />
  );
}
