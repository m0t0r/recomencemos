"use client";

/**
 * Variant A — **"Por lo que ves"**: the brief's default. One column, three
 * fieldsets whose boundaries *are* the disclosure rule, capability before
 * identity, the summary above the button, the button last.
 *
 * The bet: a Worker learns what is public and what is held from the shape of
 * the form, without a paragraph about it, and the first thing she is asked
 * is what she can do rather than who she is (voice guide, Do 5).
 */

import { Button } from "@repo/design-system/components/button";
import {
  FieldDescription,
  FieldGroup,
  FieldLegend,
  FieldSet,
} from "@repo/design-system/components/field";
import { Separator } from "@repo/design-system/components/separator";
import { AuthorizationConsent } from "@/app/_components/consent/authorization";
import {
  CAPABILITY_LEGEND,
  CAPABILITY_VISIBILITY,
  CONTACT_LEGEND,
  CONTACT_VISIBILITY,
  FIRST_NAME_HELP,
  FIRST_NAME_LABEL,
  FULL_NAME_HELP,
  FULL_NAME_LABEL,
  HEADLINE_HELP,
  HEADLINE_LABEL,
  IDENTITY_LEGEND,
  IDENTITY_VISIBILITY,
  LAST_INITIAL_HELP,
  LAST_INITIAL_LABEL,
  MORE_LEGEND,
  MORE_VISIBILITY,
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
} from "../../_lib/schema";
import { messageOf } from "../../_lib/use-publish-form";
import { AboutField, CityField, PhotoNote, TextField, WorkHistoryFields } from "../fields";
import { FormSummary } from "../form-summary";
import { SkillPicker } from "../skill-picker";
import type { VariantProps } from "./index";
import { skillSlugsField } from "../../_lib/schema";

export function ByVisibility({ form, machine, vocabulary, idFor, serverErrorFor }: VariantProps) {
  return (
    <FieldGroup>
      <AuthorizationConsent error={serverErrorFor("consent")} />

      <FieldSet>
        <FieldLegend>{CAPABILITY_LEGEND}</FieldLegend>
        <FieldDescription>{CAPABILITY_VISIBILITY}</FieldDescription>
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
      </FieldSet>

      <Separator />

      <FieldSet>
        <FieldLegend>{IDENTITY_LEGEND}</FieldLegend>
        <FieldDescription>{IDENTITY_VISIBILITY}</FieldDescription>
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
        <CityField form={form} id={idFor("city")} serverError={serverErrorFor("city")} />
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
      </FieldSet>

      <Separator />

      <FieldSet>
        <FieldLegend>{CONTACT_LEGEND}</FieldLegend>
        <FieldDescription>{CONTACT_VISIBILITY}</FieldDescription>
        <TextField
          form={form}
          name="phone"
          id={idFor("phone")}
          label={PHONE_LABEL}
          help={PHONE_HELP}
          schema={phoneField}
          serverError={serverErrorFor("phone")}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
        />
      </FieldSet>

      <Separator />

      <FieldSet>
        <FieldLegend>{MORE_LEGEND}</FieldLegend>
        <FieldDescription>{MORE_VISIBILITY}</FieldDescription>
        <AboutField form={form} id={idFor("about")} serverError={serverErrorFor("about")} />
        <WorkHistoryFields
          form={form}
          groupId={idFor("workHistory")}
          idFor={(index) => idFor("workHistory", index)}
          serverErrorFor={(index) => serverErrorFor("workHistory", index)}
          hydrated={machine.hydrated}
        />
        <PhotoNote />
      </FieldSet>

      <FormSummary
        summary={machine.summary}
        feedback={machine.feedback}
        summaryRef={machine.summaryRef}
        idFor={idFor}
        label="Resultado"
      />

      <Button type="submit" size="lg" disabled={machine.pending} aria-busy={machine.pending}>
        {PUBLISH_BUTTON}
      </Button>
    </FieldGroup>
  );
}
