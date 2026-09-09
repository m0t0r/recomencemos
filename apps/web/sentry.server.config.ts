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
  // browser: the wizard-generated config sets this `true`, which widens what
  // reaches a processor nobody here chose for that purpose. Sentry was chosen to
  // receive errors and traces, and `/privacy` names it to the people it concerns
  // on exactly those terms. Pinning the flag is what stops a wizard re-run or an
  // SDK default quietly flipping it.
  //
  // **What `false` actually withholds, read out of the installed SDK rather than
  // assumed.** `defaultPiiToCollectionOptions` in `@sentry/core@10.73.0` maps
  // this flag onto a collection object, and on the `false` branch that object is
  // `userInfo: false`, `httpBodies: []`, `genAI` inputs and outputs off, and
  // `databaseQueryData: false`. Those four are real and are what this line buys.
  //
  // **What it does not withhold — and this comment used to say it did.** Cookies
  // and headers are *not* switched off by it. The same `false` branch maps them
  // to `cookies: { deny: … }` and `httpHeaders: { request: { deny: … } }` —
  // objects, not `false` — so `requestDataIntegration`'s `cookies !== false` test
  // passes and both are assembled onto the event. The deny list those objects
  // carry never runs on the event path at all; it applies only where headers
  // become span attributes. That is why cookies and headers are turned off by
  // name in `integrations` below, and why the correction is written here rather
  // than left for the next reader to re-derive.
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
  integrations: [
    Sentry.pinoIntegration(),

    // **Stop collecting what nothing downstream should have to scrub.** A
    // non-default instance of an integration replaces the default of the same
    // name, and `include` is spread last, so declaring this is enough — nothing
    // needs removing. The event's `request` then arrives as `{ method, url }`.
    //
    // This is the layer *behind* `scrubOrDrop`, not a replacement for it. The
    // scrubber stays the named control at the egress, because it also covers the
    // browser, the breadcrumbs and everything the app itself puts on an event.
    //
    // Cookies are the reason it exists: beside the raw `cookie` header the SDK
    // writes a **parsed map keyed by cookie name**, which no key-name list can
    // match by the names inside it. `@repo/errors` now collapses that carrier
    // whole; this stops it being built at all.
    //
    // Headers go with them. Their deny list never runs on this path, so the
    // referer, the user-agent and the shared-device header shipped verbatim. The
    // cost is real and worth naming: a server event no longer carries a
    // user-agent, so a browser-specific report is harder to place. The browser's
    // own events still carry theirs, and that is where such a bug is diagnosed.
    //
    // **Server only, and that is measured rather than symmetric.**
    // `requestDataIntegration` is not among the browser's defaults and is not on
    // the client entry; the browser's carrier is `httpContextIntegration`, whose
    // request data is `{ url, headers: { Referer, User-Agent } }` and holds no
    // cookie map at all. Declaring this there would be a control that controls
    // nothing while reading in review as though the browser were covered.
    Sentry.requestDataIntegration({ include: { cookies: false, headers: false } }),
  ],

  // All three hooks, one function — DD3's parity. `beforeSend` alone would
  // leave the other two egresses unscrubbed: transactions ship at the rate
  // above and carry URLs with query strings and span attributes, and
  // breadcrumbs carry whatever the app touched on the way to the error.
  beforeSend: scrubOrDrop,
  beforeSendTransaction: scrubOrDrop,
  beforeBreadcrumb: scrubOrDrop,

  // **The fourth egress, and the one that had no hook in front of it.** A log
  // envelope is not an event: it routes through `beforeSendLog` and reaches
  // none of the three above. With `enableLogs` on, every forwarded pino line —
  // the request-completion line included, `context.path` and all — went to the
  // vendor unscrubbed.
  //
  // Same function again, for the reason the other three share it: a second
  // scrubber is a second thing to keep in agreement. `scrubOrDrop` returning
  // `null` drops the line rather than sending it half-scrubbed, which is the
  // behaviour the other hooks already have.
  beforeSendLog: scrubOrDrop,
});
