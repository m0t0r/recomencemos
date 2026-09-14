/**
 * The page's body once the read has resolved: the lead and the waiting count,
 * the folders, the list, and the Offer she opened (#304, variant D — _Correo_).
 *
 * **Mail's structure, none of its signals.** Folders, a list and a reading pane
 * are the shape most people here already know from a phone; bold unread rows,
 * counts on folders, reply and sort are the signals this product refuses. The
 * only number on the page is how many wait on her, in words.
 *
 * **Two screens on the phone, three columns from `lg`.** On the list route the
 * pane is hidden below `lg`; on an opened Offer the folders and the list are.
 * Nothing is hidden by a script, so both halves work without JavaScript and the
 * address alone decides which one a phone shows.
 *
 * Sync and prop-driven, so it renders under happy-dom; the async half is the
 * frame's.
 */

import { cn } from "@repo/design-system/lib/utils";
import { ListEmptyState } from "@/app/(site)/_components/profile-list/empty-state";
import { boxQuery, type MailboxPage, type MailboxView } from "../_lib/mailbox-view";
import {
  OFFERS_EMPTY_BODY,
  OFFERS_EMPTY_HEADING,
  OFFERS_EMPTY_LINK,
  OFFERS_LEAD,
  PANE_PLACEHOLDER,
  RECEIVED_OFFERS_LEAD,
  RECEIVED_OFFERS_NO_PROFILE_LINK,
  waitingCount,
} from "../_lib/messages";
import {
  OFFER_JUST_SENT_HEADING,
  OFFER_JUST_SENT_IMMUTABLE,
  OFFER_JUST_SENT_REVIEW,
  SENT_OFFERS_LEAD,
} from "../_lib/sent-messages";
import { Folders } from "./folders";
import { OfferList } from "./offer-list";
import { ReadingPane } from "./reading-pane";

/** Each side keeps the lead its own page had; both at once say both halves. */
function leadFor(view: MailboxView): string {
  if (view.box === "received") return RECEIVED_OFFERS_LEAD;
  if (view.box === "sent") return SENT_OFFERS_LEAD;

  return OFFERS_LEAD;
}

/** Under the heading: the lead, and — on the received side — what waits on her. */
export function MailboxLead({ view }: { readonly view: MailboxView }) {
  return (
    <>
      <p className="text-muted-foreground">{leadFor(view)}</p>
      {/*
        On the received side only: under _Enviadas_ the lead is about what he
        sent, and a count of what waits on her would read as a count of those.
        Nothing when nothing has reached her: the empty state says that, and better.
      */}
      {view.hasReceived && view.box !== "sent" ? (
        <p className="text-foreground font-medium">{waitingCount(view.waiting)}</p>
      ) : null}
    </>
  );
}

/**
 * The line he lands on after sending — all three clauses, and the criterion is
 * that all three are here. `status` rather than `alert`: it is the outcome of
 * something he did, and it interrupts nothing.
 */
function SentConfirmation() {
  return (
    <output className="border-border flex flex-col gap-1 border-l-2 pl-4">
      <span className="text-foreground font-medium">{OFFER_JUST_SENT_HEADING}</span>
      <span className="text-muted-foreground text-sm">{OFFER_JUST_SENT_REVIEW}</span>
      <span className="text-muted-foreground text-sm">{OFFER_JUST_SENT_IMMUTABLE}</span>
    </output>
  );
}

export function Mailbox({ view }: { readonly view: MailboxPage }) {
  if (!view.sides.received && !view.sides.sent) {
    /*
      Both ways out, because an Account here could be either: publishing is
      what makes an Offer arrive, and the list is where one is written from.
    */
    return (
      <ListEmptyState
        title={OFFERS_EMPTY_HEADING}
        body={OFFERS_EMPTY_BODY}
        actionHref="/publish"
        actionLabel={RECEIVED_OFFERS_NO_PROFILE_LINK}
        secondary={{ href: "/profiles", label: OFFERS_EMPTY_LINK }}
      />
    );
  }

  /** An opened Offer is the phone's whole screen; `/offers/[id]` 404s without one. */
  const detail = view.opened !== undefined;
  // Carried onto every row and the way back; nothing where there is no folder to return to.
  const query = view.folders ? boxQuery(view.box) : "";

  return (
    <div className="flex flex-col gap-6">
      {view.justSent ? <SentConfirmation /> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
        {view.folders ? (
          <div className={cn("lg:col-span-2", detail && "max-lg:hidden")}>
            <Folders box={view.box} detail={detail} />
          </div>
        ) : null}

        <div
          className={cn(
            view.folders ? "lg:col-span-4" : "lg:col-span-5",
            detail && "max-lg:hidden",
          )}
        >
          <OfferList view={view} query={query} />
        </div>

        <div
          className={cn(
            "lg:border-border lg:border-l lg:pl-8",
            view.folders ? "lg:col-span-6" : "lg:col-span-7",
            !detail && "max-lg:hidden",
          )}
        >
          {view.opened ? (
            // Keyed by the Offer, so opening another one focuses its heading again.
            <ReadingPane key={view.opened.offer.id} entry={view.opened} view={view} query={query} />
          ) : (
            <p className="text-muted-foreground pt-3">{PANE_PLACEHOLDER}</p>
          )}
        </div>
      </div>
    </div>
  );
}
