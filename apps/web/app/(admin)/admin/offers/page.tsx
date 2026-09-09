/**
 * `/admin/offers` — the section that leads, because it is the only one with a
 * deadline attached: NFR7's band is per Offer, and `/admin` redirects here.
 *
 * **The source has been live since story 6**, which is the story that writes the
 * Offers this section reviews: the branch's count and its age-of-oldest are
 * computed over the whole pending predicate, and the rows are capped for display.
 *
 * **What this section added is the decision.** Both outcomes are on every row, in
 * the same order, in the same place — and a decision that lands hands the
 * keyboard to the next row still waiting rather than back to the one just
 * finished with. The row is `_components/offer-row.tsx`; the rule it shares with
 * every other section's row is `_lib/use-queue-row.ts`.
 */

import { QueueSection } from "../_components/section";
import { OFFERS_LABEL } from "../_lib/messages";
import { sectionMetadata } from "../_lib/section-metadata";

export const metadata = sectionMetadata(OFFERS_LABEL);

export default function OffersSectionPage() {
  return <QueueSection segment="offers" />;
}
