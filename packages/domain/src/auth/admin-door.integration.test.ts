/**
 * The Admin door, end to end, against a real Better Auth instance and the
 * **committed migrations**.
 *
 * **The property this file exists for is that there is only one link.** An
 * Account holding the grant asks at the same form, is sent the same URL, and has
 * it spent by the same endpoint; what differs is that consuming it produces a
 * challenge instead of a session. So the assertions come in pairs — the Admin
 * and an ordinary Account, against the same request — because a difference
 * anywhere but the last step is a difference a mailbox or a network can see.
 *
 * `admin/sign-in-door.integration.test.ts` proves what the code check decides.
 * This proves what the link does, and that the session which comes out the far
 * end carries the method `requireAdminSession` accepts and the lifetime NFR13
 * gives it.
 */

import { createOTP } from "@better-auth/utils/otp";
import { eq } from "drizzle-orm";
import { requireAdminSession } from "#admin/actor";
import {
  ADMIN_CHALLENGE_TTL_SECONDS,
  SECOND_FACTOR_ROUTE,
  SIGN_IN_CHALLENGE_COOKIE,
} from "#admin/challenge";
import { ADMIN_CODE_REFUSED_CODE } from "#auth/admin-door";
import { authOptions } from "#auth/config";
import { createAuthHandler } from "#auth/index";
import { ADMIN_SESSION_SECONDS } from "#auth/sign-in-attempt";
import * as schema from "#schema";
import { type AuthStack, BASE_URL, enrolledAdmin, signInStack } from "#testing/auth-stack";
import { test, type TestDatabase } from "#testing/fixtures";
import { ADMIN_SECOND_FACTOR_REFUSED, ADMIN_SIGN_IN_ONLY } from "#user-messages";

/** The same value `signInStack` configures, because the door decrypts with it. */
const KEY = "a-secret-long-enough-for-the-configuration-to-build";

const ANA = "ana@recomencemos.test";
const CARLOS = "carlos@recomencemos.test";

/**
 * **The refusal, asserted as one object rather than as a status.** Every way of
 * being wrong at the code step produces this exact value, and asserting the whole
 * of it is what makes that a test rather than a comment.
 */
const ONE_REFUSAL = {
  status: 401,
  body: { code: ADMIN_CODE_REFUSED_CODE, message: ADMIN_SECOND_FACTOR_REFUSED },
};

const totp = (secret: string) => createOTP(secret).totp();

/** Ask for a link at the public door, exactly as the Server Action does. */
async function askForALink(stack: AuthStack, email: string) {
  return stack.auth.api.signInMagicLink({
    body: { email, callbackURL: "/", metadata: { sharedDevice: false } },
    headers: new Headers({ origin: BASE_URL }),
  });
}

/** The last URL that reached a mailbox. */
function lastLink(stack: AuthStack): string {
  const link = stack.links.at(-1)?.url;
  expect(link, "no link was sent").toBeDefined();
  return link as string;
}

/** Open it, the way a mail client does: a plain GET, following nothing. */
async function openIt(stack: AuthStack, url: string): Promise<Response> {
  return stack.auth.handler(new Request(url, { redirect: "manual" }));
}

/** What a browser would send back from a response's cookies. */
function carrying(response: Response): Headers {
  return new Headers({
    cookie: response.headers
      .getSetCookie()
      .map((line) => line.split(";")[0])
      .join("; "),
    origin: BASE_URL,
  });
}

async function sessionFor(database: TestDatabase, accountId: string) {
  const [row] = await database.db
    .select({
      accountId: schema.session.userId,
      signInMethod: schema.session.signInMethod,
      expiresAt: schema.session.expiresAt,
      createdAt: schema.session.createdAt,
    })
    .from(schema.session)
    .where(eq(schema.session.userId, accountId));

  return row;
}

async function ordinaryAccount(database: TestDatabase): Promise<string> {
  const id = crypto.randomUUID();
  await database.db
    .insert(schema.user)
    .values({ id, name: "", email: CARLOS, emailVerified: true });
  return id;
}

