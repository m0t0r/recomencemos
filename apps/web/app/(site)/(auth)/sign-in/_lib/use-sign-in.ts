"use client";

/**
 * Everything `/sign-in` *does*, separated from everything it *looks like*: the
 * email door's pending state, the arrival cases a redirect brings her back with,
 * and the focus move are the parts that are easy to get subtly wrong, and they
 * have one home here rather than one per layout.
 *
 * **It is markedly smaller than it was, and the reason is where the Google door
 * went.** This hook used to own a `better-auth/react` client, a `googlePending`
 * flag, a `googleFailed` flag, and the vendor's `{ error }`-rather-than-throw
 * hazard. All four are gone: the Google door is a Server Action now, its pending
 * state is `useFormStatus` inside its own form, and its failures arrive the same
 * way every other redirect does — as `?error=` on the URL.
 */

import * as React from "react";
import { requestMagicLink, startGoogleSignIn } from "../actions";
import {
  CHECK_YOUR_EMAIL_HINT,
  EMAIL_LOOKS_WRONG,
  GOOGLE_FAILED,
  LINK_ALREADY_USED,
  SEND_FAILED_HINT,
} from "./messages";

/**
 * What `useActionState` holds between submits.
 *
 * next-safe-action's own result shape, and the empty object is what the library
 * uses for "nothing has happened yet" — so `idle` is not a state this surface
 * invents and then has to keep in agreement with the library's.
 */
export type SignInResult = Awaited<ReturnType<typeof requestMagicLink>>;

const INITIAL: SignInResult = {};

type GoogleResult = Awaited<ReturnType<typeof startGoogleSignIn>>;

const INITIAL_GOOGLE: GoogleResult = {};

export interface Feedback {
  readonly tone: "success" | "problem";
  readonly message: string;
  readonly hint?: string | undefined;
  /**
   * Seconds until a ceiling's window resets, when this feedback is a ceiling's.
   * Rendered as a machine-readable `retryAfter` beside the sentence, so the
   * number is available to the surface rather than only spelled out inside it.
   */
  readonly retryAfter?: number | undefined;
}

export interface SignInMachine {
  readonly result: SignInResult;
  readonly formAction: (formData: FormData) => void;
  /**
   * The Google door's `<form action>`.
   *
   * It goes through `useActionState` for the same reason the email door does,
   * even though nothing ever renders its result: that hook is what yields an
   * action React can encode into the form for the no-JavaScript path, and it is
   * what keeps both doors on one mechanism rather than two. A successful start
   * redirects, so the state it holds is only ever the failure — which arrives
   * back as `?error=` and is read from the URL instead.
   */
  readonly googleFormAction: (formData: FormData) => void;
  /** The email door alone is busy. The Google button stays usable. */
  readonly emailPending: boolean;
  /** True when the server rejected the address, so the field can be marked. */
  readonly emailRejected: boolean;
  readonly sharedDevice: boolean;
  readonly setSharedDevice: (value: boolean) => void;
  /** What the live region says, or nothing. One decision, not one per layout. */
  readonly feedback: Feedback | undefined;
  /** True once a link has gone out, so the button says "send another". */
  readonly awaitingLink: boolean;
  /** Focus lands here on every outcome — what happened, before where to fix it. */
  readonly announcementRef: React.RefObject<HTMLDivElement | null>;
}

export interface UseSignInOptions {
  readonly returnPath: string;
  readonly error?: string | undefined;
}

