"use client";

/**
 * The four field groups a CapabilityProfile is made of, in the order
 * `/prototype` UI locked for `/publish`: **capability before identity**, then
 * contact, then the optional rest.
 *
 * **Shared, because the two forms write the same nine fields.** `/publish`
 * renders these under the _autorización_ and above _Publicar mi perfil_;
 * `/my-profile/edit` renders the same four under a heading and above
 * _Guardar cambios_. The groups' boundaries **are** the disclosure rule — what
 * is public, what is gated, what is held — so a Worker learns it from the shape
 * of the form on both surfaces or on neither.
 *
 * What each surface keeps for itself is what is genuinely its own: the consent
 * step, the button's verb, and where the form goes on success.
 *
 * **Each `<FieldSet>` takes an `id`**, so `/my-profile` can link a person
 * straight to the group she came to change. The ids are part of the contract
 * between those two pages rather than incidental, which is why they are a
 * declared constant rather than strings written twice.
 */

import {
  FieldDescription,
  FieldGroup,
  FieldLegend,
  FieldSet,
} from "@repo/design-system/components/field";
import { Separator } from "@repo/design-system/components/separator";
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
  type PublishFieldName,
} from "@/app/_lib/profile-form/messages";
import {
  firstNameField,
  fullNameField,
  headlineField,
  lastInitialField,
  LIMITS,
  phoneField,
  skillSlugsField,
} from "@/app/_lib/profile-form/schema";
import { messageOf, type ProfileFieldsForm } from "@/app/_lib/profile-form/use-profile-fields";
import type { ProfileFormMachine } from "@/app/_lib/profile-form/use-profile-form";
import { AboutField, CityField, PhotoNote, TextField, WorkHistoryFields } from "./fields";
import { SkillPicker, type VocabularyEntry } from "./skill-picker";

/**
 * The anchors `/my-profile` links into. English identifiers (ADR-0012), and
 * exported so the two pages cannot disagree about their spelling.
 */
export const FIELD_GROUP_IDS = {
  capability: "capability",
  identity: "identity",
  contact: "contact",
  more: "more",
} as const;

/** What every group needs; `ProfileFieldGroupsProps` is the same set. */
export type GroupProps = ProfileFieldGroupsProps;

export interface ProfileFieldGroupsProps {
  readonly form: ProfileFieldsForm;
  readonly machine: ProfileFormMachine;
  readonly vocabulary: readonly VocabularyEntry[];
  readonly idFor: (field: PublishFieldName, index?: number) => string;
  readonly serverErrorFor: (field: PublishFieldName, index?: number) => string | undefined;
  /**
   * The sentence about the photo. `/publish` says it is uploaded after
   * publishing; an edit says where it is changed instead. Absent renders none.
   */
  readonly photoNote?: React.ReactNode;
}

/**
 * **The four groups, each exported on its own** — added by `/prototype` UI for
 * #142, where one variant renders them as a disclosure list one at a time and
 * another pins a save bar beneath all four. `ProfileFieldGroups` below is
 * still the composition every non-prototype caller uses, so nothing about the
 * shipped order or the legends moved.
 */
export function CapabilityGroup({ form, machine, vocabulary, idFor, serverErrorFor }: GroupProps) {
  return (
    <FieldSet id={FIELD_GROUP_IDS.capability}>
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
  );
}

export function IdentityGroup({ form, idFor, serverErrorFor }: GroupProps) {
  return (
    <FieldSet id={FIELD_GROUP_IDS.identity}>
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
  );
}

export function ContactGroup({ form, idFor, serverErrorFor }: GroupProps) {
  return (
    <FieldSet id={FIELD_GROUP_IDS.contact}>
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
  );
}

export function MoreGroup({ form, machine, idFor, serverErrorFor, photoNote }: GroupProps) {
  return (
    <FieldSet id={FIELD_GROUP_IDS.more}>
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
      {photoNote ?? <PhotoNote />}
    </FieldSet>
  );
}

export function ProfileFieldGroups(props: ProfileFieldGroupsProps) {
  return (
    <FieldGroup>
      <CapabilityGroup {...props} />
      <Separator />
      <IdentityGroup {...props} />
      <Separator />
      <ContactGroup {...props} />
      <Separator />
      <MoreGroup {...props} />
    </FieldGroup>
  );
}
