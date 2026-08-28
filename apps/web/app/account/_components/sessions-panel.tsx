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
 * page then re-renders with the list already re-read — the whole outcome,
 * without a line of client JavaScript having run.
 *
 * **There is no dialog and no confirmation step**, decided at shape: a modal on
 * a phone covers the list she just read, which is the one thing a confirmation
 * must not do when the list is why the action feels safe. The count in the
 * button label carries that weight instead.
 */

import { Alert, AlertDescription } from "@repo/design-system/components/alert";
import { Button } from "@repo/design-system/components/button";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { signOutEverywhere } from "../actions";
import { closeOthersButton, ONLY_THIS_SESSION } from "../_lib/messages";

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
   * otherwise have to go looking for what happened. Moving focus to the alert
   * says what happened first and leaves the button one step away.
   */
  useEffect(() => {
    if (announcement) announcementRef.current?.focus();
  }, [announcement]);

  return (
    <div className="flex flex-col gap-4">
      {announcement ? (
        <Alert
          ref={announcementRef}
          variant={failure ? "destructive" : "default"}
          /*
            `role="status"` overrides the component's own `role="alert"`, and the
            override is the point: `alert` is assertive and interrupts whatever a
            screen reader is saying. This is the result of something she just
            asked for, so it is announced politely — `alert` is for the
            unexpected.

            The lint rule below prefers the `<output>` element to this role, and
            it is right in general — but the element here is `Alert`, which is
            registry output rendering a `div`, and `DESIGN.md` forbids hand-editing
            files under `src/components/`. Scoped to this line with the reason
            rather than turned off anywhere wider.
          */
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- Alert is registry output and renders a div; see above.
          role="status"
          aria-live="polite"
          // Focusable programmatically but not in the tab order: a destination
          // for focus after an outcome, never a stop on the way to the button.
          tabIndex={-1}
        >
          <AlertDescription>{announcement}</AlertDescription>
        </Alert>
      ) : null}

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
 * **Primary, not outline.** This is the only action on the surface and the whole
 * reason the page exists, and `DESIGN.md` gives `primary` to primary actions.
 * Nothing competes with it, so there is no hierarchy to solve by demoting it —
 * an `outline` button on a white card read as tertiary on a phone.
 *
 * **Not `destructive`**, and that follows from the same argument that removed
 * the dialog: closing a session is disruptive, not destructive — nothing is lost
 * and anyone affected signs in again. `deleteAccount` (#29) is the surface that
 * is genuinely irreversible, and spending the destructive treatment here would
 * flatten the difference when it lands.
 *
 * **The list is not disabled while this is busy.** It is still accurate and she
 * may still be reading it; disabling the evidence during the action would take
 * away the thing she is acting on.
 */
function CloseOthersButton({ count }: { readonly count: number }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {closeOthersButton(count)}
    </Button>
  );
}
