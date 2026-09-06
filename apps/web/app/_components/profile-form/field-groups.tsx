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
 * **Since #181 the groups are sheets on a ruled page**, which is the page
 * `/my-profile` already renders the same profile on: the ruling between sheets
 * replaces the `<Separator />`s, the rose margin line runs down the left from
 * `sm` up, and the mark in the margin says who reaches what the sheet holds.
 * The three marks mean here exactly what they mean there — the world at large,
 * someone who opened her profile, someone she accepted — because a Worker meets
 * one vocabulary across publishing, editing and reading, or she meets three.
 *
 * **The two sheets that are an act rather than an audience are slots**, and
 * they carry their own marks: the _autorización_ she gives, and the card that
 * shows her words back to her. Both sit **inside** the ruled page, so the
 * rulings above and below them are the same rulings as every other.
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

import { FieldDescription, FieldLegend, FieldSet } from "@repo/design-system/components/field";
import { Separator } from "@repo/design-system/components/separator";
import { cn } from "@repo/design-system/lib/utils";
import {
  DoorOpenIcon,
  GlobeIcon,
  LockKeyholeIcon,
  type LucideIcon,
  UserRoundIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { RuledSheet } from "@/app/(site)/_components/ruled-sheet";
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
import type { FormTreatment } from "./treatment";

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

export interface FormSheetProps {
  readonly id?: string;
  /** The mark in the margin. Ignored when the treatment is not drawing sheets. */
  readonly mark: LucideIcon;
  readonly legend: string;
  readonly description?: ReactNode;
  readonly treatment: FormTreatment;
  /**
   * Whether this is the first thing on the page. The rule is drawn **above** a
   * group rather than between two, which is what lets the ruled branch drop it
   * without the page opening on a line — the rule `profile-row.tsx` already
   * follows for the Wall.
   */
  readonly first?: boolean;
  readonly children: ReactNode;
}

/**
 * One sheet of the form: the ruling, the mark, the legend and whatever the
 * group holds.
 *
 * **It stays a `<fieldset>` with a `<legend>` in both treatments.** A legend is
 * what makes a radio group announce its question, and moving those words into
 * an `<h2>` for the sake of a screen reader's heading list would take that away
 * from the group that needs it most. What the display treatment changes is the
 * face and the size, which the accessibility tree does not see.
 *
 * **Exported, because the slots are sheets too.** The _autorización_ and the
 * preview are not field groups and are passed in from the surface, and a sheet
 * they drew for themselves would be the second copy of this that the rulings
 * exist to prevent.
 */
export function FormSheet({
  id,
  mark,
  legend,
  description,
  treatment,
  first = false,
  children,
}: FormSheetProps) {
  const body = (
    <FieldSet id={id}>
      <FieldLegend
        /*
          **`text-2xl!`, and the `!` is load-bearing rather than lazy.** The
          registry sets the size through `data-[variant=legend]:text-base`,
          which is an attribute selector and therefore outranks a plain
          `text-2xl` however the two are ordered — so without it the face
          changed to Alegreya and the size silently stayed at 16 px. Measured
          off the running page, not assumed. Restating the same `data-`
          selector here would tie for specificity and leave the winner to
          Tailwind's own sort order, which is not a thing to depend on, and
          editing `field.tsx` is out — `shadcn add --overwrite` replaces it.
        */
        className={cn(
          treatment.displayHeadings &&
            "font-heading text-foreground mb-2 text-2xl! leading-8 font-medium",
        )}
      >
        {legend}
      </FieldLegend>
      {description === undefined ? null : <FieldDescription>{description}</FieldDescription>}
      {children}
    </FieldSet>
  );

  if (treatment.sheets) return <RuledSheet mark={mark}>{body}</RuledSheet>;

  return (
    <>
      {first ? null : <Separator />}
      {body}
    </>
  );
}

export interface ProfileFieldGroupsProps {
  readonly form: ProfileFieldsForm;
  readonly machine: ProfileFormMachine;
  readonly vocabulary: readonly VocabularyEntry[];
  readonly idFor: (field: PublishFieldName, index?: number) => string;
  readonly serverErrorFor: (field: PublishFieldName, index?: number) => string | undefined;
  readonly treatment: FormTreatment;
  /**
   * The sentence about the photo. `/publish` says it is uploaded after
   * publishing; an edit says where it is changed instead. Absent renders none.
   */
  readonly photoNote?: ReactNode;
  /** The sheet above the first field group — the _autorización_, or nothing. */
  readonly leading?: ReactNode;
  /** The sheet that closes the page, where the preview sits when it sits here. */
  readonly trailing?: ReactNode;
}

export function ProfileFieldGroups({
  form,
  machine,
  vocabulary,
  idFor,
  serverErrorFor,
  treatment,
  photoNote,
  leading,
  trailing,
}: ProfileFieldGroupsProps) {
  const groups = (
    <>
      {leading}

      <FormSheet
        id={FIELD_GROUP_IDS.capability}
        mark={GlobeIcon}
        legend={CAPABILITY_LEGEND}
        description={CAPABILITY_VISIBILITY}
        treatment={treatment}
        first={leading === undefined}
      >
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
              treatment={treatment}
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
      </FormSheet>

      <FormSheet
        id={FIELD_GROUP_IDS.identity}
        mark={UserRoundIcon}
        legend={IDENTITY_LEGEND}
        description={IDENTITY_VISIBILITY}
        treatment={treatment}
      >
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
          treatment={treatment}
        />
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
      </FormSheet>

      <FormSheet
        id={FIELD_GROUP_IDS.contact}
        mark={LockKeyholeIcon}
        legend={CONTACT_LEGEND}
        description={CONTACT_VISIBILITY}
        treatment={treatment}
      >
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
      </FormSheet>

      <FormSheet
        id={FIELD_GROUP_IDS.more}
        mark={DoorOpenIcon}
        legend={MORE_LEGEND}
        description={MORE_VISIBILITY}
        treatment={treatment}
      >
        <AboutField form={form} id={idFor("about")} serverError={serverErrorFor("about")} />
        <WorkHistoryFields
          form={form}
          groupId={idFor("workHistory")}
          idFor={(index) => idFor("workHistory", index)}
          serverErrorFor={(index) => serverErrorFor("workHistory", index)}
          hydrated={machine.hydrated}
        />
        {photoNote ?? <PhotoNote />}
      </FormSheet>

      {trailing}
    </>
  );

  /*
    The ruled page is its own element, and in the untreated branch there is no
    element at all: the surface's `FieldGroup` is what spaces the groups there,
    exactly as it did before. Two spacing systems on one element would leave a
    gap outside every rule and a ruling that no longer sits between two sheets,
    which is why the sheets get a container of their own rather than a class
    added to the one above them.
  */
  return treatment.sheets ? <div className="ruled-page">{groups}</div> : groups;
}
