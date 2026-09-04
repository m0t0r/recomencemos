/**
 * `/admin/offers` — the section that leads, because it is the only one with a
 * deadline attached: NFR7's band is per Offer, and `/admin` redirects here.
 *
 * **The resolver is #106's, not this ticket's.** Until it lands the section says
 * it is not counting rather than reporting a zero, which is the shell's coverage
 * rule at the scale of one page.
 */

import { QueueSection } from "../_components/section";
import { OFFERS_LABEL } from "../_lib/messages";
import { sectionMetadata } from "../_lib/section-metadata";

export const metadata = sectionMetadata(OFFERS_LABEL);

export default function OffersSectionPage() {
  return <QueueSection segment="offers" />;
}
