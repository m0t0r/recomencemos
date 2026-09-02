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
import { lt, sql } from "drizzle-orm";
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

  /**
   * **The Admin's second factor, bounded per Account** — two actions rather than
   * one, and the split is the requirement rather than a refinement of it.
   *
   * The bound these replace was Better Auth's: ten consecutive failures then
   * fifteen minutes, counted per account across factors, which went with the
   * plugin when the Admin door stopped being a credential path. DD5 is explicit
   * that the replacement is an NFR26 ceiling **scoped to the Account** and that a
   * per-IP bound is not an acceptable substitute — six digits against an
   * attacker who can rotate addresses is a matter of hours.
   *
   * **Same number, separate counters.** The number is the plugin's own, restated
   * rather than reconsidered; what is new is that exhausting one does not close
   * the other. That is what lets the door tell somebody who has mistyped six
   * digits ten times that a printed code still works — a sentence that is only
   * worth saying because it is true, and it is only true because these are two
   * rows.
   *
   * **Nothing charges them yet, and that is deliberate.** The door that reads a
   * code arrives in its own ticket; the enrolment that creates a factor to check
   * against arrives here. Both values have to exist in the `CHECK` on
   * `rate_counter.action` before the first charge, and that constraint is
   * generated from this registry — so a ceiling declared here is how the
   * migration gets written, and a literal in the constraint would be the second
   * spelling of this set that `inList` exists to prevent.
   */
  verifyAdminTotp: {
    account: { max: 10, windowSeconds: 15 * 60 },
  },
  verifyAdminBackupCode: {
    account: { max: 10, windowSeconds: 15 * 60 },
  },

  /**
   * **`publishProfile`, per Account and per IP** — NFR26's own row, and DD7's
   * answer to the first Worker-side abuse case: many profiles from throwaway
   * addresses, each with a zero Offer count, to sit on top of the browse
   * order. One profile per Account is the unique constraint's half; this is the
   * rate's half. The window is a calendar day rather than a rolling one, which
   * is what lets the refusal say when it resets.
   *
   * **A failed attempt is charged.** The action charges before its body runs,
   * so a submission the rejector refuses spends one of the three — which is the
   * case the seventh state exists for: a Worker who trips this after two
   * refusals meets a sentence rather than silence.
   */
  publishProfile: {
    account: { max: 3, windowSeconds: 24 * 60 * 60 },
    ip: { max: 3, windowSeconds: 24 * 60 * 60 },
  },
} as const satisfies Record<string, Partial<Record<CeilingScope, Ceiling>>>;

export type CeilingedAction = keyof typeof CEILINGS;

/**
 * The ceiling one action declares for one scope, or nothing.
 *
 * **A function rather than `CEILINGS[action][scope]`**, because the registry's
 * entries stopped having the same shape the moment a second ceiling was charged
 * against something other than an address: indexing the union of
 * `{ address, ip }` and `{ account }` by a `CeilingScope` is an error, correctly.
 * Widening to the type the registry already `satisfies` is what answers it, and
 * doing that here means one widening in this module rather than one at every
 * reader.
 */
export function ceilingFor(action: CeilingedAction, scope: CeilingScope): Ceiling | undefined {
  const scopes: Partial<Record<CeilingScope, Ceiling>> = CEILINGS[action];
  return scopes[scope];
}

/**
 * The registry's keys, as the array `#schema`'s `CHECK` on `rate_counter.action`
 * is written from — so the set the application validates against and the set the
 * engine enforces are one object rather than two spellings (see `inList` in
 * `#column-types`).
 */
export const CEILINGED_ACTIONS = Object.keys(CEILINGS) as readonly CeilingedAction[];

/**
 * How long a settled window's row is kept before {@link chargeCeiling} sweeps
 * it: twice the longest window any ceiling declares, so a row is only deleted
 * when no window that could still be charged can reach it.
 *
 * The sweep exists because nothing else deletes from `rate_counter` — without
 * it the table accretes one row per principal, action and window forever, and
 * a caller rotating principals mints a permanent row per request. Better Auth's
 * own limiter table prunes itself the same way, on the charge path.
 */
export const RATE_COUNTER_RETENTION_SECONDS =
  2 *
  Math.max(
    ...Object.values(CEILINGS).flatMap((scopes) =>
      Object.values(scopes).map((ceiling) => ceiling.windowSeconds),
    ),
  );

/**
 * Who a ceiling is charged against.
 *
 * `address` rather than `account` for the first one, because
 * `requestMagicLink` is charged **before** an Account exists — which is also why
 * `rate_counter.principal` is a `TEXT` key and not a foreign key.
 *
 * `account` arrives with the Admin's second factor, where it is the whole point:
 * DD5 rebuilds the plugin's per-account lockout as a ceiling and says in as many
 * words that a per-IP bound is not a substitute for it.
 */
