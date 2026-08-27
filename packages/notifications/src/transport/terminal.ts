/**
 * The development inbox: stdout.
 *
 * **This is the seam's first real dividend, and it is worth naming as one.**
 * Reading a magic link out of the terminal instead of a mailbox is not a
 * development mode bolted onto the email path — it is a second implementation of
 * {@link NotificationTransport}, chosen by configuration. No call site knows it
 * exists, no template changes, and the `notification.sent` line is emitted by
 * the same code with `transport: "terminal"` on it. That is what intent Q1 asked
 * the seam to buy.
 *
 * What it buys concretely: a developer working #12's sign-in flow needs no
 * `RESEND_API_KEY`, no verified domain, and no real inbox — and every one of
 * those loops would otherwise be a send against a domain whose reputation NFR27
 * measures.
 *
 * **It writes to `process.stdout` rather than through the logger, and that is
 * the distinction rather than an exemption.** CLAUDE.md's rule is that every
 * *diagnostic* goes through the logger, and this is not a diagnostic: it is the
 * delivery itself, the terminal standing in for a mailbox. The diagnostic still
 * happens — the seam emits its one `info` line either way. A multi-line block
 * meant to be read and copied by a human would also be mangled by a line-per-
 * event JSON logger, which is the practical half of the same point.
 */

import { render } from "@react-email/components";
import { AppError } from "@repo/errors/app-error";
import type { NotificationTransport, OutboundMessage, TransportReceipt } from "#send";
import { assertServerOnly } from "#server-only";
import { SEND_FAILED } from "#user-messages";

assertServerOnly("transport/terminal");

/** Every `http(s)` URL in the body, so the link is the first thing on screen. */
const URL_PATTERN = /https?:\/\/\S+/g;

const RULE = "─".repeat(78);

export interface TerminalTransportOptions {
  /**
   * Where the block goes. Injected so a test captures it instead of writing to
   * the runner's own stdout, and defaulted so a caller never has to think about
   * it.
   */
  readonly write?: (chunk: string) => void;
  /**
   * Guards the one failure this transport can cause, which is silence.
   *
   * Selecting `terminal` anywhere real means no mail is sent and **nobody finds
   * out** — no bounce, no error, no missing-credential throw, just people who
   * never receive their magic link. Every other failure in this package is
   * loud; this is the one that would not be, so it is refused at construction
   * rather than discovered from a support ticket.
   *
   * **Required, and `undefined` is an answer rather than a request for the
   * default.** Defaulting it to `process.env.NODE_ENV` was the first shape and
   * it had a hole: {@link createTransport} passes `env.NODE_ENV` off the record
   * it was given, so an environment record that simply lacks the key would
   * silently fall back to the real process — and the case this guard exists for
   * is precisely the one where those two disagree. With no default, an absent
   * value reaches the check as absent and is refused.
   */
  readonly nodeEnv: string | undefined;
}

/**
 * The only two environments this transport may exist in.
 *
 * **An allowlist, not `!== "production"`.** Refusing production alone leaves
 * every other value — `staging`, `preview`, a typo, and `undefined`, which is
 * what a plain `node` process has — reading as permission to swallow mail. A
 * staging deploy that quietly delivers nothing is the same incident as a
 * production one, found later. `next dev` sets `development` and Vitest sets
 * `test`, so the two values that are genuinely a developer's machine are named
 * and everything else is refused.
 */
const TERMINAL_ENVIRONMENTS: ReadonlySet<string> = new Set(["development", "test"]);

export function createTerminalTransport({
  write = (chunk) => void process.stdout.write(chunk),
  nodeEnv,
}: TerminalTransportOptions): NotificationTransport {
  if (!TERMINAL_ENVIRONMENTS.has(nodeEnv ?? "")) {
    throw new AppError({
      code: "terminal_transport_outside_development",
      status: 500,
      message:
        `The terminal transport was selected with NODE_ENV=${nodeEnv ?? "unset"}. It writes ` +
        "notifications to stdout instead of delivering them, so anywhere but a developer's " +
        "machine this sends nothing at all — no bounce and no error, only people who never " +
        "receive their magic link. It is available in development and test only. " +
        "Set NOTIFICATIONS_TRANSPORT=resend.",
      userMessage: SEND_FAILED,
      context: { transport: "terminal", nodeEnv: nodeEnv ?? null },
    });
  }

  return {
    name: "terminal",

    async send(message: OutboundMessage): Promise<TransportReceipt> {
      /**
       * The plain-text alternative rather than the HTML, and it is the same
       * `render(..., { plainText: true })` NFR20 requires every template to
       * ship. So this transport reads what a screen-reader user reads — which
       * makes the development loop a standing check on the alternative body,
       * for free and without a test anyone has to remember to run.
       */
      const body = await render(message.body, { plainText: true });
      const links = [...new Set(body.match(URL_PATTERN) ?? [])];

      write(
        [
          "",
          RULE,
          `  ${message.kind}  →  ${message.to}`,
          `  ${message.subject}`,
          "",
          // The links first and alone, because copying one is the whole reason
          // this transport exists. Hunting a URL out of a wrapped paragraph is
          // the friction it is here to remove.
          ...(links.length > 0 ? [...links.map((link) => `  ${link}`), ""] : []),
          // Indented only where there is something to indent: a blank line that
          // carries two spaces is invisible noise that a copy picks up.
          ...body
            .trim()
            .split("\n")
            .map((line) => (line.trim() === "" ? "" : `  ${line}`)),
          RULE,
          "",
        ].join("\n"),
      );

      /**
       * The idempotency key, reused as the receipt id.
       *
       * A synthetic id has to be *something*, and this is the one value already
       * guaranteed unique per notification — so the `message_id` on the
       * development log line names the send a developer is looking at rather
       * than a counter that means nothing.
       */
      return { id: `terminal:${message.idempotencyKey}` };
    },
  };
}
