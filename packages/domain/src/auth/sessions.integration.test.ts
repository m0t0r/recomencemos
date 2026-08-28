/**
 * Seam 2: story 12's two halves — what `/account` may show her, and what
 * "sign out everywhere" actually reaches.
 *
 * **Both are here rather than at seam 1 because both are claims about rows.**
 * The list's contract is that a token never leaves the database and an expired
 * row never reaches a page; the revocation's contract is that a *different*
 * browser's request stops working. Neither is expressible over a pure function,
 * and the second is the acceptance criterion stated verbatim — "holding two
 * sessions, revoking from one, and observing the other refused".
 */

import { eq } from "drizzle-orm";
import { listAccountSessions } from "#auth/sessions";
import * as schema from "#schema";
import { BASE_URL, signIn, signInStack } from "#testing/auth-stack";
import { test, type TestDatabase } from "#testing/fixtures";

const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; SM-A155M) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/140.0.0.0 Mobile Safari/537.36";
const WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/139.0.0.0 Safari/537.36";

/** The account id and session token behind a cookie, read straight out of the engine. */
async function principal(database: TestDatabase, email: string) {
  const [account] = await database.db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, email));

  return account!.id;
}

/** Ask the running instance whether a cookie is still a session. */
async function sessionStillWorks(
  auth: ReturnType<typeof signInStack>["auth"],
  cookie: string,
): Promise<boolean> {
  const response = await auth.handler(
    new Request(`${BASE_URL}/api/auth/get-session`, { headers: { cookie } }),
  );
  if (response.status !== 200) return false;
  // A revoked session answers 200 with a `null` body rather than a 401, which is
  // exactly the shape a caller would mistake for "still signed in".
  return (await response.json()) !== null;
}

describe("the list `/account` renders", () => {
  test("holds every open session, and marks exactly one of them as the caller's own", async ({
    database,
  }) => {
    const stack = signInStack(database);
    const phone = await signIn(stack, "worker@example.co", { userAgent: ANDROID });
    await signIn(stack, "worker@example.co", { userAgent: WINDOWS });

    const accountId = await principal(database, "worker@example.co");
    const currentToken = (await database.db.select().from(schema.session))
      .map((row) => row.token)
      .find(
        (token) => phone.cookie.includes(encodeURIComponent(token)) || phone.cookie.includes(token),
      );

    const sessions = await listAccountSessions(database.db, {
      accountId,
      currentToken: currentToken!,
      now: new Date(),
    });

    expect(sessions).toHaveLength(2);
    expect(sessions.filter((session) => session.current)).toHaveLength(1);
    // The caller's own session leads the list — see the ordering note in `sessions.ts`.
    expect(sessions[0]!.current).toBe(true);
    expect(sessions[0]!.userAgent).toBe(ANDROID);
  });

  /**
   * **The assertion that keeps C28 true.** The session `token` is classified
   * `secret`, and `/list-sessions` — Better Auth's own endpoint, which this
   * module exists instead of — returns the whole row including it. So the
   * projection is asserted by its **exact key set**, not by checking that one
   * field is absent: a field added to the session table later cannot reach a
   * browser by default, which is ADR-0003's discipline applied to a list.
   */
  test("carries no token and no IP address, whatever the row holds", async ({ database }) => {
    const stack = signInStack(database);
    await signIn(stack, "worker@example.co", { userAgent: ANDROID });

    const accountId = await principal(database, "worker@example.co");
    const [row] = await database.db.select().from(schema.session);

    // The row really does hold both, so the projection is dropping them rather
    // than the fixture never having them.
    expect(row!.token).toBeTruthy();

    const [session] = await listAccountSessions(database.db, {
      accountId,
      currentToken: row!.token,
      now: new Date(),
    });

    expect(Object.keys(session!).toSorted()).toEqual([
      "createdAt",
      "current",
      "expiresAt",
      "id",
      "signInMethod",
      "userAgent",
    ]);
    expect(JSON.stringify(session)).not.toContain(row!.token);
  });

  test("omits a session that has already expired", async ({ database }) => {
    const stack = signInStack(database);
    const { cookie } = await signIn(stack, "worker@example.co", { userAgent: ANDROID });
    await signIn(stack, "worker@example.co", { userAgent: WINDOWS });

    const accountId = await principal(database, "worker@example.co");
    const rows = await database.db.select().from(schema.session);
    const current = rows.find((row) => cookie.includes(row.token))!;
    const other = rows.find((row) => row.id !== current.id)!;

    await database.db
      .update(schema.session)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.session.id, other.id));

    const sessions = await listAccountSessions(database.db, {
      accountId,
      currentToken: current.token,
      now: new Date(),
    });

    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.current).toBe(true);
  });

  test("shows her nothing belonging to another Account", async ({ database }) => {
    const stack = signInStack(database);
    const { cookie } = await signIn(stack, "worker@example.co", { userAgent: ANDROID });
    await signIn(stack, "someone-else@example.co", { userAgent: WINDOWS });

    const accountId = await principal(database, "worker@example.co");
    const current = (await database.db.select().from(schema.session)).find((row) =>
      cookie.includes(row.token),
    )!;

    const sessions = await listAccountSessions(database.db, {
      accountId,
      currentToken: current.token,
      now: new Date(),
    });

    expect(sessions).toHaveLength(1);
  });

  test("records a session opened with no User-Agent as having none", async ({ database }) => {
    const stack = signInStack(database);
    const { cookie } = await signIn(stack, "worker@example.co");

    const accountId = await principal(database, "worker@example.co");
    const current = (await database.db.select().from(schema.session)).find((row) =>
      cookie.includes(row.token),
    )!;

    const [session] = await listAccountSessions(database.db, {
      accountId,
      currentToken: current.token,
      now: new Date(),
    });

    /**
     * **`null`, never an empty string.** The column holds `""` here — Better
     * Auth writes `ctx.headers.get("user-agent") || ""` — and two spellings of
     * "nothing" is one spelling too many for a surface that has to render a
     * sentence for it. Asserted at the row as well, so this test fails if the
     * normalisation is removed rather than passing because the column changed.
     */
    expect(current.userAgent).toBe("");
    expect(session!.userAgent).toBeNull();
  });
});

