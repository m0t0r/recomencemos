/**
 * The vendor seam, and the single server-side report site.
 *
 * Sentry is named here and in `apps/web`'s integration files — `instrumentation.ts`,
 * `sentry.server.config.ts`, `instrumentation-client.ts`, `next.config.ts`, and
 * `lib/report-client-error.ts`, which is this seam's browser half and reports
 * the errors that never reach a server — and nowhere else. Application code
 * calls one of the two. A vendor swap replaces this module plus those files and
 * touches **no call site**.
 *
 * **The seam delegates to `Sentry.captureRequestError`; it does not replace it.**
 * That distinction is the whole design. Wrapping the SDK's framework integration
 * would hide exactly what makes the SDK worth having, so the helper does the
 * reporting and this module does one thing the helper does not: it hands back
 * the event id. Measured against a received envelope, what delegating buys over
 * a bare `captureException` is not cosmetic:
 *
 * | | via the helper | via a bare capture |
 * | --- | --- | --- |
 * | `transaction` | `POST /orders` | absent |
 * | `request` | headers, method, cookies | absent |
 * | `contexts.nextjs` | `request_path`, `router_kind`, `router_path`, `route_type` | absent |
 * | `mechanism.type` | `auto.function.nextjs.on_request_error` | generic |
 *
 * The transaction name is the one that matters most: it is what the reporting
 * platform groups issues by, so a report without it groups every route's
 * failures together.
 *
 * **Returning the event id is the other half of the design.** It is what makes
 * "exactly one event" countable by reading the dev server's stdout, with no
 * monitoring account and no mock: the log line carries the id, so the count is a
 * property of a stream anyone can read rather than of a dashboard only some
 * people have.
 */

import { assertServerOnly } from "@repo/observability/server-only";
import * as Sentry from "@sentry/nextjs";

assertServerOnly("report-error");

/**
 * The request, as the framework's error hook hands it over. Declared
 * structurally rather than imported from `next`, so this package keeps no
 * framework dependency — the caller passes the object it already has.
 */
export interface RequestSummary {
  path: string;
  method: string;
  headers: Record<string, string | string[] | undefined>;
}

/** Which route failed, and in what capacity. Structural for the same reason. */
export interface RequestErrorContext {
  routerKind: string;
  routePath: string;
  routeType: string;
}

/**
 * Everything this module needs from a reporting platform, as one value.
 *
 * **One injectable seam, not three.** An earlier revision took a capture
 * function alone, which let a test satisfy "a throwing report still emits the
 * log line" against a stub that had agreed not to throw. Bundling the three
 * calls keeps the id-reading protocol below — which is the subtle part — inside
 * the code under test rather than inside the stub.
 */
export interface ReportingClient {
  /** Whether anything is initialised. False on the no-DSN path. */
  isActive: () => boolean;
  /** Reports the error. Returns nothing — which is the problem `lastEventId` solves. */
  capture: (error: unknown, request: RequestSummary, context: RequestErrorContext) => void;
  /** The id of the most recent error event, per the SDK's own isolation scope. */
  lastEventId: () => string | undefined;
}

const sentryClient: ReportingClient = {
  isActive: () => Sentry.getClient() !== undefined,
  capture: (error, request, context) => {
    Sentry.captureRequestError(error, request, context);
  },
  lastEventId: () => Sentry.lastEventId(),
};

/**
 * Reports one error through the framework's capture helper and returns the
 * reporting platform's id for it, or `undefined` when nothing was reported.
 *
 * **How the id is recovered, and why it is a delta rather than a read.**
 * `captureRequestError` returns `void`, discarding the id `captureException`
 * produced, so the id has to come from `lastEventId()`. That is safe only
 * because it is read *twice*: the value lives on the SDK's isolation scope and
 * survives the call that set it, so a single read after a capture that did not
 * complete synchronously would return the id of a **previous** error — a log
 * line pointing confidently at the wrong event, which is worse than a line with
 * no id at all. Comparing before and after makes the failure mode `undefined`
 * instead of wrong.
 *
 * Verified against `@sentry/nextjs@10.70.0`: the id is in fact set
 * synchronously, because the SDK's internal promise resolves eagerly. The delta
 * is what keeps that an optimisation rather than a load-bearing assumption about
 * an internal.
 *
 * **This cannot propagate.** A thrown SDK error, a network failure or a quota
 * rejection returns `undefined`; it never escapes. The caller logs immediately
 * afterwards, and an exception here would suppress that line — leaving the
 * incident in neither sink at exactly the moment both are needed.
 */
export function reportError(
  error: unknown,
  request: RequestSummary,
  context: RequestErrorContext,
  client: ReportingClient = sentryClient,
): string | undefined {
  try {
    // Nothing is initialised on the no-DSN path, and reporting into that is not
    // merely a no-op: with no client the SDK still mints an id and sends
    // nothing, so a line could carry an `event_id` that resolves to no event
    // anywhere — a pivot that looks like it works right up until someone follows
    // it during an incident.
    if (!client.isActive()) return undefined;

    const before = client.lastEventId();

    client.capture(error, request, context);

    const after = client.lastEventId();

    return after !== undefined && after !== before ? after : undefined;
  } catch {
    return undefined;
  }
}
