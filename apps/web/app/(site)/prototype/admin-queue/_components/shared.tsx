"use client";

/**
 * PROTOTYPE — the mock queue the three Admin variants work through: five
 * sources in one list, oldest first, with the age of the oldest item as the
 * one number the operator watches. Approve and reject are in-memory.
 */

import { useEffect, useState } from "react";

export type Source = "offer" | "photo" | "report" | "skill" | "bounce";

export interface QueueItem {
  readonly id: string;
  readonly source: Source;
  readonly ageHours: number;
  readonly title: string;
  readonly body: string;
  readonly meta: string;
}

export const SOURCE_LABEL: Record<Source, string> = {
  offer: "Propuesta",
  photo: "Foto",
  report: "Reporte",
  skill: "Capacidad pedida",
  bounce: "Correo rebotado",
};

export const QUEUE: readonly QueueItem[] = [
  {
    id: "q1",
    source: "report",
    ageHours: 31,
    title: "Yesica T. reportó una propuesta de Restaurante Doña Rosa",
    body: "«Ayudar en cocina un fin de semana de mucho movimiento.» Cuenta del Contratante congelada desde el reporte; una propuesta más suya está en espera.",
    meta: "Reportada hace 31 h · Contratante con 2 propuestas enviadas",
  },
  {
    id: "q2",
    source: "offer",
    ageHours: 19,
    title: "Patricia Londoño → Ana María R.",
    body: "Necesito almuerzo para 12 personas el sábado, en mi casa. Comida casera: sancocho o frijoles, arroz, ensalada y jugo. Yo pongo el mercado, tú cocinas y dejas la cocina como estaba. · $180.000 por el día, en efectivo al terminar · Sábado 19 de septiembre, de 8 a.m. a 3 p.m.",
    meta: "Primera propuesta de esta cuenta · nombre y teléfono declarados",
  },
  {
    id: "q3",
    source: "photo",
    ageHours: 14,
    title: "Foto de Wilmar C.",
    body: "Retrato de frente, fondo de pared clara, una sola persona, sin texto ni logos.",
    meta: "Subida hace 14 h · 640×640 · el perfil ya está en el muro con la inicial",
  },
  {
    id: "q4",
    source: "offer",
    ageHours: 9,
    title: "Miguel Restrepo → Ana María R.",
    body: "Mi mamá vive sola en Pereira y ya no cocina. Quisiera que le prepares almuerzo y comida tres veces por semana en su casa y le dejes porciones para el resto de los días. · $90.000 por visita, te consigno cada semana desde España · Lunes, miércoles y viernes, desde la semana que viene",
    meta: "Cuenta creada hace 2 días · desde España",
  },
  {
    id: "q5",
    source: "skill",
    ageHours: 6,
    title: "«Reparación de neveras y lavadoras»",
    body: "Pedida por Jhon Fredy M. al publicar. Lo más cercano en la lista: Arreglos y oficios varios.",
    meta: "1 persona la pidió · publicó con la más cercana mientras tanto",
  },
  {
    id: "q6",
    source: "bounce",
    ageHours: 3,
    title: "luzdary.o@example.com rebotó",
    body: "El correo con la propuesta de Familia Gómez no llegó. Tres intentos, buzón inexistente.",
    meta: "Luz Dary O. · la propuesta sigue visible en su cuenta",
  },
  {
    id: "q7",
    source: "photo",
    ageHours: 1,
    title: "Foto de Diana P.",
    body: "Retrato de frente con un niño al lado, fondo de aula.",
    meta: "Subida hace 1 h · aparece una segunda persona",
  },
];

export function formatAge(hours: number): string {
  if (hours < 1) return "menos de 1 h";
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} días`;
}

export type Decision = "approved" | "rejected" | "unfrozen" | "promoted" | "resent";

export function decisionsFor(
  source: Source,
): readonly { value: Decision; label: string; key: string }[] {
  switch (source) {
    case "offer":
      return [
        { value: "approved", label: "Entregar", key: "a" },
        { value: "rejected", label: "Rechazar", key: "r" },
      ];
    case "photo":
      return [
        { value: "approved", label: "Aprobar", key: "a" },
        { value: "rejected", label: "Rechazar", key: "r" },
      ];
    case "report":
      return [
        { value: "rejected", label: "Mantener congelado", key: "r" },
        { value: "unfrozen", label: "Descongelar", key: "a" },
      ];
    case "skill":
      return [
        { value: "promoted", label: "Agregar a la lista", key: "a" },
        { value: "rejected", label: "No agregar", key: "r" },
      ];
    case "bounce":
      return [
        { value: "resent", label: "Reintentar", key: "a" },
        { value: "rejected", label: "Dejar así", key: "r" },
      ];
  }
}

/** Keyboard: `j`/`k` move, `a`/`r` decide. Off while a field is focused. */
export function useQueueKeys(handlers: {
  readonly next: () => void;
  readonly prev: () => void;
  readonly decide: (key: "a" | "r") => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      if (event.key === "j") handlers.next();
      if (event.key === "k") handlers.prev();
      if (event.key === "a" || event.key === "r") handlers.decide(event.key);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers]);
}

export function useQueue() {
  const [done, setDone] = useState<Record<string, Decision>>({});
  const open = QUEUE.filter((item) => !done[item.id]).toSorted((a, b) => b.ageHours - a.ageHours);
  const oldest = open[0]?.ageHours ?? 0;
  function decide(id: string, decision: Decision) {
    setDone((prev) => ({ ...prev, [id]: decision }));
  }
  return { done, open, oldest, decide };
}
