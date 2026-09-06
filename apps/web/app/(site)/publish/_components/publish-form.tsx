"use client";

/**
 * The form element and its wiring; `publish-layout.tsx` owns what is inside
 * it. The split is what let three `/prototype` UI layouts share one machine
 * on the real route before one was locked, and it is kept because it keeps
 * what must be true of the form apart from what it looks like:
 *
 * - **A native `action`, and every control named.** A submit before hydration
 *   posts and the Server Action answers (NFR4). `noValidate` is withheld until
 *   hydration so the browser's own `required` checks stand in until ours can.
 * - **The consent versions are a bound argument** (ADR-0015), so there are no
 *   hidden inputs anywhere in this tree; `publish-form.test.tsx` asserts it.
 * - **TanStack Form owns fields; the machine owns outcomes** (ADR-0014).
 * - **Focus lands on the summary** on every failed submit, whichever side
 *   refused it.
 */

import type { ConsentVersions } from "@repo/domain/consent";
import { useId } from "react";
import type { VocabularyEntry } from "@/app/_components/profile-form/skill-picker";
import type { FormTreatment } from "@/app/_components/profile-form/treatment";
import { type PublishFieldName, PUBLISH_FAILED } from "@/app/_lib/profile-form/messages";
import { publishProfileSchema } from "@/app/_lib/profile-form/schema";
import { serverFieldError } from "@/app/_lib/profile-form/summary";
import { useProfileFields } from "@/app/_lib/profile-form/use-profile-fields";
import { INITIAL_RESULT, useProfileForm } from "@/app/_lib/profile-form/use-profile-form";
import { publishProfile } from "../actions";
import { PublishLayout } from "./publish-layout";

export interface PublishFormProps {
  readonly vocabulary: readonly VocabularyEntry[];
  readonly prefill: { readonly fullName: string };
  readonly consentVersions: ConsentVersions;
  /** Prototype only: how far the notebook world is taken. Leaves with the losing variants. */
  readonly treatment: FormTreatment;
}

export function PublishForm({ vocabulary, prefill, consentVersions, treatment }: PublishFormProps) {
  const machine = useProfileForm({
    /**
     * **Bound here, not hidden, and bound *here* rather than inside the
     * machine** (ADR-0015). The consent versions travel in the action
     * reference, so the JSX carries no mirror of them and a browser with
     * JavaScript unavailable still submits them. The machine is shared with a
     * form that has no consent at all, which is why the binding is the
     * surface's job.
     */
    action: publishProfile.bind(null, consentVersions),
    initial: INITIAL_RESULT,
    schema: publishProfileSchema,
    faultMessage: PUBLISH_FAILED,
  });
  const form = useProfileFields(prefill, machine.refusedValues);
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
      <PublishLayout
        form={form}
        machine={machine}
        vocabulary={vocabulary}
        idFor={idFor}
        serverErrorFor={(field, index) => serverFieldError(machine.serverErrors, field, index)}
        treatment={treatment}
      />
    </form>
  );
}
