/**
 * The two orderings the public lists use, and the keyset page they are read in.
 *
 * **The Wall is newest first; browse puts the fewest delivered Offers first.**
 * Two lists over the same rows, and the second is the whole of the attention
 * spread this product commits to: a Hirer who browses meets the people nobody
 * has contacted yet before he meets the ones everybody has.
 *
 * **Every term is a stored column.** That is a design decision recorded in the
 * spec's schema deep dive rather than an implementation detail — `rotationKey`
 * is an integer rewritten daily instead of `random()` or a hash of the clock,
 * because a sort expression the planner cannot read off an index destroys
 * keyset pagination as well as the index: page two would be drawn from a
 * different ordering than page one, so the reader would see some profiles twice
 * and never see others. The fairness mechanism would defeat itself.
 *
 * The comparators below are that ordering written once, in the form a test can
 * evaluate. The engine does the actual sorting — these are what the integration
 * suite holds it to, and what makes the fairness property checkable at all
 * without a database.
 *
 * Pure: no clock, no connection, no import of a module that has either.
 */

/** The Wall's ordering terms. */
export interface NewestOrder {
  readonly publishedAt: Date;
  readonly id: bigint;
}

/** Browse's ordering terms. */
export interface AttentionSpreadOrder {
  readonly deliveredOfferCount: number;
  readonly rotationKey: number;
  readonly id: bigint;
}

/**
 * How many profiles one page carries.
 *
 * One number for both lists, because they render the same card in the same grid
 * and a person moving between them should not meet a different rhythm. Twenty-four
 * divides by two, three and four, so no breakpoint ends on a ragged row.
 */
export const PAGE_SIZE = 24;

function compareBigInt(left: bigint, right: bigint): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

/**
 * Newest first, and the id breaks the tie — descending, matching the index.
 *
 * The tiebreaker is not decoration. Two profiles published in the same instant
 * are unlikely and not impossible, and without a total order a keyset page can
 * repeat a row or step over one.
 */
export function compareByNewest(left: NewestOrder, right: NewestOrder): number {
  const byPublished = right.publishedAt.getTime() - left.publishedAt.getTime();
  if (byPublished !== 0) return byPublished;
  return compareBigInt(right.id, left.id);
}

/**
 * Fewest delivered Offers first, then the rotation key, then the id — all
 * ascending, matching the index.
 *
 * **The middle term is the one doing the work.** Delivered-Offer counts cluster
 * hard at zero early on, so without it the whole front of the list would be
 * ordered by id and would sit in that order every day until somebody was
 * contacted. The rotation key is what makes "fewest first" a rotation rather
 * than a queue.
 */
export function compareByAttentionSpread(
  left: AttentionSpreadOrder,
  right: AttentionSpreadOrder,
): number {
  const byDelivered = left.deliveredOfferCount - right.deliveredOfferCount;
  if (byDelivered !== 0) return byDelivered;

  const byRotation = left.rotationKey - right.rotationKey;
  if (byRotation !== 0) return byRotation;

  return compareBigInt(left.id, right.id);
}

export interface Page<T> {
  readonly items: readonly T[];
  /**
   * The slug to continue from, or `null` when this is the last page.
   *
   * **The cursor is the slug and never the primary key.** The key is a `BIGINT`
   * that the schema keeps off every boundary — publishing it in a query
   * parameter would put the platform's profile count in a URL — and the slug is
   * already the opaque public handle, minted from random bytes and derived from
   * no part of her name, city or Skills.
   */
  readonly nextCursor: string | null;
}

/**
 * Turn `limit + 1` read rows into a page of `limit` and an honest cursor.
 *
 * **The caller reads one row more than it shows, and that extra row is the
 * whole point.** Deciding "there is more" from a full page instead sends the
 * reader to an empty page every time the list length divides by the page size —
 * a bug that is invisible until a list happens to be exactly 24 long.
 */
export function pageOf<T extends { readonly slug: string }>(
  rows: readonly T[],
  limit: number,
): Page<T> {
  if (rows.length <= limit) return { items: rows, nextCursor: null };

  const items = rows.slice(0, limit);
  const last = items.at(-1);

  return { items, nextCursor: last ? last.slug : null };
}
