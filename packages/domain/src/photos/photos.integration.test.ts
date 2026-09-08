/**
 * Seam 2 over the photo's state machine — criterion 10's first half.
 *
 * **What is here and what is deliberately not.** These cases drive the *rows*:
 * every transition the four states allow, every one they refuse, and the two
 * properties that only a database can settle — that a decision and its
 * `AdminAction` commit together, and that a second Admin arriving on a photo
 * somebody has already decided is refused rather than allowed to decide it
 * twice.
 *
 * **No object store is involved and none is mocked.** `attachPhoto` and the two
 * Admin handlers are the row halves of DD6's steps 3, 4 and 5; the bytes are
 * `@repo/storage`'s and are exercised against a real bucket by
 * `pnpm test:store`. That split is what lets this file run in PGlite with no
 * Docker, which is the same argument seam 2 already rests on — and it is why
 * `approvePhoto` here is called through `runAdminAction` rather than through
 * `#photos`'s `approve`, which re-encodes before it transacts.
 *
 * **The one thing this seam structurally cannot prove** is the race it is
 * arranged against: PGlite is single-connection, so `FOR UPDATE` is never
 * contended here. What these cases do prove is the *observable* half — that the
 * second decision is refused on the state it reads — which is the part a lock
 * exists to make true under concurrency and which is true here by sequence.
 */

import { eq } from "drizzle-orm";
import { runAdminAction } from "#admin/index";
import type { AdminActor } from "#admin/actor";
import { CURRENT_CONSENT_VERSIONS } from "#consent/registry";
import { attachPhoto, pendingPhotos } from "#photos";
import { publishProfile } from "#profiles";
import * as schema from "#schema";
import { signIn, signInStack } from "#testing/auth-stack";
import { test } from "#testing/fixtures";
import type { TestDatabase } from "#testing/fixtures";

const ADMIN_ID = "the-admin";
const actor = { accountId: ADMIN_ID } as AdminActor;

/** Shaped exactly as `@repo/storage` mints them, so a fixture cannot drift into a refusal. */
const KEY = "quarantine/aaaaaaaaaaaaaaaaaaaaa";
const OTHER_KEY = "quarantine/bbbbbbbbbbbbbbbbbbbbb";
const PUBLIC_KEY = "photos/aaaaaaaaaaaaaaaaaaaaa.webp";

const PUBLISHED = {
  fullName: "Ana María Restrepo Gómez",
  firstName: "Ana María",
  lastInitial: "R",
  city: "dosquebradas",
  headline: "Cocino almuerzos y comida casera para eventos pequeños",
  about: "Diez años cocinando para familias y para fiestas de barrio.",
  phone: "300 123 4567",
  skillSlugs: ["home-cooking"],
  workHistory: [],
  consentVersions: CURRENT_CONSENT_VERSIONS,
} as const;

async function anAdmin(database: TestDatabase): Promise<void> {
  await database.db.insert(schema.user).values({
    id: ADMIN_ID,
    name: "Quien revisa",
    email: "admin@recomencemos.test",
    emailVerified: true,
    isAdmin: true,
  });
}

/** A published profile, and the Account and profile ids that name it. */
async function published(database: TestDatabase, email = "ana@recomencemos.test") {
  const stack = signInStack(database);
  await signIn(stack, email);

  const [account] = await database.db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, email));

  const accountId = (account as { id: string }).id;
  const outcome = await publishProfile(database.db, accountId, PUBLISHED);

  if (!outcome.ok) throw new Error("the fixture failed to publish");

  const [row] = await database.db
    .select({ id: schema.capabilityProfile.id })
    .from(schema.capabilityProfile)
    .where(eq(schema.capabilityProfile.accountId, accountId));

  return { accountId, profileId: String((row as { id: bigint }).id) };
}

