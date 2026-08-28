"use client";

/**
 * The one action on `/account`, and everything that happens around it.
 *
 * **`"use client"` buys exactly three things**, and nothing else here needs it:
 * the pending state while the form is in flight, the announcement of the
 * outcome, and the focus move that puts that outcome where a screen-reader user
 * meets it. The list above it is a Server Component and stays one.
 *
 * **It works with JavaScript unavailable**, which is why this is `useActionState`
 * and a native `<form action>` rather than `useAction` or an `onClick`.
 * next-safe-action's own form guide marks the other two as not working
 * unhydrated; a `.stateAction()` is a real server-action reference, so React
 * emits the no-JS form encoding and an un-hydrated submit posts natively. The
 * page then re-renders with the list already re-read — which is the whole
 * outcome, without a line of client JavaScript having run.
 *
 * **There is no dialog and no confirmation step**, decided at shape: a modal on
 * a phone covers the list she just read, which is the one thing a confirmation
 * must not do when the list is why the action feels safe. The count in the
 * button label carries that weight instead. See `.impeccable/briefs/account.md`.
 */

import { Button } from "@repo/design-system/components/button";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { signOutEverywhere } from "../actions";
import { closeOthersButton, FEEDBACK_REGION_LABEL, ONLY_THIS_SESSION } from "../_lib/messages";

type Result = Awaited<ReturnType<typeof signOutEverywhere>>;

/**
 * next-safe-action's own "nothing has happened yet", so `idle` is not a state
 * this surface invents and then has to keep in agreement with the library's.
 */
const INITIAL: Result = {};

export interface SessionsPanelProps {
  /** How many sessions are not this one. Zero renders no control at all. */
  readonly otherCount: number;
}

export function SessionsPanel({ otherCount }: SessionsPanelProps) {
  const [result, formAction] = useActionState(signOutEverywhere, INITIAL);
  const announcementRef = useRef<HTMLDivElement | null>(null);

  const success = result.data?.message;
  /**
   * **`ClientError.message` is the user-facing string, and that is not a
   * shortcut.** `AppError` carries two: `message` for an operator, which reaches
   * the log line, and `userMessage`, the only one permitted to reach a browser.
   * `projectClientError` puts the second into the envelope's `message`, so what
   * arrives here has already been through the whitelist — there is deliberately
   * no path from the operator sentence to this one.
   */
  const failure = result.serverError?.message;
  const announcement = success ?? failure;

  /**
   * **Focus follows the outcome, not the control.** A list shrinking by two rows
   * announces nothing on its own, and a person using a screen reader would
   * otherwise have to go looking for what happened. Moving focus to the live
   * region says what happened first and leaves the button one step away.
   */
  useEffect(() => {
    if (announcement) announcementRef.current?.focus();
  }, [announcement]);

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={announcementRef}
        // Focusable programmatically but not in the tab order: it is a
        // destination for focus after an outcome, never a stop on the way to the
        // button.
        tabIndex={-1}
        role="status"
        aria-live="polite"
        aria-label={FEEDBACK_REGION_LABEL}
        className="focus-visible:ring-ring focus-visible:ring-3 focus-visible:outline-none"
      >
        {announcement ? (
          <p
            className={
              success ? "text-success text-sm font-medium" : "text-destructive text-sm font-medium"
            }
          >
            {announcement}
          </p>
        ) : null}
      </div>

      {otherCount === 0 ? (
        /*
          **Absent, not disabled.** There is nothing wrong and nothing to close,
          so a greyed-out button would invite her to work out why it will not
          respond. The sentence says the true thing instead.
        */
        <p className="text-muted-foreground text-sm">{ONLY_THIS_SESSION}</p>
      ) : (
        <form action={formAction}>
          <CloseOthersButton count={otherCount} />
        </form>
      )}
    </div>
  );
}

/**
 * Split out so `useFormStatus` can read the form it is inside — the hook reports
 * on the nearest ancestor `<form>`, so a component that renders the form cannot
 * also read its status.
 *
 * **The list is not disabled while this is busy.** It is still accurate and she
 * may still be reading it; disabling the evidence during the action would take
 * away the thing she is acting on.
 */
function CloseOthersButton({ count }: { readonly count: number }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="outline" disabled={pending} aria-busy={pending}>
      {closeOthersButton(count)}
    </Button>
  );
}
