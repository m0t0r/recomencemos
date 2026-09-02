"use client";

/**
 * The form element and its wiring, and nothing about layout.
 *
 * Three variants of `/publish`, switchable via `?variant=`, on the real route
 * with the real Server Action behind them (`/prototype` UI, sub-shape A). Each
 * variant owns everything inside the `<form>` — order, hierarchy, where the
 * summary sits, where the button sits — and this component owns what must be
 * true whichever one wins:
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
import type { VocabularyEntry } from "./skill-picker";
import { type VariantProps, VARIANTS, type VariantKey } from "./variants";

export interface PublishFormProps {
  readonly vocabulary: readonly VocabularyEntry[];
  readonly prefill: { readonly fullName: string };
  readonly consentVersions: ConsentVersions;
  readonly variant: VariantKey;
}

export function PublishForm({ vocabulary, prefill, consentVersions, variant }: PublishFormProps) {
  const machine = usePublish(consentVersions);
  const form = usePublishForm(prefill);
  const base = useId();

  const idFor = (field: PublishFieldName, index?: number) =>
    index === undefined ? `${base}-${field}` : `${base}-${field}-${index}`;

  const variantProps: VariantProps = {
    form,
    machine,
    vocabulary,
    idFor,
    serverErrorFor: (field, index) =>
      serverFieldError(machine.result.validationErrors, field, index),
  };

  const Layout = VARIANTS[variant].component;

  return (
    <form
      action={machine.formAction}
      noValidate={machine.hydrated}
      onSubmit={(event) => machine.guardSubmit(event, () => void form.handleSubmit())}
      className="flex flex-col gap-8"
      data-variant={variant}
    >
      <Layout {...variantProps} />
    </form>
  );
}
