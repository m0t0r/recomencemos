/**
 * NFR26's ceilings, and the first of them.
 *
 * **The scarcest resource in this design is one person's attention** (DD7), and
 * nothing bounded it before this module. What ships here is the mechanism plus
 * `requestMagicLink`; the other seven ceilings are rows in {@link CEILINGS}
 * added by the slices that need them.
 *
 * **The counter lives in Postgres, not in process memory**, because deploys are
 * continuous and an in-memory limiter resets several times a day — which is the
 * defect NFR26 rejects in those words, and the same reason Better Auth's own
 * limiter is pointed at the database rather than left on its default.
 *
 * **A refusal returns; it does not throw.** That is NFR26's second half: an
 * `AppError` thrown out of here on every refusal would let a crawler spend the
 * month's 5,000-event Sentry allowance in a day and make the second real
 * incident of the month invisible. The refusal still *carries* an `AppError`,
 * because the operator-facing half of a refusal is worth having — it is simply
 * returned rather than raised, and CLAUDE.md's "thrown is reported; returned is
 * logged" is the rule being followed.
 *
 * **It fails closed, and that is the one thing that does throw.** If the counter
 * cannot be read or written the database error propagates, the action does not
 * happen, and nothing is sent. A counter that cannot count must not be read as
 * permission — and unlike a refusal, a database that is not answering is a real
 * incident and has earned its Sentry event.
 */

import { createHash } from "node:crypto";
import { AppError } from "@repo/errors/app-error";
import { sql } from "drizzle-orm";
import type { DomainDatabase } from "#database";
import { rateCounter } from "#schema";
import { SERVICE_UNAVAILABLE } from "#user-messages";

/** One ceiling: how many, over how long. */
export interface Ceiling {
  readonly max: number;
  readonly windowSeconds: number;
}

/**
 * **The ceilings, as data**, so C57's "checked as a list against the UX state
 * table rather than by eye" is a thing a test can do rather than a thing a
 * reviewer must remember.
 *
 * Each action names the scopes it is charged against. `requestMagicLink` is
 * charged twice, per NFR26's own sentence — _"≤ 5/hour per address and ≤ 20/hour
 * per IP"_ — because either half alone leaves the obvious way round: an
 * address-only bound is defeated by rotating addresses, and an IP-only bound is
 * defeated by mobile data while tripping on a shared NAT.
 *
 * The seven remaining ceilings — `publishProfile`, `sendOffer`, `reportOffer`,
 * `requestSkill`, `createPhotoUpload`, `changeEmail`, and the gated read — are
 * NFR26's and arrive with the slices that can charge them. Adding one is a row
 * here, a value in the `CHECK` on `rate_counter.action`, and a `rate limited`
 * row in the spec's UX state table. All three, or the ceiling is silent to the
 * person who hits it.
 */
export const CEILINGS = {
  requestMagicLink: {
    address: { max: 5, windowSeconds: 60 * 60 },
    ip: { max: 20, windowSeconds: 60 * 60 },
  },
} as const satisfies Record<string, Partial<Record<CeilingScope, Ceiling>>>;

export type CeilingedAction = keyof typeof CEILINGS;

/**
 * Who a ceiling is charged against.
 *
 * `address` rather than `account` for this first one, because
 * `requestMagicLink` is charged **before** an Account exists — which is also why
 * `rate_counter.principal` is a `TEXT` key and not a foreign key.
 */
export type CeilingScope = "address" | "ip";

export interface CeilingPrincipal {
  readonly scope: CeilingScope;
  /** The address, or the client IP. Hashed before it is stored — see {@link principalKey}. */
  readonly id: string;
}

/** Allowed, or refused with everything the surface needs to say so. */
export type CeilingOutcome =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      /** Seconds until the window resets. What the surface renders (NFR26, C39). */
      readonly retryAfter: number;
      /** For the log line and the operator. Returned, never thrown. */
      readonly error: AppError;
    };

