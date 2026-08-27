/**
 * The kill switch and the sender identity, resolved and nothing more.
 *
 * Pure over an environment record for the reason `@repo/domain/src/config.ts`
 * gives: a decision that is checked once and then trusted forever belongs at
 * seam 1, with a test, rather than inside the module that acts on it. Nothing
 * here sends, opens a connection, or reads a global.
 */

import { AppError } from "@repo/errors/app-error";
import { SEND_FAILED } from "#user-messages";

/**
 * The kill switch. Set it to anything and every send is refused.
 *
 * DD10 asks for a forward fix that exists before it is needed, and this is it:
 * a send is the one irreversible act in this system, so the ability to stop all
 * of them has to be one environment variable and a restart, never a deploy.
 */
export const KILL_SWITCH_VARIABLE = "NOTIFICATIONS_KILL_SWITCH";

/** The `from` address. A real, monitored address on the sending subdomain (DD14). */
export const FROM_VARIABLE = "NOTIFICATIONS_FROM";

/**
 * Where a reply lands, and it is a product decision rather than a config line
 * (DD14). A displaced woman who replies to an Offer notification must reach a
 * person, which is why this is required rather than defaulted and why the
 * `from` address is never `noreply@`.
 */
export const REPLY_TO_VARIABLE = "NOTIFICATIONS_REPLY_TO";

/** Resend's own. Never in a `.env` file in this repo; `fly secrets` holds it (NFR24). */
export const API_KEY_VARIABLE = "RESEND_API_KEY";

/**
 * The values that leave the switch **off**. Everything else — including a typo,
 * including `maybe` — engages it.
 *
 * The direction is chosen rather than defaulted, and it is the whole design of
 * this variable. A switch someone believes is on and isn't costs an irreversible
 * send; a switch that engages when it should not costs a refusal, which is loud:
 * a `warn` line, and a caller surface that says the mail did not go. So the
 * unrecognised value fails toward not sending.
 *
 * `undefined` and empty are absence, not a value, and absence must leave sending
 * on — otherwise a production machine whose variable nobody set would silently
 * deliver nothing.
 */
const DISENGAGED_VALUES: ReadonlySet<string> = new Set(["", "off", "false", "0", "no"]);

/**
 * Read as a plain record rather than as `process.env` directly, so a test hands
 * it one and the production path hands it the other.
 */
export type NotificationsEnv = Readonly<Record<string, string | undefined>>;

/** True when the kill switch is engaged and no send may leave this process. */
export function sendingIsKilled(env: NotificationsEnv): boolean {
  return !DISENGAGED_VALUES.has((env[KILL_SWITCH_VARIABLE] ?? "").trim().toLowerCase());
}

/** Who the mail is from, and where a reply reaches a person. */
export interface SenderIdentity {
  readonly from: string;
  readonly replyTo: string;
}

/**
 * **The credential never reaches the error.** `redaction.ts` matches key
 * *names*, so a key interpolated into `message` is a secret at a key nothing is
 * watching. The message names the variable to set, which is also the only thing
 * the reader can act on.
 */
function required(env: NotificationsEnv, variable: string): string {
  const value = env[variable]?.trim();
  if (value) return value;

  throw new AppError({
    code: "notifications_config_missing",
    status: 503,
    message:
      `${variable} is unset or empty, so no notification can be sent. ` +
      "In production it comes from `fly secrets`; see docs/runbooks/recomencemos-go-live.md §1.",
    userMessage: SEND_FAILED,
    context: { variable },
  });
}

/** The sending credential. Read at transport construction, never logged. */
export function resendApiKey(env: NotificationsEnv = process.env): string {
  return required(env, API_KEY_VARIABLE);
}

/** The sender identity. Both halves required; neither has a safe default. */
export function senderIdentity(env: NotificationsEnv = process.env): SenderIdentity {
  return {
    from: required(env, FROM_VARIABLE),
    replyTo: required(env, REPLY_TO_VARIABLE),
  };
}
