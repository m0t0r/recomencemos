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

import { useForm } from "@tanstack/react-form";
import { Button } from "@repo/design-system/components/button";
import { Card } from "@repo/design-system/components/card";
import { Checkbox } from "@repo/design-system/components/checkbox";
import { Field, FieldDescription, FieldLabel } from "@repo/design-system/components/field";
import { Input } from "@repo/design-system/components/input";
import { Label } from "@repo/design-system/components/label";
import { useId } from "react";
import { GoogleMark } from "./google-mark";
import {
  DOOR_DIVIDER,
  EMAIL_DOOR_PRECONDITION,
  EMAIL_LOOKS_WRONG,
  EMAIL_LABEL,
  GOOGLE_ACCOUNT_NOTICE,
  GOOGLE_BUTTON,
  RESEND_LINK_BUTTON,
  SEND_LINK_BUTTON,
  SHARED_DEVICE_HELP,
  SHARED_DEVICE_LABEL,
  SIGN_IN_TITLE,
} from "./messages";
import { isAcceptableAddress } from "./schema";
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
  const emailErrorId = useId();

  /**
   * **TanStack Form owns field state and client-side validation; it does not own
   * submission.** The `<form>` below keeps its native `action`, so the two are
   * layered rather than merged, and each keeps what it is good at.
   *
   * Two reasons it is arranged this way rather than through
   * `@tanstack/react-form-nextjs`'s `mergeForm`/`useTransform`:
   *
   * - **The no-JavaScript path has to survive.** `action={machine.formAction}`
   *   with named inputs means a submit before hydration posts natively and the
   *   Server Action answers. NFR4 requires that of `/publish`; this surface is
   *   not bound by it, but the pattern set here is the one story 2 copies, and a
   *   form abstraction that only works hydrated would make NFR4 unreachable.
   * - **The outcomes are not form state.** `rate_limited` carries a `retryAfter`,
   *   `sent` is a success that keeps the form, and `failed` is a transport
   *   problem — none is a field error, and folding them into a form state would
   *   flatten distinctions NFR26 and the surface table depend on.
   *
   * The schema is the same one the Server Action parses, so the check she gets
   * instantly and the check that actually decides cannot drift apart.
   */
  const form = useForm({ defaultValues: { email: "" } });

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
              className="w-full"
              onClick={machine.signInWithGoogle}
              disabled={machine.googlePending}
              aria-busy={machine.googlePending}
            >
              <GoogleMark />
              {GOOGLE_BUTTON}
            </Button>

            <p className="text-muted-foreground text-sm leading-5">{GOOGLE_ACCOUNT_NOTICE}</p>
          </div>
        ) : null}

        {googleAvailable ? (
          <div className="flex items-center gap-3" aria-hidden="true">
            <span className="bg-border h-px flex-1" />
            <span className="text-muted-foreground text-sm">{DOOR_DIVIDER}</span>
            <span className="bg-border h-px flex-1" />
          </div>
        ) : null}

        <form
          action={machine.formAction}
          /*
            Runs before the action. `form.handleSubmit()` marks fields touched
            and surfaces the message without a round trip; `preventDefault` stops
            the post only when the client already knows the answer, so a valid
            submit still goes to the server and an invalid one costs her nothing.
          */
          onSubmit={(event) => {
            if (isAcceptableAddress(form.state.values.email)) return;

            // Only when the browser already knows the answer. A valid submit is
            // never intercepted, so the server still performs the parse that
            // actually decides.
            event.preventDefault();
            void form.handleSubmit();
          }}
          className="flex flex-col gap-4"
        >
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
            <form.Field
              name="email"
              /*
                **The validator is on the field, not on the form**, so the error
                lands where it is rendered instead of relying on the library
                mapping a schema's paths down to fields.

                The *rule* is still the shared one — `isAcceptableAddress` comes
                from `./schema`, which the Server Action parses with. What lives
                here is only the sentence, because the sentence is
                `docs/policy/voice.md`'s and a schema is the wrong place for
                Spanish.

                `onBlur` lets an empty field alone: she has not finished, and
                telling her an empty box is wrong while she is still filling it in
                is the form nagging rather than helping. `onSubmit` has no such
                exemption.
              */
              validators={{
                onBlur: ({ value }: { value: string }) =>
                  value === "" || isAcceptableAddress(value) ? undefined : EMAIL_LOOKS_WRONG,
                onSubmit: ({ value }: { value: string }) =>
                  isAcceptableAddress(value) ? undefined : EMAIL_LOOKS_WRONG,
              }}
            >
              {(field) => {
                // The server's verdict and the client's are the same rule, so
                // either one marks the field. Hers arrives instantly; the
                // server's is the one that counts.
                // The validator's message, or the server's. Rendering what the
                // validator actually returned is what stops it being computed
                // and thrown away — and it is what would let a second rule on
                // this field say something different from the first.
                const clientError = field.state.meta.errors[0];
                const invalid = machine.state.status === "field_error" || Boolean(clientError);
                const message = typeof clientError === "string" ? clientError : EMAIL_LOOKS_WRONG;

                return (
                  <>
                    <Input
                      id={emailId}
                      name="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      spellCheck={false}
                      required
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                      onBlur={field.handleBlur}
                      aria-invalid={invalid}
                      aria-describedby={invalid ? emailErrorId : undefined}
                    />
                    {invalid ? (
                      <p id={emailErrorId} className="text-destructive text-sm leading-5">
                        {message}
                      </p>
                    ) : null}
                  </>
                );
              }}
            </form.Field>
          </Field>

          <Button
            type="submit"
            className="w-full"
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
            <Label htmlFor={sharedDeviceId} className="font-normal">
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
          {/*
            C39 asks the surface to render the `userMessage` **and** the
            `retryAfter`. The sentence already says "en 12 minutos" for a person;
            this carries the same fact as a number a machine can read, which is
            what a `<time>` element is for. Not visible text — she has the
            sentence — so it says nothing twice.
          */}
          {feedback.retryAfter === undefined ? null : (
            <time
              dateTime={`PT${feedback.retryAfter}S`}
              data-retry-after={feedback.retryAfter}
              className="sr-only"
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
