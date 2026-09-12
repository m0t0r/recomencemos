/**
 * The seam every send in this product goes through.
 *
 * One implementation ships today (Resend). **A channel is added by implementing
 * {@link NotificationTransport}, never by editing a call site** ([intent
 * Q1](../../../docs/efforts/0002-profile-to-contact-exchange/intent.md)) — which
 * is the whole reason this module holds ports rather than a `Resend` instance.
 *
 * Three things ship *with* the seam rather than after it, because a send is the
 * one irreversible act in this system and the blast radius of a bad one is not
 * knowable without them: the kill switch, the per-send log line, and an
 * idempotency key on every call.
 */

import { AppError } from "@repo/errors/app-error";
import * as React from "react";
import {
  type NotificationsEnv,
  resendApiKey,
  senderIdentity,
  sendingIsKilled,
  transportName,
} from "#config";
import { assertServerOnly } from "#server-only";
import { createResendTransport } from "#transport/resend";
import { createTerminalTransport } from "#transport/terminal";
import { SEND_FAILED } from "#user-messages";

assertServerOnly("send");

/**
 * The kinds of notification this product sends.
 *
 * Closed, and the closure is doing two jobs. It fixes the `<event-type>` half of
 * DD14's idempotency key so a call site cannot invent one, and it fixes the
 * `notification` value on the log line so a drain's queries bind to a
 * vocabulary rather than to whatever string a Server Action happened to pass.
 *
 * Adding a kind is an edit *here* — which is not the thing intent Q1 forbids.
 * What it forbids is a call site learning that a second channel exists.
 */
