/**
 * Runbook §6's first step, as a command rather than as SQL nobody can write.
 *
 * **The runbook said "granted by the documented manual `UPDATE` over the direct
 * connection", and #17 found that instruction incomplete.** An `UPDATE` sets
 * `is_admin`, and it presupposes a row with a password that something else
 * created — but DD5 closes credential sign-up (`emailAndPassword.disableSignUp`),
 * because the alternative is a second public enrolment path onto a product whose
 * only intended door is a magic link. So there is no `INSERT` a person could
 * write either: the `account.password` column holds a scrypt hash with Better
 * Auth's own parameters, and a hand-computed one is a lockout waiting for the
 * first sign-in attempt.
 *
 * This closes that gap without opening the one DD7 warns about — _"undocumented,
 * it becomes a self-grant endpoint the first time someone needs it at 2 a.m."_
 * It is not an endpoint. It is a command run **on the direct connection**, by
 * somebody who already holds the migration credential, from a machine with a
 * shell. The web surface has no path to it at all: `isAdmin` is declared
 * `input: false`, so no Better Auth request body can set the grant, and this file
 * is not in the `exports` map.
 *
 * **The password never reaches argv.** It is read from stdin, so it does not land
 * in shell history, in a process list, or in a CI log if somebody runs this in one.
 *
 * ```sh
 * pnpm admin:grant ana@example.co
 * ```
 *
 * Run by `node` directly under Node 24's native type stripping, and writing
 * through `process.stdout` rather than the logger — both for the reasons
 * `migrate/cli.ts` records: this repo has no `tsx`, and `@repo/observability`
 * reaches `@sentry/nextjs`, which is CommonJS and does not bind its named exports
 * under plain Node's ESM loader.
 *
 * The Admin then signs in at `/admin/sign-in`, which walks the enrolment step —
 * the QR and the ten backup codes — and runbook §6's remaining boxes are about
 * what to do with those.
 */

import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { eq } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { ADMIN_MIN_PASSWORD_LENGTH, authOptions } from "#auth/config";
import { directConfig } from "#config";
import * as schema from "#schema";

/**
 * Read a secret without echoing it.
 *
 * **Muted through the output stream, not through raw mode.** The first version of
 * this function turned raw mode *off* and trusted `rl.question` not to echo — and
 * it echoed, in full, on the first run. `readline` has no option that suppresses
 * it: with `terminal: true` it writes every keystroke to its `output`, and the
 * only supported lever is what that output does with them. So the interface is
 * given a `Writable` that drops writes while the flag is up, which is what every
 * prompt library does under its own hood; `_writeToOutput` is the private API this
 * avoids reaching for.
 *
 * Non-interactive input passes straight through, which is what makes
 * `printf '…' | pnpm admin:grant …` work for somebody who would rather not type a
 * sixteen-character password by hand.
 */
async function readSecret(prompt: string): Promise<string> {
  let muted = false;

  const output = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) process.stdout.write(chunk, encoding);
      callback();
    },
  });

  const rl = createInterface({ input: process.stdin, output, terminal: true });

  try {
    // The prompt itself is written before muting, so the person can see what is
    // being asked for; everything after it is theirs.
    process.stdout.write(prompt);
    muted = true;
    const answer = await rl.question("");
    return answer.trim();
  } finally {
    muted = false;
    // The newline the echoed return would have produced, so the next line of
    // output does not start beside the prompt.
    process.stdout.write("\n");
    rl.close();
  }
}

async function main(): Promise<void> {
  const email = process.argv[2]?.trim();

  if (!email) {
    process.stderr.write("usage: pnpm admin:grant <email>\n");
    process.exitCode = 2;
    return;
  }

  const password = await readSecret(`Password for ${email} (min ${ADMIN_MIN_PASSWORD_LENGTH}): `);

  if (password.length < ADMIN_MIN_PASSWORD_LENGTH) {
    process.stderr.write(
      `The password must be at least ${ADMIN_MIN_PASSWORD_LENGTH} characters. ` +
        "This is the one account that can read every phone number in the system.\n",
    );
    process.exitCode = 2;
    return;
  }

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
    const [existing] = await db
      .select({ id: schema.user.id, isAdmin: schema.user.isAdmin })
      .from(schema.user)
      .where(eq(schema.user.email, email))
      .limit(1);

    if (existing) {
      /**
       * **An existing Account is granted, never re-passworded.** DD5 wants a
       * *second* Admin grant on a separate device as the recovery path (C43), so
       * running this twice for two addresses is expected — but silently
       * overwriting somebody's password because their address was typed twice is
       * not a thing an administrative command should do without being asked.
       */
      await db.update(schema.user).set({ isAdmin: true }).where(eq(schema.user.id, existing.id));
      process.stdout.write(
        `\n${email} already had an Account; the Admin grant is now set. Its password is unchanged.\n` +
          "Sign in at /admin/sign-in to enrol a second factor.\n",
      );
      return;
    }

    /**
     * **A sign-up-enabled instance over the same database**, which is how the row
     * is created without this file owning a copy of Better Auth's credential
     * shape — the provider id, the local issuer, and whichever password hash the
     * installed version uses. All three are the library's to change, and a
     * hand-written `INSERT` guessing them produces an Account that cannot sign in.
     *
     * `autoSignIn: false` is required rather than tidy: signing in would mint a
     * session from `/sign-up/email`, a path `SIGN_IN_PATHS` does not name, and
     * `signInMethodForPath` throws there — correctly, because a door that has not
     * declared itself must not mint a session. This command wants a row, not a
     * session.
     */
    const base = authOptions({
      db,
      sendMagicLink: async () => {},
      logger: { info: () => {}, warn: () => {} },
    });

    const enrolment = betterAuth({
      ...base,
      emailAndPassword: {
        ...base.emailAndPassword,
        enabled: true,
        disableSignUp: false,
        requireEmailVerification: false,
        autoSignIn: false,
      },
    });

    await enrolment.api.signUpEmail({
      body: { email, password, name: "" },
      headers: new Headers({ origin: new URL(base.baseURL as string).origin }),
    });

    /**
     * The grant and the verified address, together — the `UPDATE` runbook §6 always
     * described. `emailVerified` is set here because `requireEmailVerification` is
     * on for the credential door and there is no mailbox in this loop: the person
     * running this command over the direct connection has already proven more than
     * an emailed link could.
     */
    const [granted] = await db
      .update(schema.user)
      .set({ isAdmin: true, emailVerified: true })
      .where(eq(schema.user.email, email))
      .returning({ id: schema.user.id });

    if (!granted) throw new Error(`the Account for ${email} was not created`);

    process.stdout.write(
      `\nAdmin granted: ${granted.id}\n` +
        "Sign in at /admin/sign-in. The first sign-in shows the QR and ten backup codes, once —\n" +
        "print them and store them offline before leaving that screen (runbook §6).\n",
    );
  } finally {
    await pool.end();
  }
}

await main();
