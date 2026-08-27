/**
 * The pooled connection: what every request path uses, and **withheld from the
 * `exports` map**. `apps/web` cannot resolve this module
 * ([ADR-0010](../../../docs/adr/0010-the-domain-package-is-the-only-door-to-the-database.md));
 * it reaches the database through a domain subpath or not at all.
 *
 * Pooled and not direct: PlanetScale's pooler runs in transaction-pooling mode
 * (DD2), which is also what `docker-compose.yaml` runs PgBouncer in locally, so
 * the constraints are the same on both. Session state does not survive between
 * transactions here — no `LISTEN`/`NOTIFY`, no session advisory locks, no temp
 * tables, no cross-transaction prepared statements. Migrations therefore go
 * through `#migrate` and its direct connection instead.
 */

/**
 * **The build-time half of this package's server-only guarantee.** `server-only`
 * is a marker package that resolves to an empty module under the `react-server`
 * export condition and to a bare `throw` under every other, so a client module
 * that pulls this in fails at **build** rather than in somebody's browser.
 *
 * It is on this module and `health.ts` and deliberately **not** on the migrate
 * path: with no `react-server` condition set it throws, and plain `node` sets
 * none — which is exactly what `src/migrate/cli.ts` runs as in a Fly
 * `release_command`, and what every Node-environment Vitest file is. Verified
 * both ways rather than assumed. `#server-only` below is the runtime backstop
 * that covers what this cannot.
 */
import "server-only";
import { logger } from "@repo/observability/logger";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { poolConfig } from "#config";
import * as schema from "#schema";
import { assertServerOnly } from "#server-only";

assertServerOnly("connection");

let pool: Pool | undefined;
let database: NodePgDatabase<typeof schema> | undefined;

/**
 * **Opened on first use, not at import.** `next build` imports every server
 * module it traces, and a pool constructed at module scope would make a build
 * with no `DATABASE_URL` fail on a connection nothing was going to open. It also
 * means `poolConfig`'s `AppError` surfaces to the first caller, which is a
 * request that can answer with it, rather than to the module loader.
 */
export function db(): NodePgDatabase<typeof schema> {
  if (database) return database;

  const created = new Pool(poolConfig());

  /**
   * **Not optional.** `pg` emits `error` on a pooled client that fails while
   * idle — the far end restarted, the pooler dropped it, the network went away —
   * and an `error` event with no listener is an uncaught exception that takes
   * the process down. On one Fly machine that is the whole site, brought down by
   * the routine event this pool exists to survive.
   *
   * The pool retires the client itself; this only makes the loss legible. The
   * error is passed as `err` so the line's serialiser handles it and the shared
   * redaction list applies — a connection error's message can carry the host.
   */
  created.on("error", (error) => {
    logger.warn({ event: "database_pool_client_error", err: error }, "Idle pooled client failed");
  });

  pool = created;
  database = drizzle(created, { schema });
  return database;
}

/**
 * Closes the pool and forgets it, so a later `db()` opens a fresh one.
 *
 * Here for a caller with a lifecycle — a test, a script, a shutdown handler. A
 * request path never calls it: closing a pool per request is what the pool
 * exists to avoid.
 */
export async function closeDatabase(): Promise<void> {
  const open = pool;
  pool = undefined;
  database = undefined;
  await open?.end();
}
