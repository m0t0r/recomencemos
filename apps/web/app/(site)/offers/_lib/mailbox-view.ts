/**
 * What the page draws, decided once from what the reads returned and what the
 * address asked for (#304, variant D — _Correo_).
 *
 * **Pure, and the only place these rules live.** The page renders what this
 * returns and decides nothing of its own, so a rule here is a table row in
 * `mailbox-view.test.ts` rather than a rendered page somebody has to inspect.
 *
 * - **A side exists when there is something on it**: the received side when she
 *   holds a profile or anything has reached her, the sent side when anything has
 *   been sent. Both sides get the folders and land on _Todas_; one side gets its
 *   own list and no folders at all.
 * - **Newest first, whatever the direction.** Date is the only order: the
 *   platform ranks nothing.
 * - **The opened Offer is looked up in both directions**, whichever folder is
 *   shown. Absent from both of her scoped lists is the whole of "not hers" — a
 *   missing id and somebody else's are the same answer.
 *
 * `box` is an English identifier holding no Spanish (ADR-0012); the folder's
 * label is the page's to say.
 */

import type { ContactExchange } from "@repo/domain/exchange";
import type { ReceivedOffer, SentOffer } from "@repo/domain/offers";

export const BOXES = ["all", "received", "sent"] as const;
export type Box = (typeof BOXES)[number];

/** One Offer the Account is party to, and which side of it the Account is on. */
export type Entry =
  | {
      readonly direction: "received";
      readonly offer: ReceivedOffer;
      readonly exchange?: ContactExchange | undefined;
    }
  | {
      readonly direction: "sent";
      readonly offer: SentOffer;
      readonly exchange?: ContactExchange | undefined;
    };

/** What the reads returned, together — `mailbox.ts` is what reads it. */
export interface MailboxData {
  readonly received: readonly ReceivedOffer[];
  readonly sent: readonly SentOffer[];
  /** Every Contact Exchange the Account is party to, on either side. */
  readonly exchanges: readonly ContactExchange[];
  /** Only decides which empty state she meets: an Offer is addressed to a profile. */
  readonly hasProfile: boolean;
  /** Read once, so every row on the screen agrees about what _hace 2 días_ means. */
  readonly now: Date;
}

export interface MailboxView {
  readonly sides: { readonly received: boolean; readonly sent: boolean };
  /** Both sides: the three folders. One side or none: no folders. */
  readonly folders: boolean;
  /** The folder shown — what the address asked for, where the Account has it. */
  readonly box: Box;
  /** The folder's Offers, newest first. */
  readonly entries: readonly Entry[];
  readonly opened: Entry | undefined;
  /** Anything has reached her, whichever folder is shown. */
  readonly hasReceived: boolean;
  /** Received Offers still waiting on her answer. Never a count of sent ones. */
  readonly waiting: number;
  readonly hasProfile: boolean;
  readonly now: Date;
}

/** What one request adds to the view: what the address says just happened. */
export interface MailboxPage extends MailboxView {
  /** The sentence an answer to the opened Offer landed with. */
  readonly arrival?: string | undefined;
  /** This render followed her acceptance: the Contact Exchange is announced instead. */
  readonly justAccepted?: boolean;
  /** He has just sent one: the three-clause confirmation leads the list. */
  readonly justSent?: boolean;
}

export interface MailboxRequest {
  /** `?box=`, as it arrived: absent, repeated or unknown all fall back. */
  readonly box?: string | readonly string[] | undefined;
  /** The `[id]` segment, where there is one. */
  readonly open?: string | undefined;
}

function isBox(value: unknown): value is Box {
  return typeof value === "string" && (BOXES as readonly string[]).includes(value);
}

/**
 * A folder's query, for every link that returns to one: nothing for _Todas_,
 * which is `/offers` itself.
 */
export function boxQuery(box: Box): string {
  return box === "all" ? "" : `?box=${box}`;
}

/** The folder shown: one side has no choice to make, and both default to all. */
function boxFor(sides: MailboxView["sides"], asked: MailboxRequest["box"]): Box {
  if (sides.received && !sides.sent) return "received";
  if (sides.sent && !sides.received) return "sent";

  return isBox(asked) ? asked : "all";
}

export function viewMailbox(mailbox: MailboxData, request: MailboxRequest): MailboxView {
  // Keyed by side as well as Offer: an exchange belongs to the entry on its own
  // side, and never to a row on the other side that happens to share its id.
  const exchangeOn = (side: ContactExchange["side"], offerId: string) =>
    mailbox.exchanges.find((exchange) => exchange.side === side && exchange.offerId === offerId);

  const received: Entry[] = mailbox.received.map((offer) => ({
    direction: "received",
    offer,
    exchange: exchangeOn("worker", offer.id),
  }));
  const sent: Entry[] = mailbox.sent.map((offer) => ({
    direction: "sent",
    offer,
    exchange: exchangeOn("hirer", offer.id),
  }));

  const sides = {
    received: mailbox.hasProfile || received.length > 0,
    sent: sent.length > 0,
  };
  const box = boxFor(sides, request.box);
  const everything = [...received, ...sent].toSorted(
    (a, b) => b.offer.sentAt.getTime() - a.offer.sentAt.getTime(),
  );

  return {
    sides,
    folders: sides.received && sides.sent,
    box,
    entries: box === "all" ? everything : everything.filter((entry) => entry.direction === box),
    opened:
      request.open === undefined
        ? undefined
        : everything.find((entry) => entry.offer.id === request.open),
    hasReceived: received.length > 0,
    waiting: mailbox.received.filter((offer) => offer.state === "delivered").length,
    hasProfile: mailbox.hasProfile,
    now: mailbox.now,
  };
}
