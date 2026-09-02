"use client";

/**
 * Everything a profile form *does*, separated from everything it *looks like* —
 * the same split `/sign-in` made, and for the same reason: several layouts
 * share one machine, so the parts that are easy to get subtly wrong have one
 * home. Since #142 that is two surfaces as well as several layouts, which is
 * why the action arrives as an argument rather than as an import.
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
import type { z } from "zod";
import type { ActionError } from "@/lib/safe-action";
import { type Feedback, feedbackFor } from "./feedback";
import { type PublishProfileValues, publishProfileValues } from "./schema";
import { type Summary, summaryFromIssues, summaryFromValidationErrors } from "./summary";

/**
 * The parts of a `useActionState` result this machine reads.
 *
 * **Structural rather than `Awaited<ReturnType<typeof someAction>>`**, which is
 * what it was while there was one action to name. A module in the shared layer
 * that imported a route's action would make every form depend on one surface's
 * `actions.ts` — and that module carries `"use server"`, so the dependency
 * would run the wrong way round as well as the wrong distance. `feedbackFor`
 * already took its argument this way, for the same reason.
 */
export interface ProfileFormResult {
  readonly serverError?: ActionError | undefined;
  readonly validationErrors?: unknown;
}

/** What a form's `useActionState` starts on: nothing has been submitted. */
export const INITIAL_RESULT: ProfileFormResult = {};

export type { Feedback } from "./feedback";

export interface ProfileFormMachine {
  readonly result: ProfileFormResult;
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

/**
 * The action, **already bound by its caller**.
 *
 * Binding is the surface's business, not this hook's: `/publish` binds the
 * consent versions it displayed (ADR-0015 — bound, not hidden, so the JSX
 * carries no mirror of them and a browser with JavaScript unavailable still
 * submits them), and an edit binds nothing, because there is nothing that
 * travels with the submit that she does not type. A hook that took the
 * versions would be a hook that knew about consent, on a form that has none.
 */
export type ProfileFormAction = (state: never, formData: FormData) => Promise<ProfileFormResult>;

export interface ProfileFormOptions {
  readonly action: ProfileFormAction;
  /** The action's initial `useActionState` value. `INITIAL_RESULT` unless a surface has more. */
  readonly initial: ProfileFormResult;
  /**
   * **The strict parse `guardSubmit` runs, which is the action's own.**
   *
   * A parameter rather than a constant, and the reason is a bug this would
   * otherwise have: publishing's strict schema requires the consent checkbox,
   * and an edit form has none — so a shared guard hard-wired to it would refuse
   * every save in the browser, silently, on the one path the server never sees.
   * Handing each surface's schema in keeps the promise the guard is built on:
   * the browser parses with exactly what the server will parse with.
   */
  readonly schema: {
    safeParse(value: unknown): { success: true } | { success: false; error: z.ZodError };
  };
  /** The sentence a transport fault gets. Per surface — see `feedbackFor`. */
  readonly faultMessage: string;
}

export function useProfileForm({
  action,
  initial,
  schema,
  faultMessage,
}: ProfileFormOptions): ProfileFormMachine {
  /**
   * **The one cast in this module, and it is the price of being shared.**
   *
   * Each action's `useActionState` state type is its own union of the
   * envelopes next-safe-action can return. Declaring the parameter `never`
   * above is what lets any of them be passed in — a function's parameters are
   * contravariant, so a narrow state type is assignable to a `never` one and
   * not to a widened one. `useActionState` then has to be handed something it
   * can call, and this is that. Nothing is being asserted about the *value*:
   * every field the machine reads is on {@link ProfileFormResult}, and the two
   * that are not — `data`, and whichever envelope carried it — are never read
   * here.
   */
  const call = action as (
    state: ProfileFormResult,
    formData: FormData,
  ) => Promise<ProfileFormResult>;

  const [result, formAction, pending] = useActionState(call, initial);

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

  const guardSubmit: ProfileFormMachine["guardSubmit"] = (event, runValidators) => {
    const formData = new FormData(event.currentTarget);
    const parsed = schema.safeParse(formData);

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
    feedback: feedbackFor(result, faultMessage),
    summaryRef,
    guardSubmit,
  };
}

/**
 * Her values, from whichever refusal carried them — the field refusal or the
 * ceiling both echo the parsed input. Read through the schema rather than
 * trusted, because `input` is typed `unknown` on the wire.
 */
export function refusedValuesOf(result: ProfileFormResult): PublishProfileValues | undefined {
  const echoed = publishProfileValues.safeParse(result.serverError?.input);
  return echoed.success ? echoed.data : undefined;
}
