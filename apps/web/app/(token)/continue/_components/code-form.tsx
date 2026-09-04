"use client";

/**
 * One field, one button, and the shortest keyboard path in the product.
 *
 * Shaped at `.impeccable/briefs/admin-door.md`. Four decisions here are the
 * brief's rather than this file's, and none is free to drift:
 *
 * 1. **One field takes either credential** — six digits from the authenticator
 *    or one printed backup code — told apart by shape on the server. The
 *    alternatives were a closed disclosure and an always-visible second field,
 *    and both put a control on screen for a path taken roughly never.
 * 2. **The description names both**, which is the half that keeps the recovery
 *    path from being one nobody is told about. Somebody whose phone is gone gets
 *    no lockout message; they are looking at a box with nothing obvious to type,
 *    and this line is what rescues them.
 * 3. **Auto-submit on completion is an accelerator, never the mechanism.** The
 *    button works with JavaScript unavailable and losing the accelerator costs a
 *    keystroke, not the session.
 * 4. **The field keeps its value in every state — with JavaScript.** The value
 *    lives in this component's state, so a refusal never empties it. On the
 *    unhydrated path it comes back empty, and that is a decision rather than a
 *    gap: `ActionError` has an `input` field for handing a refused submission
 *    back, and a code may not travel in it. It is a credential for the seconds
 *    it is live, and echoing it into an HTML attribute would put it in the
 *    response body, in the back-forward cache and in anything between that logs
 *    one. Retyping six digits is the cheaper of the two, and the digits have
 *    rotated anyway.
 *
 * **`input-otp` is in the registry and is deliberately not used**, which is worth
 * saying because the registry-equivalents review pass exists to catch the
 * opposite mistake. Six separate boxes is the reflex here and it is wrong twice
 * over: it cannot hold an eight-character hyphenated backup code, and a fixed
 * slot count makes decision 1 unimplementable.
 */

import { Button } from "@repo/design-system/components/button";
import { Card } from "@repo/design-system/components/card";
import { Field, FieldDescription, FieldLabel } from "@repo/design-system/components/field";
import { Input } from "@repo/design-system/components/input";
import { cn } from "@repo/design-system/lib/utils";
import { GENERIC_ERROR_CODE } from "@repo/errors/app-error";
import { startTransition, useActionState, useEffect, useId, useRef, useState } from "react";
import { verifyCode } from "../actions";
import {
  CODE_DESCRIPTION,
  CODE_LABEL,
  CONTINUE_FAILED,
  CONTINUE_TITLE,
  SUBMIT_BUTTON,
} from "../_lib/messages";
import { isCompleteTotpCode } from "../_lib/schema";

type VerifyResult = Awaited<ReturnType<typeof verifyCode>>;

const INITIAL: VerifyResult = {};

export function CodeForm() {
  const [code, setCode] = useState("");
  const [result, formAction, pending] = useActionState(verifyCode, INITIAL);

  const codeId = useId();
  const descriptionId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const announcementRef = useRef<HTMLDivElement>(null);

  /**
   * The last value this component submitted on its own, so a completed code is
   * auto-submitted **once**. Editing away from it and back is a new attempt and
   * fires again; a refused code sitting in the field does not resubmit itself
   * while the person reads what happened.
   */
  const autoSubmitted = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!isCompleteTotpCode(code)) {
      autoSubmitted.current = undefined;
      return;
    }
    if (autoSubmitted.current === code) return;

    autoSubmitted.current = code;
    /*
      Through the form rather than by dispatching directly, so the accelerator
      and the button reach the *same* submit path. Two paths would be two
      chances for them to disagree about what is posted, and the `required`
      check would apply to only one of them.
    */
    formRef.current?.requestSubmit();
  }, [code]);

  /**
   * Focus moves to what happened, not to where to fix it: a screen-reader user
   * dropped straight back into the field hears the field and has to go looking
   * for the reason it is still there. It does **not** move while the submit is
   * in flight, which is why this reads `result` rather than `pending`.
   *
   * `result` is a fresh object per dispatch, which is what makes "on every
   * outcome" true — a derived boolean stays `true` across a second refusal and
   * would move focus once and never again.
   */
  useEffect(() => {
    if (result.serverError ?? result.validationErrors) announcementRef.current?.focus();
  }, [result]);

  const feedback = feedbackFor(result);

  return (
    <main className="bg-muted flex min-h-svh flex-col items-center justify-center px-4 py-12">
      {/*
        A narrower measure than `/sign-in`'s `max-w-md`: there is one field here
        and it should not look like a form.
      */}
      <Card className="flex w-full max-w-sm flex-col gap-6 p-6 sm:p-8">
        <h1 className="text-foreground text-2xl leading-8 font-semibold tracking-tight">
          {CONTINUE_TITLE}
        </h1>

        <FeedbackRegion announcementRef={announcementRef} feedback={feedback} />

        <form
          ref={formRef}
          action={formAction}
          /*
            **Dispatched by hand, and the `action` attribute stays for the
            unhydrated path.** Left to the form's own action, React resets the
            form once the Server Action settles — and a reset empties the field
            the brief requires to keep its value after a wrong code. Dispatching
            through `useActionState`'s own function performs no reset.

            **Nothing is parsed here**, unlike `/sign-in`, and that is this
            surface's rule rather than an omission: the browser cannot tell a
            wrong code from a right one, so a check it *could* run would only
            ever refuse a shape — and a shape refused on screen tells a caller
            which of the two credentials the door was about to check. The empty
            field is refused by `required`, natively and in the reader's locale.
          */
          onSubmit={(event) => {
            const formData = new FormData(event.currentTarget);
            event.preventDefault();
            startTransition(() => formAction(formData));
          }}
          className="flex flex-col gap-4"
        >
          <Field>
            <FieldLabel htmlFor={codeId}>{CODE_LABEL}</FieldLabel>
            {/*
              Under the label and before the field, because it is what somebody
              whose phone is gone needs in order to know there is anything to
              type at all. Placeholder text would disappear at exactly the moment
              they wanted to check it.
            */}
            <FieldDescription id={descriptionId}>{CODE_DESCRIPTION}</FieldDescription>
            <Input
              id={codeId}
              name="code"
              /*
                **`autocomplete="one-time-code"` and `inputmode="numeric"` are
                the usual TOTP recipe and are both wrong here.** This field also
                takes an alphanumeric backup code: a numeric keypad would make
                that path untypable on the phone this Admin occasionally uses,
                and a one-time-code hint would offer to fill it with six digits
                somebody may not have.
              */
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              // The hands already know what to do; the only stop before the
              // button is this field.
              // oxlint-disable-next-line jsx-a11y/no-autofocus -- one field, entered deliberately from a link.
              autoFocus
              required
              aria-describedby={descriptionId}
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </Field>

          {/*
            The button is busy; the field is not disabled. A code that failed to
            submit must stay readable and stay filled.
          */}
          <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
            {SUBMIT_BUTTON}
          </Button>
        </form>
      </Card>
    </main>
  );
}

