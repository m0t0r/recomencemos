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
 *
 * **The SDK is handed to this module; this module does not import it** (#157).
 * That is the same move `packages/errors/src/ambient-request-id.ts` makes and
 * for the same reason: the value crosses and the module does not. A static
 * `import * as Sentry` here is a static import on a `"use client"` path, so
 * Turbopack put `getClient`, `captureException` and the `@sentry/core`
 * machinery under them — **21 KB gzip** — into the first-load JavaScript of
 * every route, which is 21 KB of monitoring on a page that has not failed.
 * Deferring the SDK in `instrumentation-client.ts` and leaving this import
 * behind would have moved the large half and left the visible half.
 */

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
 * The two functions this module needs from the SDK.
 *
 * `typeof import(...)` in a **type** position is erased by the compiler, so this
 * keeps the vendor's own signatures without putting one byte of the vendor in
 * the bundle. Naming the two rather than the whole module is also the honest
 * description of what a report site uses.
 */
type Reporter = Pick<typeof import("@sentry/nextjs"), "getClient" | "captureException">;

let reporter: Reporter | undefined;

/**
 * What was thrown before the SDK arrived, waiting for it.
 *
 * **Five, and then it stops.** An error inside a render loop or a retrying
 * fetch produces hundreds before the first idle callback runs, and an unbounded
 * array would hold every one and then spend a month's event allowance replaying
 * them. Five is enough to see what broke.
 *
 * On a deployment with no DSN nothing ever attaches, so up to five errors are
 * held for the life of the page and replayed into nothing. That is deliberate
 * rather than overlooked: five error objects is not a leak worth a second
 * condition, and the module that knows whether a DSN exists is the one that
 * would have to tell this one, which is a coupling for no gain.
 */
const PENDING_LIMIT = 5;
const pending: unknown[] = [];

/**
 * The hint on a replayed event.
 *
 * **The timestamp is the replay's, not the throw's**, because neither a browser
 * `ErrorEvent` nor a boundary hands over an event time the SDK would take. The
 * tag is what tells an operator that the moment on the event is when monitoring
 * arrived rather than when the page broke, so nobody correlates it against a
 * server line and concludes the clocks disagree.
 */
const REPLAYED = { captureContext: { tags: { buffered_before_load: "true" } } };

/**
 * Hold an error until there is something to report it to.
 *
 * Called by the boundary path below and by the two `window` listeners in
 * `instrumentation-client.ts`, so there is one buffer rather than one per
 * caller — which is what keeps the limit above a limit on events rather than on
 * events per source.
 */
export function bufferThrown(error: unknown): void {
  if (pending.length < PENDING_LIMIT) pending.push(error);
}

/**
 * Hand this module the SDK, and replay what was thrown before it arrived.
 *
 * `instrumentation-client.ts` is the only caller, immediately after `init` — so
 * every replayed event passes through the same three redaction hooks every
 * other event does.
 */
export function attachReporter(sdk: Reporter): void {
  reporter = sdk;

  for (const error of pending.splice(0)) {
    try {
      sdk.captureException(error, REPLAYED);
    } catch {
      // Nothing here escapes, for the reason `reportClientError` gives below.
    }
  }
}

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

    // **A boundary that fires before the SDK arrives still reports, and still
    // shows no reference.** The error is held and replayed, so the incident is
    // not lost; the reference is genuinely unavailable, because the identifier
    // the SDK returns is minted by the call this cannot make yet. Inventing one
    // would put a string on the page that resolves to no event anywhere — the
    // same reason the no-DSN path below renders no reference line either.
    if (reporter === undefined) {
      bufferThrown(error);
      return undefined;
    }

    // The same check `reportError` makes on the server, for the same reason:
    // with no client initialised the SDK still mints an event id and sends
    // nothing, so returning it would put a reference on the page that resolves
    // to no event anywhere. On the no-DSN path a fresh clone runs, and the
    // boundary simply renders no reference line.
    if (reporter.getClient() === undefined) return undefined;

    return reporter.captureException(error);
  } catch {
    return undefined;
  }
}
