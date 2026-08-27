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
import { restoreDatabase, type TestDatabase } from "#testing/database";

let database: TestDatabase;

beforeEach(async () => {
  database = await restoreDatabase();
});

afterEach(async () => {
  await database.close();
});

const ana = { scope: "address", id: "ana@example.co" } as const;
const noon = new Date("2026-08-27T12:00:00.000Z");

/** Charge the ceiling `times` times at one instant and return the last outcome. */
async function chargeRepeatedly(times: number, at: Date = noon) {
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
  it("allows the first request", async () => {
    const outcome = await chargeCeiling(database.db, ana, "requestMagicLink", noon);

    expect(outcome.allowed).toBe(true);
  });

  it("allows exactly NFR26's five in an hour and refuses the sixth", async () => {
    expect((await chargeRepeatedly(CEILINGS.requestMagicLink.address.max)).allowed).toBe(true);

    const sixth = await chargeCeiling(database.db, ana, "requestMagicLink", noon);
    expect(sixth.allowed).toBe(false);
  });

  it("counts on one row per principal, action and window", async () => {
    await chargeRepeatedly(3);

    const rows = await database.db
      .select()
      .from(rateCounter)
      .where(eq(rateCounter.principal, principalKey(ana)));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.count).toBe(3);
  });

  // The upsert is the mechanism. Two statements race, and the race is won by the
  // caller sending the flood the ceiling exists to bound.
  it("counts concurrent charges without losing any", async () => {
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

  it("does not store the address it is charging", async () => {
    await chargeCeiling(database.db, ana, "requestMagicLink", noon);

    const rows = await database.db.select().from(rateCounter);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.principal).not.toContain("ana@example.co");
    expect(rows[0]?.principal).toMatch(/^address:[0-9a-f]{64}$/);
  });

  it("charges one counter however she capitalised her address", async () => {
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

  it("keeps one person's allowance out of another's", async () => {
    await chargeRepeatedly(6);

    const other = await chargeCeiling(
      database.db,
      { scope: "address", id: "beatriz@example.co" },
      "requestMagicLink",
      noon,
    );

    expect(other.allowed).toBe(true);
  });

  it("keeps the per-IP allowance separate from the per-address one", async () => {
    await chargeRepeatedly(6);

    const byIp = await chargeCeiling(
      database.db,
      { scope: "ip", id: "190.0.2.10" },
      "requestMagicLink",
      noon,
    );

    expect(byIp.allowed).toBe(true);
  });

  it("gives the IP scope NFR26's higher bound", async () => {
    const ip = { scope: "ip", id: "190.0.2.10" } as const;

    for (let charge = 0; charge < CEILINGS.requestMagicLink.ip.max; charge += 1) {
      // Sequential for the same reason as chargeRepeatedly above: the assertion
      // is that each of the first twenty is allowed, in order.
      // oxlint-disable-next-line no-await-in-loop
      expect((await chargeCeiling(database.db, ip, "requestMagicLink", noon)).allowed).toBe(true);
    }

    expect((await chargeCeiling(database.db, ip, "requestMagicLink", noon)).allowed).toBe(false);
  });

  it("starts a fresh allowance in the next window", async () => {
    await chargeRepeatedly(6);
    expect((await chargeCeiling(database.db, ana, "requestMagicLink", noon)).allowed).toBe(false);

    const nextHour = new Date("2026-08-27T13:00:00.000Z");
    expect((await chargeCeiling(database.db, ana, "requestMagicLink", nextHour)).allowed).toBe(
      true,
    );
  });

  it("keeps the earlier window's row rather than resetting the counter", async () => {
    await chargeRepeatedly(2);
    await chargeCeiling(database.db, ana, "requestMagicLink", new Date("2026-08-27T13:00:00.000Z"));

    const rows = await database.db.select().from(rateCounter);

    expect(rows).toHaveLength(2);
  });
});

describe("what a refusal carries (NFR26, C39)", () => {
  it("returns the refusal rather than throwing it", async () => {
    // The whole reason: a thrown refusal on every crawler request spends the
    // month's 5,000-event Sentry allowance in a day.
    const refusal = await chargeRepeatedly(6);

    expect(refusal.allowed).toBe(false);
  });

  it("carries a retryAfter the surface can render", async () => {
    const refusal = await chargeRepeatedly(6, new Date("2026-08-27T12:48:00.000Z"));

    expect(refusal.allowed).toBe(false);
    if (refusal.allowed) return;

    expect(refusal.retryAfter).toBe(12 * 60);
    expect(refusal.error.code).toBe("rate_limited");
    expect(refusal.error.status).toBe(429);
  });

  it("says it in her terms, with her count and the door that is still open", async () => {
    const refusal = await chargeRepeatedly(6, new Date("2026-08-27T12:48:00.000Z"));

    expect(refusal.allowed).toBe(false);
    if (refusal.allowed) return;

    expect(refusal.error.userMessage).toContain("5 enlaces");
    expect(refusal.error.userMessage).toContain("en 12 minutos");
    expect(refusal.error.userMessage).toContain("Google");
  });

  // NFR18. `context` reaches the log line, and an address on a line is a leak
  // whatever key it arrived under.
  it("keeps the address out of the operator-facing error", async () => {
    const refusal = await chargeRepeatedly(6);

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
  it("refuses an action the registry does not name", async () => {
    await expect(
      database.db
        .insert(rateCounter)
        .values({ principal: "address:x", action: "publishProfile", windowStart: noon, count: 1 }),
    ).rejects.toThrow();
  });
});
