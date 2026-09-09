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
import { useId, useState } from "react";
import type { VocabularyEntry } from "@/app/_components/profile-form/skill-picker";
import { type PublishFieldName, PUBLISH_FAILED } from "@/app/_lib/profile-form/messages";
import { publishProfileSchema } from "@/app/_lib/profile-form/schema";
import { serverFieldError } from "@/app/_lib/profile-form/summary";
import { useProfileFields } from "@/app/_lib/profile-form/use-profile-fields";
import { INITIAL_RESULT, useProfileForm } from "@/app/_lib/profile-form/use-profile-form";
import { publishProfile } from "../actions";
import { PhotoField } from "./photo-field";
// PROTOTYPE (#18 Act 5) -- this import and the switcher below leave `dev` with
// the losing variants. See `photo-variants/README.md`.
import { useSearchParams } from "next/navigation";
import { VariantB, VariantC } from "./photo-variants";
import { PublishLayout } from "./publish-layout";

export interface PublishFormProps {
  readonly vocabulary: readonly VocabularyEntry[];
  readonly prefill: { readonly fullName: string };
  readonly consentVersions: ConsentVersions;
}

export function PublishForm({ vocabulary, prefill, consentVersions }: PublishFormProps) {
  /**
   * **The quarantine key, held here and bound rather than mirrored into a hidden
   * input** (ADR-0015). It arrives from {@link PhotoField} some time after the
   * form first rendered — she picks a photo, it is downscaled, it is uploaded —
   * so the binding below is re-made on the render that learns it, which is what
   * `bind` already does on every render anyway.
   *
   * **`null` is the ordinary case and stays null in three of them**: she picked
   * nothing, the upload has not finished when she submits, or JavaScript never
   * ran. All three publish a profile without a photo, which is the design.
   */
  const [photoKey, setPhotoKey] = useState<string | null>(null);

  const machine = useProfileForm({
    /**
     * **Bound here, not hidden, and bound *here* rather than inside the
     * machine** (ADR-0015). The consent versions travel in the action
     * reference, so the JSX carries no mirror of them and a browser with
     * JavaScript unavailable still submits them. The machine is shared with a
     * form that has no consent at all, which is why the binding is the
     * surface's job.
     */
    action: publishProfile.bind(null, consentVersions, photoKey),
    initial: INITIAL_RESULT,
    schema: publishProfileSchema,
    faultMessage: PUBLISH_FAILED,
  });
  const form = useProfileFields(prefill, machine.refusedValues);
  const base = useId();

  /**
   * PROTOTYPE (#18 Act 5). `?variant=` picks which photo control renders; A is
   * the shipped one, so a visit with no parameter is exactly today's page and
   * the comparison stays honest.
   */
  // `?.` because `useSearchParams()` is null with no router context, which is
  // every case in `publish-form.test.tsx`.
  const variant = useSearchParams()?.get("variant") ?? "A";
  const photoSlot =
    variant === "B" ? (
      <VariantB
        onPhotoKeyChange={setPhotoKey}
        hydrated={machine.hydrated}
        firstName={form.state.values.firstName ?? ""}
      />
    ) : variant === "C" ? (
      <VariantC onPhotoKeyChange={setPhotoKey} hydrated={machine.hydrated} firstName="" />
    ) : (
      <PhotoField onPhotoKeyChange={setPhotoKey} hydrated={machine.hydrated} />
    );

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
        photoSlot={photoSlot}
      />
    </form>
  );
}
