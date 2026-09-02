/**
 * The domain's refusals, as the sentences a form renders on each field, and
 * the returned error that carries them back with her values.
 *
 * **Both write paths refuse identically**, because both run the same rejector
 * over the same fields — so this is shared rather than written twice. What is
 * not shared is the `AppError.code`: publishing and editing each name their
 * own, which is what lets the browser's feedback rule tell one from the other.
 *
 * The mapping from an English refusal to an `es-CO` sentence lives here and
 * not in `@repo/domain` (ADR-0012): the refusal is an identifier and the
 * sentence is copy under the voice guide.
 */

import type { ProfileRefusal } from "@repo/domain/profiles";
import { AppError, projectClientError } from "@repo/errors/app-error";
import { logRequestError } from "@repo/observability/log-request-error";
import { returnActionError } from "@/lib/safe-action";
import {
  CITY_REQUIRED,
  contactDetailRefusal,
  PHONE_LOOKS_WRONG,
  type PublishFieldName,
  SKILL_NO_LONGER_LISTED,
  SKILL_REQUIRED,
  SUMMARY_KEPT,
} from "./messages";
import type { FieldErrorTree } from "./summary";

export function treeFromRefusals(refusals: readonly ProfileRefusal[]): FieldErrorTree {
  const tree: FieldErrorTree = {};
  // oxlint-disable-next-line no-underscore-dangle -- the tree's own key
  const say = (field: Exclude<PublishFieldName, "workHistory">, message: string) => {
    tree[field] = { _errors: [message] };
  };

  for (const refusal of refusals) {
    switch (refusal.code) {
      case "contact_detail": {
        const message = contactDetailRefusal(refusal.kind, refusal.fragment);
        if (refusal.field === "workHistory") {
          tree.workHistory ??= {};
          // oxlint-disable-next-line no-underscore-dangle
          if (refusal.index === undefined) tree.workHistory._errors = [message];
          // oxlint-disable-next-line no-underscore-dangle
          else tree.workHistory[refusal.index] = { _errors: [message] };
        } else {
          say(refusal.field, message);
        }
        break;
      }
      case "unknown_skill":
        say("skillSlugs", SKILL_NO_LONGER_LISTED);
        break;
      case "no_skill":
        say("skillSlugs", SKILL_REQUIRED);
        break;
      case "phone_unrecognised":
        say("phone", PHONE_LOOKS_WRONG);
        break;
      case "city_unknown":
        say("city", CITY_REQUIRED);
        break;
    }
  }

  return tree;
}

/**
 * Refuse by return, with the tree and her values.
 *
 * Logged at `warn` because a returned error bypasses `handleServerError`,
 * which is where every thrown one is logged — a refusal nothing records is a
 * failure nothing records. It is an error rather than data so that a postback
 * on the unhydrated path actually completes (see `ActionError.fieldErrors`).
 */
export function refuseWith<Values>({
  code,
  message,
  errors,
  values,
}: {
  /** This surface's refusal code, so the browser can tell the two paths apart. */
  readonly code: string;
  /** Operator-facing English. Never reaches a browser. */
  readonly message: string;
  readonly errors: FieldErrorTree;
  readonly values: Values;
}): never {
  const refusal = new AppError({
    code,
    status: 422,
    message,
    // The sentence the summary already says; the tree carries the rest.
    userMessage: SUMMARY_KEPT,
    // Field names only — identifiers, never what she typed (NFR18).
    context: { fields: Object.keys(errors).filter((key) => key !== "_errors") },
  });

  logRequestError(refusal, { level: "warn" });
  return returnActionError({ ...projectClientError(refusal), fieldErrors: errors, input: values });
}
