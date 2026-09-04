/**
 * `/admin/photos` — the one section whose backlog is also a gate: NFR6 keeps an
 * unreviewed photo off every public surface until somebody here has looked at it.
 *
 * The resolver is #107's. Until it lands the section says it is not counting.
 */

import { QueueSection } from "../_components/section";
import { PHOTOS_LABEL } from "../_lib/messages";
import { sectionMetadata } from "../_lib/section-metadata";

export const metadata = sectionMetadata(PHOTOS_LABEL);

export default function PhotosSectionPage() {
  return <QueueSection segment="photos" />;
}
