/**
 * Seam 2: the sweep of expired `verification` rows (#323).
 *
 * Both doors write to this table and neither cleans up after itself on the paths
 * this product takes. A Google start writes an OAuth state row that lives ten
 * minutes; a magic link writes a hashed-token row that lives fifteen and is
 * deleted only when it is opened. Better Auth prunes expired rows as a side
 * effect of `findVerificationValue`, which only the OAuth callback reaches here,
 * so before the sweep an unclicked link — whose `value` holds the address it was
 * sent to — stayed until somebody happened to complete a Google sign-in.
 *
 * Every row here is written through the real door, against a real Better Auth
 * over the committed migrations, with the clock pinned so "expired" is a fact of
 * the test rather than a race against it. The Google client is a placeholder:
 * starting that door builds an authorization URL locally and reaches no network.
 */

import { hashToken } from "#auth/config";
import * as schema from "#schema";
import { type AuthStack, BASE_URL, cookieHeader, signInStack } from "#testing/auth-stack";
import { test, type TestDatabase } from "#testing/fixtures";

const GOOGLE = {
  GOOGLE_CLIENT_ID: "placeholder-client-id.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "placeholder-client-secret",
};

const NOON = new Date("2026-09-15T12:00:00.000Z");

/** `NOON` plus some minutes, which is what every step below is timed by. */
const minutesPastNoon = (minutes: number) => new Date(NOON.getTime() + minutes * 60_000);

/**
 * Only `Date` is faked. PGlite, the pool and Better Auth's own awaits keep real
 * timers, so nothing waits on a clock that does not move.
 */
function at(instant: Date) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(instant);
}

afterEach(() => {
  vi.useRealTimers();
});

function googleStack(database: TestDatabase): AuthStack {
  return signInStack(database, {}, GOOGLE);
}

/** Ask for a link, and answer with the identifier its row is stored under. */
async function requestLink({ auth, links }: AuthStack, email: string): Promise<string> {
  await auth.api.signInMagicLink({
    body: { email, callbackURL: "/" },
    headers: new Headers({ origin: BASE_URL }),
  });

  const token = new URL(links.at(-1)?.url ?? "").searchParams.get("token");
  if (!token) throw new Error("the magic link carried no token");

  return hashToken(token);
}

/** Start the Google door, and answer with the state its row is stored under. */
async function startGoogle({ auth }: AuthStack): Promise<string> {
  const { response } = await auth.api.signInSocial({
    body: { provider: "google", callbackURL: "/" },
    headers: new Headers({ origin: BASE_URL }),
    returnHeaders: true,
  });

  const state = new URL(response.url ?? "").searchParams.get("state");
  if (!state) throw new Error("the authorization URL carried no state");

  return state;
}

async function storedIdentifiers(database: TestDatabase): Promise<string[]> {
  const rows = await database.db
    .select({ identifier: schema.verification.identifier })
    .from(schema.verification);

  return rows.map((row) => row.identifier);
}

describe("writing a verification row", () => {
  test("clears an expired Google start and keeps every row still live", async ({ database }) => {
    const stack = googleStack(database);

    at(NOON);
    const expiredStart = await startGoogle(stack);
    const liveLink = await requestLink(stack, "ana@example.co");

    at(minutesPastNoon(5));
    const liveStart = await startGoogle(stack);

    // Twelve minutes on: the first start's ten are up, the link's fifteen and
    // the second start's ten are not.
    at(minutesPastNoon(12));
    const newest = await requestLink(stack, "beatriz@example.co");

    const stored = await storedIdentifiers(database);

    expect(stored).not.toContain(expiredStart);
    expect(stored).toEqual(expect.arrayContaining([liveLink, liveStart, newest]));
    expect(stored).toHaveLength(3);
  });

  test("clears a link nobody opened once it has expired and another row is written", async ({
    database,
  }) => {
    const stack = googleStack(database);

    at(NOON);
    const unopened = await requestLink(stack, "ana@example.co");

    // Still live at fourteen minutes, so the write then must leave it alone.
    at(minutesPastNoon(14));
    await startGoogle(stack);
    expect(await storedIdentifiers(database)).toContain(unopened);

    // Past its fifteen: the next write takes it.
    at(minutesPastNoon(16));
    const next = await startGoogle(stack);

    const stored = await storedIdentifiers(database);

    expect(stored).not.toContain(unopened);
    expect(stored).toContain(next);
  });

  /**
   * **What the sweep must never do is break a sign-in in flight.** A row
   * deleted before it expires turns a link she is about to open into an
   * invalid one, so this opens the link after the sweep has run and asks for
   * the session it should still produce.
   */
  test("leaves a link she has not opened yet able to sign her in", async ({ database }) => {
    const stack = googleStack(database);

    at(NOON);
    await requestLink(stack, "ana@example.co");
    const link = stack.links.at(-1)?.url ?? "";

    at(minutesPastNoon(14));
    await startGoogle(stack);

    const opened = await stack.auth.handler(new Request(link));

    expect(cookieHeader(opened)).toContain("session_token");
  });
});
