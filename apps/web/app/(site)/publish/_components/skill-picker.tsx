"use client";

/**
 * The Skill picker — product, not a design-system primitive (spec, Components),
 * which is why it lives here and composes the registry rather than joining it.
 *
 * **Registry checkboxes, named for the form.** Every entry is the registry's
 * `Checkbox` with `name="skillSlugs"` and its slug as `value`. Base UI renders
 * a hidden native `<input type="checkbox">` beside the styled control, carrying
 * the name, the value and the `id` the label pairs with — so a tap on the label
 * ticks the native input with no JavaScript at all and the form posts exactly
 * what a hydrated one does (NFR4). `authorization.tsx` relies on the same
 * pairing; seam 3 verifies it with scripting off.
 *
 * **Operable from the keyboard alone, and not only by tabbing ninety times.**
 * Arrow keys move focus between the entries, Home and End jump to the ends,
 * Space toggles — an enhancement over Tab order, which still works. The filter
 * box narrows the list once hydrated and is absent before, so it cannot
 * promise what it cannot do.
 *
 * **"Not on the list" is here and reachable.** Its action is story 3's; today
 * it reveals a sentence saying so and pointing at the closest entry. A control
 * that promised a request nobody can yet make would be a dead end.
 *
 * **The chosen entries are echoed above the list** as badges, so she never has
 * to scroll to count them, and at the maximum the rest are disabled with a
 * sentence rather than silently ignored.
 */

import { Badge } from "@repo/design-system/components/badge";
import { Checkbox } from "@repo/design-system/components/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@repo/design-system/components/field";
import { Input } from "@repo/design-system/components/input";
import { cn } from "@repo/design-system/lib/utils";
import { type KeyboardEvent, useId, useState } from "react";
import {
  SKILL_FILTER_LABEL,
  SKILL_NOT_LISTED_HELP,
  SKILL_NOT_LISTED_LABEL,
  SKILLS_AT_MAXIMUM,
  SKILLS_HELP,
  SKILLS_LABEL,
  skillsChosen,
  skillsNoneMatch,
} from "../_lib/messages";
import { LIMITS } from "../_lib/schema";

export interface VocabularyEntry {
  readonly slug: string;
  readonly labelEs: string;
}

export interface SkillPickerProps {
  readonly id: string;
  readonly vocabulary: readonly VocabularyEntry[];
  readonly selected: readonly string[];
  readonly onChange: (selected: string[]) => void;
  readonly onBlur?: () => void;
  readonly error?: string | undefined;
  /** Whether the page has hydrated: the filter box exists only then. */
  readonly hydrated: boolean;
  /** The entries as a scrolling list, or as a wrapping grid of chips. */
  readonly layout?: "list" | "grid";
}

function fold(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase();
}

/**
 * Arrow keys move between the entries; Home and End jump; Tab still works.
 *
 * On the fieldset, in the capture phase, because Base UI's `Checkbox` neither
 * forwards a `keyDown` handler to its control nor lets the event bubble past
 * it — and it acts on Home and End itself, so the native event is stopped
 * outright once handled (all three measured, not assumed). Only the entries
 * carrying `data-skill-entry` take part: the "not on the list" control below
 * the list is a checkbox too, and it is not a place End should land.
 */
