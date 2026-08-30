/**
 * What each Admin action actually does — and **nothing here is exported past this
 * package**, which is the whole of NFR33's mechanism.
 *
 * The requirement is that _"**100%** of the eleven `/admin` actions write an
 * `AdminAction` row in the same transaction as the action itself, so **0** of them
 * can commit unaudited"_. The obvious implementation is an insert at the end of
 * every handler, and its failure mode is the twelfth handler somebody writes at
 * the end of a long day. So the insert is not in a handler at all: `runAdminAction`
 * opens the transaction, calls the handler, and writes the row — and since
 * `#admin/index` publishes the executor and not this map, there is no way to reach
 * a handler that skips it.
 *
 * **A handler takes the transaction, not a connection.** That is the shape
 * `#database` already argues for in as many words: _"NFR33 requires an
 * `AdminAction` insert to share the transaction of the action it records"_, which
 * means a domain function has to be callable inside a caller's transaction.
 *
 * **A handler throws to refuse.** Returning a refusal would commit the transaction
 * — including the audit row — for an action that did not happen. Throwing rolls
 * both back together, and `runAdminAction` catches and returns the `AppError`, so
 * the refusal still costs one `warn` line and no Sentry event (CLAUDE.md: "thrown
 * is reported; returned is logged" is about what escapes the *request*, and
 * nothing escapes here).
 */

import { AppError } from "@repo/errors/app-error";
import { eq } from "drizzle-orm";
import type { AdminActionName } from "#admin/names";
import type { DomainDatabase } from "#database";
import * as schema from "#schema";
import { ADMIN_ACCOUNT_NOT_FOUND } from "#user-messages";

/** The input and result of each action, as one table two types are derived from. */
export interface AdminActionShapes {
  /**
   * Ends every session of one Account.
   *
   * **NFR13 names it**: _"a Worker ends all her sessions from any device she
   * holds; **an Admin ends a reported Hirer's while handling the Report**"_. It is
   * the one of the spec's eleven actions that needs no entity a later story
   * creates, which is why it is the registry's first member rather than a fixture.
   *
   * **It is keyed by address and audited by id.** An Admin has an address in front
   * of them — it is what a Report or an incident report carries — and an id is
   * what NFR18 permits the audit row to hold. Resolving one to the other is this
   * handler's first act, and the address goes no further.
   */
  revokeSessions: { input: { readonly email: string }; result: { readonly revoked: number } };
}

export type AdminActionInput<K extends AdminActionName> = AdminActionShapes[K]["input"];
export type AdminActionResult<K extends AdminActionName> = AdminActionShapes[K]["result"];

/**
 * What a **handler** answers: the id the audit row names, and whatever the surface
 * renders. Distinct from `AdminActionOutcome` in `#admin/index`, which is what the
 * *executor* answers — the two were briefly one name for two things.
 *
 * **`targetId` is separate from `result` rather than dug out of it**, because the
 * executor needs it and the surface does not. Reading it out of an arbitrary
 * result shape would make the audit's completeness depend on every future handler
 * happening to put an id in the same place.
 */
export interface AdminActionHandlerResult<K extends AdminActionName> {
  readonly targetId: string;
  readonly result: AdminActionResult<K>;
}

export type AdminActionHandler<K extends AdminActionName> = (
  tx: DomainDatabase,
  input: AdminActionInput<K>,
) => Promise<AdminActionHandlerResult<K>>;

/**
 * The registry.
 *
 * **`satisfies` rather than an annotation, and that is the completeness check.**
 * It refuses a name in `ADMIN_ACTION_NAMES` with no handler *and* a handler with
 * no name — both directions, at compile time. Together with the `CHECK` on
 * `admin_action.action`, which `#schema` writes from the same list, a new action
 * has exactly one way to exist: a name, a handler, and a migration. Miss any of
 * the three and something is red before it runs.
 */
export const ADMIN_ACTION_HANDLERS = {
  async revokeSessions(tx, { email }) {
    const [account] = await tx
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.email, email.trim()))
      .limit(1);

    if (!account) {
      throw new AppError({
        code: "admin_target_account_not_found",
        status: 404,
        message:
          "revokeSessions was given an address with no Account. Nothing was revoked and no " +
          "AdminAction was written, because nothing happened — an audit row for an act that " +
          "did not occur is worse than none.",
        userMessage: ADMIN_ACCOUNT_NOT_FOUND,
        // No address: `context` reaches the log line and an email is `personal`
        // (NFR18). There is no id to name, because that is what was not found.
        context: {},
      });
    }

    /**
     * **Every session, including any the target is holding right now.** This is
     * not `signOutEverywhere`, which spares the caller's own — the caller here is
     * the Admin and the rows are somebody else's, so there is nothing to spare.
     *
     * A direct delete rather than Better Auth's `revokeSessions` endpoint,
     * because that endpoint authorizes as the *session holder* and there is no
     * such session here; the Admin is acting on an Account, not from it.
     * `internalAdapter.deleteSession` is the seam a secondary session store would
     * sit behind, and this product has none — noted, because the day one is added
     * this delete is what silently stops being sufficient.
     */
    const revoked = await tx
      .delete(schema.session)
      .where(eq(schema.session.userId, account.id))
      .returning({ id: schema.session.id });

    return { targetId: account.id, result: { revoked: revoked.length } };
  },
} as const satisfies { [K in AdminActionName]: AdminActionHandler<K> };
