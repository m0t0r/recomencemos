/**
 * What a deploy calls. `pnpm db:migrate` locally, and Fly's `release_command` in
 * production (#9).
 *
 * Run by `node` directly, under Node 24's native type stripping — this repo has
 * no `tsx`, and TypeScript 7 ships only a `tsc` binary, so a build step for one
 * file would be a build step nothing else in the repo has. That is also why the
 * imports here are `#`-prefixed: Node does not substitute `.ts` for a relative
 * `.js` specifier, and the `imports` field is the one internal-specifier form
 * that Node, Vite and `tsc` all resolve identically.
 *
 * **Output goes through `process.stdout`, not the logger, and that is verified
 * rather than preferred.** `@repo/observability/logger` reaches `@sentry/nextjs`
 * through its trace-context reader, and `@sentry/nextjs` is CommonJS: under
 * plain Node's ESM loader its named exports do not bind, and importing the
 * logger here fails at module load with `SyntaxError: Named export
 * 'getActiveSpan' not found`. Next's bundler papers over that; a release command
 * has no bundler. This is the same position `scripts/migration-integrity.mjs`
 * already takes for the same reason — this runs before, and outside, the
 * application, so there is no logger on this path.
 *
 * **Exit code, not `process.exit()`.** A hard exit can truncate output that has
 * not reached the file descriptor, and a failing migration's reason is only ever
 * read in a release command's log.
 */

import { migrate } from "#migrate";

const say = (line: string) => process.stdout.write(`${line}\n`);

try {
  await migrate();
  say("migrations applied");
} catch (error) {
  // The whole error, not a summary of it: a migration failure names the
  // statement and the constraint, and that is the sentence that tells an
  // operator what to fix while a deploy is held open waiting for them.
  say(
    `migrations failed: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
  );
  say("the deploy must not proceed");
  process.exitCode = 1;
}
