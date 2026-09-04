/**
 * What the second-factor screen accepts, and the one rule its client half is
 * allowed to have an opinion about.
 *
 * **The field is deliberately almost unvalidated, and that is the decision this
 * module exists to record.** A schema that knew what a TOTP code looks like or
 * what a printed code looks like would be a third place that knowledge lives —
 * beside `classifyAdminCode`, which decides which factor to check, and beside
 * the generator that makes the printed codes contain a letter. Every wrong
 * shape has one answer here and it is the same answer a wrong code gets, so
 * there is nothing for a stricter parse to buy and something for it to leak: a
 * field error saying "that is not six digits" tells a caller which of the two
 * credentials the door was about to check.
 *
 * So the boundary parse asks one question — is there a string at all — and the
 * door answers the rest.
 *
 * **This module imports nothing from `@repo/domain`.** It is reached from a
 * Client Component, and `@repo/domain/auth-handler` pulls `#connection` and `pg`
 * onto the client graph; `server-only` refuses that at the door, which is
 * mechanism 2 doing its job rather than a hazard to route around.
 */

import { z } from "zod";

/**
 * A code, as far as the boundary is concerned: a string.
 *
 * **There is no minimum and no shape**, and the omission is the point. Every
 * value that is not the right code has one answer, and it is the door's — so an
 * empty field, a five-digit code and a mistyped printed one all travel to the
 * same place and come back with the same sentence. A `min(1)` here would produce
 * a *seventh* failure the design has spent effort collapsing to one, and it
 * would need a sentence of its own that says something the door's does not.
 *
 * The empty field is refused earlier and for free: the input is `required`, so
 * the browser refuses it natively, with no JavaScript and in the reader's own
 * locale.
 *
 * **Trimmed here as well as in the door.** The door trims because it must — it
 * is reachable as a compiled POST endpoint and cannot trust a caller — and this
 * trims so the value the boundary passes on is the value the door will classify.
 */
export const codeField = z.string().trim();

export const verifyCodeFields = z.object({ code: codeField });

/**
 * The same field, reached from either shape a caller can arrive in.
 *
 * next-safe-action does not convert `FormData` — so an action driven by
 * `useActionState` receives the raw object and the schema is what has to accept
 * it. Four lines rather than a `zod-form-data` dependency, which is the trade
 * `/sign-in` already made for a form with one field.
 */
export const verifyCodeSchema = z.preprocess(
  (raw) => (raw instanceof FormData ? { code: raw.get("code") ?? "" } : raw),
  verifyCodeFields,
);

export type VerifyCodeInput = z.output<typeof verifyCodeFields>;

/**
 * Whether what has been typed is a complete authenticator code.
 *
 * **This is an accelerator and never a decision**, which is why it lives here
 * rather than being imported from the domain. It answers one question: may the
 * form submit itself without a button press. Getting it wrong costs a keystroke;
 * `classifyAdminCode` in `@repo/domain` is what actually picks the factor, and
 * it is unreachable from a browser by construction.
 *
 * **It anchors on exactly six digits, and the printed form of a backup code is
 * what makes that safe.** A printed code is four characters, a hyphen, four —
 * so its fifth character is never a digit and no prefix of one typed as printed
 * is ever six digits. That is the property that lets the form fire on completion
 * without touching the recovery path.
 *
 * **The one case it does not cover is stated rather than papered over.** The
 * door normalises a typed code, so somebody who omits the hyphen still gets in —
 * and roughly one code in four thousand then has six digits in front of its
 * letters, so the form submits a prefix while they are still typing. What that
 * costs is exact: one attempt against the **TOTP** ceiling, which is a separate
 * row from the backup-code one, plus a refusal on screen that the next
 * keystrokes replace. The recovery path is untouched, which is the whole reason
 * those two ceilings are separate. Anything that closed the gap — a debounce, a
 * minimum length — would cost every ordinary sign-in the keystroke this exists
 * to save.
 *
 * The trim matters for the same reason the schema's does: a code pasted with a
 * trailing space is six digits, and the person who pasted it should not have to
 * find the space.
 */
const COMPLETE_TOTP_CODE = /^\d{6}$/;

export function isCompleteTotpCode(value: string): boolean {
  return COMPLETE_TOTP_CODE.test(value.trim());
}
