/**
 * The Admin's second factor: six digits, or one of the ten printed codes.
 *
 * **The first factor is not here, and its absence is the design.** It is the
 * ordinary magic link — the same endpoint, the same `verification` row, the same
 * hashing and expiry every Account's link gets — so there is nothing for this
 * module to mint, store or spend. What used to be here was a second link
 * mechanism beside Better Auth's, and it put `/admin/continue/<token>` in the
 * mail body: the admin surface, named in the one place the design cannot
 * control, on a product whose posture is that the door has no page to find.
 *
 * **Two possession factors, on separate channels** (DD5). The mailbox is factor
 * one and the authenticator is factor two, and the second is never sent to the
 * first. Consuming the link mints no session — `session.create.before` in
 * `#auth/config` diverts a granted Account to a challenge instead — and the
 * session exists only after the code below is checked against that challenge.
 *
 * **What this module does not do is create the session**, and that omission is
 * deliberate rather than a missing function. A session row is born in exactly
 * one place in this package, where NFR13's lifetime, NFR14's stamp and the
 * refusal of every other door are applied together. A second birthplace here
 * would have to restate all three, and the first one to drift would drift
 * silently.
 */

import { AppError } from "@repo/errors/app-error";
import { and, eq } from "drizzle-orm";
import {
  ADMIN_CODE_SHAPES,
  type AdminCodeShape,
  classifyAdminCode,
  decryptBackupCodes,
  decryptTotpSecret,
  encryptBackupCodes,
  verifyBackupCode,
  verifyTotpCode,
} from "#admin/second-factor";
import type { DomainDatabase } from "#database";
import { type CeilingedAction, chargeCeiling } from "#rate-limit";
import { adminSecondFactor, user } from "#schema";

/**
 * What the code check answers.
 *
 * **`wrong_code` is one refusal for four different failures** — the wrong six
 * digits, a backup code that was never printed or has already been used, an
 * Account whose grant has been taken away, and an Account with no second factor
 * at all. The surface says only that the code was wrong, and this shape is what
 * makes that the *only* thing it can say: there is no richer value for a later
 * caller to accidentally render.
 *
 * `shape` is on the refusal for the log line and for nothing else. It is an enum
 * value, like `second_factor` on the refusal it replaces, and it names which
 * ceiling was charged rather than anything about the person or the code.
 */
export type AdminCodeOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly refused: "wrong_code"; readonly shape: AdminCodeShape }
  | {
      readonly ok: false;
      readonly refused: "rate_limited";
      readonly shape: AdminCodeShape;
      /** Seconds until the window resets. What the surface renders (NFR26, C39). */
      readonly retryAfter: number;
      /** For the log line and the operator. Returned, never thrown. */
      readonly error: AppError;
    };

/** Which ceiling each shape of code is charged against. Two rows, on purpose. */
const CEILING_FOR_SHAPE: Readonly<Record<AdminCodeShape, CeilingedAction>> = {
  [ADMIN_CODE_SHAPES.totp]: "verifyAdminTotp",
  [ADMIN_CODE_SHAPES.backupCode]: "verifyAdminBackupCode",
};

/**
 * Step three: six digits from the authenticator, or one of the ten printed
 * codes, against the Account the challenge names.
 *
 * **The shape decides the factor, not the caller** (DD5). Somebody whose phone
 * is gone types a printed code into the same box, and `classifyAdminCode`
 * anchors on "exactly six digits" — which is unambiguous because every backup
 * code contains a letter by construction (#117).
 *
 * **The ceiling is charged before anything is compared, and it is charged per
 * Account.** DD5 is explicit that a per-IP bound is not a substitute: six digits
 * against an attacker who can rotate addresses is a matter of hours. It is also
 * charged before the grant and the factor are read, so an attacker cannot probe
 * either for free.
 *
 * **The two ceilings are separate rows**, which is the only reason the door's
 * lockout is allowed to say a printed code still works. Exhausting one leaves
 * the other untouched.
 *
 * **A backup code is written out of the column by a compare-and-swap**, so
 * "each code works once" is enforced by the statement rather than by the gap
 * between a read and a write. Two requests arriving with the same printed code
 * both read the same ciphertext; the first `UPDATE` matches it and the second
 * matches nothing, and the second is refused. A plain `WHERE user_id = ?` would
 * let both succeed and both mint a session, which is exactly the case a
 * single-use code exists to refuse.
 */
export async function verifyAdminCode(
  db: DomainDatabase,
  {
    accountId,
    code,
    key,
    now = new Date(),
  }: {
    readonly accountId: string;
    readonly code: string;
    /** `BETTER_AUTH_SECRET`. Taken as a parameter so seam 2 needs no environment. */
    readonly key: string;
    readonly now?: Date;
  },
): Promise<AdminCodeOutcome> {
  const typed = code.trim();
  const shape = classifyAdminCode(typed);

  const charged = await chargeCeiling(
    db,
    { scope: "account", id: accountId },
    CEILING_FOR_SHAPE[shape],
    now,
  );
  if (!charged.allowed) {
    return {
      ok: false,
      refused: "rate_limited",
      shape,
      retryAfter: charged.retryAfter,
      error: charged.error,
    };
  }

  const [row] = await db
    .select({
      isAdmin: user.isAdmin,
      secret: adminSecondFactor.secret,
      backupCodes: adminSecondFactor.backupCodes,
    })
    .from(adminSecondFactor)
    .innerJoin(user, eq(user.id, adminSecondFactor.userId))
    .where(eq(adminSecondFactor.userId, accountId))
    .limit(1);

  /**
   * **The grant is re-read here rather than trusted from the challenge**, and
   * the window it closes is real: the challenge is signed and short-lived, so it
   * survives a grant being taken away in the ten minutes after a link was
   * opened. Refusing at the last step means revoking Admin authority takes
   * effect immediately rather than after the longest challenge in flight.
   */
  if (!row?.isAdmin) return { ok: false, refused: "wrong_code", shape };

  if (shape === ADMIN_CODE_SHAPES.totp) {
    const verified = await verifyTotpCode(await decryptTotpSecret(row.secret, key), typed);
    return verified ? { ok: true } : { ok: false, refused: "wrong_code", shape };
  }

  const stored = await decryptBackupCodes(row.backupCodes, key);
  const outcome = verifyBackupCode(stored, typed);
  if (!outcome.matched) return { ok: false, refused: "wrong_code", shape };

  /**
   * The swap. `RETURNING` is how the caller learns whether it won: an empty
   * result means the column moved between the read above and this statement,
   * which on this table means the same code was spent by another request.
   */
  const consumed = await db
    .update(adminSecondFactor)
    .set({ backupCodes: await encryptBackupCodes(outcome.remaining, key), updatedAt: now })
    .where(
      and(
        eq(adminSecondFactor.userId, accountId),
        eq(adminSecondFactor.backupCodes, row.backupCodes),
      ),
    )
    .returning({ userId: adminSecondFactor.userId });

  if (consumed.length === 0) return { ok: false, refused: "wrong_code", shape };

  return { ok: true };
}
