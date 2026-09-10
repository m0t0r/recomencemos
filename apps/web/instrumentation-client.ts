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
 *
 * **The SDK is imported dynamically, and that is the whole point of the file's
 * shape** (#157). A static `import * as Sentry from "@sentry/nextjs"` here puts
 * the SDK in the entry graph of *every* route, so the prerendered document asks
 * for it before the page is interactive. Worth **85 KB gzip of the 292 KB `/`
 * shipped on #157's build**,
 * which a Worker on a metered phone downloaded before reading a word of the
 * Wall. The SDK is not misconfigured — no Replay, no Feedback, no profiling,
 * `excludeDebugStatements` already on — so configuration had nothing left to
 * give and only *when* it loads was left.
 *
 * **That is the marginal figure, and it is not the 148 KB the ticket was written
 * from.** 148 KB is the size of the SDK's own chunk, and most of what shares
 * that chunk is code the page needs whether or not the SDK is there — so
 * deferring re-chunks rather than deletes. Taken the honest way, by measuring a
 * build with the SDK removed outright: on #157's build `/` was 292 KB gzip with
 * it, 207 KB without, and 208 KB with it deferred. Those are that tree's figures and
 * not this one's — `pnpm page-weight` re-takes them, and `README.md` carries the
 * current one.
 *
 * Nothing about what is reported changes. Every option below is the one that was
 * here before, all three redaction hooks included; the module that carries them
 * simply arrives on an idle callback after `load` instead of in front of the
 * first paint.
 */

import { scrubOrDrop } from "@repo/errors/redaction";

import { attachReporter, bufferThrown } from "./lib/report-client-error";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const release = process.env.NEXT_PUBLIC_RELEASE;

/**
 * The loaded module, once it is here. Read by `onRouterTransitionStart` below,
 * which the framework calls synchronously and which therefore cannot await it.
 */
let sentry: typeof import("@sentry/nextjs") | undefined;

/**
 * **The gap is closed rather than accepted, and this is the cheapest thing that
 * closes it.** Between this module evaluating and the SDK arriving there is a
 * window — short, but exactly the window a bug in the app's own boot code falls
 * into, which is the class of bug worth hearing about most. Two listeners
 * installed synchronously hold what is thrown, and the SDK replays it.
 *
 * **The buffer itself is `report-client-error.ts`'s**, which is also where the
 * error boundaries report from. One buffer and one drain, because that module
 * is already the single browser report site and two of them would make the
 * five-event limit a limit per source rather than a limit.
 */
function onError(event: ErrorEvent): void {
  // `event.error` is absent for a cross-origin script error, where the browser
  // gives the listener a bare message and nothing else. Reporting the message is
  // worth more than reporting nothing, and it is what the SDK's own global
  // handler does with the same event.
  bufferThrown(event.error ?? event.message);
}

function onRejection(event: PromiseRejectionEvent): void {
  bufferThrown(event.reason);
}

/**
 * How long to wait for an idle callback before taking the browser's word for it
 * that there will not be one. A page that never goes idle is a page whose
 * monitoring would otherwise never load.
 */
const IDLE_TIMEOUT_MS = 2_000;

function whenIdle(run: () => void): void {
  const schedule = () => {
    // Present in every engine inside the supported floor except Safari before
    // 18.4, which is inside that floor but not below it — so the timeout is a
    // real path on a real browser, not defensive padding.
    //
    // `typeof` rather than `"requestIdleCallback" in window`, which `tsc`
    // narrows to `never` in the else branch: the DOM lib declares the method
    // unconditionally, so the type system believes every browser has it and the
    // fallback is unreachable code. It is the runtime that disagrees.
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS });
    } else {
      window.setTimeout(run, 0);
    }
  };

  // The module can evaluate either side of `load`, and a `load` listener added
  // afterwards never fires — which would leave the SDK permanently unloaded on
  // exactly the slow connections it exists to report from.
  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule, { once: true });
}

