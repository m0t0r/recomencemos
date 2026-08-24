/**
 * The one place a request failure becomes a log line.
 *
 * The report site calls this after reporting, so the line can carry the event
 * id; a handled error returned through `toErrorResponse` calls it at `warn` with
 * no event id. Which of the two happened is the only quota lever in the design,
 * so it is a parameter here rather than something inferred.
 */

import {
  GENERIC_ERROR_CODE,
  isAppError,
  MAX_CODE_LENGTH,
  MAX_ERROR_STATUS,
  MAX_REQUEST_ID_LENGTH,
  MIN_ERROR_STATUS,
} from "@repo/errors/app-error";
import { logger as defaultLogger } from "@repo/observability/logger";
import type { Logger } from "pino";

const GENERIC_STATUS = 500;

/**
 * These names **are** the line: there is no mapping layer between this shape and
 * what a drain indexes, which is the same reason the trace mixin's output is
 * used as it comes.
 *
 * `snake_case`, like every field on the line. The line is its own namespace and
 * names what it carries for itself, whatever the source called it — ADR-0005 —
 * which is why the field lifted from `AppError.requestId` below reaches the line
 * as `request_id`.
 */
export interface RequestErrorFields {
  /**
   * `error` for a failure that was thrown and reported, `warn` for one returned
   * through `toErrorResponse`. Defaults to `error`.
   */
  level?: "error" | "warn";
  /** The matched route pattern, not the URL — a URL is high-cardinality and may carry secrets. */
  route?: string;
  /**
   * Overrides the status carried by the error, for a handler that changed it.
   *
   * Held to the same predicate as the error's own, and an unusable one falls
   * back to the error's status rather than to the generic: the three sources are
   * tried in order of specificity and the first usable one wins, so a caller's
   * slip cannot cost a status the error carried correctly. TypeScript already
   * bars a non-number here, which leaves `NaN` — a `number` that JSON renders as
   * `null` — as the value this actually catches.
   */
  status?: number;
  /** The reporting platform's id for this failure. Absent when nothing was reported. */
  event_id?: string;
  /** Free-form operator detail. Redacted by key name like every other `context`. */
  context?: Record<string, unknown>;
}

/**
 * The fields lifted to the top of the line. One reader, because they are read
 * the same way.
 *
 * `requestId` is optional where the other two are not, and the asymmetry is the
 * design: `code` and `status` have a meaningful generic — an unidentifiable
 * failure really is an `internal_error` and really is a 500 — while a *generic*
 * correlation id is a lie a query would match on. So an unusable value costs the
 * field rather than substituting one.
 */
interface ErrorIdentity {
  code: string;
  status: number;
  requestId?: string;
}

const GENERIC_IDENTITY: ErrorIdentity = { code: GENERIC_ERROR_CODE, status: GENERIC_STATUS };

/**
 * Whether a claimed `requestId` is fit to publish: a non-empty string within the
 * bound, or nothing.
 *
 * All three checks exist for the forged case, not the honest one —
 * `crypto.randomUUID()` is 36 characters and nothing here mints anything else.
 * That makes this the same predicate the client projection applies to the same
 * field, deliberately **restated rather than shared**: what must not drift is the
 * bound, which is imported, and the whole point of ADR-0005 is that this side
 * *reads* the error rather than calling into it. A shared validator would be one
 * more thing the line asks `@repo/errors` for.
 */
function usableRequestId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (value.length === 0 || value.length > MAX_REQUEST_ID_LENGTH) return undefined;

  return value;
}

/**
 * Whether a claimed `status` is fit to publish: an integer inside the HTTP error
 * range, or nothing.
 *
 * `Number.isInteger` earns its place twice over. It rejects `200.5`, and it
 * rejects `NaN` and `Infinity` — `number`s that JSON renders as `null`, which is
 * both a value the wire refuses for the same error and a value a drain typing
 * this field as an integer chokes on. A bare `typeof` check admits all three.
 *
 * Restated rather than shared, for the reason {@link usableRequestId} gives:
 * what must not drift is the range, which is imported.
 */
