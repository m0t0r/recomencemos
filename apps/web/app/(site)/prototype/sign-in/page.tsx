/**
 * PROTOTYPE — `/prototype/sign-in`: three doors, against the emailed link at
 * `/sign-in` today. Mock only; nothing is sent and any code enters. Throwaway.
 */

import { LabPage } from "../_components/lab-page";
import type { LabVariant, SearchParams } from "../_lib/variant";
import { TheCode } from "./_components/the-code";
import { TheLink } from "./_components/the-link";
import { TheNumber } from "./_components/the-number";

const VARIANTS: readonly LabVariant[] = [
  {
    key: "A",
    name: "El enlace",
    bet: "lo de hoy: un correo, un enlace, y la pantalla de espera para compararla",
  },
  {
    key: "B",
    name: "El código",
    bet: "un correo y seis dígitos escritos aquí; el correo puede estar en otro teléfono",
  },
  {
    key: "C",
    name: "Tu número",
    bet: "sin correo: el celular y un código por WhatsApp; el correo se pide después, una vez",
  },
];

export default function SignInLabPage({ searchParams }: { readonly searchParams: SearchParams }) {
  return (
    <LabPage
      searchParams={searchParams}
      idea="10 · La puerta"
      question="¿Cómo entra una Trabajadora desde un teléfono prestado, sin contraseña y quizá sin correo a la mano?"
      variants={VARIANTS}
      render={(current) => (
        <>
          {current.key === "A" ? <TheLink /> : null}
          {current.key === "B" ? <TheCode /> : null}
          {current.key === "C" ? <TheNumber /> : null}
        </>
      )}
    />
  );
}
