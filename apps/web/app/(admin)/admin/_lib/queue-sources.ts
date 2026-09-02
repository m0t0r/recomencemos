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
 * **It holds one source, and the other four are still absent rather than
 * stubbed.** Unreviewed Offers, unreviewed photos, Reports and profiles awaiting
 * takedown review read tables that stories 7, 8 and 10 create, so there is
 * nothing to list and nothing here pretending otherwise. A stubbed source
 * returning invented rows would make this screen look finished while showing an
 * Admin data that is not there, which is the one thing a moderation queue must
 * never do.
 *
 * **Skill requests are here because story 3 carries both halves of its own
 * loop.** The story's own argument is that a queue item whose resolver is a
 * lower-priority story is a queue item that accumulates — so the source and the
 * promotion that empties it arrived together, and the shell it plugs into was
 * already built and already tested.
 *
 * **The shape is what the registry publishes.** A source declares its name and a
 * `load` that answers its items plus the two figures the queue's health is
 * measured on. The per-source skeletons, the named failure state and the empty
 * state come with it.
 *
 * **Each branch is `LIMIT`-capped for display while its count and age-of-oldest
 * are computed over the whole branch** (C55). That is a property of a `load`
 * implementation rather than of this type, and it is written here because the
 * first person to add a source is the person who would otherwise cap all three
 * together — leaving a queue that reports a depth of 20 when 400 Offers are
 * waiting, which is NFR7's detector silently disabled.
 */

import { skills } from "@repo/domain/skills";
import { SKILL_REQUESTS_LABEL } from "./messages";

/** One row a person acts on. `id` is what an Admin action names as its target. */
export interface QueueItem {
  readonly id: string;
  /**
   * What a person reads.
   *
   * **Usually built by the source rather than taken from a field somebody typed**
   * — a summary assembled from ids and states cannot carry anything an Admin was
   * not meant to see. The Skill request is the deliberate exception and the
   * reason this sentence is longer than it was: the *item is her sentence*, the
   * spec requires each branch rendered in full so nothing is acted on unread, and
   * an Admin promoting a request has to read the words she actually wrote. It has
   * passed the contact-detail rejector and a length bound before becoming a row,
   * and React escapes it on the way out.
   */
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
 * The sources, in the order they render.
 *
 * Skill requests are the first, because story 3 ships both halves of its own
 * loop. Unreviewed Offers, photos, Reports and profiles awaiting takedown review
 * arrive with the stories that create them.
 */
export const QUEUE_SOURCES: readonly QueueSource[] = [
  {
    key: "skillRequests",
    label: SKILL_REQUESTS_LABEL,
    async load(): Promise<QueueBranch> {
      const branch = await skills.pendingRequests(SKILL_REQUEST_DISPLAY_CAP);

      return {
        items: branch.items.map((request) => ({
          id: request.id,
          summary: request.text,
          arrivedAt: request.requestedAt,
        })),
        total: branch.total,
        oldestArrivedAt: branch.oldestRequestedAt,
      };
    },
  },
];

/**
 * How many requests render at once (C55).
 *
 * **The cap is on the rendering and not on the count**, which the domain read
 * enforces by computing both figures over the whole predicate. Twenty is a
 * screenful an Admin can work through in one sitting; the number beside the
 * heading is what says whether there are more.
 */
export const SKILL_REQUEST_DISPLAY_CAP = 20;

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
