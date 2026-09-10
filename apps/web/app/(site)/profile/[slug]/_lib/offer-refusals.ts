/**
 * The domain's Offer refusals, as the sentences the form renders on each field,
 * and the returned error that carries them back with his values.
 *
 * The mapping from an English refusal to an `es-CO` sentence lives here and not
 * in `@repo/domain` (ADR-0012): the refusal is an identifier and the sentence is
 * copy under the voice guide.
 */

import type { OfferRefusal } from "@repo/domain/offers";
import { refuseWith } from "@/app/_lib/form/refuse-with";
import {
  HIRER_NAME_REQUIRED,
  HIRER_PHONE_LOOKS_WRONG,
  OFFER_SUMMARY_KEPT,
  offerContactDetailRefusal,
  type OfferFieldName,
} from "./offer-messages";

/** next-safe-action's formatted tree, for this form's fields — all flat, the consent box among them. */
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
 * Refuse by return, with the tree and his values — this surface's `summaryKept`
 * bound to the general helper in `_lib/form/refuse-with.ts`.
 *
 * The six lines under it were written twice, once here and once for the
 * publishing form, and review of this change caught the copy. What stays here is
 * the one thing that is this surface's: the sentence a person reads.
 */
export function refuseOfferWith<Values>(options: {
  readonly code: string;
  readonly message: string;
  readonly errors: OfferErrorTree;
  readonly values: Values;
}): never {
  return refuseWith({ ...options, summaryKept: OFFER_SUMMARY_KEPT });
}
