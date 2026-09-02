/**
 * Seam 2 for `./rate-limit` — and the answer to the question the ticket asked
 * before any of this was written.
 *
 * The comment on [#12](https://github.com/m0t0r/recomencemos/issues/12) named the
 * gap: `#connection`'s `db()` and seam 2's `restoreDatabase()` build different
 * Drizzle instances of different types, nothing joined them, and a `./rate-limit`
 * written the obvious way would have been **untestable here** — it would have
 * opened a `pg.Pool` against a `DATABASE_URL` that CI does not set and that this
 * repository forbids setting. The test either failed, or reached around the
 * module and asserted on raw SQL, which is the fixture drift
 * `## Testing Decisions` exists to prevent.
 *
 * So this file is the acceptance criterion, literally: **`chargeCeiling` is
 * exercised through its own exported function, against PGlite, with no
 * `DATABASE_URL` set.** `DomainDatabase` in `#database` is what makes that
 * possible and is the shape every later query module copies.
 */

import { eq } from "drizzle-orm";
import { chargeCeiling, CEILINGS, principalKey } from "#rate-limit";
import { rateCounter } from "#schema";
import { test, type TestDatabase } from "#testing/fixtures";

const ana = { scope: "address", id: "ana@example.co" } as const;
const noon = new Date("2026-08-27T12:00:00.000Z");

/**
 * Charge the ceiling `times` times at one instant and return the last outcome.
 *
 * It takes the database rather than closing over a module-level one, which is
 * the same shape `chargeCeiling` itself has and what the `database` fixture
 * requires: the handle now arrives per test, so nothing at module scope holds
 * one.
 */
async function chargeRepeatedly(database: TestDatabase, times: number, at: Date = noon) {
  let outcome = await chargeCeiling(database.db, ana, "requestMagicLink", at);

  for (let charge = 1; charge < times; charge += 1) {
    // Sequential on purpose, and not a missed `Promise.all`: this helper exists
    // to charge a counter a known number of times *in order*, which is what the
    // ceiling counts. Running them together tests something else — and that
    // something else has its own case, "counts concurrent charges without
    // losing any".
    // oxlint-disable-next-line no-await-in-loop
    outcome = await chargeCeiling(database.db, ana, "requestMagicLink", at);
  }

  return outcome;
}

describe("chargeCeiling, against the committed migrations", () => {
  test("allows the first request", async ({ database }) => {
    const outcome = await chargeCeiling(database.db, ana, "requestMagicLink", noon);

    expect(outcome.allowed).toBe(true);
  });

  test("allows exactly five in an hour and refuses the sixth", async ({ database }) => {
    expect((await chargeRepeatedly(database, CEILINGS.requestMagicLink.address.max)).allowed).toBe(
      true,
    );

    const sixth = await chargeCeiling(database.db, ana, "requestMagicLink", noon);
    expect(sixth.allowed).toBe(false);
  });

  test("counts on one row per principal, action and window", async ({ database }) => {
    await chargeRepeatedly(database, 3);

    const rows = await database.db
      .select()
      .from(rateCounter)
      .where(eq(rateCounter.principal, principalKey(ana)));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.count).toBe(3);
  });

  // The upsert is the mechanism. Two statements race, and the race is won by the
  // caller sending the flood the ceiling exists to bound.
  test("counts concurrent charges without losing any", async ({ database }) => {
    const outcomes = await Promise.all(
      Array.from({ length: 5 }, () => chargeCeiling(database.db, ana, "requestMagicLink", noon)),
    );

    expect(outcomes.every((outcome) => outcome.allowed)).toBe(true);

    const [row] = await database.db
      .select()
      .from(rateCounter)
      .where(eq(rateCounter.principal, principalKey(ana)));

    expect(row?.count).toBe(5);
  });

  test("does not store the address it is charging", async ({ database }) => {
    await chargeCeiling(database.db, ana, "requestMagicLink", noon);

    const rows = await database.db.select().from(rateCounter);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.principal).not.toContain("ana@example.co");
    expect(rows[0]?.principal).toMatch(/^address:[0-9a-f]{64}$/);
  });

  test("charges one counter however she capitalised her address", async ({ database }) => {
    await chargeCeiling(database.db, ana, "requestMagicLink", noon);
    await chargeCeiling(
      database.db,
      { scope: "address", id: "ANA@Example.CO" },
      "requestMagicLink",
      noon,
    );

    const rows = await database.db.select().from(rateCounter);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.count).toBe(2);
  });

  test("keeps one person's allowance out of another's", async ({ database }) => {
    await chargeRepeatedly(database, 6);

    const other = await chargeCeiling(
      database.db,
      { scope: "address", id: "beatriz@example.co" },
      "requestMagicLink",
      noon,
    );

    expect(other.allowed).toBe(true);
  });

  test("keeps the per-IP allowance separate from the per-address one", async ({ database }) => {
    await chargeRepeatedly(database, 6);

    const byIp = await chargeCeiling(
      database.db,
      { scope: "ip", id: "190.0.2.10" },
      "requestMagicLink",
      noon,
    );

    expect(byIp.allowed).toBe(true);
  });

  test("gives the IP scope its own, higher bound", async ({ database }) => {
    const ip = { scope: "ip", id: "190.0.2.10" } as const;

    for (let charge = 0; charge < CEILINGS.requestMagicLink.ip.max; charge += 1) {
      // Sequential for the same reason as chargeRepeatedly above: the assertion
      // is that each of the first twenty is allowed, in order.
      // oxlint-disable-next-line no-await-in-loop
      expect((await chargeCeiling(database.db, ip, "requestMagicLink", noon)).allowed).toBe(true);
    }

    expect((await chargeCeiling(database.db, ip, "requestMagicLink", noon)).allowed).toBe(false);
  });

  test("starts a fresh allowance in the next window", async ({ database }) => {
    await chargeRepeatedly(database, 6);
    expect((await chargeCeiling(database.db, ana, "requestMagicLink", noon)).allowed).toBe(false);

    const nextHour = new Date("2026-08-27T13:00:00.000Z");
    expect((await chargeCeiling(database.db, ana, "requestMagicLink", nextHour)).allowed).toBe(
      true,
    );
  });

  test("keeps the earlier window's row rather than resetting the counter", async ({ database }) => {
    await chargeRepeatedly(database, 2);
    await chargeCeiling(database.db, ana, "requestMagicLink", new Date("2026-08-27T13:00:00.000Z"));

    const rows = await database.db.select().from(rateCounter);

    expect(rows).toHaveLength(2);
  });

  // Nothing else deletes from rate_counter, so without this the table accretes
  // one row per principal, action and window forever — and a caller rotating
  // principals mints a permanent row per request.
  test("sweeps rows old enough that no chargeable window can reach them", async ({ database }) => {
    await chargeRepeatedly(database, 2);

    // Retention is twice the *widest* window in the registry, which became a
    // day when `publishProfile` joined it — so "old enough" is now past two
    // days, not past two hours.
    const threeDaysLater = new Date("2026-08-30T15:00:00.000Z");
    await chargeCeiling(database.db, ana, "requestMagicLink", threeDaysLater);

    const rows = await database.db.select().from(rateCounter);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.windowStart.toISOString()).toBe("2026-08-30T15:00:00.000Z");
  });
});

