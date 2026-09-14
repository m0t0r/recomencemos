/**
 * `/offers` — every Offer the Account is party to, received and sent, with none
 * opened (#304, variant D — _Correo_).
 *
 * **Scoped by the principal, and there is no not-the-owner case.** Both reads
 * take the principal and scope by it in their own `where` clause, so a caller
 * gets a list without somebody else's Offers rather than somebody else's list.
 * The spec's `permission denied` cell for this row is therefore signed out →
 * `/sign-in`.
 *
 * **`?box=` picks the folder, and it is an address, not a script.** The
 * post-send redirect lands on `?box=sent&sent=1`, and `/sent-offers` redirects
 * here with its query kept (`next.config.ts`), so both reach _Enviadas_ with
 * JavaScript or without it.
 *
 * The page itself is `_components/mailbox-frame.tsx`, shared with
 * `/offers/[id]`; this route says which Offer is open — none — and carries the
 * notices.
 */

import type { Metadata } from "next";
import { StandingNotices } from "@/app/_components/notices/standing-notices";
import { MailboxFrame } from "./_components/mailbox-frame";
import { readMailbox } from "./_lib/mailbox";
import { type MailboxPage, viewMailbox } from "./_lib/mailbox-view";
import { OFFERS_TITLE } from "./_lib/messages";

export const metadata: Metadata = {
  title: OFFERS_TITLE,
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{
  readonly box?: string | string[];
  readonly sent?: string | string[];
}>;

async function readPage(searchParams: SearchParams): Promise<MailboxPage> {
  const mailbox = await readMailbox("/offers");
  const { box, sent } = await searchParams;

  return { ...viewMailbox(mailbox, { box }), justSent: sent === "1" };
}

export default function OffersPage({ searchParams }: { readonly searchParams: SearchParams }) {
  return (
    <MailboxFrame
      // Not awaited: both boundaries in the frame resolve this one read.
      page={readPage(searchParams)}
      detail={false}
      /*
        Story 11's standing notices. `/offers` is a required prefix in
        `lib/notice-surfaces.ts`: she is reading what strangers wrote to her about
        paid work, and he is waiting on an answer about work he offered to pay
        for — exactly where "we verify nobody" and "we never handle the money"
        have to be in front of both.
      */
      notices={<StandingNotices treatment="disclosure" />}
    />
  );
}
