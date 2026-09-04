"use client";

/**
 * The two doors, and the one choice that governs both.
 *
 * Variant B ("Framed card"), locked after `/prototype` UI — the losing variants
 * live on `prototype/12-sign-in-variants`, and the shaping is
 * `.impeccable/briefs/sign-in.md`. Four decisions are load-bearing here and are
 * not free to drift:
 *
 * 1. **Google leads and the email door is fully present below it**, never
 *    behind a disclosure. Where Google is unconfigured the email form is the
 *    whole card, with no dead button and no dangling separator.
 * 2. **The Google button wears Google's own treatment** — recognition is the
 *    whole reason that door exists. See the hierarchy note on the button.
 * 3. **The shared-device checkbox sits outside both forms**, because it governs
 *    both doors; inside the email form it would read as an email-door setting
 *    while silently shortening a Google session too.
 * 4. **The sent state keeps the form and her address**, so a link a scanner ate
 *    is one tap from a resend with the Google door still on screen.
 *
 * **Both doors now work with JavaScript unavailable, which is new.** The email
 * door always did — a plain `<form action={…}>` posts before hydration. The
 * Google door did not: it was a `better-auth/react` call from a click handler,
 * so an unhydrated page had a button that did nothing. It is a second `<form>`
 * with a Server Action now, so it posts and redirects natively.
 *
 * **There are no hidden inputs.** `returnPath` and `sharedDevice` are bound
 * arguments — see `_lib/schema.ts`. `"use client"` remains for the checkbox's
 * state, the per-door pending states, and the focus move on every outcome.
 */

