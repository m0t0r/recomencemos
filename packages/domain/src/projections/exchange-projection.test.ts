/**
 * The Contact Exchange as each party reads it, counted the way `projections.test.ts`
 * counts a profile: sentinels in the record, occurrences in the serialised output.
 *
 * **Each side's three details reach the view exactly once**, because the
 * success state says "both sides' details, once", and because the copy state
 * that reaches a viewer is **their own** — telling him that her email failed
 * would be telling him something about her inbox.
 */

import { type ExchangeRecord, toContactExchange } from "#projections";

const WORKER = {
  fullName: "SENTINEL_WORKER_NAME",
  phone: "SENTINEL_WORKER_PHONE",
  email: "SENTINEL_WORKER_EMAIL",
} as const;

const HIRER = {
  fullName: "SENTINEL_HIRER_NAME",
  phone: "SENTINEL_HIRER_PHONE",
  email: "SENTINEL_HIRER_EMAIL",
} as const;

const record: ExchangeRecord = {
  offerId: "0199a1f0-2b3c-7def-8000-0123456789ab",
  exchangedAt: new Date("2026-09-12T15:00:00Z"),
  worker: WORKER,
  hirer: HIRER,
  workerCopy: "sent",
  hirerCopy: "failed",
};

function count(output: unknown, sentinel: string): number {
  return JSON.stringify(output).split(sentinel).length - 1;
}

describe.each([
  ["worker", WORKER, HIRER, "sent"],
  ["hirer", HIRER, WORKER, "failed"],
] as const)("read by the %s", (side, own, counterpart, copy) => {
  const view = toContactExchange(record, side);

  it("carries each of the six details exactly once", () => {
    for (const detail of [...Object.values(WORKER), ...Object.values(HIRER)]) {
      expect(count(view, detail), detail).toBe(1);
    }
  });

  it("puts the other side's details as the counterpart and the viewer's as their own", () => {
    expect(view.counterpart).toEqual(counterpart);
    expect(view.own).toEqual(own);
  });

  it("carries the viewer's own copy state, and not the other side's", () => {
    expect(view.copy).toBe(copy);
  });

  it("carries exactly the contract's keys, and defines no toJSON", () => {
    expect(Object.keys(view).toSorted()).toEqual(
      ["copy", "counterpart", "exchangedAt", "offerId", "own", "side"].toSorted(),
    );
    expect(Object.getPrototypeOf(view)).toBe(Object.prototype);
    expect("toJSON" in view).toBe(false);
  });
});

/** An Offer written before the platform asked senders to name themselves (C4). */
it("keeps a Hirer who gave no name or number as null, rather than as an empty string", () => {
  const view = toContactExchange(
    { ...record, hirer: { ...HIRER, fullName: null, phone: null } },
    "worker",
  );

  expect(view.counterpart).toEqual({ fullName: null, phone: null, email: HIRER.email });
});
