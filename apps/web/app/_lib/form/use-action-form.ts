"use client";

/**
 * Everything a form built on a Server Action *does*, with nothing in it about
 * which form.
 *
 * **This is `useProfileForm` with the profile taken out of it, and the reason is
 * a second surface.** Story 6's Offer form has three fields, no Skill picker and
 * no consent checkbox, and needed every line of that machine: the
 * `useActionState` dispatch, the hydration probe, the summary that outranks the
 * browser's, the focus move, and the `guardSubmit` that decides on every submit
 * whether the browser already knows the answer. Copying it would have put two
 * copies of the four things in it that are easy to get subtly wrong — and the
 * next surface that needs a form is story 8's.
 *
 * **What is parameterised is exactly what was profile-shaped**: the two summary
 * builders and the reader that recovers her values from a refusal. Everything
 * else was already general. `useProfileForm` is now a wrapper that supplies
 * those three, so both existing surfaces are untouched.
 *
 * The rules the machine holds are unchanged and are worth restating, because
 * each was measured rather than reasoned:
 *
 * - **The `<form>` keeps its native `action`** (ADR-0014), so a submit before
 *   hydration posts and the Server Action answers.
 * - **A valid submit is dispatched by hand**, not left to the form's own
 *   `action`: React resets the form once the action settles, and a reset clears
 *   the hidden native inputs Base UI keeps behind every checkbox and radio while
 *   the styled controls beside them still read as ticked.
 * - **An action's outcomes are not form state.** A ceiling carries a
 *   `retryAfter`, a transport fault is neither a field error nor a ceiling, and
 *   the server's per-field verdict arrives as `validationErrors`.
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

/**
 * The parts of a `useActionState` result this machine reads.
 *
 * **Structural rather than `Awaited<ReturnType<typeof someAction>>`.** A module
 * in the shared layer that imported a route's action would make every form
 * depend on one surface's `actions.ts` — and that module carries `"use server"`,
 * so the dependency would run the wrong way round as well as the wrong distance.
 */
export interface ActionFormResult {
  readonly serverError?: ActionError | undefined;
  readonly validationErrors?: unknown;
}

/** What a form's `useActionState` starts on: nothing has been submitted. */
export const INITIAL_RESULT: ActionFormResult = {};

export type { Feedback } from "./feedback";

/**
 * The action, **already bound by its caller**.
 *
 * Binding is the surface's business, not this hook's: `/publish` binds the
 * consent versions it displayed and the Offer form binds the profile's slug
 * (ADR-0015 — bound, not hidden, so the JSX carries no mirror of them and a
 * browser with JavaScript unavailable still submits them).
 */
export type ActionFormAction = (state: never, formData: FormData) => Promise<ActionFormResult>;

export interface ActionFormOptions<Summary, Values> {
  readonly action: ActionFormAction;
  readonly initial: ActionFormResult;
  /**
   * **The strict parse `guardSubmit` runs, which is the action's own.**
   *
   * Handing each surface's schema in keeps the promise the guard is built on:
   * the browser parses with exactly what the server will parse with. A shared
   * guard hard-wired to one surface's schema would refuse every submit on
   * another, silently, on the one path the server never sees.
   */
  readonly schema: {
    safeParse(value: unknown): { success: true } | { success: false; error: z.ZodError };
  };
  /**
   * What a transport fault says. Per surface, because "no pudimos publicar tu
   * perfil" on a form that was sending an Offer names an act nobody took.
   */
  readonly faultMessage: string;
  /** The browser's own parse, as this surface's summary. */
  readonly summaryFromIssues: (issues: readonly z.core.$ZodIssue[]) => Summary | undefined;
  /** next-safe-action's formatted tree, as this surface's summary. */
  readonly summaryFromValidationErrors: (errors: unknown) => Summary | undefined;
  /** Her values, recovered from whichever refusal echoed them back. */
  readonly refusedValuesOf: (result: ActionFormResult) => Values | undefined;
}

export interface ActionFormMachine<Summary, Values> {
  readonly result: ActionFormResult;
  readonly formAction: (formData: FormData) => void;
  readonly pending: boolean;
  /**
   * Whether the page has hydrated. Before it has, the browser's own `required`
   * check is the only client-side guard, so `noValidate` is withheld until this
   * is true and our validators can take over.
   */
  readonly hydrated: boolean;
  /** The form-level summary, from whichever verdict is current, or nothing. */
  readonly summary: Summary | undefined;
  /**
   * The server's per-field verdict, for each field to render beside itself.
   * `unknown` on purpose: it is the action's own tree, or — for a payload that
   * was not even the right shape — next-safe-action's.
   */
  readonly serverErrors: unknown;
  /**
   * What she submitted, when the server refused it. The unhydrated page mounts
   * fresh from the action's result, and this is what puts her values back.
   */
  readonly refusedValues: Values | undefined;
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

export function useActionForm<Summary, Values>({
  action,
  initial,
  schema,
  faultMessage,
  summaryFromIssues,
  summaryFromValidationErrors,
  refusedValuesOf,
}: ActionFormOptions<Summary, Values>): ActionFormMachine<Summary, Values> {
  /**
   * **The one cast in this module, and it is the price of being shared.**
   *
   * Each action's `useActionState` state type is its own union of the envelopes
   * next-safe-action can return. Declaring the parameter `never` on
   * {@link ActionFormAction} is what lets any of them be passed in — a
   * function's parameters are contravariant, so a narrow state type is
   * assignable to a `never` one and not to a widened one. Nothing is being
   * asserted about the *value*: every field read here is on
   * {@link ActionFormResult}.
   */
  const call = action as (state: ActionFormResult, formData: FormData) => Promise<ActionFormResult>;

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
   * moment a submit is allowed through, so a stale client list cannot sit beside
   * a fresh server one.
   */
  const serverErrors = result.serverError?.fieldErrors ?? result.validationErrors;
  const summary = summaryFromValidationErrors(serverErrors) ?? clientSummary;

  useEffect(() => {
    // Read from `result` rather than a derived boolean: `result` is a fresh
    // object per dispatch, which is what makes "on every outcome" true.
    if (result.serverError ?? result.validationErrors) {
      summaryRef.current?.focus();
    }
  }, [result]);

  const guardSubmit: ActionFormMachine<Summary, Values>["guardSubmit"] = (event, runValidators) => {
    const formData = new FormData(event.currentTarget);
    const parsed = schema.safeParse(formData);

    if (parsed.success) {
      // Dispatched by hand — see the class comment for what a React form reset
      // does to Base UI's hidden inputs. The `action` attribute stays on the
      // `<form>` for the unhydrated path.
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
    refusedValues: refusedValuesOf(result),
    feedback: feedbackFor(result, faultMessage),
    summaryRef,
    guardSubmit,
  };
}