/**
 * The stored key.
 *
 * **The address is hashed, and the hash is unsalted on purpose.** A rate counter
 * is a count, not a record: it never needs to be read back as an address, so
 * storing one would put `personal` data in a table with no retention rule in
 * NFR17 and no reason to hold it. A salt would buy resistance to enumeration by
 * someone who already has the database — and someone with the database has
 * `user.email` in the clear beside it, so the salt would protect nothing while
 * adding a secret whose rotation resets every ceiling in the system.
 *
 * Lower-cased before hashing so `Ana@…` and `ana@…` charge one counter, matching
 * the `citext` column the same address is stored in.
 */
export function principalKey({ scope, id }: CeilingPrincipal): string {
  const digest = createHash("sha256").update(id.trim().toLowerCase()).digest("hex");
  return `${scope}:${digest}`;
}

/**
 * The window this instant falls in — fixed windows aligned to the epoch, not a
 * sliding one.
 *
 * A sliding window is more accurate and needs a row per event; a fixed window
 * needs one row per principal per window and is what the `UNIQUE (principal,
 * action, window_start)` constraint on `rate_counter` is shaped for. The cost is
 * stated rather than hidden: a person can spend a full allowance at the end of
 * one window and a second full allowance at the start of the next. For
 * `requestMagicLink` that is ten emails in a couple of minutes rather than five,
 * which bounds the abuse case NFR26 names — a flood of mail to an address that
 * did not ask for it — closely enough to be worth one row instead of five.
 */
