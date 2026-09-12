/**
 * `/offers` — every Offer that has reached her, as one notebook of rows, none
 * of them open.
 *
 * **Scoped by profile ownership, and there is no not-the-owner case.** The read
 * takes the principal and scopes by it in its own `where` clause, so a caller who
 * is not the addressee of an Offer gets a list without it rather than somebody
 * else's. The spec's `permission denied` cell for this row is therefore
 * signed out → `/sign-in`, as `/sent-offers` found for the same reason.
 *
 * The page itself is `_components/received-offers-frame.tsx`, shared with
 * `/offers/[id]`; this route says which rows are open — none — and carries the
 * notices.
 */

import type { Metadata } from "next";
import { StandingNotices } from "@/app/_components/notices/standing-notices";
import { ReceivedOffersFrame } from "./_components/received-offers-frame";
import { readLedger } from "./_lib/ledger";
import { RECEIVED_OFFERS_TITLE } from "./_lib/messages";

export const metadata: Metadata = {
  title: RECEIVED_OFFERS_TITLE,
  robots: { index: false, follow: false },
};

export default function ReceivedOffersPage() {
  return (
    <ReceivedOffersFrame
      // Not awaited: both boundaries in the frame resolve this one read.
      ledger={readLedger("/offers")}
      /*
        Story 11's standing notices. `/offers` is a required prefix in
        `lib/notice-surfaces.ts`: she is reading what strangers wrote to her about
        paid work, which is exactly where "we verify nobody" and "we never handle
        the money" have to be in front of her.
      */
      notices={<StandingNotices treatment="disclosure" />}
    />
  );
}
