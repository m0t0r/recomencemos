/**
 * Which folders an Account sees, which list is shown, and which Offer is open —
 * decided once, from what the reads returned and what the address asked for.
 *
 * Pure, so every case is a row of data rather than a rendered page: the page
 * only draws what this returns.
 */

import type { ContactExchange } from "@repo/domain/exchange";
import type { ReceivedOffer, SentOffer } from "@repo/domain/offers";
import { boxQuery, type MailboxData, viewMailbox } from "./mailbox-view";

const NOW = new Date("2026-09-14T12:00:00Z");

function received(id: string, sentAt: string, state: ReceivedOffer["state"] = "delivered") {
  return {
    id,
    state,
    workDescription: `Trabajo ${id}`,
    payTerms: "$80.000 por el día",
    whenText: "El sábado",
    sentAt: new Date(sentAt),
    hirerName: "Carlos Restrepo",
  } satisfies ReceivedOffer;
}

function sent(id: string, sentAt: string, state: SentOffer["state"] = "pending_review") {
  return {
    id,
    state,
    workDescription: `Trabajo ${id}`,
    payTerms: "$80.000 por el día",
    whenText: "El sábado",
    sentAt: new Date(sentAt),
    reviewDelayed: false,
    worker: {
      slug: "ana-maria-r",
      firstName: "Ana María",
      lastInitial: "R",
      city: "pereira",
      headline: "Cocino para eventos",
      skills: [],
      photoUrl: null,
      publishedAt: new Date("2026-08-20T12:00:00Z"),
    },
  } satisfies SentOffer;
}

function exchange(offerId: string, side: ContactExchange["side"]): ContactExchange {
  const person = { fullName: "Persona", phone: "+573001234567", email: "p@recomencemos.test" };

  return { offerId, side, exchangedAt: NOW, counterpart: person, own: person, copy: "sent" };
}

function mailbox(overrides: Partial<MailboxData> = {}): MailboxData {
  return { received: [], sent: [], exchanges: [], hasProfile: false, now: NOW, ...overrides };
}

const BOTH = mailbox({
  hasProfile: true,
  received: [received("r-old", "2026-09-10T09:00:00Z"), received("r-new", "2026-09-13T09:00:00Z")],
  sent: [sent("s-mid", "2026-09-12T09:00:00Z")],
});

function ids(view: ReturnType<typeof viewMailbox>): string[] {
  return view.entries.map((entry) => entry.offer.id);
}

describe("an Account that both received and sent", () => {
  it("sees the folders and lands on every Offer, newest first", () => {
    const view = viewMailbox(BOTH, {});

    expect(view.folders).toBe(true);
    expect(view.box).toBe("all");
    expect(ids(view)).toEqual(["r-new", "s-mid", "r-old"]);
  });

  it.each([
    ["received", ["r-new", "r-old"]],
    ["sent", ["s-mid"]],
    ["all", ["r-new", "s-mid", "r-old"]],
  ])("reads the %s folder from the address", (box, expected) => {
    const view = viewMailbox(BOTH, { box });

    expect(view.box).toBe(box);
    expect(ids(view)).toEqual(expected);
  });

  it.each([["inbox"], [["sent", "received"]], [""]])(
    "falls back to every Offer for a folder it does not know: %j",
    (box) => {
      expect(viewMailbox(BOTH, { box }).box).toBe("all");
    },
  );

  it("labels each entry with its direction", () => {
    expect(viewMailbox(BOTH, {}).entries.map((entry) => entry.direction)).toEqual([
      "received",
      "sent",
      "received",
    ]);
  });
});

describe("an Account with one side", () => {
  it("with a profile and nothing sent sees its received list and no folders", () => {
    const view = viewMailbox(mailbox({ hasProfile: true }), { box: "sent" });

    expect(view.folders).toBe(false);
    expect(view.box).toBe("received");
    expect(view.sides).toEqual({ received: true, sent: false });
  });

  it("with only sent Offers sees its sent list and no folders", () => {
    const view = viewMailbox(mailbox({ sent: [sent("s", "2026-09-12T09:00:00Z")] }), {
      box: "received",
    });

    expect(view.folders).toBe(false);
    expect(view.box).toBe("sent");
    expect(ids(view)).toEqual(["s"]);
  });

  /** A profile taken down leaves Offers that reached it; they are still hers. */
  it("counts an Offer that reached her as the received side, profile or not", () => {
    const view = viewMailbox(mailbox({ received: [received("r", "2026-09-12T09:00:00Z")] }), {});

    expect(view.sides.received).toBe(true);
    expect(view.box).toBe("received");
  });

  it("with neither has no side, no folders and no entries", () => {
    const view = viewMailbox(mailbox(), {});

    expect(view.sides).toEqual({ received: false, sent: false });
    expect(view.folders).toBe(false);
    expect(view.entries).toEqual([]);
  });
});

describe("the opened Offer", () => {
  it.each([["r-old"], ["s-mid"]])("finds %s in either direction", (id) => {
    expect(viewMailbox(BOTH, { open: id }).opened?.offer.id).toBe(id);
  });

  it("finds it even when the folder shown does not hold it", () => {
    const view = viewMailbox(BOTH, { box: "sent", open: "r-old" });

    expect(view.opened?.offer.id).toBe("r-old");
    expect(ids(view)).toEqual(["s-mid"]);
  });

  /** Absent from both of her scoped lists is the whole of "not hers". */
  it("is nothing for an id in neither list", () => {
    expect(viewMailbox(BOTH, { open: "somebody-elses" }).opened).toBeUndefined();
  });

  it("is nothing when no id was asked for", () => {
    expect(viewMailbox(BOTH, {}).opened).toBeUndefined();
  });
});

describe("the Contact Exchange on an entry", () => {
  /**
   * An Account on both sides is party to exchanges in both directions. Each
   * belongs to the entry on its own side, never to a row it happens to share an
   * id with.
   */
  it("attaches each side's exchange to that side's entry only", () => {
    const view = viewMailbox(
      { ...BOTH, exchanges: [exchange("r-old", "worker"), exchange("s-mid", "hirer")] },
      {},
    );

    expect(view.entries.map((entry) => entry.exchange?.side)).toEqual([
      undefined,
      "hirer",
      "worker",
    ]);
  });

  it("ignores an exchange on the wrong side of an entry", () => {
    const view = viewMailbox({ ...BOTH, exchanges: [exchange("r-old", "hirer")] }, {});

    expect(view.entries.every((entry) => entry.exchange === undefined)).toBe(true);
  });
});

describe("the waiting count", () => {
  it("counts only received Offers still waiting on her", () => {
    const view = viewMailbox(
      mailbox({
        hasProfile: true,
        received: [
          received("a", "2026-09-10T09:00:00Z", "delivered"),
          received("b", "2026-09-10T09:00:00Z", "accepted"),
        ],
        sent: [sent("c", "2026-09-10T09:00:00Z", "delivered")],
      }),
      { box: "sent" },
    );

    expect(view.waiting).toBe(1);
  });
});

describe("a folder's query", () => {
  /** _Todas_ is `/offers` itself, so a link back to it carries nothing. */
  it.each([
    ["all", ""],
    ["received", "?box=received"],
    ["sent", "?box=sent"],
  ] as const)("is %j for %s", (box, query) => {
    expect(boxQuery(box)).toBe(query);
  });
});
