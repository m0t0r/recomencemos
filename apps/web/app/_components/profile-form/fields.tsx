"use client";

/**
 * The fields, one component per kind, so the three prototype layouts compose
 * the same controls in different orders and hierarchies rather than each
 * restating a text input with its label, help, error and `aria-describedby`.
 *
 * Every control is **named for the form** (NFR4): the registry's `Input`,
 * `Textarea` and `RadioGroup`, each of which posts natively — Base UI keeps a
 * hidden native input beside each styled control. The registry's `Select` is
 * not used for the city: three options do not want a dropdown on a phone.
 *
 * **The message and the invalid flag are derived from the same thing**, the
 * fix `/sign-in` made: the server's verdict and the client's are one `message`,
 * so `aria-describedby` never points at an element that is not rendered.
 */

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@repo/design-system/components/field";
import { Button } from "@repo/design-system/components/button";
import { Input } from "@repo/design-system/components/input";
import { Textarea } from "@repo/design-system/components/textarea";
import { RadioChips } from "@/app/_components/radio-chips";
import { useId } from "react";
import {
  ABOUT_HELP,
  ABOUT_LABEL,
  ADD_WORK_HISTORY_BUTTON,
  CITY_LEGEND,
  PHOTO_NOTE,
  REMOVE_WORK_HISTORY_BUTTON,
  WORK_HISTORY_HELP,
  WORK_HISTORY_LABEL,
  workHistoryLineLabel,
} from "@/app/_lib/profile-form/messages";
import {
  aboutField,
  CITY_IDS,
  cityField,
  LIMITS,
  optionalOnBlur,
  workHistoryLineField,
} from "@/app/_lib/profile-form/schema";
import {
  messageOf,
  type ProfileFieldsForm,
  type TextFieldName,
} from "@/app/_lib/profile-form/use-profile-fields";
import type { z } from "zod";

/** Proper nouns read the same in both languages; restated here so the browser needs no domain import. */
export const CITY_LABELS: Record<(typeof CITY_IDS)[number], string> = {
  pereira: "Pereira",
  dosquebradas: "Dosquebradas",
  santa_rosa_de_cabal: "Santa Rosa de Cabal",
};

export interface TextFieldProps {
  readonly form: ProfileFieldsForm;
  readonly name: TextFieldName;
  readonly id: string;
  readonly label: string;
  readonly help: string;
  readonly schema: z.ZodType<string, string>;
  readonly serverError?: string | undefined;
  readonly autoComplete?: string;
  readonly inputMode?: "text" | "tel";
  readonly type?: "text" | "tel";
  readonly maxLength?: number;
  readonly className?: string;
}

export function TextField({
  form,
  name,
  id,
  label,
  help,
  schema,
  serverError,
  autoComplete,
  inputMode,
  type = "text",
  maxLength,
  className,
}: TextFieldProps) {
  const helpId = useId();
  const errorId = useId();

  return (
    <form.Field name={name} validators={{ onBlur: optionalOnBlur(schema), onSubmit: schema }}>
      {(field) => {
        const message = messageOf(field.state.meta.errors) ?? serverError;
        const invalid = message !== undefined;

        return (
          <Field className={className}>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <FieldDescription id={helpId}>{help}</FieldDescription>
            <Input
              id={id}
              name={name}
              type={type}
              inputMode={inputMode}
              autoComplete={autoComplete}
              maxLength={maxLength}
              required
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              onBlur={field.handleBlur}
              aria-invalid={invalid}
              aria-describedby={invalid ? `${helpId} ${errorId}` : helpId}
            />
            {message === undefined ? null : <FieldError id={errorId}>{message}</FieldError>}
          </Field>
        );
      }}
    </form.Field>
  );
}

export interface FieldProps {
  readonly form: ProfileFieldsForm;
  readonly id: string;
  readonly serverError?: string | undefined;
}

export function AboutField({ form, id, serverError }: FieldProps) {
  const helpId = useId();
  const errorId = useId();

  return (
    <form.Field name="about" validators={{ onBlur: aboutField, onSubmit: aboutField }}>
      {(field) => {
        const message = messageOf(field.state.meta.errors) ?? serverError;
        const invalid = message !== undefined;

        return (
          <Field>
            <FieldLabel htmlFor={id}>{ABOUT_LABEL}</FieldLabel>
            <FieldDescription id={helpId}>{ABOUT_HELP}</FieldDescription>
            <Textarea
              id={id}
              name="about"
              rows={4}
              maxLength={LIMITS.about}
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              onBlur={field.handleBlur}
              aria-invalid={invalid}
              aria-describedby={invalid ? `${helpId} ${errorId}` : helpId}
            />
            {message === undefined ? null : <FieldError id={errorId}>{message}</FieldError>}
          </Field>
        );
      }}
    </form.Field>
  );
}

