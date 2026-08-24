import {
  type ClientError,
  isAppError,
  MAX_ERROR_STATUS,
  MIN_ERROR_STATUS,
  projectClientError,
} from "@repo/errors/app-error";

/**
 * A plain value, deliberately **not** a framework `Response`.
 *
 * Returning one is what lets this package stay dependency-free and work in any
 * handler shape — a Next.js Route Handler, a Hono route, a test. The caller does
 * `Response.json(body, { status, headers })`, or whatever its framework calls
 * that.
 */
export interface ErrorResponse {
  status: number;
  body: ClientError;
  headers: Record<string, string>;
}

const GENERIC_STATUS = 500;

const ERROR_HEADERS: Record<string, string> = {
  "content-type": "application/json",
  // An error body carries a requestId, so it is specific to one request and must
  // never be served to a second one from a shared cache.
  "cache-control": "no-store",
};

/**
 * `status` is validated rather than trusted, for the same reason the string
 * fields are: `isAppError` checks a *registered* symbol, so a value can carry
 * the marker without this package having built it.
 *
 * The range comes from `app-error.ts` because the log line bounds the same field
 * to the same range, reading it off the error rather than calling this.
 */
function copyableStatus(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value)) return undefined;
  if (value < MIN_ERROR_STATUS || value > MAX_ERROR_STATUS) return undefined;
  return value;
}

/**
 * Turns anything a handler caught into a response whose body cannot carry
 * operator prose.
 *
 * Note what this does *not* do: it never calls a method on `error`. A value that
 * passes the identity check may still be a forgery, and invoking its
 * `toClientError` would be running the forger's code. It reads fields and
 * validates each one instead — {@link projectClientError} is the same whitelist
 * `AppError.toClientError()` uses, so the wire egress and the Server Action
 * egress cannot drift apart.
 *
 * A value that fails the identity check produces a generic 500 built from
 * constants, carrying nothing from the original.
 */
export function toErrorResponse(error: unknown): ErrorResponse {
  const status = isAppError(error)
    ? (copyableStatus((error as { status?: unknown }).status) ?? GENERIC_STATUS)
    : GENERIC_STATUS;

  return { status, body: projectClientError(error), headers: { ...ERROR_HEADERS } };
}