/** The three photo columns, read straight out of the row. */
async function photoRow(database: TestDatabase, profileId: string) {
  const [row] = await database.db
    .select({
      photoState: schema.capabilityProfile.photoState,
      photoKey: schema.capabilityProfile.photoKey,
      photoAttachedAt: schema.capabilityProfile.photoAttachedAt,
    })
    .from(schema.capabilityProfile)
    .where(eq(schema.capabilityProfile.id, BigInt(profileId)));

  return row as {
    photoState: string;
    photoKey: string | null;
    photoAttachedAt: Date | null;
  };
}

const auditRows = (database: TestDatabase) =>
  database.db
    .select({
      action: schema.adminAction.action,
      targetId: schema.adminAction.targetId,
    })
    .from(schema.adminAction);

describe("a profile publishes without waiting for a photo", () => {
  /**
   * NFR1 and NFR6 held at once, which is the whole shape of this ticket: the
   * profile is live on commit and its photo is not part of that commit.
   */
  test("starts at absent, with no key and nothing waiting", async ({ database }) => {
    const { profileId } = await published(database);

    expect(await photoRow(database, profileId)).toEqual({
      photoState: "absent",
      photoKey: null,
      photoAttachedAt: null,
    });
  });
});

/**
 * Record the intent `createPhotoUpload` would have written, without signing
 * anything.
 *
 * The presign is `@repo/storage`'s and needs a bucket; what this seam is about
 * is the *binding*, which is a row. Inserting it directly keeps these cases
 * runnable in PGlite and asserts exactly the thing under test — that
 * `attachPhoto` consults the row rather than the key's shape.
 */
async function intentFor(database: TestDatabase, accountId: string, photoKey: string) {
  await database.db.insert(schema.photoUpload).values({ accountId, photoKey });
}

/**
 * Mint-then-attach: the sequence the product actually performs, for the cases
 * that are about something other than the binding itself.
 */
async function attach(database: TestDatabase, accountId: string, key: string) {
  await intentFor(database, accountId, key);
  return attachPhoto(database.db, accountId, key);
}

