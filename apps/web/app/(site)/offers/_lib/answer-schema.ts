/**
 * What an answer to an Offer carries, and the shape each action parses it into.
 *
 * **The Offer id is a bound argument, not a field** (ADR-0015). It travels with
 * the submit and nobody types it, so React encodes it into the action reference
 * and the action validates it on arrival — against the same pattern the domain
 * checks before any query, so a malformed id is refused before it could become a
 * `uuid` cast error.
 *
 * **`confirmed` is the second step, and it is the only field.** The API
 * contract's `acceptOffer` takes `{ offerId, confirmed: true }`: the button that
 * commits carries `name="confirmed" value="true"`, so the value arrives only when
 * the step that names what crosses is the one that was pressed. It is pressed,
 * not typed and not mirrored, which is why it is a field rather than a bound
 * argument.
 */

import { OFFER_ID_PATTERN } from "@repo/domain/offers";
import { z } from "zod";

export const answerOfferIdArg = z.string().regex(OFFER_ID_PATTERN);

/**
 * `FormData` or a plain object, into `{ confirmed }`. next-safe-action converts
 * neither shape, so a `useActionState` submit hands the raw `FormData` over — the
 * same arrangement `offer-schema.ts` documents for the Offer form.
 */
function fromAnswerFormData(raw: unknown): unknown {
  return raw instanceof FormData ? { confirmed: raw.get("confirmed") === "true" } : raw;
}

/** Accepting refuses anything but the second step: a request without it has not seen what crosses. */
export const acceptInputSchema = z.preprocess(
  fromAnswerFormData,
  z.object({ confirmed: z.literal(true) }),
);

/**
 * Declining carries nothing: it is one tap, and it crosses nothing. The API
 * contract's optional `reason` is not collected, because no surface asks her for
 * one — she does not explain herself.
 */
export const declineInputSchema = z.preprocess(() => ({}), z.object({}));
