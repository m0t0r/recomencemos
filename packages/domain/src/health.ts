/**
 * The database round trip behind `GET /api/health`.
 *
 * **Why the domain package publishes this at all.** It is one subpath more than
 * the spec's export table lists, and it earns its place by removing a worse
 * option: DD10 requires the health check to make a real round trip — _"without
 * the round trip a bad `DATABASE_URL` deploys clean"_ — and the connection is
 * withheld, so either `apps/web` reaches past the boundary or the domain
 * publishes a function narrow enough to be safe. This is that function. It hands
 * back a verdict and a duration, and no pool, client or query builder.
 *
 * **It returns its failure and never throws it.** `CLAUDE.md`'s rule is that
 * thrown is reported and returned is logged, and this endpoint is probed every
 * 60 s by the uptime monitor (go-live runbook §5). A thrown failure would spend
 * one Sentry event per probe for as long as the outage lasts, which is the one
 * quota lever this design has and the wrong way to pull it.
 */

/**
 * The build-time half of the guard — see the note in `connection.ts`. Verified
 * that a Route Handler is inside Next's `react-server` layer: `pnpm build`
 * compiles and `GET /api/health` answers 200 with this import in place.
 */
import "server-only";
import { AppError, isAppError } from "@repo/errors/app-error";
import { sql } from "drizzle-orm";
import { db } from "#connection";
import { SERVICE_UNAVAILABLE } from "#user-messages";
import { assertServerOnly } from "#server-only";

assertServerOnly("health");

/** The verdict. `durationMs` is reported on both branches — a slow success is a signal too. */
export type DatabaseHealth =
  | { readonly ok: true; readonly durationMs: number }
  | { readonly ok: false; readonly durationMs: number; readonly failure: AppError };

/**
 * `select 1` and nothing more.
 *
 * The point is the round trip, not the answer: it proves the URL parses, the
 * host resolves, the credential is accepted and the far end is a working
 * Postgres. Reading a table would additionally couple the deploy gate to
 * whichever migration last ran, which is a different question and one the
 * migration gate already answers.
 */
export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  const startedAt = performance.now();

  try {
    await db().execute(sql`select 1`);
    return { ok: true, durationMs: Math.round(performance.now() - startedAt) };
  } catch (error) {
    return {
      ok: false,
      durationMs: Math.round(performance.now() - startedAt),
      failure: asFailure(error),
    };
  }
}

/**
 * A missing `DATABASE_URL` already arrives as an `AppError` from `#config` and
 * is passed through unchanged — it is the more useful of the two messages.
 * Anything else is `pg`'s, and it is carried as `cause` rather than interpolated
 * into `message`: a driver error can name the host, and `redaction.ts` matches
 * key *names*, so a host spliced into operator prose is at a key nothing watches.
 */
function asFailure(error: unknown): AppError {
  if (isAppError(error)) return error;

  return new AppError({
    code: "database_unreachable",
    status: 503,
    message: "The database round trip failed. See `cause` for the driver's own error.",
    userMessage: SERVICE_UNAVAILABLE,
    cause: error,
  });
}
