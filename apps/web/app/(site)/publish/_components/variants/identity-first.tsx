"use client";

/**
 * Variant C — **"Primero quién eres"**: the conventional order every other
 * form she has met uses — name, city, then what she does — in one flowing
 * column with no fieldset boxes, the Skills as a wrapping grid of chips, and
 * **the summary at the top of the form** rather than above the button.
 *
 * The bet: familiarity beats teaching. The disclosure rule is said once, in
 * a single line under the heading, and then each held field says its own
 * sentence beside itself. The chip grid trades the scrolling list for a
 * denser tap surface that reads at a glance on a phone.
 */

import { Button } from "@repo/design-system/components/button";
import { FieldGroup } from "@repo/design-system/components/field";
import { AuthorizationConsent } from "@/app/_components/consent/authorization";
import {
  CONTACT_VISIBILITY,
  FEEDBACK_REGION_LABEL,
  FIRST_NAME_HELP,
  FIRST_NAME_LABEL,
  FULL_NAME_HELP,
  FULL_NAME_LABEL,
  HEADLINE_HELP,
  HEADLINE_LABEL,
  IDENTITY_VISIBILITY,
  LAST_INITIAL_HELP,
  LAST_INITIAL_LABEL,
  PHONE_HELP,
  PHONE_LABEL,
  PUBLISH_BUTTON,
} from "../../_lib/messages";
import {
  firstNameField,
  fullNameField,
  headlineField,
  lastInitialField,
  LIMITS,
  phoneField,
  skillSlugsField,
} from "../../_lib/schema";
import { messageOf } from "../../_lib/use-publish-form";
import { AboutField, CityField, PhotoNote, TextField, WorkHistoryFields } from "../fields";
import { FormSummary } from "../form-summary";
import { SkillPicker } from "../skill-picker";
import type { VariantProps } from "./index";

export function IdentityFirst({ form, machine, vocabulary, idFor, serverErrorFor }: VariantProps) {
  return (
    <FieldGroup>
      <FormSummary
        summary={machine.summary}
        feedback={machine.feedback}
        summaryRef={machine.summaryRef}
        idFor={idFor}
        label={FEEDBACK_REGION_LABEL}
      />

      <p className="text-muted-foreground text-sm">{IDENTITY_VISIBILITY}</p>

      <AuthorizationConsent error={serverErrorFor("consent")} />

      <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
        <TextField
          form={form}
          name="firstName"
          id={idFor("firstName")}
          label={FIRST_NAME_LABEL}
          help={FIRST_NAME_HELP}
          schema={firstNameField}
          serverError={serverErrorFor("firstName")}
          autoComplete="given-name"
          maxLength={LIMITS.firstName}
        />
        <TextField
          form={form}
          name="lastInitial"
          id={idFor("lastInitial")}
          label={LAST_INITIAL_LABEL}
          help={LAST_INITIAL_HELP}
          schema={lastInitialField}
          serverError={serverErrorFor("lastInitial")}
          maxLength={1}
          className="sm:w-56"
        />
      </div>

      <TextField
        form={form}
        name="fullName"
        id={idFor("fullName")}
        label={FULL_NAME_LABEL}
        help={FULL_NAME_HELP}
        schema={fullNameField}
        serverError={serverErrorFor("fullName")}
        autoComplete="name"
        maxLength={LIMITS.fullName}
      />

      <CityField form={form} id={idFor("city")} serverError={serverErrorFor("city")} layout="row" />

      <TextField
        form={form}
        name="phone"
        id={idFor("phone")}
        label={PHONE_LABEL}
        help={`${PHONE_HELP} ${CONTACT_VISIBILITY}`}
        schema={phoneField}
        serverError={serverErrorFor("phone")}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
      />

      <form.Field name="skillSlugs" validators={{ onSubmit: skillSlugsField }}>
        {(field) => (
          <SkillPicker
            id={idFor("skillSlugs")}
            vocabulary={vocabulary}
            selected={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={messageOf(field.state.meta.errors) ?? serverErrorFor("skillSlugs")}
            hydrated={machine.hydrated}
            layout="grid"
          />
        )}
      </form.Field>

      <TextField
        form={form}
        name="headline"
        id={idFor("headline")}
        label={HEADLINE_LABEL}
        help={HEADLINE_HELP}
        schema={headlineField}
        serverError={serverErrorFor("headline")}
        maxLength={LIMITS.headline}
      />

      <AboutField form={form} id={idFor("about")} serverError={serverErrorFor("about")} />

      <WorkHistoryFields
        form={form}
        groupId={idFor("workHistory")}
        idFor={(index) => idFor("workHistory", index)}
        serverErrorFor={(index) => serverErrorFor("workHistory", index)}
        hydrated={machine.hydrated}
      />

      <PhotoNote />

      <Button type="submit" size="lg" disabled={machine.pending} aria-busy={machine.pending}>
        {PUBLISH_BUTTON}
      </Button>
    </FieldGroup>
  );
}
