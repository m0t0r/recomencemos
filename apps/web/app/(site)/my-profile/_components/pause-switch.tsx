"use client";

/**
 * **Her Pause switch** (story 25): one tap, no confirmation step, one sentence
 * beside it naming its two limits — and it works before the page has hydrated.
 *
 * **The registry's `Switch`, rendered as a submit button.** Base UI's `Switch`
 * (1.8.0) takes `nativeButton` with `render={<button type="submit" />}`, and the
 * caller's `type` survives `useButton`'s default — so the HTML React sends is a
 * `<button type="submit" role="switch">` inside this form, and unhydrated a tap
 * is a native post (NFR4). Once hydrated, the root's own click handler cancels
 * that native submit and toggles its hidden checkbox instead, so
 * `onCheckedChange` is where the post is re-issued, with `requestSubmit()`. Both
 * halves were measured in happy-dom rather than read off the source: zero
 * submits from a hydrated click without the handler, exactly one with it.
 * `own-profile-view.test.tsx` pins the unhydrated half.
 *
 * **Controlled by the state the page rendered**, so the thumb never moves on a
 * tap: it moves when the redirect re-reads the row. That is also what makes a
 * repeat tap, or a second tab, land on an idempotent no-op rather than an undo —
 * which endpoint the form posts to is that same rendered state. Each half has
 * its own `useActionState`, and the one read is the one matching the move, for
 * the reason `offer-row.tsx` gives about two results that both persist.
 *
 * **Success is a redirect**, and the page announces the new state in its focused
 * status region. **A refusal renders here**: the ceiling's own sentence — how
 * many taps today and when she may tap again — followed by which state the
 * profile is in now, which only this component knows; or a transport fault's.
 */

import { Alert, AlertDescription } from "@repo/design-system/components/alert";
import { Field, FieldDescription, FieldLabel } from "@repo/design-system/components/field";
import { Switch } from "@repo/design-system/components/switch";
import { useActionState, useId, useRef } from "react";
import { feedbackFor } from "@/app/_lib/form/feedback";
import { pauseProfile, resumeProfile } from "../actions";
import {
  PAUSE_FAULT,
  PAUSE_LIMITS,
  PAUSE_SWITCH_LABEL,
  STILL_PAUSED,
  STILL_VISIBLE,
} from "../_lib/messages";

type PauseResult = Awaited<ReturnType<typeof pauseProfile>>;
type ResumeResult = Awaited<ReturnType<typeof resumeProfile>>;

const NOTHING_YET: PauseResult & ResumeResult = {};

export function PauseSwitch({ paused }: { readonly paused: boolean }) {
  const switchId = useId();
  const limitsId = useId();
  const form = useRef<HTMLFormElement>(null);
  const [pauseResult, pauseAction, pausing] = useActionState(pauseProfile, NOTHING_YET);
  const [resumeResult, resumeAction, resuming] = useActionState(resumeProfile, NOTHING_YET);

  const feedback = feedbackFor(paused ? resumeResult : pauseResult, PAUSE_FAULT);
  const working = pausing || resuming;

  return (
    <form
      ref={form}
      action={paused ? resumeAction : pauseAction}
      className="flex flex-col items-start gap-2"
    >
      <Field orientation="horizontal" className="w-auto">
        <Switch
          id={switchId}
          nativeButton
          // oxlint-disable-next-line jsx-a11y/control-has-associated-label -- named by the `FieldLabel htmlFor` below, which the rule cannot see through `render`; the tests query it by that name
          render={<button type="submit" />}
          checked={paused}
          aria-describedby={limitsId}
          // `aria-disabled` rather than `disabled`, so focus stays on the control
          // while the post is in flight instead of falling to the page. The
          // native submit is already cancelled once hydrated; this only declines
          // to re-issue it.
          aria-disabled={working || undefined}
          onCheckedChange={() => {
            if (!working) form.current?.requestSubmit();
          }}
        />
        {/* `min-h-11`: the label is the tap target a thumb aims for (WCAG 2.5.8). */}
        <FieldLabel htmlFor={switchId} className="min-h-11 text-base">
          {PAUSE_SWITCH_LABEL}
        </FieldLabel>
      </Field>

      <FieldDescription id={limitsId} className="max-w-prose text-pretty">
        {PAUSE_LIMITS}
      </FieldDescription>

      {feedback ? (
        <Alert
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- `<output>` takes phrasing content only; the registry Alert is a block
          role="status"
        >
          <AlertDescription>
            <p className="text-pretty">{feedback.message}</p>
            {feedback.retryAfter !== undefined ? (
              <p className="text-pretty">{paused ? STILL_PAUSED : STILL_VISIBLE}</p>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
    </form>
  );
}
