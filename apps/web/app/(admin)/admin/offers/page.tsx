/**
 * `/admin/offers` — the section that leads, because it is the only one with a
 * deadline attached: NFR7's band is per Offer, and `/admin` redirects here.
 *
 * **The source is live since story 6**, which is the story that writes the Offers
 * this section reviews: the branch's count and its age-of-oldest are computed
 * over the whole pending predicate, the rows are capped for display, and
 * `deliverOffer` is the one action attached to them.
 *
 * **What is still #106's** is the section as a designed surface: the fixed row
 * rhythm, the same affordances in the same position every time, `rejectOffer`,
 * and the focus and announcement pass across all five sections at once.
 */

import { QueueSection } from "../_components/section";
import { OFFERS_LABEL } from "../_lib/messages";
import { sectionMetadata } from "../_lib/section-metadata";

export const metadata = sectionMetadata(OFFERS_LABEL);

export default function OffersSectionPage() {
  return <QueueSection segment="offers" />;
}
