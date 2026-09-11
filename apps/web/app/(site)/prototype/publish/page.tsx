/**
 * PROTOTYPE — `/prototype/publish`: three ways to publish a CapabilityProfile
 * from a phone in one sitting, against the one-page form that exists at
 * `/publish`. Mock only; nothing is written anywhere. Throwaway.
 */

import { LabPage } from "../_components/lab-page";
import type { LabVariant, SearchParams } from "../_lib/variant";
import { Dictation } from "./_components/dictation";
import { FillTheCard } from "./_components/fill-the-card";
import { SpeakIt } from "./_components/speak-it";
import { Steps } from "./_components/steps";

const VARIANTS: readonly LabVariant[] = [
  {
    key: "A",
    name: "Paso a paso",
    bet: "una pregunta por pantalla, una línea de progreso, la tarjeta al final",
  },
  {
    key: "B",
    name: "Cuéntalo",
    bet: "un párrafo en sus palabras; la plataforma propone la línea y las capacidades, ella corrige",
  },
  {
    key: "C",
    name: "Escribe en la tarjeta",
    bet: "la fila del muro es el formulario; lo privado va aparte, debajo",
  },
  {
    key: "D",
    name: "Grábalo",
    bet: "como un audio de WhatsApp: dice su línea, el navegador la transcribe, ella corrige",
  },
];

export default function PublishLabPage({ searchParams }: { readonly searchParams: SearchParams }) {
  return (
    <LabPage
      searchParams={searchParams}
      idea="2 · Publicar desde el teléfono"
      question="¿Qué forma hace más liviano publicar en una sola sentada, sin documento, desde un celular prestado?"
      variants={VARIANTS}
      render={(current) => (
        <>
          {current.key === "A" ? <Steps /> : null}
          {current.key === "B" ? <Dictation /> : null}
          {current.key === "C" ? <FillTheCard /> : null}
          {current.key === "D" ? <SpeakIt /> : null}
        </>
      )}
    />
  );
}
