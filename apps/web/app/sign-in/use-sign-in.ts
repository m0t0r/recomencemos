"use client";

/**
 * Everything `/sign-in` *does*, separated from everything it *looks like*.
 *
 * The split exists because `/prototype` UI needed three variants to disagree
 * about structure while agreeing about behaviour — a variant wired to a stub
 * would have been judged on a page that does not work. It is worth keeping after
 * the prototype is thrown away: the per-door pending state, the Google failure
 * path, and the focus move are the parts that are easy to get subtly wrong, and
 * they now have one home rather than one per layout.
 */

import { createAuthClient } from "better-auth/react";
import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { requestMagicLink, type RequestMagicLinkState } from "./actions";
import { CHECK_YOUR_EMAIL_HINT, GOOGLE_FAILED, LINK_ALREADY_USED } from "./messages";

/**
 * Same-origin by default, so no base URL and no `NEXT_PUBLIC_*` variable —
 * one fewer value NFR24 has to place in a turbo task.
 */
const authClient = createAuthClient();

/**
 * The header the Google door declares the shared-device answer on.
 *
 * `/sign-in/social`'s request body is a closed schema that strips unknown keys,
 * so there is no field to put it in. A header survives that and cannot be set
 * cross-origin without a preflight. It is **not** a security boundary and does
 * not need to be: the only thing a forged value changes is how long her own
 * session lasts, which she can already change by not ticking the box. The
 * server-side half is `SHARED_DEVICE_HEADER` in `@repo/domain`.
 */
const SHARED_DEVICE_HEADER = "x-recomencemos-shared-device";

const INITIAL: RequestMagicLinkState = { status: "idle" };

export interface Feedback {
  readonly tone: "success" | "problem";
  readonly message: string;
  readonly hint?: string | undefined;
}

export interface SignInMachine {
  readonly state: RequestMagicLinkState;
  readonly formAction: (formData: FormData) => void;
  /** The email door alone is busy. The Google button stays usable. */
  readonly emailPending: boolean;
  /** The Google door alone is busy. The form stays readable and usable. */
  readonly googlePending: boolean;
  readonly sharedDevice: boolean;
  readonly setSharedDevice: (value: boolean) => void;
  readonly signInWithGoogle: () => void;
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
  const [state, formAction, emailPending] = useActionState(requestMagicLink, INITIAL);
  const [sharedDevice, setSharedDevice] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [googleFailed, setGoogleFailed] = useState(false);

  const announcementRef = useRef<HTMLDivElement>(null);

  const consumedLink = error === "INVALID_TOKEN";
  const arrivedWithGoogleError = Boolean(error) && !consumedLink;

  /**
   * Focus moves to what happened, not to where to fix it. A screen-reader user
   * dropped straight into the field hears the field and has to go looking for
   * the reason it is still there. The region is `aria-live` too, so a change
   * nobody is focused on is still announced.
   */
  useEffect(() => {
    if (state.status !== "idle") announcementRef.current?.focus();
  }, [state]);

  const signInWithGoogle = useCallback(() => {
    setGoogleFailed(false);
    setGooglePending(true);

    void (async () => {
      try {
        const { error: googleError } = await authClient.signIn.social(
          { provider: "google", callbackURL: returnPath },
          { headers: { [SHARED_DEVICE_HEADER]: sharedDevice ? "1" : "0" } },
        );

        // Better Auth returns `{ error }` rather than throwing, so a bare
        // `try`/`catch` would read every failure as a success and leave the
        // button spinning — the vendor's own most-cited mistake, and the same
        // one `@repo/notifications` documents on its transport.
        if (googleError) setGoogleFailed(true);
      } catch {
        setGoogleFailed(true);
      } finally {
        setGooglePending(false);
      }
    })();
  }, [returnPath, sharedDevice]);

  return {
    state,
    formAction,
    emailPending,
    googlePending,
    sharedDevice,
    setSharedDevice,
    signInWithGoogle,
    feedback: describe(state, {
      consumedLink,
      googleFailed: googleFailed || arrivedWithGoogleError,
    }),
    awaitingLink: state.status === "sent" || consumedLink,
    announcementRef,
  };
}

/**
 * What the live region says.
 *
 * **Order matters and is not arbitrary.** What the action just returned outranks
 * what a redirect brought her here with: if she has retried since arriving on a
 * consumed link, the retry's outcome is the current truth.
 */
function describe(
  state: RequestMagicLinkState,
  arrival: { consumedLink: boolean; googleFailed: boolean },
): Feedback | undefined {
  switch (state.status) {
    case "sent":
      return { tone: "success", message: state.message, hint: CHECK_YOUR_EMAIL_HINT };
    case "rate_limited":
      // The `userMessage` already names her count, when the window resets, and
      // that the Google door is still there (NFR26's third half, C39).
      return { tone: "problem", message: state.message };
    case "field_error":
      return { tone: "problem", message: state.message };
    case "failed":
      return { tone: "problem", message: state.error.message };
    case "idle":
      break;
  }

  // A consumed link is not an error and is not written as one: a link scanner
  // opening it first is our problem, and the next thing on screen is a resend.
  if (arrival.consumedLink) return { tone: "success", message: LINK_ALREADY_USED };
  if (arrival.googleFailed) return { tone: "problem", message: GOOGLE_FAILED };

  return undefined;
}
