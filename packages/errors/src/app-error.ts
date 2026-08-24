/**
 * The one error type. Five fields plus a cause, and a hard split between what an
 * operator may read and the single string permitted to reach a browser.
 */

/**
 * Identity is a **registered** symbol rather than a prototype check, because
 * Next.js compiles the server and the client graph as separate realms and
 * `instanceof` does not survive that.
 *
 * A registry is shared, so this marker makes {@link isAppError} a *claim*, not a
 * proof: anything can call `Symbol.for` with the same string. That is why every
 * projection re-validates the fields it copies instead of trusting the check.
 */
const APP_ERROR_MARKER = Symbol.for("@repo/errors:AppError");

/**
 * The string a browser sees when the caller supplies none.
 *
 * `userMessage` defaults to this and **never** to `message`. Defaulting to the
 * operator message is the single mistake that turns this design into a leak, so
 * there is deliberately no code path from one to the other.
 */
export const DEFAULT_USER_MESSAGE = "Something went wrong. Please try again.";

/**
 * Everything that is not one of the five named fields.
 *
 * One container rather than a flat/nested pair: a caller choosing between two
 * containers with no stated rule chooses by coin flip. It is `internal` at most
 * — identifiers, counts, enum values, truncated inputs — and a `secret` never
 * enters it. Redaction reaches known key names to a bounded depth, so nothing
 * unclassified belongs here.
 */
export type AppErrorContext = Record<string, unknown>;

/** The whitelist a browser is allowed to see. Exactly three keys, always. */
export interface ClientError {
  code: string;
  message: string;
  requestId: string;
}

/**
 * The operator shape, for the log line. Never reaches a browser.
 *
 * `requestId` is deliberately absent, and its absence is ADR-0005: the log line
 * lifts that field to its own top level instead — as `request_id`, because the
 * line names its own fields — read off the error rather than obtained from here. Publishing it in both places would give a reader two
 * answers to "where do I look", and the answer drifts the first time one of the
 * two is trimmed. It is still in {@link ClientError} — that is the whole reason
 * it is worth lifting.
 */
export interface OperatorError {
  code: string;
  status: number;
  message: string;
  userMessage: string;
  context: AppErrorContext;
}

/** The code a projection falls back to when it has nothing it is willing to copy. */
export const GENERIC_ERROR_CODE = "internal_error";

/**
 * The ceiling on the one field only the browser projection bounds. It exists for
 * the forged-value case, not the honest one: `isAppError` is a claim, so a
 * projection bounds what it copies rather than trusting the source.
 *
 * It is private where the bounds below are exported, and the rule that
 * sorts them is the number of egresses: a field bounded in one place keeps its
 * number there, and a field bounded in two publishes it, because one exported
 * number is the only thing that stops two bounds drifting apart.
 */
const MAX_USER_MESSAGE_LENGTH = 300;

/**
 * Exported because `code` has **two** egresses that bound it: the browser
 * projection below, and the log line, which lifts the field to its own top level
 * and validates what it copies for the same forged-value reason.
 *
 * The bound is shared; the validation is not. The line reads the field rather
 * than calling a projection — precisely the difference ADR-0005 turns on — so it
 * restates the predicate over this number instead of importing one.
 */
export const MAX_CODE_LENGTH = 64;

/**
 * Exported for the same reason, and for the same pair of readers: the wire body
 * below, and the log line, which lifts `requestId` to its top level and bounds
 * what it copies there.
 */
export const MAX_REQUEST_ID_LENGTH = 64;

/**
 * The range a claimed `status` must fall within to be published, inclusive at
 * both ends — an HTTP error status and nothing else.
 *
 * Two readers again, and this is the pair where the two egresses actually
 * disagreed: the wire enforced the range while the log line accepted any
 * `number`, so a forged carrier left the wire as a generic 500 and reached the
 * line as `null`, `-1`, or `200.5`. The numbers live here rather than beside the
 * wire's projection because `status` is a field of this type and both readers
 * already import from this module — a log line importing from `error-response`
 * would be saying the line is a wire, which it is not.
 */
export const MIN_ERROR_STATUS = 400;
export const MAX_ERROR_STATUS = 599;

function copyableString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  if (value.length === 0 || value.length > maxLength) return undefined;
  return value;
}

