"use client";

/**
 * A radio group drawn as bordered chips — the shape both places that ask a
 * person to pick one city already used, written once.
 *
 * **It is the structure that is shared, not the question.** Base UI renders a
 * hidden native radio beside each item carrying `name` and `value`, and the
 * label wraps the item and points at it by `id`; that pairing is the part worth
 * having in one place, because getting it wrong is silent — a label that points
 * at nothing still looks correct and stops being clickable. The publishing form
 * asks *which city do you work in* and the browsable list asks *which city am I
 * looking at*, and neither knows about the other.
 *
 * **The ids are this component's own.** Both callers used to mint them, one from
 * `useId` and one from a literal prefix, and the `htmlFor`/`id` pair had to agree
 * across two expressions in each. Owning them here removes the only thing about
 * this markup that could be wrong without looking wrong.
 *
 * **`layout` is two real cases and not a dial.** `stack` is a form field: one
 * full-width chip per line, which is what a thumb wants under a legend. `wrap`
 * is a filter bar: chips sized to their words, several to a line, because the
 * question is one of several on the same screen. The publishing form's own
 * `layout` prop is gone with this — it offered a `row` nothing ever passed, and
 * it produced full-width chips inside a `flex-wrap`, which is `stack` by another
 * route.
 */

import { FieldLabel } from "@repo/design-system/components/field";
import { RadioGroup, RadioGroupItem } from "@repo/design-system/components/radio-group";
import { cn } from "@repo/design-system/lib/utils";
import * as React from "react";

export interface RadioChip {
  readonly value: string;
  readonly label: string;
}

export function RadioChips({
  name,
  chips,
  value,
  onValueChange,
  onBlur,
  required,
  invalid,
  layout,
}: {
  readonly name: string;
  readonly chips: readonly RadioChip[];
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly onBlur?: () => void;
  readonly required?: boolean;
  readonly invalid?: boolean;
  /** `stack` for a form field, `wrap` for a filter bar. See the note above. */
  readonly layout: "stack" | "wrap";
}) {
  const base = React.useId();

  return (
    <RadioGroup
      name={name}
      required={required}
      value={value}
      onValueChange={(next) => onValueChange(String(next))}
      onBlur={onBlur}
      aria-invalid={invalid}
      className={layout === "wrap" ? "flex flex-wrap gap-2" : "gap-2"}
    >
      {chips.map((chip) => {
        const id = `${base}-${chip.value || "any"}`;

        return (
          <FieldLabel
            key={chip.value || "any"}
            htmlFor={id}
            className={cn(
              "border-border rounded-md border px-3 py-2 font-normal",
              layout === "stack" && "w-full",
            )}
          >
            <RadioGroupItem id={id} value={chip.value} />
            {chip.label}
          </FieldLabel>
        );
      })}
    </RadioGroup>
  );
}
