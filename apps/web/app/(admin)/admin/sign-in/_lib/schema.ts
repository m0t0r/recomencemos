/**
 * The boundary parse for the Admin's door — one schema per step, and the second
 * factor's `kind` as a **bound argument** rather than a field.
 *
 * ADR-0014's rule is that a schema is parsed twice, on the client for the message
 * and on the server for the truth; ADR-0015's is that a value travelling with a
 * submit but not typed into it is a bound argument, not a hidden `<input>`. The
 * code's `kind` is exactly that shape: the *form* knows whether it is the
 * authenticator field or the backup-code field, the person does not type it, and
 * a hidden input mirroring it would be a value an attacker could flip.
 *
 * **This module imports nothing from `@repo/domain`, and that is load-bearing** —
 * the same rule `/sign-in/_lib/schema.ts` carries. It is reached from a Client
 * Component, and `@repo/domain/auth-handler` pulls `#connection`, and `pg`, onto
 * the client graph; `server-only` refused exactly that once already on the other
 * sign-in surface.
 *
 * **Every schema takes `FormData` or a plain object**, because next-safe-action
 * does not convert `FormData` — verified against the installed package on #12, and
 * the reason `/sign-in` carries the same four-line `preprocess` rather than a
 * `zod-form-data` dependency.
 */

import { z } from "zod";
import { ADMIN_CREDENTIALS_REQUIRED, CODE_REQUIRED } from "./messages";

const text = (raw: FormDataEntryValue | null) => (typeof raw === "string" ? raw : "");

/**
 * **The password's length is *not* checked here, and that is deliberate.**
 *
 * DD5 puts the floor at sixteen and `emailAndPassword.minPasswordLength` in
 * `@repo/domain` is what enforces it — a number this module cannot import without
 * putting the domain on the client graph. Restating it as a literal would be a
 * second spelling of a value Better Auth owns, and the two would disagree the
 * first time either moved.
 *
 * Nothing is lost. On a sign-in form the length rule has no client-side work to
 * do: a *correct* password passes it by construction, and quoting the floor back
 * at a failed attempt tells an attacker how long the Admin's password is. So this
 * checks presence, and the library checks the rest.
 */
export const adminSignInFields = z.object({
  email: z.string().trim().min(1, ADMIN_CREDENTIALS_REQUIRED),
  password: z.string().min(1, ADMIN_CREDENTIALS_REQUIRED),
});

export const adminSignInSchema = z.preprocess(
  (raw) =>
    raw instanceof FormData
      ? { email: text(raw.get("email")), password: text(raw.get("password")) }
      : raw,
  adminSignInFields,
);

export type AdminSignInInput = z.output<typeof adminSignInFields>;

/**
 * The second factor. **Six digits, or a backup code** — one schema, because the
 * only thing this parse owes either is that something was typed. Which door it was
 * is the bound argument below, and whether the value is right is a constant-time
 * comparison inside Better Auth.
 *
 * Whitespace is stripped rather than merely trimmed: a person reading a printed
 * code off paper types it in the groups the paper shows them.
 */
export const secondFactorFields = z.object({
  code: z
    .string()
    .transform((code) => code.replaceAll(/\s+/gu, ""))
    .pipe(z.string().min(1, CODE_REQUIRED).max(64)),
});

export const secondFactorSchema = z.preprocess(
  (raw) => (raw instanceof FormData ? { code: text(raw.get("code")) } : raw),
  secondFactorFields,
);

export type SecondFactorInput = z.output<typeof secondFactorFields>;

/**
 * Which field the code came from. A bound argument, so it is typed, validated on
 * arrival, encoded by React, and not something a person can put on the wire.
 *
 * **The two doors verify against different stored values** — a TOTP secret and ten
 * single-use codes — so this is not cosmetic: a caller able to flip it would turn
 * a six-digit brute force into a backup-code brute force against the other
 * comparison, which is precisely why it is not a hidden input.
 */
export const secondFactorKindArg = z.enum(["totp", "backup_code"]);

/** Enrolment re-confirms the password, because adding a second factor is a credential change. */
export const enrolFields = z.object({
  password: z.string().min(1, ADMIN_CREDENTIALS_REQUIRED),
});

export const enrolSchema = z.preprocess(
  (raw) => (raw instanceof FormData ? { password: text(raw.get("password")) } : raw),
  enrolFields,
);

export type EnrolInput = z.output<typeof enrolFields>;

/** Six digits, which is what `totpOptions.digits` defaults to and DD5 leaves alone. */
export const TOTP_DIGITS = 6;
