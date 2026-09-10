/**
 * The two Offer projections, under the same sentinel discipline NFR10 puts on
 * the three profile shapes — because the question is identical and it is asked
 * about a different person.
 *
 * **The count that matters is the Hirer's phone: zero, both ways.** It is
 * `personal`, self-asserted, and held on his Account, and it crosses at Contact
 * Exchange and nowhere earlier — the same rule her number is held to. A field
 * added to `OfferRecord` reaches neither output until somebody writes it in, and
 * this file is where that would be noticed.
 *
 * Counting is over the serialised output, deliberately: the question is what
 * crosses a boundary, and a boundary is a serializer.
 */

import { type OfferRecord, type PublicProfile, toReceivedOffer, toSentOffer } from "#projections";

const SENTINELS = {
  hirerName: "SENTINEL_HIRER_NAME",
  hirerPhone: "SENTINEL_HIRER_PHONE",
  workDescription: "SENTINEL_WORK_DESCRIPTION",
  payTerms: "SENTINEL_PAY_TERMS",
  whenText: "SENTINEL_WHEN_TEXT",
  workerSlug: "SENTINEL_WORKER_SLUG",
} as const;

const worker: PublicProfile = {
  slug: SENTINELS.workerSlug,
  firstName: "Ana",
  lastInitial: "R",
  city: "pereira",
  headline: "Cocino almuerzos para eventos",
  skills: [{ slug: "home-cooking", labelEs: "Cocinar almuerzos y comida casera" }],
  photoUrl: null,
  publishedAt: new Date("2026-09-02T12:00:00Z"),
};

const SENT_AT = new Date("2026-09-08T10:00:00.000Z");

const record: OfferRecord = {
  id: "0199a1f0-2b3c-7def-8000-0123456789ab",
  state: "pending_review",
  workDescription: SENTINELS.workDescription,
  payTerms: SENTINELS.payTerms,
  whenText: SENTINELS.whenText,
  sentAt: SENT_AT,
  deliveredAt: null,
  worker,
  hirerName: SENTINELS.hirerName,
  hirerPhone: SENTINELS.hirerPhone,
};

function count(output: unknown, sentinel: string): number {
  return JSON.stringify(output).split(sentinel).length - 1;
}

describe("what an Offer carries to its sender", () => {
  const sent = toSentOffer(record, SENT_AT);

  it("carries the terms he wrote and the person he wrote them to", () => {
    expect(count(sent, SENTINELS.workDescription)).toBe(1);
    expect(count(sent, SENTINELS.payTerms)).toBe(1);
    expect(count(sent, SENTINELS.whenText)).toBe(1);
    expect(count(sent, SENTINELS.workerSlug)).toBe(1);
  });

  it("carries neither of his own asserted fields, because he already has them", () => {
    expect(count(sent, SENTINELS.hirerName)).toBe(0);
    expect(count(sent, SENTINELS.hirerPhone)).toBe(0);
  });

  it("says the review is on time inside the window and late at it", () => {
    const window = 24 * 60 * 60 * 1000;

    expect(toSentOffer(record, new Date(SENT_AT.getTime() + window - 1)).reviewDelayed).toBe(false);
    expect(toSentOffer(record, new Date(SENT_AT.getTime() + window)).reviewDelayed).toBe(true);
  });

  it("says nothing is late once a person has read it, however long that took", () => {
    const delivered = { ...record, deliveredAt: new Date(SENT_AT.getTime() + 90 * 60 * 60 * 1000) };

    expect(toSentOffer(delivered, new Date("2027-01-01T00:00:00Z")).reviewDelayed).toBe(false);
  });
});

describe("what an Offer carries to the person it is for", () => {
  const received = toReceivedOffer(record);

  it("carries the terms and the name he asserted", () => {
    expect(count(received, SENTINELS.workDescription)).toBe(1);
    expect(count(received, SENTINELS.hirerName)).toBe(1);
  });

  /**
   * The one number this file exists to count. It is on the record, it is on his
   * Account, and it reaches her at Contact Exchange — which is the moment she
   * chose, and this is not it.
   */
  it("carries no phone number of his", () => {
    expect(count(received, SENTINELS.hirerPhone)).toBe(0);
  });

  /** She wrote her own profile; an Offer she received says nothing about her. */
  it("carries nothing about her", () => {
    expect(count(received, SENTINELS.workerSlug)).toBe(0);
  });

  /**
   * **Membership, which is the contract's own definition of a projection:**
   * exactly these keys on the wire, so a field added to the record reaches her
   * only once somebody writes it in here. The sentinel counts above catch the
   * fields that exist today; this catches the one somebody adds tomorrow.
   */
  it("carries exactly the contract's keys and nothing that crosses only at exchange", () => {
    expect(Object.keys(received).toSorted()).toEqual(
      ["hirerName", "id", "payTerms", "sentAt", "state", "whenText", "workDescription"].toSorted(),
    );
  });

  it("passes an absent name through as absent rather than as an empty string", () => {
    expect(toReceivedOffer({ ...record, hirerName: null }).hirerName).toBeNull();
  });
});

describe("both projections", () => {
  it.each([
    ["sent", (input: OfferRecord) => toSentOffer(input, SENT_AT)],
    ["received", toReceivedOffer],
  ])("%s defines no toJSON and is a plain object", (_name, project) => {
    const output = project(record);

    expect(Object.getPrototypeOf(output)).toBe(Object.prototype);
    expect("toJSON" in output).toBe(false);
  });

  /**
   * The `CHECK` makes this unreachable through the schema, so reaching it means
   * something wrote to the table from outside this package — and showing an
   * Offer as `pending_review` because its real state was unreadable would tell a
   * person something false about a decision that is hers.
   */
  it.each([
    ["sent", (input: OfferRecord) => toSentOffer(input, SENT_AT)],
    ["received", toReceivedOffer],
  ])("%s refuses a state this product does not have", (_name, project) => {
    expect(() => project({ ...record, state: "entregada" })).toThrow(TypeError);
  });
});
