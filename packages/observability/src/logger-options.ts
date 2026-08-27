/**
 * The logger's options, built by a pure function separate from the singleton.
 *
 * That separation is the whole reason this module exists: the spec's second
 * testing seam is **stdout**, and a seam you can only reach by writing to file
 * descriptor 1 is not a seam. A test builds a `pino` instance from these options
 * over an in-memory stream and exercises the base fields, the redaction, the
 * error serialiser, the level formatter and the size cap in one call.
 *
 * pino's own test utility is deliberately not used: it asserts on `pid` and
 * `hostname` before stripping them, and these options replace those.
 */

import { GENERIC_ERROR_CODE, isAppError } from "@repo/errors/app-error";
import { REDACTED, redactionPaths } from "@repo/errors/redaction";
import { assertServerOnly } from "@repo/observability/server-only";
import pino, { type LevelWithSilent, type LoggerOptions } from "pino";

assertServerOnly("logger-options");

/**
 * The `service` base field.
 *
 * A module constant rather than an environment variable, and that is a
 * deliberate constraint rather than an omission: NFR13 makes an **undeclared**
 * variable a correctness failure — Turborepo's strict environment mode filters
 * one out of the task environment entirely — so introducing `SERVICE_NAME` here
 * would mean a `turbo.json` change that belongs with the rest of the environment
 * plumbing. It is a placeholder: a downstream project renames it alongside
 * `apps/web`'s workspace name.
 */
const SERVICE_NAME = "web";

/** The `release` base field when nothing populates it. Never absent — see below. */
const UNKNOWN_RELEASE = "unknown";

/**
 * The roots redaction paths are generated at.
 *
 * Two, because these are the two containers this design logs into: `err` is
 * whatever the error serialiser produced, and the spec's core entities already
 * fix that "everything else is free-form under `context`". So the roots follow
 * from the shape of a log line rather than being a second list to keep in sync
 * with the first.
 *
 * What key-name paths structurally cannot reach is a field passed straight to
 * `logger.info({ token })` at the top level. That is a convention rather than a
 * mechanism, so it lands in `CLAUDE.md` with the effort's other two logging
 * rules — log at the dynamic boundary, and never return an `AppError` from a
 * cached function — which the conventions ticket owns.
 */
const REDACTION_ROOTS = ["err", "context"] as const;

/**
 * NFR16's bound, and the default `LOG_MAX_LINE_BYTES` falls back to.
 *
 * 8 KB **in every environment**. There is deliberately no `NODE_ENV` branch: the
 * value of `LOG_FORMAT=json pnpm dev` is that local stdout predicts what a drain
 * will receive, and an environment-dependent default is precisely the behaviour
 * that stops being observable locally.
 *
 * Exported because the test asserts the number, not a behaviour near it.
 */
export const MAX_LINE_BYTES = 8 * 1024;

/**
 * The floor {@link resolveMaxLineBytes} refuses to go below.
 *
 * A rebuilt line carrying `truncated`, `original_bytes` and the five guaranteed
 * base fields measures roughly 150 bytes, so a bound under that cannot hold the
 * fields the stability contract guarantees — and a line missing `service` or
 * `trace_id` is worse than no line, because it is invisible to every query that
 * would find it. A value below this is treated as out of range rather than
 * honoured.
 *
 * Naming the fields the figure counts, because the whole preserved list is a
 * different number: with the correlation ids and every filterable field present
 * it is closer to 330, which is why a floor-bound line drops some of them. That
 * is the cap working, not the floor being wrong.
 */
export const MIN_LINE_BYTES = 256;

/**
 * What every stack on one line may spend **between them**: half the bound.
 *
 * An allowance shared across the `cause` chain rather than a budget charged per
 * stack, and each of those three choices is load-bearing.
 *
 * **Shared**, because the number of stacks is the thing that varies. A lone
 * `AppError` and the same error wrapped twice by callers cost the same here, so
 * a routine one-error line keeps a deep stack while a chain three deep — a fetch
 * failure wrapped by a repository error wrapped by an `AppError`, the ordinary
 * shape of a real product — still fits. Charging each stack the chain's worst
 * case would trim a line that had room to spare.
 *
 * **Half**, because the other half is for the fields anyone actually wanted: the
 * operator message, `context`, and the fields a query binds to.
 *
 * **Of the bound**, because `LOG_MAX_LINE_BYTES` exists for the developer
 * chasing a deep stack. A constant here would hand them a bigger line carrying
 * the same trimmed stack, which is not what they raised it for.
 */
const STACK_ALLOWANCE_DIVISOR = 2;

/**
 * The fields a truncated line keeps, **in priority order**.
 *
 * This is the stability contract from the spec's core entities — the names every
 * clone's saved searches bind to — then the correlation fields, then the ones a
 * query filters on. Dropping the fields a query filters on would turn a
 * too-large line into an invisible one: `code` and `status` are here because a
 * 4xx never reaches the reporting platform, so an oversized line is the only
 * record a mass-401 leaves.
 *
 * `request_id` sits **with** the correlation fields rather than after the
 * filters, because it is where a support lookup begins: it is the one identifier
 * a user can quote, and on a returned 4xx with no DSN configured it is the only
 * correlator the line carries. ADR-0005 is why it lives at the top level under
 * this spelling: the entity spells the property `requestId`, and the line names
 * its own fields.
 *
 * `context`, `msg` and `err` are deliberately absent: each is admitted after
 * this list, under {@link LINE_PLAN}'s ordering, because each can itself be
 * oversized and has a better fate than take-or-drop — `context` is selected
 * from key by key, `msg` is shortened, and `err` is sized to what remains.
 *
 * `elided` is last and is preserved for the same reason `truncated` is emitted at
 * all: a line that has quietly lost part of a field is disproportionately likely
 * to be the one being read during an incident, and dropping the marker under byte
 * pressure would hide the loss on exactly the lines that suffered two of them.
 * It costs 15 bytes. See {@link toJsonSafe}.
 */
