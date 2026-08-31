/**
 * The one place a **routed** request becomes a log line — the denominator.
 *
 * `log-request-error.ts` is this module's sibling: that one is emitted when a
 * request fails, this one when a request the app routed finishes at all. Without
 * this line an error count cannot be read as a **rate**, so a spike is
 * indistinguishable from a busy Tuesday, and a deploy that broke every route
 * reads as silence rather than as a status distribution.
 *
 * "Routed" rather than "completed" is the whole of
 * {@link shouldEmitCompletionLine}, and it is there because a denominator
 * counting the framework's own asset traffic measures the wrong population — see
 * that function for the three numbers it broke.
 *
 * ## NFR18 — the correlation-loss band
 *
 * Stated here because this line is what makes correlation observable in the
 * first place; the band itself is a property of `trace_id`, which the logger's
 * mixin contributes to every line.
 *
 * - **Metric**: `error`-level lines lacking a `trace_id`, as a share of all
 *   `error`-level lines, counted only **while reporting is active** — with no
 *   DSN nothing initialises, there is no active span, and a missing `trace_id`
 *   is the correct output rather than a defect.
 * - **Normal range**: **≤ 1%**, over a **rolling 1h window**.
 * - **Outside it**: a `needs-triage` issue in this repo, opened by the reporting
 *   platform's webhook — not a preference, but the only destination consistent
 *   with `docs/adr/0001-findings-enter-through-triage.md`.
 * - **It arrives with a drain, not with this module.** Measuring it means
 *   querying collected stdout, and `hosting-target` in
 *   `docs/policy/operability.md` is `UNSET`. Until the go-live check passes, the
 *   band — and NFR5 and NFR17 with it — is unenforceable.
 *
 * Why a band and not a test: the mixin reads the **active** span, and
 * async-context loss after an `await` returns nothing in production and never in
 * a unit test. The band is the only thing that can catch that residue.
 */

import { setAmbientRequestIdReader } from "@repo/errors/ambient-request-id";
import { logger as defaultLogger } from "@repo/observability/logger";
import {
  currentRequestId,
  enterRequestContext,
  newRequestId,
  runInRequestContext,
} from "@repo/observability/request-context";
import { assertServerOnly } from "@repo/observability/server-only";
import { subscribe } from "node:diagnostics_channel";
import type { Logger } from "pino";

assertServerOnly("log-request-complete");

/**
 * `snake_case`, like every field on the line: the line is its own namespace and
 * names what it carries for itself (ADR-0005). They are also the names the
 * logger ticket fixed as a stability contract — every clone's drain queries bind
 * to them and no clone can be migrated by us.
 */
export interface RequestCompletionFields {
  /** The HTTP method, so a per-route status distribution can separate a read from a write. */
  method: string;
  /**
   * The matched route pattern, never the URL — the same meaning `route` carries
   * on an error line, so the two join. `routeOf` is what produces it, and it is
   * `"unknown"` rather than a raw path when nothing matched, so the field stays
   * **bounded**: a drain groups by it, and a hashed asset path would make its
   * cardinality grow with every build.
   */
  route: string;
  /** The HTTP status actually written to the socket. */
  status: number;
  /** Wall-clock milliseconds from request start to response finish, as a whole number. */
  duration_ms: number;
  /**
   * Free-form detail, per the log-line contract. `path` is the concrete
   * request path with its query stripped — what `route` deliberately is not —
   * so `/orders/[id]` stays groupable while `/orders/42` stays debuggable.
   *
   * **It is unbounded past the query strip, and a credential in a path segment
   * therefore reaches the line verbatim.** That is a decision, not an oversight:
   * `docs/adr/0006-name-the-exposure-rather-than-ship-a-heuristic.md`. The
   * project answers `secrets-in-url-paths` in `docs/policy/security.md` and
   * bounds `pathOf` where the answer is yes.
   */
  context?: { path: string };
}

/** What `routeOf` needs of a request, so it can be tested without importing Next. */
export interface CompletedRequest {
  url?: string;
  method?: string;
}

/**
 * Next stores its per-request meta under a symbol, and the description is the
 * only stable handle on it — the symbol itself is not exported.
 */
const META_SYMBOL_DESCRIPTION = "NextInternalRequestMeta";

/** Better than an empty string or a thrown error: it is queryable and it is honest. */
const UNKNOWN_ROUTE = "unknown";

/**
 * Sentinels, named so a drain query can exclude them rather than average them in
 * as a real 0 ms request against a status that no server ever sent. Both are
 * unreachable in practice — see their use sites — and both are here so that if
 * one ever does appear it reads as "not observed" and not as data.
 */
