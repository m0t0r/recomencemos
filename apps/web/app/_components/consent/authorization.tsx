"use client";

/**
 * The *autorización*, in the two shapes it is needed in.
 *
 * {@link AuthorizationText} is the text alone, published on `/privacy` so that a
 * version recorded in a Consent row can be read back — a *reclamo* asks what she
 * agreed to, and a version pointing at nothing readable answers it no better than
 * an empty column.
 *
 * {@link AuthorizationConsent} is that text plus the control that takes the
 * consent, and it is what `/publish` (story 2) and the Offer form (story 6) render
 * **above their first field**. Before collection is the requirement rather than a
 * layout preference: deployment is continuous, so a form that collected a phone
 * number and asked afterwards would have collected it.
 *
 * **There is no hidden input here, and that is ADR-0015's third rule.** The two
 * versions are what the form *displayed*, not what she typed, so they travel as
 * bound arguments — `action.bind(null, versions)` with `bindArgsSchemas`, which
 * React encodes, the action validates on arrival, and a browser with JavaScript
 * unavailable still submits. A hidden `<input>` mirroring server state is the
 * shape that rule exists to replace, and `authorization.test.tsx` asserts its
 * absence so it cannot come back.
 *
 * **`"use client"` is for the checkbox and nothing else.** The registry's
 * `Checkbox` is Base UI and holds state; the text half renders identically on
 * either side of the boundary, and a Server Component may render both.
 */

import { Checkbox } from "@repo/design-system/components/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@repo/design-system/components/field";
import Link from "next/link";
import { useId } from "react";
import {
  AUTHORIZATION_CHECKBOX_HELP,
  AUTHORIZATION_TEXT,
  CONSENT_LABELS,
} from "@/app/_lib/consent/messages";

/** Where the full *aviso de privacidad* lives. English segment, per ADR-0012. */
export const PRIVACY_NOTICE_PATH = "/privacy";

/**
 * The anchor the *autorización* sits at, so a form can link straight to the text
 * it is showing a shortened form of.
 *
 * An `id` is an identifier, so it is English while everything rendered inside it
 * is `es-CO`.
 */
export const AUTHORIZATION_ANCHOR = "authorization";

/**
 * The *autorización*, as text.
 *
 * Rendered as separate paragraphs rather than one block: each sentence is a
 * distinct thing being authorized, and a screen reader's paragraph navigation is
 * how a person moves through a legal text she did not come here to read.
 */
export function AuthorizationText() {
  return (
    <div className="flex flex-col gap-2">
      {AUTHORIZATION_TEXT.map((paragraph) => (
        <p key={paragraph} className="text-pretty">
          {paragraph}
        </p>
      ))}
    </div>
  );
}

export interface AuthorizationConsentProps {
  /**
   * The form control's name. The consent itself **is** typed by her, so unlike
   * the versions it is an ordinary field rather than a bound argument.
   */
  readonly name?: string;
  /** Whatever the boundary parse said when she submitted without ticking it. */
  readonly error?: string;
}

/**
 * The text, and the control that takes the consent.
 *
 * **`required` is on the input**, so a browser refuses the submit before the
 * request is made and says so in the person's own language, with no JavaScript
 * involved. That is a courtesy rather than the guarantee — the guarantee is the
 * action's boundary parse, because an attacker posts straight past an attribute.
 * Both exist for the reason NFR4 and every authorization rule already give: the
 * client is where a person is helped and the server is where a rule is enforced.
 */
export function AuthorizationConsent({ name = "consent", error }: AuthorizationConsentProps) {
  const checkboxId = useId();
  const helpId = useId();
  const errorId = useId();

  return (
    // **No `data-invalid` on the `Field`, and its absence is the fix rather than
    // an omission.** That attribute paints `text-destructive` across the whole
    // group, which put the entire *autorización* in red the moment she submitted
    // without ticking the box — colouring the legal text she is being asked to
    // read as though the text were the mistake. It is not: her not ticking the
    // box is, and that is exactly what `FieldError` and the checkbox's
    // `aria-invalid` already say. `sign-in-form.tsx` and `admin-sign-in-form.tsx`
    // both leave it off for the same reason; this was the deviation.
    //
    // Caught by looking at the rendered page, not by a test — happy-dom applies
    // no stylesheet, so no assertion here can see a colour. The guard is the
    // running check at seam 3.
    <Field>
      <AuthorizationText />

      {/*
        **`FieldLabel` rather than `Label` plus a flex wrapper.** It is the
        registry's field-aware label — it lays the control out beside its text and
        carries the `has-data-checked:` treatment written for exactly this case,
        which a hand-rolled `<div className="flex …">` reimplements badly.

        **`id` lands on the real input, not on the control, and the pairing is
        built off it.** Base UI's `Checkbox` renders a `role="checkbox"` element
        beside a visually-hidden `<input type="checkbox">`: the input is the half
        a `<form>` posts and carries `name`, `value`, `required` and this `id`,
        while the control gets `aria-labelledby` derived from it. So dropping the
        `id`/`htmlFor` pair leaves the control with no accessible name at all —
        measured, not assumed: `authorization.test.tsx`'s role query is what
        caught it, and is what keeps it caught.
      */}
      <FieldLabel htmlFor={checkboxId} className="font-normal">
        <Checkbox
          id={checkboxId}
          name={name}
          value="true"
          required
          aria-describedby={error ? `${helpId} ${errorId}` : helpId}
          aria-invalid={error ? true : undefined}
        />
        {CONSENT_LABELS.AUTHORIZATION_CHECKBOX}
      </FieldLabel>

      {/*
        The transmission rides in the description rather than in the label. A
        label is held to five words and this is the sentence that makes the
        consent express (C15), so it is announced with the checkbox through
        `aria-describedby` instead of being lost to the word count.
      */}
      <FieldDescription id={helpId}>{AUTHORIZATION_CHECKBOX_HELP}</FieldDescription>

      {error ? <FieldError id={errorId}>{error}</FieldError> : null}

      {/* Link text names its destination — never `aquí`, never `más información`. */}
      <Link
        href={`${PRIVACY_NOTICE_PATH}#${AUTHORIZATION_ANCHOR}`}
        className="text-muted-foreground underline underline-offset-4"
      >
        {CONSENT_LABELS.NOTICE_LINK}
      </Link>
    </Field>
  );
}
