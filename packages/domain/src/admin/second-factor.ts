/**
 * The Admin's second factor, as values — the code format, the shape rule that
 * tells one kind of code from the other, the TOTP primitives, and the encryption
 * that keeps all of it out of the clear.
 *
 * **This is what the removed plugin was doing**, and it is here rather than
 * configured because Better Auth's `twoFactor` plugin can only challenge a
 * credential path: its sign-in interception matches `/sign-in/email`,
 * `/sign-in/username` and `/sign-in/phone-number` and nothing else. The Admin
 * door has no password to put on any of those, so a second factor the plugin
 * holds is one the door can never ask for. DD5 states that as the cause rather
 * than as the symptom, and names the three things owning it costs:
 *
 * 1. **The secret and the codes at rest** — `symmetricEncrypt`/`symmetricDecrypt`
 *    from `better-auth/crypto`, keyed on `BETTER_AUTH_SECRET`. The same primitive
 *    and the same key the plugin used, so the standing rotation hazard is
 *    unchanged rather than newly introduced.
 * 2. **Verification** — `createOTP(secret).verify(code, { window })` from
 *    `@better-auth/utils/otp`, which is the function the plugin itself calls, and
 *    a constant-time comparison for the codes.
 * 3. **The attempt bound**, which is the one thing that is not here: it is an
 *    NFR26 ceiling scoped to the Account, and it lives in `#rate-limit` beside
 *    every other ceiling in this product.
 *
 * **Everything in this module is pure over its arguments**, which is what puts
 * it at seam 1 where a population of generated codes can drive the assertions.
 * The rows it produces are written by `#admin/enrolment`, at seam 2.
 */

import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
import { constantTimeEqual, symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";

/**
 * What the authenticator app calls this account, in the six-digit list a person
 * scrolls at 6 a.m. looking for the right code.
 *
 * It is the product's name rather than a hostname on purpose: a person moderating
 * daily reads this label far more often than they read a URL.
 */
export const TOTP_ISSUER = "Recomencemos";

/**
 * Ten backup codes, which is DD5's first recovery path — stated here rather than
 * inherited from a library default, because runbook §6 asks a human to keep
 * **ten** and a default that silently became eight would make the runbook wrong
 * with nothing failing.
 */
export const BACKUP_CODE_COUNT = 10;

/**
 * The alphabet a backup code is drawn from, and every exclusion in it is about
 * transcription rather than entropy.
 *
 * `0`/`O` and `1`/`I` are the pairs a person confuses reading a code off a screen
 * at speed on the worst day they have had. The lower-case half of the brief's
 * list — `l` — is excluded by this alphabet being upper case at all, which is
 * also why a code is compared case-insensitively: the case carries nothing, so
 * refusing a lower-case paste would be a lockout bought with no security.
 *
 * **Thirty-two characters, which is not a coincidence.** A power of two means a
 * random byte masked to five bits selects one uniformly, with no modulo bias and
 * no rejection loop over the character choice.
 */
export const BACKUP_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/** Four, hyphen, four. The grouping is what makes eight characters readable. */
const BACKUP_CODE_GROUP_LENGTH = 4;
const BACKUP_CODE_LENGTH = BACKUP_CODE_GROUP_LENGTH * 2;

/**
 * The two kinds of code the door's one field accepts.
 *
 * **A field the person picks would be the wrong shape**, and DD5's contract says
 * so: the two are told apart *by shape*, so somebody who has lost their phone
 * types a printed code into the same box without first having to find a control
 * that says they are about to.
 */
export const ADMIN_CODE_SHAPES = { totp: "totp", backupCode: "backup_code" } as const;

export type AdminCodeShape = (typeof ADMIN_CODE_SHAPES)[keyof typeof ADMIN_CODE_SHAPES];

/** Exactly six digits and nothing else is what an authenticator produces. */
const TOTP_CODE = /^\d{6}$/;

/**
 * How many 30-second steps either side of now a code is accepted in.
 *
 * One, which is the library's own default and the ordinary allowance for a phone
 * whose clock has drifted. Widening it widens the window an intercepted code is
 * good for, so it is stated here rather than inherited.
 */
const TOTP_WINDOW = 1;

/**
 * Which kind of code this is.
 *
 * **Anything that is not six digits is read as a backup code**, and that default
 * is the right way round. Six digits is the only thing an authenticator produces,
 * so everything else is checked against the ten codes and refused there; falling
 * the other way would send a mistyped backup code to a comparison that can only
 * ever say no.
 */
export function classifyAdminCode(code: string): AdminCodeShape {
  return TOTP_CODE.test(code) ? ADMIN_CODE_SHAPES.totp : ADMIN_CODE_SHAPES.backupCode;
}

/**
 * One backup code: eight characters from {@link BACKUP_CODE_ALPHABET}, in two
 * hyphenated groups of four, **containing at least one letter**.
 *
 * That last clause is the load-bearing one, and it is what
 * {@link classifyAdminCode} rests on: without it, a code could come out as eight
 * digits, of which the first six read as a code from an authenticator. The door
 * would then compare a printed code against a TOTP secret and refuse it, on the
 * one occasion the codes exist for.
 *
 * **Enforced by regenerating rather than by substituting a letter in.** Placing
 * one at a fixed position would leak that position; placing it at a random one
 * is a second random draw to get right. The all-digit case is about one code in
 * sixty-five thousand, so drawing again is free and is the only version of this
 * that is obviously uniform over the codes it does produce.
 */
function generateBackupCode(): string {
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint8Array(BACKUP_CODE_LENGTH));
    // Five bits per character, which is exactly one index into a 32-character
    // alphabet — so no value is more likely than another.
    const characters = Array.from(bytes, (byte) => BACKUP_CODE_ALPHABET[byte & 31] as string);
    const code = characters.join("");

    if (!/[A-Z]/.test(code)) continue;

    return `${code.slice(0, BACKUP_CODE_GROUP_LENGTH)}-${code.slice(BACKUP_CODE_GROUP_LENGTH)}`;
  }
}

