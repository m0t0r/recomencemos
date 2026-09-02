/**
 * NFR33 at seam 2: **100%** of Admin actions write an `AdminAction`, and **0** can
 * commit unaudited.
 *
 * **The completeness half is table-driven over the registry**, which is what the
 * requirement asks for in as many words — _"asserted by a table-driven test over
 * the action registry … which is red for an action added without one"_. So the
 * suite below does not name `revokeSessions` in its audit cases at all: it
 * enumerates `ADMIN_ACTION_NAMES` and drives every member through the same
 * assertions, from one table of inputs. A twelfth action is covered the moment its
 * name and its input exist, and an action added with neither is red here rather
 * than silently uncovered.
 */

import { AppError } from "@repo/errors/app-error";
import { eq } from "drizzle-orm";
import { type AdminActionInput, runAdminAction } from "#admin/index";
import type { AdminActor } from "#admin/actor";
import { ADMIN_ACTION_NAMES, type AdminActionName } from "#admin/names";
import * as schema from "#schema";
import { signIn, signInStack } from "#testing/auth-stack";
import { test } from "#testing/fixtures";
import type { TestDatabase } from "#testing/fixtures";

const ADMIN_ID = "the-admin";
const TARGET = "ana@recomencemos.test";

/**
 * The `SkillRequest` `promoteSkill` acts on, pinned rather than read back.
 *
 * The column is `GENERATED ALWAYS AS IDENTITY`, so the seed writes this value
 * with `OVERRIDING SYSTEM VALUE` — which is what lets {@link INPUTS} be a
 * constant. Reading the key back would mean building the inputs per case, and the
 * completeness table's whole shape is one static input per registered action.
 *
 * It is also the id used by the refusal case, which runs with **nothing** seeded:
 * a request that is not there is `promoteSkill`'s "act that did not happen".
 */
const REQUEST_ID = "4242";

/**
 * The actor, forged for the test.
 *
 * **The cast is the only one in this suite and it is deliberate**: `AdminActor`'s
 * brand is what stops production code constructing one, and `actor.test.ts` plus
 * `admin-door.integration.test.ts` are what prove `requireAdminSession` hands one
 * out only to a session that presented both factors. Re-establishing that here
 * would cost a full sign-in per case to re-assert something already proven, and
 * would make this file about authentication rather than about the audit.
 */
const actor = { accountId: ADMIN_ID } as AdminActor;

/**
 * One valid input per registered action, so the completeness table has something
 * to drive each member with.
 *
 * **The `satisfies` is the second half of the completeness check.** A name added
 * to `ADMIN_ACTION_NAMES` with no entry here fails to compile, so "every action is
 * covered" is not a claim this file makes about itself — it is a condition of the
 * file type-checking at all.
 */
const INPUTS = {
  revokeSessions: { email: TARGET },
  promoteSkill: {
    requestId: REQUEST_ID,
    slug: "sewing-machine-repair",
    labelEs: "Arreglo máquinas de coser",
  },
} satisfies { [K in AdminActionName]: AdminActionInput<K> };

/** An Account with two live sessions, so `revokeSessions` has something to revoke. */
async function targetWithSessions(database: TestDatabase): Promise<string> {
  const stack = signInStack(database);
  await signIn(stack, TARGET, { userAgent: "one" });
  await signIn(stack, TARGET, { userAgent: "two" });

  const [account] = await database.db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, TARGET));

  return (account as { id: string }).id;
}

/** A pending request for `promoteSkill` to resolve, under a key the table can name. */
async function pendingRequest(database: TestDatabase): Promise<void> {
  await database.db.insert(schema.user).values({
    id: "the-worker",
    name: "Ana",
    email: "worker@recomencemos.test",
    emailVerified: true,
  });

  await database.db
    .insert(schema.skillRequest)
    .overridingSystemValue()
    .values({ id: BigInt(REQUEST_ID), accountId: "the-worker", text: "Arreglo máquinas de coser" });
}

/** Everything each registered action needs to exist before it can run. */
async function seedFor(database: TestDatabase, action: AdminActionName): Promise<void> {
  if (action === "revokeSessions") await targetWithSessions(database);
  if (action === "promoteSkill") await pendingRequest(database);
}

const audit = (database: TestDatabase) =>
  database.db
    .select({
      actorAccountId: schema.adminAction.actorAccountId,
      action: schema.adminAction.action,
      targetId: schema.adminAction.targetId,
      createdAt: schema.adminAction.createdAt,
    })
    .from(schema.adminAction);

