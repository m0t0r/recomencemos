/**
 * Seam 2 over the Admin queue's platform signal: how many profiles were
 * published since a given instant.
 *
 * **The rows are inserted directly, for the reason `listing.integration.test.ts`
 * records at more length**: every case here is about a chosen `publishedAt` and a
 * chosen `state`, and `publishProfile` writes neither — it stamps the clock and
 * defaults the state, so twenty profiles published through the real path would
 * share one second and there would be no window to be inside or outside of.
 *
 * The two cases that matter are the boundary and the takedown. The boundary,
 * because an off-by-one on a rolling window is the bug this arithmetic actually
 * has; the takedown, because counting the *act* rather than the surviving row is
 * a deliberate decision and the one a later refactor would quietly undo.
 */

import { countPublishedSince } from "#profiles/index";
import * as schema from "#schema";
import { test } from "#testing/fixtures";
import type { TestDatabase } from "#testing/fixtures";

const NOW = new Date("2026-09-04T12:00:00.000Z");
const HOUR_AGO = new Date(NOW.getTime() - 3_600_000);

async function publish(
  database: TestDatabase,
  slug: string,
  publishedAt: Date,
  state: "published" | "taken_down" = "published",
): Promise<void> {
  await database.db.insert(schema.user).values({
    id: `account-${slug}`,
    name: "",
    email: `${slug}@recomencemos.test`,
    emailVerified: true,
  });

  await database.db.insert(schema.capabilityProfile).values({
    accountId: `account-${slug}`,
    slug,
    fullName: "Ana María Restrepo Gómez",
    firstName: "Ana María",
    lastInitial: "R",
    city: "pereira",
    headline: "Cocino almuerzos y comida casera para eventos pequeños",
    about: "",
    phone: "+573001234567",
    state,
    publishedAt,
    searchText: "ana maria pereira cocino",
  });
}

describe("countPublishedSince", () => {
  test("is zero on an empty platform", async ({ database }) => {
    expect(await countPublishedSince(database.db, HOUR_AGO)).toBe(0);
  });

  test("counts only what was published inside the window", async ({ database }) => {
    // Sequential: each seed inserts an Account and its profile, and two
    // concurrent inserts against one PGlite connection would interleave.
    await publish(database, "inside-one", new Date(NOW.getTime() - 10 * 60_000));
    await publish(database, "inside-two", new Date(NOW.getTime() - 59 * 60_000));
    await publish(database, "outside", new Date(NOW.getTime() - 61 * 60_000));

    expect(await countPublishedSince(database.db, HOUR_AGO)).toBe(2);
  });

  test("includes a profile published exactly on the boundary", async ({ database }) => {
    await publish(database, "on-the-line", HOUR_AGO);

    // `>=`, not `>`: a rolling hour that excluded its own first instant would
    // under-report by whatever landed in that millisecond, and the direction of
    // an error in a flood detector is the whole of its value.
    expect(await countPublishedSince(database.db, HOUR_AGO)).toBe(1);
  });

  test("counts a profile that was published and then taken down", async ({ database }) => {
    await publish(database, "gone-again", new Date(NOW.getTime() - 5 * 60_000), "taken_down");

    // The signal watches the act. Somebody who publishes and removes inside the
    // hour has done the thing being watched for, and filtering on the surviving
    // state would be the way out of the detector.
    expect(await countPublishedSince(database.db, HOUR_AGO)).toBe(1);
  });
});
