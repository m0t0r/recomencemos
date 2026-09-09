/**
 * `@repo/domain/admin-enrolment` — the enrolment screen's one read, and the
 * whole of what `apps/web` may reach of this flow.
 *
 * **This file exists so the `exports` map publishes a door rather than a
 * module.** Pointing the subpath at `#admin/enrolment` would have published
 * `mintAdminEnrolment` and `completeAdminEnrolment` beside the read — the
 * function that sets `isAdmin` among them — and ADR-0010's mechanism is
 * *withholding*, not "the caller could not obtain a handle anyway". That second
 * argument is true today and is a different mechanism; resting on it would mean
 * the map says one thing and the module's own comment says another.
 *
 * It is the shape `./admin` already has: `#admin/index` is the curated barrel and
 * `#admin/handlers` is unreachable behind it, which is what makes NFR33's
 * "no Admin action runs unaudited" a resolution error rather than a review
 * comment. Here the same shape makes "nothing on a request path can grant Admin"
 * one.
 *
 * `domain-boundary.test.ts` asserts both halves against **Node's own resolver**:
 * this subpath resolves, and `@repo/domain/admin/enrolment` does not.
 */

import { type AdminEnrolmentSecrets, readAdminEnrolment } from "#admin/enrolment";
import { authSecret } from "#auth/config";
import { db as pooledDatabase } from "#connection";

export type { AdminEnrolmentSecrets };

/**
 * **The pooled binding: what the enrolment page calls.**
 *
 * ADR-0010 withholds `#connection`, so `apps/web` has no handle to pass — the one
 * place the handle-first rule cannot be literal.
 *
 * **Only the read is bound, and now only the read is even published.** Minting
 * and completing belong to the command, over the direct connection; a pooled
 * binding for either would put the grant one import away from a request path.
 *
 * **Named `enrolments` rather than `adminEnrolment`**, for the reason `ceilings`
 * is not called `rateLimit`: the latter is already the table the module behind
 * this one writes, and two unrelated things under one name is a collision
 * waiting for the first reader who greps.
 */
export const enrolments = {
  async read(token: string): Promise<AdminEnrolmentSecrets | null> {
    return readAdminEnrolment(pooledDatabase(), { token, key: authSecret(process.env) });
  },
};
