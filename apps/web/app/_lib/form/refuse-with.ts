/**
 * How every form on this app refuses by return, with its tree and her values.
 *
 * **One function rather than one per surface**, and the pull it resists is real:
 * the second copy of this was written for the Offer form, word for word, down to
 * the same `status`, the same `context` and the same *todo lo que escribiste
 * sigue en el formulario*. It was caught in review of the same change that
 * extracted `useActionForm` for exactly this reason.
 *
 * **Logged at `warn` because a returned error bypasses `handleServerError`**,
 * which is where every thrown one is logged — a refusal nothing records is a
 * failure nothing records (CLAUDE.md: "thrown is reported; returned is logged").
 *
 * **It is an error rather than data** so that a postback on the unhydrated path
 * actually completes: a `.stateAction()` that *returns* a value sends React's
 * server render into a hot loop, while a returned `serverError` re-renders in
 * tens of milliseconds. See `ActionError.fieldErrors`.
 */

import { AppError, projectClientError } from "@repo/errors/app-error";
import { logRequestError } from "@repo/observability/log-request-error";
import { returnActionError } from "@/lib/safe-action";

export interface RefusalOptions<Errors extends object, Values> {
  /** This surface's refusal code, so the browser can tell one path from another. */
  readonly code: string;
  /** Operator-facing English. Never reaches a browser. */
  readonly message: string;
  /**
   * The sentence beside the summary — *nothing you typed was lost*, in this
   * surface's own words.
   *
   * A parameter rather than a constant even though both surfaces currently say
   * the same thing: which sentence a person reads is copy under the voice guide
   * and belongs in the surface's messages module, not in a shared helper that
   * would quietly become the place copy lives.
   */
  readonly summaryKept: string;
  /** The per-field verdict, in next-safe-action's formatted tree. */
  readonly errors: Errors;
  /** What she submitted, echoed back so the unhydrated page can re-render from it. */
  readonly values: Values;
}

export function refuseWith<Errors extends object, Values>({
  code,
  message,
  summaryKept,
  errors,
  values,
}: RefusalOptions<Errors, Values>): never {
  const refusal = new AppError({
    code,
    status: 422,
    message,
    // The sentence the summary already says; the tree carries the rest.
    userMessage: summaryKept,
    /**
     * Field names only — identifiers, never what she typed (NFR18).
     *
     * `_errors` is next-safe-action's key for a node's own messages rather than
     * a field, so it is dropped: a line naming it would name nothing.
     */
    context: { fields: Object.keys(errors).filter((key) => key !== "_errors") },
  });

  logRequestError(refusal, { level: "warn" });
  return returnActionError({ ...projectClientError(refusal), fieldErrors: errors, input: values });
}