const PRESERVED_ON_TRUNCATION = [
  "level",
  "time",
  "service",
  "env",
  "release",
  "trace_id",
  "span_id",
  "event_id",
  "request_id",
  "code",
  "status",
  "route",
  "duration_ms",
  "elided",
] as const;

/** The environment this reads. Passed in rather than read, so the function stays pure. */
export interface LoggerEnvironment {
  NODE_ENV?: string | undefined;
  LOG_LEVEL?: string | undefined;
  LOG_FORMAT?: string | undefined;
  LOG_MAX_LINE_BYTES?: string | undefined;
  NEXT_PUBLIC_RELEASE?: string | undefined;
}

/**
 * Supplies the correlation fields for one emit, already `snake_case`.
 *
 * Injected rather than imported because this package does not depend on the
 * reporting SDK yet — that arrives with the report site, which is the ticket
 * that has the SDK as a blocker. The default is **not** a stub: contributing no
 * fields is the correct behaviour on the no-DSN path, where nothing initialises
 * and there is no active span to read. The reporting ticket passes a reader
 * built on `spanToJSON()`, whose output is already `snake_case`, and no call
 * site changes.
 */
export type TraceContextReader = () => Record<string, string>;

const NO_TRACE_CONTEXT: TraceContextReader = () => ({});

/**
 * Read off pino at import rather than hand-written, so a level pino adds is
 * accepted without an edit here. `silent` is pino's own off-switch and is the
 * one name absent from `pino.levels`.
 */
const LEVEL_NAMES: ReadonlySet<string> = new Set([...Object.keys(pino.levels.values), "silent"]);

function isLevelName(value: string): value is LevelWithSilent {
  return LEVEL_NAMES.has(value);
}

export type LogFormat = "json" | "pretty";

