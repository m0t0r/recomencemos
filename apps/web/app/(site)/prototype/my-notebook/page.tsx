/**
 * PROTOTYPE — `/prototype/my-notebook`: three shapes for a Worker's own side
 * of the platform, against `/my-profile` today (the card, the Pause switch,
 * and nothing about Offers yet). Mock only. Throwaway.
 */

import { LabPage } from "../_components/lab-page";
import type { LabVariant, SearchParams } from "../_lib/variant";
import { OnePage } from "./_components/one-page";
import { TabsPage } from "./_components/tabs-page";
import { Today } from "./_components/today";

const VARIANTS: readonly LabVariant[] = [
  {
    key: "A",
    name: "Una página",
    bet: "todo en un solo scroll: estado y pausa, la tarjeta, las propuestas, lo cerrado",
  },
  {
    key: "B",
    name: "Pestañas",
    bet: "perfil / propuestas / cuenta, con el número de propuestas en la pestaña",
  },
  {
    key: "C",
    name: "Hoy",
    bet: "solo lo nuevo desde la última vez, una acción por línea; el perfil es un enlace",
  },
];

export default function MyNotebookLabPage({
  searchParams,
}: {
  readonly searchParams: SearchParams;
}) {
  return (
    <LabPage
      searchParams={searchParams}
      idea="7 · Mi lado de la plataforma"
      question="¿Qué ve una Trabajadora cuando entra: su tarjeta, sus propuestas, o solo lo que necesita de ella hoy?"
      variants={VARIANTS}
      render={(current) => (
        <>
          {current.key === "A" ? <OnePage /> : null}
          {current.key === "B" ? <TabsPage /> : null}
          {current.key === "C" ? <Today /> : null}
        </>
      )}
    />
  );
}
