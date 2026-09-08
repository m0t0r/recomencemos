/**
 * The three controls that narrow `/profiles`, as one plain `GET` form.
 *
 * **There is no client JavaScript in this file, and that is the design rather
 * than an economy.** A `<form method="get">` puts what a person chose in the
 * query string by itself, which is every one of this surface's URL criteria at
 * once: the result set is shareable, the back button undoes a filter, and the
 * controls are usable from the first paint because nothing has to hydrate before
 * they work. It is also what keeps them interactive *while the list streams* —
 * the results sit in a Suspense boundary of their own, and a form that needed
 * hydration would be waiting on the same bundle the boundary is.
 *
 * **Submitting drops the page cursor for free.** A `GET` form sends its own
 * fields and nothing else, so changing a filter puts the reader at the top of
 * the new list rather than at row 48 of a list that no longer has 48 rows. The
 * cursor is re-attached only by the paging link, which is where it belongs.
 *
 * **The two lists are native `<select>` elements, and the registry's `Select` is
 * deliberately not used.** That component is a Base UI widget whose trigger is a
 * `<button>`: with JavaScript unavailable it opens nothing and submits nothing,
 * which would take the whole argument above with it. The precedent is the
 * publish form's city field, which declines the same component for a reason of
 * its own — three options do not want a dropdown on a phone. Ninety Skills do,
 * so this one is a list rather than a radio group, and it is the platform's own
 * list: on a phone it is the wheel picker a person already knows.
 *
 * The classes are `Input`'s, so the three controls sit on one line at one height
 * rather than the select drifting a pixel off the box beside it.
 */

import { Button } from "@repo/design-system/components/button";
import { buttonVariants } from "@repo/design-system/components/button-variants";
import { Field, FieldDescription, FieldLabel } from "@repo/design-system/components/field";
import { Input } from "@repo/design-system/components/input";
import { CITIES } from "@repo/domain/policy";
import type { VocabularyEntry } from "@repo/domain/skills";
import Link from "next/link";

import {
  FILTER_ANY_CITY,
  FILTER_ANY_SKILL,
  FILTER_CITY_LABEL,
  FILTER_CLEAR,
  FILTER_SKILL_LABEL,
  FILTER_SUBMIT,
  FILTER_TEXT_HINT,
  FILTER_TEXT_LABEL,
  FILTER_TEXT_PLACEHOLDER,
  FILTERS_LEGEND,
} from "../_lib/messages";
import { type BrowseFilters, FILTER_KEYS, isNarrowed, MAX_QUERY_LENGTH } from "../_lib/filters";

/**
 * `Input`'s own box, on a native control.
 *
 * `appearance-none` is what stops the platform drawing a second chrome inside a
 * box that already has one; the arrow is drawn back as a background image so the
 * control still says it opens a list. `pr-8` is the room that arrow needs.
 */
const SELECT_CLASS =
  "border-input h-9 w-full min-w-0 appearance-none rounded-md border bg-transparent bg-[length:1rem] bg-[right_0.5rem_center] bg-no-repeat px-2.5 py-1 pr-8 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm " +
  "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22currentColor%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22m6 9 6 6 6-6%22/></svg>')]";

export function BrowseFiltersForm({
  vocabulary,
  filters,
}: {
  readonly vocabulary: readonly VocabularyEntry[];
  readonly filters: BrowseFilters;
}) {
  return (
    /*
      `<search>` rather than `role="search"` on the form: the element carries the
      role natively, and it is Baseline Widely Available well inside NFR5's floor
      — every browser in the four-engine set shipped it in late 2023. The
      `aria-label` names the landmark, because an unnamed one is one more
      anonymous region in a screen reader's rotor.
    */
    <search aria-label={FILTERS_LEGEND}>
      <form method="get" action="/profiles" className="flex flex-col gap-4">
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
            Off, all four. A capitalised first letter and an autocorrected trade
            name are two ways to search for something nobody published, and the
            fold this search runs on makes the capital pointless anyway.
          */
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <FieldDescription id="browse-filter-hint">{FILTER_TEXT_HINT}</FieldDescription>
        </Field>

        {/* Side by side from `sm` up; stacked on a phone, where two half-width selects would truncate every label. */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <Field className="sm:flex-1">
            <FieldLabel htmlFor="browse-filter-skill">{FILTER_SKILL_LABEL}</FieldLabel>
            <select
              id="browse-filter-skill"
              name={FILTER_KEYS.skill}
              defaultValue={filters.skill ?? ""}
              className={SELECT_CLASS}
            >
              <option value="">{FILTER_ANY_SKILL}</option>
              {vocabulary.map((skill) => (
                <option key={skill.slug} value={skill.slug}>
                  {skill.labelEs}
                </option>
              ))}
            </select>
          </Field>

          <Field className="sm:flex-1">
            <FieldLabel htmlFor="browse-filter-city">{FILTER_CITY_LABEL}</FieldLabel>
            <select
              id="browse-filter-city"
              name={FILTER_KEYS.city}
              defaultValue={filters.city ?? ""}
              className={SELECT_CLASS}
            >
              <option value="">{FILTER_ANY_CITY}</option>
              {CITIES.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit">{FILTER_SUBMIT}</Button>
          {/*
          A link rather than a reset: reset would restore the values the document
          arrived with, which on a filtered page are the filters themselves. The
          way out of a narrowed list is the unnarrowed one, and that is a URL.
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
