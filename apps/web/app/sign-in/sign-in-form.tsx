"use client";

/**
 * The two doors, and the one choice that governs both.
 *
 * **This is variant B, "Framed card", locked after `/prototype` UI.** Three
 * variants ran on this real route against the real Server Action; the losing two
 * and the switcher are on the `prototype/12-sign-in-variants` branch. The
 * argument that won: on a surface where familiarity beats expression, a boundary
 * helps — a card says "this is the thing to deal with" and gives the eye an edge
 * that an open column, floating in a lot of white, does not. It is also the shape
 * of every sign-in page a Hirer has already used.
 *
 * Shaped at `.impeccable/briefs/sign-in.md`. Four decisions are load-bearing here
 * and are not free to drift:
 *
 * 1. **Google leads and the email door is fully present below it**, never behind
 *    a disclosure. Where Google is unconfigured the email form is the whole card,
 *    with no dead button and no dangling separator.
 * 2. **The Google button wears Google's own treatment** — white, bordered, with
 *    the four-colour mark — because recognition is the whole reason that door
 *    exists. See the hierarchy note on the button itself.
 * 3. **The shared-device checkbox sits outside the email form**, because it
 *    governs both doors; inside it, it would read as an email-door setting while
 *    silently shortening a Google session too.
 * 4. **The sent state keeps the form and her address**, so a link a scanner ate
 *    is one tap from a resend and the Google door is still on screen at the
 *    moment the email door may have failed her.
 *
 * `"use client"` because there is state, a pending transition per door, and a
 * focus move on every outcome. The **email door still works without it**: it is a
 * plain `<form action={…}>` bound to a Server Action, so a submit before
 * hydration posts and re-renders.
 */

import { Button } from "@repo/design-system/components/button";
import { Card } from "@repo/design-system/components/card";
import { Checkbox } from "@repo/design-system/components/checkbox";
import { Field, FieldDescription, FieldLabel } from "@repo/design-system/components/field";
import { Input } from "@repo/design-system/components/input";
import { Label } from "@repo/design-system/components/label";
import { useId } from "react";
import { GoogleMark } from "./google-mark";
import {
  EMAIL_DOOR_PRECONDITION,
  EMAIL_LABEL,
  GOOGLE_ACCOUNT_NOTICE,
  GOOGLE_BUTTON,
  RESEND_LINK_BUTTON,
  SEND_LINK_BUTTON,
  SHARED_DEVICE_HELP,
  SHARED_DEVICE_LABEL,
  SIGN_IN_TITLE,
} from "./messages";
import { useSignIn } from "./use-sign-in";

export interface SignInFormProps {
  /**
   * Whether the Google door exists in this environment. Both credentials or
   * neither — a button posting to an unconfigured provider is the dead end this
   * surface must never be, so it is absent instead of broken.
   */
  readonly googleAvailable: boolean;
  /** Where to land afterwards. Validated server-side; never trusted here. */
  readonly returnPath: string;
  /** What Better Auth redirected back with, if anything. */
  readonly error?: string | undefined;
}

