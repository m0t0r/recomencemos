/**
 * PROTOTYPE — `/prototype/check-in`: the seven-day check-in, the one
 * measurement the product names as success and which no surface asks for
 * yet. Three shapes for the same two questions. Mock only. Throwaway.
 */

import { LabPage } from "../_components/lab-page";
import type { LabVariant, SearchParams } from "../_lib/variant";
import { LastLine } from "./_components/last-line";
import { OneEmail } from "./_components/one-email";
import { TwoTaps } from "./_components/two-taps";

const VARIANTS: readonly LabVariant[] = [
  {
    key: "A",
    name: "Dos toques",
    bet: "una página propia: dos preguntas, un toque cada una, y lo que la respuesta no puede hacer",
  },
  {
    key: "B",
    name: "La última línea",
    bet: "sin página: la propuesta acordada, en su perfil, pide su línea de cierre a los siete días",
  },
  {
    key: "C",
    name: "Un correo",
    bet: "sin sitio: tres enlaces en un correo; el enlace es la respuesta",
  },
];

export default function CheckInLabPage({ searchParams }: { readonly searchParams: SearchParams }) {
  return (
    <LabPage
      searchParams={searchParams}
      idea="5 · La pregunta de los siete días"
      question="¿Cuál es la forma más liviana y honesta de preguntar si el trabajo se hizo y si le pagaron?"
      variants={VARIANTS}
      render={(current) => (
        <>
          {current.key === "A" ? <TwoTaps /> : null}
          {current.key === "B" ? <LastLine /> : null}
          {current.key === "C" ? <OneEmail /> : null}
        </>
      )}
    />
  );
}