/** The three cities as chips, built once so the order and the labels have one source. */
const CITY_CHIPS = CITY_IDS.map((city) => ({ value: city, label: CITY_LABELS[city] }));

/**
 * Three items in a fieldset whose legend is the question.
 *
 * **The chips themselves are `RadioChips`**, shared with the browsable list's
 * city filter — Base UI renders a hidden native radio beside each item carrying
 * `name`, `value` and `required`, so a tap on the label picks the city with no
 * JavaScript and the form posts it (NFR4). What stays here is what only this
 * form has: the validator, the server's verdict, and the error the two produce
 * between them. Not a `Select`: three options do not want a dropdown on a phone.
 */
export function CityField({ form, id, serverError }: FieldProps) {
  const errorId = useId();

  return (
    <form.Field name="city" validators={{ onSubmit: cityField }}>
      {(field) => {
        const message = messageOf(field.state.meta.errors) ?? serverError;
        const invalid = message !== undefined;

        return (
          <FieldSet id={id} aria-describedby={invalid ? errorId : undefined} aria-invalid={invalid}>
            <FieldLegend variant="label">{CITY_LEGEND}</FieldLegend>
            <RadioChips
              name="city"
              required
              chips={CITY_CHIPS}
              value={field.state.value}
              onValueChange={field.handleChange}
              onBlur={field.handleBlur}
              invalid={invalid}
              layout="stack"
            />
            {message === undefined ? null : <FieldError id={errorId}>{message}</FieldError>}
          </FieldSet>
        );
      }}
    </form.Field>
  );
}

export interface WorkHistoryFieldsProps {
  readonly form: ProfileFieldsForm;
  readonly idFor: (index: number) => string;
  readonly groupId: string;
  readonly serverErrorFor: (index: number) => string | undefined;
  readonly hydrated: boolean;
}

/**
 * Up to five lines. Hydrated, one line to start and a button to add more;
 * unhydrated, three lines rendered outright — there is no button that works,
 * so the form offers the room instead.
 */
export function WorkHistoryFields({
  form,
  idFor,
  groupId,
  serverErrorFor,
  hydrated,
}: WorkHistoryFieldsProps) {
  const helpId = useId();

  return (
    <form.Field name="workHistory" mode="array">
      {(lines) => {
        const count = hydrated ? lines.state.value.length : Math.max(lines.state.value.length, 3);
        return (
          <FieldSet id={groupId} aria-describedby={helpId} className="gap-3">
            <FieldLegend variant="label">{WORK_HISTORY_LABEL}</FieldLegend>
            <FieldDescription id={helpId}>{WORK_HISTORY_HELP}</FieldDescription>
            {Array.from({ length: count }, (_, index) => (
              <WorkHistoryLine
                key={index}
                form={form}
                index={index}
                id={idFor(index)}
                serverError={serverErrorFor(index)}
                onRemove={
                  hydrated && lines.state.value.length > 1
                    ? () => lines.removeValue(index)
                    : undefined
                }
              />
            ))}
            {hydrated && lines.state.value.length < LIMITS.workHistoryLines ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => lines.pushValue("")}
              >
                {ADD_WORK_HISTORY_BUTTON}
              </Button>
            ) : null}
          </FieldSet>
        );
      }}
    </form.Field>
  );
}

function WorkHistoryLine({
  form,
  index,
  id,
  serverError,
  onRemove,
}: {
  form: ProfileFieldsForm;
  index: number;
  id: string;
  serverError: string | undefined;
  onRemove: (() => void) | undefined;
}) {
  const errorId = useId();

  return (
    <form.Field
      name={`workHistory[${index}]`}
      validators={{ onBlur: workHistoryLineField, onSubmit: workHistoryLineField }}
    >
      {(field) => {
        const message = messageOf(field.state.meta.errors) ?? serverError;
        const invalid = message !== undefined;

        return (
          <Field>
            <div className="flex items-end gap-2">
              <div className="flex flex-1 flex-col gap-2">
                <FieldLabel htmlFor={id} className="text-sm">
                  {workHistoryLineLabel(index + 1)}
                </FieldLabel>
                <Input
                  id={id}
                  name="workHistory"
                  maxLength={LIMITS.workHistoryLine}
                  value={field.state.value ?? ""}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  aria-invalid={invalid}
                  aria-describedby={invalid ? errorId : undefined}
                />
              </div>
              {onRemove ? (
                <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
                  {REMOVE_WORK_HISTORY_BUTTON}
                </Button>
              ) : null}
            </div>
            {message === undefined ? null : <FieldError id={errorId}>{message}</FieldError>}
          </Field>
        );
      }}
    </form.Field>
  );
}

/** The photo's place: a sentence, because the photo is another ticket's and NFR4's one exception. */
export function PhotoNote() {
  return <p className="text-muted-foreground text-sm">{PHOTO_NOTE}</p>;
}