function usableStatus(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value)) return undefined;
  if (value < MIN_ERROR_STATUS || value > MAX_ERROR_STATUS) return undefined;

  return value;
}

/**
 * Whether a claimed `code` is fit to publish: a non-empty string within the
 * bound the browser projection applies to the same field.
 *
 * Same shape and same reasoning as {@link usableRequestId}, and it differs only
 * in what an unusable value costs — the field's generic rather than the field
 * itself, because `internal_error` is a true statement about an unidentifiable
 * failure where a generic correlation id would be a lie.
 */
function usableCode(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (value.length === 0 || value.length > MAX_CODE_LENGTH) return undefined;

  return value;
}

/**
 * Reads the lifted fields off the error rather than asking the error for them.
 *
 * The serialiser in `logger-options.ts` calls `toOperatorJSON()` and gets two of
 * these back among the five, so it would be reasonable to expect this to reuse
 * it. It deliberately does not: `isAppError` checks a *registered* symbol, so a
 * value can carry the marker without this package having built it, and invoking
 * a method to obtain top-level query fields would mean running a forger's code
 * twice per line instead of once. Reading and validating the fields is the
 * cheaper and narrower job, and a forgery costs the generic pair.
 *
 * What each field is validated *against* is the wire's standard, not a looser
 * one of this module's own: a guarantee that holds at one egress and not the
 * other is a guarantee that does not hold.
 *
 * `requestId` is the case that makes the point unavoidable rather than merely
 * economical: the projection no longer carries it at all (ADR-0005), so there is
 * nothing to reuse even if reuse were safe.
 */
function identityOf(error: unknown): ErrorIdentity {
  if (!isAppError(error)) return GENERIC_IDENTITY;

  const candidate = error as { code?: unknown; status?: unknown; requestId?: unknown };
  const requestId = usableRequestId(candidate.requestId);

  return {
    code: usableCode(candidate.code) ?? GENERIC_ERROR_CODE,
    status: usableStatus(candidate.status) ?? GENERIC_STATUS,
    ...(requestId === undefined ? {} : { requestId }),
  };
}

/**
 * `logger` is a defaulted parameter rather than mutable module state, and it is
 * the effort's one concession to testability: a test hands in an instance built
 * over an in-memory stream, and production code calls this with two arguments
 * and never learns the seam exists.
 *
 * `code`, `status` and `requestId` are lifted to the top level deliberately. A
 * 4xx never reaches the reporting platform — thrown is reported, returned is
 * logged — so the log line is the only place a credential-stuffing run or a
 * mass-401 after an auth change is visible, and it is visible only if those
 * fields are queryable without parsing `err`.
 *
 * `request_id` is the strongest case of the three, and the last to be made. It
 * is one of exactly three keys the browser is permitted to see, so it is the
 * string a user reads off a response and quotes in a support ticket — and on
 * this returned path there is no `event_id`, and with no DSN configured no
 * `trace_id`, which makes it the only correlator the line has.
 *
 * It reaches the line as `request_id` though `AppError` spells the property
 * `requestId`: the line is `snake_case` throughout and names its own fields
 * (ADR-0005). The price is real and worth stating — the browser receives
 * `requestId`, so one identifier has two spellings across that hop, and a
 * support engineer has to know the log field is the `snake_case` one. What they
 * never have to do is translate a *value*.
 */
export function logRequestError(
  error: unknown,
  fields: RequestErrorFields = {},
  logger: Logger = defaultLogger,
): void {
  const { level = "error", status, ...rest } = fields;
  const { code, status: errorStatus, requestId } = identityOf(error);

  // Each lifted field is named rather than spread from a rest bucket. A bucket
  // would put whatever `ErrorIdentity` grows next onto the line silently, and
  // the decision to publish a field belongs here rather than in a type.
  logger[level](
    {
      ...rest,
      ...(requestId === undefined ? {} : { request_id: requestId }),
      code,
      status: usableStatus(status) ?? errorStatus,
      err: error,
    },
    "request error",
  );
}
