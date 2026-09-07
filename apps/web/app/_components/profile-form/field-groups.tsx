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
 * **Since #181 a group's legend is set in the display face** — variant A
 * (_Renglones_), locked from `/prototype` UI on the two real routes; the three
 * richer treatments live on `prototype/181-ui-variants`. That is the whole of
 * what the notebook world asks of this form, and the restraint is the decision
 * rather than a shortfall: `DESIGN.md` says the contrast between the two faces
 * *is* the hierarchy of the product — what she wrote, and what the platform
 * wrote — and everything a person **operates** stays in Inter. A form set in
 * the display face would be a form asking to be admired.
 *
 * The groups already sit on rulings: a `<Separator />` paints `bg-border`,
 * which is the ruling token, so what divides two groups here is the same line
 * that divides two rows on the Wall.
 *
 * **Each `<FieldSet>` takes an `id`, and nothing links to one yet.** They are a
 * declared constant rather than strings written twice because the thing that
 * would use them is a `/prototype` UI variant on `prototype/142-ui-variants` —
 * per-section *Cambiar* links from `/my-profile` into the group she came to
 * change — and that decision is the human's, unmade. If it goes the other way
 * the constant goes with the variants; it is named here rather than deleted
 * because the anchors are rendered either way and two pages agreeing on their
 * spelling by accident is the failure worth avoiding.
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

/**
 * A group legend, in the display face at the 24 px step — the step
 * `/my-profile`'s tier headings already sit on, so the four groups she fills in
 * and the three sheets she then reads carry the same weight.
 *
 * **`text-2xl!`, and the `!` is load-bearing rather than lazy.** The registry
 * sizes a legend through `data-[variant=legend]:text-base`. Two things have to
 * be true for that to beat a plain `text-2xl`, and both are: `cn` is
 * `twMerge`, which does **not** treat a variant-prefixed `text-base` and a bare
 * `text-2xl` as one conflict group, so both classes survive the merge rather
 * than the later one replacing the earlier; and what is left is a
 * `.class[attr]` selector against a `.class`, which wins on specificity
 * whatever the order. Without the `!` the face changed to Alegreya and the size
 * silently stayed at 16 px — measured off the running page, not assumed.
 * Restating the same `data-` selector here would tie on specificity and leave
 * the winner to Tailwind's own sort order, which is not a thing to depend on;
 * and editing `field.tsx` is out, because `shadcn add --overwrite` replaces it
 * wholesale. `FieldLegend` offers only `legend` and `label`, and neither is
 * 24 px, so there is no variant to ask for instead.
 *
 * **Its twin is `own-profile-view.tsx`'s tier heading**, which carries this
 * string minus the `mb-2` and the `!`. Two files holding one visual fact is
 * what `globals.css`'s `@utility` block exists to prevent — *"named once so
 * that three files cannot drift"* — and the reason it is not extracted here is
 * that the two call sites need different things from it: this one has to win a
 * specificity fight that the tier heading does not have, so a shared utility
 * would either restate the size at this call site or push an `!important` onto
 * a surface that has no use for one. A third consumer is where that trade
 * flips, and it is a change to the design system rather than to this form.
 */
const LEGEND_CLASS = "font-heading text-foreground mb-2 text-2xl! leading-8 font-medium";

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

export function ProfileFieldGroups({
  form,
  machine,
  vocabulary,
  idFor,
  serverErrorFor,
  photoNote,
}: ProfileFieldGroupsProps) {
  return (
    <FieldGroup>
      <FieldSet id={FIELD_GROUP_IDS.capability}>
        <FieldLegend className={LEGEND_CLASS}>{CAPABILITY_LEGEND}</FieldLegend>
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

      <FieldSet id={FIELD_GROUP_IDS.identity}>
        <FieldLegend className={LEGEND_CLASS}>{IDENTITY_LEGEND}</FieldLegend>
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

      <FieldSet id={FIELD_GROUP_IDS.contact}>
        <FieldLegend className={LEGEND_CLASS}>{CONTACT_LEGEND}</FieldLegend>
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

      <FieldSet id={FIELD_GROUP_IDS.more}>
        <FieldLegend className={LEGEND_CLASS}>{MORE_LEGEND}</FieldLegend>
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
    </FieldGroup>
  );
}
