/**
 * NFR5's half of a log line: the identifiers that make a line and an event
 * describe the same request.
 *
 * This is the `TraceContextReader` `createLoggerOptions` has taken as a
 * parameter since the logger shipped — the shape is checked where it is passed,
 * in `logger.ts`, rather than by an annotation here that would erase the
 * defaulted parameter below from the exported signature — the reader arrives with the SDK, and no
 * call site changes. It runs as pino's `mixin`, which means **once per emit**.
 *
 * **Scoped to uncached execution.** A log call inside a `use cache` scope runs
 * at cache-fill time: it emits once per miss, carries whichever request
 * populated the entry, and emits nothing at all on a hit. That is why NFR5
 * excludes cached scopes rather than claiming 100% of all lines, and why the
 * conventions say to log at the dynamic boundary and never inside a cached
 * function.
 */

import { assertServerOnly } from "@repo/observability/server-only";
import { getActiveSpan, type Span, spanToJSON } from "@sentry/nextjs";

assertServerOnly("trace-context");

/** How the active span is found. A defaulted parameter, so the reader is testable. */
export type ActiveSpanReader = () => Span | undefined;

/**
 * OpenTelemetry's "invalid" identifiers: all zeros, returned by a
 * non-recording span. They are structurally valid and correlate to nothing, so
 * they are worse than absent — NFR18 counts `error` lines *lacking* `trace_id`,
 * and a line carrying zeros would pass that band while pivoting nowhere.
 */
function isUsableId(value: unknown): value is string {
  return typeof value === "string" && value !== "" && !/^0+$/.test(value);
}

/**
 * Never throws, and that is a requirement rather than caution: this runs on
 * every emit, so a throw here takes the logger down — during the incident the
 * logger exists for. Correlation is a nice-to-have on a line; the line is not.
 *
 * The residue this cannot fix is DD1's: the *active* span is what is read, and
 * async-context loss after an `await` returns nothing in production and never in
 * a test. NFR18's band is what catches that at runtime.
 */
export function readTraceContext(
  activeSpan: ActiveSpanReader = getActiveSpan,
): Record<string, string> {
  try {
    const span = activeSpan();

    if (!span) return {};

    // Used exactly as it comes. The line is `snake_case` (ADR-0005) and
    // `spanToJSON()` already returns these two that way, so the rule costs no
    // mapping at the one boundary where mapping would be riskiest — these are
    // the identifiers a drain pivots to the reporting platform on, and the
    // vendor's spelling is the safest thing to keep.
    const { trace_id, span_id } = spanToJSON(span);

    if (!isUsableId(trace_id) || !isUsableId(span_id)) return {};

    return { trace_id, span_id };
  } catch {
    return {};
  }
}
