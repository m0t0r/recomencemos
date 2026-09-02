/**
 * Seam 2 over the vocabulary's way in: **a Worker asks, the queue counts, an
 * Admin promotes, and the entry is choosable straight away.**
 *
 * It is a separate file from `skills.integration.test.ts` on purpose. That suite
 * is about the seed — one migration, applied twice, read back — and it asserts
 * things that are true of a list nothing has changed. This one is about the two
 * writes that change it, and the properties it cares about are the ones a seeded
 * list cannot have: a request that never became a row, a count that is right when
 * the display is capped, and a request that cannot be resolved twice.
 *
 * **Promotion is exercised through `runAdminAction` rather than through the
 * handler**, because the handler is unexported and that is NFR33's mechanism
 * rather than an inconvenience: the audit row is the executor's, so a test that
 * called the handler directly would be testing a path production cannot reach and
 * would say nothing about whether the act and its record commit together.
 */

import { AppError } from "@repo/errors/app-error";
import { asc, eq } from "drizzle-orm";
import { runAdminAction } from "#admin/index";
import type { AdminActor } from "#admin/actor";
import * as schema from "#schema";
import { listActiveSkills, readPendingSkillRequests, requestSkill } from "#skills";
import { test } from "#testing/fixtures";
import type { TestDatabase } from "#testing/fixtures";

const WORKER = "the-worker";
const ADMIN_ID = "the-admin";

/**
 * Forged, exactly as `run-admin-action.integration.test.ts` forges it and for the
 * same reason: `AdminActor`'s brand is what stops production code building one,
 * and `requireAdminSession` handing it only to a two-factor session is proven
 * where that function lives. Re-proving it here would make this file about the
 * door rather than about the vocabulary.
 */
const actor = { accountId: ADMIN_ID } as AdminActor;

async function worker(database: TestDatabase, id = WORKER): Promise<string> {
  await database.db.insert(schema.user).values({
    id,
    name: "Ana",
    email: `${id}@recomencemos.test`,
    emailVerified: true,
  });

  return id;
}

/** Every request, oldest first, with the columns the module withholds. */
async function everyRequest(database: TestDatabase) {
  return database.db
    .select()
    .from(schema.skillRequest)
    .orderBy(asc(schema.skillRequest.createdAt), asc(schema.skillRequest.id));
}

async function askFor(database: TestDatabase, text: string, accountId = WORKER) {
  return requestSkill(database.db, accountId, text);
}

describe("a Worker asks for a capability the list does not hold", () => {
  test("writes it in her words, pending, resolved by nobody", async ({ database }) => {
    await worker(database);

    const outcome = await askFor(database, "  Arreglo máquinas de coser  ");

    expect(outcome).toEqual({ ok: true });

    const [row] = await everyRequest(database);
    expect(row).toMatchObject({
      accountId: WORKER,
      // Trimmed, and otherwise untouched: an Admin has to read what she wrote.
      text: "Arreglo máquinas de coser",
      state: "pending",
      resolvedAt: null,
    });
  });

  /**
   * NFR12 and DD3 at the one field where the rejector is easiest to leave out,
   * because nobody publishes it. The refusal is **returned** — a person typing a
   * phone number into a form is not an incident (C51).
   */
  test("writes no row when the request carries a contact detail", async ({ database }) => {
    await worker(database);

    const outcome = await askFor(database, "Arreglo estufas, llámame al 300 123 4567");

    expect(outcome).toEqual({
      ok: false,
      reason: "contact_detail",
      kind: "phone",
      fragment: "300 123 4567",
    });
    expect(await everyRequest(database)).toEqual([]);
  });

  test("names the address it found", async ({ database }) => {
    await worker(database);

    const outcome = await askFor(database, "Cocino para eventos, escríbeme a ana@correo.co");

    expect(outcome).toMatchObject({ ok: false, kind: "email", fragment: "ana@correo.co" });
  });

  test("names the messaging link it found", async ({ database }) => {
    await worker(database);

    const outcome = await askFor(database, "Coso ropa: wa.me/573001234567");

    expect(outcome).toMatchObject({ ok: false, kind: "messaging_url" });
  });

  /**
   * Two Workers asking for the same trade is the signal an Admin most wants, so
   * nothing folds them together. See `#skills` for why.
   */
  test("keeps two requests for the same trade as two rows", async ({ database }) => {
    await worker(database);
    await worker(database, "another-worker");

    await askFor(database, "Arreglo máquinas de coser");
    await askFor(database, "Arreglo máquinas de coser", "another-worker");

    expect(await everyRequest(database)).toHaveLength(2);
  });
});

