/**
 * Seam 2: NFR13's two session lifetimes, proved against a real engine and a real
 * sign-in rather than against the function that computes them.
 *
 * **This file exists because `sign-in-attempt.test.ts` cannot fail for the bug
 * it is meant to catch.** That suite asserts `sessionExpiryFor` in isolation and
 * the function is correct — 8 hours for a shared device, 30 days otherwise. The
 * defect a security review found was entirely downstream of it: Better Auth
 * measures a session's age as `expiresAt - expiresIn + updateAge <= now`, and
 * because `databaseHooks.session.create.before` writes an `expiresAt` *shorter*
 * than the configured `expiresIn`, the predicate was true on the **first**
 * `/get-session`. The refresh then promoted the row to 30 days and re-issued the
 * cookie with a 30-day `Max-Age`. The pure function was right; the row it wrote
 * was overwritten one request later, and every seam-1 test stayed green.
 *
 * So the assertion that matters is made **after a second request**, which means
 * a real Better Auth instance over a real database. Both are available here: the
 * PGlite engine is the committed migrations replayed, and `sendMagicLink` is
 * already injected, so the link can be caught in-process and opened without
 * anything being sent.
 */

import { betterAuth } from "better-auth";
import { eq } from "drizzle-orm";
import { authOptions, MAGIC_LINK_TTL_MINUTES } from "#auth/config";
import { OWN_DEVICE_SESSION_SECONDS, SHARED_DEVICE_SESSION_SECONDS } from "#auth/sign-in-attempt";
import * as schema from "#schema";
import { restoreDatabase, type TestDatabase } from "#testing/database";

const BASE_URL = "https://recomencemos.test";

let database: TestDatabase;

beforeEach(async () => {
  database = await restoreDatabase();
});

afterEach(async () => {
  await database.close();
});

/**
 * A Better Auth instance over the restored engine, plus the one link it would
 * have emailed.
 *
 * Google is left unconfigured: this file is about session lifetime, the
 * magic-link door reaches every line of that, and configuring a social provider
 * would add an outbound leg a test has no business having.
 */
function signInStack() {
  const links: { url: string }[] = [];

  const auth = betterAuth(
    authOptions({
      db: database.db,
      sendMagicLink: async ({ url }) => {
        links.push({ url });
      },
      logger: { info: () => {}, warn: () => {} },
      env: {
        BETTER_AUTH_SECRET: "a-secret-long-enough-for-the-configuration-to-build",
        BETTER_AUTH_URL: BASE_URL,
      },
    }),
  );

  return { auth, links };
}