export interface Feedback {
  readonly message: string;
  /**
   * Seconds until the ceiling's window resets, when this is a lockout. Rendered
   * as a machine-readable value beside the sentence, because NFR26's third half
   * asks the surface for the number as well as the words.
   */
  readonly retryAfter?: number | undefined;
}

/**
 * What the region says, and the one distinction it has to get right.
 *
 * **A refused code and a fault on our side are not the same sentence.** The door
 * writes one `es-CO` sentence for six different failures — a wrong code, an
 * expired challenge, one this product never signed, a grant taken away, an
 * Account with no factor — and that sentence is what a refusal renders. A
 * *fault* is thrown rather than returned, so `projectClientError` had nothing it
 * was willing to copy and fell back: the code is {@link GENERIC_ERROR_CODE} and
 * the message is English. Rendering it would put English in front of an Admin
 * and, worse, would tell somebody holding a correct code that their code was
 * wrong.
 *
 * So the fault is told apart by the code the projection fell back to, which is
 * exactly the thing that means "this sentence is not ours". The lockout is told
 * apart by `retryAfter`, which `lib/safe-action.ts` puts on the error precisely
 * so this is a property read rather than a string match.
 *
 * Exported for its own test: the ordering between three outcomes is a rule, and
 * it is the part that would break silently.
 */
export function feedbackFor(result: VerifyResult): Feedback | undefined {
  const error = result.serverError;

  /**
   * **A validation error is a fault here, not a field error**, because the form
   * cannot produce one: the boundary asks only for a string and the field is
   * `required`. Reaching this means a request the form did not make, and the
   * honest thing to say is that nothing changed and it is worth trying again.
   */
  if (!error) return result.validationErrors ? { message: CONTINUE_FAILED } : undefined;

  if (error.code === GENERIC_ERROR_CODE) return { message: CONTINUE_FAILED };

  return { message: error.message, retryAfter: error.retryAfter };
}

/**
 * One region, above the field, so what happened is first in the reading order.
 *
 * `tabIndex={-1}` makes it focusable without putting it in the tab order;
 * `role="status"` carries an implicit `aria-live="polite"`, so a change nobody is
 * focused on is still announced — and it gives the region a name a test can ask
 * for rather than an attribute a `querySelector` has to hunt.
 *
 * **It is always in the DOM and takes no space until it says something.** A live
 * region inserted at the same moment as its text is frequently not announced at
 * all — assistive technology has to be watching it before the change happens —
 * so rendering it conditionally would cost the announcement this element exists
 * for. But an empty flex child still earns the card's `gap-6`, which on a card
 * holding a heading, a field and a button reads as a mistake: the screen opens
 * with a hole under its own title.
 *
 * `sr-only` closes both. It is `position: absolute`, so the empty region stops
 * being laid out by the flex container at all rather than being laid out at zero
 * height, and it stays in the accessibility tree the whole time. The class comes
 * off the moment there is something to see.
 */
function FeedbackRegion({
  announcementRef,
  feedback,
}: {
  readonly announcementRef: React.RefObject<HTMLDivElement | null>;
  readonly feedback: Feedback | undefined;
}) {
  return (
    <div
      ref={announcementRef}
      tabIndex={-1}
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="status"
      className={cn(
        "focus-visible:ring-ring/50 rounded-md outline-none focus-visible:ring-[3px]",
        feedback ? undefined : "sr-only",
      )}
    >
      {feedback ? (
        <div className="border-destructive/30 bg-destructive/5 rounded-lg border p-4">
          <p className="text-foreground text-base leading-6">{feedback.message}</p>
          {/*
            The wait as a number as well as a sentence. Not visible text — the
            sentence already says it — so nothing is said twice.
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
