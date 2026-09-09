"use client";

/**
 * The Offer form: three fields, and — on his first Offer — the two he asserts
 * about himself.
 *
 * **The two facts come before the first field**, which is the acceptance
 * criterion and the tone matrix's own rule for this surface: a Hirer who learns
 * after submitting that a person reads it first has learned it too late to have
 * written differently.
 *
 * **The `<form>` keeps its native `action`** (ADR-0014, NFR4), so a submit before
 * hydration posts and the Server Action answers. `useActionForm` dispatches a
 * valid submit by hand for the reason documented there — a React form reset
 * clears the hidden native inputs Base UI keeps behind every checkbox.
 *
 * **The slug and the consent versions are bound, never hidden inputs**
 * (ADR-0015). The page binds them; this component never sees them, which is what
 * stops a mirror of them appearing in this JSX.
 *
 * **No TanStack Form here, unlike the publishing form**, and the reason is the
 * field set: five flat fields with no picker, no repeating group and no
 * cross-field rule. The per-field sentence is read off the same summary the
 * form-level list is built from, so the message a screen-reader user hears first
 * and the one a sighted person reads beside the input cannot come apart.
 */

import { Button } from "@repo/design-system/components/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@repo/design-system/components/field";
import { Input } from "@repo/design-system/components/input";
import { Textarea } from "@repo/design-system/components/textarea";
import { useId } from "react";
import { AuthorizationConsent } from "@/app/_components/consent/authorization";
import { INITIAL_RESULT, useActionForm } from "@/app/_lib/form/use-action-form";
import {
  HIRER_NAME_HELP,
  HIRER_NAME_LABEL,
  HIRER_PHONE_HELP,
  HIRER_PHONE_LABEL,
  OFFER_HEADING,
  OFFER_IMMUTABLE_NOTICE,
  OFFER_REVIEW_NOTICE,
  OFFER_REVIEW_WINDOW,
  OFFER_SEND_FAILED,
  PAY_HELP,
  PAY_LABEL,
  SEND_OFFER_BUTTON,
  SEND_OFFER_PENDING,
  WHEN_HELP,
  WHEN_LABEL,
  WORK_HELP,
  WORK_LABEL,
} from "../_lib/offer-messages";
import {
  browserParse,
  OFFER_LIMITS,
  type RefusedOfferValues,
  refusedOfferValues,
} from "../_lib/offer-schema";
import {
  offerFieldError,
  type OfferSummary,
  offerSummaryFromIssues,
  offerSummaryFromValidationErrors,
} from "../_lib/offer-summary";
import { sendOffer } from "../actions";
import { OfferSummaryRegion } from "./offer-summary-region";

export interface OfferFormProps {
  /**
   * The profile this Offer is for, and the two consent versions the page
   * displayed. **Both are bound into the action here rather than rendered as
   * hidden inputs** (ADR-0015): they travel with the submit, nobody types them,
   * React encodes them into the action reference, and the action validates them
   * on arrival. As a hidden field the slug would be the one an attacker edits to
   * address the Offer to somebody else.
   *
   * Bound in the client component rather than passed already-bound, which is the
   * shape `publish-form.tsx` set: a bound action crossing as a prop has to be
   * typed at the boundary, and the type that survives that crossing is wide
   * enough to accept an action of the wrong shape.
   */
  readonly profileSlug: string;
  readonly consentVersions: { readonly notice: string; readonly authorization: string };
  /**
   * Whether he has sent an Offer before — read from his Consent row by the page.
   *
   * It decides whether the identity fields and the *autorización* are rendered,
   * and nothing else. The action reads the same fact again and the domain reads
   * it a third time inside the transaction, which is the one that counts: this is
   * a rendering decision, not an authorization one.
   */
  readonly alreadyIdentified: boolean;
}