describe("attachPhoto", () => {
  test("moves absent to pending and stamps when the wait began", async ({ database }) => {
    const { accountId, profileId } = await published(database);
    await intentFor(database, accountId, KEY);

    const outcome = await attachPhoto(database.db, accountId, KEY);

    expect(outcome).toEqual({ ok: true, photoState: "pending" });

    const row = await photoRow(database, profileId);
    expect({ photoState: row.photoState, photoKey: row.photoKey }).toEqual({
      photoState: "pending",
      photoKey: KEY,
    });
    expect(row.photoAttachedAt).toBeInstanceOf(Date);
  });

  /**
   * The key round-trips through the browser between `createPhotoUpload` and
   * here, so by the time it arrives it is a caller-controlled value. Each of
   * these is a way an unvalidated one becomes part of a URL or points at
   * somebody else's object.
   */
  // `test.for` rather than `test.each`: only `for` forwards the fixture
  // context, and `each` hands the callback the case values alone — which is a
  // `Cannot destructure property 'database' of 'undefined'` at the first line.
  test.for([
    ["a traversal", "quarantine/../photos/aaaaaaaaaaaaaaaaaaaaa"],
    ["a public key", PUBLIC_KEY],
    ["a bare string", "whatever-she-called-it.jpg"],
    ["an empty key", ""],
  ] as const)("refuses %s, and leaves the row absent", async ([, key], { database }) => {
    const { accountId, profileId } = await published(database);

    const outcome = await attachPhoto(database.db, accountId, key);

    expect(outcome.ok).toBe(false);
    expect((await photoRow(database, profileId)).photoState).toBe("absent");
  });

  /**
   * The refusal is a returned value rather than a throw — NFR26's second half,
   * which C51 restates for every refusal in the UX table. A crawler that could
   * raise an `AppError` here would spend the month's Sentry allowance in a day.
   */
  test("refuses an Account with no profile, by return", async ({ database }) => {
    const stack = signInStack(database);
    await signIn(stack, "nobody@recomencemos.test");

    const [account] = await database.db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.email, "nobody@recomencemos.test"));

    const accountId = (account as { id: string }).id;
    await intentFor(database, accountId, KEY);

    const outcome = await attachPhoto(database.db, accountId, KEY);

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("unreachable");
    expect(outcome.error.status).toBe(404);
  });

  /**
   * **The exploit `/security-review` found, pinned.**
   *
   * A shape check cannot tell one valid key from another. Before the binding,
   * an attacker read an approved photo's public URL off the Wall, derived the
   * quarantine key it had been named from, signed up, and published a profile
   * pointing at somebody else's face — which an Admin would then approve onto a
   * stranger's public card.
   *
   * The key here is perfectly well-formed and was minted for somebody else,
   * which is the whole point: it passes every shape check in the system.
   */
  test("refuses a well-formed key minted for another Account", async ({ database }) => {
    const victim = await published(database, "victim@recomencemos.test");
    const attacker = await published(database, "attacker@recomencemos.test");
    await intentFor(database, victim.accountId, KEY);

    const outcome = await attachPhoto(database.db, attacker.accountId, KEY);

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("unreachable");
    expect(outcome.error.status).toBe(403);
    expect((await photoRow(database, attacker.profileId)).photoState).toBe("absent");
  });

  /** And the rightful owner's intent survives the attempt, so she can still use it. */
  test("leaves the owner's intent usable after a failed appropriation", async ({ database }) => {
    const victim = await published(database, "victim@recomencemos.test");
    const attacker = await published(database, "attacker@recomencemos.test");
    await intentFor(database, victim.accountId, KEY);

    await attachPhoto(database.db, attacker.accountId, KEY);

    expect(await attachPhoto(database.db, victim.accountId, KEY)).toEqual({
      ok: true,
      photoState: "pending",
    });
  });

  /**
   * **A key is good for exactly one attach.** The row is consumed by the attach
   * that uses it, so replaying the same key — the shape a leaked one would take
   * — finds nothing.
   */
  test("refuses a key that has already been attached", async ({ database }) => {
    const { accountId } = await published(database);
    await intentFor(database, accountId, KEY);

    expect((await attachPhoto(database.db, accountId, KEY)).ok).toBe(true);

    const replay = await attachPhoto(database.db, accountId, KEY);

    expect(replay.ok).toBe(false);
    if (replay.ok) throw new Error("unreachable");
    expect(replay.error.status).toBe(403);
  });

  /**
   * Nothing was ever minted for this Account, so a caller inventing a
   * shape-valid key gets nowhere. This is the case showing the check does not
   * rest on the key being unguessable.
   */
  test("refuses a shape-valid key nobody was ever given", async ({ database }) => {
    const { accountId, profileId } = await published(database);

    const outcome = await attachPhoto(database.db, accountId, KEY);

    expect(outcome.ok).toBe(false);
    expect((await photoRow(database, profileId)).photoState).toBe("absent");
  });

  /**
   * She picked a second photo before anyone looked at the first. The row names
   * the newer object and the wait restarts, because what an Admin is about to
   * see is the new picture and the queue's age should say how long *that* has
   * been waiting.
   */
  test("replaces a pending photo with a newer one, and restarts the wait", async ({ database }) => {
    const { accountId, profileId } = await published(database);

    await attach(database, accountId, KEY);
    const first = await photoRow(database, profileId);

    await attach(database, accountId, OTHER_KEY);
    const second = await photoRow(database, profileId);

    expect(second.photoKey).toBe(OTHER_KEY);
    expect(second.photoState).toBe("pending");
    expect(second.photoAttachedAt?.getTime()).toBeGreaterThanOrEqual(
      first.photoAttachedAt?.getTime() as number,
    );
  });

  /** She was refused once and picks again. `rejected` is not a terminal state. */
  test("lets a rejected photo be replaced", async ({ database }) => {
    const { accountId, profileId } = await published(database);
    await anAdmin(database);

    await attach(database, accountId, KEY);
    await runAdminAction(database.db, actor, "rejectPhoto", { profileId });

    expect((await photoRow(database, profileId)).photoState).toBe("rejected");

    await attach(database, accountId, OTHER_KEY);

    expect((await photoRow(database, profileId)).photoState).toBe("pending");
  });
});

