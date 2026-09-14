/**
 * The folder's Offers, newest first, as a list of rows — or, where a folder is
 * empty, what makes an Offer arrive.
 *
 * **Only the received side can be empty here.** A sent side exists only once
 * something was sent, and an Account with neither side never reaches this list —
 * the page shows one empty state for that instead. So the empty state is the one
 * `/offers` has always had: what makes an Offer arrive, that a person reads each
 * first, and a route to her profile or to publishing one.
 *
 * **One heading names the list**, visually hidden because the folder links above
 * it already show which one this is, so every row's `h3` sits under an `h2`
 * rather than skipping a level.
 *
 * The count is announced once when the boundary resolves, never per row — the
 * rule the Wall and `/profiles` follow, through the same component.
 */

import { ItemSeparator } from "@repo/design-system/components/item";
import { CountAnnouncement } from "@/app/(site)/_components/profile-list/count-announcement";
import { ListEmptyState } from "@/app/(site)/_components/profile-list/empty-state";
import type { MailboxView } from "../_lib/mailbox-view";
import {
  FOLDER_LABELS,
  offersCount,
  RECEIVED_OFFERS_EMPTY_BODY,
  RECEIVED_OFFERS_EMPTY_HEADING,
  RECEIVED_OFFERS_EMPTY_LINK,
  RECEIVED_OFFERS_NO_PROFILE_BODY,
  RECEIVED_OFFERS_NO_PROFILE_LINK,
} from "../_lib/messages";
import { OfferRow } from "./offer-row";

export function OfferList({
  view,
  query,
}: {
  readonly view: MailboxView;
  /** The folder's query, carried onto every row so the way back returns to it. */
  readonly query: string;
}) {
  if (view.entries.length === 0) {
    return (
      <ListEmptyState
        title={RECEIVED_OFFERS_EMPTY_HEADING}
        body={view.hasProfile ? RECEIVED_OFFERS_EMPTY_BODY : RECEIVED_OFFERS_NO_PROFILE_BODY}
        actionHref={view.hasProfile ? "/my-profile" : "/publish"}
        actionLabel={view.hasProfile ? RECEIVED_OFFERS_EMPTY_LINK : RECEIVED_OFFERS_NO_PROFILE_LINK}
        actionVariant="outline"
      />
    );
  }

  return (
    <section aria-labelledby="offer-list-heading">
      <h2 id="offer-list-heading" className="sr-only">
        {FOLDER_LABELS[view.box]}
      </h2>
      {/*
        The sentence rather than the formatter: `CountAnnouncement` is a Client
        Component and a function cannot cross that boundary.
      */}
      <CountAnnouncement count={view.entries.length} label={offersCount(view.entries.length)} />
      {/*
        A `<ul>` of registry `Item`s rather than `ItemGroup`, which is a `div`
        with `role="list"`: its rows would then need `role="listitem"`, which the
        lint refuses in favour of the element that already means it. The ruling
        is the registry's `ItemSeparator`, inside the `<li>`, since a `<ul>` may
        not hold a divider as a direct child.
      */}
      <ul className="flex flex-col">
        {view.entries.map((entry, index) => (
          <li key={entry.offer.id}>
            {index > 0 ? <ItemSeparator className="my-0" /> : null}
            <OfferRow
              entry={entry}
              href={`/offers/${entry.offer.id}${query}`}
              now={view.now}
              current={entry.offer.id === view.opened?.offer.id}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
