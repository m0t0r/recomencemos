/**
 * A **unit test of the transport's error handling**, and it is named that way
 * because the thing it must not be mistaken for is an integration test.
 *
 * Nothing here proves Resend delivers mail. The single real send that does is a
 * runbook act, and its evidence is the `Authentication-Results` header on a
 * message in an inbox — not an assertion in this file. What is provable without
 * the network is the half DD14 says the vendor's own users get wrong: the SDK
 * returns `{ data, error }` and does not throw, so a transport that trusts a
 * resolved promise reports every failed send as a success.
 */

import { AppError } from "@repo/errors/app-error";
import * as React from "react";
import type { OutboundMessage } from "#send";
import { type ResendEmailsApi, createResendTransport } from "#transport/resend";

const message: OutboundMessage = {
  kind: "magic-link",
  to: "ana@example.com",
  recipientId: "acc_01HZY",
  entityId: "mlr_01J4K",
  subject: "Tu enlace para entrar a Recomencemos",
  body: React.createElement("p", null, "enlace"),
  idempotencyKey: "magic-link/mlr_01J4K",
};

function transportOver(emails: ResendEmailsApi) {
  return createResendTransport({
    apiKey: "re_test",
    from: "Recomencemos <hola@mail.recomencemos.online>",
    emails,
  });
}

function stub(result: Awaited<ReturnType<ResendEmailsApi["send"]>>) {
  const calls: Parameters<ResendEmailsApi["send"]>[] = [];
  const emails: ResendEmailsApi = {
    send: async (...args) => {
      calls.push(args);
      return result;
    },
  };
  return { emails, calls };
}

describe("the { data, error } contract", () => {
  it("returns the message id when the SDK returns data", async () => {
    const { emails } = stub({ data: { id: "msg_01J9Q" }, error: null });

    await expect(transportOver(emails).send(message)).resolves.toEqual({ id: "msg_01J9Q" });
  });

  // The one that would otherwise pass silently. `resend.emails.send()` resolves
  // on failure; a try/catch around it catches nothing.
  it("throws when the SDK resolves with an error", async () => {
    const { emails } = stub({
      data: null,
      error: { name: "validation_error", message: "The `to` address is invalid" },
    });

    await expect(transportOver(emails).send(message)).rejects.toBeInstanceOf(AppError);
  });

  it("throws when the SDK resolves with neither data nor an error", async () => {
    const { emails } = stub({ data: null, error: null });

    await expect(transportOver(emails).send(message)).rejects.toBeInstanceOf(AppError);
  });

  it("carries the vendor's string on `message` and never on `userMessage`", async () => {
    const { emails } = stub({
      data: null,
      error: { name: "validation_error", message: "The `to` address is invalid" },
    });

    const error: AppError = await transportOver(emails)
      .send(message)
      .then(() => expect.unreachable("the transport must not resolve on an error"))
      .catch((caught: unknown) => caught as AppError);

    expect(error.message).toContain("The `to` address is invalid");
    expect(error.userMessage).not.toContain("The `to` address is invalid");
    expect(error.userMessage).toBe("No pudimos enviar el correo. Inténtalo de nuevo.");
  });

  it("puts ids and an enum reason in `context`, and no address", async () => {
    const { emails } = stub({
      data: null,
      error: { name: "validation_error", message: "nope" },
    });

    const error: AppError = await transportOver(emails)
      .send(message)
      .then(() => expect.unreachable("the transport must not resolve on an error"))
      .catch((caught: unknown) => caught as AppError);

    expect(error.context).toMatchObject({
      kind: "magic-link",
      recipientId: "acc_01HZY",
      resendError: "validation_error",
    });
    expect(JSON.stringify(error.context)).not.toContain("ana@example.com");
  });
});

describe("what reaches the SDK", () => {
  it("passes the idempotency key through as an option", async () => {
    const { emails, calls } = stub({ data: { id: "msg_1" }, error: null });

    await transportOver(emails).send(message);

    expect(calls[0]?.[1]).toEqual({ idempotencyKey: "magic-link/mlr_01J4K" });
  });

  // `react`, not `html`. The SDK renders the element and derives the plain-text
  // alternative from it, which is how NFR20's second body is guaranteed by the
  // send path rather than by every template remembering to produce one.
  it("hands the SDK the React element rather than a rendered string", async () => {
    const { emails, calls } = stub({ data: { id: "msg_1" }, error: null });

    await transportOver(emails).send(message);

    expect(calls[0]?.[0]).toMatchObject({
      from: "Recomencemos <hola@mail.recomencemos.online>",
      to: ["ana@example.com"],
      react: message.body,
    });
    expect(calls[0]?.[0]).not.toHaveProperty("html");
  });

  /**
   * **The amendment, asserted at the wire.** `mail.recomencemos.online` is
   * send-only in Resend: no MX record, no mailbox. A `Reply-To` header would
   * name an address that receives nothing — a dead end asserted rather than
   * merely present — so the payload carries none, and a reply bounces back to
   * her instead of vanishing.
   *
   * Asserted over the payload rather than over the transport's options, because
   * this is the half a recipient's mail client reads.
   */
  it("sends no reply-to header, because nothing receives one", async () => {
    const { emails, calls } = stub({ data: { id: "msg_1" }, error: null });

    await transportOver(emails).send(message);

    expect(calls[0]?.[0]).not.toHaveProperty("replyTo");
    expect(calls[0]?.[0]).not.toHaveProperty("reply_to");
  });

  it("names itself `resend` on the line", () => {
    const { emails } = stub({ data: { id: "msg_1" }, error: null });

    expect(transportOver(emails).name).toBe("resend");
  });
});
