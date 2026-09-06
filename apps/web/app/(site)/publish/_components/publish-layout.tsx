"use client";

/**
 * The publishing form's layout — **"Por lo que ves"**, locked after
 * `/prototype` UI. One column, the field groups whose boundaries *are* the
 * disclosure rule, capability before identity, the summary above the button,
 * the button last.
 *
 * The bet it won on: a Worker learns what is public and what is held from the
 * shape of the form, without a paragraph about it, and the first thing she is
 * asked is what she can do rather than who she is (voice guide, Do 5). The two
 * losing layouts — the form beside a live preview card, and identity first
 * with the Skills as a chip grid — live on `prototype/16-ui-variants`.
 *
 * **The groups themselves moved to `@/app/_components/profile-form` with
 * #142**, because the edit form writes the same nine fields and had to render
 * them in the same order under the same legends or teach a different rule the
 * second time she saw it. What stayed here is what is only publishing's: the
 * _autorización_ above the fields, and the verb on the button.
 *
 * **#181 draws all of that on the ruled page** and hands the _autorización_ and
 * the preview in as the two sheets that are an act rather than an audience. The
 * order is unchanged; what changed is the page. `treatment` is the prototype's
 * switch and leaves with the losing variants.
 */

import { Button } from "@repo/design-system/components/button";
import { FieldGroup } from "@repo/design-system/components/field";
import { GlobeIcon, PenLineIcon } from "lucide-react";
import { AuthorizationConsent } from "@/app/_components/consent/authorization";
import { FormSheet, ProfileFieldGroups } from "@/app/_components/profile-form/field-groups";
import { FormSummary } from "@/app/_components/profile-form/form-summary";
import { ProfilePreview } from "@/app/_components/profile-form/preview";
import { PreviewBar } from "@/app/_components/profile-form/preview-bar";
import type { VocabularyEntry } from "@/app/_components/profile-form/skill-picker";
import type { FormTreatment } from "@/app/_components/profile-form/treatment";
import { NOTICE_COPY } from "@/app/_lib/consent/messages";
import {
  FEEDBACK_REGION_LABEL,
  PREVIEW_HEADING,
  type PublishFieldName,
  PUBLISH_BUTTON,
} from "@/app/_lib/profile-form/messages";
import type { ProfileFieldsForm } from "@/app/_lib/profile-form/use-profile-fields";
import type { ProfileFormMachine } from "@/app/_lib/profile-form/use-profile-form";

export interface PublishLayoutProps {
  readonly form: ProfileFieldsForm;
  readonly machine: ProfileFormMachine;
  readonly vocabulary: readonly VocabularyEntry[];
  readonly idFor: (field: PublishFieldName, index?: number) => string;
  readonly serverErrorFor: (field: PublishFieldName, index?: number) => string | undefined;
  readonly treatment: FormTreatment;
}

export function PublishLayout({
  form,
  machine,
  vocabulary,
  idFor,
  serverErrorFor,
  treatment,
}: PublishLayoutProps) {
  return (
    <FieldGroup>
      <ProfileFieldGroups
        form={form}
        machine={machine}
        vocabulary={vocabulary}
        idFor={idFor}
        serverErrorFor={serverErrorFor}
        treatment={treatment}
        leading={
          /*
            Above the first field, which is story 14's requirement rather than a
            layout preference: deployment is continuous, so a form that
            collected a phone number and asked afterwards would have collected
            it. The mark is the one gesture on the page that is hers to make.
          */
          <FormSheet
            mark={PenLineIcon}
            legend={NOTICE_COPY.AUTHORIZATION_HEADING}
            treatment={treatment}
            first
          >
            <AuthorizationConsent error={serverErrorFor("consent")} />
          </FormSheet>
        }
        trailing={
          treatment.preview === "closing" ? (
            <FormSheet mark={GlobeIcon} legend={PREVIEW_HEADING} treatment={treatment}>
              <ProfilePreview form={form} vocabulary={vocabulary} />
            </FormSheet>
          ) : undefined
        }
      />

      <FormSummary
        summary={machine.summary}
        feedback={machine.feedback}
        summaryRef={machine.summaryRef}
        idFor={idFor}
        label={FEEDBACK_REGION_LABEL}
      />

      {treatment.preview === "thumb" ? (
        <PreviewBar
          form={form}
          machine={machine}
          vocabulary={vocabulary}
          submitLabel={PUBLISH_BUTTON}
        />
      ) : (
        <Button type="submit" size="lg" disabled={machine.pending} aria-busy={machine.pending}>
          {PUBLISH_BUTTON}
        </Button>
      )}
    </FieldGroup>
  );
}