export const NOTIFICATION_KINDS = [
  "magic-link",
  "offer-delivered",
  "contact-exchange",
  "check-in",
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** Resend's ceiling on an idempotency key. Ours is `<kind>/<entity-id>`, well under it. */
export const MAX_IDEMPOTENCY_KEY_LENGTH = 256;

/**
 * What a caller hands the seam.
 *
 * `to` and `recipientId` are two fields for one person on purpose. The address
 * is what the transport needs and it is `personal` under NFR18; the id is what
 * the log line carries. Keeping them apart is what lets the line be built from a
 * whitelist that simply does not contain the address — see {@link sentLine}.
 */
export interface Notification {
  readonly kind: NotificationKind;
  /** The recipient's address. Reaches the transport and **never** a log line. */
  readonly to: string;
  /** The recipient's Account id. This is the identifier a line carries (NFR18). */
  readonly recipientId: string;
  /**
   * The id of the thing this send is *about* — an Offer, an exchange, a magic
   * link request. With the recipient it makes the idempotency key, so two sends
   * to one person about the same entity are one delivery and a retry after a
   * timeout returns the original response instead of delivering a stranger's
   * phone number twice (DD14).
   */
  readonly entityId: string;
  readonly subject: string;
  /** A React Email template element. The transport renders it. */
  readonly body: React.ReactElement;
}

/** What the transport hands back. One field, because one field is all a line needs. */
export interface TransportReceipt {
  readonly id: string;
}

/** What the transport is given: a notification, plus the key that makes it retryable. */
export interface OutboundMessage extends Notification {
  readonly idempotencyKey: string;
}

/**
 * The port. Implement this to add a channel.
 *
 * It **throws** on failure rather than returning one, and that is the contract's
 * load-bearing clause. `resend.emails.send()` returns `{ data, error }`, so a
 * `try`/`catch` around it catches nothing and every send silently "succeeds" —
 * the vendor's own most-cited mistake (DD14), and exactly the shape that would
 * make DD9's "the send failed, the exchange still commits" fail *silently*
 * instead of loudly.
 */
export interface NotificationTransport {
  /** Names the channel on the log line. `resend` today. */
  readonly name: string;
  send(message: OutboundMessage): Promise<TransportReceipt>;
}

/**
 * The logging port, and the reason this package depends on `@repo/errors` alone.
 *
 * The spec's dependency graph draws `@repo/notifications → @repo/errors` and
 * nothing else, so the seam cannot import `@repo/observability`. Declaring the
 * shape it needs and taking it as an argument satisfies both halves: the line is
 * emitted by the seam rather than left to a call site's discipline, and the
 * logger stays where it lives. `pino`'s `Logger` satisfies this structurally —
 * `apps/web/notifications-boundary.test.ts` is where that is proven, because
 * this package cannot import the thing it would prove it against.
 */
export interface NotificationLogger {
  info(fields: Record<string, unknown>, message: string): void;
  warn(fields: Record<string, unknown>, message: string): void;
}

/**
 * What a caller gets back. A refusal is a *value*; a failure is a throw.
 *
 * The split is CLAUDE.md's "thrown is reported; returned is logged" applied to
 * the two ways a send does not happen. The kill switch working as designed is
 * not an incident and must not spend a Sentry event; a transport that failed is.
 */
export type SendOutcome =
  | { readonly status: "sent"; readonly id: string }
  | { readonly status: "suppressed"; readonly reason: "kill_switch" };

export interface Notifier {
  send(notification: Notification): Promise<SendOutcome>;
}

export interface NotifierOptions {
  readonly transport: NotificationTransport;
  readonly logger: NotificationLogger;
  /** Defaults to `process.env`. Passed explicitly at seam 1. */
  readonly env?: NotificationsEnv;
}

/**
 * DD14's key, with the recipient appended: `<event-type>/<entity-id>/<recipient-id>`.
 *
 * Keys last 24 hours, and the same key with a *different* payload is a 409 —
 * which is the correct failure for a bug that changed the body under a retry.
 *
 * **The recipient is in it because a Contact Exchange has two.** DD14 wrote
 * `contact-exchange/<id>` when every entity had one recipient; the exchange
 * sends a copy to her and a copy to him, both about the same exchange, and
 * keyed on the exchange alone the second is the first key with a different
 * body. Resend answers that with a 409, and one side never receives the copy of
 * what was accepted. A retry to the *same* person about the same thing is still
 * one delivery, which is the property the key exists for. The spec's Build
 * amendments record the change.
 */
export function idempotencyKeyFor(notification: Notification): string {
  const entityId = notification.entityId.trim();
  const recipientId = notification.recipientId.trim();

  if (!entityId) {
    throw new AppError({
      code: "notification_entity_id_missing",
      status: 500,
      message:
        `A ${notification.kind} notification was built with no entityId, so its ` +
        "idempotency key would collide with every other send of that kind. " +
        "entityId is the id of the thing the send is about.",
      userMessage: SEND_FAILED,
      context: { kind: notification.kind, recipientId: notification.recipientId },
    });
  }

  if (!recipientId) {
    throw new AppError({
      code: "notification_recipient_id_missing",
      status: 500,
      message:
        `A ${notification.kind} notification was built with no recipientId, so two ` +
        "recipients of one entity would share an idempotency key and the second send " +
        "would be refused as a changed retry.",
      userMessage: SEND_FAILED,
      context: { kind: notification.kind, entityId },
    });
  }

  const key = `${notification.kind}/${entityId}/${recipientId}`;

  if (key.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    throw new AppError({
      code: "notification_idempotency_key_too_long",
      status: 500,
      message:
        `The idempotency key for a ${notification.kind} notification is ${key.length} ` +
        `characters, over Resend's ${MAX_IDEMPOTENCY_KEY_LENGTH}. A rejected key means an ` +
        "unretryable send, so this is refused before the call rather than after it.",
      userMessage: SEND_FAILED,
      context: { kind: notification.kind, keyLength: key.length },
    });
  }

  return key;
}

/**
 * The line, built field by field from a whitelist.
 *
 * That is [ADR-0003](../../../docs/adr/0003-no-tojson-on-cross-boundary-types.md)'s
 * discipline applied to a log line instead of to a wire body, and it is what
 * makes NFR18 hold **by construction** rather than by discipline: the address is
 * a field of {@link Notification} and it is not a field of this record, so no
 * future field added to a notification leaks onto a line by default.
 *
 * Names are `snake_case` per
 * [ADR-0005](../../../docs/adr/0005-log-line-fields-are-named-for-the-line.md) —
 * the line names what it carries for itself, whatever the source called it.
 *
 * **`exchange_id` on the two kinds that are about an exchange**, beside the
 * `entity_id` every line carries. A completed send is the one thing in this
 * system with no undo, and `deploy-and-rollback.md` §4 enumerates a bad one's
 * blast radius by querying for `exchange_id` — so the line names it for what it
 * is, rather than leaving an operator to know which kinds' `entity_id` happens
 * to be an exchange.
 */
function sentLine(
  notification: Notification,
  channel: string,
  receipt: TransportReceipt,
): Record<string, unknown> {
  return {
    event: "notification.sent",
    notification: notification.kind,
    recipient_id: notification.recipientId,
    entity_id: notification.entityId,
    ...(EXCHANGE_KINDS.has(notification.kind) ? { exchange_id: notification.entityId } : {}),
    message_id: receipt.id,
    transport: channel,
  };
}

/** The kinds whose `entityId` is a Contact Exchange. */
const EXCHANGE_KINDS: ReadonlySet<NotificationKind> = new Set(["contact-exchange", "check-in"]);

/**
 * The suppression line — `warn`, and deliberately **not** an `info` `event`.
 *
 * DD11 closes the `info` event vocabulary at fourteen members (C40) and says a
 * fifteenth arrives through a spec amendment, not through a judgment call made
 * at Build time by whoever is writing the code. A suppressed send is not a
 * safety-relevant transition, so it does not belong on that list; CLAUDE.md's
 * existing rule — a handled failure costs one `warn` line and no event — is
 * where it does belong. So the vocabulary is not widened, and the refusal is
 * still on stdout where an operator who flipped the switch can count it.
 */
function suppressedLine(notification: Notification): Record<string, unknown> {
  return {
    notification: notification.kind,
    recipient_id: notification.recipientId,
    entity_id: notification.entityId,
    reason: "kill_switch",
  };
}

/**
 * Build the seam over a transport and a logger.
 *
 * The kill switch is read **per send** rather than at construction. Nothing in
 * this process changes it mid-run, so the two are equivalent in production — but
 * per-send resolution means the switch is a property of the environment rather
 * than of an object somebody built early, and it removes the one failure where a
 * long-lived notifier outlives the answer it cached.
 */
export function createNotifier({
  transport,
  logger,
  env = process.env,
}: NotifierOptions): Notifier {
  return {
    async send(notification: Notification): Promise<SendOutcome> {
      const idempotencyKey = idempotencyKeyFor(notification);

      if (sendingIsKilled(env)) {
        logger.warn(
          suppressedLine(notification),
          "Notification refused: the kill switch is engaged",
        );
        return { status: "suppressed", reason: "kill_switch" };
      }

      const receipt = await transport.send({ ...notification, idempotencyKey });

      logger.info(sentLine(notification, transport.name, receipt), "Notification sent");

      return { status: "sent", id: receipt.id };
    },
  };
}

/**
 * The composition point: the one place that decides which implementation of the
 * seam is in play.
 *
 * A caller asks for *a notifier*, not for Resend and not for a terminal — so
 * "which transport" is answered here, once, from configuration, and #12's
 * `requestMagicLink` never learns that a second one exists. That is intent Q1's
 * rule read literally: **a channel is added by implementing the seam, never by
 * editing a call site**, and a call site that branched on `NODE_ENV` would have
 * broken it while appearing to comply.
 *
 * Each branch resolves only the configuration it needs, which is what lets a
 * developer run the whole sign-in loop with no `RESEND_API_KEY` and no verified
 * domain: `terminal` never calls {@link resendApiKey}, so the credential is not
 * merely unused, it is never asked for.
 */
export function createTransport(env: NotificationsEnv = process.env): NotificationTransport {
  if (transportName(env) === "terminal") {
    return createTerminalTransport({ nodeEnv: env.NODE_ENV });
  }

  const { from } = senderIdentity(env);

  return createResendTransport({ apiKey: resendApiKey(env), from });
}

/** The seam, wired from the environment. What a Server Action calls. */
export function createNotifierFromEnv(
  logger: NotificationLogger,
  env: NotificationsEnv = process.env,
): Notifier {
  return createNotifier({ transport: createTransport(env), logger, env });
}

export { createResendTransport, type ResendTransportOptions } from "#transport/resend";
export { createTerminalTransport, type TerminalTransportOptions } from "#transport/terminal";
export {
  API_KEY_VARIABLE,
  FROM_VARIABLE,
  KILL_SWITCH_VARIABLE,
  TRANSPORT_NAMES,
  TRANSPORT_VARIABLE,
  resendApiKey,
  senderIdentity,
  sendingIsKilled,
  transportName,
  type NotificationsEnv,
  type SenderIdentity,
  type TransportName,
} from "#config";
