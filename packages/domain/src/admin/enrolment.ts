/**
 * Enrolling the Admin's second factor, in three steps that are deliberately not
 * one.
 *
 * `pnpm admin:enrol <email>` mints a setup link and prints it; the browser
 * renders the QR and the ten codes; six digits typed **back into the terminal**
 * verify the authenticator and set the grant. Three steps, three functions here,
 * and the split is the security property rather than a decomposition:
 *
 * > **The grant is the last step.** An Account cannot hold Admin authority until
 * > a working authenticator has proved itself, so a half-enrolled Admin is
 * > unrepresentable and a link opened and abandoned leaves no Admin behind.
 *
 * Under the design this replaces, the grant was the *first* step and the second
 * factor was enrolled at a later sign-in — which meant a window, the whole of
 * that first sign-in, in which a granted Account had one factor. DD5 closes it by
 * inverting the order, and this module is that inversion.
 *
 * **It is not an endpoint and cannot become one.** `isAdmin` is declared
 * `input: false`, so no request body sets the grant on any Better Auth route; the
 * function that sets it is called by a command over the direct connection; and
 * `#admin/enrol-cli` is not in the package's `exports` map, so `apps/web` cannot
 * resolve it. What *is* exported is {@link readAdminEnrolment}'s binding, which
 * renders and grants nothing.
 *
 * **The handle is the first parameter**, ahead of ADR-0010's principal, which is
 * `#database`'s rule and what lets seam 2 exercise all three against PGlite.
 */

import { generateRandomString } from "better-auth/crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import {
  decryptBackupCodes,
  decryptTotpSecret,
  encryptBackupCodes,
  encryptTotpSecret,
  generateBackupCodes,
  generateTotpSecret,
  manualEntrySecret,
  totpUri,
  verifyTotpCode,
} from "#admin/second-factor";
import { hashToken } from "#auth/config";
import type { DomainDatabase } from "#database";
import { adminEnrolment, adminSecondFactor, user } from "#schema";

/**
 * How long a printed setup link is good for.
 *
 * **Fifteen minutes, and it is sized against a different thing than the magic
 * link's fifteen.** That window is bounded by a mailbox round trip and by the
 * corporate scanners and message previews that fetch a `GET` on the way. This
 * one is printed to a terminal that is sitting at a prompt, waiting for the
 * person who ran the command — so what bounds it is one person's attention, and
 * the number is generous for somebody at their own keyboard rather than tight
 * against a delivery path.
 *
 * The brief leaves this open and says the number belongs with the door's
 * ceilings. This is the ticket that mints the token, so it is set here; a shorter
 * one costs nothing but a rerun of the command, which is the recovery for every
 * other failure on this path too.
 */
export const ADMIN_SETUP_TOKEN_TTL_MINUTES = 15;

/** What `pnpm admin:enrol` prints, and what it needs to keep afterwards. */
export interface MintedAdminEnrolment {
  /** The token in the printed link. Never stored — the row holds its hash. */
  readonly token: string;
  readonly accountId: string;
}

/**
 * The three values the enrolment screen renders, and nothing else.
 *
 * **Every one of them is a credential**, so this shape is the whole of what
 * crosses to a render and there is deliberately no account id, no email and no
 * grant state on it: the screen names no account (that is one of the brief's
 * anti-goals) and has no decision to make that would need one.
 */
export interface AdminEnrolmentSecrets {
  /** `otpauth://…`, for the QR. Server-minted; never built from typed input. */
  readonly totpUri: string;
  /** The same secret in base32, for the authenticator that will not read a QR. */
  readonly manualSecret: string;
  readonly backupCodes: readonly string[];
}

/**
 * Done, or refused — and refused is deliberately one answer with a reason the
 * *terminal* may read, never a browser.
 *
 * This is the returned-not-thrown shape every refusal in this repository takes,
 * for the reason NFR26 gives: an expected refusal costs one line and no Sentry
 * event. Here it costs neither, because the only caller is a command with a
 * person watching it.
 */
export type AdminEnrolmentOutcome =
  | { readonly ok: true; readonly accountId: string }
  | { readonly ok: false; readonly reason: "unknown_token" | "wrong_code" };

