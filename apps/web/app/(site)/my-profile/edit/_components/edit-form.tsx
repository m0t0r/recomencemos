"use client";

/**
 * The form element and its wiring; `edit-layout.tsx` owns what is inside it.
 * The same split `/publish` makes, and it keeps the same things true:
 *
 * - **A native `action`, and every control named.** A submit before hydration
 *   posts and the Server Action answers (NFR4). `noValidate` is withheld until
 *   hydration so the browser's own `required` checks stand in until ours can.
 * - **No hidden inputs and no bound arguments.** `/publish` binds the consent
 *   versions it displayed; nothing travels with this submit that she does not
 *   type, so this form binds nothing (ADR-0015).
 * - **TanStack Form owns fields; the machine owns outcomes** (ADR-0014).
 * - **Focus lands on the summary** on every failed submit, whichever side
 *   refused it.
 *
 * **`defaults` is what she published**, so the form opens on her profile
 * rather than empty. A refusal outranks it: `machine.refusedValues` is what
 * she typed, which on the unhydrated path is the only copy of it there is.
 */

import { useId } from "react";
import type { VocabularyEntry } from "@/app/_components/profile-form/skill-picker";
import type { PublishFieldName } from "@/app/_lib/profile-form/messages";
import { type UpdateProfileValues, updateProfileSchema } from "@/app/_lib/profile-form/schema";
import { serverFieldError } from "@/app/_lib/profile-form/summary";
import { useProfileFields } from "@/app/_lib/profile-form/use-profile-fields";
import { INITIAL_RESULT, useProfileForm } from "@/app/_lib/profile-form/use-profile-form";
import { updateProfile } from "../actions";
import { SAVE_FAILED } from "../_lib/messages";
import { EditLayout } from "./edit-layout";

export interface EditFormProps {
  readonly vocabulary: readonly VocabularyEntry[];
  readonly defaults: UpdateProfileValues;
}

export function EditForm({ vocabulary, defaults }: EditFormProps) {
  const machine = useProfileForm({
    action: updateProfile,
    initial: INITIAL_RESULT,
    schema: updateProfileSchema,
    faultMessage: SAVE_FAILED,
  });
  const form = useProfileFields(defaults, machine.refusedValues);
  const base = useId();

  const idFor = (field: PublishFieldName, index?: number) =>
    index === undefined ? `${base}-${field}` : `${base}-${field}-${index}`;

  return (
    <form
      action={machine.formAction}
      noValidate={machine.hydrated}
      onSubmit={(event) => machine.guardSubmit(event, () => void form.handleSubmit())}
      className="flex flex-col gap-8"
    >
      <EditLayout
        form={form}
        machine={machine}
        vocabulary={vocabulary}
        idFor={idFor}
        serverErrorFor={(field, index) => serverFieldError(machine.serverErrors, field, index)}
      />
    </form>
  );
}
