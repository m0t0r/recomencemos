"use client";

/**
 * **Her Pause switch** (story 25): one tap, no confirmation step, one sentence
 * beside it naming its two limits — and it works before the page has hydrated.
 *
 * **A real submit button carrying `role="switch"`, not the registry's `Switch`,
 * and the registry was read before deciding that.** Base UI's `Switch` (1.8.0,
 * `switch/root/SwitchRoot.js`) renders a `<span role="switch">` that toggles a
 * hidden checkbox in JavaScript, so unhydrated it is a control that does
 * nothing — which NFR4 refuses for this act by name. Given `nativeButton` it
 * renders a `<button>`, but `useButton` stamps `type="button"` on it, so it
 * cannot post a form either. So the control is a plain `<button type="submit">`
 * with the switch's semantics, and the track and thumb are drawn with the tokens
 * `switch.tsx` uses: the registry's look, on the one element that can carry a
 * form post. `buttonVariants` on a plain element is this repository's own rule
 * for the same reason — see `sign-in-link.tsx`.
 *
 * **Two actions, one form in the DOM.** Which endpoint the form posts to is the
 * state the page rendered, so a tap is always the move the switch shows — and a
 * repeat tap, or a second tab, lands on an idempotent no-op rather than an undo.
 * Each half has its own `useActionState`, and the one read is the one matching
 * the move, for the reason `offer-row.tsx` gives about two results that both
 * persist.
 *
 * **Success is a redirect**, and the page announces the new state in its focused
 * status region. **A refusal renders here**: the ceiling's own sentence — how
 * many taps today, when she may tap again, and that the profile stayed as the
 * state line says — or a transport fault's.
 */

import { Alert, AlertDescription } from "@repo/design-system/components/alert";
import { buttonVariants } from "@repo/design-system/components/button-variants";
import { cn } from "@repo/design-system/lib/utils";
import { useActionState, useId } from "react";
import { feedbackFor } from "@/app/_lib/form/feedback";
import { pauseProfile, resumeProfile } from "../actions";
import { PAUSE_FAULT, PAUSE_LIMITS, PAUSE_SWITCH_LABEL } from "../_lib/messages";

type PauseResult = Awaited<ReturnType<typeof pauseProfile>>;
type ResumeResult = Awaited<ReturnType<typeof resumeProfile>>;

const NOTHING_YET: PauseResult & ResumeResult = {};

export function PauseSwitch({ paused }: { readonly paused: boolean }) {
  const limitsId = useId();
  const [pauseResult, pauseAction, pausing] = useActionState(pauseProfile, NOTHING_YET);
  const [resumeResult, resumeAction, resuming] = useActionState(resumeProfile, NOTHING_YET);

  const feedback = feedbackFor(paused ? resumeResult : pauseResult, PAUSE_FAULT);
  const working = pausing || resuming;

  return (
    <form action={paused ? resumeAction : pauseAction} className="flex flex-col items-start gap-2">
      <button
        type="submit"
        role="switch"
        aria-checked={paused}
        aria-describedby={limitsId}
        // `aria-disabled` rather than `disabled`, so focus stays on the control
        // while the post is in flight instead of falling to the page.
        aria-disabled={working || undefined}
        onClick={(event) => {
          if (working) event.preventDefault();
        }}
        className={cn(buttonVariants({ variant: "outline" }), "h-11 gap-3 px-4")}
      >
        {/* The registry `Switch`'s track and thumb, drawn: see the file comment. */}
        <span
          aria-hidden="true"
          data-checked={paused ? "" : undefined}
          className="group/track bg-input data-checked:bg-primary relative inline-flex h-[18.4px] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-colors duration-150"
        >
          <span className="bg-background block size-4 translate-x-0 rounded-full transition-transform duration-150 group-data-checked/track:translate-x-[calc(100%-2px)]" />
        </span>
        {PAUSE_SWITCH_LABEL}
      </button>

      <p id={limitsId} className="text-muted-foreground max-w-prose text-sm text-pretty">
        {PAUSE_LIMITS}
      </p>

      {feedback ? (
        <Alert
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- `<output>` takes phrasing content only; the registry Alert is a block
          role="status"
        >
          <AlertDescription>
            <p className="text-pretty">{feedback.message}</p>
          </AlertDescription>
        </Alert>
      ) : null}
    </form>
  );
}
