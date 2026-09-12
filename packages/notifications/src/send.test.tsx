/**
 * The seam's contract, with the transport substituted.
 *
 * The substitution is the point, and the ticket asks for it in those words: the
 * transport itself is not mocked into a test that pretends to be an integration.
 * Nothing here reaches the network, and nothing here claims Resend works. What
 * it claims is that *given* a transport, the seam refuses when the switch is on,
 * emits one line when it is not, throws when the transport does, and never puts
 * an address on a line.
 */

import { AppError } from "@repo/errors/app-error";
import { createElement } from "react";
import {
  KILL_SWITCH_VARIABLE,
  type Notification,
  type NotificationLogger,
  type NotificationTransport,
  type OutboundMessage,
  createNotifier,
  idempotencyKeyFor,
} from "#send";

const RECIPIENT_ADDRESS = "ana@example.com";

const notification: Notification = {
  kind: "magic-link",
  to: RECIPIENT_ADDRESS,
  recipientId: "acc_01HZY",
  entityId: "mlr_01J4K",
  subject: "Tu enlace para entrar a Recomencemos",
  body: createElement("p", null, "enlace"),
};

interface RecordedLine {
  readonly level: "info" | "warn";
  readonly fields: Record<string, unknown>;
  readonly message: string;
}

function recordingLogger(): NotificationLogger & { readonly lines: RecordedLine[] } {
  const lines: RecordedLine[] = [];
  return {
    lines,
    info: (fields, message) => void lines.push({ level: "info", fields, message }),
    warn: (fields, message) => void lines.push({ level: "warn", fields, message }),
  };
}

function fakeTransport(
  send: (message: OutboundMessage) => Promise<{ id: string }>,
): NotificationTransport & { readonly calls: OutboundMessage[] } {
  const calls: OutboundMessage[] = [];
  return {
    name: "fake",
    calls,
    send: (message) => {
      calls.push(message);
      return send(message);
    },
  };
}

const delivers = () => fakeTransport(async () => ({ id: "msg_01J9Q" }));

describe("the kill switch", () => {
  it("refuses the send without reaching the transport", async () => {
    const transport = delivers();
    const logger = recordingLogger();
    const notifier = createNotifier({
      transport,
      logger,
      env: { [KILL_SWITCH_VARIABLE]: "on" },
    });

    const outcome = await notifier.send(notification);

    expect(outcome).toEqual({ status: "suppressed", reason: "kill_switch" });
    // The load-bearing assertion. A kill switch that refuses *after* the call
    // has refused nothing — the send is the irreversible act.
    expect(transport.calls).toHaveLength(0);
  });

  it("logs the refusal, so a suppressed send is countable rather than silent", async () => {
    const logger = recordingLogger();
    const notifier = createNotifier({
      transport: delivers(),
      logger,
      env: { [KILL_SWITCH_VARIABLE]: "on" },
    });

    await notifier.send(notification);

    expect(logger.lines).toHaveLength(1);
    expect(logger.lines[0]?.level).toBe("warn");
    expect(logger.lines[0]?.fields).toMatchObject({
      notification: "magic-link",
      recipient_id: "acc_01HZY",
      reason: "kill_switch",
    });
  });

  // DD11 closes the `info` event vocabulary at fourteen (C40), and a fifteenth
  // is a spec amendment rather than a Build-time judgment call. A refusal is not
  // a safety-relevant transition, so it must not arrive as one.
  it("adds no `event` to the closed info vocabulary", async () => {
    const logger = recordingLogger();
    const notifier = createNotifier({
      transport: delivers(),
      logger,
      env: { [KILL_SWITCH_VARIABLE]: "on" },
    });

    await notifier.send(notification);

    expect(logger.lines[0]?.fields).not.toHaveProperty("event");
  });

  it("lets the send through when the switch is off", async () => {
    const transport = delivers();
    const notifier = createNotifier({
      transport,
      logger: recordingLogger(),
      env: { [KILL_SWITCH_VARIABLE]: "off" },
    });

    await expect(notifier.send(notification)).resolves.toEqual({
      status: "sent",
      id: "msg_01J9Q",
    });
    expect(transport.calls).toHaveLength(1);
  });
});

