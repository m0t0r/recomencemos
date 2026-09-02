"use client";

/**
 * Everything `/publish` *does*, separated from everything it *looks like* —
 * the same split `/sign-in` made, and for the same reason: three prototype
 * layouts share one machine, so the parts that are easy to get subtly wrong
 * have one home.
 *
 * **TanStack Form owns field state and client-side validation; it does not
 * own submission** (ADR-0014). The `<form>` keeps its native `action`, so a
 * submit before hydration posts and the Server Action answers. This hook holds
 * the action's result, the form-level summary, and the focus move — and the
 * `guardSubmit` handler that decides, on every submit, whether the browser
 * already knows the answer.
 *
 * **An action's outcomes are not form state.** A ceiling carries a
 * `retryAfter`, a transport fault is neither a field error nor a ceiling, and
 * the server's per-field verdict arrives as `validationErrors`. They stay in
 * the `useActionState` result and are read from there.
 */

import type { ConsentVersions } from "@repo/domain/consent";
import {
  type FormEvent,
  type RefObject,
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { publishProfile } from "../actions";
import { type Feedback, feedbackFor } from "./feedback";
import { type PublishProfileValues, publishProfileSchema, publishProfileValues } from "./schema";
import { type Summary, summaryFromIssues, summaryFromValidationErrors } from "./summary";

export type PublishResult = Awaited<ReturnType<typeof publishProfile>>;

const INITIAL: PublishResult = {};

export type { Feedback } from "./feedback";

export interface PublishMachine {
  readonly result: PublishResult;
  readonly formAction: (formData: FormData) => void;
  readonly pending: boolean;
  /**
   * Whether the page has hydrated. Before it has, the browser's own `required`
   * check is the only client-side guard, so `noValidate` is withheld until
   * this is true and our validators can take over.
   */
  readonly hydrated: boolean;
  /** The form-level summary, from whichever verdict is current, or nothing. */
  readonly summary: Summary | undefined;
  /**
   * The server's per-field verdict, for each field to render beside itself.
   * `unknown` on purpose: it is the action's own tree, or — for a payload that
   * was not even the right shape — next-safe-action's, and both are read
   * defensively by `serverFieldError`.
   */
  readonly serverErrors: unknown;
  /**
   * What she submitted, when the server refused it. The unhydrated page mounts
   * fresh from the action's result, and this is what puts her values back.
   */
  readonly refusedValues: PublishProfileValues | undefined;
  /** A ceiling or a transport fault: neither is a field error. */
  readonly feedback: Feedback | undefined;
  /** Focus lands here on every failed outcome — the count before the field. */
  readonly summaryRef: RefObject<HTMLDivElement | null>;
  /**
   * The `<form onSubmit>`. Parses the form's own bytes with the schema the
   * action will parse them with; a valid form is never intercepted, and a
   * refused one is stopped here, its validators run, and focus moved to the
   * summary.
   */
  readonly guardSubmit: (event: FormEvent<HTMLFormElement>, runValidators: () => void) => void;
}

const subscribeToNothing = () => () => {};

export function usePublish(consentVersions: ConsentVersions): PublishMachine {
  /**
   * **Bound, not hidden.** The consent versions travel as a bound argument, so
   * the JSX carries no mirror of them and a browser with JavaScript unavailable
   * still submits them — React serialises a bound argument into the action
   * reference itself.
   */
  const [result, formAction, pending] = useActionState(
    publishProfile.bind(null, consentVersions),
    INITIAL,
  );

  const hydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );

  const [clientSummary, setClientSummary] = useState<Summary | undefined>(undefined);
  const summaryRef = useRef<HTMLDivElement>(null);

  /**
   * The server's verdict outranks the browser's: once a submit has gone out,
   * what came back is the current truth. The browser's summary is cleared the
   * moment a submit is allowed through, so a stale client list cannot sit
   * beside a fresh server one.
   */
  const serverErrors = result.serverError?.fieldErrors ?? result.validationErrors;
  const serverSummary = summaryFromValidationErrors(serverErrors);
  const summary = serverSummary ?? clientSummary;
  const refusedValues = refusedValuesOf(result);

  useEffect(() => {
    // Read from `result` rather than a derived boolean: `result` is a fresh
    // object per dispatch, which is what makes "on every outcome" true.
    if (result.serverError ?? result.validationErrors) {
      summaryRef.current?.focus();
    }
  }, [result]);

  const guardSubmit: PublishMachine["guardSubmit"] = (event, runValidators) => {
    const formData = new FormData(event.currentTarget);
    const parsed = publishProfileSchema.safeParse(formData);

    if (parsed.success) {
      /**
       * **Dispatched by hand, on purpose.** Left to the form's own `action`,
       * React resets the form once the Server Action settles — and a reset
       * clears the hidden native inputs Base UI keeps behind every checkbox
       * and radio while the styled controls beside them still read as ticked.
       * Measured at seam 3: after a refused submit the Skills and the city
       * showed as chosen and a second submit posted none of them. Dispatching
       * through `useActionState`'s own function performs no reset; the
       * `action` attribute stays on the `<form>` for the unhydrated path.
       */
      event.preventDefault();
      setClientSummary(undefined);
      startTransition(() => formAction(formData));
      return;
    }

    event.preventDefault();
    runValidators();
    setClientSummary(summaryFromIssues(parsed.error.issues));
    // After React has rendered the summary, so there is something to focus.
    requestAnimationFrame(() => summaryRef.current?.focus());
  };

  return {
    result,
    formAction,
    pending,
    hydrated,
    summary,
    serverErrors,
    refusedValues,
    feedback: feedbackFor(result),
    summaryRef,
    guardSubmit,
  };
}

/**
 * Her values, from whichever refusal carried them — the field refusal or the
 * ceiling both echo the parsed input. Read through the schema rather than
 * trusted, because `input` is typed `unknown` on the wire.
 */
export function refusedValuesOf(result: PublishResult): PublishProfileValues | undefined {
  const echoed = publishProfileValues.safeParse(result.serverError?.input);
  return echoed.success ? echoed.data : undefined;
}
