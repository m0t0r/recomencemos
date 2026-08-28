/**
 * Seam 2's `test`, separated from the module that builds the snapshot.
 *
 * **The split is not cosmetic and must not be undone.** `test.extend` registers
 * against the current suite, and `globalSetup` runs in a different context with
 * no suite at all — so a `test.extend` at the top level of `#testing/database`,
 * which `global-setup.ts` imports for `SNAPSHOT_PATH`, aborts the whole run with
 * _"Vitest failed to find the current suite"_. Keeping the fixture in its own
 * module is what lets one module be imported by both the setup and the tests.
 */

import { test as base } from "vitest";
import { restoreDatabase, type TestDatabase } from "#testing/database";

export type { TestDatabase };

/**
 * Seam 2's `test`, with the database as a **fixture** rather than as a pair of
 * hooks each test file writes for itself.
 *
 * Three files used to open with the identical six lines — a `let database`, a
 * `beforeEach` that restored, an `afterEach` that closed — which is the shape
 * Vitest's `test.extend` exists to remove. What it buys beyond the six lines:
 *
 * - **The lifecycle cannot be got wrong.** A file that forgot the `afterEach`
 *   leaked a PGlite instance per test and nothing failed; the fixture's cleanup
 *   phase runs whether the test passed, failed, or threw.
 * - **A test that does not ask for a database does not pay for one.** Fixtures
 *   are lazy: the restore only runs for a test whose callback destructures
 *   `database`. The hook form ran for every test in the file.
 * - **The type is carried by the test signature**, so `database` arrives typed
 *   without a `let` that TypeScript can only see as possibly-undefined.
 *
 * Import this `test` in a `*.integration.test.ts` instead of the global one. The
 * globals stay available for `describe`, `it` and `expect` exactly as
 * `CLAUDE.md` requires — this replaces neither.
 */
export const test = base.extend<{ database: TestDatabase }>({
  // The empty pattern is Vitest's own fixture signature: the first argument is
  // the test context, and destructuring nothing from it is how a fixture that
  // depends on no other fixture is written. Scoped rather than silenced repo-wide.
  // oxlint-disable-next-line no-empty-pattern
  async database({}, use) {
    const database = await restoreDatabase();
    await use(database);
    await database.close();
  },
});