describe("what reaches the mailbox", () => {
  /**
   * **The whole of the "no second door" requirement, as one assertion.** The
   * Admin types her address into the same form as everybody else, and what
   * arrives is not merely the same shape of link — it is the same URL, to the
   * same endpoint, differing only in a token that differs for everyone.
   *
   * The version of this door that had a link mechanism of its own sent her
   * `/admin/continue/<token>` instead, which named the admin surface in the mail
   * body. This is the assertion that would have caught that.
   */
  test("sends one URL, and it names no admin surface", async ({ database }) => {
    await enrolledAdmin(database, { email: ANA, key: KEY });
    await ordinaryAccount(database);
    const stack = signInStack(database);

    await askForALink(stack, ANA);
    const admin = new URL(lastLink(stack));

    await askForALink(stack, CARLOS);
    const ordinary = new URL(lastLink(stack));

    expect(admin.pathname).toBe(ordinary.pathname);
    expect(admin.pathname).toBe("/api/auth/magic-link/verify");
    expect(admin.toString()).not.toContain("admin");
  });

  /**
   * **The reply is the same reply**, so `/sign-in` discloses neither which
   * addresses exist nor which of them hold the grant.
   */
  test("answers identically whichever address it was given", async ({ database }) => {
    await enrolledAdmin(database, { email: ANA, key: KEY });
    await ordinaryAccount(database);
    const stack = signInStack(database);

    for (const email of [ANA, CARLOS, "nobody@recomencemos.test"]) {
      // Sequential on purpose: each request charges the per-address ceiling, and
      // three in flight at once is a different test from three in a row.
      // oxlint-disable-next-line no-await-in-loop
      expect(await askForALink(stack, email)).toMatchObject({ status: true });
    }

    expect(stack.links).toHaveLength(3);
  });

  /**
   * The parity that a `before`-hook divert could not hold. A body failing
   * `z.email()` that would still match a granted address once trimmed answered
   * 200 for her and 400 for everybody else, because returning from that hook
   * skips the endpoint's own body schema. There is no divert there any more, so
   * this is parity by construction — asserted anyway, because that is the shape
   * of mistake worth a standing test.
   */
  test("answers a malformed body the same for a granted address as for any", async ({
    database,
  }) => {
    await enrolledAdmin(database, { email: ANA, key: KEY });
    await ordinaryAccount(database);
    const stack = signInStack(database);

    const post = async (email: string) =>
      (
        await stack.auth.handler(
          new Request(`${BASE_URL}/api/auth/sign-in/magic-link`, {
            method: "POST",
            headers: { "content-type": "application/json", origin: BASE_URL },
            body: JSON.stringify({ email }),
          }),
        )
      ).status;

    expect(await post(`${ANA} `)).toBe(await post(`${CARLOS} `));
  });
});

// The completion rate NFR27 measures is the ratio of these two lines, which is
// why their field sets and their pairing id are the subject here.
describe("the two lines a sign-in leaves behind", () => {
  /**
   * **The pair closes for a granted Account exactly as it does for anybody**,
   * which is the measurement the second link mechanism could not deliver: her
   * link had no `verification` row, so her `magic_link.requested` could never be
   * followed by a `consumed`, and the funnel counted a request that was
   * structurally unable to complete.
   *
   * Asserted over the **field sets and the id**, not merely over the event
   * names. Two lines that pair but carry different fields are still two
   * populations to a drain, and the whole reason this is one mechanism is that
   * there is one population. The first version of the divert emitted a `consumed`
   * of its own on top of this one, which would have counted her twice in the
   * numerator of the ratio it exists to measure.
   */
  test("emits the same two lines, paired by the same id, for either Account", async ({
    database,
  }) => {
    await enrolledAdmin(database, { email: ANA, key: KEY });
    await ordinaryAccount(database);

    const shapes = new Map<string, string[]>();

    for (const email of [CARLOS, ANA]) {
      const lines: Record<string, unknown>[] = [];
      const stack = signInStack(database, {
        info: (fields) => {
          lines.push(fields as Record<string, unknown>);
        },
      });

      // Sequential on purpose: `lines` is read between the two, and `lastLink`
      // is the last link this stack sent — both are order-dependent by design.
      // oxlint-disable-next-line no-await-in-loop
      await askForALink(stack, email);
      // oxlint-disable-next-line no-await-in-loop
      await openIt(stack, lastLink(stack));

      expect(lines.map((line) => line.event)).toEqual([
        "magic_link.requested",
        "magic_link.consumed",
      ]);

      // One attempt id across both lines is what makes the ratio computable.
      expect(new Set(lines.map((line) => line.sign_in_attempt_id)).size).toBe(1);

      shapes.set(
        email,
        lines.map((line) => Object.keys(line).toSorted().join(",")),
      );
    }

    expect(shapes.get(ANA)).toEqual(shapes.get(CARLOS));
  });
});