export interface AppErrorOptions {
  /** A free-form machine code. No taxonomy ships; a project invents its own. */
  code: string;
  /** HTTP status. Defaults to 500. */
  status?: number;
  /** Operator-facing English. Never reaches a browser. */
  message: string;
  /** The only string permitted to reach a browser. Defaults to {@link DEFAULT_USER_MESSAGE}. */
  userMessage?: string;
  /** Structured operator detail. See {@link AppErrorContext}. */
  context?: AppErrorContext;
  /** Carried for the log line's error serialiser. Appears in neither projection. */
  cause?: unknown;
}

/**
 * `crypto.randomUUID` is absent in a browser outside a secure context, and this
 * package is isomorphic — so a Client Component constructing an `AppError` over
 * plain HTTP would throw on the one code path that exists to report failure.
 *
 * It degrades to an empty string rather than throwing, and rather than reaching
 * for a weaker generator: an id minted in a browser is not a *server* request id
 * and correlates with nothing, so inventing one would be worse than admitting
 * there isn't one.
 */
function mintRequestId(): string {
  return typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : "";
}

export class AppError extends Error {
  readonly [APP_ERROR_MARKER] = true;

  readonly code: string;
  readonly status: number;
  readonly userMessage: string;
  readonly context: AppErrorContext;

  /**
   * Generated here with `crypto.randomUUID()` and deliberately **not** a
   * constructor option, so there is no parameter an inbound header could be
   * threaded into. That closes the log-injection path into the pretty
   * development stream an agent reads. Correlating one diagnostic with another
   * is `trace_id`'s job, not this field's.
   */
  readonly requestId: string;

  constructor(options: AppErrorOptions) {
    super(options.message, options.cause === undefined ? undefined : { cause: options.cause });

    this.name = "AppError";
    this.code = options.code;
    this.status = options.status ?? 500;
    this.userMessage = options.userMessage ?? DEFAULT_USER_MESSAGE;
    this.context = options.context ?? {};
    this.requestId = mintRequestId();
  }

  /**
   * The operator projection, built field by field from a whitelist rather than
   * by omission. A deny-list would mean the next field added to this type leaks
   * by default; with a whitelist it reaches no egress until someone writes it
   * into one.
   *
   * `cause` is absent deliberately. The log line's error serialiser is the only
   * thing that walks it, and it applies redaction on the way.
   */
  toOperatorJSON(): OperatorError {
    return {
      code: this.code,
      status: this.status,
      message: this.message,
      userMessage: this.userMessage,
      context: this.context,
    };
  }

  /**
   * The browser projection — the Server Action and RSC-payload egress, and what
   * `toErrorResponse` puts on the wire. Delegates to {@link projectClientError}
   * so both egresses share one whitelist and cannot drift apart.
   */
  toClientError(): ClientError {
    return projectClientError(this);
  }
}

/**
 * A claim that `value` is an {@link AppError}, checked against the registered
 * symbol. Callers that go on to publish anything from `value` must validate what
 * they copy — see {@link projectClientError}.
 *
 * **Read this before calling a method on a value this narrowed.** TypeScript
 * accepts `value.toOperatorJSON()` the moment this returns true, and the check
 * is a claim rather than a proof, so that call can run a forger's code and log
 * whatever it returns. The wire egress avoids it by reading fields instead of
 * invoking methods; anything that serialises an error for an operator has to do
 * the same. There is deliberately no operator-side whitelist here yet, because
 * the log line's error serialiser does not exist until `@repo/observability`
 * does — that package owns building it.
 */
export function isAppError(value: unknown): value is AppError {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<symbol, unknown>)[APP_ERROR_MARKER] === true
  );
}

/**
 * Builds the three-key browser whitelist out of an arbitrary value.
 *
 * It takes `unknown` rather than `AppError` on purpose: the caller may be
 * holding something that merely *claims* to be one, and calling a method on that
 * value would run the forger's code. So this reads fields, validates the type
 * and length of each one, and substitutes a constant for anything it will not
 * copy. Nothing here can throw, and nothing untrusted survives it.
 */
export function projectClientError(value: unknown): ClientError {
  if (!isAppError(value)) {
    return { code: GENERIC_ERROR_CODE, message: DEFAULT_USER_MESSAGE, requestId: "" };
  }

  const candidate = value as Partial<Record<keyof AppError, unknown>>;

  return {
    code: copyableString(candidate.code, MAX_CODE_LENGTH) ?? GENERIC_ERROR_CODE,
    message: copyableString(candidate.userMessage, MAX_USER_MESSAGE_LENGTH) ?? DEFAULT_USER_MESSAGE,
    requestId: copyableString(candidate.requestId, MAX_REQUEST_ID_LENGTH) ?? "",
  };
}
