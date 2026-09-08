/**
 * The three controls that narrow `/profiles`, as one plain `GET` form.
 *
 * **There is no client JavaScript in this file, and that is the design rather
 * than an economy.** A `<form method="get">` puts what a person chose in the
 * query string by itself, which is every one of this surface's URL criteria at
 * once: the result set is shareable, the back button undoes a filter, and the
 * controls work from first paint because nothing has to hydrate before they do.
 *
 * **Submitting drops the page cursor for free.** A `GET` form sends its own
 * fields and nothing else, so changing a filter puts the reader at the top of
 * the new list rather than at row 48 of a list that no longer has 48 rows. The
 * cursor is re-attached only by the paging link, which is where it belongs.
 *
 * **The city is the registry's `RadioGroup`, and the Skill is a native
 * `<select>`. The difference is the number of options, not a preference.** Base
 * UI renders a hidden native radio beside each `RadioGroupItem` carrying `name`
 * and `value`, so a radio group posts with JavaScript unavailable — which is why
 * the publish form's city field is one, and this is the same three cities. The
 * registry's `Select` is the component that cannot be reused: its trigger is a
 * `<button>`, so with JavaScript unavailable it opens nothing and submits
 * nothing. Ninety Skills are not a radio group, so that one control is the bare
 * tag, wearing the design system's own box through `selectBox` rather than a
 * copy of it.
 *
 * **The options stream inside the `<select>`.** The Skill list is a database
 * read and the rest of this form is not, so waiting for it would hold back two
 * controls that were ready — and the criterion is that the filters render
 * immediately. A `<select>` may only hold `<option>` and `<optgroup>`, so the
 * fallback is an `<option>`: the control is on screen, focusable and submittable
 * from the first paint, with its own list arriving a moment later.
 */

import { Button } from "@repo/design-system/components/button";
import { buttonVariants } from "@repo/design-system/components/button-variants";
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@repo/design-system/components/field";
import { Input } from "@repo/design-system/components/input";
import { selectBox } from "@repo/design-system/components/input-variants";
import { RadioGroup, RadioGroupItem } from "@repo/design-system/components/radio-group";
import { CITIES } from "@repo/domain/policy";
import Link from "next/link";
import type { ReactNode } from "react";
import { type BrowseFilters, FILTER_KEYS, isNarrowed, MAX_QUERY_LENGTH } from "../_lib/filters";
import {
  FILTER_ANY_CITY,
  FILTER_ANY_SKILL,
  FILTER_CITY_LABEL,
  FILTER_CLEAR,
  FILTER_SKILL_LABEL,
  FILTER_SKILLS_LOADING,
  FILTER_SUBMIT,
  FILTER_TEXT_HINT,
  FILTER_TEXT_LABEL,
  FILTER_TEXT_PLACEHOLDER,
  FILTERS_LEGEND,
} from "../_lib/messages";

export function BrowseFiltersForm({
  filters,
  skillOptions,
}: {
  readonly filters: BrowseFilters;
  /** The `<option>` list, streamed — see the note above about the fallback. */
  readonly skillOptions: ReactNode;
}) {
  return (
    /*
      `<search>` rather than `role="search"` on the form: the element carries the
      role natively, and it is Baseline Widely Available well inside the browser
      floor — every engine in the four-browser set shipped it in late 2023. The
      `aria-label` names the landmark, because an unnamed one is one more
      anonymous region in a screen reader's rotor.
    */
    <search aria-label={FILTERS_LEGEND}>
      <form method="get" action="/profiles" className="flex flex-col gap-5">
        <Field>
          <FieldLabel htmlFor="browse-filter-q">{FILTER_TEXT_LABEL}</FieldLabel>
          <Input
            id="browse-filter-q"
            type="search"
            name={FILTER_KEYS.query}
            defaultValue={filters.query}
            maxLength={MAX_QUERY_LENGTH}
            placeholder={FILTER_TEXT_PLACEHOLDER}
            aria-describedby="browse-filter-hint"
            /*
              Off, all three. A capitalised first letter and an autocorrected
              trade name are two ways to search for something nobody published,
              and the fold this search runs on makes the capital pointless.
            */
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <FieldDescription id="browse-filter-hint">{FILTER_TEXT_HINT}</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="browse-filter-skill">{FILTER_SKILL_LABEL}</FieldLabel>
          <select
            id="browse-filter-skill"
            name={FILTER_KEYS.skill}
            defaultValue={filters.skill ?? ""}
            className={selectBox}
          >
            <option value="">{FILTER_ANY_SKILL}</option>
            {skillOptions}
          </select>
        </Field>

        {/*
          A fieldset because the legend is the question every radio answers, and
          a `RadioGroup` because three named places are a choice a person makes
          in one tap rather than in two. `Cualquier ciudad` is the first item
          rather than an absent state: a radio group with nothing selected has no
          way back to "all of them" once something has been picked.
        */}
        <FieldSet>
          <FieldLegend variant="label">{FILTER_CITY_LABEL}</FieldLegend>
          <RadioGroup
            name={FILTER_KEYS.city}
            defaultValue={filters.city ?? ""}
            className="flex flex-wrap gap-2"
          >
            {[{ id: "", label: FILTER_ANY_CITY }, ...CITIES].map((city) => (
              <FieldLabel
                key={city.id || "any"}
                htmlFor={`browse-filter-city-${city.id || "any"}`}
                className="border-border rounded-md border px-3 py-2 font-normal"
              >
                <RadioGroupItem id={`browse-filter-city-${city.id || "any"}`} value={city.id} />
                {city.label}
              </FieldLabel>
            ))}
          </RadioGroup>
        </FieldSet>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit">{FILTER_SUBMIT}</Button>
          {/*
            A link rather than a reset: reset restores the values the document
            arrived with, which on a filtered page are the filters themselves.
            The way out of a narrowed list is the unnarrowed one, and that is a
            URL.
          */}
          {isNarrowed(filters) ? (
            <Link href="/profiles" className={buttonVariants({ variant: "ghost" })}>
              {FILTER_CLEAR}
            </Link>
          ) : null}
        </div>
      </form>
    </search>
  );
}

/** What sits in the `<select>` until the vocabulary read answers. */
export function SkillOptionsFallback() {
  return <option disabled>{FILTER_SKILLS_LOADING}</option>;
}