describe("the sent line", () => {
  it("is exactly one info line carrying the two ids and the message id", async () => {
    const logger = recordingLogger();
    const notifier = createNotifier({ transport: delivers(), logger, env: {} });

    await notifier.send(notification);

    expect(logger.lines).toHaveLength(1);
    expect(logger.lines[0]?.level).toBe("info");
    expect(logger.lines[0]?.fields).toEqual({
      event: "notification.sent",
      notification: "magic-link",
      recipient_id: "acc_01HZY",
      entity_id: "mlr_01J4K",
      message_id: "msg_01J9Q",
      transport: "fake",
    });
  });

  /**
   * NFR18, and the assertion is over the *serialised line* rather than over a
   * named field on purpose. Asserting `fields.to` is absent proves only that one
   * spelling is absent; this proves the address is nowhere, which is the claim
   * the ticket actually makes — and it is the assertion that goes red when
   * somebody adds a field to `Notification` and spreads it onto a line.
   */
  it("never carries the recipient's address, in any field", async () => {
    const logger = recordingLogger();
    const notifier = createNotifier({ transport: delivers(), logger, env: {} });

    await notifier.send(notification);

    expect(JSON.stringify(logger.lines)).not.toContain(RECIPIENT_ADDRESS);
    expect(JSON.stringify(logger.lines)).not.toContain("example.com");
  });

  /**
   * **The field an operator is told to query.** `deploy-and-rollback.md` §4
   * enumerates a bad send's blast radius by `exchange_id`, so both kinds that are
   * about an exchange carry it under that name. `entity_id` stays on every line,
   * which is what a query across all four kinds binds to.
   */
  it.each(["contact-exchange", "check-in"] as const)(
    "names the exchange a %s send was about as exchange_id",
    async (kind) => {
      const logger = recordingLogger();
      const notifier = createNotifier({ transport: delivers(), logger, env: {} });

      await notifier.send({ ...notification, kind, entityId: "812" });

      expect(logger.lines[0]?.fields).toMatchObject({ entity_id: "812", exchange_id: "812" });
    },
  );

  it.each(["magic-link", "offer-delivered"] as const)(
    "carries no exchange_id on a %s send, which is about no exchange",
    async (kind) => {
      const logger = recordingLogger();
      const notifier = createNotifier({ transport: delivers(), logger, env: {} });

      await notifier.send({ ...notification, kind });

      expect(logger.lines[0]?.fields).not.toHaveProperty("exchange_id");
    },
  );

  it("names the transport, so a second channel is legible on the line", async () => {
    const logger = recordingLogger();
    const notifier = createNotifier({
      transport: fakeTransport(async () => ({ id: "sms_1" })),
      logger,
      env: {},
    });

    await notifier.send(notification);

    expect(logger.lines[0]?.fields).toMatchObject({ transport: "fake" });
  });
});

describe("a transport failure", () => {
  const failing = () =>
    fakeTransport(async () => {
      throw new AppError({
        code: "notification_send_failed",
        status: 502,
        message: "Resend refused it",
        userMessage: "No pudimos enviar el correo. Inténtalo de nuevo.",
      });
    });

  // DD14's whole point about `{ data, error }` is that the failure must be loud.
  // A returned failure here would be the silent version of that bug wearing a
  // type.
  it("propagates rather than returning an outcome", async () => {
    const notifier = createNotifier({
      transport: failing(),
      logger: recordingLogger(),
      env: {},
    });

    await expect(notifier.send(notification)).rejects.toBeInstanceOf(AppError);
  });

  it("emits no sent line", async () => {
    const logger = recordingLogger();
    const notifier = createNotifier({ transport: failing(), logger, env: {} });

    await expect(notifier.send(notification)).rejects.toThrow();
    expect(logger.lines).toHaveLength(0);
  });
});

describe("idempotencyKeyFor", () => {
  // DD14's `<event-type>/<entity-id>`, with the recipient appended. A retry to
  // the same person about the same thing is one delivery — a retry after a
  // timeout returns the original response instead of delivering a stranger's
  // phone number twice.
  it("is <kind>/<entity-id>/<recipient-id>", () => {
    expect(idempotencyKeyFor(notification)).toBe("magic-link/mlr_01J4K/acc_01HZY");
  });

  /**
   * **Why the recipient is in the key.** A Contact Exchange is the first thing
   * this product sends about to two people: one copy to her and one to him,
   * both about the same exchange. Keyed on the exchange alone, the second is
   * the same key with a different body, which Resend answers with a 409 — and
   * one of the two never receives the copy of what they accepted.
   */
  it("gives the two sides of one exchange two keys", () => {
    const toHer = { ...notification, kind: "contact-exchange" as const, entityId: "812" };
    const toHim = { ...toHer, recipientId: "acc_02HIRER" };

    expect(idempotencyKeyFor(toHer)).toBe("contact-exchange/812/acc_01HZY");
    expect(idempotencyKeyFor(toHim)).toBe("contact-exchange/812/acc_02HIRER");
  });

  it("reaches the transport on every call", async () => {
    const transport = delivers();
    const notifier = createNotifier({ transport, logger: recordingLogger(), env: {} });

    await notifier.send(notification);

    expect(transport.calls[0]?.idempotencyKey).toBe("magic-link/mlr_01J4K/acc_01HZY");
  });

  // The same collision one field over: an empty recipient id would key both
  // sides of an exchange identically, which is the 409 the recipient is there
  // to prevent.
  it("refuses an empty recipient id rather than colliding the two sides", () => {
    expect(() => idempotencyKeyFor({ ...notification, recipientId: " " })).toThrow(AppError);
  });

  // An empty entity id would key every send of that kind identically, so the
  // second Offer notification of the day would return the first one's response
  // and never be delivered. That is a silent non-delivery, which is the failure
  // class this whole package is arranged against.
  it("refuses an empty entity id rather than colliding every send of that kind", () => {
    expect(() => idempotencyKeyFor({ ...notification, entityId: "  " })).toThrow(AppError);
  });

  it("refuses a key over Resend's 256 characters", () => {
    expect(() => idempotencyKeyFor({ ...notification, entityId: "x".repeat(256) })).toThrow(
      AppError,
    );
  });

  it("is checked before the switch, so a broken key is loud even while sending is off", async () => {
    const transport = delivers();
    const notifier = createNotifier({
      transport,
      logger: recordingLogger(),
      env: { [KILL_SWITCH_VARIABLE]: "on" },
    });

    await expect(notifier.send({ ...notification, entityId: "" })).rejects.toBeInstanceOf(AppError);
    expect(transport.calls).toHaveLength(0);
  });
});
