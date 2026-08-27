/**
 * The one implementation of {@link NotificationTransport} that ships today.
 *
 * It is a **separate module from the seam** so that the seam's tests can prove
 * the contract with this substituted — which is the difference between testing a
 * seam and testing a vendor. Adding a second channel adds a sibling here and
 * changes nothing in `send.ts` and nothing at a call site.
 */

import { AppError } from "@repo/errors/app-error";
import { Resend } from "resend";
import type { NotificationTransport, OutboundMessage, TransportReceipt } from "#send";
import { assertServerOnly } from "#server-only";
import { SEND_FAILED } from "#user-messages";

assertServerOnly("transport/resend");

/**
 * Exactly the slice of the SDK this transport uses.
 *
 * Declared rather than imported so a unit test can hand the transport a stub
 * without pulling a network client into the suite, and so the `{ data, error }`
 * shape below is stated where the code that depends on it lives.
 */
export interface ResendEmailsApi {
  send(
    payload: {
      from: string;
      to: string[];
      subject: string;
      react: OutboundMessage["body"];
    },
    options: { idempotencyKey: string },
  ): Promise<{ data: { id: string } | null; error: { name?: string; message: string } | null }>;
}

export interface ResendTransportOptions {
  readonly apiKey: string;
  readonly from: string;
  /** Substituted in a unit test. Defaults to a real client built from `apiKey`. */
  readonly emails?: ResendEmailsApi;
}

export function createResendTransport({
  apiKey,
  from,
  emails,
}: ResendTransportOptions): NotificationTransport {
  const api: ResendEmailsApi = emails ?? (new Resend(apiKey).emails as unknown as ResendEmailsApi);

  return {
    name: "resend",

    async send(message: OutboundMessage): Promise<TransportReceipt> {
      /**
       * **`react`, not `html`.** The Resend SDK renders the element and derives
       * the plain-text alternative from it automatically, which is NFR20's
       * requirement met by the send path rather than by every template
       * remembering to produce two bodies.
       */
      /**
       * **No `replyTo`, and its absence is the decision rather than an
       * omission.** `mail.recomencemos.online` is a send-only domain in Resend
       * — no MX record, no mailbox. A `Reply-To` header would name an address
       * that receives nothing, which is a dead end asserted instead of merely
       * present. Without one, a reply goes to `from`, finds no MX, and the
       * sender's own provider bounces it: she is told, rather than left to
       * wonder. That is DD14's amended answer; see the spec.
       */
      const { data, error } = await api.send(
        {
          from,
          to: [message.to],
          subject: message.subject,
          react: message.body,
        },
        { idempotencyKey: message.idempotencyKey },
      );

      /**
       * **The SDK does not throw.** It returns `{ data, error }`, so a
       * `try`/`catch` here would catch nothing and every failed send would read
       * as a success — the vendor's own most-cited mistake, and the one DD14
       * names because it is the shape that makes DD9's "the send failed, the
       * exchange still commits" fail silently instead of loudly.
       *
       * `error.message` is the vendor's operator-facing string and reaches
       * `message`. It never reaches `userMessage`: there is no code path from
       * one to the other, which is the rule that keeps `AppError` from becoming
       * a leak.
       */
      if (error || !data) {
        throw new AppError({
          code: "notification_send_failed",
          status: 502,
          message:
            `Resend refused a ${message.kind} notification: ` +
            `${error?.name ?? "unknown_error"} — ${error?.message ?? "the SDK returned neither data nor an error"}`,
          userMessage: SEND_FAILED,
          context: {
            kind: message.kind,
            recipientId: message.recipientId,
            entityId: message.entityId,
            idempotencyKey: message.idempotencyKey,
            resendError: error?.name,
          },
        });
      }

      return { id: data.id };
    },
  };
}