async function loadSentry(): Promise<void> {
  const Sentry = await import("@sentry/nextjs");

  // **Before `init`, not after.** `init` installs the SDK's own `error` and
  // `unhandledrejection` handlers, so a surviving listener of ours would hold a
  // copy of every later error and there is no moment at which both should be
  // live.
  window.removeEventListener("error", onError);
  window.removeEventListener("unhandledrejection", onRejection);

  Sentry.init({
    dsn,

    // Explicit rather than inherited. The wizard-generated config sets this
    // `true`, which sends IP address, cookies and headers — every one of them
    // `personal` under `docs/policy/data.md` — to a processor nobody here chose
    // for that purpose. Sentry was chosen to receive errors and traces, and
    // `/privacy` names it to the people it concerns on exactly those terms;
    // `sendDefaultPii` would widen that silently. It is already `false` by
    // default in 10.70.0; pinning it is what stops a wizard re-run or an SDK
    // default quietly flipping it.
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
    //
    // **Deferring the SDK does not weaken any of the three.** They are options
    // on the same `init` call, so every event this client ever sends — the
    // replayed ones below included — passes through the same function it did
    // when the import was static.
    beforeSend: scrubOrDrop,
    beforeSendTransaction: scrubOrDrop,
    beforeBreadcrumb: scrubOrDrop,

    // Session replay and user feedback are absent rather than sampled to zero,
    // so they contribute 0 bytes to the bundle every visitor downloads. Neither
    // is a default integration; not naming them here is the whole mechanism.
  });

  sentry = Sentry;

  // Hands the report site the SDK, which drains everything held above — and
  // everything an error boundary held, which is the other half of the same
  // window. After this call an error boundary reports synchronously again and
  // shows its reference.
  attachReporter(Sentry);
}

/**
 * No DSN, no `init` at all — not `enabled: false`.
 *
 * An empty DSN or a disabled client still installs the tracing provider, the
 * propagator, the context manager and the module-loader hooks on every boot.
 * Not calling `init` is the only clean off-switch, and a project running with no
 * monitoring account has to take it.
 *
 * With the import behind this branch too, a deployment with no DSN now also
 * downloads none of the SDK, and buffers nothing there would be anywhere to
 * replay into.
 */
if (dsn) {
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);

  whenIdle(() => {
    // **Swallowed deliberately, and it is the one path with no channel.** A
    // failed chunk fetch means there is no SDK to report the failure to, and the
    // only surface left is the visitor's console, which is not ours to write to.
    // What it looks like from the outside is silence in the reporting platform,
    // which is also what a broken DSN looks like — and the fix for both is to
    // check that the release deployed.
    loadSentry().catch(() => {});
  });
}

/**
 * Next calls this on every App Router navigation. Without it the SDK warns and
 * client-side navigation spans are lost.
 *
 * **It is a wrapper rather than a re-export because the framework's call is
 * synchronous and the SDK is not here yet.** The export has to exist from the
 * moment this module evaluates, so what is exported is a function that forwards
 * once there is something to forward to. Before then it does nothing and says
 * nothing: the vendor's own `captureRouterTransitionStart` already no-ops when
 * no handler is registered, so a navigation during the loading window costs its
 * span and produces no warning either way.
 *
 * The same is true on the no-DSN path, where nothing is ever assigned and this
 * stays a no-op for the life of the page.
 */
export function onRouterTransitionStart(href: string, navigationType: string): void {
  sentry?.captureRouterTransitionStart(href, navigationType);
}

/**
 * **What the deferral costs, named here rather than found later.** The pageload
 * transaction is started by a client that initialises after `load`, so its web
 * vitals are whatever the browser will still hand over at that point rather than
 * a complete set. Navigation spans — every transition after the first idle
 * callback — are unaffected, and so is every error the app throws once it is
 * running. That trade is the ticket: complete monitoring of a page a third of
 * whose bytes are the monitoring is not the better deal on a metered phone.
 */