describe("the queue's branch", () => {
  test("is empty, and says so with a zero and no oldest", async ({ database }) => {
    expect(await readPendingSkillRequests(database.db, 20)).toEqual({
      items: [],
      total: 0,
      oldestRequestedAt: null,
    });
  });

  /**
   * **C55, and the assertion the criterion asks for in as many words**: verified
   * with more rows than the cap. A branch capped at three that also reported a
   * depth of three is an instrument reading healthy exactly when the backlog is
   * worst, and it is the one bug in a queue that hides itself.
   */
  test("caps what it renders and counts the whole branch", async ({ database }) => {
    await worker(database);
    for (const trade of ["Uno", "Dos", "Tres", "Cuatro", "Cinco"]) {
      // Sequential on purpose: `created_at` is what the branch is ordered by, and
      // five inserts racing would leave the order this test asserts undefined.
      // oxlint-disable-next-line no-await-in-loop
      await askFor(database, trade);
    }

    const branch = await readPendingSkillRequests(database.db, 3);

    expect(branch.items).toHaveLength(3);
    expect(branch.total).toBe(5);
  });

  test("takes the oldest arrival from the whole branch, not from the page", async ({
    database,
  }) => {
    await worker(database);
    await askFor(database, "La primera");
    await askFor(database, "La segunda");

    const branch = await readPendingSkillRequests(database.db, 1);
    const [oldest] = await everyRequest(database);

    expect(branch.oldestRequestedAt).toEqual(oldest?.createdAt);
    expect(branch.items[0]?.text).toBe("La primera");
  });

  /**
   * The id crosses as a string because the column is read as a `BigInt`, on which
   * `JSON.stringify` throws — the backstop under ADR-0003 working as intended. A
   * surface that received the `BigInt` would fail at the RSC boundary rather than
   * here.
   */
  test("hands the id over as digits", async ({ database }) => {
    await worker(database);
    await askFor(database, "Arreglo máquinas de coser");

    const branch = await readPendingSkillRequests(database.db, 20);

    expect(branch.items[0]?.id).toMatch(/^\d+$/);
  });

  test("stops counting a request once it is resolved", async ({ database }) => {
    await worker(database);
    await askFor(database, "Arreglo máquinas de coser");
    const [request] = await everyRequest(database);

    await runAdminAction(database.db, actor, "promoteSkill", {
      requestId: String(request?.id),
      slug: "sewing-machine-repair",
      labelEs: "Arreglo máquinas de coser",
    });

    expect(await readPendingSkillRequests(database.db, 20)).toMatchObject({
      items: [],
      total: 0,
      oldestRequestedAt: null,
    });
  });
});

