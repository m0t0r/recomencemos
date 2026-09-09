/**
 * `@repo/domain/skills` — reads over the closed vocabulary, the request a Worker
 * makes when it does not hold her trade, and the reason no write here touches the
 * vocabulary itself.
 *
 * **The vocabulary is a migration, not a table this package fills.** DD12 ships
 * the seed as an idempotent migration precisely so the list seam 2 tests against
 * and the list production serves cannot drift; a `seedSkills()` function beside
 * these reads would be a second way to put a row in, and the two would agree
 * until the day they did not. The list grows through Admin promotion, and that
 * write is `#admin`'s rather than this module's — it has to share a transaction
 * with the `AdminAction` row that records it, which is the one thing this module
 * cannot offer it.
 *
 * **What this module did gain is the other side of that exchange.** A
 * `SkillRequest` is a Worker's row, written on her own behalf from the publishing
 * form, and it belongs beside the vocabulary it is asking to join. So the split
 * is by who acts: she requests here, an Admin promotes there, and the two meet in
 * a queue rather than in a function.
 *
 * **What crosses is `{ slug, labelEs }` and nothing else.** The row carries a
 * `BIGINT` id, a `cuocCode` and an `active` flag, and none of the three is
 * anybody's business outside this package: the id is a key that reaches no URL,
 * `cuocCode` is provenance for the person maintaining the seed, and `active` is
 * already answered by whether an entry appears at all. Building the shape field
 * by field is [ADR-0003](../../../../docs/adr/0003-no-tojson-on-cross-boundary-types.md)'s
 * rule, and the `mode: "bigint"` id is the backstop underneath it — `JSON.stringify`
 * throws on a `BigInt`, so a row passed whole to a serializer fails loudly rather
 * than publishing a key.
 */

import { asc, count, eq, inArray, min } from "drizzle-orm";
import { db as pooledDatabase } from "#connection";
import type { DomainDatabase } from "#database";
import { type ContactDetailKind, rejectContactDetails } from "#policy/contact-details";
import * as schema from "#schema";

/**
 * One entry of the vocabulary, as it crosses the boundary.
 *
 * `slug` is the identifier a browse filter puts in a query parameter and
 * `labelEs` is the `es-CO` string a person reads — the identifier/value line
 * NFR29 draws, in one object.
 */
export interface VocabularyEntry {
  readonly slug: string;
  readonly labelEs: string;
}

/**
 * The two columns that cross, and the order they cross in, stated once.
 *
 * Both reads below differ only in which rows they want; sharing the projection
 * and the ordering is what leaves that difference visible in the `where` clause
 * instead of buried in two near-identical query builders. It is also the one
 * place ADR-0003's field-by-field whitelist has to be got right — a column added
 * to the table reaches a caller only by being added here, on purpose.
 */
const ENTRY = { slug: schema.skill.slug, labelEs: schema.skill.labelEs };
const RENDERED_ORDER = asc(schema.skill.labelEs);

/**
 * The whole choosable vocabulary, in the order it is rendered.
 *
 * **Ordered by label rather than by insertion**, because the picker and the
 * browse filter both render it to a person and the seed's own row order is the
 * order of nothing. Sorting in the engine rather than in JavaScript is what makes
 * the partial index on `(label_es) WHERE active` the answer to this query instead
 * of decoration.
 *
 * **Retired entries are absent.** A Skill is never deleted — a profile may
 * already point at it — so `active` is how one stops being offered, and this read
 * is the only place that distinction has to be remembered.
 */
export async function listActiveSkills(db: DomainDatabase): Promise<VocabularyEntry[]> {
  return db
    .select(ENTRY)
    .from(schema.skill)
    .where(eq(schema.skill.active, true))
    .orderBy(RENDERED_ORDER);
}

/**
 * The entries for a set of slugs, in the same rendered order.
 *
 * **Retired entries are included here, and that asymmetry with
 * {@link listActiveSkills} is the point.** A Worker who chose a Skill that was
 * later retired still said something true about herself, and a profile that
 * silently dropped it would be the platform editing her words. So one read
 * answers *what may still be chosen* and the other answers *what does this
 * profile hold* — and a caller validating a submission wants the first.
 *
 * **An unknown slug is absent from the result rather than an error.** The caller
 * that cares — the publishing form, checking what was submitted against the
 * closed list — learns it from the count, and the caller that does not is
 * rendering a profile whose rows came from this table in the first place.
 *
 * An empty request is answered without asking the engine: `IN ()` is not valid
 * SQL, and Drizzle's rendering of an empty `inArray` is not a shape worth relying
 * on either way.
 */
export async function findSkillsBySlug(
  db: DomainDatabase,
  slugs: readonly string[],
): Promise<VocabularyEntry[]> {
  if (slugs.length === 0) return [];

  return db
    .select(ENTRY)
    .from(schema.skill)
    .where(inArray(schema.skill.slug, [...slugs]))
    .orderBy(RENDERED_ORDER);
}

