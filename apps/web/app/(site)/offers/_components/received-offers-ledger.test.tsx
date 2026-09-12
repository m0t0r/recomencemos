/**
 * The ledger's markup: which row a link opens, where an answer can be given,
 * and that a page of rows still carries one `id` per element.
 *
 * **Read as the string React sends**, because a native `<details>` and its
 * `open` attribute are what the delivery email's link relies on, and happy-dom's
 * accessibility tree reports neither. Everything asserted is counted per row, so
 * a ledger that rendered nothing cannot pass by finding nothing.
 */

import type { ContactExchange } from "@repo/domain/exchange";
import type { ReceivedOffer, ReceivedOfferState } from "@repo/domain/offers";
import { renderToStaticMarkup } from "react-dom/server";
import { urlAttributesIn } from "@/testing/markup";
import { JUST_ACCEPTED, JUST_DECLINED, RECEIVED_OFFERS_EMPTY_HEADING } from "../_lib/messages";
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

const ACCEPTED_ID = "0192a3b4-0000-7000-8000-000000000003";
const DECLINED_ID = "0192a3b4-0000-7000-8000-000000000004";

/** What crossed on the accepted row, as she reads it. */
const EXCHANGE: ContactExchange = {
  offerId: ACCEPTED_ID,
  exchangedAt: NOW,
  side: "worker",
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

function render(overrides: Partial<Parameters<typeof ReceivedOffersLedger>[0]> = {}): string {
  return renderToStaticMarkup(
    <ReceivedOffersLedger offers={OFFERS} exchanges={[]} hasProfile now={NOW} {...overrides} />,
  );
}

/**
 * Each row, whole, in document order — split on the list item rather than on
 * `<details>`, because an accepted row nests a second disclosure (its folded
 * terms) and a non-greedy match on `</details>` would end the row there.
 */
function rowsIn(html: string): string[] {
  return [...html.matchAll(/<li>[\s\S]*?<\/li>/g)].map(([row]) => row);
}

/** Whether a row's own disclosure — its first `<details>` — is open. */
function isOpen(row: string): boolean {
  return /<details[^>]*\sopen=""/.test(/<details[^>]*>/.exec(row)?.[0] ?? "");
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

describe("an accepted row", () => {
  it("holds the Contact Exchange, and no other row does", () => {
    const rows = rowsIn(render({ exchanges: [EXCHANGE] }));

    expect(rows.map((row) => row.includes(EXCHANGE.counterpart.email))).toEqual([
      false,
      false,
      true,
      false,
      false,
    ]);
  });

  /**
   * **Both sides' details, once** — the success state. The name is left out of
   * the count because his declared name is also the row's signature, which is
   * story 8's and says something else about it.
   */
  it("carries each side's phone and address exactly once", () => {
    const html = render({ exchanges: [EXCHANGE] });

    for (const detail of [
      "310 555 8899",
      EXCHANGE.counterpart.email,
      "300 123 4567",
      EXCHANGE.own.email,
    ]) {
      expect(html.split(detail).length - 1, detail).toBe(1);
    }
  });

  /** A `tel:` or `mailto:` built from what somebody typed is an href from user text. */
  it("builds no link from a detail", () => {
    const urls = urlAttributesIn(render({ exchanges: [EXCHANGE] }));

    expect(urls.filter((url) => /^(tel|mailto):/i.test(url))).toEqual([]);
  });

  /**
   * Right after she accepts, the exchange is what is announced — its heading
   * takes focus and its details arrive in a status region, which the panel's
   * own test finds through the accessibility tree — so the arrival sentence
   * does not also ask for her attention.
   */
  it("says no arrival sentence of its own, right after she accepts", () => {
    const html = render({
      exchanges: [EXCHANGE],
      open: { id: ACCEPTED_ID, arrival: JUST_ACCEPTED, justAccepted: true },
    });

    expect(rowsIn(html)[2]).not.toContain(JUST_ACCEPTED);
  });

  /**
   * The card leads; what she agreed to is one tap away beneath it, and shut.
   * Read as markup because a native `<details>` and its `open` are what the
   * accessibility tree under happy-dom does not report.
   */
  it("folds the terms under the card, shut", () => {
    const accepted = rowsIn(render({ exchanges: [EXCHANGE], open: { id: ACCEPTED_ID } }))[2] ?? "";

    // The work also leads the shut summary, above everything, so the order that
    // means something is the card against the fold that holds the terms.
    expect(accepted.indexOf(EXCHANGE.counterpart.email)).toBeLessThan(
      accepted.indexOf("Lo que aceptaste"),
    );
    expect(accepted).toMatch(/<details[^>]*>\s*<summary[^>]*>Lo que aceptaste/);
    expect(accepted).not.toMatch(/<details[^>]*open=""[^>]*>\s*<summary[^>]*>Lo que aceptaste/);
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
