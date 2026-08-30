/**
 * Runbook §6, as one command that grants **last**.
 *
 * ```sh
 * pnpm admin:enrol ana@example.co
 * ```
 *
 * It prints a single-use setup link and waits. Opening the link shows the TOTP
 * QR and the ten backup codes, once; the six digits from the authenticator are
 * typed **back into this prompt**, which verifies them over the direct connection
 * and only then sets the grant.
 *
 * **What it replaces, and why the replacement is a different shape.**
 * `pnpm admin:grant` set `is_admin` first and left the second factor to a later
 * sign-in — so between those two acts there was a granted Account with one
 * factor, and that window was the whole of the first sign-in. Inverting the order
 * closes it: an Account cannot hold Admin authority until a working authenticator
 * has proved itself, and a link opened and abandoned leaves no Admin behind.
 *
 * **It is not an endpoint and cannot become one**, which is DD7's rule —
 * _"undocumented, it becomes a self-grant endpoint the first time someone needs
 * it at 2 a.m."_ Three things hold that: `isAdmin` is declared `input: false`, so
 * no request body sets the grant on any route; this module is absent from the
 * package's `exports` map, so `apps/web` cannot resolve it; and it runs on the
 * **direct** connection, by somebody who already holds the migration credential.
 *
 * **Nothing here is emailed.** The link is printed to the terminal of the person
 * who ran the command, which is why the token's window is measured against their
 * attention rather than against a mailbox.
 *
 * Run by `node` directly under Node 24's native type stripping, and writing
 * through `process.stdout` rather than the logger — both for the reasons
 * `migrate/cli.ts` records: this repo has no `tsx`, and `@repo/observability`
 * reaches `@sentry/nextjs`, which is CommonJS and does not bind its named exports
 * under plain Node's ESM loader. It is also the right channel here for a second
 * reason: **every value this command prints is a credential**, and a credential
 * belongs on the operator's screen and in no drain.
 */

import { createInterface } from "node:readline/promises";
import {
  ADMIN_SETUP_TOKEN_TTL_MINUTES,
  completeAdminEnrolment,
  mintAdminEnrolment,
} from "#admin/enrolment";
import { authSecret, BASE_URL_VARIABLE } from "#auth/config";
import { directConfig } from "#config";
import * as schema from "#schema";

/** Where the printed link points. The same variable every other absolute URL uses. */
function enrolmentUrl(token: string): string {
  const baseUrl = process.env[BASE_URL_VARIABLE]?.trim();

  if (!baseUrl) {
    throw new Error(
      `${BASE_URL_VARIABLE} is unset, so there is no origin to print a setup link against. ` +
        "Locally: `cp apps/web/.env.example apps/web/.env.local`.",
    );
  }

  return new URL(`/admin/enrol/${token}`, baseUrl).toString();
}

/**
 * Read the six digits.
 *
 * **Echoed, unlike `admin:grant`'s password prompt, and the difference is the
 * point.** A TOTP code is good for thirty seconds and is worthless the moment it
 * is used, so hiding it buys nothing and costs the person the ability to see
 * that they typed it correctly — which on a six-digit code is the whole
 * interaction.
 */
async function readCode(prompt: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });

  try {
    return (await rl.question(prompt)).trim();
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const email = process.argv[2]?.trim();

  if (!email) {
    process.stderr.write("usage: pnpm admin:enrol <email>\n");
    process.exitCode = 2;
    return;
  }

  const key = authSecret(process.env);

  /**
   * **The direct connection, not the pooled one**, which is the runbook's own
   * wording and the right credential: this is an out-of-band administrative act,
   * not a request path, and it should not be reaching for the pool a Worker's
   * sign-in shares.
   */
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { Pool } = await import("pg");
  const pool = new Pool(directConfig());
  const db = drizzle(pool, { schema });

  try {
    const { token } = await mintAdminEnrolment(db, { email, key });

    process.stdout.write(
      `\nOpen this link to set up the authenticator. It works for ` +
        `${ADMIN_SETUP_TOKEN_TTL_MINUTES} minutes and shows the ten backup codes once:\n\n` +
        `  ${enrolmentUrl(token)}\n\n` +
        "Scan the QR, keep the codes somewhere the mailbox's password does not open,\n" +
        "then type the six digits here.\n\n",
    );

    const code = await readCode("Code from the authenticator: ");
    const outcome = await completeAdminEnrolment(db, { token, code, key });

    if (!outcome.ok) {
      /**
       * **One message for both refusals**, which is not enumeration-safety
       * theatre — there is no adversary at this prompt — but the honest thing to
       * say: the person is at a terminal they own, and both a mistyped code and
       * an expired window are answered by running the command again. Nothing has
       * been granted either way, and saying so is the whole reassurance needed.
       */
      process.stderr.write(
        "\nThat did not verify, so nothing was granted and no second factor was stored.\n" +
          "Run the command again — the link expires, and a mistyped code is worth another go.\n",
      );
      process.exitCode = 1;
      return;
    }

    // The second Admin is the recovery path that takes minutes rather than
    // hours (C43), and the mailbox condition is runbook §6's — both cited here,
    // in a comment, and neither in the sentence itself.
    process.stdout.write(
      `\nAdmin granted: ${outcome.accountId}\n` +
        "The authenticator is enrolled and the setup link is closed.\n" +
        "Run this command again for a second Admin on a separate device. Keep that address\n" +
        "out of this one's mailbox: one mailbox holding both is one failure, not two.\n",
    );
  } finally {
    await pool.end();
  }
}

await main();
