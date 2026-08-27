/**
 * Seam 2's per-test-file database: the post-migration snapshot, restored.
 *
 * Restoring is milliseconds, so isolation costs nothing and every test file gets
 * its own engine. That is what lets `## Testing Decisions` say no test truncates
 * and no test orders itself relative to another.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "#schema";

/**
 * Where the post-migration snapshot lands between `globalSetup` and the workers
 * that restore from it.
 *
 * A file rather than a value passed through Vitest's `provide`, because the
 * snapshot is a binary blob and the consumers are in other processes; and inside
 * `node_modules/.cache` rather than `os.tmpdir()`, so two checkouts running at
 * once cannot collide on one path and `pnpm install` clears it for free.
 */
export const SNAPSHOT_PATH = fileURLToPath(
  new URL("../../node_modules/.cache/pglite/post-migration.tar", import.meta.url),
);

export interface TestDatabase {
  /** Drizzle over the restored engine, typed by the same schema the app uses. */
  readonly db: PgliteDatabase<typeof schema>;
  /** The engine itself, for the assertions Drizzle has no vocabulary for. */
  readonly client: PGlite;
  readonly close: () => Promise<void>;
}

/**
 * The extensions are passed again on restore: `loadDataDir` brings back the
 * catalogue rows that say `citext` is installed, but the functions behind them
 * live in WASM this instance has to be given.
 */
export async function restoreDatabase(): Promise<TestDatabase> {
  const snapshot = new File([await readFile(SNAPSHOT_PATH)], "post-migration.tar");
  const client = await PGlite.create({
    loadDataDir: snapshot,
    extensions: { citext, pg_trgm },
  });

  return { db: drizzle(client, { schema }), client, close: () => client.close() };
}
