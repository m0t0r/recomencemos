/**
 * A profile's Skills, as chips.
 *
 * **It exists because of a defect a screenshot caught.** The registry's `Badge`
 * is `shrink-0 whitespace-nowrap h-5`, which is right for a status pill and
 * wrong for a Skill: the vocabulary's labels are verb phrases — _"Acompañar y
 * cuidar personas mayores"_ is 34 characters — and one wider than its column
 * escaped the card's border rather than wrapping. Three overrides fix it, all
 * **at the call site**, because files under `src/components/` are registry
 * output that `shadcn add --overwrite` replaces wholesale:
 *
 * - `max-w-full` so a chip can never be wider than the row it sits in,
 * - `whitespace-normal` so a long label wraps instead of overflowing,
 * - `h-auto` and a little vertical padding, because the fixed `h-5` would clip
 *   the second line the moment one exists.
 *
 * **Truncation was the other option and it is the wrong one.** What a chip holds
 * is a thing she can do; cutting it off mid-phrase costs the reader the
 * capability and costs her the work.
 *
 * `role="list"` is restated for the reason `profile-list.tsx` gives.
 */

import { Badge } from "@repo/design-system/components/badge";
import type { VocabularyEntry } from "@repo/domain/skills";

export function SkillChips({ skills }: { readonly skills: readonly VocabularyEntry[] }) {
  if (skills.length === 0) return null;

  return (
    // oxlint-disable-next-line no-redundant-roles -- see profile-list.tsx.
    <ul className="flex flex-wrap gap-1.5" role="list">
      {skills.map((skill) => (
        <li key={skill.slug} className="flex min-w-0">
          <Badge variant="secondary" className="h-auto max-w-full py-1 whitespace-normal">
            {skill.labelEs}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