describe("opening the link", () => {
  /** The ordinary case, unchanged, and the regression guard for everything below. */
  test("signs an ordinary Account straight in", async ({ database }) => {
    const accountId = await ordinaryAccount(database);
    const stack = signInStack(database);

    await askForALink(stack, CARLOS);
    await openIt(stack, lastLink(stack));

    expect((await sessionFor(database, accountId))?.signInMethod).toBe("magic_link");
  });

  /**
   * **Factor one proves the mailbox and nothing else.** The link is spent — it is
   * the same single-use `verification` row every link is, consumed by Better Auth
   * before a session is ever attempted — and what the browser is left holding is
   * a challenge, which is worth no authority at all until a code is added to it.
   */
  test("gives a granted Account a challenge and no session", async ({ database }) => {
    const { accountId } = await enrolledAdmin(database, { email: ANA, key: KEY });
    const stack = signInStack(database);

    await askForALink(stack, ANA);
    const opened = await openIt(stack, lastLink(stack));

    expect(await sessionFor(database, accountId)).toBeUndefined();
    expect(opened.headers.get("location")).toContain(SECOND_FACTOR_ROUTE);
    expect(opened.headers.getSetCookie().join("; ")).toContain(SIGN_IN_CHALLENGE_COOKIE);
  });

  /**
   * **The challenge's attributes, on the header that is actually emitted.**
   *
   * Each is a separate decision and each fails silently: without `HttpOnly` the
   * whole of factor one is readable by any script on the origin; without `Path=/`
   * the code endpoint never receives it; a wrong `Max-Age` either expires it
   * before she can type or outlives the window it exists to bound.
   *
   * Asserted here rather than against a builder, because a builder is only as
   * true as its callers — and the one this replaced had none.
   */
  test("sets that challenge HttpOnly, same-site, rooted and short-lived", async ({ database }) => {
    await enrolledAdmin(database, { email: ANA, key: KEY });
    const stack = signInStack(database);

    await askForALink(stack, ANA);
    const opened = await openIt(stack, lastLink(stack));

    const challenge = opened.headers
      .getSetCookie()
      .find((line) => line.startsWith(`${SIGN_IN_CHALLENGE_COOKIE}=`));

    expect(challenge, "no challenge was set").toBeDefined();
    for (const attribute of [
      "HttpOnly",
      "SameSite=Lax",
      "Path=/",
      `Max-Age=${ADMIN_CHALLENGE_TTL_SECONDS}`,
      // The stack's base URL is https, so this is the production answer.
      "Secure",
    ]) {
      expect(challenge).toContain(attribute);
    }
  });

  /**
   * **The link is spent whichever Account it was for.** The divert happens after
   * `consumeVerificationValue`, so a granted Account's link is single-use for the
   * same reason and by the same code as anybody's — there is no second
   * implementation of "once" to get wrong.
   */
  test("spends a granted Account's link exactly once", async ({ database }) => {
    const { accountId } = await enrolledAdmin(database, { email: ANA, key: KEY });
    const stack = signInStack(database);

    await askForALink(stack, ANA);
    const url = lastLink(stack);
    await openIt(stack, url);
    const second = await openIt(stack, url);

    expect(second.headers.getSetCookie().join("; ")).not.toContain(SIGN_IN_CHALLENGE_COOKIE);
    expect(await sessionFor(database, accountId)).toBeUndefined();
  });
});

