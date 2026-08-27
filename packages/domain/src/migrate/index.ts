/**
 * Applying the committed migrations, on the **direct** connection.
 *
 * Three callers, one set of files, and that is the whole argument for this
 * module existing rather than a `drizzle-kit migrate` invocation:
 *
 * - Fly's `release_command` at deploy (DD10) — in a release command a failed
 *   migration aborts the deploy with the old machine still serving, where at
 *   server boot it would take the site down.
 * - `pnpm db:migrate` against the local Compose stack.
 * - Seam 2's snapshot builder, which replays these same files into PGlite. That
 *   the files are identical is what makes seam 2 _"a real seam rather than a mock
 *   in a database costume"_, and what the migration-integrity gate protects.
 *
 * **Direct and not pooled** (DD2): DDL in a long transaction cannot cross a
 * transaction pooler.
 */

import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate as apply } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { type DatabaseEnv, directConfig } from "#config";
import { assertServerOnly } from "#server-only";

assertServerOnly("migrate");

/**
 * The committed folder, resolved from this module rather than from the process's
 * working directory — a `release_command` and a Vitest worker do not share one,
 * and a migrator that silently found no migrations would report success.
 */
export const MIGRATIONS_FOLDER = fileURLToPath(new URL("../../drizzle", import.meta.url));

/**
 * Applies every migration the journal names and has not yet recorded as applied.
 *
 * Opens and closes its own connection: the migrator is not a request path, and
 * leaving a pool open would hold a connection for the life of a process whose
 * only job was to finish.
 */
export async function migrate(env?: DatabaseEnv): Promise<void> {
  const pool = new Pool(directConfig(env));
  try {
    await apply(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await pool.end();
  }
}
