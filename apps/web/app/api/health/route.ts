/**
 * The deploy gate and the uptime probe, and it makes a real database round trip.
 *
 * **The round trip is the whole point** (DD10). Fly's health check degrades to
 * TCP-accept, which succeeds while every route returns 500, and deploys here are
 * bluegreen and health-gated — _"a failing health check aborting the deploy is
 * the only rollback that works when nobody is watching"_, with `on-call-rotation`
 * set to nobody. Without the round trip a bad `DATABASE_URL` deploys clean, the
 * old machine is retired, and the site is down with a green tick beside it.
 *
 * The uptime monitor probes this every 60 s and alerts after two consecutive
 * failures (go-live runbook §5).
 */

import { checkDatabaseHealth } from "@repo/domain/health";
import { toErrorResponse } from "@repo/errors/error-response";
import { logRequestError } from "@repo/observability/log-request-error";
import { connection } from "next/server";

const ROUTE = "/api/health";

export async function GET(): Promise<Response> {
  /**
   * Under Cache Components a `GET` handler that reads nothing request-shaped is
   * a candidate for prerendering, and a prerendered health check would open a
   * database connection **at build time** — failing a build that has no
   * credential, and afterwards answering every probe with a cached verdict from
   * whenever the build ran. `connection()` is the documented way to say this
   * point is dynamic, and it is the same boundary `CLAUDE.md` names for the
   * logger's clock read.
   */
  await connection();

  const health = await checkDatabaseHealth();

  if (!health.ok) {
    /**
     * Handled and returned, so it costs one `warn` line and no Sentry event —
     * the quota lever `CLAUDE.md` describes, pulled the right way for an
     * endpoint that is hit 1,440 times a day and fires repeatedly during exactly
     * the incident somebody is already being paged about.
     */
    logRequestError(health.failure, {
      level: "warn",
      route: ROUTE,
      // How long the failure took to arrive, which is what separates "refused
      // immediately" from "timed out after five seconds" — two different
      // outages, and the line is the only place that distinction survives.
      context: { duration_ms: health.durationMs },
    });

    const { status, body, headers } = toErrorResponse(health.failure);
    return Response.json(body, { status, headers });
  }

  return Response.json(
    { status: "ok", durationMs: health.durationMs },
    {
      status: 200,
      // A cached health check is a health check that answers for a machine that
      // may no longer exist.
      headers: { "cache-control": "no-store" },
    },
  );
}
