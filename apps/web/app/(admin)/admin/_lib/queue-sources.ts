/**
 * The queue's sources, as a registry the shell renders and later stories plug
 * into.
 *
 * **No `import "server-only"`, and that is ADR-0013's table applied rather than
 * skipped.** Mechanism 2 is for a module that is Next-only; this one holds three
 * types, an empty array and a pure function over dates. What actually needs
 * guarding is the database read inside a future `load`, and that is guarded where
 * it lives — `@repo/domain`'s `exports` map withholds the connection outright
 * (mechanism 1, the strongest form), and `#connection` carries the marker itself.
 * A marker here would add no guard and would make `oldestAgeInHours` untestable at
 * `web:test`, since a Node-environment Vitest run sets no `react-server` condition
 * and `server-only` throws there. Which is how this comment came to exist.
 *
 * **It is empty today, and that is not a placeholder.** All five of the spec's
 * branches — unreviewed Offers, unreviewed photos, Reports, Skill requests, and
 * profiles awaiting takedown review — read tables that stories 7, 8, 10 and 3
 * create. There is nothing to list, and an empty registry renders the state the
 * acceptance criterion names: _"queue empty is a real and good state and says the
 * oldest-item age is zero"_. A stubbed source returning invented rows would make
 * this screen look finished while showing an Admin data that is not there, which
 * is the one thing a moderation queue must never do.
 *
 * **What is real is the shape.** A source declares its name, and a `load` that
 * answers its items plus the two figures NFR7 is measured on. Story 7 adds a row;
 * the shell, the per-source skeletons, the named failure state and the empty state
 * are already here and already tested.
 *
 * **Each branch is `LIMIT`-capped for display while its count and age-of-oldest
 * are computed over the whole branch** (C55). That is a property of a `load`
 * implementation rather than of this type, and it is written here because the
 * first person to add a source is the person who would otherwise cap all three
 * together — leaving a queue that reports a depth of 20 when 400 Offers are
 * waiting, which is NFR7's detector silently disabled.
 */

/** One row a person acts on. `id` is what an Admin action names as its target. */
export interface QueueItem {
  readonly id: string;
  /** What a person reads. Built by the source, never from a field somebody typed. */
  readonly summary: string;
  /** When it arrived. The oldest across all sources is what renders first. */
  readonly arrivedAt: Date;
}

export interface QueueBranch {
  /** Capped for display (C55). */
  readonly items: readonly QueueItem[];
  /** Counted over the whole branch, not over `items`. */
  readonly total: number;
  /** The oldest item's arrival across the whole branch, or `null` when empty. */
  readonly oldestArrivedAt: Date | null;
}

export interface QueueSource {
  /** English identifier, per ADR-0012 — it is a key, not a heading. */
  readonly key: string;
  /** The Spanish heading, and the noun `sourceFailed` puts in its sentence. */
  readonly label: string;
  readonly load: () => Promise<QueueBranch>;
}

/**
 * Story 7 ([#21](https://github.com/m0t0r/recomencemos/issues/21)) adds the first
 * row. Until then the queue is empty, honestly.
 */
export const QUEUE_SOURCES: readonly QueueSource[] = [];

/**
 * The age of the oldest item across every source, in whole hours — NFR7's number,
 * and the one that renders first.
 *
 * **An empty queue is `0`, not "no answer", and the acceptance criterion is
 * explicit about it**: _"queue empty is a real and good state and **says the
 * oldest-item age is zero**"_. A first draft returned `null` here and rendered a
 * sentence instead, on the argument that the age of a set with no members is
 * undefined rather than zero. That argument is true and beside the point: this is
 * a health figure read against NFR7's 24-hour band, an Admin scans it to find out
 * how bad today is, and **0** is the good value they are scanning for. A sentence
 * where a number belongs breaks the scan and contradicts the criterion.
 *
 * **A source that failed is not zero either, and that is why it is not this
 * function's problem.** The page passes only the branches that loaded, and the
 * `SourceFailed` card beside this figure is what says the depth is unknown — one
 * fact per element, rather than a number that has to mean two things.
 *
 * The clock is a parameter so the page reads it once and every figure on the
 * screen agrees — and so that under Cache Components nothing below this reads the
 * current time, which is what fails a prerender with
 * `blocking-prerender-current-time`.
 */
export function oldestAgeInHours(branches: readonly QueueBranch[], now: Date): number {
  const oldest = branches
    .map((branch) => branch.oldestArrivedAt)
    .filter((at): at is Date => at !== null)
    .reduce<Date | null>((earliest, at) => (!earliest || at < earliest ? at : earliest), null);

  if (!oldest) return 0;

  // Never negative: clock skew between the app server and Postgres can put an
  // arrival marginally in the future, and "-1 h" reads as a bug in the queue
  // rather than in a clock.
  return Math.max(0, Math.floor((now.getTime() - oldest.getTime()) / 3_600_000));
}
