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
 * **This is the plain version of a row, on purpose.** The shaped section — the
 * fixed row rhythm, the same affordances in the same position every time, the
 * decline that is the other half — belongs to the Admin queue's own ticket, where
 * there is a sidebar to sit in and four other sources to be consistent with.
 * What is here is what has to be true whatever that section looks like: her words
 * in full, two named fields, one action, and an answer that is announced.
 *
 * **Focus returns to the row, not to the top of the page.** The queue is worked
 * top to bottom by one person; a page that scrolled home after every promotion
 * would cost that person their position several hundred times a day. The rule and
 * its reasoning are `sessions-panel.tsx`'s, copied rather than extracted — this is
 * the second instance, and three is when a hook stops being a guess.
 */

import { Button } from "@repo/design-system/components/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@repo/design-system/components/field";
import { Input } from "@repo/design-system/components/input";
import { useActionState, useEffect, useId, useRef } from "react";
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

type Result = Awaited<ReturnType<typeof promoteSkill>>;

const INITIAL: Result = {};

export function SkillRequestRow({ item }: { readonly item: QueueItem }) {
  const [result, formAction, pending] = useActionState(promoteSkill, INITIAL);
  const requestId = useId();
  const slugId = useId();
  const slugHelpId = useId();
  const labelId = useId();
  const labelHelpId = useId();
  const cuocId = useId();
  const cuocHelpId = useId();
  const announcementRef = useRef<HTMLParagraphElement>(null);

  // Read from `result` rather than a derived boolean, so the second outcome moves
  // focus too — `result` is a fresh object per dispatch.
  useEffect(() => {
    if (result.data ?? result.serverError ?? result.validationErrors) {
      announcementRef.current?.focus();
    }
  }, [result]);

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
      */}
      <p className="text-foreground text-sm leading-5">{item.summary}</p>
      <p className="text-muted-foreground text-xs">{requestedOn(item.arrivedAt)}</p>

      <p
        ref={announcementRef}
        tabIndex={-1}
        // See `sessions-panel.tsx`: `<output>`'s content model is phrasing
        // content, and the rule's suggestion is right in general and wrong here.
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="status"
        className="focus-visible:ring-ring/50 text-foreground rounded-md text-sm leading-5 outline-none focus-visible:ring-[3px]"
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
          <fieldset className="contents">
            <legend className="text-muted-foreground text-xs">{PROMOTE_HEADING}</legend>

            {/*
              **The request id is a bound value the row already knows**, and it is
              a hidden input rather than `action.bind` for one reason: ADR-0015's
              rule is about values that travel with a *submit she typed into*, and
              this is a row identifier the server re-checks under a lock before it
              does anything. A forged id reaches a 404 or a resolved request, both
              of which are refusals this action already answers.
            */}
            <input type="hidden" name="requestId" value={item.id} id={requestId} readOnly />

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
          </fieldset>

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
