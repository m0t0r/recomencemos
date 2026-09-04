"use client";

/**
 * The one Admin action that exists today, and the control every queue action will
 * copy.
 *
 * **`revokeSessions` is here because NFR13 names it** — _"an Admin ends a reported
 * Hirer's while handling the Report"_ — and because it is the only one of the
 * spec's eleven that needs no entity a later story creates. Story 10 will invoke
 * the same action from a Report's queue item; this panel is what makes it usable
 * before that item exists, which matters on a platform where a Report can arrive
 * tomorrow.
 *
 * **The focus behaviour is the rule's first instance, not a shared control.**
 * _"Admin actions return focus to the queue position the item left, not the top,
 * because the queue is worked top to bottom by one person."_ Here there is one
 * control and its position is itself, so focus returns to *it* — the same rule at
 * its simplest. There is deliberately **no extracted hook**: one caller does not
 * justify an abstraction, and a hook written for a queue item that does not exist
 * would be guessing at its shape. Story 7 inherits this by copying the effect
 * below, and the day there are three of them is the day to extract one.
 */

import { Button } from "@repo/design-system/components/button";
import { Card } from "@repo/design-system/components/card";
import { Field, FieldError, FieldLabel } from "@repo/design-system/components/field";
import { Input } from "@repo/design-system/components/input";
import { useActionState, useEffect, useId, useRef } from "react";
import { revokeSessions } from "../actions";
import {
  SESSIONS_EMAIL_LABEL,
  SESSIONS_EXPLANATION,
  SESSIONS_HEADING,
  SESSIONS_SUBMIT,
  SESSIONS_SUBMITTING,
  sessionsRevoked,
} from "../_lib/messages";

type Result = Awaited<ReturnType<typeof revokeSessions>>;

const INITIAL: Result = {};

export function SessionsPanel() {
  const [result, formAction, pending] = useActionState(revokeSessions, INITIAL);
  const emailId = useId();
  const errorId = useId();
  const announcementRef = useRef<HTMLParagraphElement>(null);

  /**
   * **Focus returns to where the work was, not to the top of the page.**
   *
   * The queue is worked top to bottom by one person, so a page that scrolled home
   * after every action would cost that person the position they had, several
   * hundred times a day. The general rule for a queue item is "the position the
   * item left"; for a control that stays put, that position is the announcement
   * beside it — which also puts *what happened* in front of a screen-reader user
   * before the control they are about to use again.
   *
   * Read from `result` inside the effect rather than from a derived boolean: a
   * boolean stays `true` across a second outcome, so focus would move once and
   * never again. `result` is a fresh object per dispatch.
   */
  useEffect(() => {
    if (result.data ?? result.serverError ?? result.validationErrors) {
      announcementRef.current?.focus();
    }
  }, [result]);

  // `_errors` is next-safe-action's own formatted-error shape, not a private
  // field of ours — the rule is about names this repository chooses.
  // oxlint-disable-next-line no-underscore-dangle
  const fieldError = result.validationErrors?.email?._errors?.[0];
  const invalid = fieldError !== undefined;

  /**
   * **Every outcome, including a field error**, and that last one is a fix rather
   * than a completeness pass. The effect above moves focus on `validationErrors`
   * too, and this region used to render only `data` and `serverError` — so a
   * malformed address moved focus to an **empty** `role="status"`. A screen-reader
   * user heard nothing and was left on a region with no content, while the reason
   * sat in the `FieldError` below.
   *
   * A form-level summary carrying the message is also what the spec's keyboard
   * rules ask for: _"on submit failure focus moves to the **form-level summary**,
   * not the first bad field"_.
   */
  const announcement = result.data
    ? sessionsRevoked(result.data.revoked)
    : (result.serverError?.message ?? fieldError);

  return (
    /*
      **The card carried `aria-labelledby` and no role, and the attribute was
      doing nothing.** `Card` renders a plain `<div>`, whose implicit role is
      `generic`, and ARIA forbids naming a generic element — axe flags it, which
      is how it was found: this panel only got audited once it had a route of its
      own. Adding a role to make the name legal is the wrong repair. The heading
      below already names this content in the document outline, which is how a
      screen-reader user reaches it, and the page around it is one `<section>`
      holding only this. So the label is gone rather than propped up.
    */
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-foreground text-lg font-semibold">{SESSIONS_HEADING}</h2>
        {/*
          "Queda registrado quién lo hizo y cuándo" is not reassurance — it is the
          Admin being told that NFR33 applies to them too. An audit nobody knows
          about deters nothing and explains nothing when a *reclamo* arrives.
        */}
        <p className="text-muted-foreground text-sm leading-5 text-pretty">
          {SESSIONS_EXPLANATION}
        </p>
      </div>

      <p
        ref={announcementRef}
        tabIndex={-1}
        // See `sign-in-form.tsx`: `<output>`'s content model is phrasing content,
        // and the rule's suggestion would be right in general and wrong here.
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="status"
        className="focus-visible:ring-ring/50 text-foreground rounded-md text-sm leading-5 outline-none focus-visible:ring-[3px]"
      >
        {announcement}
      </p>

      <form action={formAction} className="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor={emailId}>{SESSIONS_EMAIL_LABEL}</FieldLabel>
          <Input
            id={emailId}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            required
            aria-invalid={invalid}
            aria-describedby={invalid ? errorId : undefined}
          />
          {invalid ? <FieldError id={errorId}>{fieldError}</FieldError> : null}
        </Field>

        <Button
          type="submit"
          variant="outline"
          className="self-start"
          disabled={pending}
          aria-busy={pending}
        >
          {pending ? SESSIONS_SUBMITTING : SESSIONS_SUBMIT}
        </Button>
      </form>
    </Card>
  );
}