interface EnrolmentRequest {
  readonly email: string;
  /** `BETTER_AUTH_SECRET`. Taken as a parameter so seam 2 needs no environment. */
  readonly key: string;
  readonly now?: Date;
  readonly ttlMinutes?: number;
}

interface TokenRequest {
  readonly token: string;
  readonly key: string;
  readonly now?: Date;
}

/**
 * Step one: find or create the Account, generate the factor, and hold it against
 * a single-use token.
 *
 * **The Account is created by an insert rather than through Better Auth**, and
 * that is what the passwordless door buys. The command this replaces had to
 * stand up a sign-up-enabled instance of the library over the same database,
 * because the row it needed carried a scrypt hash with the library's own
 * parameters and a hand-computed one is a lockout waiting for the first sign-in.
 * With no password there is no hash to get right: the row is an id, an address
 * and a verified flag.
 *
 * **`emailVerified` is set here.** The credential door required it and is going
 * away, but the reason survives the door: the person running this over the direct
 * connection has already proved more about the address than an emailed link
 * could, and an Account left unverified would refuse the very link the Admin door
 * sends it.
 *
 * **`isAdmin` is not set here.** That is the entire point of the ordering — see
 * this module's own comment, and {@link completeAdminEnrolment}.
 */
export async function mintAdminEnrolment(
  db: DomainDatabase,
  { email, key, now = new Date(), ttlMinutes = ADMIN_SETUP_TOKEN_TTL_MINUTES }: EnrolmentRequest,
): Promise<MintedAdminEnrolment> {
  const address = email.trim();
  const accountId = await findOrCreateAccount(db, address);

  const secret = generateTotpSecret();
  const backupCodes = generateBackupCodes();
  const token = generateRandomString(32);

  await db.transaction(async (tx) => {
    /**
     * **The earlier link stops working at the moment this one is printed.**
     * Running the command twice for one address is a person starting over, and
     * two live links for one Account would mean the abandoned attempt's codes
     * are still enrollable by whoever has that URL.
     */
    await tx.delete(adminEnrolment).where(eq(adminEnrolment.userId, accountId));

    /**
     * The sweep, on the mint path for the reason `chargeCeiling` sweeps on the
     * charge path: it is the one moment this table is guaranteed to have a
     * caller paying attention, and nothing else deletes an enrolment that was
     * never completed. Expired rows hold an encrypted secret nobody can use, and
     * there is no reason to keep them.
     */
    await tx.delete(adminEnrolment).where(lt(adminEnrolment.expiresAt, now));

    await tx.insert(adminEnrolment).values({
      tokenHash: hashToken(token),
      userId: accountId,
      secret: await encryptTotpSecret(secret, key),
      backupCodes: await encryptBackupCodes(backupCodes, key),
      expiresAt: new Date(now.getTime() + ttlMinutes * 60_000),
    });
  });

  return { token, accountId };
}

/**
 * Step two: what the browser renders.
 *
 * **Reading does not consume.** The row survives until the terminal confirms,
 * which is what makes a refresh re-render the same values rather than cost ten
 * codes to a stray reload. It is no less safe — the token is unguessable and
 * short-lived either way.
 *
 * **`null` for every way of holding a bad token**, and one answer for all of
 * them: expired, spent, unknown and malformed alike. The surface turns this into
 * a 404 with no message, and it can only do that honestly because there is
 * nothing richer here to leak — a legible refusal on this route is an oracle for
 * which tokens existed.
 */
export async function readAdminEnrolment(
  db: DomainDatabase,
  { token, key, now = new Date() }: TokenRequest,
): Promise<AdminEnrolmentSecrets | null> {
  const found = await findLiveEnrolment(db, token, now);
  if (!found) return null;

  const secret = await decryptTotpSecret(found.secret, key);

  return {
    totpUri: totpUri(secret, found.email),
    manualSecret: manualEntrySecret(secret),
    backupCodes: await decryptBackupCodes(found.backupCodes, key),
  };
}