describe("approvePhoto", () => {
  test("publishes the photo and points the row at the public object", async ({ database }) => {
    const { accountId, profileId } = await published(database);
    await anAdmin(database);
    await attach(database, accountId, KEY);

    const outcome = await runAdminAction(database.db, actor, "approvePhoto", {
      profileId,
      publicKey: PUBLIC_KEY,
    });

    expect(outcome).toEqual({ ok: true, result: { photoState: "approved" } });
    expect(await photoRow(database, profileId)).toEqual({
      photoState: "approved",
      photoKey: PUBLIC_KEY,
      // Cleared, because nothing is waiting any more — a stale value here would
      // age a branch this row has left, which is NFR7's detector reading a
      // number that is not about anything.
      photoAttachedAt: null,
    });
  });

  /** NFR33: the act and its audit row commit together. */
  test("writes one AdminAction naming the profile", async ({ database }) => {
    const { accountId, profileId } = await published(database);
    await anAdmin(database);
    await attach(database, accountId, KEY);

    await runAdminAction(database.db, actor, "approvePhoto", { profileId, publicKey: PUBLIC_KEY });

    expect(await auditRows(database)).toEqual([{ action: "approvePhoto", targetId: profileId }]);
  });
});

describe("rejectPhoto", () => {
  /**
   * `photoKey` goes to `NULL`, which is what makes `rejected` and `absent`
   * render identically on every public surface without either being a special
   * case at the reader. The key travels back in the result so the caller can
   * delete the object — DD6 step 5 — and is never rendered.
   */
  test("clears the key and hands it back for deletion", async ({ database }) => {
    const { accountId, profileId } = await published(database);
    await anAdmin(database);
    await attach(database, accountId, KEY);

    const outcome = await runAdminAction(database.db, actor, "rejectPhoto", { profileId });

    expect(outcome).toEqual({
      ok: true,
      result: { photoState: "rejected", discardedKey: KEY },
    });
    expect(await photoRow(database, profileId)).toEqual({
      photoState: "rejected",
      photoKey: null,
      photoAttachedAt: null,
    });
  });

  test("writes one AdminAction naming the profile", async ({ database }) => {
    const { accountId, profileId } = await published(database);
    await anAdmin(database);
    await attach(database, accountId, KEY);

    await runAdminAction(database.db, actor, "rejectPhoto", { profileId });

    expect(await auditRows(database)).toEqual([{ action: "rejectPhoto", targetId: profileId }]);
  });
});

