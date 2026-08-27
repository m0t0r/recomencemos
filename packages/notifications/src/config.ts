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

/**
 * Which implementation of the seam is in play. `resend` or `terminal`.
 *
 * **It has no default, and refusing to pick one is the design.** Both wrong
 * answers are bad in a way a default cannot hedge: defaulting to `resend` means
 * a developer's first sign-in loop mails a stranger from an unwarmed domain,
 * and defaulting to `terminal` means a production machine sends nothing at all
 * and nobody finds out. There is no third value that is safe in both places, so
 * the variable is required and an unset one throws — the same stance
 * {@link senderIdentity} takes, for the same reason.
 */
export const TRANSPORT_VARIABLE = "NOTIFICATIONS_TRANSPORT";

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

/** The implementations of the seam that ship. Adding a channel adds a member here. */
export const TRANSPORT_NAMES = ["resend", "terminal"] as const;

export type TransportName = (typeof TRANSPORT_NAMES)[number];

function isTransportName(value: string): value is TransportName {
  return (TRANSPORT_NAMES as readonly string[]).includes(value);
}

/**
 * Which transport to build.
 *
 * An unrecognised value is refused rather than coerced to either name — the
 * kill switch can afford to read a typo as "engaged" because that direction is
 * the safe one, and this variable has no safe direction. So a typo stops the
 * process with a message naming both valid values.
 */
export function transportName(env: NotificationsEnv = process.env): TransportName {
  const value = required(env, TRANSPORT_VARIABLE).toLowerCase();

  if (!isTransportName(value)) {
    throw new AppError({
      code: "notifications_transport_unknown",
      status: 500,
      message:
        `${TRANSPORT_VARIABLE} is "${value}", which is not a transport this package ships. ` +
        `Valid values: ${TRANSPORT_NAMES.join(", ")}. Neither is a safe default, so an ` +
        "unrecognised value is refused rather than guessed.",
      userMessage: SEND_FAILED,
      context: { variable: TRANSPORT_VARIABLE, value },
    });
  }

  return value;
}
