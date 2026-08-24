/**
 * The worked example: one handler, two branches, and the spec's central rule
 * made visible — **thrown is reported, returned is logged**.
 *
 * Read it against a running `next dev` rather than against a test file. Hit
 * both branches and watch stdout:
 *
 * ```sh
 * curl -s 'http://localhost:3000/api/example-error'             # handled  → 1 warn line, no event
 * curl -s 'http://localhost:3000/api/example-error?mode=thrown' # rethrown → 1 error line + event id
 * ```
 *
 * `LOG_FORMAT=json pnpm dev` makes those lines countable with `grep`.
 *
 * This is scaffolding a downstream project deletes — it has a row in the
 * README's placeholder table. Delete the folder; nothing else refers to it.
 */

import { AppError } from "@repo/errors/app-error";
import { toErrorResponse } from "@repo/errors/error-response";
import { logRequestError } from "@repo/observability/log-request-error";

/**
 * The matched pattern, written out because a Route Handler receives a Web
 * `Request` and `routeOf` reads Next's per-request meta off the Node request the
 * completion subscription sees. It is the pattern and never the URL: `route` is
 * what a drain groups by, so it stays bounded.
 */
const ROUTE = "/api/example-error";

const THROWN = "thrown";
const HANDLED = "handled";

/**
 * The two-valued branch selector, narrowed from the query string to one of two
 * constants **before** it reaches anything that gets logged.
 *
 * The narrowing is the point, not ceremony. A query parameter is inbound text,
 * and interpolating it into operator prose or dropping it into `context` would
 * put an attacker's newlines into the pretty development stream an agent reads
 * — the same log-injection path `AppError` closes by minting `requestId` itself
 * rather than accepting one. Anything unrecognised is the handled branch.
 */
function modeOf(request: Request): typeof THROWN | typeof HANDLED {
  return new URL(request.url).searchParams.get("mode") === THROWN ? THROWN : HANDLED;
}

export function GET(request: Request): Response {
  const mode = modeOf(request);

  const failure = new AppError({
    code: "example_failure",
    // Operator-facing, and deliberately the kind of sentence you would not want
    // a stranger reading — so the response body below can be checked for its
    // absence.
    message: `The worked example failed on purpose in ${mode} mode; nothing is wrong with the app.`,
    // The only string permitted to reach a browser.
    userMessage: "We could not complete that. Please try again.",
    status: 422,
    // An enum value, which is what CLAUDE.md's "Logging and errors" section
    // permits here.
    context: { mode },
  });

  // Decision point 1 — **rethrown**. Letting the error escape is the whole
  // gesture: it reaches `onRequestError` in `instrumentation.ts`, which is the
  // single server report site, and produces exactly one event and exactly one
  // `error` line carrying that event's id. Nothing here names the reporter.
  if (mode === THROWN) throw failure;

  // Decision point 2 — **handled and returned**. This error never escapes, so
  // it never reaches the report site: one `warn` line, no event, and no quota
  // spent. `level: "warn"` is what says the failure was handled.
  logRequestError(failure, { level: "warn", route: ROUTE });

  // `toErrorResponse` returns a plain value rather than a `Response`, so the
  // framework call is here, in the framework's file. The body it builds is the
  // three-key whitelist — see `@repo/errors/error-response`.
  const { status, body, headers } = toErrorResponse(failure);

  return Response.json(body, { status, headers });
}