// NFR26 sets the ceilings; C39 is why a refusal is returned rather than thrown.
describe("what a refusal carries", () => {
  test("returns the refusal rather than throwing it", async ({ database }) => {
    // The whole reason: a thrown refusal on every crawler request spends the
    // month's 5,000-event Sentry allowance in a day.
    const refusal = await chargeRepeatedly(database, 6);

    expect(refusal.allowed).toBe(false);
  });

  test("carries a retryAfter the surface can render", async ({ database }) => {
    const refusal = await chargeRepeatedly(database, 6, new Date("2026-08-27T12:48:00.000Z"));

    expect(refusal.allowed).toBe(false);
    if (refusal.allowed) return;

    expect(refusal.retryAfter).toBe(12 * 60);
    expect(refusal.error.code).toBe("rate_limited");
    expect(refusal.error.status).toBe(429);
  });

  test("says it in her terms, with her count and the door that is still open", async ({
    database,
  }) => {
    const refusal = await chargeRepeatedly(database, 6, new Date("2026-08-27T12:48:00.000Z"));

    expect(refusal.allowed).toBe(false);
    if (refusal.allowed) return;

    expect(refusal.error.userMessage).toContain("5 enlaces");
    expect(refusal.error.userMessage).toContain("en 12 minutos");
    expect(refusal.error.userMessage).toContain("Google");
  });

  // NFR18. `context` reaches the log line, and an address on a line is a leak
  // whatever key it arrived under.
  test("keeps the address out of the operator-facing error", async ({ database }) => {
    const refusal = await chargeRepeatedly(database, 6);

    expect(refusal.allowed).toBe(false);
    if (refusal.allowed) return;

    const serialised = JSON.stringify(refusal.error.toOperatorJSON());
    expect(serialised).not.toContain("ana@example.co");
    expect(serialised).not.toContain("ana");
  });
});

describe("the CHECK the first ceiling put on rate_counter.action", () => {
  // DD2's rule for an enum-shaped column, and the database refusing what
  // `CEILINGS` does not know.
  test("refuses an action the registry does not name", async ({ database }) => {
    await expect(
      database.db
        .insert(rateCounter)
        .values({ principal: "address:x", action: "sendOffer", windowStart: noon, count: 1 }),
    ).rejects.toThrow();
  });
});
