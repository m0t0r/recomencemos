/**
 * The server half of error reporting: the one place `register()` decides whether
 * anything initialises at all, and the single **call** site of the report seam.
 *
 * This file and `sentry.server.config.ts` are the two server files permitted to
 * name the vendor. Everything a vendor swap would rewrite is here or there; no
 * application module changes.
 *
 * **Every `@repo/observability` import here is dynamic, and that is structural
 * rather than stylistic.** Next compiles this one file for *both* runtimes — the
 * build labels the second chunk `[instrumentation-edge]` — and the edge bundler
 * resolves the `browser` export condition, which `@repo/observability` maps to a
 * module that refuses. A static import therefore fails the **build**:
 *
 * ```
 * ./apps/web/instrumentation.ts
 * Error: Export reportRequestError doesn't exist in target module
 * The export reportRequestError was not found in module
 *   .../packages/observability/src/browser-refusal.ts [instrumentation-edge]
 * ```
 *
 * Which is the seam working exactly as #33 designed it — a Node-only package
 * kept out of a non-Node bundle by resolution rather than by a grep after the
 * fact. The `NEXT_RUNTIME` guards below are what make the dynamic imports
 * unreachable there; the dynamic imports are what let the file compile at all.
 * Do not "tidy" either one into a top-level import.
 */

import * as Sentry from "@sentry/nextjs";
import type { Instrumentation } from "next";

/** Long enough for one envelope on a slow link, short enough not to hold a serverless freeze open. */
const FLUSH_TIMEOUT_MS = 2000;

/**
 * Next calls both exports below once per **runtime**, and only the Node one can
 * load `@repo/observability`. Cache Components requires the Node runtime and
 * `runtime = 'edge'` is unavailable, so nothing in this app reaches the other
 * branch today and there is no `sentry.edge.config.ts` to pair with.
 *
 * **What it will cost this app the day it adds a `middleware.ts`**, stated
 * rather than left as an unremarked early return: an error thrown in the edge
 * runtime produces **no event and no log line**. Neither sink is reachable from
 * there — the logger is Node-only and nothing has initialised the SDK — so the
 * honest options are to keep failures out of middleware, or to add an edge
 * config and an edge report path as its own ticket. Silently reporting half of
 * it would be worse than the gap being written down.
 */
function isNodeRuntime(): boolean {
  return process.env.NEXT_RUNTIME === "nodejs";
}

/**
 * Called **once** per server instance, before the server handles a request.
 *
 * The DSN check sits *before* the import, and that ordering is the whole
 * off-switch. `enabled: false` or an empty DSN is not equivalent: either still
 * installs the tracing provider, the propagator, the context manager and the
 * module-loader hooks on every boot. Not calling `init` is the only clean way to
 * be inactive, and every run of this app that has no DSN takes exactly that
 * path — which is every `pnpm dev` and every build that is not a deploy's.
 *
 * `sentry.server.config.ts` is dynamic for a second, independent reason: a
 * top-level import would run the module — and therefore `init` — regardless of
 * which way the branch went.
 */
export async function register(): Promise<void> {
  // Without this, NFR2's "exactly 1 line per server instance" would quietly
  // become two the day this app adds a `middleware.ts`.
  if (!isNodeRuntime()) return;

  const { isReportingConfigured, logStartupNotice } =
    await import("@repo/observability/startup-notice");

  // Before the branch, so the notice is emitted on both paths — it reports the
  // missing release in production just as it reports an absent DSN.
  logStartupNotice(process.env);

  // The sibling of `onRequestError`: that hook fires when a request *fails*,
  // this one when a request *completes*. Together they are a rate (NFR17).
  //
  // It sits before the DSN branch because the traffic line is not conditional on
  // reporting — a run with no monitoring account still gets its denominator.
  //
  // The subscription itself lives in the package for a reason beyond the dynamic
  // import rule above: a `node:diagnostics_channel` specifier written into *this*
  // file would make the edge bundler warn on every build, and the package's
  // `browser` condition resolves the whole module away instead.
  const { subscribeRequestCompletion } = await import("@repo/observability/log-request-complete");

  subscribeRequestCompletion();

  // The same predicate the notice used, rather than a second reading of the same
  // variable. Two readings is what this was, and they disagreed: a whitespace
  // DSN is blank to the notice and truthy to a bare `!`, so the notice announced
  // reporting inactive and then `init` ran anyway with a DSN it cannot parse.
  if (!isReportingConfigured(process.env)) return;

  await import("./sentry.server.config");
}

/**
 * The single server report site: **thrown is reported, returned is logged**.
 *
 * An error that escapes a request reaches here and produces exactly one event
 * and exactly one `error` line carrying that event's id. An error handled and
 * returned through `toErrorResponse` never reaches here and produces one `warn`
 * line and no event. That is the only quota lever in the design — there is no
 * status-based pre-send filter behind it.
 *
 * `Sentry.captureRequestError` — the documented shape for this export — is what
 * ultimately does the reporting, reached through the seam so that this file
 * stays the only thing a vendor swap rewrites. The seam exists to hand back the
 * event id the helper discards, not to replace the helper: the transaction name,
 * the request panel and `contexts.nextjs` all come from the SDK, and only the id
 * comes from us.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  // See `isNodeRuntime` for what this silently costs an edge request, and why
  // that is the honest outcome rather than a half-reported one.
  if (!isNodeRuntime()) return;

  const { reportRequestError } = await import("@repo/observability/report-request-error");

  reportRequestError(error, request, context);

  // `captureRequestError` schedules a flush of its own through `waitUntil`, which
  // is fire-and-forget. This one is awaited, which is what a serverless host
  // needs: the process can be frozen the instant this returns, and an unflushed
  // envelope is simply lost. It resolves immediately when no client exists, so
  // the no-DSN path pays nothing.
  //
  // It stays here rather than inside the seam because it is asynchronous and the
  // seam is not: the log line has to be emitted while the span is still
  // resolvable, not after a network round trip.
  await Sentry.flush(FLUSH_TIMEOUT_MS);
};
