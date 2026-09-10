"use client";

/**
 * PROTOTYPE — the row the three browse variants share when they show a person,
 * and the keyword matcher two of them use. Each variant owns its page shape.
 */

import { Avatar, AvatarFallback } from "@repo/design-system/components/avatar";
import { Badge } from "@repo/design-system/components/badge";
import {
  CITY_LABEL,
  displayName,
  initialOf,
  type MockSkill,
  type MockWorker,
  SKILLS,
  skillsOf,
} from "../../_lib/mock";

export function WorkerRow({
  worker,
  chips = true,
  highlight,
}: {
  readonly worker: MockWorker;
  readonly chips?: boolean;
  readonly highlight?: readonly string[];
}) {
  return (
    <article className="flex gap-4 py-5">
      <Avatar size="lg" className="shrink-0" aria-hidden="true">
        <AvatarFallback>{initialOf(worker.firstName)}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="font-heading text-foreground text-2xl leading-7 font-medium text-pretty">
            <button type="button" className="hover:text-primary text-left">
              {worker.headline}
            </button>
          </h2>
          <p className="text-muted-foreground text-sm">
            {displayName(worker)} · {CITY_LABEL[worker.city]}
          </p>
        </div>
        {chips ? (
          <ul className="flex flex-wrap gap-1.5">
            {skillsOf(worker).map((skill) => (
              <li key={skill.slug}>
                <Badge
                  variant={highlight?.includes(skill.slug) ? "default" : "secondary"}
                  className="h-auto py-1 whitespace-normal"
                >
                  {skill.labelEs}
                </Badge>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}

const WORDS: Record<string, readonly string[]> = {
  "home-cooking": ["cocin", "almuerzo", "comida", "cena"],
  "traditional-cooking": ["típic", "sancocho", "frijol"],
  "kitchen-assistance": ["cocina", "ayud"],
  "baking-and-pastry": ["torta", "pan", "postre"],
  "table-service": ["evento", "mesero", "fiesta", "atender"],
  "home-cleaning": ["aseo", "limpi", "casa"],
  "laundry-and-ironing": ["ropa", "planch", "lav"],
  "odd-jobs": ["arregl", "reparar", "todero", "daño"],
  plumbing: ["tub", "plomer", "destap", "agua"],
  painting: ["pint"],
  electrical: ["luz", "eléctric", "electric", "toma"],
  masonry: ["obra", "muro", "enchape", "pared"],
  "child-care": ["niñ", "hijo", "bebé"],
  "elder-care": ["mamá", "papá", "abuel", "mayor", "acompañ"],
  "patient-companionship": ["paciente", "clínica", "hospital"],
  "motorcycle-delivery": ["domicilio", "moto", "entreg", "llevar"],
  driving: ["conductor", "manej", "carro", "llevar"],
  hairdressing: ["pelo", "corte", "manicure", "peluquer"],
  tutoring: ["clase", "tarea", "matemát", "leer", "colegio"],
  spreadsheets: ["excel", "factur", "contab", "hoja"],
  "customer-service": ["cliente", "llamada", "whatsapp", "atenci"],
  sewing: ["coser", "costura", "ropa", "arreglo"],
  gardening: ["jardín", "jardin", "poda", "matas"],
};

export function skillsForNeed(text: string): readonly MockSkill[] {
  const lower = text.toLocaleLowerCase("es-CO");
  if (lower.trim().length < 3) return [];
  return SKILLS.filter((skill) => (WORDS[skill.slug] ?? []).some((word) => lower.includes(word)));
}