/**
 * The ten, distinct.
 *
 * Distinct because a duplicate would silently be ten recoveries minus one, and
 * because consuming one removes every equal member from the remainder.
 */
export function generateBackupCodes(count: number = BACKUP_CODE_COUNT): readonly string[] {
  const codes = new Set<string>();
  while (codes.size < count) codes.add(generateBackupCode());
  return [...codes];
}

/** How a person may have typed a code, reduced to how it is stored. */
function normaliseBackupCode(code: string): string {
  return code.trim().toUpperCase();
}

export interface BackupCodeOutcome {
  readonly matched: boolean;
  /** The codes still unused. Unchanged when nothing matched. */
  readonly remaining: readonly string[];
}

/**
 * Check one typed code against the set, and say what is left.
 *
 * **The comparison is constant-time**, which is the same choice the plugin made:
 * a comparison that returns early on the first differing character tells an
 * attacker how much of a code they have right, and ten codes is a small enough
 * set for that to matter.
 *
 * **It returns the remainder rather than mutating**, so the caller writes the
 * new value inside the transaction that establishes the session — which is what
 * makes "each code works once" a property of the column rather than a rule a
 * query has to remember.
 */
export function verifyBackupCode(codes: readonly string[], typed: string): BackupCodeOutcome {
  const candidate = normaliseBackupCode(typed);

  // Every code is compared, and the loop does not stop at the match. Stopping
  // would make the number of comparisons depend on which code was given, which
  // is the timing signal `constantTimeEqual` is being used to avoid.
  let matched = false;
  for (const code of codes) {
    if (candidate.length === code.length && constantTimeEqual(candidate, code)) matched = true;
  }

  return { matched, remaining: matched ? codes.filter((code) => code !== candidate) : codes };
}

/**
 * A fresh TOTP secret.
 *
 * Thirty-two characters, which is the length the plugin generated, drawn from
 * the same alphabet its own `generateRandomString` uses. The value is raw here
 * and base32 only at the two places it leaves — see {@link manualEntrySecret}.
 */
export function generateTotpSecret(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  // The largest multiple of 62 that fits in a byte. Everything at or above it is
  // drawn again rather than folded down: 62 does not divide 256, so a plain
  // modulo would make the first eight characters of the alphabet likelier than
  // the rest — a small bias, on the value the whole factor rests on.
  const ceiling = 256 - (256 % alphabet.length);

  let secret = "";
  while (secret.length < 32) {
    for (const byte of crypto.getRandomValues(new Uint8Array(32))) {
      if (byte >= ceiling) continue;
      secret += alphabet[byte % alphabet.length] as string;
      if (secret.length === 32) break;
    }
  }

  return secret;
}

/**
 * The `otpauth://` URI the QR encodes.
 *
 * Server-minted, always, and never built from anything a person typed — the QR
 * component's own contract depends on that.
 */
export function totpUri(secret: string, email: string): string {
  return createOTP(secret).url(TOTP_ISSUER, email);
}

/**
 * The same secret in the form a person can type, for the authenticator that will
 * not read a QR — a failed camera, a glaring screen, or the Admin enrolling on
 * the very phone that would have to photograph itself.
 *
 * **It is the value the URI already carries**, not a second encoding of the
 * secret: `createOTP().url` base32-encodes without padding, and this is that
 * same call. Two spellings here would enrol a factor the door then refuses,
 * which is why seam 1 asserts the two against each other rather than asserting
 * this one's alphabet alone.
 */
export function manualEntrySecret(secret: string): string {
  return base32.encode(secret, { padding: false });
}

/** Whether a six-digit code is the one this secret is showing. */
export function verifyTotpCode(secret: string, code: string): Promise<boolean> {
  return createOTP(secret).verify(code, { window: TOTP_WINDOW });
}

/**
 * The four functions that keep a credential out of the clear.
 *
 * `key` is `BETTER_AUTH_SECRET`, taken as a parameter rather than read from the
 * environment here: this module is pure over its arguments, which is what lets
 * seam 1 assert that a factor encrypted under one key cannot be read under
 * another — the rotation hazard, as a test rather than as a paragraph.
 */
export function encryptTotpSecret(secret: string, key: string): Promise<string> {
  return symmetricEncrypt({ key, data: secret });
}

export function decryptTotpSecret(stored: string, key: string): Promise<string> {
  return symmetricDecrypt({ key, data: stored });
}

export function encryptBackupCodes(codes: readonly string[], key: string): Promise<string> {
  return symmetricEncrypt({ key, data: JSON.stringify(codes) });
}

/**
 * **Parsed strictly, and a shape this module did not write is an error rather
 * than an empty set.** An empty set of codes reads as "every code has been used"
 * — a recovery path that silently refuses — where a throw reads as what it is: a
 * row that cannot be interpreted, on the one table where guessing is worst.
 */
export async function decryptBackupCodes(stored: string, key: string): Promise<readonly string[]> {
  const decrypted = await symmetricDecrypt({ key, data: stored });
  const parsed: unknown = JSON.parse(decrypted);

  if (!Array.isArray(parsed) || parsed.some((code) => typeof code !== "string")) {
    throw new TypeError(
      "The stored backup codes did not decrypt to a list of strings. Something other than this " +
        "module wrote that column, and reading it as an empty set would refuse a recovery path " +
        "rather than report a broken row.",
    );
  }

  return parsed as readonly string[];
}