export function useSignIn({ returnPath, error }: UseSignInOptions): SignInMachine {
  const [sharedDevice, setSharedDevice] = React.useState(false);

  /**
   * **Bound, not hidden.** `returnPath` and `sharedDevice` travel as bound
   * arguments rather than as `<input type="hidden">`, so the JSX carries no
   * mirror of them and no second spelling of `"on"`/`"off"` to keep in agreement
   * with the server. React serialises a bound argument into the action reference
   * itself, so this survives with JavaScript unavailable exactly as a hidden
   * input would.
   *
   * The identity changes when she toggles the checkbox, and `useActionState`
   * reads the action at dispatch — so the value bound is the value on screen
   * when she submits. **Verified at seam 3**, not assumed: ticking the box and
   * sending a link writes `verification.shared_device = true`.
   *
   * **One measured limit, which is not a regression but is worth knowing.**
   * React serialises the bound arguments into the form's hidden `$ACTION_*`
   * fields once, and does *not* re-serialise them when the bound values change —
   * observed directly, with the checkbox reading `aria-checked="true"` while the
   * encoded payload still read `["/",false,{}]`. So the **no-JavaScript** path
   * posts the value as at first render, which is always `false`.
   *
   * That path was already `false` before bound arguments replaced the hidden
   * input, and for a more basic reason: Base UI's `Checkbox` renders a styled
   * `<button>` over a `tabIndex={-1}` input, so with no JavaScript she cannot
   * tick the box at all. The carrier is not what makes the answer unreachable —
   * the control is. Fixing it means a natively-operable checkbox, which is a
   * design-system change and a decision about this surface, not a change here.
   */
  const [result, formAction, emailPending] = React.useActionState(
    requestMagicLink.bind(null, returnPath, sharedDevice),
    INITIAL,
  );

  const [, googleFormAction] = React.useActionState(
    startGoogleSignIn.bind(null, returnPath, sharedDevice),
    INITIAL_GOOGLE,
  );

  const announcementRef = React.useRef<HTMLDivElement>(null);

  const consumedLink = error === "INVALID_TOKEN";
  const arrivedWithGoogleError = Boolean(error) && !consumedLink;

  /**
   * Focus moves to what happened, not to where to fix it. A screen-reader user
   * dropped straight into the field hears the field and has to go looking for
   * the reason it is still there. The region is `role="status"` too, so a change
   * nobody is focused on is still announced.
   */
  React.useEffect(() => {
    // Read from `result` inside the effect rather than from a derived boolean:
    // a boolean stays `true` across a second failure, so focus would move on the
    // first outcome and never again. `result` is a fresh object per dispatch,
    // which is what makes "focus lands here on *every* outcome" true.
    if (result.data ?? result.serverError ?? result.validationErrors) {
      announcementRef.current?.focus();
    }
  }, [result]);

  return {
    result,
    formAction,
    googleFormAction,
    emailPending,
    emailRejected: Boolean(result.validationErrors),
    sharedDevice,
    setSharedDevice,
    feedback: feedbackFor(result, {
      consumedLink,
      googleFailed: arrivedWithGoogleError,
    }),
    awaitingLink: Boolean(result.data?.sent) || consumedLink,
    announcementRef,
  };
}

/**
 * What the live region says.
 *
 * **Order matters and is not arbitrary.** What the action just returned outranks
 * what a redirect brought her here with: if she has retried since arriving on a
 * consumed link, the retry's outcome is the current truth.
 *
 * **A ceiling is told apart from a transport fault by `retryAfter`, not by a
 * status code.** `lib/safe-action.ts` puts that field on the error precisely so
 * this decision is a property read rather than a string match, and so the number
 * C39 asks the surface to render is carried as a number.
 *
 * **Exported for its own test, and it is the only export here that is.** The
 * hook around it is covered through the component that renders it, which is
 * where its `useActionState` wiring and its focus effect actually run. This
 * function is the part that has a *rule* rather than a wiring — an ordering
 * between five outcomes, argued above and asserted nowhere until
 * `use-sign-in.test.ts`. It is pure, it needs no DOM, and the ordering is the
 * thing that would break silently.
 */
export function feedbackFor(
  result: SignInResult,
  arrival: { consumedLink: boolean; googleFailed: boolean },
): Feedback | undefined {
  if (result.data?.sent) {
    return { tone: "success", message: result.data.message, hint: CHECK_YOUR_EMAIL_HINT };
  }

  if (result.serverError) {
    const { message, retryAfter } = result.serverError;

    // The ceiling's `userMessage` names her count, when the window resets, and
    // that the Google door is still there — so it needs no hint. A transport
    // fault does: the hint is the half that tells her her address is still in
    // the field and trying again is worth doing.
    return retryAfter === undefined
      ? { tone: "problem", message, hint: SEND_FAILED_HINT }
      : { tone: "problem", message, retryAfter };
  }

  // The schema's own message, which is `EMAIL_LOOKS_WRONG` — see `./schema`, where
  // every rule carries the sentence from this module rather than Zod's English.
  if (result.validationErrors) return { tone: "problem", message: EMAIL_LOOKS_WRONG };

  // A consumed link is not an error and is not written as one: a link scanner
  // opening it first is our problem, and the next thing on screen is a resend.
  if (arrival.consumedLink) return { tone: "success", message: LINK_ALREADY_USED };
  if (arrival.googleFailed) return { tone: "problem", message: GOOGLE_FAILED };

  return undefined;
}