/**
 * A request was written, or it was refused for the one reason a request can be.
 *
 * **Returned rather than thrown** (NFR26's second half, C51): a Worker typing her
 * phone number into a field asking what she can do is an ordinary thing to do
 * with a form, and an `AppError` raised on each one would spend the month's
 * Sentry allowance on people using the product correctly.
 */
export type SkillRequestOutcome =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: "contact_detail";
      readonly kind: ContactDetailKind;
      readonly fragment: string;
    };

/**
 * Record a Worker's request for a capability the list does not hold.
 *
 * **The rejector runs here, not only at the boundary** (NFR12, DD3). Every other
 * free-text field on the publishing form is refused in `#profiles`, and this one
 * would be the exception nobody noticed: it is the only free text on that page
 * that no visitor ever reads, so the argument that protects the headline — a
 * phone number published is the consent step routed around — does not obviously
 * reach it. What does reach it is the other half of DD3: an Admin promoting this
 * request copies her sentence into a label the whole product renders, and a
 * number that arrived in a request is a number that leaves in the vocabulary.
 *
 * **No duplicate check, and that is the cheaper mistake.** Two Workers asking for
 * the same trade in different words is the signal an Admin most wants — it is how
 * one request stops looking like one person's idiom — and folding them together
 * on a string comparison would hide it while catching almost nothing, since the
 * whole reason she is typing is that she has her own words for the work.
 */
export async function requestSkill(
  db: DomainDatabase,
  accountId: string,
  text: string,
): Promise<SkillRequestOutcome> {
  const wanted = text.trim();
  const verdict = rejectContactDetails(wanted);

  if (!verdict.ok) {
    return { ok: false, reason: "contact_detail", kind: verdict.kind, fragment: verdict.fragment };
  }

  await db.insert(schema.skillRequest).values({ accountId, text: wanted });

  return { ok: true };
}

/** One waiting request, as it crosses to the Admin queue. */
export interface PendingSkillRequest {
  /**
   * The row's key as a string, because a `BIGINT` read in `mode: "bigint"` is a
   * `BigInt` and `JSON.stringify` throws on one — which is the backstop working,
   * not a problem to route around. The conversion is here, once, rather than at
   * the surface that would otherwise learn what the column's type is.
   */
  readonly id: string;
  /** Her words, unedited. An Admin has to read what she actually wrote. */
  readonly text: string;
  readonly requestedAt: Date;
}

/**
 * The pending branch: the oldest few to render, and the two figures the queue is
 * measured on.
 *
 * **The cap is on the rendering and on nothing else** (C55). `total` and
 * `oldestRequestedAt` are computed over the whole predicate in a second
 * statement, because a branch capped at twenty that also reported a depth of
 * twenty is an instrument that reads healthy exactly when the backlog is worst.
 *
 * Both statements are the partial index's: `WHERE state = 'pending'` is the
 * predicate the index is built on, and `ORDER BY created_at` is its column.
 */
export interface PendingSkillRequests {
  /** Capped for display. */
  readonly items: readonly PendingSkillRequest[];
  /** Counted over the whole branch, not over {@link items}. */
  readonly total: number;
  /** The oldest arrival across the whole branch, or `null` when none is waiting. */
  readonly oldestRequestedAt: Date | null;
}

export async function readPendingSkillRequests(
  db: DomainDatabase,
  limit: number,
): Promise<PendingSkillRequests> {
  const rows = await db
    .select({
      id: schema.skillRequest.id,
      text: schema.skillRequest.text,
      requestedAt: schema.skillRequest.createdAt,
    })
    .from(schema.skillRequest)
    .where(eq(schema.skillRequest.state, "pending"))
    .orderBy(asc(schema.skillRequest.createdAt))
    .limit(limit);

  const [figures] = await db
    .select({ total: count(), oldest: min(schema.skillRequest.createdAt) })
    .from(schema.skillRequest)
    .where(eq(schema.skillRequest.state, "pending"));

  return {
    items: rows.map((row) => ({
      id: String(row.id),
      text: row.text,
      requestedAt: row.requestedAt,
    })),
    // `COUNT(*)` with no `GROUP BY` always returns one row; `?? 0` is the reading
    // that keeps this total honest rather than optimistic if it somehow does not.
    total: figures?.total ?? 0,
    oldestRequestedAt: figures?.oldest ?? null,
  };
}

/**
 * **The pooled bindings: what a Server Component or Server Action calls.**
 *
 * ADR-0010 withholds `#connection`, so `apps/web` has no handle to pass and
 * reaches the database through this object or not at all.
 */
export const skills = {
  async listActive(): Promise<VocabularyEntry[]> {
    return listActiveSkills(pooledDatabase());
  },

  async findBySlug(slugs: readonly string[]): Promise<VocabularyEntry[]> {
    return findSkillsBySlug(pooledDatabase(), slugs);
  },

  async request(accountId: string, text: string): Promise<SkillRequestOutcome> {
    return requestSkill(pooledDatabase(), accountId, text);
  },

  async pendingRequests(limit: number): Promise<PendingSkillRequests> {
    return readPendingSkillRequests(pooledDatabase(), limit);
  },
};
