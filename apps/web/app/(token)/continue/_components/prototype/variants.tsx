"use client";

/**
 * PROTOTYPE — three layouts for `/continue`, switchable with `?variant=`.
 *
 * Throwaway. This file lives on `prototype/125-continue-variants` and never on
 * `dev`: the winner is folded into `code-form.tsx` properly and the losers are
 * named on the pull request.
 *
 * **The question is layout only.** Everything the brief settled is fixed in all
 * three and is not up for a vote: one field taking either credential, the
 * description naming both, auto-submit on six digits, no chrome, one `<h1>`, no
 * word for the surface behind it. What differs is where the weight sits.
 *
 * - **A — Framed card.** What is built. A card on a muted ground, the same
 *   treatment `/sign-in` wears, so the two doors read as one product.
 * - **B — Bare column.** No card and no ground: the page *is* the field. Argues
 *   that a card is chrome on a screen whose whole brief is that it has none, and
 *   that one field should not look like a form.
 * - **C — One row.** The field and the button share a line, description beneath.
 *   Argues for the muscle-memory path: the shortest visual distance between
 *   arriving and being gone.
 */

import { Button } from "@repo/design-system/components/button";
import { Card } from "@repo/design-system/components/card";
import { Field, FieldDescription, FieldLabel } from "@repo/design-system/components/field";
import { Input } from "@repo/design-system/components/input";
import { CODE_DESCRIPTION, CODE_LABEL, CONTINUE_TITLE, SUBMIT_BUTTON } from "../../_lib/messages";

export const VARIANT_NAMES = {
  A: "Framed card",
  B: "Bare column",
  C: "One row",
} as const;

export type VariantKey = keyof typeof VARIANT_NAMES;

export interface VariantProps {
  readonly codeId: string;
  readonly descriptionId: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly pending: boolean;
  readonly region: React.ReactNode;
  readonly formProps: React.ComponentProps<"form">;
}

function CodeInput({ codeId, descriptionId, value, onChange, className }: VariantProps & { className?: string }) {
  return (
    <Input
      id={codeId}
      name="code"
      autoComplete="off"
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      // oxlint-disable-next-line jsx-a11y/no-autofocus -- prototype; the real surface argues for it.
      autoFocus
      required
      aria-describedby={descriptionId}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={className}
    />
  );
}

/** A — Framed card. The built one, and the one the other two argue with. */
export function VariantA(props: VariantProps) {
  return (
    <main className="bg-muted flex min-h-svh flex-col items-center justify-center px-4 py-12">
      <Card className="flex w-full max-w-sm flex-col gap-6 p-6 sm:p-8">
        <h1 className="text-foreground text-2xl leading-8 font-semibold tracking-tight">
          {CONTINUE_TITLE}
        </h1>
        {props.region}
        <form {...props.formProps} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor={props.codeId}>{CODE_LABEL}</FieldLabel>
            <FieldDescription id={props.descriptionId}>{CODE_DESCRIPTION}</FieldDescription>
            <CodeInput {...props} />
          </Field>
          <Button type="submit" className="w-full" disabled={props.pending} aria-busy={props.pending}>
            {SUBMIT_BUTTON}
          </Button>
        </form>
      </Card>
    </main>
  );
}

/**
 * B — Bare column. No card, page background, a larger heading and a taller
 * field. The weight is on the field itself rather than on a container.
 */
export function VariantB(props: VariantProps) {
  return (
    <main className="bg-background flex min-h-svh flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-xs flex-col gap-8">
        <h1 className="text-foreground text-3xl leading-9 font-semibold tracking-tight">
          {CONTINUE_TITLE}
        </h1>
        {props.region}
        <form {...props.formProps} className="flex flex-col gap-5">
          <Field>
            <FieldLabel htmlFor={props.codeId} className="sr-only">
              {CODE_LABEL}
            </FieldLabel>
            <CodeInput {...props} className="h-12 text-center text-lg tracking-[0.3em]" />
            <FieldDescription id={props.descriptionId} className="text-center">
              {CODE_DESCRIPTION}
            </FieldDescription>
          </Field>
          <Button type="submit" className="w-full" disabled={props.pending} aria-busy={props.pending}>
            {SUBMIT_BUTTON}
          </Button>
        </form>
      </div>
    </main>
  );
}

/**
 * C — One row. Field and button on one line, description under it. The shortest
 * visual distance between arriving and being gone.
 */
export function VariantC(props: VariantProps) {
  return (
    <main className="bg-muted flex min-h-svh flex-col items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-md flex-col gap-6">
        <h1 className="text-foreground text-2xl leading-8 font-semibold tracking-tight">
          {CONTINUE_TITLE}
        </h1>
        {props.region}
        <form {...props.formProps} className="flex flex-col gap-2">
          <FieldLabel htmlFor={props.codeId} className="sr-only">
            {CODE_LABEL}
          </FieldLabel>
          <div className="flex gap-2">
            <CodeInput {...props} className="h-10 flex-1" />
            <Button
              type="submit"
              className="h-10 shrink-0 px-6"
              disabled={props.pending}
              aria-busy={props.pending}
            >
              {SUBMIT_BUTTON}
            </Button>
          </div>
          <FieldDescription id={props.descriptionId}>{CODE_DESCRIPTION}</FieldDescription>
        </form>
      </div>
    </main>
  );
}

export const VARIANTS: Record<VariantKey, (props: VariantProps) => React.ReactElement> = {
  A: VariantA,
  B: VariantB,
  C: VariantC,
};