function isProduction(env: LoggerEnvironment): boolean {
  return env.NODE_ENV === "production";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * NFR8's floor, and the runtime override that needs no rebuild.
 *
 * An unrecognised `LOG_LEVEL` falls back to the default rather than reaching
 * pino, which throws at construction. A typo in a runtime variable should not be
 * the reason a server fails to boot — and the variable exists to be changed
 * mid-incident, which is precisely when a typo is likeliest and a crash costliest.
 */
function resolveLevel(env: LoggerEnvironment): LevelWithSilent {
  const fallback: LevelWithSilent = isProduction(env) ? "info" : "debug";
  const requested = env.LOG_LEVEL;

  return requested !== undefined && isLevelName(requested) ? requested : fallback;
}

/**
 * NFR9's switch. Pretty in development, structured JSON in production, either
 * overridden by `LOG_FORMAT`.
 *
 * It lives here rather than beside the destination it selects because it is an
 * environment read like the level, and the two belong under one pure function's
 * worth of reasoning. An unrecognised value is ignored rather than treated as a
 * third destination.
 */
export function resolveLogFormat(env: LoggerEnvironment): LogFormat {
  if (env.LOG_FORMAT === "json" || env.LOG_FORMAT === "pretty") return env.LOG_FORMAT;

  return isProduction(env) ? "json" : "pretty";
}

/**
 * NFR16's bound, and the runtime override that needs no rebuild.
 *
 * The default is {@link MAX_LINE_BYTES} in every environment — see there for why
 * there is no `NODE_ENV` branch. The override exists for one case: a developer
 * deliberately chasing a deep stack who wants the whole thing for one session.
 *
 * Resolution follows {@link resolveLevel}'s precedent exactly. A missing,
 * non-numeric, or out-of-range value falls back to the default rather than
 * reaching a throw, because a variable that exists to be changed mid-investigation
 * is one where a typo must not be the reason a server fails to boot.
 *
 * Digits only: `Number.parseInt` alone would read `"100000abc"` as 100000 and
 * `"8kb"` as 8, so a typo would land silently on a number nobody meant.
 */
export function resolveMaxLineBytes(env: LoggerEnvironment): number {
  const requested = env.LOG_MAX_LINE_BYTES;

  if (requested === undefined || !/^\d+$/.test(requested)) return MAX_LINE_BYTES;

  const bytes = Number.parseInt(requested, 10);

  return Number.isSafeInteger(bytes) && bytes >= MIN_LINE_BYTES ? bytes : MAX_LINE_BYTES;
}

/**
 * How many `cause` links {@link trimSerialisedStacks} will walk.
 *
 * pino's serialiser breaks a cyclic `Error` chain itself, but a non-`Error`
 * `cause` is passed through untouched and a plain object may point at itself.
 * The logger is the one place that must not throw, so the walk is bounded rather
 * than trusting its input. A chain deeper than this keeps its stacks untrimmed;
 * the line cap is what catches that.
 */
const MAX_CAUSE_DEPTH = 16;

/** What a trimmed stack ends in, so it cannot be mistaken for a shallow one. */
function omittedFramesMarker(omitted: number): string {
  return `    ... ${omitted} ${omitted === 1 ? "frame" : "frames"} omitted`;
}

/**
 * What a folded run reads as, and it is deliberately **not** the marker above.
 *
 * Both say a stack is not shallow; only one says the frames are recoverable
 * elsewhere. A reader has to be able to tell "ten framework frames were folded
 * here" from "eleven frames fell off the end", and a stack that is both trimmed
 * and collapsed carries both markers at once. The qualifier is what separates
 * them; the shared vocabulary is what stops a line speaking two languages.
 *
 * The word is *framework* rather than *vendor* because it is read on a log line
 * by someone debugging, not in a dependency manifest — Node's own `node:` frames
 * are folded here too and were never vendored.
 */
function collapsedFramesMarker(collapsed: number): string {
  return `    ... ${collapsed} framework frames omitted`;
}

/**
 * Which frames a stack's byte budget should not be spent on.
 *
 * A **path** test, and a pattern this package owns rather than a literal inlined
 * at the call site — the same treatment `route` gets. `node_modules` is the
 * obvious marker and covers pnpm's `.pnpm` store; Node's own `node:` frames are
 * the other frames a real request stack carries that name nothing anybody can
 * open. A monorepo has others and a downstream project will have more, so this
 * is the extension point — which, per ADR-0004, makes it also the natural thing
 * to break: a frame misclassified here is a frame silently folded. So it is one
 * named list to extend rather than a literal to hunt for, and it is covered at
 * the stdout seam like everything else in these options. Not exported: nothing
 * outside this module classifies a frame, and a template is extended by editing
 * the clone rather than by importing a list into it.
 */
const VENDOR_FRAME_PATTERNS: readonly RegExp[] = [/[\\/]node_modules[\\/]/, /(?:^|[\s(])node:/];

function isVendorFrame(frame: string): boolean {
  return VENDOR_FRAME_PATTERNS.some((pattern) => pattern.test(frame));
}

/**
 * One line of a collapsed stack, and how many original frames it stands for.
 *
 * The count is why this is a record rather than a string: after a collapse the
 * lines are a mix of real frames and markers standing for many, so a tail
 * truncation that counted *lines* would report "11 frames omitted" for a tail
 * holding forty. The marker keeps meaning frames.
 */
interface StackEntry {
  readonly text: string;
  readonly frames: number;
}

/**
 * Fold each run of **consecutive** vendor frames into one counted marker.
 *
 * Two rules, both from ADR-0004 and neither implementation taste. The **first
 * frame is kept whatever it classifies as** — it is the throw site, and a throw
 * inside a library is still the thing being reported. And a run folds only when
 * folding **saves bytes**, which a run of one never does on the arithmetic this
 * exists for; a marker where a frame used to be is a worse line, not a smaller
 * one.
 */
function collapseVendorRuns(frames: readonly string[]): StackEntry[] {
  const entries: StackEntry[] = [];
  let run: string[] = [];

  const flush = (): void => {
    if (run.length === 0) return;

    const marker = collapsedFramesMarker(run.length);
    // Both sides measured as they will be joined, so the comparison is the one
    // the line actually pays rather than a reconstruction of it.
    const folds = run.length > 1 && Buffer.byteLength(marker) < Buffer.byteLength(run.join("\n"));

    entries.push(
      ...(folds
        ? [{ text: marker, frames: run.length }]
        : run.map((text) => ({ text, frames: 1 }))),
    );
    run = [];
  };

  for (const [index, frame] of frames.entries()) {
    if (index > 0 && isVendorFrame(frame)) {
      run.push(frame);

      continue;
    }

    flush();
    entries.push({ text: frame, frames: 1 });
  }

  flush();

  return entries;
}

/**
 * Trim one stack to a byte budget — by **value** first, then by position.
 *
 * Value first, because position alone spends the budget on the frames carrying
 * the least: a vendor frame is ~250 bytes under pnpm's isolated store against an
 * application frame's ~110, and the frames after the throw site in a framework
 * request are framework internals. Measured on one Next.js request, 79% of the
 * kept stack named `node_modules`. So runs of consecutive vendor frames fold to
 * a counted marker before a byte is spent, and what is left is fitted exactly as
 * it was before. See ADR-0004; the collapse is unconditional and there is no
 * knob, because `LOG_MAX_LINE_BYTES` already is one and under the collapse it
 * now buys application frames instead of more `.pnpm` paths.
 *
 * Then position, because the throw site is what an operator reads first. Bytes
 * rather than frames, because a frame count would mean a different thing in
 * every project built from this template.
 *
 * The `Name: message` header is not a frame: it is what the frames are about,
 * and it is never folded, counted, or cut. A stack that already fits comes back
 * byte-identical — the collapse is part of trimming, not of serialising.
 *
 * The trim is cut at frame boundaries and says how many frames it dropped, so a
 * trimmed stack cannot be mistaken for a shallow one. Where the budget is
 * narrower than that marker — only reachable at a floor-level bound split across
 * a long chain — what comes back is the header and the marker, which can exceed
 * the budget. {@link capLine} still holds the line, which is the bound that is
 * actually promised.
 */
function trimStack(stack: string, budget: number): string {
  if (Buffer.byteLength(stack) <= budget) return stack;

  const lines = stack.split("\n");
  const header = lines[0] ?? "";
  const entries = collapseVendorRuns(lines.slice(1));
  const collapsed = [header, ...entries.map((entry) => entry.text)].join("\n");

  if (Buffer.byteLength(collapsed) <= budget) return collapsed;

  const frames = entries.reduce((total, entry) => total + entry.frames, 0);
  // Reserved at the widest the marker can be, so admitting a frame can never
  // push the marker itself past the budget.
  const reserved = Buffer.byteLength(omittedFramesMarker(frames));

  const kept: string[] = [];
  let keptFrames = 0;
  // The header **and the newline that separates it from the first frame**.
  // Charging that newline is what keeps the budget exact: the result is joined,
  // so every line after the header costs one byte more than it measures.
  let used = Buffer.byteLength(header) + 1;

  for (const entry of entries) {
    const cost = Buffer.byteLength(entry.text) + 1;

    if (used + cost + reserved > budget) break;

    kept.push(entry.text);
    keptFrames += entry.frames;
    used += cost;
  }

  return [header, ...kept, omittedFramesMarker(frames - keptFrames)].join("\n");
}

/**
 * Whether the walk should keep going. Shared by the two passes below so their
 * one termination rule cannot drift into two: the counting pass decides the
 * budget the applying pass spends, and a chain they disagree on the length of
 * is a budget spent on the wrong number of stacks.
 */
function withinChain(value: unknown, depth: number): value is Record<string, unknown> {
  return isRecord(value) && depth <= MAX_CAUSE_DEPTH;
}

/** How many stacks the chain carries, which is what the allowance is split by. */
function countStacks(value: unknown, depth = 0): number {
  if (!withinChain(value, depth)) return 0;

  return (typeof value.stack === "string" ? 1 : 0) + countStacks(value.cause, depth + 1);
}

/** The applying pass: every stack in the chain, cut to the budget it was given. */
function applyStackBudget(value: unknown, budget: number, depth = 0): unknown {
  if (!withinChain(value, depth)) return value;

  return {
    ...value,
    ...(typeof value.stack === "string" ? { stack: trimStack(value.stack, budget) } : {}),
    ...("cause" in value ? { cause: applyStackBudget(value.cause, budget, depth + 1) } : {}),
  };
}

/**
 * Split the allowance across every stack the serialised error carries and apply
 * it, following the `cause` chain — because each link contributes its own stack,
 * and it is their sum that breaches the bound.
 *
 * Counting first is what makes the allowance shared rather than per-stack; see
 * {@link STACK_ALLOWANCE_DIVISOR}.
 */
function trimSerialisedStacks(value: unknown, allowance: number): unknown {
  const stacks = countStacks(value);

  return stacks === 0 ? value : applyStackBudget(value, Math.floor(allowance / stacks));
}

/**
 * `cause` is the one thing neither projection carries, and this is the only
 * place that walks it — with redaction applied on the way, because
 * `cause.config.headers.authorization` exists only after the serialiser has run.
 */
function serialiseCause(cause: unknown): unknown {
  return cause instanceof Error ? pino.stdSerializers.errWithCause(cause) : cause;
}

/**
 * The operator projection, called rather than reimplemented — and guarded.
 *
 * `@repo/errors` documents why the guard is here: `isAppError` checks a
 * *registered* symbol, so it is a claim and not a proof, and the moment the
 * check passes TypeScript will happily let this call a forger's method. The
 * client egress avoids that by reading fields instead of invoking anything. The
 * operator egress cannot — the spec's contract says this package calls
 * `toOperatorJSON()`, and that is the projection it must not duplicate — so it
 * calls it inside a `try` and refuses anything that is not a plain object.
 * A forgery therefore costs a generic code, never a throw inside the logger.
 */
function projectOperatorError(error: unknown): Record<string, unknown> {
  const candidate = error as { toOperatorJSON?: unknown };

  if (typeof candidate.toOperatorJSON !== "function") return { code: GENERIC_ERROR_CODE };

  try {
    const projected: unknown = (candidate.toOperatorJSON as () => unknown)();

    return isRecord(projected) ? projected : { code: GENERIC_ERROR_CODE };
  } catch {
    return { code: GENERIC_ERROR_CODE };
  }
}

function serialiseError(error: unknown, stackAllowance: number): unknown {
  if (!isAppError(error)) {
    return error instanceof Error
      ? trimSerialisedStacks(pino.stdSerializers.errWithCause(error), stackAllowance)
      : error;
  }

  const candidate = error as unknown as { name?: unknown; stack?: unknown; cause?: unknown };

  return trimSerialisedStacks(
    {
      ...projectOperatorError(error),
      // The projection is the operator's *audience* whitelist and carries neither
      // of these; an operator reading a log line needs both.
      type: typeof candidate.name === "string" ? candidate.name : "AppError",
      stack: typeof candidate.stack === "string" ? candidate.stack : undefined,
      ...(candidate.cause === undefined ? {} : { cause: serialiseCause(candidate.cause) }),
    },
    stackAllowance,
  );
}

/**
 * Shrink a string until whatever it is measured inside fits the bound.
 *
 * Each pass removes at least the observed overflow, so it converges on the space
 * actually left rather than walking down one character at a time. Returns the
 * empty string when nothing fits, which the caller reads as "drop it".
 */
function shortenToFit(text: string, measure: (candidate: string) => number, bound: number): string {
  let shortened = text;

  while (shortened.length > 0 && measure(shortened) > bound) {
    const overflow = measure(shortened) - bound;

    shortened = shortened.slice(0, Math.max(0, shortened.length - Math.max(overflow, 1)));
  }

  return shortened;
}

/**
 * The order `err`'s own fields are admitted in when a line is rebuilt.
 *
 * Identity and the operator message first, because a truncated error line is
 * useless without them. Then the structured detail, and the stack second to
 * last: it is the largest field and the one an operator can most often do
 * without, having already been given the code and the message. There is no
 * correlation id here to order — ADR-0005 keeps `request_id` at the top level,
 * out of any list a shortenable `message` competes with.
 */
const ERR_FIELDS_IN_PRIORITY: readonly string[] = [
  "type",
  "code",
  "status",
  "message",
  "userMessage",
  "context",
  "stack",
  "cause",
];

/**
 * A record's keys, smallest serialised value first, ties broken by declaration order.
 *
 * The order is the decision selection turns on. The failure NFR16's content
 * half exists for is one oversized key crowding out its siblings, and admitting
 * in declaration order reproduces that failure whenever the big key happens to
 * be declared first. Smallest-first maximises the number of surviving keys,
 * which for a `context` means the identifiers — ids, counts, enum values — that
 * say *which* operation failed.
 *
 * The tie-break is explicit rather than leaning on `Array.prototype.sort` being
 * stable, so the emitted key order is a property of this function.
 */
function keysBySize(value: Record<string, unknown>): string[] {
  return Object.keys(value)
    .map((key, index) => ({
      key,
      index,
      bytes: Buffer.byteLength(JSON.stringify(value[key]) ?? ""),
    }))
    .toSorted((a, b) => a.bytes - b.bytes || a.index - b.index)
    .map((entry) => entry.key);
}

/**
 * How one level of a rebuilt line admits its fields: which fields, in what
 * order, which string values may be shortened, and which plan a record-valued
 * field is selected under one level down.
 *
 * The levels of a line — the line itself, `err`, and any structured record at
 * any depth — differ only in this data, so admission is **one mechanism**
 * ({@link admitFields}) rather than one loop per level. That is NFR16's content
 * half made structural: a record-valued field nobody anticipated is still
 * selected from rather than dropped whole, because recursing is what the
 * mechanism does by default and take-or-drop is what has to be configured.
 */
interface AdmissionPlan {
  /** The fields offered space, in the order they may claim it. */
  readonly order: (value: Record<string, unknown>) => string[];
  /**
   * The fields whose string value is shortened into the remaining space rather
   * than dropped. Prose only: a shortened operator message is still true, while
   * a shortened identifier matches nothing yet looks exactly like one that
   * should — so an identifier is taken whole or dropped, never trimmed.
   */
  readonly shortenable: ReadonlySet<string>;
  /** The plan a record-valued field recurses with. */
  readonly forField: (field: string) => AdmissionPlan;
}

/**
 * The plan for a structured record — a `context` at any level, a `cause`, or
 * any record inside one: keys by size, nothing shortenable, records all the way
 * down under this same plan.
 */
const RECORD_PLAN: AdmissionPlan = {
  order: keysBySize,
  shortenable: new Set<string>(),
  forField: () => RECORD_PLAN,
};

/**
 * The plan for `err`: the priority list first, then anything it does not name —
 * an own property `errWithCause` copied off the error — offered the leftovers
 * in insertion order. `message` and `stack` are the two prose fields, so they
 * shorten; everything structured recurses.
 */
const ERR_PLAN: AdmissionPlan = {
  order: (value) => [
    ...ERR_FIELDS_IN_PRIORITY.filter((field) => field in value),
    ...Object.keys(value).filter((field) => !ERR_FIELDS_IN_PRIORITY.includes(field)),
  ],
  shortenable: new Set(["message", "stack"]),
  forField: () => RECORD_PLAN,
};

/**
 * The plan for the line itself: the preserved fields, then `context`, then
 * `msg`, then `err` — and nothing else, because the top level of a line is the
 * stability contract's namespace and a rebuilt line republishes only the names
 * it guarantees.
 *
 * `context` sits **before** `msg`, and the order is the decision: `context`
 * carries the identifiers a query binds to, while `msg` is prose that is
 * shortened into whatever remains — so an oversized message costs itself, never
 * the ids. `err` is last because it is the field sized to the room left, and
 * last is where that room is finally known. `msg` and a thrown-string `err` are
 * the line's prose, so both shorten; a structured `err` recurses under
 * {@link ERR_PLAN} instead.
 */
const LINE_FIELDS_IN_PRIORITY: readonly string[] = [
  ...PRESERVED_ON_TRUNCATION,
  "context",
  "msg",
  "err",
];

const LINE_PLAN: AdmissionPlan = {
  order: (value) => LINE_FIELDS_IN_PRIORITY.filter((field) => field in value),
  shortenable: new Set(["msg", "err"]),
  forField: (field) => (field === "err" ? ERR_PLAN : RECORD_PLAN),
};

/** What a candidate line costs, measured as the bytes the destination receives. */
function serialisedBytes(candidate: Record<string, unknown>): number {
  return Buffer.byteLength(JSON.stringify(candidate));
}

/**
 * How deep selection will recurse before a record is taken or dropped whole.
 *
 * The same invariant {@link MAX_CAUSE_DEPTH} protects on the cause walk: the
 * logger is the one place that must not throw, and an admission recursing once
 * per nesting level would turn a pathologically nested field into a
 * `RangeError` escaping through `hooks.streamWrite`. Sixteen levels is deeper
 * than any record a log call has business carrying; below the cut a record is
 * take-or-drop, and the bound still holds because take is still measured.
 */
const MAX_SELECTION_DEPTH = 16;

/**
 * The one admission loop, applied at every level of a rebuilt line.
 *
 * Each field is offered in plan order and takes the best fate it qualifies
 * for: admitted whole if it fits, selected from under the plan's next level
 * down if it is a record above the depth cut, shortened if the plan says its
 * string value is prose — and dropped otherwise, costing itself rather than
 * the fields behind it.
 *
 * `measure` is closed over everything outside `into`, so what is proved to fit
 * is always the **whole line**: the "only ever grows into space already proved
 * free" argument holds at every depth because it is the same `measure` all the
 * way down, wrapped once per level.
 */
function admitFields(
  value: Record<string, unknown>,
  into: Record<string, unknown>,
  measure: (candidate: Record<string, unknown>) => number,
  bound: number,
  plan: AdmissionPlan,
  depth = 0,
): Record<string, unknown> {
  for (const field of plan.order(value)) {
    const candidate = value[field];

    if (measure({ ...into, [field]: candidate }) <= bound) {
      into[field] = candidate;

      continue;
    }

    if (isRecord(candidate) && depth < MAX_SELECTION_DEPTH) {
      const selected = admitRecord(
        candidate,
        (subset) => measure({ ...into, [field]: subset }),
        bound,
        plan.forField(field),
        depth + 1,
      );

      if (selected !== undefined) into[field] = selected;

      continue;
    }

    if (plan.shortenable.has(field) && typeof candidate === "string") {
      const shortened = shortenToFit(
        candidate,
        (text) => measure({ ...into, [field]: text }),
        bound,
      );

      if (shortened.length > 0) into[field] = shortened;
    }
  }

  return into;
}

/**
 * A record-valued field, selected from rather than taken or dropped whole.
 *
 * @returns the admitted subset, or `undefined` when nothing fits — an empty
 *   record on the line would claim the source carried none, which is a
 *   different and false statement. Emptiness is judged on the serialised form
 *   so a key whose value is `undefined`, and which therefore vanishes in JSON,
 *   cannot produce one.
 */
function admitRecord(
  value: Record<string, unknown>,
  measure: (candidate: Record<string, unknown>) => number,
  bound: number,
  plan: AdmissionPlan,
  depth: number,
): Record<string, unknown> | undefined {
  if (measure({}) > bound) return undefined;

  const admitted = admitFields(value, {}, measure, bound, plan, depth);

  return JSON.stringify(admitted) === "{}" ? undefined : admitted;
}

/**
 * The markers this pass leaves where a value could not be carried whole.
 *
 * Bracketed and lower-case, the shape {@link REDACTED} already established, so a
 * reader meets one vocabulary for "the logger put this here" rather than two.
 * They are values rather than a schema change: they appear at the position the
 * loss happened, which is the only place that answers *what* was lost.
 */
const CIRCULAR = "[circular]";
const DEPTH_LIMIT = "[depth limit]";
const UNSERIALISABLE = "[unserialisable]";

/**
 * How deep {@link toJsonSafe} descends before it writes {@link DEPTH_LIMIT}.
 *
 * The same number, and the same argument, as {@link MAX_SELECTION_DEPTH} and
 * {@link MAX_CAUSE_DEPTH}: deeper than any record a log call has business
 * carrying. What makes it load-bearing here rather than merely prudent is that
 * it is a *constant* — far below the call stack of any platform this runs on —
 * so `JSON.stringify` cannot raise `RangeError` on this pass's output. That is
 * the whole cross-platform claim in #41, and it holds by construction rather
 * than by measurement.
 */
const MAX_LOG_DEPTH = 16;

/** Whether this line lost anything, accumulated across one emit. */
interface Elision {
  any: boolean;
}

/**
 * What a value turned out to be, once `toJSON` has had its say.
 *
 * `omit` is its own case rather than an `undefined` value because `undefined`
 * is a legitimate thing to write into an array — `JSON.stringify` puts `null`
 * there and drops the key in an object, and this pass matches it in both
 * places.
 */
type Classified =
  | { kind: "value"; value: unknown }
  | { kind: "omit" }
  | { kind: "container"; source: object; target: Record<string, unknown> | unknown[] };

/**
 * `toJSON`, applied exactly once, the way `JSON.stringify` applies it.
 *
 * Not an optional nicety: `Date` carries its whole value in this hook, so a walk
 * that ignored it would turn every timestamp in a `context` into `{}`. Both the
 * property read and the call are guarded, because a getter that throws is a
 * thing a caller can hand the logger and the logger is the one place that must
 * not throw.
 */
function applyToJson(value: object, elide: Elision): unknown {
  let hook: unknown;

  try {
    hook = (value as { toJSON?: unknown }).toJSON;
  } catch {
    elide.any = true;

    return UNSERIALISABLE;
  }

  if (typeof hook !== "function") return value;

  try {
    return (hook as () => unknown).call(value);
  } catch {
    elide.any = true;

    return UNSERIALISABLE;
  }
}

/** Own enumerable keys, or none — `Object.keys` throws on a hostile proxy. */
function ownKeys(source: object): string[] {
  try {
    return Object.keys(source);
  } catch {
    return [];
  }
}

/** One property read, guarded, because a getter is caller code. */
function readProperty(source: object, key: string | number, elide: Elision): unknown {
  try {
    return (source as Record<string | number, unknown>)[key];
  } catch {
    elide.any = true;

    return UNSERIALISABLE;
  }
}

/**
 * One value's fate, before anything is written.
 *
 * `ancestors` is the path currently being walked, **not** every object seen. A
 * value repeated as a sibling is a shared reference, which `JSON.stringify`
 * serialises twice and so does this; only a value that is its own ancestor is a
 * cycle. Marking by "seen anywhere" would report a DAG as circular, which is a
 * false claim about the caller's data.
 */
function classify(raw: unknown, depth: number, ancestors: Set<object>, elide: Elision): Classified {
  const value = typeof raw === "object" && raw !== null ? applyToJson(raw, elide) : raw;

  switch (typeof value) {
    case "undefined":
    case "function":
    case "symbol":
      return { kind: "omit" };

    case "bigint":
      // Lossless as a decimal string, so this is **not** counted as an elision —
      // nothing was lost, only respelled. It is here because `JSON.stringify`
      // throws on a `BigInt`, and a Postgres `bigint` column reaching a `context`
      // is the realistic way that happens.
      return { kind: "value", value: value.toString() };

    case "number":
      // `NaN` and the infinities serialise as `null`. Matching that keeps this
      // pass invisible for every input that did not need it.
      return { kind: "value", value: Number.isFinite(value) ? value : null };

    case "string":
    case "boolean":
      return { kind: "value", value };
  }

  if (value === null) return { kind: "value", value: null };

  if (ancestors.has(value as object)) {
    elide.any = true;

    return { kind: "value", value: CIRCULAR };
  }

  if (depth >= MAX_LOG_DEPTH) {
    elide.any = true;

    return { kind: "value", value: DEPTH_LIMIT };
  }

  return {
    kind: "container",
    source: value as object,
    target: Array.isArray(value) ? [] : {},
  };
}

/** One level of the walk, held on an explicit stack rather than in a call frame. */
interface Frame {
  source: object;
  target: Record<string, unknown> | unknown[];
  /** The keys to visit, or `undefined` when the source is an array. */
  keys: string[] | undefined;
  index: number;
  depth: number;
}

/**
 * A value `JSON.stringify` is guaranteed to accept, built from one that isn't.
 *
 * **This is the fix for #70 and #41, and it is one mechanism for both.** pino
 * hands the line to `JSON.stringify` and, on *any* throw, retries with
 * `safe-stable-stringify` at `maximumDepth: 5`. That fallback does not refuse a
 * cycle — it *unrolls* it — so it manufactures five levels of depth out of an
 * object the caller wrote one level deep, and the fifth is past the depth-4
 * horizon `redactionPaths` compiles. A caller who kept the rule about credentials
 * in `context` had it broken for them by the logger. The same fallback stubs a
 * deep field as `"[Object]"` and leaves nothing on the line to say so.
 *
 * Removing the *reachability* of that fallback is what closes both, and it is
 * strictly better than teaching the fallback to behave: the output stops
 * depending on which serialisation path an input happened to take, which is
 * what made #41 pass on macOS and fail on Linux.
 *
 * Three properties, and each is load-bearing:
 *
 * - **No cycles.** A value that is its own ancestor becomes {@link CIRCULAR} at
 *   the first recurrence, so depth is never manufactured and nothing is pushed
 *   past the redaction horizon. Redaction still runs *after* this pass, on this
 *   pass's output, so its reach is unchanged — the depth-4 bound in
 *   `@repo/errors` is untouched, and a hand-written `context.a.b.c.d.password`
 *   is still the documented, accepted limit it always was.
 * - **Bounded depth**, at {@link MAX_LOG_DEPTH}, so `RangeError` is unreachable.
 * - **Iterative.** The walk holds its state in {@link Frame}s on the heap, not in
 *   call frames. A recursive version would reintroduce exactly the stack-size
 *   dependence this exists to remove, and would do it silently — passing on a
 *   development machine, failing on a CI runner. That is the shape of #41 and it
 *   must not be rebuilt inside its own fix.
 *
 * The cost is one walk per line on top of the one `JSON.stringify` already does.
 * It is paid unconditionally, and deliberately so: only trying it on failure
 * would make the output depend on whether the first attempt threw, which is the
 * platform dependence again wearing a different hat.
 *
 * @param elide - accumulates whether anything was lost, so the caller can put one
 *   queryable marker on the line. The in-place markers say *where*; this says
 *   *whether*, which is the half a drain can count.
 */
function toJsonSafe(root: unknown, elide: Elision): unknown {
  const ancestors = new Set<object>();
  const first = classify(root, 0, ancestors, elide);

  if (first.kind === "omit") return undefined;
  if (first.kind === "value") return first.value;

  const frames: Frame[] = [];

  const descend = (source: object, target: Record<string, unknown> | unknown[], depth: number) => {
    ancestors.add(source);
    frames.push({
      source,
      target,
      keys: Array.isArray(source) ? undefined : ownKeys(source),
      index: 0,
      depth,
    });
  };

  descend(first.source, first.target, 0);

  while (frames.length > 0) {
    const frame = frames[frames.length - 1] as Frame;
    const array = frame.keys === undefined ? (frame.source as unknown[]) : undefined;
    const length = array === undefined ? (frame.keys as string[]).length : array.length;

    if (frame.index >= length) {
      // Off the path, so a later sibling holding the same object is a shared
      // reference rather than a cycle.
      ancestors.delete(frame.source);
      frames.pop();

      continue;
    }

    const key =
      array === undefined ? ((frame.keys as string[])[frame.index] as string) : frame.index;

    frame.index += 1;

    const classified = classify(
      readProperty(frame.source, key, elide),
      frame.depth + 1,
      ancestors,
      elide,
    );

    // `JSON.stringify` drops an omitted key in an object and writes `null` for
    // one in an array, because an array's shape is its indices.
    const written =
      classified.kind === "omit"
        ? { skip: array === undefined, value: null }
        : {
            skip: false,
            value: classified.kind === "value" ? classified.value : classified.target,
          };

    if (!written.skip) {
      if (array === undefined)
        (frame.target as Record<string, unknown>)[key as string] = written.value;
      else (frame.target as unknown[]).push(written.value);
    }

    if (classified.kind === "container") {
      descend(classified.source, classified.target, frame.depth + 1);
    }
  }

  return first.target;
}

/** The key pino puts an error under, and the one {@link serialiseError} answers for. */
const ERROR_KEY = "err";

/** The marker saying this line lost part of a field. See {@link toJsonSafe}. */
const ELIDED_KEY = "elided";

/**
 * The whole line, made safe to serialise, in the one place that sees all of it.
 *
 * `formatters.log` is where this has to happen, and the position is exact rather
 * than convenient. pino's `_asJson` runs it **first** — before the per-key
 * serialisers and before the redaction-wrapped `stringify` — and `write()` has
 * already normalised `logger.error(err)` into `{ err }` and merged the mixin by
 * then. So this sees every field a caller can reach, redaction still runs after
 * it and is unaffected, and there is no path left by which a caller-supplied
 * value reaches `JSON.stringify` unchecked.
 *
 * `err` is serialised **here** rather than through `serializers.err`, and that is
 * the reason the option is gone. Two things follow from the ordering above: a
 * per-key serialiser runs after this pass, so its output would be the one thing
 * on the line this never saw — and an ORM error carrying a cyclic own property is
 * the realistic trigger #70 names, which arrives through `err`, not `context`.
 * Doing both in one pass is also what lets {@link ELIDED_KEY} be accurate, since
 * the marker has to be written after everything that could set it.
 *
 * A caller's own `elided` field is overwritten. That is the same trade
 * `truncated` already makes: the line names its own fields (ADR-0005), and a
 * marker a caller can forge is not a marker.
 */
function makeLineSafe(
  obj: Record<string, unknown>,
  stackAllowance: number,
): Record<string, unknown> {
  const elide: Elision = { any: false };
  const safe: Record<string, unknown> = {};

  for (const key of ownKeys(obj)) {
    const raw = readProperty(obj, key, elide);
    const value = toJsonSafe(key === ERROR_KEY ? serialiseError(raw, stackAllowance) : raw, elide);

    if (value !== undefined) safe[key] = value;
  }

  if (elide.any) safe[ELIDED_KEY] = true;

  return safe;
}

/**
 * NFR16, applied to the finished line.
 *
 * The line is **rebuilt**, not sliced. Cutting valid JSON at a byte offset
 * produces something `JSON.parse` rejects, which would break NFR9 for exactly
 * the lines an operator most needs to read — so what comes back is a smaller
 * *object*: the fields a query binds to, a `truncated` marker, an
 * `original_bytes` count, a message shortened only if the message is itself what
 * overflowed, and `err` trimmed to whatever space is left.
 *
 * The two markers answer different questions, and only the second is one anyone
 * asks. `truncated` says the line was rebuilt — a fact a drain may already bind
 * to. `original_bytes` says how much was there, which is what turns "is
 * truncation happening, and how badly" into a query against the drain rather
 * than an argument about the source. A rebuilt line is disproportionately
 * likely to be the one being read during an incident, so it must say what it
 * is hiding.
 *
 * A breach is routine, not a caller mistake: a development-depth stack breaches
 * on its own, and so does an ordinary cause chain at Node's default ten frames.
 * {@link STACK_ALLOWANCE_DIVISOR} is what makes that rare; this function is
 * what makes a breach cost less than the line.
 *
 * The bound holds unconditionally because every admission is measured against it
 * before it is taken: the rebuilt object starts at two keys and only ever grows
 * into space already proved free — {@link admitFields} carries that argument to
 * every depth.
 *
 * `hooks.streamWrite` is the one place that sees the serialised line, and it
 * runs before the destination — so the cap applies identically whether that
 * destination is stdout or the pretty stream.
 *
 * @param bound - the resolved {@link resolveMaxLineBytes} value, closed over
 *   once when the options are built rather than read per line.
 */
function capLine(line: string, bound: number): string {
  const newline = line.endsWith("\n") ? "\n" : "";
  const body = newline === "" ? line : line.slice(0, -1);

  // Bound rather than compared and dropped: this is the one moment the size of
  // the original is known, and it is what the rebuilt line goes on to report.
  const originalBytes = Buffer.byteLength(body);

  if (originalBytes <= bound) return line;

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = undefined;
  }

  // `original_bytes` is **seeded** rather than offered to the admission loop,
  // and the difference is the whole point of the field. A line only truncates
  // under byte pressure, so a field admitted last is missing from precisely the
  // lines that needed it most — at a floor-level bound it would never fit at
  // all. Seeding it costs the admitted fields ~20 bytes and buys a number that
  // is always there.
  const kept: Record<string, unknown> = { truncated: true, original_bytes: originalBytes };

  if (isRecord(parsed)) admitFields(parsed, kept, serialisedBytes, bound, LINE_PLAN);

  return JSON.stringify(kept) + newline;
}

/**
 * The pino options. Pure, and the only exported way to build them.
 *
 * @param env - the environment to read. `process.env` at the call site.
 * @param readTraceContext - see {@link TraceContextReader}.
 */
export function createLoggerOptions(
  env: LoggerEnvironment,
  readTraceContext: TraceContextReader = NO_TRACE_CONTEXT,
): LoggerOptions {
  // Resolved once, here, rather than read per line: the bound is a property of
  // the process, and re-reading it on every emit would put an environment lookup
  // on the hot path for a value that cannot change.
  const maxLineBytes = resolveMaxLineBytes(env);
  const stackAllowance = Math.floor(maxLineBytes / STACK_ALLOWANCE_DIVISOR);

  return {
    level: resolveLevel(env),

    // `base` *replaces* pino's bindings rather than stripping them afterwards,
    // so `pid` and `hostname` are never serialised. They are noise on serverless
    // — a pid nobody can attach to and a hostname that changes every invocation
    // — and they are not what anyone filters on. These three are: the guaranteed
    // names are a stability contract, because every clone's saved searches bind
    // to them and no clone can be migrated by us.
    base: {
      service: SERVICE_NAME,
      env: env.NODE_ENV ?? "development",
      // Never absent, so the field is safe to filter on. A constant `release`
      // makes "did this start at the last deploy?" unanswerable, which is why
      // the startup notice says so out loud when it is missing in production.
      release: env.NEXT_PUBLIC_RELEASE ?? UNKNOWN_RELEASE,
    },

    // Generated from the shared key names, at the roots this package knows. The
    // logger knows the shape of what it logs; `@repo/errors` knows the names;
    // neither has to learn the other's half.
    //
    // `redaction.ts` left one thing for the consuming package to confirm:
    // whether the matcher accepts more than one wildcard per path, which
    // reaching depth 4 requires. It does — pino 10 ships `@pinojs/redact`, and
    // `err.*.*.*.authorization` both compiles and matches — so the censor
    // fallback that note describes is not needed.
    redact: { paths: [...redactionPaths(REDACTION_ROOTS)], censor: REDACTED },

    // `err` is serialised inside `formatters.log` — see {@link makeLineSafe} for
    // why the ordering forces that — so what is left here is an **identity**, and
    // it is not redundant. pino ships `stdSerializers.err` as the *default* value
    // of this option, so omitting the key does not mean "nobody serialises err",
    // it means "pino does". It then ran over the finished object from
    // `formatters.log` and reserialised it: `type` became `"Object"`, and the
    // cause chain was flattened into the stack string as `caused by:` — losing
    // the nested `cause` this package walks deliberately. The identity is what
    // says the work is already done.
    serializers: { err: (value: unknown) => value },

    formatters: {
      // The name, not the number. A drain that has to map 30 to "info" before it
      // can filter is a drain with a parsing rule, which is the thing this whole
      // line exists to avoid.
      level: (label) => ({ level: label }),

      // Every caller-supplied value on the line, made safe to serialise before
      // pino tries. This is what puts pino's fallback serialiser out of reach,
      // and with it the cyclic-context leak (#70) and the unmarked, platform-
      // dependent stubbing (#41).
      log: (obj) => makeLineSafe(obj, stackAllowance),
    },

    mixin: () => readTraceContext(),

    hooks: { streamWrite: (line: string) => capLine(line, maxLineBytes) },
  };
}
