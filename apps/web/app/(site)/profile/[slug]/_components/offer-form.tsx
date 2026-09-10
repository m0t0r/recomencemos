"use client";

/**
 * The Offer form: three fields, and — on his first Offer — the two he asserts
 * about himself.
 *
 * **Her page ends with a control, not with a form** (`/prototype`, variant C,
 * picked 2026-09-09). The whole page above this is about one person, and a form
 * hanging open under it makes the last thing on the page a task rather than her.
 * So writing is something he opens: the promise rides on the control, he reads
 * it before the form exists, and the immutability is said again at the submit
 * where the decision is actually taken.
 *
 * **A native `<details>`, so it costs no JavaScript and no ARIA of its own** —
 * which is what keeps NFR4 true of a composition whose whole idea is that the
 * form starts closed. The chevron is the affordance: the first draft was a
 * heading in a bordered box, which nobody has a reason to read as something that
 * opens.
 *
 * **The two facts still come before the first field**, which is the acceptance
 * criterion and the tone matrix's own rule for this surface: a Hirer who learns
 * after submitting that a person reads it first has learned it too late to have
 * written differently. Closed, the control carries the human review and the
 * window; open, the immutability sits on the submit.
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
  const consentId = useId();

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
    consent: consentId,
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
    <section aria-labelledby={`${workId}-heading`}>
      <details className="group border-border rounded-xl border transition-shadow open:shadow-sm">
        {/*
          **The affordance is explicit.** A heading and a sentence in a bordered
          box is not something a person reads as openable; the chevron and the
          two-column row are what make this read as a control at a glance.

          The promise sits here rather than inside: closed is the state he meets
          first, so it is the state that has to carry *a person reads every one of
          these, and it takes about a day*.
        */}
        <summary className="flex cursor-pointer items-start justify-between gap-4 px-5 py-4">
          <span className="flex flex-col gap-1">
            <span id={`${workId}-heading`} className="text-xl font-semibold tracking-tight">
              {OFFER_HEADING}
            </span>
            <span className="text-muted-foreground text-sm">
              {OFFER_REVIEW_NOTICE} {OFFER_REVIEW_WINDOW}
            </span>
          </span>
          <span
            aria-hidden="true"
            className="text-muted-foreground mt-1 shrink-0 transition-transform group-open:rotate-90"
          >
            ›
          </span>
        </summary>

        <form
          action={machine.formAction}
          onSubmit={(event) => machine.guardSubmit(event, () => {})}
          // Withheld until hydration, so the browser's own `required` check is the
          // guard before our parse can be.
          noValidate={machine.hydrated}
          className="border-border flex flex-col gap-6 border-t px-5 py-5"
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
          {alreadyIdentified ? null : (
            <AuthorizationConsent id={idFor.consent} error={errorFor("consent")} />
          )}

          {/*
          **The immutability again, at the control rather than only at the top.**
          This is the moment the decision is taken, and a promise read once at the
          head of a panel is read too early to change what he writes.
        */}
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-sm">{OFFER_IMMUTABLE_NOTICE}</p>
            <Button type="submit" disabled={machine.pending} className="self-start">
              {machine.pending ? SEND_OFFER_PENDING : SEND_OFFER_BUTTON}
            </Button>
          </div>
        </form>
      </details>
    </section>
  );
}