/**
 * Step three, and the only one that grants: verify six digits against the stored
 * secret, then write the factor, close the token and set `isAdmin` — **in one
 * transaction**.
 *
 * The atomicity is not decoration. Each of the three alone is a state this
 * product should never hold: a factor with no grant is an Account that cannot
 * moderate; a grant with no factor is exactly the one-factor Admin NFR14 exists
 * to refuse; and a token left open after either is a second enrolment of an
 * account that already has one.
 *
 * **A wrong code leaves everything as it was**, so the command can ask again.
 * The person mistyped six digits; making that a reason to start over would be a
 * command that punishes a fat finger.
 *
 * **There is no attempt bound here, and that is not an omission.** The bound
 * belongs to the *door*, where an attacker can reach it: this function is called
 * by a process on the operator's own machine, holding the direct connection,
 * which is a principal that does not need rate-limiting against itself. The
 * ceilings for the door are `verifyAdminTotp` and `verifyAdminBackupCode` in
 * `#rate-limit`.
 */
export async function completeAdminEnrolment(
  db: DomainDatabase,
  { token, code, key, now = new Date() }: TokenRequest & { readonly code: string },
): Promise<AdminEnrolmentOutcome> {
  const found = await findLiveEnrolment(db, token, now);
  if (!found) return { ok: false, reason: "unknown_token" };

  const verified = await verifyTotpCode(await decryptTotpSecret(found.secret, key), code.trim());
  if (!verified) return { ok: false, reason: "wrong_code" };

  await db.transaction(async (tx) => {
    /**
     * The ciphertext moves across unchanged rather than being decrypted and
     * re-encrypted: it is the same secret under the same key, and the fewer
     * places a credential exists in the clear the better.
     *
     * **`onConflictDoUpdate` on the Account is what makes runbook §6's
     * break-glass complete.** Re-enrolment has to *replace*, because an Account
     * holding two factors is an Account whose lost authenticator still opens the
     * door.
     */
    await tx
      .insert(adminSecondFactor)
      .values({
        userId: found.accountId,
        secret: found.secret,
        backupCodes: found.backupCodes,
      })
      .onConflictDoUpdate({
        target: adminSecondFactor.userId,
        set: { secret: found.secret, backupCodes: found.backupCodes, updatedAt: now },
      });

    await tx.delete(adminEnrolment).where(eq(adminEnrolment.userId, found.accountId));

    await tx.update(user).set({ isAdmin: true }).where(eq(user.id, found.accountId));
  });

  return { ok: true, accountId: found.accountId };
}

/**
 * The one read all three steps share: an unexpired row for this token, with the
 * address the `otpauth://` URI labels the authenticator with.
 *
 * The token is hashed before it is looked up, through `#auth/config`'s own
 * `hashToken` rather than a second spelling of the same digest — two spellings of
 * one hash is a bug that presents as "the link does not work".
 */
async function findLiveEnrolment(db: DomainDatabase, token: string, now: Date) {
  const [row] = await db
    .select({
      accountId: adminEnrolment.userId,
      secret: adminEnrolment.secret,
      backupCodes: adminEnrolment.backupCodes,
      email: user.email,
    })
    .from(adminEnrolment)
    .innerJoin(user, eq(user.id, adminEnrolment.userId))
    .where(and(eq(adminEnrolment.tokenHash, hashToken(token)), gt(adminEnrolment.expiresAt, now)))
    .limit(1);

  return row;
}

/**
 * The Account this address belongs to, created if there is none.
 *
 * Matched on `email`, which is `citext`, so the address is found whatever case it
 * was typed in — the same property that stops one person holding two Accounts.
 */
async function findOrCreateAccount(db: DomainDatabase, email: string): Promise<string> {
  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  if (existing) return existing.id;

  const [created] = await db
    .insert(user)
    .values({
      id: crypto.randomUUID(),
      /**
       * Empty, like every magic-link Account: Google returns a real name at
       * sign-up and no other door does. Nothing renders an Admin's name.
       */
      name: "",
      email,
      emailVerified: true,
    })
    .returning({ id: user.id });

  if (!created) throw new Error(`the Account for ${email} was not created`);

  return created.id;
}
