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
 *
 * **Both halves are rows of the sheet the list is drawn on.** The note and the
 * control each open on a ruling, so the page reads as one page rather than as a
 * list with two things stacked under it.
 */

import { Button } from "@repo/design-system/components/button";
import { cn } from "@repo/design-system/lib/utils";
import { InfoIcon, TriangleAlertIcon } from "lucide-react";
import * as React from "react";
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
  const [result, formAction] = React.useActionState(signOutEverywhere, INITIAL);
  const announcementRef = React.useRef<HTMLDivElement | null>(null);

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
   * otherwise have to go looking for what happened. Moving focus to the note
   * says what happened first and leaves the button one step away.
   */
  React.useEffect(() => {
    if (announcement) announcementRef.current?.focus();
  }, [announcement]);

  /**
   * **A limit of the platform, which is the only thing `destructive` may mark.**
   * A returned `serverError` is the action refusing — the revocation did not
   * happen and she is being asked to try again. Everything else that reaches
   * this region is the outcome she asked for.
   */
  const Mark = failure ? TriangleAlertIcon : InfoIcon;

  return (
    <div className="flex flex-col">
      {/*
        **The region is permanent and its contents are not.** It used to be
        mounted together with its own text, which is the announcement least
        reliably read: a live region that arrives already holding its message is
        one some screen readers never announce at all. It is here from the first
        paint now, and the note is swapped into it — the shape `/sign-in` uses.

        **It is named, and `FEEDBACK_REGION_LABEL` is what names it.** That
        string was written for this element — *"where the announcement lands,
        named for a screen reader rather than for a sighted reader"* — and had
        never been wired to anything, so the region a person landed in had no
        name at all. It is not visible text: a sighted reader has the sentence.

        `role="status"` is polite rather than assertive, and the override is the
        point: `alert` interrupts whatever a screen reader is saying, and this is
        the result of something she just asked for.

        `prefer-tag-over-role` asks for `<output>`, which is right in general and
        wrong here: `<output>`'s content model is **phrasing content**, and this
        region holds a `<div>` and a `<p>` — flow content. Taking the suggestion
        would produce invalid HTML for a role the attribute already carries
        correctly.
      */}
      <div
        ref={announcementRef}
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- see above.
        role="status"
        aria-live="polite"
        aria-label={FEEDBACK_REGION_LABEL}
        // Focusable programmatically but not in the tab order: a destination for
        // focus after an outcome, never a stop on the way to the button.
        tabIndex={-1}
        className="focus-visible:ring-ring/50 rounded-md outline-none focus-visible:ring-[3px]"
      >
        {announcement ? (
          <div className="border-border grid grid-cols-[1.25rem_1fr] gap-x-3 border-t py-4">
            <Mark
              aria-hidden="true"
              /* Centred on the first line: a 20 px mark against a 24 px line is 2 px down. */
              className={cn("mt-0.5 size-5", failure ? "text-destructive" : "text-primary")}
            />
            <p className="text-foreground text-base leading-6 text-pretty">{announcement}</p>
          </div>
        ) : null}
      </div>

      <div className="border-border border-t pt-5">
        {otherCount === 0 ? (
          /*
            **Absent, not disabled.** There is nothing wrong and nothing to
            close, so a greyed-out button would invite her to work out why it
            will not respond. The sentence says the true thing instead.
          */
          <p className="text-muted-foreground text-sm text-pretty">{ONLY_THIS_SESSION}</p>
        ) : (
          <form action={formAction}>
            <CloseOthersButton count={otherCount} />
          </form>
        )}
      </div>
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
 * an `outline` button read as tertiary on a phone.
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
