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
 */

import { Button } from "@repo/design-system/components/button";
import { FieldGroup } from "@repo/design-system/components/field";
import { AuthorizationConsent } from "@/app/_components/consent/authorization";
import { ProfileFieldGroups } from "@/app/_components/profile-form/field-groups";
import { FormSummary } from "@/app/_components/profile-form/form-summary";
import type { VocabularyEntry } from "@/app/_components/profile-form/skill-picker";
import {
  FEEDBACK_REGION_LABEL,
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
}

export function PublishLayout({
  form,
  machine,
  vocabulary,
  idFor,
  serverErrorFor,
}: PublishLayoutProps) {
  return (
    <FieldGroup>
      <AuthorizationConsent error={serverErrorFor("consent")} />

      <ProfileFieldGroups
        form={form}
        machine={machine}
        vocabulary={vocabulary}
        idFor={idFor}
        serverErrorFor={serverErrorFor}
      />

      <FormSummary
        summary={machine.summary}
        feedback={machine.feedback}
        summaryRef={machine.summaryRef}
        idFor={idFor}
        label={FEEDBACK_REGION_LABEL}
      />

      <Button type="submit" size="lg" disabled={machine.pending} aria-busy={machine.pending}>
        {PUBLISH_BUTTON}
      </Button>
    </FieldGroup>
  );
}