export function SignInForm({ googleAvailable, returnPath, error }: SignInFormProps) {
  const machine = useSignIn({ returnPath, error });
  const emailId = useId();
  const sharedDeviceId = useId();
  const helpId = useId();

  return (
    <main className="bg-muted flex min-h-svh flex-col items-center justify-center px-4 py-12">
      <Card className="flex w-full max-w-md flex-col gap-6 p-6 sm:p-8">
        <h1 className="text-foreground text-2xl leading-8 font-semibold tracking-tight">
          {SIGN_IN_TITLE}
        </h1>

        <FeedbackRegion machine={machine} />

        {googleAvailable ? (
          <div className="flex flex-col gap-2">
            {/*
              **`outline` rather than the filled primary, and that is a decision
              about hierarchy rather than a downgrade.** Google's sign-in button
              is recognised by its shape — white, bordered, four-colour mark — and
              that recognition is the entire reason this door is first. Filling it
              with the brand's own blue would make it *louder* and *less*
              recognisable at the same time, which is the wrong trade on the
              device most Workers hold.

              What carries "Google leads" instead: position, the account notice
              under it, and the fact that it asks her to type nothing. The email
              submit below keeps the filled primary, because a form's submit is
              where a filled button belongs and the two then read as two kinds of
              action rather than as a ranking.
            */}
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full gap-3 text-base font-medium"
              onClick={machine.signInWithGoogle}
              disabled={machine.googlePending}
              aria-busy={machine.googlePending}
            >
              <GoogleMark className="size-5 shrink-0" />
              {GOOGLE_BUTTON}
            </Button>

            <p className="text-muted-foreground text-sm leading-5">{GOOGLE_ACCOUNT_NOTICE}</p>
          </div>
        ) : null}

        {googleAvailable ? (
          <div className="flex items-center gap-3" aria-hidden="true">
            <span className="bg-border h-px flex-1" />
            <span className="text-muted-foreground text-sm">o</span>
            <span className="bg-border h-px flex-1" />
          </div>
        ) : null}

        <form action={machine.formAction} className="flex flex-col gap-4">
          <input type="hidden" name="returnPath" value={returnPath} />
          {/*
            The checkbox sits outside this form's block but its value has to
            travel with the submit, so it rides as a hidden field. `"on"` is what
            a checked checkbox posts, which is what the action reads — one
            spelling, not two.
          */}
          <input type="hidden" name="sharedDevice" value={machine.sharedDevice ? "on" : "off"} />

          <Field>
            <FieldLabel htmlFor={emailId}>{EMAIL_LABEL}</FieldLabel>
            {/*
              Before she types anything, which is the ticket's own criterion: she
              needs to know she needs a mailbox she can open *now*, not after
              committing to this door.
            */}
            <FieldDescription>{EMAIL_DOOR_PRECONDITION}</FieldDescription>
            <Input
              id={emailId}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              aria-invalid={machine.state.status === "field_error"}
              className="h-12 text-base"
            />
          </Field>

          <Button
            type="submit"
            className="h-12 w-full text-base"
            disabled={machine.emailPending}
            aria-busy={machine.emailPending}
          >
            {machine.awaitingLink ? RESEND_LINK_BUTTON : SEND_LINK_BUTTON}
          </Button>
        </form>

        <div className="border-border flex items-start gap-3 border-t pt-5">
          <Checkbox
            id={sharedDeviceId}
            checked={machine.sharedDevice}
            onCheckedChange={(checked) => machine.setSharedDevice(checked === true)}
            aria-describedby={helpId}
            className="mt-1"
          />
          <div className="flex flex-col gap-1">
            <Label htmlFor={sharedDeviceId} className="text-base font-normal">
              {SHARED_DEVICE_LABEL}
            </Label>
            {/* Hours, not policy language. What it does, in the unit she thinks in. */}
            <p id={helpId} className="text-muted-foreground text-sm leading-5">
              {SHARED_DEVICE_HELP}
            </p>
          </div>
        </div>
      </Card>
    </main>
  );
}

/**
 * One region for every outcome, above the doors, so what happened is first in
 * the reading order rather than attached to whichever control produced it.
 *
 * `tabIndex={-1}` makes it programmatically focusable without putting it in the
 * tab order; `aria-live` covers the case where nobody is focused on it.
 */
function FeedbackRegion({ machine }: { machine: ReturnType<typeof useSignIn> }) {
  // Unpacked rather than reached through `machine` member by member, because
  // `ref={machine.announcementRef}` makes oxlint's `react(refs)` rule treat
  // `machine` itself as a ref object and refuse every sibling read as a ref
  // access during render. The reads are of ordinary state and always were; this
  // separates the one binding that genuinely is a ref from the ones that are not.
  const { announcementRef, feedback } = machine;

  return (
    <div
      ref={announcementRef}
      tabIndex={-1}
      aria-live="polite"
      className="focus-visible:ring-ring/50 rounded-md outline-none focus-visible:ring-[3px]"
    >
      {feedback ? (
        <div
          className={
            feedback.tone === "success"
              ? "border-border bg-muted rounded-lg border p-4"
              : "border-destructive/30 bg-destructive/5 rounded-lg border p-4"
          }
        >
          <p className="text-foreground text-base leading-6">{feedback.message}</p>
          {feedback.hint ? (
            <p className="text-muted-foreground mt-2 text-sm leading-5">{feedback.hint}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
