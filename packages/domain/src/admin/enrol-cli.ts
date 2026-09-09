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
 * `pnpm admin:grant`, deleted with the password door it depended on, set
 * `is_admin` first and left the second factor to a later
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
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  ADMIN_SETUP_TOKEN_TTL_MINUTES,
  completeAdminEnrolment,
  mintAdminEnrolment,
} from "#admin/enrolment";
import { promptForCode } from "#admin/prompt";
import { authBaseUrl, authSecret, BASE_URL_VARIABLE } from "#auth/config";
import { directConfig } from "#config";
import * as schema from "#schema";

/**
 * Where the printed link points — resolved the same way the running app resolves
 * its own origin, so the two cannot disagree about where `/admin/enrol` is.
 *
 * **This command is not a child of the dev proxy**, unlike `next dev`, so nothing
 * sets `PORTLESS_URL` for it and {@link authBaseUrl} would fall back to the
 * configured variable — an origin the app is no longer served on, and one that
 * cannot be right for two worktrees at once because the proxied hostname carries
 * the branch. `scripts/dev-origin.mjs` is what closes that: the `admin:enrol`
 * script asks the proxy where this tree's server actually answers and passes it
 * in, so the link is right without anybody copying a hostname off a banner. An
 * explicitly set `PORTLESS_URL` still wins, and where there is no proxied route
 * — no server, or one started with the proxy bypassed — nothing is passed and
 * the configured variable is the right answer rather than the stale one.
 *
 * It goes through `authBaseUrl` rather than reading the variable directly so that
 * this stays one decision rather than two — the failure it prevents is a setup
 * link that resolves nowhere while every other absolute URL in the system is fine.
 */
function enrolmentUrl(token: string): string {
  let baseUrl: string;

  // Only the missing-origin case is rewritten. A malformed value must surface as
  // itself rather than as a message telling the reader to set a variable they set.
  try {
    baseUrl = authBaseUrl(process.env);
  } catch {
    throw new Error(
      `${BASE_URL_VARIABLE} is unset, so there is no origin to print a setup link against. ` +
        "Locally: `cp apps/web/.env.example apps/web/.env.local`. The dev proxy's origin is asked " +
        "for automatically and is not a substitute for it — there is none to find when no dev " +
        "server is running.",
    );
  }

  return new URL(`/admin/enrol/${token}`, baseUrl).toString();
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

    /**
     * **Up to three attempts against the same enrolment.** The domain leaves it
     * open on a wrong code precisely so the digits can be retried; reading once
     * and exiting would throw that open enrolment away and re-mint on the next
     * run — a fresh secret, a fresh QR to scan, ten fresh codes to keep — for a
     * fat-fingered digit.
     *
     * **There is no ceiling behind this loop, and it does not need one.** The
     * bound belongs to the door, where an attacker can reach it; here the limits
     * are the person at the keyboard and the token's own window. Three is enough
     * for a mistype and for a phone whose clock ticked over mid-typing.
     *
     * `undefined` from the prompt means the input ended — a pipe rather than a
     * person — and there is nothing left to ask, so the loop stops and the
     * refusal below is what gets printed.
     */
    let outcome: Awaited<ReturnType<typeof completeAdminEnrolment>> = {
      ok: false,
      reason: "wrong_code",
    };

    /**
     * **Opened here rather than beside the pool, which is where it was and where
     * it did not work.** `readline` starts consuming its input the moment it
     * exists, and the two database round trips between the pool and this point
     * are long enough for a piped stdin to be read and ended before the first
     * `question()` — so the prompt resolved to nothing. Creating it at the
     * moment it is first asked to read keeps `printf '…' | pnpm admin:enrol …`
     * working, and keeping it across the loop is what lets a person retry.
     */
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });

    for (let attempt = 1; attempt <= 3; attempt++) {
      if (attempt > 1) {
        process.stdout.write("\nThat code did not match. The link is still open.\n");
      }

      const prompt =
        attempt === 1
          ? "Code from the authenticator: "
          : `Code from the authenticator (attempt ${attempt} of 3): `;

      // Sequential by nature: each prompt waits for the person, and the next
      // attempt is against the same enrolment the last one left open.
      // oxlint-disable-next-line no-await-in-loop
      const code = await promptForCode(rl, prompt);
      if (code === undefined) break;

      // oxlint-disable-next-line no-await-in-loop
      outcome = await completeAdminEnrolment(db, { token, code, key });
      if (outcome.ok || outcome.reason !== "wrong_code") break;
    }

    // Nothing below this line reads, so the interface is done. Closing it here
    // rather than in the `finally` keeps its lifetime the length of the one
    // exchange it exists for.
    rl.close();

    if (!outcome.ok) {
      /**
       * **One message for both refusals**, which is not enumeration-safety
       * theatre — there is no adversary at this prompt — but the honest thing to
       * say: the person is at a terminal they own, and a spent window and a run
       * of wrong codes are both answered by running the command again. Nothing
       * has been granted either way, and saying so is the whole reassurance
       * needed.
       */
      process.stderr.write(
        "\nThat did not verify, so nothing was granted and no second factor was stored.\n" +
          "Run the command again for a fresh link.\n",
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
