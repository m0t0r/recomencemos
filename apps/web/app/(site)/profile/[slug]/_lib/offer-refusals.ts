/**
 * The domain's Offer refusals, as the sentences the form renders on each field,
 * and the returned error that carries them back with his values.
 *
 * The mapping from an English refusal to an `es-CO` sentence lives here and not
 * in `@repo/domain` (ADR-0012): the refusal is an identifier and the sentence is
 * copy under the voice guide.
 */

import type { OfferRefusal } from "@repo/domain/offers";
import { AppError, projectClientError } from "@repo/errors/app-error";
import { logRequestError } from "@repo/observability/log-request-error";
import { returnActionError } from "@/lib/safe-action";
import {
  HIRER_NAME_REQUIRED,
  HIRER_PHONE_LOOKS_WRONG,
  OFFER_SUMMARY_KEPT,
  offerContactDetailRefusal,
  type OfferFieldName,
} from "./offer-messages";

/** next-safe-action's formatted tree, for the five flat fields this form has. */
// `_errors` is the library's own key for a node's messages, not ours.
// oxlint-disable-next-line no-underscore-dangle
export type OfferErrorTree = Partial<Record<OfferFieldName, { _errors: string[] }>>;

export function treeFromOfferRefusals(refusals: readonly OfferRefusal[]): OfferErrorTree {
  const tree: OfferErrorTree = {};

  for (const refusal of refusals) {
    switch (refusal.code) {
      case "contact_detail":
        // oxlint-disable-next-line no-underscore-dangle -- the tree's own key
        tree[refusal.field] = {
          _errors: [offerContactDetailRefusal(refusal.kind, refusal.fragment)],
        };
        break;
      case "phone_unrecognised":
        // oxlint-disable-next-line no-underscore-dangle
        tree.hirerPhone = { _errors: [HIRER_PHONE_LOOKS_WRONG] };
        break;
      case "identity_required":
        // oxlint-disable-next-line no-underscore-dangle
        tree.hirerName = { _errors: [HIRER_NAME_REQUIRED] };
        break;
    }
  }

  return tree;
}

/**
 * Refuse by return, with the tree and his values.
 *
 * Logged at `warn` because a returned error bypasses `handleServerError`, which
 * is where every thrown one is logged — a refusal nothing records is a failure
 * nothing records. It is an error rather than data so that a postback on the
 * unhydrated path actually completes (see `ActionError.fieldErrors`).
 */
export function refuseOfferWith<Values>({
  code,
  message,
  errors,
  values,
}: {
  /** This surface's refusal code, so the browser can tell it from a ceiling. */
  readonly code: string;
  /** Operator-facing English. Never reaches a browser. */
  readonly message: string;
  readonly errors: OfferErrorTree;
  readonly values: Values;
}): never {
  const refusal = new AppError({
    code,
    status: 422,
    message,
    // The sentence the summary already says; the tree carries the rest.
    userMessage: OFFER_SUMMARY_KEPT,
    // Field names only — identifiers, never what he typed (NFR18).
    context: { fields: Object.keys(errors) },
  });

  logRequestError(refusal, { level: "warn" });
  return returnActionError({ ...projectClientError(refusal), fieldErrors: errors, input: values });
}
