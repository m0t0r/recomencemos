/**
 * The two connection strings, resolved and nothing more.
 *
 * **Why this is a module and not four lines inside `connection.ts`:** DD2 fixes
 * PlanetScale's pooler in transaction-pooling mode, so DDL, long transactions and
 * session state belong on the **direct** connection while the app uses the
 * pooler. Two URLs that must never be confused is exactly the kind of thing that
 * is checked once and then trusted forever — so the resolution is pure, sits at
 * seam 1, and has a test asserting each reads its own variable and neither falls
 * back to the other.
 *
 * Nothing here connects. That is the point: a pure function over an environment
 * record is testable without a database, and the failure it reports — a variable
 * nobody set — is the failure that actually happens.
 */

import { AppError } from "@repo/errors/app-error";

/** What the application uses. PgBouncer locally, PlanetScale's pooler in production. */
export const POOLED_URL_VARIABLE = "DATABASE_URL";

/** Migrations only. DDL in a long transaction cannot cross a transaction pooler. */
export const DIRECT_URL_VARIABLE = "DIRECT_DATABASE_URL";

/**
 * Ten per machine (DD2, C35), which is one pool on one Fly machine and sits well
 * inside any PlanetScale plan ceiling. The plan's *actual* limit is the one
 * number effort 0002 could not verify at Design, and it is go-live runbook §2.
 */
export const POOL_MAX = 10;

/**
 * Nothing held open. Every cold start reopens the pool anyway (DD10), so an idle
 * floor buys a warm connection for a process that is about to be replaced.
 */
export const POOL_MIN = 0;

/**
 * A connect that hangs must surface as an error rather than as a request that
 * never answers — `/api/health` is probed every 60 s by the uptime monitor
 * (runbook §5), and a probe that hangs is a probe that reports nothing.
 */
export const CONNECT_TIMEOUT_MS = 5_000;

/**
 * Read as a plain record rather than as `process.env` directly, so seam 1 can
 * hand it one and the production path can hand it the other.
 */
export type DatabaseEnv = Readonly<Record<string, string | undefined>>;

/** Exactly the `pg` options this package sets. Anything else is `pg`'s default. */
export interface ConnectionConfig {
  readonly connectionString: string;
  readonly max: number;
  readonly min: number;
  readonly connectionTimeoutMillis: number;
}

/**
 * **The connection string never reaches the error.** It carries a password, and
 * `redaction.ts` matches key *names* — a URL interpolated into `message` is a
 * secret at a key nothing is watching. The message names the variable to set,
 * which is also the only thing the reader can act on.
 */
function connectionString(env: DatabaseEnv, variable: string): string {
  const value = env[variable]?.trim();
  if (value) return value;

  throw new AppError({
    code: "database_url_missing",
    status: 503,
    message:
      `${variable} is unset or empty, so no database connection can be opened. ` +
      "Locally: `cp apps/web/.env.example apps/web/.env.local` and `pnpm db:up`. " +
      "In production it comes from `fly secrets`.",
    userMessage: "El servicio no está disponible en este momento. Intenta de nuevo en un momento.",
    context: { variable },
  });
}

/** The pooled connection: what every request path uses. */
export function poolConfig(env: DatabaseEnv = process.env): ConnectionConfig {
  return {
    connectionString: connectionString(env, POOLED_URL_VARIABLE),
    max: POOL_MAX,
    min: POOL_MIN,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
  };
}

/**
 * The direct connection: migrations, and nothing else yet.
 *
 * **One client, not ten.** The migrator is a single caller running statements in
 * order, and a `release_command` that opened ten connections to run one sequence
 * would spend nine of the plan's connections on nothing during the deploy —
 * exactly when the old machine is still serving on the pooled ones.
 */
export function directConfig(env: DatabaseEnv = process.env): ConnectionConfig {
  return {
    connectionString: connectionString(env, DIRECT_URL_VARIABLE),
    max: 1,
    min: POOL_MIN,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
  };
}
