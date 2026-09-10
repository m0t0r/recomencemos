/**
 * PROTOTYPE — `/prototype/offer-writer`: three ways for a Hirer to write a
 * concrete Offer, against the three-field form under `/profile/[slug]`. Mock
 * only; nothing is sent. Throwaway.
 */

import { LabPage } from "../_components/lab-page";
import type { LabVariant, SearchParams } from "../_lib/variant";
import { Builder } from "./_components/builder";
import { Letter } from "./_components/letter";
import { Mirror } from "./_components/mirror";

const VARIANTS: readonly LabVariant[] = [
  {
    key: "A",
    name: "El espejo",
    bet: "los tres campos de hoy, con su lado de la página al lado, en vivo",
  },
  {
    key: "B",
    name: "El constructor",
    bet: "el pago y el cuándo se arman por partes; no hay campo para lo vago",
  },
  {
    key: "C",
    name: "La carta",
    bet: "una carta con espacios en blanco, dirigida a ella por su nombre",
  },
];

export default function OfferWriterLabPage({
  searchParams,
}: {
  readonly searchParams: SearchParams;
}) {
  return (
    <LabPage
      searchParams={searchParams}
      idea="4 · Escribir una propuesta concreta"
      question="¿Qué forma lleva a un Contratante a escribir términos que ella pueda aceptar tal cual?"
      variants={VARIANTS}
      render={(current) => (
        <>
          {current.key === "A" ? <Mirror /> : null}
          {current.key === "B" ? <Builder /> : null}
          {current.key === "C" ? <Letter /> : null}
        </>
      )}
    />
  );
}
