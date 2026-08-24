/**
 * The single **browser** report site, and the whole report-once story on the
 * client.
 *
 * Both error boundaries call this and neither one holds a rule of its own about
 * what to report or which identifier to show, which is what makes "reported
 * once" a property of one module rather than a convention two files have to
 * keep agreeing on. Its server-side sibling is `reportRequestError` in
 * `@repo/observability`, reached from `instrumentation.ts`.
 *
 * `@sentry/nextjs` is named here and in `instrumentation-client.ts`, and in no
 * other browser module — the client half of the vendor seam. It may **not**
 * import `@repo/observability`: that package depends on `pino` and its stream
 * packages, and pulling it onto a `"use client"` path would ship them to every
 * visitor.
 */

import * as Sentry from "@sentry/nextjs";

/**
 * The error an App Router error boundary receives.
 *
 * `digest` is the framework's marker for an error that was **thrown on the
 * server**: Next replaces the original error with a generic one before it
 * crosses to the browser and attaches the digest as the only thing that
 * survives the crossing.
 */
export type BoundaryError = Error & { digest?: string };

/**
 * Reports a boundary's error if it has not already been reported, and returns
 * the reference identifier to show the user — or `undefined` when there is
 * none worth showing.
 *
 * **The digest guard: reporting is guarded on the *absence* of a digest.** A
 * digest means the error was thrown on the server, and the server already
 * reported it — `onRequestError` is the single server report site and produced
 * exactly one event and one log line carrying that event's id. Reporting again
 * from here would make one incident cost two events, and the browser's copy is
 * the worse of the two: it has the generic message Next substituted, no stack
 * beyond the client, and no request context.
 *
 * **This diverges from the SDK's documented Next.js example**, which calls
 * `Sentry.captureException(error)` in the boundary unconditionally. That
 * example is written for an app whose server half is not instrumented; this one
 * is. Do not "fix" the guard back — the divergence is the design, and NFR3's
 * one-error-one-event count is what it buys.
 *
 * **What the guard governs is this module, not the SDK's automatic
 * instrumentation**, and the difference shows up only in development. Measured
 * against a local envelope sink: a production build of a server-thrown error
 * sends **1** server event and **0** browser events. The same error under
 * `next dev` also produces a browser event with
 * `mechanism: auto.browser.global_handlers.onerror`, because the dev overlay
 * re-throws the original error in the browser and Sentry's global handler
 * catches it — carrying the raw server message, which production never sends to
 * a browser at all. Counting browser events against a dev server will therefore
 * over-count; count against `next build && next start`.
 *
 * **The reference is the digest when present, and the browser event id
 * otherwise.** For a server-thrown error the digest is all the browser has — by
 * the guard, the client never reported it — so anything else would be invented.
 * Note that **a digest identifies an error class, not an occurrence**: two
 * users hitting the same bug quote the same string. The operator's pivot is
 * digest → issue → `trace_id` → the drain, which is why the report's event id
 * is on the log line.
 *
 * **Nothing here escapes.** A throw would be caught by the boundary above this
 * one — a failed report would replace the error page with a worse error page.
 */
export function reportClientError(error: BoundaryError): string | undefined {
  try {
    // Non-empty rather than merely present: a blank digest identifies nothing,
    // and treating it as one would show the user a reference that resolves to
    // no event anywhere while suppressing the report that would have.
    if (error.digest !== undefined && error.digest.trim() !== "") return error.digest;

    // The same check `reportError` makes on the server, for the same reason:
    // with no client initialised the SDK still mints an event id and sends
    // nothing, so returning it would put a reference on the page that resolves
    // to no event anywhere. On the no-DSN path a fresh clone runs, and the
    // boundary simply renders no reference line.
    if (Sentry.getClient() === undefined) return undefined;

    return Sentry.captureException(error);
  } catch {
    return undefined;
  }
}
