"use client";

/**
 * **A — Todo a la vista.** The four groups one after another, separated, and
 * one save at the end. This is the layout the ticket built before the
 * prototype, and it is here as a variant so it competes rather than wins by
 * having been written first.
 *
 * Its case: one screen, one save, nothing hidden. She can see the whole
 * profile at once, and there is no question about what happens if she leaves
 * halfway — nothing has been written, because there is one write.
 *
 * Against it: on a phone this is a long scroll, and the save is a long way
 * from the field she came to change.
 */

import { Button } from "@repo/design-system/components/button";
import { FieldGroup } from "@repo/design-system/components/field";
import { ProfileFieldGroups } from "@/app/_components/profile-form/field-groups";
import { FormSummary } from "@/app/_components/profile-form/form-summary";
import { FEEDBACK_REGION_LABEL } from "@/app/_lib/profile-form/messages";
import Link from "next/link";
import { BACK_TO_PROFILE, PHOTO_CHANGED_ELSEWHERE, SAVE_BUTTON } from "../../_lib/messages";
import type { VariantProps } from ".";

export function AllVisible({ form, machine, vocabulary, idFor, serverErrorFor }: VariantProps) {
  return (
    <FieldGroup>
      <ProfileFieldGroups
        form={form}
        machine={machine}
        vocabulary={vocabulary}
        idFor={idFor}
        serverErrorFor={serverErrorFor}
        photoNote={
          <p className="text-muted-foreground text-sm text-pretty">{PHOTO_CHANGED_ELSEWHERE}</p>
        }
      />

      <FormSummary
        summary={machine.summary}
        feedback={machine.feedback}
        summaryRef={machine.summaryRef}
        idFor={idFor}
        label={FEEDBACK_REGION_LABEL}
      />

      <Button type="submit" size="lg" disabled={machine.pending} aria-busy={machine.pending}>
        {SAVE_BUTTON}
      </Button>

      <Link
        href="/my-profile"
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-sm text-center text-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
      >
        {BACK_TO_PROFILE}
      </Link>
    </FieldGroup>
  );
}