describe.each(ADMIN_ACTION_NAMES)("every Admin action: %s", (action) => {
  test("leaves exactly one AdminAction when it succeeds", async ({ database }) => {
    await seedFor(database, action);

    const outcome = await runAdminAction(database.db, actor, action, INPUTS[action]);
    expect(outcome.ok, `${action} refused: ${outcome.ok ? "" : outcome.error.message}`).toBe(true);

    const rows = await audit(database);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actorAccountId: ADMIN_ID, action });
    expect(rows[0]?.targetId).toBeTruthy();
  });

  /**
   * **The other direction, and the one an insert-at-the-end-of-each-handler
   * implementation gets wrong.** An act that did not happen must leave no record
   * that it did; the shared transaction is what makes that true, and this is what
   * says the transaction is really shared.
   */
  test("leaves no AdminAction when it refuses", async ({ database }) => {
    const outcome = await runAdminAction(database.db, actor, action, INPUTS[action]);

    expect(outcome.ok).toBe(false);
    expect(await audit(database)).toEqual([]);
  });

  /**
   * NFR33 and the Core entities rule: _"ids and enum values only"_. Asserted as a
   * **column list** rather than by inspecting values, because the failure this
   * guards is a later column — `targetEmail`, `reason`, `note` — added to a table
   * retained 24 months, which is the longest retention in the system.
   */
  test("records ids and enum values and nothing else", async ({ database }) => {
    await seedFor(database, action);
    await runAdminAction(database.db, actor, action, INPUTS[action]);

    const [row] = await database.db.select().from(schema.adminAction);
    expect(Object.keys(row ?? {}).toSorted()).toEqual([
      "action",
      "actorAccountId",
      "createdAt",
      "id",
      "targetId",
    ]);
  });

  /**
   * **NFR18's other half, over the values rather than the shape.** An email
   * address, a phrase somebody typed, or any other input value reaching a
   * 24-month table is exactly the "second copy of the thing NFR11 counts" NFR33
   * refuses. The row may name the target by id and by nothing else.
   *
   * **The target id is the exception, and it is the one this table has to make
   * explicit.** `revokeSessions` takes an address and audits an Account id, so no
   * input value can legitimately appear; `promoteSkill` takes the request's own
   * id, and that id *is* the target — the row's whole job is to name what was
   * acted on. Skipping the value that equals `targetId` keeps the assertion about
   * what it is about: every **other** input value, whatever the action, stays out.
   */
  test("puts no input value in the row but the id it acted on", async ({ database }) => {
    await seedFor(database, action);
    await runAdminAction(database.db, actor, action, INPUTS[action]);

    const [row] = await database.db.select().from(schema.adminAction);
    const written = JSON.stringify({ ...row, id: undefined });

    for (const value of Object.values(INPUTS[action] as Record<string, unknown>)) {
      if (String(value) === row?.targetId) continue;
      expect(written).not.toContain(String(value));
    }
  });
});

describe("the audit survives what it audits", () => {
  /**
   * **AC4, and the reason `admin_action` has no foreign keys.** The Account this
   * action was taken against is deleted — story 13's habeas data path, or a
   * moderation ban — and the record of the act stays. A `REFERENCES … ON DELETE
   * CASCADE` would have removed it at the moment it started to matter.
   */
  test("keeps the row when the target Account is deleted", async ({ database }) => {
    const targetId = await targetWithSessions(database);
    await runAdminAction(database.db, actor, "revokeSessions", { email: TARGET });

    await database.db.delete(schema.user).where(eq(schema.user.id, targetId));

    const rows = await audit(database);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.targetId).toBe(targetId);
  });

  /** The same for the Admin, whose Account is no more permanent than anyone's. */
  test("keeps the row when the acting Admin's Account is deleted", async ({ database }) => {
    await targetWithSessions(database);
    await runAdminAction(database.db, actor, "revokeSessions", { email: TARGET });

    const rows = await audit(database);
    expect(rows[0]?.actorAccountId).toBe(ADMIN_ID);
    // The actor id is not a foreign key, so it need not name a row that exists —
    // which is the property under test, stated as the fact that this insert
    // succeeded at all against an id no `user` row carries.
    expect(
      await database.db.select().from(schema.user).where(eq(schema.user.id, ADMIN_ID)),
    ).toEqual([]);
  });
});

