/**
 * What the region beside the Skill-request field says, or nothing — pure, and
 * apart from the hook so it can be tested without importing the Server Action
 * (whose module carries `server-only`).
 *
 * The same split `feedback.ts` makes for the publishing form's own outcomes, and
 * for the same reason: this is the one *rule* on the request path rather than a
 * wiring, and a rule that cannot be tested is a rule nobody checks.
 */

import { SESSION_REQUIRED_CODE } from "@/app/_lib/session/codes";
import type { ActionError } from "@/lib/safe-action";
import { SKILL_REQUEST_FAILED, SKILL_REQUEST_SENT } from "./messages";
import { SKILL_REQUEST_REFUSED_CODE } from "./codes";

/** What the region says, and whether it is an answer or a refusal. */
export interface SkillRequestNotice {
  readonly message: string;
  readonly refused: boolean;
}

/**
 * **A ceiling, a rejected fragment and an expired session all arrive as
 * `serverError`, and all three carry their own sentence** — one written by
 * NFR26's refusal table, one by the surface's `contactDetailRefusal`, one by the
 * domain. None is rewritten here: each says something the others cannot, and the
 * first two are refusals a person provokes on purpose.
 *
 * A ceiling is told apart by `retryAfter` rather than by a status code —
 * `lib/safe-action.ts` puts that field on the error for exactly this read.
 * Anything else is a fault, and the fault's sentence is ours rather than whatever
 * the transport produced.
 */
export function noticeFor(result: {
  readonly data?: { readonly requested: true } | undefined;
  readonly serverError?: ActionError | undefined;
}): SkillRequestNotice | undefined {
  if (result.serverError) {
    const { code, message, retryAfter } = result.serverError;
    const spoken =
      retryAfter !== undefined ||
      code === SKILL_REQUEST_REFUSED_CODE ||
      code === SESSION_REQUIRED_CODE;

    return { message: spoken ? message : SKILL_REQUEST_FAILED, refused: true };
  }

  return result.data?.requested ? { message: SKILL_REQUEST_SENT, refused: false } : undefined;
}
