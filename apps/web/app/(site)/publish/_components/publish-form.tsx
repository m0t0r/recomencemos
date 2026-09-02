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
import type { PublishFieldName } from "../_lib/messages";
import { serverFieldError } from "../_lib/summary";
import { usePublish } from "../_lib/use-publish";
import { usePublishForm } from "../_lib/use-publish-form";
import { PublishLayout } from "./publish-layout";
import type { VocabularyEntry } from "./skill-picker";

export interface PublishFormProps {
  readonly vocabulary: readonly VocabularyEntry[];
  readonly prefill: { readonly fullName: string };
  readonly consentVersions: ConsentVersions;
}

export function PublishForm({ vocabulary, prefill, consentVersions }: PublishFormProps) {
  const machine = usePublish(consentVersions);
  const form = usePublishForm(prefill, machine.refusedValues);
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
      />
    </form>
  );
}
