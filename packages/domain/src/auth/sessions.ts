/**
 * What `/account` may know about a Worker's open sessions.
 *
 * **This module exists because Better Auth's own `/list-sessions` cannot serve
 * this surface**, and the reason is worth writing down so nobody swaps it back
 * in. That endpoint sits behind `freshSessionMiddleware`
 * (`dist/api/routes/session.mjs`), which throws `SESSION_NOT_FRESH` once a
 * session is older than `session.freshAge` — **24 hours** by default. The Worker
 * story 12 is written for signed in six days ago on a machine she no longer
 * controls; she is precisely who that gate refuses.
 *
 * **Lowering `freshAge` globally is not the alternative.** The API contract gives
 * `deleteAccount` "only from a fresh sign-in", so story 13 depends on that gate
 * staying strict. One surface's convenience may not weaken another's guard.
 *
 * **The second reason is C28.** `/list-sessions` returns the row, and the row
 * carries `token`, which C28 classifies `secret` — a class whose values reach no
 * log line, no Sentry event and no export. Reading the rows here means the
 * projection below is built field by field from a whitelist, which is ADR-0003's
 * discipline: a column added to the session table later cannot reach a browser
 * by default, because nothing copies the row wholesale.
 */

import { and, desc, eq, gt } from "drizzle-orm";
import type { SignInMethod } from "#auth-schema";
import type { DomainDatabase } from "#database";
import * as schema from "#schema";

/**
 * One row of the list, and deliberately less than the table holds.
 *
 * **Two columns are withheld rather than merely unused.** `token` is the
 * credential (C28). `ipAddress` is withheld because the surface that would have
 * rendered it was dropped: turning an IP into a place needs a geolocation
 * provider, and that is a fifth international processor in a consent notice the
 * spec fixes at four (story 14). Adding it back is a spec amendment; see
 * `.impeccable/briefs/account.md`.
 *
 * `userAgent` crosses raw and **is not parsed here**. What a person reads is
 * `apps/web`'s to decide — the domain has no opinion about how "Chrome en
 * Windows" is spelled, and `ADR-0012` puts the Spanish in the surface rather
 * than in the package.
 */
export interface AccountSession {
  readonly id: string;
  /** The session making the request. She cannot close this one from here. */
  readonly current: boolean;
  readonly signInMethod: SignInMethod;
  /**
   * Exactly what the browser sent, or `null` where it sent nothing. Never a
   * guess, and never an empty string — see the normalisation in
   * {@link listAccountSessions}.
   */
  readonly userAgent: string | null;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

export interface ListAccountSessionsInput {
  readonly accountId: string;
  /**
   * The token of the session asking. Used **only** to mark one row as `current`;
   * it is never returned, and it is why this parameter is a token rather than a
   * session id — the caller reads it off Better Auth's session and has no id.
   */
  readonly currentToken: string;
  /** Taken rather than read, so the expiry boundary is assertable. */
  readonly now: Date;
}

/**
 * Every session of one Account that has not expired, the caller's own first.
 *
 * **The ordering is here rather than in the surface** because it depends on
 * `current`, and `current` is a field only this module can compute — the surface
 * never sees a token. Splitting "newest first" into SQL and "mine first" into a
 * component would put one ordering in two files.
 *
 * **Expired rows are filtered, not swept.** A row outliving its `expiresAt` is
 * still deleted on the retention path C28 describes; this filter is what stops a
 * not-yet-swept row being shown to her as though it were live.
 */
export async function listAccountSessions(
  db: DomainDatabase,
  { accountId, currentToken, now }: ListAccountSessionsInput,
): Promise<readonly AccountSession[]> {
  const rows = await db
    .select({
      id: schema.session.id,
      token: schema.session.token,
      signInMethod: schema.session.signInMethod,
      userAgent: schema.session.userAgent,
      createdAt: schema.session.createdAt,
      expiresAt: schema.session.expiresAt,
    })
    .from(schema.session)
    .where(and(eq(schema.session.userId, accountId), gt(schema.session.expiresAt, now)))
    .orderBy(desc(schema.session.createdAt));

  const sessions = rows.map((row): AccountSession => ({
    id: row.id,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    current: row.token === currentToken,
    // The column is `TEXT` with a `CHECK` (DD2), so the engine already refuses
    // anything outside the set; this narrows the driver's `string` to it.
    signInMethod: row.signInMethod as SignInMethod,
    /**
     * **`""` and `null` are one state, and it is spelled `null` here.**
     * Measured rather than assumed: a request carrying no `User-Agent` — a
     * scripted client, a stripped header, `next dev`'s own internal fetches —
     * lands in the column as an **empty string**, not as `NULL`, because
     * Better Auth writes `ctx.headers.get("user-agent") || ""`. A surface
     * given both spellings renders an empty line for one of them, so the two
     * are collapsed at the boundary that owns the type rather than in every
     * component that reads it.
     */
    userAgent: row.userAgent || null,
  }));

  return sessions.toSorted((a, b) => Number(b.current) - Number(a.current));
}
