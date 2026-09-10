"use client";

/**
 * PROTOTYPE — what the three publish variants share: the draft shape, the
 * Skill chip picker and the resulting Wall row, so every variant ends on the
 * same proof of what she published.
 */

import { Avatar, AvatarFallback } from "@repo/design-system/components/avatar";
import { Badge } from "@repo/design-system/components/badge";
import { useState } from "react";
import { CITY_LABEL, initialOf, type MockCity, type MockSkill, SKILLS } from "../../_lib/mock";

export interface Draft {
  headline: string;
  skillSlugs: readonly string[];
  city: MockCity | "";
  firstName: string;
  lastInitial: string;
  fullName: string;
  phone: string;
  about: string;
}

export const EMPTY_DRAFT: Draft = {
  headline: "",
  skillSlugs: [],
  city: "",
  firstName: "",
  lastInitial: "",
  fullName: "",
  phone: "",
  about: "",
};

export const CITIES: readonly MockCity[] = ["pereira", "dosquebradas", "santa-rosa"];

export function SkillPicker({
  value,
  onChange,
  max = 5,
}: {
  readonly value: readonly string[];
  readonly onChange: (next: readonly string[]) => void;
  readonly max?: number;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLocaleLowerCase("es-CO");
  const shown = q
    ? SKILLS.filter((skill) => skill.labelEs.toLocaleLowerCase("es-CO").includes(q))
    : SKILLS;
  const groups = [...new Set(shown.map((skill) => skill.group))];

  function toggle(slug: string) {
    if (value.includes(slug)) onChange(value.filter((s) => s !== slug));
    else if (value.length < max) onChange([...value, slug]);
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar en la lista…"
        aria-label="Buscar una capacidad"
        className="border-input h-10 rounded-md border bg-transparent px-3"
      />
      <p className="text-muted-foreground text-sm">
        Elige hasta {max}. Llevas {value.length}.
      </p>
      {groups.map((group) => (
        <fieldset key={group} className="flex flex-col gap-2">
          <legend className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
            {group}
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {shown
              .filter((skill) => skill.group === group)
              .map((skill) => {
                const on = value.includes(skill.slug);
                return (
                  <button
                    key={skill.slug}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(skill.slug)}
                    className={`rounded-md border px-3 py-1.5 text-left text-sm ${
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background"
                    }`}
                  >
                    {skill.labelEs}
                  </button>
                );
              })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

export function skillsFor(slugs: readonly string[]): readonly MockSkill[] {
  return slugs.flatMap((slug) => SKILLS.filter((skill) => skill.slug === slug));
}

/** The row exactly as the Wall would show it. */
export function WallRowPreview({ draft }: { readonly draft: Draft }) {
  const name = [draft.firstName.trim(), draft.lastInitial.trim() ? `${draft.lastInitial}.` : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <article className="flex gap-4 py-5">
      <Avatar size="lg" className="shrink-0" aria-hidden="true">
        <AvatarFallback>{initialOf(draft.firstName) || "?"}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-heading text-foreground text-2xl leading-7 font-medium text-pretty">
            {draft.headline || (
              <span className="text-muted-foreground">Tu línea, en tus palabras</span>
            )}
          </p>
          <p className="text-muted-foreground text-sm">
            {name || "Nombre A."} · {draft.city ? CITY_LABEL[draft.city] : "Ciudad"}
          </p>
        </div>
        <ul className="flex flex-wrap gap-1.5">
          {skillsFor(draft.skillSlugs).map((skill) => (
            <li key={skill.slug}>
              <Badge variant="secondary" className="h-auto py-1 whitespace-normal">
                {skill.labelEs}
              </Badge>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

export function Published({ draft }: { readonly draft: Draft }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="page-heading">Ya estás en el muro</h1>
        <p className="text-muted-foreground text-pretty">
          Esto es lo que ve cualquiera. Tu nombre completo y tu teléfono no están aquí: solo los
          recibe quien tú aceptes.
        </p>
      </div>
      <div className="ruled-page">
        <WallRowPreview draft={draft} />
      </div>
    </div>
  );
}
