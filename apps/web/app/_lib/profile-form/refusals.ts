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
import { refuseWith as refuse } from "@/app/_lib/form/refuse-with";
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
 * Refuse by return, with the tree and her values — this surface's `summaryKept`
 * bound to the general helper in `_lib/form/refuse-with.ts`.
 *
 * The helper became shared when the Offer form needed the same six lines; what
 * stays here is the one thing that is this surface's, which is the sentence a
 * person reads.
 */
export function refuseWith<Values>(options: {
  readonly code: string;
  readonly message: string;
  readonly errors: FieldErrorTree;
  readonly values: Values;
}): never {
  return refuse({ ...options, summaryKept: SUMMARY_KEPT });
}
