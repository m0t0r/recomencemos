"use client";

/**
 * PROTOTYPE — throwaway. Two alternative compositions of the Offer form, for
 * `?variant=b` and `?variant=c`. Variant A is the real `OfferForm`.
 *
 * They disagree about the three things `.impeccable/briefs/send-offer.md` leaves
 * `[open]`, and they disagree about them **together** rather than one axis at a
 * time — a cross-product of nine would be noise, and the interesting answer is
 * usually a recombination anyway:
 *
 * | | Where the form lives | How the promise is presented | Where the identity fields sit |
 * | --- | --- | --- | --- |
 * | **A** | Inline at the foot, open | A quiet paragraph above the fields | First, above the terms |
 * | **B** | Inline at the foot, framed | The frame's own header | Last, under a subheading of their own |
 * | **C** | Behind a disclosure — her page ends with one control | On the control, and again at the submit | In their own step inside the panel |
 *
 * **Everything not `[open]` is held constant on purpose**, so the comparison is
 * about composition: the same three fields, the same help text, the same
 * refusals, the same summary, the same *autorización*, the same machine. A
 * variant that changed the copy would be answering a question nobody asked.
 *
 * Written under prototype rules: no tests, no abstraction, and the shared parts
 * are lifted from `offer-form.tsx` rather than extracted from it. The winner is
 * rewritten into that file, not promoted from here.
 */

import { Button } from "@repo/design-system/components/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
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

export interface OfferFormVariantProps {
  readonly profileSlug: string;
  readonly consentVersions: { readonly notice: string; readonly authorization: string };
  readonly alreadyIdentified: boolean;
}

/** The machine and the field ids, identical across variants. */
function useOfferForm({ profileSlug, consentVersions, alreadyIdentified }: OfferFormVariantProps) {
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

  const ids = {
    workDescription: workId,
    payTerms: payId,
    whenText: whenId,
    hirerName: nameId,
    hirerPhone: phoneId,
  } as const;

  return {
    machine,
    ids,
    typed: machine.refusedValues,
    errorFor: (field: keyof typeof ids) => offerFieldError(machine.summary, field),
  };
}

type Form = ReturnType<typeof useOfferForm>;

function Terms({ machine: _machine, ids, typed, errorFor }: Form) {
  return (
    <>
      <Field data-invalid={errorFor("workDescription") ? true : undefined}>
        <FieldLabel htmlFor={ids.workDescription}>{WORK_LABEL}</FieldLabel>
        <Textarea
          id={ids.workDescription}
          name="workDescription"
          required
          rows={4}
          maxLength={OFFER_LIMITS.workDescription.max}
          defaultValue={typed?.workDescription ?? ""}
          aria-describedby={`${ids.workDescription}-help`}
          aria-invalid={errorFor("workDescription") ? true : undefined}
        />
        <FieldDescription id={`${ids.workDescription}-help`}>{WORK_HELP}</FieldDescription>
        {errorFor("workDescription") ? (
          <FieldError>{errorFor("workDescription")}</FieldError>
        ) : null}
      </Field>

      <Field data-invalid={errorFor("payTerms") ? true : undefined}>
        <FieldLabel htmlFor={ids.payTerms}>{PAY_LABEL}</FieldLabel>
        <Input
          id={ids.payTerms}
          name="payTerms"
          required
          maxLength={OFFER_LIMITS.payTerms.max}
          defaultValue={typed?.payTerms ?? ""}
          aria-describedby={`${ids.payTerms}-help`}
          aria-invalid={errorFor("payTerms") ? true : undefined}
        />
        <FieldDescription id={`${ids.payTerms}-help`}>{PAY_HELP}</FieldDescription>
        {errorFor("payTerms") ? <FieldError>{errorFor("payTerms")}</FieldError> : null}
      </Field>

      <Field data-invalid={errorFor("whenText") ? true : undefined}>
        <FieldLabel htmlFor={ids.whenText}>{WHEN_LABEL}</FieldLabel>
        <Input
          id={ids.whenText}
          name="whenText"
          required
          maxLength={OFFER_LIMITS.whenText.max}
          defaultValue={typed?.whenText ?? ""}
          aria-describedby={`${ids.whenText}-help`}
          aria-invalid={errorFor("whenText") ? true : undefined}
        />
        <FieldDescription id={`${ids.whenText}-help`}>{WHEN_HELP}</FieldDescription>
        {errorFor("whenText") ? <FieldError>{errorFor("whenText")}</FieldError> : null}
      </Field>
    </>
  );
}

