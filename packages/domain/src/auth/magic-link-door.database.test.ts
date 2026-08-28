/**
 * Seam 2: NFR26's per-address ceiling on the **direct** door.
 *
 * `/api/auth/sign-in/magic-link` is reachable without the Server Action, and the
 * action is where the per-address charge used to live — so a client posting
 * straight to the endpoint could send 20 links/hour to one address per IP
 * (Better Auth's own limiter is per-IP) instead of NFR26's 5/hour per address.
 * The charge now happens in the `before` hook for HTTP hits only; these cases
 * pin both halves — the direct door refuses the sixth, and the Server Action's
 * internal `auth.api` call is not charged a second time.
 */

import { betterAuth } from "better-auth";
import { authOptions } from "#auth/config";
import { CEILINGS } from "#rate-limit";
import { rateCounter } from "#schema";
import { restoreDatabase, type TestDatabase } from "#testing/database";

const BASE_URL = "https://recomencemos.test";

let database: TestDatabase;

beforeEach(async () => {
  database = await restoreDatabase();
});

afterEach(async () => {
  await database.close();
});

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

/** One POST to the endpoint an attacker actually reaches, not to `auth.api`. */
async function postMagicLink(
  auth: ReturnType<typeof signInStack>["auth"],
  email: string,
): Promise<Response> {
  return auth.handler(
    new Request(`${BASE_URL}/api/auth/sign-in/magic-link`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE_URL },
      body: JSON.stringify({ email, callbackURL: "/" }),
    }),
  );
}

describe("the direct /sign-in/magic-link door", () => {
  it("allows NFR26's five per address and refuses the sixth with a 429", async () => {
    const { auth, links } = signInStack();

    for (let sent = 0; sent < CEILINGS.requestMagicLink.address.max; sent += 1) {
      // Sequential on purpose: the assertion is that each of the first five is
      // accepted, in order, before the sixth is refused.
      // oxlint-disable-next-line no-await-in-loop
      const response = await postMagicLink(auth, "worker@example.co");
      expect(response.status).toBe(200);
    }

    const sixth = await postMagicLink(auth, "worker@example.co");

    expect(sixth.status).toBe(429);
    expect(sixth.headers.get("retry-after")).toMatch(/^\d+$/);
    // The refusal happened before anything was sent: five links, not six.
    expect(links).toHaveLength(CEILINGS.requestMagicLink.address.max);
  });

  it("charges the address however the caller capitalised it", async () => {
    const { auth } = signInStack();

    for (let sent = 0; sent < CEILINGS.requestMagicLink.address.max; sent += 1) {
      // oxlint-disable-next-line no-await-in-loop
      await postMagicLink(auth, "worker@example.co");
    }

    const sixth = await postMagicLink(auth, "WORKER@Example.CO");

    expect(sixth.status).toBe(429);
  });

  it("keeps one address's allowance out of another's", async () => {
    const { auth } = signInStack();

    for (let sent = 0; sent < CEILINGS.requestMagicLink.address.max + 1; sent += 1) {
      // oxlint-disable-next-line no-await-in-loop
      await postMagicLink(auth, "worker@example.co");
    }

    const other = await postMagicLink(auth, "otra@example.co");

    expect(other.status).toBe(200);
  });

  /**
   * The Server Action already charged before it called `auth.api`, so the hook
   * must not charge that path a second time — otherwise every legitimate
   * request costs two of her five. `ctx.request` is the discriminator: the
   * router sets it on an HTTP hit and an internal `auth.api` call has none.
   */
  it("does not charge the Server Action's own internal call", async () => {
    const { auth, links } = signInStack();

    await auth.api.signInMagicLink({
      body: { email: "worker@example.co", callbackURL: "/" },
      headers: new Headers({ origin: BASE_URL }),
    });

    expect(links).toHaveLength(1);
    await expect(database.db.select().from(rateCounter)).resolves.toHaveLength(0);
  });
});
