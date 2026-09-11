/**
 * PROTOTYPE — `/prototype/profile`: three ways for a Hirer to read one
 * Worker's full profile and reach the Offer control, against the composition
 * at `/profile/[slug]`. Mock only. Throwaway.
 */

import { LabPage } from "../_components/lab-page";
import type { LabVariant, SearchParams } from "../_lib/variant";
import { Dossier } from "./_components/dossier";
import { HerVoice } from "./_components/her-voice";
import { ThePage } from "./_components/the-page";

const VARIANTS: readonly LabVariant[] = [
  {
    key: "A",
    name: "La página",
    bet: "la composición de hoy, con la forma de escribirle fija abajo mientras él lee",
  },
  {
    key: "B",
    name: "El dossier",
    bet: "identidad fija arriba y tres pestañas: quién es, dónde ha trabajado, escribirle",
  },
  {
    key: "C",
    name: "Su voz",
    bet: "la página son sus palabras: su párrafo como cita, su historia por el margen",
  },
];

export default function ProfileLabPage({ searchParams }: { readonly searchParams: SearchParams }) {
  return (
    <LabPage
      searchParams={searchParams}
      idea="6 · Leer un perfil"
      question="¿Cómo lee un Contratante el perfil completo de una persona en el teléfono, y dónde encuentra la forma de escribirle?"
      variants={VARIANTS}
      render={(current) => (
        <>
          {current.key === "A" ? <ThePage /> : null}
          {current.key === "B" ? <Dossier /> : null}
          {current.key === "C" ? <HerVoice /> : null}
        </>
      )}
    />
  );
}