export function OfferForm({ profileSlug, consentVersions, alreadyIdentified }: OfferFormProps) {
  const workId = useId();
  const payId = useId();
  const whenId = useId();
  const nameId = useId();
  const phoneId = useId();

  const machine = useActionForm<OfferSummary, RefusedOfferValues>({
    action: sendOffer.bind(null, profileSlug, consentVersions),
    initial: INITIAL_RESULT,
    schema: browserParse(alreadyIdentified),
    faultMessage: OFFER_SEND_FAILED,
    summaryFromIssues: offerSummaryFromIssues,
    summaryFromValidationErrors: offerSummaryFromValidationErrors,
    refusedValuesOf: (result) => {
      const echoed = refusedOfferValues.safeParse(result.serverError?.input);
      return echoed.success ? echoed.data : undefined;
    },
  });

  const idFor = {
    workDescription: workId,
    payTerms: payId,
    whenText: whenId,
    hirerName: nameId,
    hirerPhone: phoneId,
  } as const;

  const errorFor = (field: keyof typeof idFor) => offerFieldError(machine.summary, field);

  /**
   * What he typed, when the server refused it.
   *
   * **`defaultValue` rather than a controlled value**, which is what makes this
   * work on both paths: the unhydrated page mounts fresh from the action's
   * result and needs its fields filled from it, and the hydrated one has the
   * browser's own values already and must not have them overwritten mid-typing.
   */
  const typed = machine.refusedValues;

  return (
    <section aria-labelledby={`${workId}-heading`} className="flex flex-col gap-6">
      <h2 id={`${workId}-heading`} className="text-2xl font-semibold tracking-tight">
        {OFFER_HEADING}
      </h2>

      {/*
        The two facts, before the first field. Not a card, not an alert: it is
        what the platform does, said plainly, and styling it as a warning would
        make the product's own work read as a caveat.
      */}
      <div className="text-muted-foreground flex flex-col gap-1 text-sm">
        <p>
          {OFFER_REVIEW_NOTICE} {OFFER_REVIEW_WINDOW}
        </p>
        <p>{OFFER_IMMUTABLE_NOTICE}</p>
      </div>

      <form
        action={machine.formAction}
        onSubmit={(event) => machine.guardSubmit(event, () => {})}
        // Withheld until hydration, so the browser's own `required` check is the
        // guard before our parse can be.
        noValidate={machine.hydrated}
        className="flex flex-col gap-6"
      >
        <OfferSummaryRegion
          summary={machine.summary}
          feedback={machine.feedback}
          summaryRef={machine.summaryRef}
          idFor={(field) => idFor[field]}
        />

        {alreadyIdentified ? null : (
          <>
            <Field data-invalid={errorFor("hirerName") ? true : undefined}>
              <FieldLabel htmlFor={nameId}>{HIRER_NAME_LABEL}</FieldLabel>
              <Input
                id={nameId}
                name="hirerName"
                required
                maxLength={OFFER_LIMITS.hirerName.max}
                autoComplete="name"
                defaultValue={typed?.hirerName ?? ""}
                aria-describedby={`${nameId}-help`}
                aria-invalid={errorFor("hirerName") ? true : undefined}
              />
              <FieldDescription id={`${nameId}-help`}>{HIRER_NAME_HELP}</FieldDescription>
              {errorFor("hirerName") ? <FieldError>{errorFor("hirerName")}</FieldError> : null}
            </Field>

            <Field data-invalid={errorFor("hirerPhone") ? true : undefined}>
              <FieldLabel htmlFor={phoneId}>{HIRER_PHONE_LABEL}</FieldLabel>
              <Input
                id={phoneId}
                name="hirerPhone"
                type="tel"
                inputMode="tel"
                required
                maxLength={OFFER_LIMITS.hirerPhone.max}
                autoComplete="tel"
                defaultValue={typed?.hirerPhone ?? ""}
                aria-describedby={`${phoneId}-help`}
                aria-invalid={errorFor("hirerPhone") ? true : undefined}
              />
              <FieldDescription id={`${phoneId}-help`}>{HIRER_PHONE_HELP}</FieldDescription>
              {errorFor("hirerPhone") ? <FieldError>{errorFor("hirerPhone")}</FieldError> : null}
            </Field>
          </>
        )}

        <Field data-invalid={errorFor("workDescription") ? true : undefined}>
          <FieldLabel htmlFor={workId}>{WORK_LABEL}</FieldLabel>
          <Textarea
            id={workId}
            name="workDescription"
            required
            rows={4}
            maxLength={OFFER_LIMITS.workDescription.max}
            defaultValue={typed?.workDescription ?? ""}
            aria-describedby={`${workId}-help`}
            aria-invalid={errorFor("workDescription") ? true : undefined}
          />
          <FieldDescription id={`${workId}-help`}>{WORK_HELP}</FieldDescription>
          {errorFor("workDescription") ? (
            <FieldError>{errorFor("workDescription")}</FieldError>
          ) : null}
        </Field>

        <Field data-invalid={errorFor("payTerms") ? true : undefined}>
          <FieldLabel htmlFor={payId}>{PAY_LABEL}</FieldLabel>
          <Input
            id={payId}
            name="payTerms"
            required
            maxLength={OFFER_LIMITS.payTerms.max}
            defaultValue={typed?.payTerms ?? ""}
            aria-describedby={`${payId}-help`}
            aria-invalid={errorFor("payTerms") ? true : undefined}
          />
          <FieldDescription id={`${payId}-help`}>{PAY_HELP}</FieldDescription>
          {errorFor("payTerms") ? <FieldError>{errorFor("payTerms")}</FieldError> : null}
        </Field>

        <Field data-invalid={errorFor("whenText") ? true : undefined}>
          <FieldLabel htmlFor={whenId}>{WHEN_LABEL}</FieldLabel>
          <Input
            id={whenId}
            name="whenText"
            required
            maxLength={OFFER_LIMITS.whenText.max}
            defaultValue={typed?.whenText ?? ""}
            aria-describedby={`${whenId}-help`}
            aria-invalid={errorFor("whenText") ? true : undefined}
          />
          <FieldDescription id={`${whenId}-help`}>{WHEN_HELP}</FieldDescription>
          {errorFor("whenText") ? <FieldError>{errorFor("whenText")}</FieldError> : null}
        </Field>

        {/*
          The *autorización*, on his first Offer only — before collection, which
          is the requirement rather than a layout preference. He is giving this
          platform his name and his number, and the draft had him consenting to
          nothing (C4, story 14).
        */}
        {alreadyIdentified ? null : <AuthorizationConsent />}

        <Button type="submit" disabled={machine.pending} className="self-start">
          {machine.pending ? SEND_OFFER_PENDING : SEND_OFFER_BUTTON}
        </Button>
      </form>
    </section>
  );
}