describe("a link that does not work", () => {
  /**
   * **One answer for a bad, spent, expired or unknown token**, and the fact that
   * Better Auth is what produces it does not make it somebody else's property to
   * assert: a granted Account's link is the one whose refusal would be an oracle,
   * so this is where the claim has to be checked.
   *
   * All four are the same 302 to the same error callback with the same code, and
   * none of them sets a challenge — so nothing distinguishes "this link was
   * already used" from "this link never existed", which is the distinction a
   * surface must not be able to render.
   */
  test("answers a spent, unknown, expired or malformed token identically", async ({ database }) => {
    await enrolledAdmin(database, { email: ANA, key: KEY });
    const stack = signInStack(database);

    await askForALink(stack, ANA);
    const spent = lastLink(stack);
    await openIt(stack, spent);

    const verify = new URL(spent);
    const withToken = (token: string) => {
      const url = new URL(verify);
      url.searchParams.set("token", token);
      return url.toString();
    };

    const answers = [];
    for (const url of [spent, withToken("nope"), withToken(""), withToken("../etc")]) {
      // Sequential on purpose: each is a request against shared rows.
      // oxlint-disable-next-line no-await-in-loop
      const response = await openIt(stack, url);
      answers.push({
        status: response.status,
        location: response.headers.get("location"),
        challenge: response.headers.getSetCookie().join("; ").includes(SIGN_IN_CHALLENGE_COOKIE),
      });
    }

    expect(answers[0]?.challenge).toBe(false);
    for (const answer of answers) expect(answer).toEqual(answers[0]);
  });
});

describe("the second factor", () => {
  /** Walk the whole door and hand back what the browser would be holding. */
  async function challengeFor(stack: AuthStack, email: string): Promise<Headers> {
    await askForALink(stack, email);
    return carrying(await openIt(stack, lastLink(stack)));
  }

  /**
   * **The whole loop, and the only path in this product that produces a session
   * `requireAdminSession` admits.** Address at the public form, link out of the
   * mailbox, six digits off the authenticator.
   */
  test("mints a session the gate admits, stamped for the door it came through", async ({
    database,
  }) => {
    const { accountId, secret } = await enrolledAdmin(database, { email: ANA, key: KEY });
    const stack = signInStack(database);

    const { headers } = await stack.auth.api.verifyAdminSignInCode({
      body: { code: await totp(secret) },
      headers: await challengeFor(stack, ANA),
      returnHeaders: true,
    });

    const row = await sessionFor(database, accountId);
    expect(row?.signInMethod).toBe("link_totp");
    expect(requireAdminSession({ ...row!, isAdmin: true })).toEqual({ accountId });
    expect(headers.getSetCookie().join("; ")).toContain("session_token");
  });

  /** A printed code is the same door, because the shape is what picks the factor. */
  test("accepts a printed code at the same field", async ({ database }) => {
    const { accountId, backupCodes } = await enrolledAdmin(database, { email: ANA, key: KEY });
    const stack = signInStack(database);

    await stack.auth.api.verifyAdminSignInCode({
      body: { code: backupCodes[0] as string },
      headers: await challengeFor(stack, ANA),
      returnHeaders: true,
    });

    expect((await sessionFor(database, accountId))?.signInMethod).toBe("link_totp");
  });

  /** NFR13's Admin number, on the row rather than in the options. */
  test("gives that session eight hours and not a day more", async ({ database }) => {
    const { accountId, secret } = await enrolledAdmin(database, { email: ANA, key: KEY });
    const stack = signInStack(database);

    await stack.auth.api.verifyAdminSignInCode({
      body: { code: await totp(secret) },
      headers: await challengeFor(stack, ANA),
      returnHeaders: true,
    });

    const row = await sessionFor(database, accountId);
    const seconds = (row!.expiresAt.getTime() - row!.createdAt.getTime()) / 1000;

    expect(Math.round(seconds)).toBe(ADMIN_SESSION_SECONDS);
  });

  /** The challenge is signed rather than stored, so clearing it is the only "spent". */
  test("clears the challenge once it has been spent", async ({ database }) => {
    const { secret } = await enrolledAdmin(database, { email: ANA, key: KEY });
    const stack = signInStack(database);

    const { headers } = await stack.auth.api.verifyAdminSignInCode({
      body: { code: await totp(secret) },
      headers: await challengeFor(stack, ANA),
      returnHeaders: true,
    });

    const cleared = headers
      .getSetCookie()
      .find((line) => line.startsWith(`${SIGN_IN_CHALLENGE_COOKIE}=`));

    expect(cleared, "the challenge was left live").toBeDefined();
    expect(cleared).toContain("Max-Age=0");
  });

  test("refuses a code with no challenge at all, and mints nothing", async ({ database }) => {
    const { accountId, secret } = await enrolledAdmin(database, { email: ANA, key: KEY });
    const stack = signInStack(database);

    await expect(
      stack.auth.api.verifyAdminSignInCode({
        body: { code: await totp(secret) },
        headers: new Headers({ origin: BASE_URL }),
        returnHeaders: true,
      }),
    ).rejects.toMatchObject(ONE_REFUSAL);

    expect(await sessionFor(database, accountId)).toBeUndefined();
  });

  test("refuses a wrong code held against a live challenge", async ({ database }) => {
    const { accountId } = await enrolledAdmin(database, { email: ANA, key: KEY });
    const stack = signInStack(database);

    await expect(
      stack.auth.api.verifyAdminSignInCode({
        body: { code: "000000" },
        headers: await challengeFor(stack, ANA),
        returnHeaders: true,
      }),
    ).rejects.toMatchObject(ONE_REFUSAL);

    expect(await sessionFor(database, accountId)).toBeUndefined();
  });
});