describe("the transitions the state machine refuses", () => {
  /**
   * The second Admin's case, and the reason the handler reads under
   * `FOR UPDATE`. Sequenced rather than concurrent — PGlite is
   * single-connection — so what this proves is that the decision is made on the
   * state read rather than blindly applied.
   */
  test.for(["approvePhoto", "rejectPhoto"] as const)(
    "refuses %s on a photo already decided",
    async (action, { database }) => {
      const { accountId, profileId } = await published(database);
      await anAdmin(database);
      await attach(database, accountId, KEY);

      await runAdminAction(database.db, actor, "approvePhoto", {
        profileId,
        publicKey: PUBLIC_KEY,
      });

      const second =
        action === "approvePhoto"
          ? await runAdminAction(database.db, actor, action, { profileId, publicKey: PUBLIC_KEY })
          : await runAdminAction(database.db, actor, action, { profileId });

      expect(second.ok).toBe(false);
      if (second.ok) throw new Error("unreachable");
      expect(second.error.status).toBe(409);
    },
  );

  /**
   * **No `AdminAction` for an act that did not happen**, which is the property
   * that makes the audit table readable at all: a refused decision rolls the
   * row back with it, so the table never records something nobody did.
   */
  test("writes no AdminAction when a decision is refused", async ({ database }) => {
    const { accountId, profileId } = await published(database);
    await anAdmin(database);
    await attach(database, accountId, KEY);
    await runAdminAction(database.db, actor, "rejectPhoto", { profileId });

    await runAdminAction(database.db, actor, "approvePhoto", { profileId, publicKey: PUBLIC_KEY });

    expect(await auditRows(database)).toEqual([{ action: "rejectPhoto", targetId: profileId }]);
  });

  test.for(["approvePhoto", "rejectPhoto"] as const)(
    "refuses %s on a profile with no photo waiting",
    async (action, { database }) => {
      const { profileId } = await published(database);
      await anAdmin(database);

      const outcome =
        action === "approvePhoto"
          ? await runAdminAction(database.db, actor, action, { profileId, publicKey: PUBLIC_KEY })
          : await runAdminAction(database.db, actor, action, { profileId });

      expect(outcome.ok).toBe(false);
      expect(await auditRows(database)).toEqual([]);
    },
  );

  test("refuses a decision on a profile id no row carries", async ({ database }) => {
    await anAdmin(database);

    const outcome = await runAdminAction(database.db, actor, "rejectPhoto", { profileId: "999" });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("unreachable");
    expect(outcome.error.status).toBe(404);
  });
});

describe("pendingPhotos", () => {
  /**
   * C55, and the mistake the queue's own class comment says the first person to
   * add a source would make: the cap is on the rendering and the two figures
   * are computed over the whole branch. A branch of four hundred reporting a
   * depth of twenty is NFR7's detector silently disabled.
   */
  test("caps what it renders and counts what it does not", async ({ database }) => {
    await anAdmin(database);

    // Sequential on purpose, and the rule's own remedy is wrong here:
    // `Promise.all` would attach five photos at indistinguishable instants, and
    // what this branch is read for is the age of the *oldest*. PGlite is
    // single-connection anyway, so the parallelism the rule is protecting does
    // not exist.
    for (let i = 0; i < 5; i++) {
      // oxlint-disable-next-line no-await-in-loop
      const { accountId } = await published(database, `worker${i}@recomencemos.test`);
      // oxlint-disable-next-line no-await-in-loop
      await attach(database, accountId, `quarantine/${"c".repeat(20)}${i}`);
    }

    const branch = await pendingPhotos(database.db, 2);

    expect(branch.items).toHaveLength(2);
    expect(branch.total).toBe(5);
    expect(branch.oldestAttachedAt).toBeInstanceOf(Date);
  });

  test("returns the oldest first, so an Admin works the queue in order", async ({ database }) => {
    const first = await published(database, "first@recomencemos.test");
    const second = await published(database, "second@recomencemos.test");

    await attach(database, first.accountId, KEY);
    await attach(database, second.accountId, OTHER_KEY);

    const branch = await pendingPhotos(database.db, 20);

    expect(branch.items.map((item) => item.profileId)).toEqual([first.profileId, second.profileId]);
  });

  /** An empty branch is a real and good state, and says so with zero and null. */
  test("reports an empty branch rather than nothing", async ({ database }) => {
    await published(database);

    expect(await pendingPhotos(database.db, 20)).toEqual({
      items: [],
      total: 0,
      oldestAttachedAt: null,
    });
  });

  /** A decided photo leaves the branch, which is what lets an Admin clear it. */
  test("excludes photos that have been decided", async ({ database }) => {
    const { accountId, profileId } = await published(database);
    await anAdmin(database);
    await attach(database, accountId, KEY);

    expect((await pendingPhotos(database.db, 20)).total).toBe(1);

    await runAdminAction(database.db, actor, "approvePhoto", { profileId, publicKey: PUBLIC_KEY });

    expect((await pendingPhotos(database.db, 20)).total).toBe(0);
  });
});
