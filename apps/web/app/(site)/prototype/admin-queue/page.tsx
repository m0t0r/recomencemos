/**
 * PROTOTYPE — `/prototype/admin-queue`: three shapes for the Admin's daily
 * queue, against the five-section `/admin` today. It sits under `(site)` for
 * the lab only — the real surface lives in `(admin)` behind the 403 gate and
 * its own header. Mock only. Throwaway.
 */

import { LabPage } from "../_components/lab-page";
import type { LabVariant, SearchParams } from "../_lib/variant";
import { TheDeck } from "./_components/the-deck";
import { TheTable } from "./_components/the-table";
import { TwoPanes } from "./_components/two-panes";

const VARIANTS: readonly LabVariant[] = [
  {
    key: "A",
    name: "La tabla",
    bet: "las cinco fuentes en una lista densa, lo más viejo arriba, j/k y a/r desde el teclado",
  },
  {
    key: "B",
    name: "Una a la vez",
    bet: "un mazo: lo más viejo llena la pantalla, dos botones, sin lista que escoger",
  },
  {
    key: "C",
    name: "Dos paneles",
    bet: "la lista por fuente con su cuenta a la izquierda, el ítem con su decisión a la derecha",
  },
];

export default function AdminQueueLabPage({
  searchParams,
}: {
  readonly searchParams: SearchParams;
}) {
  return (
    <LabPage
      searchParams={searchParams}
      idea="9 · La cola del día"
      question="¿Cómo revisa una sola persona sin paga todo lo que espera un humano, sin que lo más viejo envejezca mientras escoge lo fácil?"
      variants={VARIANTS}
      render={(current) => (
        <>
          {current.key === "A" ? <TheTable /> : null}
          {current.key === "B" ? <TheDeck /> : null}
          {current.key === "C" ? <TwoPanes /> : null}
        </>
      )}
    />
  );
}
