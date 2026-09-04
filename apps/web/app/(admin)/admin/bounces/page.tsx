/**
 * `/admin/bounces` — addresses the mail server could not deliver to.
 *
 * **This is the fifth source, and it is not frozen Hirers.** Story 7 names the
 * five as unreviewed Offers, unreviewed photos, Reports, Skill requests and
 * bounced addresses; the freeze is an act reached from a Report and lives on
 * those rows. The first draft of the surface brief had this wrong, which is why
 * both it and this file say so.
 *
 * The resolver is #110's. Until it lands the section says it is not counting.
 */

import { QueueSection } from "../_components/section";
import { BOUNCES_LABEL } from "../_lib/messages";
import { sectionMetadata } from "../_lib/section-metadata";

export const metadata = sectionMetadata(BOUNCES_LABEL);

export default function BouncesSectionPage() {
  return <QueueSection segment="bounces" />;
}