import { useForm } from "@tanstack/react-form";
import { Button } from "@repo/design-system/components/button";
import { Card } from "@repo/design-system/components/card";
import { Checkbox } from "@repo/design-system/components/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldSeparator,
} from "@repo/design-system/components/field";
import { Input } from "@repo/design-system/components/input";
import { Label } from "@repo/design-system/components/label";
import { useId } from "react";
import { useFormStatus } from "react-dom";
import {
  DOOR_DIVIDER,
  EMAIL_DOOR_PRECONDITION,
  EMAIL_LABEL,
  EMAIL_LOOKS_WRONG,
  GOOGLE_ACCOUNT_NOTICE,
  GOOGLE_BUTTON,
  RESEND_LINK_BUTTON,
  SEND_LINK_BUTTON,
  SHARED_DEVICE_HELP,
  SHARED_DEVICE_LABEL,
  SIGN_IN_TITLE,
} from "../_lib/messages";
import { emailField, emailFieldOnBlur, requestMagicLinkSchema } from "../_lib/schema";
import { useSignIn } from "../_lib/use-sign-in";
import { GoogleMark } from "./google-mark";

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
   * `@tanstack/react-form-nextjs`'s `mergeForm`/`useTransform`, or through
   * next-safe-action's `useStateAction`:
   *
   * - **The no-JavaScript path has to survive.** `action={machine.formAction}`
   *   with a named input means a submit before hydration posts natively and the
   *   Server Action answers. NFR4 requires that of `/publish`; this surface is
   *   not bound by it, but the pattern set here is the one story 2 copies, and a
   *   form abstraction that only works hydrated would make NFR4 unreachable.
   * - **The outcomes are not form state.** A ceiling carries a `retryAfter`,
   *   `sent` is a success that deliberately keeps the form, and a transport
   *   fault is neither — none is a field error, and folding them into form state
   *   would flatten distinctions NFR26 and the surface table depend on.
   *
   * **The validators are the schemas themselves.** `emailField` and
   * `emailFieldOnBlur` are Zod objects handed to TanStack Form as Standard
   * Schemas — the same `emailField` the Server Action parses with. There is no
   * hand-written predicate restating the rule on this side any more, so the
   * check she gets instantly and the check that actually decides are not merely
   * kept in agreement; they are the same object.
   */
  const form = useForm({ defaultValues: { email: "" } });

  return (
    <main className="bg-muted flex grow flex-col items-center justify-center px-4 py-12">
      <Card className="flex w-full max-w-md flex-col gap-6 p-6 sm:p-8">
        <h1 className="page-heading">{SIGN_IN_TITLE}</h1>

        <FeedbackRegion machine={machine} />

        {googleAvailable ? (
          <div className="flex flex-col gap-2">
            {/*
              A form rather than a click handler, so the door survives with no
              JavaScript. The action is bound with the same two values the email
              door binds, so one checkbox governs both without either form
              carrying a mirror of it.
            */}
            <form action={machine.googleFormAction}>
              <GoogleButton />
            </form>

            <p className="text-muted-foreground text-sm leading-5">{GOOGLE_ACCOUNT_NOTICE}</p>
          </div>
        ) : null}

        {googleAvailable ? (
          <FieldSeparator aria-hidden="true">{DOOR_DIVIDER}</FieldSeparator>
        ) : null}

        <form
          action={machine.formAction}
          /*
            Runs before the action, and answers with **the same schema, over the
            same bytes**: `new FormData(event.currentTarget)` is what the Server
            Action is about to receive, and `requestMagicLinkSchema` is what it
            will parse it with. So an address the browser already knows is wrong
            costs her no round trip, and a valid one is never intercepted — the
            server still performs the parse that actually decides.

            Reading the form rather than `form.state.values` is deliberate. The
            two agree today because the input is controlled, but they are two
            sources for one question, and the one that matters is the one that
            will be posted. Review named the divergence; this removes it rather
            than documenting it.
          */
          onSubmit={(event) => {
            if (requestMagicLinkSchema.safeParse(new FormData(event.currentTarget)).success) {
              return;
            }

            event.preventDefault();
            void form.handleSubmit();
          }}
          className="flex flex-col gap-4"
        >
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

                `onBlur` lets an empty field alone — she has not finished, and
                telling her an empty box is wrong while she is still filling it
                in is the form nagging rather than helping. `onSubmit` has no
                such exemption. Both are schemas from `_lib/schema.ts`, and the
                sentence inside them is `docs/policy/voice.md`'s rather than
                Zod's.
              */
              validators={{ onBlur: emailFieldOnBlur, onSubmit: emailField }}
            >
              {(field) => {
                // The server's verdict and the client's are the same schema, so
                // either one marks the field. Hers arrives instantly; the
                // server's is the one that counts.
                const clientError = field.state.meta.errors[0];

                /**
                 * **The message and the invalid flag are derived from the same
                 * thing, and that is a fix rather than a simplification.** They
                 * used to be computed separately: `invalid` counted the server's
                 * verdict, `message` did not, and a server rejection with no
                 * client error therefore set `aria-describedby` to the id of an
                 * element that was never rendered. A screen reader following it
                 * finds nothing — NFR20 is WCAG 2.2 AA, and a dangling
                 * `aria-describedby` fails it while looking correct in the DOM.
                 *
                 * That state is reachable: with JavaScript unavailable no client
                 * validator ever runs, so every refusal is the server's.
                 */
                const message =
                  (typeof clientError === "string" ? clientError : clientError?.message) ??
                  (machine.emailRejected ? EMAIL_LOOKS_WRONG : undefined);

                const invalid = message !== undefined;

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
                    {message === undefined ? null : (
                      <FieldError id={emailErrorId}>{message}</FieldError>
                    )}
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
 * The Google door's button, split out for one reason: `useFormStatus` reports
 * the status of the form **above** the component that calls it, so it has to sit
 * inside the `<form>` rather than beside it.
 *
 * That is also what replaced the `googlePending` state the old hook carried —
 * along with the `try`/`catch` around a vendor call that returns `{ error }`
 * instead of throwing. The pending state is now the framework's, and the failure
 * arrives as a redirect like every other one.
 *
 * **`outline` rather than the filled primary, and that is a decision about
 * hierarchy rather than a downgrade.** Google's sign-in button is recognised by
 * its shape — white, bordered, four-colour mark — and that recognition is the
 * entire reason this door is first. Filling it with the brand's own blue would
 * make it *louder* and *less* recognisable at the same time, which is the wrong
 * trade on the device most Workers hold.
 *
 * What carries "Google leads" instead: position, the account notice under it,
 * and the fact that it asks her to type nothing. The email submit below keeps
 * the filled primary, because a form's submit is where a filled button belongs
 * and the two then read as two kinds of action rather than as a ranking.
 */
function GoogleButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="outline"
      className="w-full"
      disabled={pending}
      aria-busy={pending}
    >
      <GoogleMark />
      {GOOGLE_BUTTON}
    </Button>
  );
}

/**
 * One region for every outcome, above the doors, so what happened is first in
 * the reading order rather than attached to whichever control produced it.
 *
 * `tabIndex={-1}` makes it programmatically focusable without putting it in the
 * tab order; `role="status"` covers the case where nobody is focused on it.
 *
 * **The role is explicit rather than left to `aria-live` alone.** `status`
 * carries an implicit `aria-live="polite"` and `aria-atomic="true"`, so it says
 * more to assistive technology than the bare attribute did — and it gives the
 * region a name a test can ask for. Reaching for it by attribute through
 * `container.querySelector('[aria-live="polite"]')` was the tell that this
 * element was invisible to the accessibility tree the surface is judged on.
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
      /*
        `prefer-tag-over-role` asks for `<output>`, which is the right advice in
        general and wrong here: `<output>`'s content model is **phrasing
        content**, and this region holds a `<div>` and two `<p>`s — flow content.
        Taking the rule's suggestion would produce invalid HTML for a role the
        attribute already carries correctly. `packages/design-system` scopes the
        same rule off `field.tsx` for the same shape of reason.
      */
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="status"
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