/** Every cookie a response set, as one `Cookie` header value. */
function cookieHeader(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

/**
 * Sign in through the magic-link door, end to end, and hand back the session
 * cookie the browser would now be holding.
 *
 * The link is opened with `redirect: "manual"` semantics — `auth.handler`
 * returns the 302 rather than following it — which is also the response that
 * carries `Set-Cookie`.
 */
async function signIn(
  auth: ReturnType<typeof signInStack>["auth"],
  links: { url: string }[],
  email: string,
  sharedDevice: boolean,
) {
  await auth.api.signInMagicLink({
    body: { email, callbackURL: "/", metadata: { sharedDevice } },
    headers: new Headers({ origin: BASE_URL }),
  });

  const link = links.at(-1)?.url;
  expect(link, "the magic link was never sent").toBeDefined();

  const opened = await auth.handler(new Request(link as string));
  const cookie = cookieHeader(opened);
  expect(cookie, "opening the link set no session cookie").not.toBe("");

  return { cookie, opened };
}

/** The one session row, read straight out of the engine. */
async function sessionRow() {
  const rows = await database.db.select().from(schema.session);
  expect(rows).toHaveLength(1);
  return rows[0];
}

/** How many seconds from now a row's expiry sits, rounded to the minute. */
function secondsUntil(expiresAt: Date): number {
  return Math.round((expiresAt.getTime() - Date.now()) / 1000 / 60) * 60;
}

describe("a shared-device sign-in", () => {
  it("gets an eight-hour row, which is NFR13's half that is actually true", async () => {
    const { auth, links } = signInStack();
    await signIn(auth, links, "worker@example.co", true);

    const row = await sessionRow();
    expect(secondsUntil(row!.expiresAt)).toBe(SHARED_DEVICE_SESSION_SECONDS);
    expect(row!.signInMethod).toBe("magic_link");
  });

  /**
   * **The regression test for the security finding.** Before
   * `disableSessionRefresh`, this row came back at 30 days — on the very first
   * `/get-session`, with no attacker action, because the refresh predicate reads
   * the configured `expiresIn` rather than the row.
   */
  it("is not extended by reading the session, however many times it is read", async () => {
    const { auth, links } = signInStack();
    const { cookie } = await signIn(auth, links, "worker@example.co", true);

    const before = (await sessionRow())!.expiresAt;

    /** One read, asserted to have actually succeeded. */
    const readSession = async () => {
      const response = await auth.handler(
        new Request(`${BASE_URL}/api/auth/get-session`, { headers: { cookie } }),
      );
      expect(response.status).toBe(200);
      // The session is still hers — this is not passing because the read failed.
      expect(await response.json()).toMatchObject({ user: { email: "worker@example.co" } });
    };

    // Three, sequentially and not through `Promise.all`: the defect fired on the
    // *first* read and then compounded, so reads that overlap on one row would
    // prove less than reads that follow one another.
    await readSession();
    await readSession();
    await readSession();

    const after = (await sessionRow())!.expiresAt;

    expect(after.getTime()).toBe(before.getTime());
    expect(secondsUntil(after)).toBe(SHARED_DEVICE_SESSION_SECONDS);
  });

  /**
   * The cookie half. `makeCookiesNonPersistent` strips `Max-Age`/`Expires` at
   * sign-in, and the refresh used to put a 30-day `Max-Age` straight back — so
   * the guarantee is that no later response re-persists it either.
   */
  it("never has its cookie re-persisted by a later read", async () => {
    const { auth, links } = signInStack();
    const { cookie, opened } = await signIn(auth, links, "worker@example.co", true);

    for (const set of opened.headers.getSetCookie()) {
      expect(set.toLowerCase()).not.toContain("max-age=");
      expect(set.toLowerCase()).not.toContain("expires=");
    }

    const response = await auth.handler(
      new Request(`${BASE_URL}/api/auth/get-session`, { headers: { cookie } }),
    );

    for (const set of response.headers.getSetCookie()) {
      expect(set.toLowerCase()).not.toContain("max-age=");
      expect(set.toLowerCase()).not.toContain("expires=");
    }
  });
});

describe("an own-device sign-in", () => {
  it("gets the thirty-day row NFR13 promises", async () => {
    const { auth, links } = signInStack();
    await signIn(auth, links, "worker@example.co", false);

    expect(secondsUntil((await sessionRow())!.expiresAt)).toBe(OWN_DEVICE_SESSION_SECONDS);
  });

  /**
   * The cost of the fix, asserted rather than described: the 30 days are
   * **absolute**, not rolling. If this ever starts failing because a refresh was
   * turned back on, the shared-device case above is the one to check first —
   * these two are the same switch seen from either side.
   */
  it("is absolute rather than rolling, which is what refusing the refresh costs", async () => {
    const { auth, links } = signInStack();
    const { cookie } = await signIn(auth, links, "worker@example.co", false);

    const before = (await sessionRow())!.expiresAt;

    await auth.handler(new Request(`${BASE_URL}/api/auth/get-session`, { headers: { cookie } }));

    expect((await sessionRow())!.expiresAt.getTime()).toBe(before.getTime());
  });
});

describe("the verification row the link was minted from", () => {
  it("carries the shared-device answer, and is consumed by opening the link", async () => {
    const { auth, links } = signInStack();

    await auth.api.signInMagicLink({
      body: { email: "worker@example.co", callbackURL: "/", metadata: { sharedDevice: true } },
      headers: new Headers({ origin: BASE_URL }),
    });

    const [pending] = await database.db.select().from(schema.verification);
    expect(pending?.sharedDevice).toBe(true);
    // Hashed, never in the clear: a read of this table must not be account
    // takeover for every outstanding link.
    expect(pending?.identifier).toMatch(/^[0-9a-f]{64}$/);
    expect(secondsUntil(pending!.expiresAt)).toBe(MAGIC_LINK_TTL_MINUTES * 60);

    await auth.handler(new Request(links.at(-1)!.url));

    // Single-use: the row is gone, so a link scanner that opened it first cannot
    // have left it usable.
    await expect(
      database.db.select().from(schema.verification).where(eq(schema.verification.id, pending!.id)),
    ).resolves.toHaveLength(0);
  });
});
