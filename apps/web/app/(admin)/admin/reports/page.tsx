/**
 * `/admin/reports` — Reports, and the freeze that ends here.
 *
 * **Freezing and unfreezing are not a section of their own**, which the shape
 * interview settled and this file records: a frozen Hirer is reached *from* the
 * Report that froze him, so both acts live on these rows. A sixth section would
 * be a spec amendment.
 *
 * The resolver is #108's. Until it lands the section says it is not counting.
 */

import { QueueSection } from "../_components/section";
import { REPORTS_LABEL } from "../_lib/messages";
import { sectionMetadata } from "../_lib/section-metadata";

export const metadata = sectionMetadata(REPORTS_LABEL);

export default function ReportsSectionPage() {
  return <QueueSection segment="reports" />;
}
