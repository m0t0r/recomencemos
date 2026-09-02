/**
 * The three municipalities a CapabilityProfile may name, and the one rule about
 * them: the identifier is English-shaped and the label is what she reads.
 *
 * **`TEXT` + `CHECK` rather than an `ENUM`**, per DD2 — the spec's own example
 * for that rule is _"adding a fourth municipality is then a constraint change
 * rather than a type alteration"_, so this registry is the list that constraint
 * is generated from, through `inList`. Its identifiers are underscored rather
 * than hyphenated because `inList` refuses anything that is not an identifier
 * it can inline into DDL, and `santa-rosa-de-cabal` is not one.
 *
 * **The label is a value, and it is the one place a Spanish string lives beside
 * an identifier in this package** — the `Skill.labelEs` shape (ADR-0012). A
 * proper noun reads the same in both languages, which is why no message module
 * in `apps/web` restates it.
 */

export const CITIES = [
  { id: "pereira", label: "Pereira" },
  { id: "dosquebradas", label: "Dosquebradas" },
  { id: "santa_rosa_de_cabal", label: "Santa Rosa de Cabal" },
] as const;

export type CityId = (typeof CITIES)[number]["id"];

export const CITY_IDS = CITIES.map((city) => city.id) as readonly CityId[];

export function isCityId(value: string): value is CityId {
  return (CITY_IDS as readonly string[]).includes(value);
}

/** The label for a stored id. Throws on an unknown id, because the `CHECK` makes one unreachable. */
export function cityLabel(id: CityId): string {
  const city = CITIES.find((candidate) => candidate.id === id);
  if (!city) throw new TypeError(`Unknown city id: ${id}`);
  return city.label;
}
