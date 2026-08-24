/**
 * The module singleton, and the destination the format switch selects.
 *
 * Everything decidable without a file descriptor lives in `logger-options.ts`,
 * which is why that module is pure and this one is four lines of wiring.
 */

import { assertServerOnly } from "@repo/observability/server-only";
import {
  createLoggerOptions,
  type LoggerEnvironment,
  resolveLogFormat,
} from "@repo/observability/logger-options";
import { readTraceContext } from "@repo/observability/trace-context";
import pino, { type DestinationStream, type Logger } from "pino";
import PinoPretty from "pino-pretty";

assertServerOnly("logger");

/**
 * **Do not call the logger during a static prerender.** Found while proving
 * NFR4 against a real build: a `logger.info()` in a Server Component that
 * prerenders fails `next build` under Cache Components with
 * `blocking-prerender-current-time`, because pino stamps `time` from the clock
 * and reading the current time makes a prerender non-deterministic.
 *
 * This is DD1's rule arriving from the other side. DD1 says log at the dynamic
 * boundary and never inside a cached function, because a cached line carries
 * whichever request filled the entry; the prerender check is the same boundary
 * enforced by the framework rather than by convention. The log sites this effort
 * actually ships — `instrumentation.ts`, Route Handlers, Server Actions — are
 * all past that boundary, so none of them hit it. A downstream project adding a
 * log call to a prerendering component will, and the fix is `await connection()`
 * or `"use cache"`-free dynamic rendering, not a change here.
 *
 * The durable home for this rule is the root `CLAUDE.md`, under "Logging and
 * errors", where it sits beside DD1's other two. It is repeated here because
 * this is the module whose clock read causes it.
 */

/**
 * The format switch selects a **destination**, never a transport.
 *
 * `transport: { target: "pino-pretty" }` is the documented route and it is not
 * taken: a transport runs the printer in a worker thread, and the intent asked
 * Design to confirm that thread could not collide with a future log-forwarding
 * path. Constructing the printer as a stream removes the worker entirely, which
 * answers the question structurally rather than with a promise to be careful.
 *
 * `sync: true` is right at template scale. Revisit it above roughly 1000
 * lines/sec/instance, where a blocked event loop costs more than the last few
 * lines lost to a hard crash.
 *
 * `pino-pretty` is imported statically even though production never takes this
 * branch, and that cost is accepted knowingly. A lazy `createRequire` would save
 * loading it on a production cold start, but Next's output file tracing sees a
 * static import and may not see a dynamic `require` — and DD2 turns on nothing
 * being added to `serverExternalPackages`, which leaves the framework's defaults
 * (already containing `pino` and `pino-pretty`) responsible for resolving it. A
 * printer that fails to resolve in production is a worse failure than a printer
 * that loads and is never used.
 */
export function createDestination(env: LoggerEnvironment): DestinationStream {
  if (resolveLogFormat(env) === "pretty") {
    return PinoPretty({ destination: 1, sync: true, translateTime: "SYS:HH:MM:ss.l" });
  }

  return pino.destination({ fd: 1, sync: true });
}

/**
 * The reader is passed here rather than imported inside `logger-options.ts` so
 * that module stays pure and free of the SDK — the stdout seam builds its own
 * instance from those options and must not need a reporting client to do it.
 *
 * Import order does not matter: the mixin resolves the active span at each
 * emit, so a logger constructed before `Sentry.init` correlates every line
 * emitted after it.
 */
export const logger: Logger = pino(
  createLoggerOptions(process.env, readTraceContext),
  createDestination(process.env),
);