const UNKNOWN_STATUS = 0;
const UNOBSERVED_DURATION_MS = 0;

/**
 * Lowercase, so it cannot be mistaken for a method — every real one is
 * uppercase. Unreachable through `node:http`, which always sets `method`.
 */
const UNKNOWN_METHOD = "unknown";

/** The floor of the HTTP error range: at or above it, a request failed. */
const HTTP_ERROR_STATUS = 400;

/** At or above it, the *server* failed, which is the only case that logs at `error`. */
const HTTP_SERVER_ERROR_STATUS = 500;

const QUERY_OR_HASH = /[?#]/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * **The one framework internal this file depends on, and it is fully guarded.**
 *
 * The matched pattern is not available anywhere public at response-finish time.
 * The obvious candidate — the active span's `next.route` — is attached only to
 * **sampled** spans: measured against a running dev server at this spec's
 * `tracesSampleRate: 0.1`, it was present on 5 of 30 requests. A `route` field
 * that means "pattern" a tenth of the time and "raw path" the rest is worse than
 * one that always means the same thing, and it would silently break both NFR18's
 * band and every per-route status query.
 *
 * So this reads Next's own per-request meta, which carries the pattern on 100%
 * of requests with or without a DSN. Every step is type-checked and any surprise
 * returns `undefined`, so a Next upgrade that moves this costs the field's
 * *precision* — it falls back to the pathname — and never the line, the request,
 * or the build.
 */
function matchedPattern(request: CompletedRequest): string | undefined {
  const symbol = Object.getOwnPropertySymbols(request).find(
    (candidate) => candidate.description === META_SYMBOL_DESCRIPTION,
  );

  if (symbol === undefined) return undefined;

  const meta = (request as Record<symbol, unknown>)[symbol];

  if (!isRecord(meta)) return undefined;

  const match = meta["match"];

  if (!isRecord(match)) return undefined;

  const definition = match["definition"];

  if (!isRecord(definition)) return undefined;

  const pathname = definition["pathname"];

  return typeof pathname === "string" && pathname.length > 0 ? pathname : undefined;
}

/**
 * The fallback, and a redaction site in its own right: a query string is exactly
 * where a password-reset token or an API key ends up, so it is dropped here
 * rather than trusted to the redaction list, whose key-name half cannot see
 * inside a URL. `@repo/errors` grew a second half for NFR19 that can — the same
 * cut, by the same rule — but it scrubs a **processor payload**, not a log line,
 * so this call site is still the one that answers for `context.path`.
 *
 * **The strip stops at the query, and the path itself is returned whole — so a
 * credential carried in a *segment* survives it.** `/reset-password/<token>`,
 * `/i/<token>/accept`, and an unsubscribe link are the conventional shapes, and
 * every one of them reaches `context.path` in full, on every line this module
 * emits. The rule in {@link shouldEmitCompletionLine} narrows *how many* paths
 * that is — an unrouted success now leaves no line at all — and narrows nothing
 * about the exposure: a tokened route is a routed request, which is the
 * population that always emits. That is deliberate and is the decision, not the
 * oversight it looks like: this is where
 * a project bounds the path, and
 * `docs/adr/0006-name-the-exposure-rather-than-ship-a-heuristic.md` is why the
 * template does not. Answer `secrets-in-url-paths` in `docs/policy/security.md`
 * first; the go-live runbook's §10 is the recipe.
 */
function pathnameOf(url: string | undefined): string {
  if (typeof url !== "string" || url.length === 0) return UNKNOWN_ROUTE;

  const pathname = url.split(QUERY_OR_HASH, 1)[0];

  return pathname !== undefined && pathname.length > 0 ? pathname : UNKNOWN_ROUTE;
}

/**
 * The route pattern for a completed request, or `"unknown"`.
 *
 * **Deliberately not the path when nothing matched.** The subscription hears
 * every HTTP server in the process, not only the app's router: build assets,
 * dev-only endpoints, and anything else a downstream project mounts all reach
 * it. Falling back to the raw pathname there would put
 * `/_next/static/chunks/page-<hash>.js` — a value that changes every build — in
 * the one field a drain groups by, which is the cardinality explosion `route`'s
 * own contract exists to prevent. The concrete path is not lost; it travels
 * under `context.path`, where free-form detail belongs.
 *
 * **`"unknown"` is also the emission rule's input**, which is why that rule
 * needs no pattern of its own: this answer already is the router's, so
 * {@link shouldEmitCompletionLine} reads it rather than matching on a path.
 *
 * Never throws. This runs on the response-finish path of every request the
 * server handles, so a throw here would be a logging bug that takes out request
 * handling.
 */
export function routeOf(request: CompletedRequest): string {
  return matchedPattern(request) ?? UNKNOWN_ROUTE;
}

/**
 * The concrete request path, query stripped. High-cardinality by nature, which
 * is why it belongs under `context` and not beside `route`.
 */
export function pathOf(request: CompletedRequest): string {
  return pathnameOf(request.url);
}

/**
 * Whether a completed request belongs on the line at all.
 *
 * **The measurements are what this exists for, and the volume is only the
 * symptom.** The subscription hears every HTTP server in the process rather than
 * the app's router, so before this rule one dev page load emitted 2 routed lines
 * to roughly 55 unrouted ones — Turbopack chunks, HMR, a favicon, every one of
 * them a 304 at 1–5 ms. Three things follow, and none is cosmetic. p95 read off
 * this line sat at chunk latency permanently, so the page latency the objective
 * is about never appeared in it. The error *rate* this line exists to be the
 * denominator of was diluted about 30:1, so a route failing on every single
 * request read as roughly 2%. And `route: "unknown"` became one bucket holding
 * 96% of traffic, which makes grouping by it say almost nothing.
 *
 * That is production behaviour, not a dev-console annoyance: the deployment
 * target is one machine with no CDN and no `assetPrefix`, so Node serves the
 * static chunks there too.
 *
 * **The cut is `routeOf`'s existing answer, not a `/_next/` prefix match.** The
 * router already tells us whether it matched, so the signal is structural and
 * there is no pattern to keep up to date. A path denylist would be exactly the
 * heuristic `docs/adr/0006-name-the-exposure-rather-than-ship-a-heuristic.md`
 * argues against, shipped into the one field a drain groups by.
 *
 * **The `status >= 400` clause is not there for 404s.** A 404 is routed — Next's
 * per-request meta matches a real pattern for it — so it emits either way. The
 * clause is there so an unrouted *failure* still leaves a line: an asset 5xx, or
 * a request the router never reached.
 */
export function shouldEmitCompletionLine(route: string, status: number): boolean {
  return route !== UNKNOWN_ROUTE || status >= HTTP_ERROR_STATUS;
}

/**
 * `logger` is a defaulted parameter rather than mutable module state — the same
 * injection point `logRequestError` uses, and the effort's one concession to
 * testability. Production calls this with one argument and never learns the seam
 * is there.
 *
 * Neither correlator is a parameter, and for the same reason. The active span is
 * still resolvable on the response-finish path and the request store is
 * re-entered around this call, so the logger's own mixin contributes `trace_id`,
 * `span_id` and `request_id` exactly as it does to every other line. Passing one
 * explicitly would give this one line a second, divergent way of correlating.
 *
 * **The level is read off `status` rather than passed**, so the two cannot
 * disagree — a completion line that says `error` about a 200 is a line an
 * operator learns to stop trusting. A 5xx is the server failing and logs at
 * `error`; everything else, 4xx included, logs at `info`, because a 401 or a 422
 * is the system correctly saying no and `status` is already the field that says
 * which. The `warn` version of this was proposed to keep the correlation band's
 * denominator still and is backwards: these lines carry `trace_id`, so they
 * enlarge a denominator of *correlated* lines and loosen the band rather than
 * break it — and it gains coverage, because a **handled** 5xx logs at `warn`
 * under "thrown is reported, returned is logged" and the band could not see it
 * at all.
 */
export function logRequestComplete(
  fields: RequestCompletionFields,
  logger: Logger = defaultLogger,
): void {
  const level = fields.status >= HTTP_SERVER_ERROR_STATUS ? "error" : "info";

  logger[level](fields, "request complete");
}

/**
 * What the start of a request knows and its finish needs.
 *
 * Keyed by the request object itself, so a dropped connection cannot leak an
 * entry — nothing has to remember to clean up after an aborted request.
 *
 * `requestId` is held here as well as in the async store, and that is not
 * belt-and-braces: see {@link subscribeRequestCompletion} for the keep-alive
 * case where the store in scope at `finish` belongs to a *different* request.
 */
interface RequestStart {
  startedAt: number;
  requestId: string;
}

const requestStart = new WeakMap<object, RequestStart>();

/**
 * The guard lives on `globalThis`, not in module scope, because a re-evaluated
 * module gets a *fresh* module scope while its previous subscription is still
 * registered. That is the one shape of double-subscription a module-level flag
 * cannot see, and the one that would turn NFR17's "exactly 1" into two.
 */
const SUBSCRIBED = Symbol.for("repo.observability.requestCompletionSubscribed");

/**
 * Subscribe the completion line to the process's HTTP traffic. Idempotent.
 *
 * It hears every HTTP server in the process, which is why the emit is filtered
 * by {@link shouldEmitCompletionLine} rather than unconditional — and why the
 * `request_id` this mints is per **publish** rather than per span: it exists
 * with no DSN, which is every fresh clone and every dev session, and it is
 * correct in the one case a `trace_id` was observed to be wrong (a dev-only
 * overlay request sharing one with the request that triggered it).
 *
 * **Why `diagnostics_channel` and not a span.** Next 16 exposes exactly two
 * instrumentation hooks — `register` and `onRequestError` — and neither fires on
 * a request that succeeds. The alternatives were measured against a running dev
 * server rather than reasoned about:
 *
 * - An OpenTelemetry span end (`onEnd`, or the SDK's `spanEnd`) is disqualified.
 *   The sampler returns `NOT_RECORD` for unsampled spans and their `onEnd` never
 *   runs, so at this spec's `tracesSampleRate: 0.1` roughly nine in ten
 *   production requests would emit **no line at all** — and a fresh clone with no
 *   DSN would emit none ever, because nothing initialises.
 * - `node:diagnostics_channel` fired **exactly once per completed request** in
 *   every configuration tried: 30/30 sequential, 25/25 concurrent, and with no
 *   DSN present. It is Node core, so it costs no dependency and is indifferent to
 *   whether reporting is switched on.
 *
 * **This module is why the subscription lives in the package rather than in
 * `instrumentation.ts`.** Next compiles that file for both runtimes, and a
 * `node:diagnostics_channel` specifier sitting in it — even behind a runtime
 * guard and even inside a dynamic `import` — makes the edge bundler emit
 * "A Node.js module is loaded which is not supported in the Edge Runtime" on
 * every build. `@repo/observability` maps its `browser` export condition to
 * `browser-refusal.ts`, so importing this from there resolves the whole module
 * away in the edge bundle and the specifier is never seen. Keeping a clone's
 * build free of warnings is NFR1; this is the seam that does it.
 */
export function subscribeRequestCompletion(logger: Logger = defaultLogger): void {
  const flags = globalThis as unknown as Record<symbol, boolean | undefined>;

  if (flags[SUBSCRIBED] === true) return;

  flags[SUBSCRIBED] = true;

  // **Here rather than at module scope**, because this is the one function that
  // knows requests are being tracked at all — before it runs there is no store to
  // read and adoption would have nothing to adopt. It is what makes an `AppError`
  // raised inside a request carry that request's id, so its `warn`/`error` line
  // and this completion line join, and so a user quoting one reference number
  // gets every line the request emitted rather than one of them.
  setAmbientRequestIdReader(currentRequestId);

  subscribe("http.server.request.start", (message) => {
    const { request } = message as { request?: object };

    if (request === undefined) return;

    const requestId = newRequestId();

    requestStart.set(request, { startedAt: performance.now(), requestId });

    // `enterWith` rather than `run`, because a channel subscriber is handed a
    // message and returns — there is no continuation to wrap. It is what makes
    // `request_id` reach every line the handler itself emits, which is the half
    // of this that `trace_id` cannot do with no DSN configured.
    enterRequestContext(requestId);
  });

  subscribe("http.server.response.finish", (message) => {
    const { request, response } = message as {
      request?: CompletedRequest;
      response?: { statusCode?: number };
    };

    if (request === undefined || response === undefined) return;

    const started = requestStart.get(request);

    requestStart.delete(request);

    const route = routeOf(request);
    const status = response.statusCode ?? UNKNOWN_STATUS;

    if (!shouldEmitCompletionLine(route, status)) return;

    // `started` is absent only for a request already in flight when the
    // subscription was made. `register()` completes before the server accepts
    // its first request, so that window does not exist in practice — the
    // fallbacks keep the line rather than swallowing it, and a line with no
    // `request_id` is honest where a freshly minted one would be a lie.
    const emit = () =>
      logRequestComplete(
        {
          method: request.method ?? UNKNOWN_METHOD,
          route,
          context: { path: pathOf(request) },
          status,
          duration_ms:
            started === undefined
              ? UNOBSERVED_DURATION_MS
              : Math.round(performance.now() - started.startedAt),
        },
        logger,
      );

    // **Re-entering the store is correctness, not caution.** `enterWith` mutates
    // the *current* execution context, and on a keep-alive socket every request
    // shares one — so request N+1's start can overwrite the context request N's
    // `finish` would otherwise read, and the completion line would carry the
    // wrong id. Keying off the request object is what makes that impossible, and
    // it is why the id is held in the `WeakMap` rather than only in the store.
    if (started === undefined) emit();
    else runInRequestContext(started.requestId, emit);
  });
}