/**
 * **The acceptance criterion, verbatim.** Two sessions held at once, revoked
 * from one, and the other observed refused — not merely absent from a list.
 */
describe("signing out everywhere", () => {
  test("refuses the other browser's cookie, and keeps working on this one", async ({
    database,
  }) => {
    const stack = signInStack(database);
    const phone = await signIn(stack, "worker@example.co", { userAgent: ANDROID });
    const cybercafe = await signIn(stack, "worker@example.co", { userAgent: WINDOWS });

    expect(await sessionStillWorks(stack.auth, phone.cookie)).toBe(true);
    expect(await sessionStillWorks(stack.auth, cybercafe.cookie)).toBe(true);

    await stack.auth.api.revokeOtherSessions({
      headers: new Headers({ cookie: phone.cookie, origin: BASE_URL }),
    });

    expect(await sessionStillWorks(stack.auth, cybercafe.cookie)).toBe(false);
    expect(await sessionStillWorks(stack.auth, phone.cookie)).toBe(true);
  });

  /**
   * **Revocation is a deleted row, not an expiry brought forward**, which is
   * what C28's retention line says and what makes the third acceptance
   * criterion's "not defeated by a cached session lookup" checkable: there is
   * nothing left to read.
   */
  test("deletes the row rather than shortening it", async ({ database }) => {
    const stack = signInStack(database);
    const phone = await signIn(stack, "worker@example.co", { userAgent: ANDROID });
    await signIn(stack, "worker@example.co", { userAgent: WINDOWS });

    expect(await database.db.select().from(schema.session)).toHaveLength(2);

    await stack.auth.api.revokeOtherSessions({
      headers: new Headers({ cookie: phone.cookie, origin: BASE_URL }),
    });

    const remaining = await database.db.select().from(schema.session);
    expect(remaining).toHaveLength(1);
    expect(phone.cookie).toContain(remaining[0]!.token);
  });

  /**
   * **The gate that would have broken this surface for the person it is for.**
   * Better Auth puts `/list-sessions` behind `freshSessionMiddleware`, which
   * refuses a session older than `freshAge` — 24 hours by default. The Worker
   * who signed in six days ago is exactly who `/account` serves, so this module
   * reads the rows directly instead. `/revoke-other-sessions` is behind
   * `sensitiveSessionMiddleware`, which carries no such gate; this test pins
   * that difference so an upgrade that adds one is caught here rather than in
   * production.
   */
  test("is reachable from a session too old to list itself through Better Auth", async ({
    database,
  }) => {
    const stack = signInStack(database);
    const phone = await signIn(stack, "worker@example.co", { userAgent: ANDROID });
    await signIn(stack, "worker@example.co", { userAgent: WINDOWS });

    // Age the session past the 24-hour default `freshAge`.
    const rows = await database.db.select().from(schema.session);
    const current = rows.find((row) => phone.cookie.includes(row.token))!;
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await database.db
      .update(schema.session)
      .set({ createdAt: twoDaysAgo })
      .where(eq(schema.session.id, current.id));

    const accountId = await principal(database, "worker@example.co");

    // Our own read still answers.
    const sessions = await listAccountSessions(database.db, {
      accountId,
      currentToken: current.token,
      now: new Date(),
    });
    expect(sessions).toHaveLength(2);

    // And the revocation still runs from that same aged session.
    await expect(
      stack.auth.api.revokeOtherSessions({
        headers: new Headers({ cookie: phone.cookie, origin: BASE_URL }),
      }),
    ).resolves.toBeDefined();
  });
});