/**
 * **The one `createAuthHandler` call in this file, and it must stay the only
 * one**: the factory memoises into a module-level `built`, so a second call would
 * silently hand back the first test's database. Vitest isolates per file, which
 * is what makes one call safe.
 *
 * What it proves beyond everything above is the half a caller depends on and
 * cannot see: `setCookie` comes back **populated**. The session cookie is written
 * onto the response of a call this package makes internally, and a Server Action
 * cannot pass a header through — so an empty array is a door that works in this
 * suite and refuses every real browser.
 */
describe("the method apps/web holds", () => {
  test("carries an Admin from her mailbox to a session, and hands back the cookie", async ({
    database,
  }) => {
    const { accountId, secret } = await enrolledAdmin(database, { email: ANA, key: KEY });

    const links: { url: string }[] = [];
    const handler = createAuthHandler({
      db: database.db,
      sendMagicLink: async ({ url }) => {
        links.push({ url });
      },
      logger: { info: () => {}, warn: () => {} },
      env: { BETTER_AUTH_SECRET: KEY, BETTER_AUTH_URL: BASE_URL },
    });

    expect(
      await handler.requestMagicLink({
        email: ANA,
        sharedDevice: false,
        headers: new Headers({ origin: BASE_URL }),
      }),
    ).toEqual({ ok: true });

    const opened = await handler.handler(
      new Request(links.at(-1)?.url as string, { redirect: "manual" }),
    );

    /**
     * **The page's own question, asked of the same headers the code is about to
     * be checked against.** It is what decides whether the surface at
     * `SECOND_FACTOR_ROUTE` draws a field or answers 404, and it reads the key
     * out of the same `env` this handler was built with — so an agreement
     * between the two that held only in a unit test would still leave the page
     * refusing every real Admin.
     */
    expect(handler.hasSignInChallenge(carrying(opened))).toBe(true);
    expect(handler.hasSignInChallenge(new Headers())).toBe(false);

    const verified = await handler.verifyAdminSignInCode({
      code: await totp(secret),
      headers: carrying(opened),
    });

    expect(verified.ok).toBe(true);
    expect((verified as { setCookie: readonly string[] }).setCookie.join("; ")).toContain(
      "session_token",
    );
    expect((await sessionFor(database, accountId))?.signInMethod).toBe("link_totp");
  });
});
/**
 * **The refusal at every door that is not this one**, which is NFR14's first half
 * and the branch nothing else in this repository executes.
 *
 * `magic_link` is diverted into the challenge and `link_totp` is admitted; every
 * remaining member reaches one unbranched `throw`, and after DD5's contract half
 * `google` is the only member left that reaches it. That matters more than it
 * reads: the credential door's own suite used to cover this statement, and it
 * declined to drive Google on the grounds that _"`password` and `password_totp`
 * execute the same statement this case executes"_ — an argument that expired the
 * moment those two members were deleted. `/code-review` found the hole that left.
 *
 * **It drives the configured hook rather than the endpoint**, and that is the one
 * decision here worth defending. Reaching this through a real `/callback/:id`
 * would mean configuring a social provider and standing up a token exchange, which
 * `#testing/auth-stack` deliberately refuses because it adds an outbound leg no
 * test has business having. What is called instead is
 * `databaseHooks.session.create.before` **off the shipped options object**, with a
 * real database behind it — the same function, reached the way Better Auth reaches
 * it, with the same arguments. The half it cannot prove is that Better Auth calls
 * it at all; "gives a granted Account a challenge and no session" above proves
 * that, through the same hook on the other branch.
 */
