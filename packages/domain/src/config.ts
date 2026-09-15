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
 * record is testable without a database, and the failures it reports — a
 * variable nobody set, or set to a string that would not verify the server — are
 * the failures that actually happen.
 */

import { AppError } from "@repo/errors/app-error";
import { readEnvironment } from "@repo/errors/environment";
import { parse } from "pg-connection-string";
import { SERVICE_UNAVAILABLE } from "#user-messages";

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
 * The one `sslmode` that encrypts *and* checks whose certificate it is in `pg`
 * 8, in `pg` 9 and in libpq alike. `require` verifies today only because `pg` 8
 * treats it as an alias for this, and its own warning says 9 will not.
 */
const VERIFIED_SSLMODE = "verify-full";

/**
 * libpq's spelling for the operating system's trust store. `pg` reads every
 * `sslrootcert` as a file path, so this one fails at connect with `ENOENT` —
 * and Node verifies against its bundled CAs without it.
 */
const SYSTEM_ROOT_CERT = "system";

/** Enough of a refused parameter to recognise it; a log line needs no more. */
const MAX_QUOTED_LENGTH = 32;

/**
 * **The connection string never reaches the error.** It carries a password, and
 * `redaction.ts` matches key *names* — a URL interpolated into `message` is a
 * secret at a key nothing is watching. The message names the variable to set,
 * which is also the only thing the reader can act on.
 */
function connectionString(env: DatabaseEnv, variable: string): string {
  const value = env[variable]?.trim();
  if (!value) {
    throw new AppError({
      code: "database_url_missing",
      status: 503,
      message:
        `${variable} is unset or empty, so no database connection can be opened. ` +
        "Locally: `cp apps/web/.env.example apps/web/.env.local` and `pnpm db:up`. " +
        "In production it comes from `fly secrets`.",
      userMessage: SERVICE_UNAVAILABLE,
      context: { variable },
    });
  }

  if (readEnvironment(env) === "production") refuseUnverifiedTls(variable, value);
  return value;
}

interface TlsWeakness {
  /** Completes "`DATABASE_URL` …" in the operator's message. */
  readonly reason: string;
  /** The offending parameter and at most its value — never the string it came from. */
  readonly context: Readonly<Record<string, string>>;
}

/**
 * In production, a string that would not verify the server's certificate is
 * refused here rather than trusted to whoever pasted it (#327).
 *
 * PlanetScale refuses plaintext, so the quiet failure is an encrypted
 * connection that checks nobody's certificate — which a machine in the path can
 * intercept. Nothing in CI speaks TLS, so a `pg` major that changed what a
 * string means would go green; this is the check that notices. Outside
 * production nothing is asked: the local Docker database has no TLS at all.
 *
 * This is called by the pooled connection, the migrator and `admin:enrol`
 * alike, because all three resolve here — and by `scripts/database-url-form.mjs`,
 * which is how the go-live wizard asks the same question before staging a
 * string, rather than keeping a second copy of the rule.
 */
function refuseUnverifiedTls(variable: string, value: string): void {
  const weakness = tlsWeakness(value);
  if (!weakness) return;

  throw new AppError({
    code: "database_url_tls_unverified",
    status: 503,
    message:
      `${variable} ${weakness.reason}, so production will not open it. ` +
      `It must carry sslmode=${VERIFIED_SSLMODE}, the one mode that verifies the server's ` +
      `certificate, and must not carry sslrootcert=${SYSTEM_ROOT_CERT}, which the Postgres ` +
      "client reads as a file path. Correct it with `fly secrets set`; " +
      "docs/runbooks/recomencemos-go-live.md section 1 has the form.",
    userMessage: SERVICE_UNAVAILABLE,
    context: { variable, ...weakness.context },
  });
}

/**
 * What is wrong with `value`, or nothing.
 *
 * **`sslmode` is read by `pg`'s own parser, never by one written here.**
 * `pg-connection-string` re-encodes a string holding a space or a malformed `%`
 * escape before it parses, and `new URL()` does not — so a key spelt `ssl%6Dode`
 * decodes to `sslmode` in one and not the other. A check that parsed for itself
 * accepted strings `pg` then opened in plaintext (review of #327). Asking
 * `parse` answers the only question that matters, what `pg` will do, and it
 * keeps the last of a repeated `sslmode` because that is the one `pg` uses. The
 * seam-1 agreement cases hold the two together across an upgrade of either.
 *
 * `sslrootcert=system` is asked first, because `parse` opens every
 * `sslrootcert` as a file and would report this one as a missing file rather
 * than as the mistake it is. Anything `parse` cannot read is refused.
 */
function tlsWeakness(value: string): TlsWeakness | undefined {
  if (namesSystemRootCert(value)) {
    return {
      reason: `carries sslrootcert=${SYSTEM_ROOT_CERT}`,
      context: { parameter: "sslrootcert", value: SYSTEM_ROOT_CERT },
    };
  }

  let sslmode: unknown;
  try {
    sslmode = parse(value).sslmode;
  } catch {
    // Not propagated: nothing has checked what the parser's own error quotes.
    return { reason: "cannot be read by the Postgres client", context: {} };
  }

  if (sslmode === undefined) {
    return { reason: "carries no sslmode", context: { parameter: "sslmode" } };
  }

  if (sslmode !== VERIFIED_SSLMODE) {
    return {
      reason: "carries an sslmode that does not verify the server's certificate",
      context: { parameter: "sslmode", value: String(sslmode).slice(0, MAX_QUOTED_LENGTH) },
    };
  }

  return undefined;
}

/** Whether any `sslrootcert` in `value` is `system`. A value that is not a URL names none. */
function namesSystemRootCert(value: string): boolean {
  try {
    return new URL(value).searchParams.getAll("sslrootcert").includes(SYSTEM_ROOT_CERT);
  } catch {
    return false;
  }
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
