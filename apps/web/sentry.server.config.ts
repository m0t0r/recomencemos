/**
 * The one server reporting-configuration module, and the file
 * `instrumentation.ts` imports **only when a DSN exists**.
 *
 * That conditional import is the off-switch. An empty DSN or `enabled: false`
 * still installs the tracing provider, the propagator, the context manager and
 * the module-loader hooks on every boot, so the only clean way to be inactive is
 * for this module never to load. Nothing outside `register()` may import it.
 *
 * It mirrors `instrumentation-client.ts` deliberately: a browser event and a
 * server event describing the same deployment have to agree on `environment`,
 * `release` and what has been scrubbed out of them, and two files that drift are
 * how a redaction list ends up disagreeing with itself.
 */

import { scrubOrDrop } from "@repo/errors/redaction";
import * as Sentry from "@sentry/nextjs";

const release = process.env.NEXT_PUBLIC_RELEASE;

Sentry.init({
  // Read rather than passed in, because this module loads only on the path
  // where `register()` has already found one. A non-empty DSN is this file's
  // precondition, not something it re-decides.
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Explicit rather than inherited, on the server for the same reason as on the
  // browser: the wizard-generated config sets this `true`, which sends IP
  // address, cookies and headers — every one of them `personal` under
  // `docs/policy/data.md` — to a processor nobody here chose for that purpose.
  // Sentry was chosen to receive errors and traces, and `/privacy` names it to
  // the people it concerns on exactly those terms; `sendDefaultPii` would widen
  // that silently. It is already `false` by default in 10.70.0; pinning it is
  // what stops a wizard re-run or an SDK default quietly flipping it.
  //
  // Not migrated to `dataCollection` on purpose: supplying that object at all
  // switches the SDK's baseline from the privacy-preserving mapping this flag
  // selects to the permissive defaults, so the migration would have to re-state
  // every category to stand still. Revisit when v11 removes the flag.
  sendDefaultPii: false,

  environment: process.env.NODE_ENV,

  // Only when it has a value: the SDK's defaults are spread *under* the options
  // object, so an explicit `undefined` would overwrite the release the build
  // plugin injected — the one the uploaded source maps are filed against.
  ...(release ? { release } : {}),

  // NFR12's ceiling, sat exactly on. Tracing is not decoration here: the spans
  // it creates are what `readTraceContext` reads, so `tracesSampleRate: 0`
  // would take correlation down with it. 1 in development so every local
  // request correlates while someone is looking at it.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,

  /**
   * **The log drain (#9, DD11).** Logs currently go to stdout and nowhere else,
   * which under continuous deployment means real retention is not NFR17's 30
   * days — it is *until the next deploy*, minutes. That makes the log number
   * false and every incident undiagnosable, which is why the drain lands with
   * the first deploy rather than after it.
   *
   * This is the route that adds no vendor (observability go-live runbook §9b):
   * pino's own lines are forwarded to the reporting platform already carrying
   * this deploy's `release` and each request's `trace_id`.
   *
   * **It does not break report-once**, and that is checked rather than assumed:
   * `pinoIntegration`'s `error.levels` defaults to `[]` in 10.70.0, so lines are
   * forwarded as *logs* and do not additionally become *error events*. Setting
   * `error.levels` would opt into one event from `onRequestError` and another
   * from the line it emitted — the exact double-report NFR3 exists to prevent.
   *
   * **Server only.** There is no `enableLogs` on `instrumentation-client.ts`:
   * the drain's job is the server's stdout, and forwarding browser logs would
   * spend a metered allowance (5 GB/month, §3) on lines no drain query reads.
   */
  enableLogs: true,
  integrations: [Sentry.pinoIntegration()],

  // All three hooks, one function — DD3's parity. `beforeSend` alone would
  // leave the other two egresses unscrubbed: transactions ship at the rate
  // above and carry URLs with query strings and span attributes, and
  // breadcrumbs carry whatever the app touched on the way to the error.
  beforeSend: scrubOrDrop,
  beforeSendTransaction: scrubOrDrop,
  beforeBreadcrumb: scrubOrDrop,
});
