/**
 * `@repo/domain/admin` — one door, and the audit is behind it rather than beside
 * it.
 *
 * **NFR33 asks that the audit cannot be skipped.** Not that it is always written:
 * that every path which could write it does. The difference is the whole design
 * here. An `AdminAction` insert at the foot of each handler satisfies the first
 * reading and fails the second the moment a twelfth handler is added, and the
 * failure is invisible — the action works, the queue moves, and the incident a
 * year later has one act missing from it.
 *
 * So the shape is inverted. `runAdminAction` opens the transaction, calls the
 * handler, and writes the row; `#admin/handlers` is not exported from this
 * package. **No registered Admin action can run unaudited, because there is no way
 * to reach a handler** — and the claim is bounded there on purpose. It is not that
 * nothing else in this package can write to the database; it is that the eleven
 * acts NFR33 counts are defined in one registry, reachable through one function,
 * and that function is the one that writes the row. A later story that moderated
 * by calling some other subpath directly would not be a hole in this mechanism, it
 * would be an action that never joined the registry — which the `CHECK` on
 * `admin_action.action` and seam 2's table-driven suite are the second and third
 * things standing in front of.
 *
 * **Three mechanisms, and each closes a different gap:**
 *
 * | Gap                                       | What closes it                                                          | When it fails |
 * | ----------------------------------------- | ----------------------------------------------------------------------- | ------------- |
 * | An action runs with no audit              | The insert is in the executor; handlers are unexported                  | Unreachable   |
 * | An action runs on a non-Admin session     | {@link AdminActor}'s brand — only `requireAdminSession` can produce one | Compile       |
 * | An action exists the database has not met | The `CHECK` is written from `ADMIN_ACTION_NAMES`; the registry `satisfies` it | Compile, then apply |
 *
 * **The audit and the act commit together or not at all**, which is what makes
 * the third column true rather than hopeful: a handler that throws rolls the row
 * back with it, so the table never records something that did not happen — and a
 * failing insert rolls back the act, so the table can never be behind.
 */

import { AppError } from "@repo/errors/app-error";
import { requireAdminSession } from "#admin/actor";
import type { AdminActor } from "#admin/actor";
import {
  ADMIN_ACTION_HANDLERS,
  type AdminActionHandler,
  type AdminActionInput,
  type AdminActionResult,
} from "#admin/handlers";
import { ADMIN_ACTION_NAMES, type AdminActionName } from "#admin/names";
import { db as pooledDatabase } from "#connection";
import type { DomainDatabase } from "#database";
import * as schema from "#schema";
import { ADMIN_ACTION_FAILED } from "#user-messages";

export { requireAdminSession };
export type { AdminActor, AdminCandidateSession } from "#admin/actor";
export { ADMIN_ACTION_NAMES };
export type { AdminActionName };
export type { AdminActionInput, AdminActionResult };

/**
 * Done, or refused with everything the surface needs to say so — the shape
 * `CeilingOutcome` established and for the same reason: an expected refusal is a
 * value, so it costs one `warn` line and no Sentry event (NFR26's second half,
 * which C51 restates for every `403` and `404` in the UX table).
 */
export type AdminActionOutcome<K extends AdminActionName> =
  | { readonly ok: true; readonly result: AdminActionResult<K> }
  | { readonly ok: false; readonly error: AppError };

/**
 * Perform one Admin action and record it, in one transaction.
 *
 * **The handle is the first parameter**, ahead of the principal, which is
 * `#database`'s rule and what lets seam 2 exercise this against PGlite.
 *
 * **The actor is the second, and it is the authorization.** There is no `headers`
 * parameter and no session read here: an {@link AdminActor} can only have come
 * from `requireAdminSession`, so by the time this function is entered NFR14 has
 * been satisfied — and a caller who skipped the check has nothing to pass.
 */
export async function runAdminAction<K extends AdminActionName>(
  db: DomainDatabase,
  actor: AdminActor,
  action: K,
  input: AdminActionInput<K>,
): Promise<AdminActionOutcome<K>> {
  try {
    const result = await db.transaction(async (tx) => {
      /**
       * **The cast is the registry's own `satisfies` read back**, and it became
       * necessary the moment there were two actions rather than one.
       *
       * `ADMIN_ACTION_HANDLERS[action]` under a generic `K` is a *union* of
       * handlers, and TypeScript types a call to a union of functions with the
       * **intersection** of their parameters — so passing `AdminActionInput<K>`
       * is rejected on the grounds that it might be one member's input handed to
       * another member's handler. That correlation is exactly what the registry's
       * `satisfies { [K in AdminActionName]: AdminActionHandler<K> }` establishes
       * and what the compiler cannot carry through an indexed access here.
       *
       * It is therefore a narrowing rather than an assumption, and it is the only
       * one: `action` indexes the registry, `input` is typed from the same key,
       * and a handler whose shape disagreed with its name would be a compile
       * error at the registry rather than a runtime error here.
       */
      const handler = ADMIN_ACTION_HANDLERS[action] as AdminActionHandler<K>;
      const outcome = await handler(tx, input);

      /**
       * **Written after the act, inside the same transaction.** After, so a
       * handler that refuses never leaves a row; inside, so an act that commits
       * never lacks one. Four columns — actor, action, target, and the clock's
       * default — which is the whole of what the spec's Core entities permits:
       * _"ids and enum values only"_. Nothing here reads `input`, and that is not
       * an oversight: `revokeSessions`'s input is an email address, which is
       * `personal`, and a table retained 24 months is the last place it belongs.
       */
      await tx.insert(schema.adminAction).values({
        actorAccountId: actor.accountId,
        action,
        targetId: outcome.targetId,
      });

      return outcome.result;
    });

    return { ok: true, result };
  } catch (cause) {
    /**
     * **An `AppError` from a handler is the refusal it chose**, passed through
     * with its own `userMessage` — "no hay ninguna cuenta con ese correo" is more
     * use to an Admin than a generic failure, and the Admin is the one principal
     * permitted to learn that an address has no Account.
     *
     * Anything else is a fault, and the copy for it is the one that can be said
     * truthfully whatever broke: nothing changed. That sentence is true by
     * construction rather than by hope — the transaction is what makes it so.
     */
    if (cause instanceof AppError) return { ok: false, error: cause };

    return {
      ok: false,
      error: new AppError({
        code: "admin_action_failed",
        status: 500,
        message:
          `The ${action} Admin action failed and its transaction rolled back, so neither the ` +
          "action nor its AdminAction row committed. The audit is intact: there is no " +
          "record of this attempt because nothing happened.",
        userMessage: ADMIN_ACTION_FAILED,
        // Ids and enum values (NFR18). The actor is named because an Admin action
        // failing is an operational event worth attributing; the input is not,
        // because it may carry an address.
        context: { action, actor_account_id: actor.accountId },
        cause,
      }),
    };
  }
}

/**
 * **The pooled binding: what a Server Action calls.**
 *
 * ADR-0010 withholds `#connection`, so `apps/web` has no handle to pass — the one
 * place the handle-first rule cannot be literal.
 */
export const admin = {
  async run<K extends AdminActionName>(
    actor: AdminActor,
    action: K,
    input: AdminActionInput<K>,
  ): Promise<AdminActionOutcome<K>> {
    return runAdminAction(pooledDatabase(), actor, action, input);
  },
};