export function windowStartFor(now: Date, windowSeconds: number): Date {
  const windowMs = windowSeconds * 1000;
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

/** Seconds from `now` until the window holding it resets. Always at least 1. */
export function retryAfterFor(now: Date, windowSeconds: number): number {
  const windowStart = windowStartFor(now, windowSeconds);
  const resetsAt = windowStart.getTime() + windowSeconds * 1000;
  return Math.max(1, Math.ceil((resetsAt - now.getTime()) / 1000));
}

/**
 * _"en 12 minutos"_ — the phrase the refusal ends on, in `es-CO`.
 *
 * Do 4 of the voice guide wants the product's own evidence quoted back, and
 * Don't 4 refuses _más tarde_ for exactly this: an ambiguous refusal is a
 * refusal she cannot plan around. Minutes rather than a clock time because the
 * server's clock and her phone's are not the same clock, and _"a las 3:40 p. m."_
 * asserts an agreement between them that does not exist.
 */
export function retryPhrase(retryAfter: number): string {
  if (retryAfter < 60) return "en menos de un minuto";

  const minutes = Math.ceil(retryAfter / 60);
  if (minutes < 60) return `en ${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;

  const hours = Math.ceil(minutes / 60);
  return `en ${hours} ${hours === 1 ? "hora" : "horas"}`;
}

/**
 * The one string a person reads when a ceiling refuses her.
 *
 * Refusal tone, per the voice guide's matrix: Optimism 3→4, Energy 2→1, Warmth 5
 * unchanged — _"the refusal is our rule, never her mistake"_. Three sentences,
 * each under twenty words: what our rule is with her count in it, when it
 * changes, and the door that is still open. The last one is the spec's own
 * requirement for this surface — _"the Google door is still there"_ — and it is
 * why a rate-limited sign-in is not a dead end.
 */
export function ceilingUserMessage(ceiling: Ceiling, retryAfter: number): string {
  return (
    `Pediste ${ceiling.max} enlaces en una hora, que es el máximo. ` +
    `Puedes pedir otro ${retryPhrase(retryAfter)}. ` +
    "Mientras tanto, puedes entrar con Google."
  );
}

/**
 * Charge one ceiling and say whether the action may proceed.
 *
 * **The handle is the first parameter**, ahead of ADR-0010's principal. See
 * `#database` for why, and for the shape every later query module copies.
 *
 * One statement, and it is an upsert rather than a read-then-write: two
 * statements race, and the race is won by the caller sending the flood this
 * exists to bound.
 */
export async function chargeCeiling(
  db: DomainDatabase,
  principal: CeilingPrincipal,
  action: CeilingedAction,
  now: Date = new Date(),
): Promise<CeilingOutcome> {
  const ceiling = CEILINGS[action][principal.scope];

  // An action charged against a scope it declares no ceiling for is not
  // "unlimited", it is a caller asking the wrong question. Allowing is the only
  // answer that is not a lie, and the registry is what a reviewer checks.
  if (!ceiling) return { allowed: true };

  const windowStart = windowStartFor(now, ceiling.windowSeconds);

  const [row] = await db
    .insert(rateCounter)
    .values({ principal: principalKey(principal), action, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateCounter.principal, rateCounter.action, rateCounter.windowStart],
      set: { count: sql`${rateCounter.count} + 1` },
    })
    .returning({ count: rateCounter.count });

  // `RETURNING` on an upsert that matched or inserted always yields one row, so
  // no row means the statement did something this code does not model. Failing
  // closed is the rule; a missing row is not permission.
  const count = row?.count;
  if (count === undefined) {
    throw new AppError({
      code: "rate_counter_write_failed",
      status: 503,
      message:
        `Charging the ${action} ceiling returned no row, so the count is unknown and the ` +
        "action must not proceed. NFR26's counter fails closed.",
      userMessage: SERVICE_UNAVAILABLE,
      context: { action, scope: principal.scope },
    });
  }

  if (count <= ceiling.max) return { allowed: true };

  const retryAfter = retryAfterFor(now, ceiling.windowSeconds);

  return {
    allowed: false,
    retryAfter,
    error: new AppError({
      code: "rate_limited",
      status: 429,
      message:
        `The ${action} ceiling refused a request: ${count} charges against a ${principal.scope} ` +
        `principal in a ${ceiling.windowSeconds}s window, over the ceiling of ${ceiling.max}.`,
      userMessage: ceilingUserMessage(ceiling, retryAfter),
      /**
       * **Counts and enum values only — and deliberately no principal at all.**
       *
       * An earlier version put the hashed principal here, on the argument that a
       * hash is not an address. That argument covers the row at rest and does
       * *not* cover this field: `context` reaches the log line, NFR18 allows
       * **0** lines carrying an email address, and an unsalted digest of one is
       * a stable identifier an attacker holding the log can confirm a guess
       * against. It also bought an operator nothing they could act on, since
       * they cannot reverse it either.
       *
       * What is left is what a refusal is actually about: which ceiling, how far
       * over, and when it resets.
       */
      context: {
        action,
        scope: principal.scope,
        count,
        max: ceiling.max,
        // `snake_case` on the line, whatever the source calls it (ADR-0005).
        // The refusal's own `retryAfter` stays camelCase: that one is a
        // TypeScript field a surface reads, not a field on a log line.
        retry_after: retryAfter,
      },
    }),
  };
}

/**
 * **The pooled bindings: what a Server Action calls.**
 *
 * ADR-0010 withholds `#connection`, so `apps/web` has no handle to pass — which
 * is the one place the handle-first rule cannot be literal. The binding is one
 * line, and the function it binds is the one seam 2 exercises against PGlite.
 * This is the shape `./offers`, `./exchange`, `./moderation` and `./export`
 * copy.
 *
 * **Named `ceilings` rather than `rateLimit`**, because `@repo/domain` already
 * exports a `rateLimit` — Better Auth's own limiter table, re-exported through
 * `#schema` for its adapter. Two unrelated things under one name in one package
 * is a collision waiting for the first reader who greps. These ceilings are
 * NFR26's and they count in `rate_counter`; that table is Better Auth's and it
 * counts `/api/auth/*`.
 *
 * **The import is dynamic, and that is not style.** `#connection` carries
 * `import "server-only"`, which resolves to an empty module under the
 * `react-server` condition and to a bare `throw` under every other — and plain
 * `node`, which is what a Node-environment Vitest file is, sets none. A static
 * import here would therefore make this whole module unimportable at seam 1 and
 * at seam 2, which is the same bridging problem the ticket raised, one level up:
 * the query module would again be untestable through its own exported functions.
 * Deferring it to the call keeps `server-only` doing its job on the path that
 * has a browser to protect, and off the path that has none. It also matches what
 * `db()` already does — the pool opens on first use, not at import.
 *
 * Every later query module's binding takes this shape for the same reason.
 */
export const ceilings = {
  async charge(principal: CeilingPrincipal, action: CeilingedAction): Promise<CeilingOutcome> {
    const { db } = await import("#connection");
    return chargeCeiling(db(), principal, action);
  },
};
