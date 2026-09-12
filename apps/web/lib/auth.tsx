/**
 * Where the two halves of sign-in are joined, and the only place in this app
 * that knows both exist.
 *
 * `@repo/domain` owns Better Auth and its tables (DD5) but may not import
 * `@repo/notifications` — the spec's module graph gives that package to
 * `apps/web` and to nothing else. So the sender is **injected here**, which is
 * the one composition this file performs. It is also why `requestMagicLink`
 * never learns that a second transport exists: `createNotifierFromEnv` answers
 * "which channel" from configuration, so the terminal inbox a developer reads
 * and the Resend delivery a Worker gets are the same call site (intent Q1).
 */

import "server-only";

import {
  type AuthHandler,
  createAuthHandler,
  googleSignInAvailable,
} from "@repo/domain/auth-handler";
import { createNotifierFromEnv } from "@repo/notifications/send";
import { MAGIC_LINK_SUBJECT, MagicLinkEmail } from "@repo/notifications/templates/magic-link";
import { logger } from "@repo/observability/logger";

/**
 * The app's one auth handler.
 *
 * `createAuthHandler` memoises, so calling this from a Route Handler and from a
 * Server Action in the same process yields one Better Auth instance and one
 * pooled connection.
 */
export function auth(): AuthHandler {
  return createAuthHandler({
    logger,

    async sendMagicLink({ email, url, expiresInMinutes, signInAttemptId }) {
      const notifier = createNotifierFromEnv(logger);

      await notifier.send({
        kind: "magic-link",
        to: email,
        /**
         * **The attempt id, not an Account id, and not the address.**
         *
         * `recipientId` is the identifier the seam puts on its
         * `notification.sent` line, and at this moment there may be no Account
         * at all — a magic link creates one on verify, so a first-time Worker
         * has no id to name. The attempt id identifies this recipient *in this
         * attempt* without naming them, which is what NFR18 asks of a line and
         * what NFR27 needs in order to correlate the request with the sign-in
         * that follows it.
         */
        recipientId: signInAttemptId,
        /**
         * The idempotency key is `magic-link/<entityId>/<recipientId>` — the
         * attempt id twice, which is harmless — and it must be unique per request
         * rather than per address: two links to one address inside
         * Resend's 24-hour key window are two deliveries she asked for, and a
         * shared key would silently return the first response and send nothing
         * the second time — which is the resend the consumed-link state offers.
         *
         * Not the token, which is a credential and would travel to Resend as a
         * key.
         */
        entityId: signInAttemptId,
        subject: MAGIC_LINK_SUBJECT,
        body: <MagicLinkEmail url={url} expiresInMinutes={expiresInMinutes} />,
      });
    },
  });
}

export { googleSignInAvailable };
