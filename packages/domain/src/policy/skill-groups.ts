/**
 * The groups the Skill vocabulary is sorted into, so a Hirer can find someone
 * by the kind of work before he knows the exact word for it.
 *
 * **A closed list in code, for `cities.ts`'s reason.** The column is `TEXT` +
 * `CHECK`, and this registry is the list that constraint is generated from
 * through `inList` — so adding a group is a constraint change rather than a type
 * alteration, and its identifiers are underscored because `inList` inlines them
 * into DDL. An Admin chooses among these when promoting a Skill and never adds
 * one; a new group is a migration a person reviews.
 *
 * The label is a value a person reads, beside an English identifier (ADR-0012).
 * Where the thirteen came from, and what `other` is for, is
 * [ADR-0021](../../../../docs/adr/0021-skills-are-grouped-from-a-closed-list.md).
 */

export const SKILL_GROUPS = [
  { id: "home_and_laundry", label: "Casa, aseo y ropa" },
  { id: "food", label: "Cocina y comida" },
  { id: "care_and_teaching", label: "Cuidado de personas y enseñanza" },
  { id: "beauty", label: "Belleza" },
  { id: "building", label: "Construcción y acabados" },
  { id: "furniture_and_textiles", label: "Muebles, costura y textil" },
  { id: "transport", label: "Transporte, mensajería y carga" },
  { id: "farm_and_garden", label: "Campo y jardín" },
  { id: "repairs", label: "Reparaciones" },
  { id: "commerce_and_office", label: "Comercio, oficina, seguridad y eventos" },
  { id: "remote_work", label: "Trabajo a distancia" },
  { id: "recycling", label: "Reciclaje" },
  { id: "other", label: "Otros trabajos" },
] as const;

export type SkillGroupId = (typeof SKILL_GROUPS)[number]["id"];

export const SKILL_GROUP_IDS = SKILL_GROUPS.map((group) => group.id) as readonly SkillGroupId[];

export function isSkillGroupId(value: string): value is SkillGroupId {
  return (SKILL_GROUP_IDS as readonly string[]).includes(value);
}