function moveFocus(event: KeyboardEvent<HTMLFieldSetElement>) {
  if (!["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key))
    return;

  const boxes = [...event.currentTarget.querySelectorAll<HTMLElement>("[data-skill-entry]")];
  const current = boxes.indexOf(document.activeElement as HTMLElement);
  if (current === -1) return;

  event.preventDefault();
  event.stopPropagation();
  event.nativeEvent.stopImmediatePropagation();

  const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? boxes.length - 1
        : forward
          ? Math.min(current + 1, boxes.length - 1)
          : Math.max(current - 1, 0);
  boxes[next]?.focus();
}

export function SkillPicker({
  id,
  vocabulary,
  selected,
  onChange,
  onBlur,
  error,
  hydrated,
  layout = "list",
}: SkillPickerProps) {
  const helpId = useId();
  const errorId = useId();
  const countId = useId();
  const filterId = useId();
  const entryId = useId();
  const notListedId = useId();
  const notListedHelpId = useId();
  const [query, setQuery] = useState("");
  const [notListed, setNotListed] = useState(false);

  const atMaximum = selected.length >= LIMITS.skills;
  const needle = fold(query.trim());
  const shown = needle
    ? vocabulary.filter((entry) => fold(entry.labelEs).includes(needle))
    : vocabulary;
  const chosen = vocabulary.filter((entry) => selected.includes(entry.slug));

  function toggle(slug: string, checked: boolean) {
    onChange(checked ? [...selected, slug] : selected.filter((candidate) => candidate !== slug));
  }

  const describedBy = [helpId, countId, error ? errorId : undefined].filter(Boolean).join(" ");

  return (
    <FieldSet
      id={id}
      aria-describedby={describedBy}
      aria-invalid={error ? true : undefined}
      className="gap-3"
      /*
        On the fieldset, in the capture phase, because Base UI's `Checkbox`
        neither forwards a `keyDown` handler to its control nor lets the event
        bubble past it (measured, not assumed). The handler only moves focus
        between the checkboxes inside, each of which is itself interactive; the
        fieldset is not made interactive by it.
      */
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
      onKeyDownCapture={moveFocus}
      onBlur={onBlur}
    >
      <FieldLegend>{SKILLS_LABEL}</FieldLegend>
      <FieldDescription id={helpId}>{SKILLS_HELP}</FieldDescription>

      {/*
        The count and the chosen labels, as a polite live region: the number
        changes on every tick and is the fact she would otherwise scroll to
        confirm.
      */}
      <div id={countId} aria-live="polite" className="flex flex-col gap-2 text-sm">
        <p>
          {skillsChosen(selected.length)}
          {atMaximum ? ` ${SKILLS_AT_MAXIMUM}` : null}
        </p>
        {chosen.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {chosen.map((entry) => (
              <li key={entry.slug}>
                <Badge variant="secondary">{entry.labelEs}</Badge>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {hydrated ? (
        <Field>
          <FieldLabel htmlFor={filterId}>{SKILL_FILTER_LABEL}</FieldLabel>
          <Input
            id={filterId}
            type="search"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </Field>
      ) : null}

      {shown.length === 0 ? (
        <p className="text-muted-foreground text-sm">{skillsNoneMatch(query.trim())}</p>
      ) : (
        <div
          className={cn(
            layout === "grid"
              ? "flex flex-wrap gap-2"
              : "border-border flex max-h-80 flex-col gap-1 overflow-y-auto rounded-md border p-2",
          )}
        >
          {shown.map((entry) => {
            const checked = selected.includes(entry.slug);
            const boxId = `${entryId}-${entry.slug}`;
            return (
              <FieldLabel
                key={entry.slug}
                htmlFor={boxId}
                className={cn(
                  "font-normal",
                  layout === "grid"
                    ? "border-border rounded-full border px-3 py-1.5 text-sm"
                    : "w-full rounded-md px-2 py-2 text-sm",
                )}
              >
                <Checkbox
                  id={boxId}
                  data-skill-entry=""
                  name="skillSlugs"
                  value={entry.slug}
                  checked={checked}
                  disabled={atMaximum && !checked}
                  onCheckedChange={(next) => toggle(entry.slug, next === true)}
                />
                {entry.labelEs}
              </FieldLabel>
            );
          })}
        </div>
      )}

      {error ? <FieldError id={errorId}>{error}</FieldError> : null}

      <Field>
        <FieldLabel htmlFor={notListedId} className="font-normal">
          <Checkbox
            id={notListedId}
            checked={notListed}
            onCheckedChange={(checked) => setNotListed(checked === true)}
            aria-describedby={notListed ? notListedHelpId : undefined}
          />
          {SKILL_NOT_LISTED_LABEL}
        </FieldLabel>
        {notListed ? (
          <FieldDescription id={notListedHelpId}>{SKILL_NOT_LISTED_HELP}</FieldDescription>
        ) : null}
      </Field>
    </FieldSet>
  );
}
