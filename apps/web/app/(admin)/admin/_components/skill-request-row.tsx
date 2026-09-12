"use client";

/**
 * One requested capability, and the form that promotes it.
 *
 * **It is a queue item with its resolver attached, which is the story's whole
 * argument.** A request an Admin can read and cannot act on is a row that
 * accumulates, and the branch's age-of-oldest then measures nothing but how long
 * the feature has been half-built. So promotion ships beside the request rather
 * than behind the section route that will eventually hold it.
 *
 * **This is the plain version of a row, on purpose.** What is here is what has
 * to be true wherever the row sits — her words in full, two named fields, one
 * action, and an answer that is announced. It opens inside the one table (#277)
 * like every other source's row.
 *
 * **It has no key.** The table's `a`/`r` press a row's own decision buttons, and
 * promoting a request means typing an identifier and a name first — no single
 * key can stand in for that, so this row's button carries no `data-queue-key`
 * and the table's hint says so.
 *
 * **Focus and the announcement are `use-queue-row.ts`'s**: a promotion that lands
 * hands the keyboard to the next row still waiting rather than back to the one
 * just resolved.
 */

import { Button } from "@repo/design-system/components/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@repo/design-system/components/field";
import { Input } from "@repo/design-system/components/input";
import { useActionState, useId } from "react";
import { promoteSkill } from "../actions";
import {
  PROMOTE_CUOC_HELP,
  PROMOTE_CUOC_LABEL,
  PROMOTE_HEADING,
  PROMOTE_LABEL_HELP,
  PROMOTE_LABEL_LABEL,
  PROMOTE_SLUG_HELP,
  PROMOTE_SLUG_LABEL,
  PROMOTE_SUBMIT,
  PROMOTE_SUBMITTING,
  requestedOn,
  skillPromoted,
} from "../_lib/messages";
import type { QueueItem } from "../_lib/queue-sources";
import { QUEUE_FOCUSABLE_LINE, useQueueRow } from "../_lib/use-queue-row";

type Result = Awaited<ReturnType<typeof promoteSkill>>;

const INITIAL: Result = {};

export function SkillRequestRow({ item }: { readonly item: QueueItem }) {
  /**
   * **The request id is bound rather than mirrored into a hidden input**
   * (ADR-0015): React encodes it into the action reference, the action validates
   * it on arrival, and this row's markup carries no copy of it. `bind` returns a
   * new reference per render, which `useActionState` is fine with — it is the
   * shape `/publish` already uses for the consent versions.
   */
  const [result, formAction, pending] = useActionState(promoteSkill.bind(null, item.id), INITIAL);
  const slugId = useId();
  const slugHelpId = useId();
  const labelId = useId();
  const labelHelpId = useId();
  const cuocId = useId();
  const cuocHelpId = useId();
  const { announcementRef } = useQueueRow(result);

  // next-safe-action's own formatted-error shape; `_errors` is its name, not ours.
  /* oxlint-disable no-underscore-dangle */
  const slugError = result.validationErrors?.slug?._errors?.[0];
  const labelError = result.validationErrors?.labelEs?._errors?.[0];
  const cuocError = result.validationErrors?.cuocCode?._errors?.[0];
  /* oxlint-enable no-underscore-dangle */

  const announcement = result.data
    ? skillPromoted(result.data.labelEs)
    : (result.serverError?.message ?? slugError ?? labelError ?? cuocError);

  return (
    <div className="flex flex-col gap-3">
      {/*
        Her words, in full and unedited. The spec's rule for every branch is that
        it renders in full so nothing is acted on unread, and on this source that
        is not a formality: the Admin is about to translate this sentence into a
        label the whole product renders.

        It is also where focus lands when the request above it is resolved — the
        next thing an Admin does with a request is read it.
      */}
      <p tabIndex={-1} data-queue-anchor="" className={QUEUE_FOCUSABLE_LINE}>
        {item.summary}
      </p>
      <p className="text-muted-foreground text-xs">{requestedOn(item.arrivedAt)}</p>

      <p
        ref={announcementRef}
        tabIndex={-1}
        // See `sessions-panel.tsx`: `<output>`'s content model is phrasing
        // content, and the rule's suggestion is right in general and wrong here.
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="status"
        className={QUEUE_FOCUSABLE_LINE}
      >
        {announcement}
      </p>

      {/*
        Hidden while the row is unresolved would be tidier and would cost the
        Admin a click on every single request. The form is the row's reason to
        exist, so it is open.
      */}
      {result.data ? null : (
        <form action={formAction} className="flex flex-col gap-3">
          <FieldSet className="gap-3">
            <FieldLegend variant="label">{PROMOTE_HEADING}</FieldLegend>

            <Field>
              <FieldLabel htmlFor={slugId}>{PROMOTE_SLUG_LABEL}</FieldLabel>
              <FieldDescription id={slugHelpId}>{PROMOTE_SLUG_HELP}</FieldDescription>
              <Input
                id={slugId}
                name="slug"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                required
                aria-invalid={slugError !== undefined}
                aria-describedby={slugError ? `${slugHelpId} ${slugId}-error` : slugHelpId}
              />
              {slugError ? <FieldError id={`${slugId}-error`}>{slugError}</FieldError> : null}
            </Field>

            <Field>
              <FieldLabel htmlFor={labelId}>{PROMOTE_LABEL_LABEL}</FieldLabel>
              <FieldDescription id={labelHelpId}>{PROMOTE_LABEL_HELP}</FieldDescription>
              <Input
                id={labelId}
                name="labelEs"
                autoComplete="off"
                required
                aria-invalid={labelError !== undefined}
                aria-describedby={labelError ? `${labelHelpId} ${labelId}-error` : labelHelpId}
              />
              {labelError ? <FieldError id={`${labelId}-error`}>{labelError}</FieldError> : null}
            </Field>

            <Field>
              <FieldLabel htmlFor={cuocId}>{PROMOTE_CUOC_LABEL}</FieldLabel>
              <FieldDescription id={cuocHelpId}>{PROMOTE_CUOC_HELP}</FieldDescription>
              <Input
                id={cuocId}
                name="cuocCode"
                inputMode="numeric"
                autoComplete="off"
                aria-invalid={cuocError !== undefined}
                aria-describedby={cuocError ? `${cuocHelpId} ${cuocId}-error` : cuocHelpId}
              />
              {cuocError ? <FieldError id={`${cuocId}-error`}>{cuocError}</FieldError> : null}
            </Field>
          </FieldSet>

          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="self-start"
            disabled={pending}
            aria-busy={pending}
          >
            {pending ? PROMOTE_SUBMITTING : PROMOTE_SUBMIT}
          </Button>
        </form>
      )}
    </div>
  );
}
