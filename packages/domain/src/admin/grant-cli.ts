/**
 * Runbook §6's first step, and it no longer works on purpose.
 *
 * **What it did.** It set a password and the Admin grant over the direct
 * connection, and left the second factor to a later sign-in at the credential
 * door, which walked the enrolment step. That ordering was the gap `pnpm
 * admin:enrol` closed: between the grant and the enrolment there was an Account
 * holding Admin authority with no second factor in front of it.
 *
 * **Why it is a refusal rather than a deletion.** The passwordless door refuses
 * every door that is not itself for an Account holding the grant, so the
 * credential sign-in this command depended on now answers 403, and the
 * passwordless one asks for a code against a second factor this command never
 * enrols. Its successful path therefore produces an Account that cannot sign in
 * by any route and cannot recover itself — the lockout the design spends ten
 * printed backup codes on avoiding, arrived at by running a documented command.
 *
 * A command that bricks an account is worse than a missing one, and "the next
 * ticket deletes it" is not a state to leave it in meanwhile. The file, the
 * `admin:grant` script and the `emailAndPassword` configuration behind it go
 * together in the ticket that drops the columns and Better Auth's `twoFactor`
 * table — a destructive migration this pull request has no business carrying.
 *
 * Run by `node` directly under Node 24's native type stripping, and writing
 * through `process.stderr` rather than the logger, for the reasons
 * `migrate/cli.ts` records: this repo has no `tsx`, and `@repo/observability`
 * reaches `@sentry/nextjs`, which is CommonJS and does not bind its named exports
 * under plain Node's ESM loader.
 */

process.stderr.write(
  "This command no longer produces an Admin who can sign in. It grants authority and leaves " +
    "the second factor to a door that has been removed, so the account it makes is locked out " +
    "of every way in.\n\n" +
    "Use `pnpm admin:enrol <email>` instead. It prints a single-use setup link; opening the " +
    "link shows the code and the ten backup codes once; and it grants authority only after a " +
    "working authenticator has proved itself.\n",
);

process.exitCode = 2;
