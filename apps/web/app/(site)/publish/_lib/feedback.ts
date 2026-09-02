/**
 * What the feedback region says, or nothing — pure, and apart from the hook
 * so it can be tested without importing the Server Action (whose module
 * carries `server-only`).
 */

import { SESSION_REQUIRED_CODE } from "@/app/_lib/session/codes";
import type { ActionError } from "@/lib/safe-action";
import { PUBLISH_FAILED } from "./messages";

export interface Feedback {
  readonly message: string;
  /** Seconds until a ceiling's window resets, when this feedback is a ceiling's. */
  readonly retryAfter?: number | undefined;
}

/**
 * What the feedback region says, or nothing. A ceiling is told apart from a
 * transport fault by `retryAfter`, not by a status code — `lib/safe-action.ts`
 * puts that field on the error for exactly this read. The ceiling's own
 * sentence already says how many attempts, when the window resets, and that
 * nothing was lost; a transport fault gets the sentence from `./messages`.
 *
 * Exported for its own test: it is the one rule here rather than a wiring.
 */
export function feedbackFor(result: {
  readonly serverError?: ActionError | undefined;
  readonly validationErrors?: unknown;
}): Feedback | undefined {
  if (!result.serverError) return undefined;

  // A per-field refusal is the summary's to say, item by item; a second
  // sentence above it would say the same thing twice.
  if (result.serverError.fieldErrors !== undefined) return undefined;

  const { message, retryAfter, code } = result.serverError;
  if (retryAfter !== undefined) return { message, retryAfter };

  // A refusal with a sentence of its own — the session gone — says that
  // sentence. Anything else is a fault, and the fault's sentence is ours rather
  // than whatever the transport produced.
  return { message: code === SESSION_REQUIRED_CODE ? message : PUBLISH_FAILED };
}
