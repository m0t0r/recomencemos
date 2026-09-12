/**
 * The ledger's markup: which row a link opens, where an answer can be given,
 * and that a page of rows still carries one `id` per element.
 *
 * **Read as the string React sends**, because a native `<details>` and its
 * `open` attribute are what the delivery email's link relies on, and happy-dom's
 * accessibility tree reports neither. Everything asserted is counted per row, so
 * a ledger that rendered nothing cannot pass by finding nothing.
 */

import type { ReceivedOffer, ReceivedOfferState } from "@repo/domain/offers";
import { renderToStaticMarkup } from "react-dom/server";
import { urlAttributesIn } from "@/testing/markup";
import { JUST_DECLINED, RECEIVED_OFFERS_EMPTY_HEADING } from "../_lib/messages";
import { ReceivedOffersLedger } from "./received-offers-ledger";

const { acceptOffer, declineOffer } = vi.hoisted(() => ({
  acceptOffer: vi.fn(),
  declineOffer: vi.fn(),
}));

vi.mock("../actions", () => ({ acceptOffer, declineOffer }));

const NOW = new Date("2026-09-12T12:00:00Z");

function received(id: string, state: ReceivedOfferState, workDescription: string): ReceivedOffer {
  return {
    id,
    state,
    workDescription,
    payTerms: "$80.000 por el día",
    whenText: "El sábado 19, desde las 8:00 a. m.",
    sentAt: new Date("2026-09-10T09:00:00Z"),
    hirerName: "Carlos Restrepo",
  };
}

const OFFERS: readonly ReceivedOffer[] = [
  received("0192a3b4-0000-7000-8000-000000000001", "delivered", "Pintar una habitación"),
  received("0192a3b4-0000-7000-8000-000000000002", "delivered", "Arreglar la puerta del patio"),
  received("0192a3b4-0000-7000-8000-000000000003", "accepted", "Cocinar para un almuerzo"),
  received("0192a3b4-0000-7000-8000-000000000004", "declined", "Cuidar un jardín"),
  received("0192a3b4-0000-7000-8000-000000000005", "expired", "Coser cuatro cortinas"),
];

const DECLINED_ID = "0192a3b4-0000-7000-8000-000000000004";

function render(overrides: Partial<Parameters<typeof ReceivedOffersLedger>[0]> = {}): string {
  return renderToStaticMarkup(
    <ReceivedOffersLedger offers={OFFERS} hasProfile now={NOW} {...overrides} />,
  );
}

/** Each row's `<details>`, whole, in document order. No row nests another. */
function rowsIn(html: string): string[] {
  return [...html.matchAll(/<details[\s\S]*?<\/details>/g)].map(([row]) => row);
}

function isOpen(row: string): boolean {
  return /^<details[^>]*\sopen=""/.test(row);
}

describe("the ledger", () => {
  it("renders every Offer that reached her as a row", () => {
    expect(rowsIn(render())).toHaveLength(OFFERS.length);
  });

  it("opens no row when no Offer is named", () => {
    expect(rowsIn(render()).map(isOpen)).toEqual([false, false, false, false, false]);
  });

  /** The email's `/offers/<id>` — that Offer open, and only that one. */
  it("opens exactly the row a link names", () => {
    expect(rowsIn(render({ open: { id: DECLINED_ID } })).map(isOpen)).toEqual([
      false,
      false,
      false,
      true,
      false,
    ]);
  });

  /** An answered or expired Offer shows its state and no controls. */
  it("offers an answer only on a row still waiting for one", () => {
    expect(rowsIn(render()).map((row) => row.includes("<form"))).toEqual([
      true,
      true,
      false,
      false,
      false,
    ]);
  });

  /** After a decision she lands on her row, with the result in it rather than above the page. */
  it("puts the result of an answer inside the row it answered", () => {
    const rows = rowsIn(render({ open: { id: DECLINED_ID, arrival: JUST_DECLINED } }));

    expect(rows.map((row) => row.includes(JUST_DECLINED))).toEqual([
      false,
      false,
      false,
      true,
      false,
    ]);
  });

  /**
   * Two waiting rows are two answer regions on one page. An `id` repeated
   * between them would label one row's controls with the other's heading.
   */
  it("gives every element on the page its own id", () => {
    const ids = [...render().matchAll(/\sid="([^"]*)"/g)].map(([, id]) => id);

    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("an empty ledger", () => {
  it("says what makes an Offer arrive, and routes to her profile", () => {
    const html = render({ offers: [] });

    expect(html).toContain(RECEIVED_OFFERS_EMPTY_HEADING);
    expect(rowsIn(html)).toEqual([]);
    expect(urlAttributesIn(html)).toEqual(["/my-profile"]);
  });

  it("routes to publishing when she has no profile yet", () => {
    expect(urlAttributesIn(render({ offers: [], hasProfile: false }))).toEqual(["/publish"]);
  });
});