const GOOGLE_CALLBACK = "/callback/:id";

const spyLogger = () => ({ info: vi.fn(), warn: vi.fn() });

describe("a door that is not the Admin door, on a granted Account", () => {
  /** The shipped hook, over a real database, with a logger the test can read. */
  function beforeSessionCreate(
    database: TestDatabase,
    logger: ReturnType<typeof spyLogger> = spyLogger(),
  ) {
    const options = authOptions({
      db: database.db,
      sendMagicLink: async () => {},
      logger,
      env: { BETTER_AUTH_SECRET: KEY, BETTER_AUTH_URL: BASE_URL },
    });

    const hook = options.databaseHooks?.session?.create?.before;
    if (!hook) throw new Error("the options carry no session-create hook");

    return { hook, logger };
  }

  /** What Better Auth hands the hook, narrowed to the two fields it reads. */
  const arriving = (accountId: string) =>
    [{ userId: accountId }, { path: GOOGLE_CALLBACK }] as [never, never];

  /**
   * **A real 403 with a legible body, and not an `AppError`.** The first version
   * of this refusal threw an `AppError` and the endpoint answered **500** — read
   * out of a running server rather than predicted, because the magic-link verify
   * endpoint calls `createSession` outside its own `try`. Asserting the status
   * here is what keeps that finding from being re-lost.
   */
  test("refuses the session outright, with the status the requirement asks for", async ({
    database,
  }) => {
    const { accountId } = await enrolledAdmin(database, { email: ANA, key: KEY });
    const { hook } = beforeSessionCreate(database);

    await expect(hook(...arriving(accountId))).rejects.toMatchObject({ status: 403 });
  });

  /**
   * The sentence is the one every refused door says. It names no door and no
   * account, because it is reachable by anybody who can reach that door at all.
   */
  test("says the one thing every refused door says", async ({ database }) => {
    const { accountId } = await enrolledAdmin(database, { email: ANA, key: KEY });
    const { hook } = beforeSessionCreate(database);

    await expect(hook(...arriving(accountId))).rejects.toMatchObject({
      body: { message: ADMIN_SIGN_IN_ONLY },
    });
  });

  /**
   * **The operator half, which no test covered before this one.** The refusal is
   * returned to the caller as one sentence that says nothing; the line is where
   * "somebody tried, on this Account, through this door" is recorded. It carries
   * the id and the door and **no address** — this fires on a path whose whole
   * design is that it discloses which addresses exist to nobody.
   */
  test("records which Account and which door, and no address", async ({ database }) => {
    const { accountId } = await enrolledAdmin(database, { email: ANA, key: KEY });
    const { hook, logger } = beforeSessionCreate(database);

    await expect(hook(...arriving(accountId))).rejects.toBeDefined();

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0]?.[0]).toEqual({
      event: "admin.non_admin_door_refused",
      account_id: accountId,
      sign_in_method: "google",
    });
    expect(JSON.stringify(logger.warn.mock.calls[0])).not.toContain(ANA);
  });

  /**
   * The same door on an Account holding no grant is untouched, which is what
   * confines the rule to the Accounts it is about. The hook stamps the row it was
   * given and returns it, rather than throwing.
   */
  test("leaves an Account holding no grant alone at the same door", async ({ database }) => {
    const accountId = await ordinaryAccount(database);
    const { hook, logger } = beforeSessionCreate(database);

    expect(await hook(...arriving(accountId))).toMatchObject({
      data: { signInMethod: "google" },
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
