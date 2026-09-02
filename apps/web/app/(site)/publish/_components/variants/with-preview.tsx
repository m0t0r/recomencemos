"use client";

/**
 * Variant B — **"Con vista previa"**: the form beside the card a stranger
 * will see, updating as she types. Two columns from `lg` up with the card
 * sticky; on a phone the card sits above the form, compact, and follows her
 * down as the one thing on the page that is *hers* rather than ours.
 *
 * The bet: the public/held distinction is made tangible rather than
 * explained — the card shows exactly what is public, and the full name and
 * phone visibly never appear on it. Groups are lighter than in A (no
 * separators, labels rather than legends) because the card is carrying the
 * explanation.
 */

import { Button } from "@repo/design-system/components/button";
import {
  FieldDescription,
  FieldGroup,
  FieldLegend,
  FieldSet,
} from "@repo/design-system/components/field";
import { AuthorizationConsent } from "@/app/_components/consent/authorization";
import { ProfileCard } from "@/app/(site)/_components/profile-card";
import {
  CAPABILITY_LEGEND,
  CONTACT_LEGEND,
  CONTACT_VISIBILITY,
  FIRST_NAME_HELP,
  FIRST_NAME_LABEL,
  FULL_NAME_HELP,
  FULL_NAME_LABEL,
  HEADLINE_HELP,
  HEADLINE_LABEL,
  IDENTITY_LEGEND,
  LAST_INITIAL_HELP,
  LAST_INITIAL_LABEL,
  MORE_LEGEND,
  MORE_VISIBILITY,
  PHONE_HELP,
  PHONE_LABEL,
  PREVIEW_HEADING,
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
import {
  AboutField,
  CityField,
  CITY_LABELS,
  PhotoNote,
  TextField,
  WorkHistoryFields,
} from "../fields";
import { FormSummary } from "../form-summary";
import { SkillPicker } from "../skill-picker";
import type { VariantProps } from "./index";

export function WithPreview({ form, machine, vocabulary, idFor, serverErrorFor }: VariantProps) {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <aside
        className="lg:sticky lg:top-20 lg:order-last"
        aria-labelledby={idFor("headline") + "-preview"}
      >
        <h2
          id={idFor("headline") + "-preview"}
          className="text-muted-foreground mb-2 text-sm font-medium"
        >
          {PREVIEW_HEADING}
        </h2>
        {/* Re-renders on every keystroke; that is the point of this variant. */}
        <form.Subscribe selector={(state) => state.values}>
          {(values) => (
            <ProfileCard
              firstName={values.firstName}
              lastInitial={values.lastInitial}
              cityLabel={CITY_LABELS[values.city as keyof typeof CITY_LABELS] ?? ""}
              headline={values.headline}
              skillLabels={vocabulary
                .filter((entry) => values.skillSlugs.includes(entry.slug))
                .map((entry) => entry.labelEs)}
            />
          )}
        </form.Subscribe>
      </aside>

      <FieldGroup>
        <AuthorizationConsent error={serverErrorFor("consent")} />

        <FieldSet>
          <FieldLegend variant="label">{IDENTITY_LEGEND}</FieldLegend>
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
          <CityField
            form={form}
            id={idFor("city")}
            serverError={serverErrorFor("city")}
            layout="row"
          />
        </FieldSet>

        <FieldSet>
          <FieldLegend variant="label">{CAPABILITY_LEGEND}</FieldLegend>
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

        <FieldSet>
          <FieldLegend variant="label">{CONTACT_LEGEND}</FieldLegend>
          <FieldDescription>{CONTACT_VISIBILITY}</FieldDescription>
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

        <FieldSet>
          <FieldLegend variant="label">{MORE_LEGEND}</FieldLegend>
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
    </div>
  );
}
