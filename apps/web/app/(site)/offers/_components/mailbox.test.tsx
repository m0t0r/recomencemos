/**
 * The page once the read has resolved: the folders, the list, the Offer she
 * opened, and the states around them — found the way a person reaches them,
 * through the accessibility tree.
 *
 * What is drawn is decided by `viewMailbox`, which has its own table; these
 * cases drive it from the same data a request would, so a row here is a page a
 * person could actually be looking at.
 */

import type { ContactExchange } from "@repo/domain/exchange";
import type { ReceivedOffer, SentOffer } from "@repo/domain/offers";
import { render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { type MailboxData, type MailboxPage, viewMailbox } from "../_lib/mailbox-view";
import {
  CONTACT_INSIDE,
  FOLDER_LABELS,
  FOLDERS_LABEL,
  JUST_DECLINED,
  OFFERS_EMPTY_HEADING,
  OFFERS_EMPTY_LINK,
  PANE_PLACEHOLDER,
  RECEIVED_OFFERS_EMPTY_HEADING,
  RECEIVED_OFFERS_EMPTY_LINK,
  RECEIVED_OFFERS_NO_PROFILE_LINK,
  waitingCount,
} from "../_lib/messages";
import {
  OFFER_JUST_SENT_HEADING,
  OFFER_PROFILE_LINK,
  OFFER_REVIEW_DELAYED,
  OFFER_STATE_SENTENCES,
} from "../_lib/sent-messages";
import { Mailbox, MailboxLead } from "./mailbox";

const { acceptOffer, declineOffer } = vi.hoisted(() => ({
  acceptOffer: vi.fn(),
  declineOffer: vi.fn(),
}));

vi.mock("../actions", () => ({ acceptOffer, declineOffer }));

const NOW = new Date("2026-09-14T12:00:00Z");

const WAITING = "0192a3b4-0000-7000-8000-000000000001";
const ACCEPTED = "0192a3b4-0000-7000-8000-000000000002";
const PENDING = "0192a3b4-0000-7000-8000-000000000003";

const LONG_WORK = `Necesito ayuda para cocinar el almuerzo de treinta personas en una reunión familiar. ${"Sancocho y arroz, con alguien que sepa manejar ollas grandes. ".repeat(9)}`;

function received(
  id: string,
  state: ReceivedOffer["state"],
  sentAt: string,
  workDescription = "Pintar una habitación",
): ReceivedOffer {
  return {
    id,
    state,
    workDescription,
    payTerms: "180.000 pesos por el día, en efectivo al terminar",
    whenText: "El sábado 19, desde las 8:00 a. m.",
    sentAt: new Date(sentAt),
    hirerName: "Carlos Restrepo",
  };
}

function sent(id: string, reviewDelayed: boolean): SentOffer {
  return {
    id,
    state: "pending_review",
    workDescription: "Cuidar un jardín",
    payTerms: "$60.000 por mañana",
    whenText: "Los lunes",
    sentAt: new Date("2026-09-12T09:00:00Z"),
    reviewDelayed,
    worker: {
      slug: "ana-maria-r",
      firstName: "Ana María",
      lastInitial: "R",
      city: "pereira",
      headline: "Cocino para eventos y cuido jardines",
      skills: [],
      photoUrl: null,
      publishedAt: new Date("2026-08-20T12:00:00Z"),
    },
  };
}

const EXCHANGE: ContactExchange = {
  offerId: ACCEPTED,
  side: "worker",
  exchangedAt: NOW,
  counterpart: {
    fullName: "Carlos Restrepo",
    phone: "+573105558899",
    email: "carlos.sentinel@recomencemos.test",
  },
  own: {
    fullName: "Ana María Restrepo Gómez",
    phone: "+573001234567",
    email: "ana.sentinel@recomencemos.test",
  },
  copy: "sent",
};

/** An Account on both sides: two Offers reached her, and she sent one. */
const BOTH: MailboxData = {
  received: [
    received(WAITING, "delivered", "2026-09-13T09:00:00Z", LONG_WORK),
    received(ACCEPTED, "accepted", "2026-09-10T09:00:00Z"),
  ],
  sent: [sent(PENDING, true)],
  exchanges: [EXCHANGE],
  hasProfile: true,
  now: NOW,
};

function page(
  data: Partial<MailboxData> = {},
  request: Parameters<typeof viewMailbox>[1] = {},
  extra: Partial<MailboxPage> = {},
): MailboxPage {
  return { ...viewMailbox({ ...BOTH, ...data }, request), ...extra };
}

function list(box: keyof typeof FOLDER_LABELS = "all") {
  return screen.getByRole("region", { name: FOLDER_LABELS[box] });
}

describe("the folders", () => {
  it("are three plain links for an Account on both sides, the one shown marked current", () => {
    render(<Mailbox view={page()} />);

    const folders = within(screen.getByRole("navigation", { name: FOLDERS_LABEL }));
    const links = folders.getAllByRole("link");

    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      [FOLDER_LABELS.all, "/offers"],
      [FOLDER_LABELS.received, "/offers?box=received"],
      [FOLDER_LABELS.sent, "/offers?box=sent"],
    ]);
    expect(folders.getByRole("link", { name: FOLDER_LABELS.all })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(folders.getByRole("link", { name: FOLDER_LABELS.sent })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("are absent for an Account on one side", () => {
    render(<Mailbox view={page({ sent: [] })} />);

    expect(screen.queryByRole("navigation", { name: FOLDERS_LABEL })).toBeNull();
    expect(list("received")).toBeInTheDocument();
  });
});

describe("a row", () => {
  it("names which way the Offer went before anything else", () => {
    render(<Mailbox view={page()} />);

    const names = within(list())
      .getAllByRole("link")
      .map((link) => link.textContent ?? "");

    expect(names).toHaveLength(3);
    expect(names.map((name) => name.split(" ")[0])).toEqual(["De", "Para", "De"]);
  });

  it("is one heading per Offer, under the list's own", () => {
    render(<Mailbox view={page()} />);

    expect(within(list()).getAllByRole("heading", { level: 3 })).toHaveLength(3);
  });

  /** A screen reader listing links hears a row, not the whole description. */
  it("has a short accessible name, and the pay in full", () => {
    render(<Mailbox view={page()} />);

    const row = within(list()).getAllByRole("link")[0];

    expect(row?.textContent?.length ?? 0).toBeLessThan(LONG_WORK.length / 2);
    expect(row).toHaveTextContent("180.000 pesos por el día, en efectivo al terminar");
  });

  it("links to its Offer, keeping the folder it was opened from", () => {
    render(<Mailbox view={page({}, { box: "sent" })} />);

    expect(within(list("sent")).getByRole("link")).toHaveAttribute(
      "href",
      `/offers/${PENDING}?box=sent`,
    );
  });

  it("says, shut, that an accepted Offer holds the contact", () => {
    render(<Mailbox view={page()} />);

    const rows = within(list()).getAllByRole("link");

    expect(rows.map((row) => row.textContent?.includes(CONTACT_INSIDE))).toEqual([
      false,
      false,
      true,
    ]);
  });
});

describe("the opened Offer", () => {
  it("is not there until one is opened", () => {
    render(<Mailbox view={page()} />);

    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.getByText(PANE_PLACEHOLDER)).toBeInTheDocument();
  });

  it("carries the answer while it waits on her, and a way back to its list", () => {
    render(<Mailbox view={page({}, { open: WAITING })} />);

    const offer = within(screen.getByRole("article", { name: "Firma como Carlos Restrepo" }));

    expect(offer.getByRole("button", { name: "Aceptar" })).toBeInTheDocument();
    expect(offer.getByRole("button", { name: "No aceptar" })).toBeInTheDocument();
    expect(offer.getByRole("link", { name: "Volver a Todas" })).toHaveAttribute("href", "/offers");
    expect(within(list()).getAllByRole("link")[0]).toHaveAttribute("aria-current", "page");
  });

  it("offers no answer once one was given", () => {
    render(<Mailbox view={page({}, { open: ACCEPTED })} />);

    expect(
      within(screen.getByRole("article")).queryByRole("button", { name: "Aceptar" }),
    ).toBeNull();
  });

  it("holds the result of her answer", () => {
    render(<Mailbox view={page({}, { open: WAITING }, { arrival: JUST_DECLINED })} />);

    expect(within(screen.getByRole("article")).getByText(JUST_DECLINED)).toBeInTheDocument();
  });

  /** A delayed review gains a line: _still waiting_ and _taking longer_ are two facts. */
  it("says where a sent one is, that it is taking longer, and whose profile it went to", () => {
    render(<Mailbox view={page({}, { open: PENDING })} />);

    const offer = within(screen.getByRole("article", { name: "Para Ana María R." }));

    expect(offer.getByText(OFFER_STATE_SENTENCES.pending_review)).toBeInTheDocument();
    expect(offer.getByText(OFFER_REVIEW_DELAYED)).toBeInTheDocument();
    expect(offer.getByRole("link", { name: OFFER_PROFILE_LINK })).toHaveAttribute(
      "href",
      "/profile/ana-maria-r",
    );
    expect(offer.queryByRole("button")).toBeNull();
  });

  /** Two answer regions or two panes on one page would share an id; nothing may. */
  it("leaves every element on the page its own id", () => {
    const html = renderToStaticMarkup(<Mailbox view={page({}, { open: WAITING })} />);
    const ids = [...html.matchAll(/\sid="([^"]*)"/g)].map(([, id]) => id);

    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("the heading block", () => {
  it("says how many wait on her while anything has reached her", () => {
    render(<MailboxLead view={page()} />);

    expect(screen.getByText(waitingCount(1))).toBeInTheDocument();
  });

  it("counts nothing under the sent folder, whose lead is about what he sent", () => {
    render(<MailboxLead view={page({}, { box: "sent" })} />);

    expect(screen.queryByText(waitingCount(1))).toBeNull();
  });

  it("counts nothing for an Account that only sent", () => {
    render(<MailboxLead view={page({ received: [], hasProfile: false })} />);

    expect(screen.queryByText(waitingCount(0))).toBeNull();
  });
});

describe("an empty page", () => {
  /** Either kind of person can be here, so both ways out are offered. */
  it("routes to publishing and to the list of people, with nothing either way", () => {
    render(<Mailbox view={page({ received: [], sent: [], hasProfile: false })} />);

    expect(screen.getByRole("heading", { name: OFFERS_EMPTY_HEADING })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: RECEIVED_OFFERS_NO_PROFILE_LINK })).toHaveAttribute(
      "href",
      "/publish",
    );
    expect(screen.getByRole("link", { name: OFFERS_EMPTY_LINK })).toHaveAttribute(
      "href",
      "/profiles",
    );
  });

  it("says what makes an Offer arrive when her received folder is empty", () => {
    render(<Mailbox view={page({ received: [] }, { box: "received" })} />);

    expect(
      screen.getByRole("heading", { name: RECEIVED_OFFERS_EMPTY_HEADING }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: RECEIVED_OFFERS_EMPTY_LINK })).toHaveAttribute(
      "href",
      "/my-profile",
    );
  });
});

describe("after he sends", () => {
  it("leads the list with the confirmation", () => {
    render(<Mailbox view={page({}, { box: "sent" }, { justSent: true })} />);

    expect(screen.getByText(OFFER_JUST_SENT_HEADING)).toBeInTheDocument();
  });

  it("says nothing of it on any other arrival", () => {
    render(<Mailbox view={page({}, { box: "sent" })} />);

    expect(screen.queryByText(OFFER_JUST_SENT_HEADING)).toBeNull();
  });
});