function Identity({ ids, typed, errorFor }: Form) {
  return (
    <>
      <Field data-invalid={errorFor("hirerName") ? true : undefined}>
        <FieldLabel htmlFor={ids.hirerName}>{HIRER_NAME_LABEL}</FieldLabel>
        <Input
          id={ids.hirerName}
          name="hirerName"
          required
          maxLength={OFFER_LIMITS.hirerName.max}
          autoComplete="name"
          defaultValue={typed?.hirerName ?? ""}
          aria-describedby={`${ids.hirerName}-help`}
          aria-invalid={errorFor("hirerName") ? true : undefined}
        />
        <FieldDescription id={`${ids.hirerName}-help`}>{HIRER_NAME_HELP}</FieldDescription>
        {errorFor("hirerName") ? <FieldError>{errorFor("hirerName")}</FieldError> : null}
      </Field>

      <Field data-invalid={errorFor("hirerPhone") ? true : undefined}>
        <FieldLabel htmlFor={ids.hirerPhone}>{HIRER_PHONE_LABEL}</FieldLabel>
        <Input
          id={ids.hirerPhone}
          name="hirerPhone"
          type="tel"
          inputMode="tel"
          required
          maxLength={OFFER_LIMITS.hirerPhone.max}
          autoComplete="tel"
          defaultValue={typed?.hirerPhone ?? ""}
          aria-describedby={`${ids.hirerPhone}-help`}
          aria-invalid={errorFor("hirerPhone") ? true : undefined}
        />
        <FieldDescription id={`${ids.hirerPhone}-help`}>{HIRER_PHONE_HELP}</FieldDescription>
        {errorFor("hirerPhone") ? <FieldError>{errorFor("hirerPhone")}</FieldError> : null}
      </Field>
    </>
  );
}

/**
 * **B — the promise is the frame.**
 *
 * The form sits inside a bordered panel whose header *is* the two facts, so the
 * promise is not a paragraph a reader can slide past: it is the thing the form is
 * inside. The terms lead and the identity fields come last under a subheading of
 * their own, on the argument that what he is writing matters more than who he is,
 * and that "who is asking" reads better as a closing question than an opening
 * hurdle.
 */
export function OfferFormVariantB(props: OfferFormVariantProps) {
  const form = useOfferForm(props);
  const { machine } = form;

  return (
    <section aria-labelledby={`${form.ids.workDescription}-heading`}>
      <div className="border-border overflow-hidden rounded-xl border">
        <header className="bg-muted/40 border-border flex flex-col gap-2 border-b px-5 py-4">
          <h2
            id={`${form.ids.workDescription}-heading`}
            className="text-xl font-semibold tracking-tight"
          >
            {OFFER_HEADING}
          </h2>
          <p className="text-muted-foreground text-sm">
            {OFFER_REVIEW_NOTICE} {OFFER_REVIEW_WINDOW}
          </p>
          <p className="text-foreground text-sm font-medium">{OFFER_IMMUTABLE_NOTICE}</p>
        </header>

        <form
          action={machine.formAction}
          onSubmit={(event) => machine.guardSubmit(event, () => {})}
          noValidate={machine.hydrated}
          className="flex flex-col gap-6 px-5 py-5"
        >
          <OfferSummaryRegion
            summary={machine.summary}
            feedback={machine.feedback}
            summaryRef={machine.summaryRef}
            idFor={(field) => form.ids[field]}
          />

          <Terms {...form} />

          {props.alreadyIdentified ? null : (
            <FieldSet className="gap-6">
              <FieldLegend variant="label">Quién le escribe</FieldLegend>
              <Identity {...form} />
              <AuthorizationConsent />
            </FieldSet>
          )}

          <Button type="submit" disabled={machine.pending} className="self-start">
            {machine.pending ? SEND_OFFER_PENDING : SEND_OFFER_BUTTON}
          </Button>
        </form>
      </div>
    </section>
  );
}

/**
 * **C — one control, then a panel.**
 *
 * Her page ends with a single affordance rather than a form, so the page stays a
 * page about her and the writing is something he chooses to start. The promise
 * rides on the control — he reads it before the form exists — and the
 * immutability is repeated at the submit, where the decision is actually made.
 * The identity fields are the panel's first step, fenced as their own group.
 *
 * **A native `<details>`, so it costs no JavaScript and no ARIA of its own** —
 * which is also what keeps NFR4 true of a variant whose whole idea is that the
 * form starts hidden.
 */
export function OfferFormVariantC(props: OfferFormVariantProps) {
  const form = useOfferForm(props);
  const { machine } = form;

  return (
    <section aria-labelledby={`${form.ids.workDescription}-heading`}>
      <details className="group border-border rounded-xl border open:shadow-sm">
        {/*
          **The affordance is explicit**, and that is a fix rather than a
          flourish: the first draft was a heading and a sentence in a bordered
          box, which a person has no reason to read as something that opens. The
          chevron rotates on `open`, and the row is laid out so the control reads
          as a control at a glance.
        */}
        <summary className="flex cursor-pointer items-start justify-between gap-4 px-5 py-4">
          <span className="flex flex-col gap-1">
            <span
              id={`${form.ids.workDescription}-heading`}
              className="text-xl font-semibold tracking-tight"
            >
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
          noValidate={machine.hydrated}
          className="border-border flex flex-col gap-6 border-t px-5 py-5"
        >
          <OfferSummaryRegion
            summary={machine.summary}
            feedback={machine.feedback}
            summaryRef={machine.summaryRef}
            idFor={(field) => form.ids[field]}
          />

          {props.alreadyIdentified ? null : (
            <FieldSet className="gap-6">
              <FieldLegend variant="label">Primero, quién le escribe</FieldLegend>
              <Identity {...form} />
            </FieldSet>
          )}

          <Terms {...form} />

          {props.alreadyIdentified ? null : <AuthorizationConsent />}

          <div className="flex flex-col gap-2">
            {/*
              The immutability again, at the control rather than at the top: this
              is the moment the decision is taken, and the variant's whole claim
              is that a promise read once at the top of a panel is read too early.
            */}
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
