/**
 * The development inbox, and the guard that keeps it one.
 *
 * Two things are worth testing here and they pull in opposite directions: that
 * the block a developer reads is actually useful, and that this transport
 * cannot exist anywhere a real person is waiting for mail.
 */

import { AppError } from "@repo/errors/app-error";
import * as React from "react";
import type { OutboundMessage } from "#send";
import { MagicLinkEmail } from "#templates/magic-link";
import { createTerminalTransport } from "#transport/terminal";

const LINK = "https://localhost:3000/api/auth/magic-link/verify?token=abc123";

const message: OutboundMessage = {
  kind: "magic-link",
  to: "ana@example.com",
  recipientId: "acc_01HZY",
  entityId: "mlr_01J4K",
  subject: "Tu enlace para entrar a Recomencemos",
  body: React.createElement(MagicLinkEmail, {
    url: LINK,
    expiresInMinutes: 15,
  }),
  idempotencyKey: "magic-link/mlr_01J4K",
};

function capturing(nodeEnv = "development") {
  const chunks: string[] = [];
  const transport = createTerminalTransport({
    write: (chunk) => void chunks.push(chunk),
    nodeEnv,
  });
  return { transport, output: () => chunks.join("") };
}

describe("what a developer reads", () => {
  it("prints the link on a line of its own, which is the whole point", async () => {
    const { transport, output } = capturing();

    await transport.send(message);

    expect(output()).toContain(LINK);
    // On its own line and unwrapped, so selecting it is a double-click rather
    // than a hunt through a wrapped paragraph.
    expect(output().split("\n")).toContain(`  ${LINK}`);
  });

  it("names the kind, the recipient and the subject", async () => {
    const { transport, output } = capturing();

    await transport.send(message);

    expect(output()).toContain("magic-link");
    expect(output()).toContain("ana@example.com");
    expect(output()).toContain("Tu enlace para entrar a Recomencemos");
  });

  /**
   * The plain-text alternative rather than the HTML — the same body NFR20
   * requires every template to ship. So the development loop is a standing
   * check on the alternative body that nobody has to remember to run.
   */
  it("prints the plain-text body, not the HTML", async () => {
    const { transport, output } = capturing();

    await transport.send(message);

    expect(output()).toContain("Pediste un enlace para entrar a Recomencemos.");
    expect(output()).not.toContain("<html");
    expect(output()).not.toContain("<table");
  });

  it("prints each distinct link once, though the template carries it twice", async () => {
    const { transport, output } = capturing();

    await transport.send(message);

    // The magic-link template puts the URL in a Button and again as readable
    // text. Two identical lines to copy from is a choice a reader should not
    // have to make.
    const onItsOwnLine = output()
      .split("\n")
      .filter((line) => line.trim() === LINK);
    expect(onItsOwnLine).toHaveLength(1);
  });

  it("leaves no trailing whitespace, which a copy would otherwise pick up", async () => {
    const { transport, output } = capturing();

    await transport.send(message);

    for (const line of output().split("\n")) {
      expect(line, `"${line}" has trailing whitespace`).toBe(line.trimEnd());
    }
  });

  it("returns a receipt naming the notification rather than a meaningless counter", async () => {
    const { transport } = capturing();

    await expect(transport.send(message)).resolves.toEqual({
      id: "terminal:magic-link/mlr_01J4K",
    });
  });

  it("names itself on the log line, so a line says which channel ran", () => {
    expect(capturing().transport.name).toBe("terminal");
  });
});

describe("where it may exist", () => {
  it.each(["development", "test"])("is available under NODE_ENV=%s", (nodeEnv) => {
    expect(() => createTerminalTransport({ write: () => {}, nodeEnv })).not.toThrow();
  });

  /**
   * An allowlist rather than a `production` blocklist, and this table is why:
   * every one of these would otherwise read as permission to swallow mail. A
   * staging deploy delivering nothing is the same incident as a production one,
   * found later — and `undefined` is what a plain `node` process has.
   */
  it.each(["production", "staging", "preview", "prod", "developement", ""])(
    "refuses NODE_ENV=%s",
    (nodeEnv) => {
      expect(() => createTerminalTransport({ write: () => {}, nodeEnv })).toThrow(AppError);
    },
  );

  it("refuses an unset NODE_ENV", () => {
    expect(() => createTerminalTransport({ write: () => {}, nodeEnv: undefined })).toThrow(
      AppError,
    );
  });

  // It refuses at *construction*, so the failure is a process that will not
  // start rather than a request that quietly delivered nothing.
  it("refuses before anything is sent, and says what to set instead", () => {
    const error = (() => {
      try {
        createTerminalTransport({ write: () => {}, nodeEnv: "production" });
      } catch (caught) {
        return caught as AppError;
      }
      return undefined;
    })();

    expect(error?.code).toBe("terminal_transport_outside_development");
    expect(error?.message).toContain("NOTIFICATIONS_TRANSPORT=resend");
    expect(error?.context).toMatchObject({ transport: "terminal", nodeEnv: "production" });
  });
});