export type CeilingScope = "address" | "ip" | "account";

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
 * The one string a person reads when a ceiling refuses her, **per action**.
 *
 * Refusal tone, per the voice guide's matrix: Optimism 3→4, Energy 2→1, Warmth 5
 * unchanged — _"the refusal is our rule, never her mistake"_. Each is at most
 * three sentences, each under twenty words: what our rule is with her count in
 * it, when it changes, and — where there is one — the door that is still open.
 *
 * **It is a `Record` over the action union rather than one sentence for every
 * ceiling**, and it stopped being one sentence the moment a second ceiling
 * existed. `requestMagicLink`'s copy names links and offers Google; rendering
 * that to an Admin who mistyped a code would be a refusal about something that
 * did not happen, which is the failure Don't 4 is about. The `Record` is what
 * makes the next ceiling's copy a compile error rather than a silently borrowed
 * sentence — the same mechanism `ADMIN_ACTION_HANDLERS` uses over its own
 * registry.
 */
export const CEILING_REFUSALS: Record<
  CeilingedAction,
  (ceiling: Ceiling, retryAfter: number) => string
> = {
  /**
   * The last sentence is the spec's own requirement for this surface — _"the
   * Google door is still there"_ — and it is why a rate-limited sign-in is not a
   * dead end.
   */
  requestMagicLink: (ceiling, retryAfter) =>
    `Pediste ${ceiling.max} enlaces en una hora, que es el máximo. ` +
    `Puedes pedir otro ${retryPhrase(retryAfter)}. ` +
    "Mientras tanto, puedes entrar con Google.",

  /**
   * **The third sentence arrived with the door**, which is where it was left
   * when this entry was written with two. It names the way through rather than
   * a second door, and it is true precisely because these two ceilings count
   * separately: exhausting the six digits leaves the ten printed codes
   * untouched, so an Admin locked out of the authenticator is not locked out of
   * the platform.
   *
   * **It says "de respaldo", which is the name she has already met.** The
   * enrolment screen headed them _"Tus códigos de respaldo"_ and gave her a copy
   * button rather than a print one, so a lockout that told her to find something
   * "impreso" would name a thing nobody asked her to make — and would be the one
   * word in this product that only its authors can resolve.
   */
  verifyAdminTotp: (ceiling, retryAfter) =>
    `Escribiste ${ceiling.max} códigos incorrectos, que es el máximo. ` +
    `Puedes intentarlo otra vez ${retryPhrase(retryAfter)}. ` +
    "Si guardaste un código de respaldo, ese sí funciona.",

  /**
   * **Two sentences, and the third is deliberately absent here.** Its mirror
   * image would send the reader back to the authenticator, which is where she
   * already failed — someone typing printed codes is someone whose phone is
   * gone. Naming a door she cannot reach is Don't 4, so this one stops at when.
   */
  verifyAdminBackupCode: (ceiling, retryAfter) =>
    `Escribiste ${ceiling.max} códigos de respaldo incorrectos, que es el máximo. ` +
    `Puedes intentarlo otra vez ${retryPhrase(retryAfter)}.`,

  /**
   * `docs/policy/voice.md`'s own before/after for this ceiling, example 2: the
   * count is quoted back (Do 4), what to do next is in the same breath (Do 3),
   * and the last sentence is the one the spec's seventh state names — _that
   * nothing she typed was lost_. "Intentaste" rather than "publicaste", because
   * the count includes the attempts the rejector refused, and a sentence that
   * told her she had published three times would be false.
   */
  publishProfile: (ceiling, retryAfter) =>
    `Intentaste publicar ${ceiling.max} veces hoy, que es el máximo. ` +
    `Puedes intentarlo otra vez ${retryPhrase(retryAfter)}. ` +
    "Nada de lo que escribiste se perdió: sigue aquí.",
};

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
  const ceiling = ceilingFor(action, principal.scope);

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

  // The sweep. On the charge path rather than a scheduler, because a counter
  // that is being charged is the one moment the table is guaranteed to have a
  // caller paying attention — and charges are bounded by the ceilings
  // themselves, so the extra statement is bounded with them.
  await db
    .delete(rateCounter)
    .where(
      lt(rateCounter.windowStart, new Date(now.getTime() - RATE_COUNTER_RETENTION_SECONDS * 1000)),
    );

  // `RETURNING` on an upsert that matched or inserted always yields one row, so
  // no row means the statement did something this code does not model. Failing
  // closed is the rule (NFR26); a missing row is not permission.
  const count = row?.count;
  if (count === undefined) {
    throw new AppError({
      code: "rate_counter_write_failed",
      status: 503,
      message:
        `Charging the ${action} ceiling returned no row, so the count is unknown and the ` +
        "action must not proceed. This counter fails closed.",
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
      userMessage: CEILING_REFUSALS[action](ceiling, retryAfter),
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
