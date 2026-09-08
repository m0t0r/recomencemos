/**
 * Seam 2 over the one thing this package publishes about an Account: whether it
 * may send an Offer.
 *
 * The Account is created through the real sign-in stack rather than inserted, so
 * the default this reads is the one Better Auth's own writer produces — which is
 * the whole question for a column declared through `additionalFields`. An
 * inserted row would assert Drizzle's default and say nothing about the path
 * that actually creates Accounts.
 */

import { eq } from "drizzle-orm";
import { readOfferSendingState } from "#accounts";
import * as schema from "#schema";
import { signedInAccountId } from "#testing/auth-stack";
import { test } from "#testing/fixtures";
import type { TestDatabase } from "#testing/fixtures";

const HIRER = "carlos@recomencemos.test";

const anAccount = (database: TestDatabase, email = HIRER): Promise<string> =>
  signedInAccountId(database, email);

describe("an Account's sending state", () => {
  test("is active for somebody who has just signed in for the first time", async ({ database }) => {
    const accountId = await anAccount(database);

    expect(await readOfferSendingState(database.db, accountId)).toBe("active");
  });

  /**
   * Story 10 owns the writer; this is the read that has to see it. Written
   * directly here because `reportOffer` does not exist yet — and the column's
   * `CHECK` is what makes the write meaningful, so the case below is what proves
   * the engine accepts the member at all.
   */
  test("reads back the freeze a Report will write", async ({ database }) => {
    const accountId = await anAccount(database);

    await database.db
      .update(schema.user)
      .set({ offerSendingState: "frozen" })
      .where(eq(schema.user.id, accountId));

    expect(await readOfferSendingState(database.db, accountId)).toBe("frozen");
  });

  test("reads back a ban", async ({ database }) => {
    const accountId = await anAccount(database);

    await database.db
      .update(schema.user)
      .set({ offerSendingState: "banned" })
      .where(eq(schema.user.id, accountId));

    expect(await readOfferSendingState(database.db, accountId)).toBe("banned");
  });

  /**
   * DD2's rule for an enum-shaped column, read from the engine's end: the
   * `CHECK` is what makes the cast in `readOfferSendingState` a reading of a
   * constraint rather than an assumption about the data, so a fourth spelling
   * has to be refused here for that sentence to be true.
   */
  test("cannot be set to a value the registry does not name", async ({ database }) => {
    const accountId = await anAccount(database);

    await expect(
      database.db
        .update(schema.user)
        // The type is the point: this is the write a later ticket makes by
        // typo, and the engine is what has to refuse it.
        .set({ offerSendingState: "suspended" })
        .where(eq(schema.user.id, accountId)),
    ).rejects.toThrow();
  });

  /**
   * An id that names no row. The route reads this with a live session in hand,
   * so it cannot happen through the door — and the answer is still the default
   * rather than a throw, because a throw here costs a Sentry event on a page a
   * crawler can provoke (C51).
   */
  test("is active for an Account id that names nothing", async ({ database }) => {
    expect(await readOfferSendingState(database.db, "no-such-account")).toBe("active");
  });
});
