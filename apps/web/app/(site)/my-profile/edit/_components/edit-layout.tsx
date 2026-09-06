"use client";

/**
 * The edit form's layout: the shared field groups, the summary above the
 * button, the button, and a way out without saving.
 *
 * **It is `/publish`'s layout minus the consent step**, which is the whole of
 * the difference between the two forms — so the groups, their order and their
 * legends come from `@/app/_components/profile-form/field-groups` rather than
 * being restated. A Worker who publishes and later edits meets the same rule
 * about what is public and what is held, in the same shape, twice.
 *
 * **The way out is a link, not a second button.** Nothing is discarded by
 * leaving — the profile is whatever she last saved — so a control that looked
 * like a decision would invent one. It sits after the save so the keyboard
 * path ends on the action rather than on the exit.
 *
 * **The preview sheet is more honest here than on `/publish`** (#181): it opens
 * holding what she published, which is the question this page exists to
 * answer — what are they seeing, and what will they see when I save.
 */

import { Button } from "@repo/design-system/components/button";
import { FieldGroup } from "@repo/design-system/components/field";
import { GlobeIcon } from "lucide-react";
import Link from "next/link";
import { FormSheet, ProfileFieldGroups } from "@/app/_components/profile-form/field-groups";
import { FormSummary } from "@/app/_components/profile-form/form-summary";
import { ProfilePreview } from "@/app/_components/profile-form/preview";
import { PreviewBar } from "@/app/_components/profile-form/preview-bar";
import type { VocabularyEntry } from "@/app/_components/profile-form/skill-picker";
import type { FormTreatment } from "@/app/_components/profile-form/treatment";
import {
  FEEDBACK_REGION_LABEL,
  PREVIEW_HEADING,
  type PublishFieldName,
} from "@/app/_lib/profile-form/messages";
import type { ProfileFieldsForm } from "@/app/_lib/profile-form/use-profile-fields";
import type { ProfileFormMachine } from "@/app/_lib/profile-form/use-profile-form";
import { BACK_TO_PROFILE, PHOTO_CHANGED_ELSEWHERE, SAVE_BUTTON } from "../_lib/messages";

export interface EditLayoutProps {
  readonly form: ProfileFieldsForm;
  readonly machine: ProfileFormMachine;
  readonly vocabulary: readonly VocabularyEntry[];
  readonly idFor: (field: PublishFieldName, index?: number) => string;
  readonly serverErrorFor: (field: PublishFieldName, index?: number) => string | undefined;
  readonly treatment: FormTreatment;
}

export function EditLayout({
  form,
  machine,
  vocabulary,
  idFor,
  serverErrorFor,
  treatment,
}: EditLayoutProps) {
  return (
    <FieldGroup>
      <ProfileFieldGroups
        form={form}
        machine={machine}
        vocabulary={vocabulary}
        idFor={idFor}
        serverErrorFor={serverErrorFor}
        treatment={treatment}
        photoNote={
          <p className="text-muted-foreground text-sm text-pretty">{PHOTO_CHANGED_ELSEWHERE}</p>
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
          submitLabel={SAVE_BUTTON}
        />
      ) : (
        <Button type="submit" size="lg" disabled={machine.pending} aria-busy={machine.pending}>
          {SAVE_BUTTON}
        </Button>
      )}

      <Link
        href="/my-profile"
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-sm text-center text-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
      >
        {BACK_TO_PROFILE}
      </Link>
    </FieldGroup>
  );
}