describe("an Admin promotes a request", () => {
  async function pending(database: TestDatabase, text = "Arreglo máquinas de coser") {
    await worker(database);
    await askFor(database, text);
    const [request] = await everyRequest(database);

    return String(request?.id);
  }

  /**
   * The acceptance criterion's own sentence: **a promoted Skill is immediately
   * selectable on the publishing form**. `listActiveSkills` is the read that form
   * makes, so asserting through it is asserting the thing rather than the row.
   */
  test("puts the entry in the list the publishing form reads", async ({ database }) => {
    const requestId = await pending(database);

    const outcome = await runAdminAction(database.db, actor, "promoteSkill", {
      requestId,
      slug: "sewing-machine-repair",
      labelEs: "Arreglo máquinas de coser",
    });

    expect(outcome).toMatchObject({ ok: true });
    expect(await listActiveSkills(database.db)).toContainEqual({
      slug: "sewing-machine-repair",
      labelEs: "Arreglo máquinas de coser",
    });
  });

  test("records who did it and which request, and nothing else", async ({ database }) => {
    const requestId = await pending(database);

    await runAdminAction(database.db, actor, "promoteSkill", {
      requestId,
      slug: "sewing-machine-repair",
      labelEs: "Arreglo máquinas de coser",
    });

    const [audited] = await database.db.select().from(schema.adminAction);

    expect(audited).toMatchObject({
      actorAccountId: ADMIN_ID,
      action: "promoteSkill",
      targetId: requestId,
    });
  });

  test("marks the request promoted and stamps when", async ({ database }) => {
    const requestId = await pending(database);

    await runAdminAction(database.db, actor, "promoteSkill", {
      requestId,
      slug: "sewing-machine-repair",
      labelEs: "Arreglo máquinas de coser",
    });

    const [row] = await everyRequest(database);

    expect(row?.state).toBe("promoted");
    expect(row?.resolvedAt).toBeInstanceOf(Date);
  });

  /**
   * **A promoted entry may carry no CUOC code**, which is why the column is
   * nullable: the reason she had to ask is often that CUOC has no *Ocupación* for
   * what she does.
   */
  test("leaves the provenance empty when there is no CUOC code to record", async ({ database }) => {
    const requestId = await pending(database);

    await runAdminAction(database.db, actor, "promoteSkill", {
      requestId,
      slug: "sewing-machine-repair",
      labelEs: "Arreglo máquinas de coser",
    });

    const [entry] = await database.db
      .select({ cuocCode: schema.skill.cuocCode })
      .from(schema.skill)
      .where(eq(schema.skill.slug, "sewing-machine-repair"));

    expect(entry?.cuocCode).toBeNull();
  });

  test("records the CUOC code when the Admin has one", async ({ database }) => {
    const requestId = await pending(database);

    await runAdminAction(database.db, actor, "promoteSkill", {
      requestId,
      slug: "sewing-machine-repair",
      labelEs: "Arreglo máquinas de coser",
      cuocCode: "72330",
    });

    const [entry] = await database.db
      .select({ cuocCode: schema.skill.cuocCode })
      .from(schema.skill)
      .where(eq(schema.skill.slug, "sewing-machine-repair"));

    expect(entry?.cuocCode).toBe("72330");
  });

  /**
   * **The same request, promoted twice** — the criterion names this case, and it
   * is the one two Admins working the same queue reach without trying.
   *
   * All three assertions matter: the second attempt is refused, the vocabulary
   * gains nothing, and the audit records one act rather than two. The last is
   * what an implementation writing the row before checking the state would get
   * wrong.
   */
  test("refuses the second promotion and leaves one entry and one audit row", async ({
    database,
  }) => {
    const requestId = await pending(database);
    const input = {
      requestId,
      slug: "sewing-machine-repair",
      labelEs: "Arreglo máquinas de coser",
    };

    await runAdminAction(database.db, actor, "promoteSkill", input);
    const second = await runAdminAction(database.db, actor, "promoteSkill", {
      ...input,
      slug: "sewing-machine-fixing",
    });

    expect(second.ok).toBe(false);
    expect(second.ok === false && second.error).toBeInstanceOf(AppError);

    const entries = await database.db
      .select({ slug: schema.skill.slug })
      .from(schema.skill)
      .where(eq(schema.skill.slug, "sewing-machine-fixing"));

    expect(entries).toEqual([]);
    expect(await database.db.select().from(schema.adminAction)).toHaveLength(1);
  });

  test("refuses a request id no row carries, and writes nothing", async ({ database }) => {
    const outcome = await runAdminAction(database.db, actor, "promoteSkill", {
      requestId: "4242",
      slug: "sewing-machine-repair",
      labelEs: "Arreglo máquinas de coser",
    });

    expect(outcome.ok).toBe(false);
    expect(await database.db.select().from(schema.adminAction)).toEqual([]);
  });

  /**
   * A slug the vocabulary already holds is refused rather than silently pointing
   * her request at somebody else's entry — and the request stays pending, so the
   * Admin can try again with an identifier that is free.
   */
  test("refuses a slug the vocabulary already holds and leaves the request pending", async ({
    database,
  }) => {
    const requestId = await pending(database);
    const [taken] = await listActiveSkills(database.db);

    const outcome = await runAdminAction(database.db, actor, "promoteSkill", {
      requestId,
      slug: String(taken?.slug),
      labelEs: "Arreglo máquinas de coser",
    });

    expect(outcome.ok).toBe(false);

    const [row] = await everyRequest(database);
    expect(row?.state).toBe("pending");
    expect(await database.db.select().from(schema.adminAction)).toEqual([]);
  });
});
