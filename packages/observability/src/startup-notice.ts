/**
 * The one line a server instance emits about its own observability, and the
 * only line this effort emits that is not about a request.
 *
 * NFR2 counts **lines**, not notices: reporting-inactive is exactly 1 line per
 * server instance and 0 further lines per request. That is why the two
 * conditions the ticket names — no DSN, and production with no release — are one
 * function producing one line rather than two calls that would produce two lines
 * on a deployment missing both.
 *
 * `warn`, not `info`, because NFR8 puts the production floor at `info` and a
 * startup notice that a production floor filters out is a notice nobody reads.
 */

import { logger as defaultLogger } from "@repo/observability/logger";
import { assertServerOnly } from "@repo/observability/server-only";
import type { Logger } from "pino";

assertServerOnly("startup-notice");

/** The environment this reads. Passed in rather than read, so the decision stays pure. */
export interface StartupEnvironment {
  NODE_ENV?: string | undefined;
  NEXT_PUBLIC_SENTRY_DSN?: string | undefined;
  NEXT_PUBLIC_RELEASE?: string | undefined;
}

/**
 * The names are the queryable half of the line. A drain filters on
 * `context.gaps`; a person reads `msg`. Neither has to parse the other.
 */
type Gap = "reporting-inactive" | "release-unknown";

/**
 * Prose per gap, naming the variable that closes it.
 *
 * The reader of the no-DSN line is whoever started the app without a monitoring
 * account — a developer on their first `pnpm dev`, or an operator on a first
 * deploy — so the line has to say what to set rather than only that something is
 * unset, which is the difference between a notice and a chore.
 */
const GAP_DETAIL: Record<Gap, string> = {
  "reporting-inactive":
    "error reporting is inactive because NEXT_PUBLIC_SENTRY_DSN is not set — nothing is initialised and no events are sent",
  "release-unknown":
    'the release is "unknown" because NEXT_PUBLIC_RELEASE is not set — "did this start at the last deploy?" is unanswerable until it is',
};

/**
 * An unset variable and one set to whitespace are the same gap. A `.env` line
 * left with nothing after the `=` is how the off-switch is usually reached in
 * practice, and treating it as configured would init the SDK with a DSN it
 * cannot parse.
 */
function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim() === "";
}

/**
 * **The single definition of "reporting is configured", and it is exported so
 * there can only be one.**
 *
 * `register()` needs the same answer this notice needs, and the two derived it
 * separately until a review caught them disagreeing: this function trims, while
 * a bare truthiness check does not. `NEXT_PUBLIC_SENTRY_DSN="  "` therefore
 * announced `reporting-inactive` and then initialised the SDK anyway — the one
 * state the off-switch exists to make impossible, reached by a value a person
 * would read as empty.
 *
 * The spec narrows an `isReportingEnabled` *flag* out of this package's surface,
 * and this is not that: it is a predicate over an environment the caller already
 * holds, with nothing to configure and nothing to pin.
 */
export function isReportingConfigured(env: StartupEnvironment): boolean {
  return !isBlank(env.NEXT_PUBLIC_SENTRY_DSN);
}

function findGaps(env: StartupEnvironment): Gap[] {
  const gaps: Gap[] = [];

  if (!isReportingConfigured(env)) gaps.push("reporting-inactive");

  // Only in production. Nothing populates the release without CI, so warning
  // about it in development would fire on every `pnpm dev` anybody runs — which
  // is how a startup notice becomes something people learn to skip past.
  if (env.NODE_ENV === "production" && isBlank(env.NEXT_PUBLIC_RELEASE)) {
    gaps.push("release-unknown");
  }

  return gaps;
}

/**
 * Emits **at most one** line. Silent when the deployment is fully configured,
 * which is the state a healthy production instance boots in.
 *
 * @param env - the environment to read. `process.env` at the call site.
 * @param logger - defaulted, the same injection point `logRequestError` uses.
 */
export function logStartupNotice(env: StartupEnvironment, logger: Logger = defaultLogger): void {
  const gaps = findGaps(env);

  if (gaps.length === 0) return;

  logger.warn({ context: { gaps } }, gaps.map((gap) => GAP_DETAIL[gap]).join("; "));
}
