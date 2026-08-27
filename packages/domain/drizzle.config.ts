import { defineConfig } from "drizzle-kit";

/**
 * Generation only. `drizzle-kit generate` diffs the schema against the committed
 * snapshots in `./drizzle/meta` and writes SQL; it never opens a connection, so
 * no `dbCredentials` block belongs here and none is set.
 *
 * **Applying is `src/migrate.ts`, on the direct connection**, and deliberately
 * not `drizzle-kit migrate`: the same committed files have to run against
 * PlanetScale in a Fly `release_command` (DD10) and against PGlite in seam 2, and
 * a CLI that reads a config file is not something either of those can call.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
});