describe("revokeSessions", () => {
  test("ends every session of the target Account", async ({ database }) => {
    const targetId = await targetWithSessions(database);

    const outcome = await runAdminAction(database.db, actor, "revokeSessions", { email: TARGET });

    expect(outcome).toMatchObject({ ok: true, result: { revoked: 2 } });
    expect(
      await database.db.select().from(schema.session).where(eq(schema.session.userId, targetId)),
    ).toEqual([]);
  });

  /**
   * The address is `citext` (DD2), so one person cannot hold two Accounts by
   * capitalising — and an Admin typing the address off a Report should not have to
   * match its case either.
   */
  test("finds the Account whatever the address's case", async ({ database }) => {
    await targetWithSessions(database);

    const outcome = await runAdminAction(database.db, actor, "revokeSessions", {
      email: "Ana@Recomencemos.Test",
    });

    expect(outcome).toMatchObject({ ok: true, result: { revoked: 2 } });
  });

  /**
   * **The refusal names no address**, because `context` reaches the log line and
   * an address is `personal` (NFR18). What the Admin reads is the address they
   * just typed, which they already had.
   */
  test("refuses an address with no Account, and says nothing about it", async ({ database }) => {
    const outcome = await runAdminAction(database.db, actor, "revokeSessions", {
      email: "nobody@recomencemos.test",
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;

    expect(outcome.error).toBeInstanceOf(AppError);
    expect(outcome.error.status).toBe(404);
    expect(JSON.stringify(outcome.error.context)).not.toContain("nobody@");
    expect(outcome.error.userMessage).not.toContain("nobody@");
  });

  /** An Account with no open sessions is a fine thing to ask about, and is audited. */
  test("is a no-op with a record on an Account holding no sessions", async ({ database }) => {
    const stack = signInStack(database);
    await signIn(stack, TARGET);
    await database.db.delete(schema.session);

    const outcome = await runAdminAction(database.db, actor, "revokeSessions", { email: TARGET });

    expect(outcome).toMatchObject({ ok: true, result: { revoked: 0 } });
    expect(await audit(database)).toHaveLength(1);
  });

  /** Nobody else's sessions move. */
  test("leaves other Accounts' sessions alone", async ({ database }) => {
    await targetWithSessions(database);
    const stack = signInStack(database);
    await signIn(stack, "otra@recomencemos.test");

    await runAdminAction(database.db, actor, "revokeSessions", { email: TARGET });

    const remaining = await database.db.select().from(schema.session);
    expect(remaining).toHaveLength(1);
  });
});

describe("the database refuses an action it has not met", () => {
  /**
   * The `CHECK` on `admin_action.action` is written from `ADMIN_ACTION_NAMES`, and
   * this is the engine's half of the completeness argument: the registry's
   * `satisfies` refuses a handler with no name at compile time, and the constraint
   * refuses a *name* the migration has not caught up with at apply time. Together
   * they leave one way for an action to exist.
   */
  test("rejects an AdminAction row naming an unregistered action", async ({ database }) => {
    let thrown: unknown;
    try {
      await database.db
        .insert(schema.adminAction)
        .values({ actorAccountId: ADMIN_ID, action: "deleteEverything", targetId: "x" });
    } catch (error) {
      thrown = error;
    }

    expect(thrown, "the constraint accepted an unregistered action").toBeDefined();
    /**
     * **Asserted on the `cause`, not on the message.** Drizzle's own error says
     * only "Failed query: insert into …", which would pass a
     * `rejects.toThrow(/…/)` against almost any regex and would still pass if the
     * insert failed for a completely unrelated reason. The engine's message —
     * carrying the constraint's name — is one level down, and naming it is the
     * difference between "the write failed" and "the write failed *because of
     * this constraint*".
     */
    expect(String((thrown as { cause?: unknown }).cause)).toContain("admin_action_action_known");
  });

  test("accepts every name the registry declares", async ({ database }) => {
    for (const action of ADMIN_ACTION_NAMES) {
      // Sequential: one statement per action, and the point is that each is
      // accepted rather than how fast they go in.
      // oxlint-disable-next-line no-await-in-loop
      await database.db
        .insert(schema.adminAction)
        .values({ actorAccountId: ADMIN_ID, action, targetId: "x" });
    }

    expect(await audit(database)).toHaveLength(ADMIN_ACTION_NAMES.length);
  });
});
