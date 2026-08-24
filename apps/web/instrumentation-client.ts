/**
 * The browser half of error reporting: the third of the three redaction
 * egresses, and the only one that runs on someone else's machine.
 *
 * This file may import `@repo/errors` and may **not** import
 * `@repo/observability` — that package depends on `pino` and its stream
 * packages, and pulling it onto a `"use client"` path would ship them to every
 * visitor. `scrubEvent` lives in `@repo/errors` precisely so this module can
 * reach it: a scrubber the client cannot import is a redaction list that
 * disagrees with itself by construction.
 */

import { scrubOrDrop } from "@repo/errors/redaction";
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const release = process.env.NEXT_PUBLIC_RELEASE;

/**
 * No DSN, no `init` at all — not `enabled: false`.
 *
 * An empty DSN or a disabled client still installs the tracing provider, the
 * propagator, the context manager and the module-loader hooks on every boot.
 * Not calling `init` is the only clean off-switch, and a template that a person
 * clones without a monitoring account has to take it.
 */
if (dsn) {
  Sentry.init({
    dsn,

    // Explicit rather than inherited. The wizard-generated config sets this
    // `true`, which sends IP address, cookies and headers — every one of them
    // `personal` under `docs/policy/data.md` — to a processor no downstream
    // project chose. It is already `false` by default in 10.70.0; pinning it is
    // what stops a wizard re-run or an SDK default quietly flipping it.
    //
    // Deprecated in favour of `dataCollection`, and **not** migrated on
    // purpose: supplying a `dataCollection` object at all switches the SDK's
    // baseline from the privacy-preserving mapping this flag selects to the
    // permissive defaults (`cookies: true`, request and response headers on,
    // every HTTP body category), so the migration would have to re-state every
    // category to stand still. Revisit when v11 removes the flag.
    sendDefaultPii: false,

    // Same expression the logger's `env` base field uses, so a browser event and
    // a log line describing the same deployment agree on one string rather than
    // on Sentry's own default, which is the literal "production".
    environment: process.env.NODE_ENV,

    // Only when it has a value: the SDK's defaults are spread *under* the
    // options object, so an explicit `undefined` here would overwrite the
    // release the build plugin injected — the one the uploaded source maps are
    // filed against — and leave every event unsymbolicated.
    ...(release ? { release } : {}),

    // NFR12's ceiling, sat exactly on. The free tier drops data rather than
    // billing when the quota is spent, so an over-sampled transaction stream
    // does not cost money — it costs the monitoring for the rest of the month.
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,

    // All three hooks, one function. `beforeSend` alone would leave the other
    // two egresses unscrubbed: transactions ship at the rate above and carry
    // URLs with query strings and span attributes, and breadcrumbs carry
    // whatever the app touched on the way to the error.
    beforeSend: scrubOrDrop,
    beforeSendTransaction: scrubOrDrop,
    beforeBreadcrumb: scrubOrDrop,

    // Session replay and user feedback are absent rather than sampled to zero,
    // so they contribute 0 bytes to the bundle every visitor downloads. Neither
    // is a default integration; not naming them here is the whole mechanism.
  });
}

/**
 * Next calls this on every App Router navigation. Without it the SDK warns and
 * client-side navigation spans are lost. It is safe on the no-DSN path: with no
 * client initialised there is nothing to start a span on, and it no-ops.
 *
 * The disable is a resolver disagreement, not a missing export: `@sentry/nextjs`
 * ships separate client and server builds behind export conditions, and this
 * function exists only in the client one. `tsc` picks the right condition for a
 * browser entry point and accepts it; oxlint's resolver reads the package's
 * default entry, which is the server build.
 */
// oxlint-disable-next-line import/namespace
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
