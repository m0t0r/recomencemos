/**
 * Where an Offer stands, as a text label, whichever side of it the Account is on.
 *
 * **Each side keeps its own words.** She reads _Por responder_ on an Offer
 * waiting on her; he reads _En revisión_ or _Se está demorando_ on one waiting on
 * us. The two tables are the ones each surface settled, and neither is ever
 * `destructive`: no state on this page is an alarm about a person.
 */

import { Badge } from "@repo/design-system/components/badge";
import type { Entry } from "../_lib/mailbox-view";
import { asReceivedState } from "../_lib/received-state";
import { offerBadge } from "../_lib/sent-state-badge";
import { OfferStateBadge } from "./offer-parts";

export function EntryStateBadge({ entry }: { readonly entry: Entry }) {
  if (entry.direction === "received") {
    // The read only hands over received states; this refuses to label anything else.
    const state = asReceivedState(entry.offer.state);

    return state ? <OfferStateBadge state={state} className="shrink-0" /> : null;
  }

  const badge = offerBadge(entry.offer.state, entry.offer.reviewDelayed);

  return (
    <Badge variant={badge.variant} className="shrink-0">
      {badge.label}
    </Badge>
  );
}
