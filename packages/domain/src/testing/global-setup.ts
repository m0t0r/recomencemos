/**
 * Seam 2's snapshot, built **once per run**.
 *
 * `## Testing Decisions` sets out the shape and the reason: replaying every
 * migration per test file would make isolation expensive enough that someone
 * eventually shares a database between tests, which is the thing that makes an
 * integration suite untrustworthy. So the migrations run once here, the
 * post-migration data directory is dumped, and each test file restores it in
 * milliseconds. No test truncates, and no test sees another's rows.
 *
 * **The migrations are the committed ones** — `MIGRATIONS_FOLDER`, the same
 * files Fly's `release_command` applies to PlanetScale. That identity is the
 * whole argument for this being a real seam, and it is what
 * `scripts/migration-integrity.mjs` exists to protect: an edited migration would
 * silently move this snapshot away from the schema production has, and go green
 * doing it.
 *
 * **The extensions are enabled out of band, exactly as they are on the other two
 * engines.** `docker/postgres/initdb` does it for the Compose stack and go-live
 * runbook §2 does it by hand on PlanetScale, because a `CREATE EXTENSION` in a
 * migration could not run against a managed provider that gates them behind a
 * dashboard toggle. Doing it here too keeps the three in agreement.
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { MIGRATIONS_FOLDER } from "#migrate";
import { SNAPSHOT_PATH } from "#testing/database";

export default async function setup(): Promise<void> {
  const client = await PGlite.create({ extensions: { citext, pg_trgm } });

  try {
    await client.exec(
      "CREATE EXTENSION IF NOT EXISTS citext; CREATE EXTENSION IF NOT EXISTS pg_trgm;",
    );
    await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER });

    // `"none"`: the blob is read back on the same machine seconds later, so
    // compressing it trades restore time — paid once per test file — for disk
    // nobody is short of.
    const dump = await client.dumpDataDir("none");
    await mkdir(dirname(SNAPSHOT_PATH), { recursive: true });
    await writeFile(SNAPSHOT_PATH, Buffer.from(await dump.arrayBuffer()));
  } finally {
    await client.close();
  }
}

export async function teardown(): Promise<void> {
  await rm(SNAPSHOT_PATH, { force: true });
}
