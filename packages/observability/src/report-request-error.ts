/**
 * Report first, then log — the composition the acceptance criteria are written
 * about, in a module a test can reach.
 *
 * `instrumentation.ts` stays the single **call** site; this is the single
 * **report** site. The split is deliberate: `apps/web` has no test suite by
 * design (Vitest cannot reach `async` Server Components, so a suite there would
 * be vacuously green), and the three rules below are exactly what the ticket
 * asks to have asserted rather than assumed. Leaving them in a framework file
 * would make "a throwing report still emits the log line" a claim.
 *
 * The three rules, in the order they appear in the body:
 *
 * 1. **Report first.** The report runs while the active span is still
 *    resolvable, so the event and the line describe the same trace.
 * 2. **The line carries the returned event id**, which is what makes the pivot
 *    work in both directions — drain to platform, and platform to drain.
 * 3. **The report cannot propagate.** {@link reportError} already swallows;
 *    this function never places the log call anywhere a throw could skip it.
 */

import { logger as defaultLogger } from "@repo/observability/logger";
import { logRequestError } from "@repo/observability/log-request-error";
import {
  reportError,
  type ReportingClient,
  type RequestErrorContext,
  type RequestSummary,
} from "@repo/observability/report-error";
import { assertServerOnly } from "@repo/observability/server-only";
import type { Logger } from "pino";

assertServerOnly("report-request-error");

/**
 * Reports one uncaught request failure and emits the one line that describes it.
 *
 * The line's fields are **derived** from what the framework's hook already
 * passes rather than assembled by the caller. That is what keeps the call site a
 * single line, and it is what stops two report sites disagreeing about whether
 * the line carries the route pattern or the URL.
 *
 * @param error - the error that escaped the request.
 * @param request - the request, as the hook hands it over.
 * @param context - which route failed, and in what capacity.
 * @param logger - defaulted, the stdout seam.
 * @param client - defaulted, the vendor seam. Threaded **through**
 *   {@link reportError} rather than replacing it, so every test of this
 *   composition runs the real swallowing seam.
 * @returns the event id, or `undefined` when nothing was reported.
 */
export function reportRequestError(
  error: unknown,
  request: RequestSummary,
  context: RequestErrorContext,
  logger: Logger = defaultLogger,
  client?: ReportingClient,
): string | undefined {
  const eventId = reportError(error, request, context, client);

  logRequestError(
    error,
    {
      // The matched route pattern, never `request.path` — a URL is
      // high-cardinality and may carry secrets in its query string. The event
      // gets the full path through the SDK's own `contexts.nextjs`, where the
      // shared scrubber reaches it; the log line does not need it twice.
      route: context.routePath,
      context: {
        method: request.method,
        router_kind: context.routerKind,
        route_type: context.routeType,
      },
      ...(eventId === undefined ? {} : { event_id: eventId }),
    },
    logger,
  );

  return eventId;
}
