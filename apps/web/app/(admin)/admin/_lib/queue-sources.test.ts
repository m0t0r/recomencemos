/**
 * NFR7's oldest-item arithmetic, which is the one figure on `/admin` that is
 * computed rather than displayed.
 *
 * Pure, so it is tested here rather than at seam 3: the clock is a parameter
 * precisely so that "19 hours old" is a fact a test can fix instead of a race
 * against the wall clock.
 */

import { oldestAgeInHours, QUEUE_SOURCES, type QueueBranch } from "./queue-sources";

const NOW = new Date("2026-08-29T12:00:00.000Z");

const branch = (oldestArrivedAt: Date | null, total = 1): QueueBranch => ({
  items: [],
  total,
  oldestArrivedAt,
});

describe("oldestAgeInHours", () => {
  /**
   * **Zero, not "no answer"** — the acceptance criterion asks the empty queue to
   * say the oldest-item age *is* zero, and 0 is the good value an Admin scans for
   * against NFR7's 24-hour band. A first draft returned `null` here and rendered a
   * sentence; this is what says the criterion won.
   */
  it("is zero when nothing is waiting", () => {
    expect(oldestAgeInHours([], NOW)).toBe(0);
    expect(oldestAgeInHours([branch(null, 0)], NOW)).toBe(0);
  });

  it("measures from the oldest arrival across every source", () => {
    const ages = [
      branch(new Date("2026-08-29T11:00:00.000Z")),
      branch(new Date("2026-08-28T17:00:00.000Z")),
      branch(new Date("2026-08-29T09:30:00.000Z")),
    ];

    expect(oldestAgeInHours(ages, NOW)).toBe(19);
  });

  /**
   * **A source with nothing in it is skipped, not counted as zero.** Counting it
   * would make the minimum always zero the moment any branch was clear — which is
   * every ordinary day, and would report the queue as fresh while a two-day-old
   * Offer sat in the branch beside it.
   */
  it("ignores a source with nothing in it", () => {
    const ages = [branch(null, 0), branch(new Date("2026-08-28T17:00:00.000Z"))];
    expect(oldestAgeInHours(ages, NOW)).toBe(19);
  });

  /**
   * Floored, so "19 h" never overstates — an Admin reading it against NFR7's
   * 24-hour band should never be told a figure that has rounded *up* past the
   * threshold it is measured on.
   */
  it("floors the hours rather than rounding them", () => {
    expect(oldestAgeInHours([branch(new Date("2026-08-29T11:01:00.000Z"))], NOW)).toBe(0);
    expect(oldestAgeInHours([branch(new Date("2026-08-29T10:59:00.000Z"))], NOW)).toBe(1);
  });

  /**
   * Clock skew between the app server and Postgres can put an arrival marginally
   * in the future. A negative age is not a thing a queue can have, and rendering
   * "-1 h" would look like a bug in the queue rather than in a clock. It is also
   * why zero has to mean two things here — nothing waiting, and something that
   * just arrived — which the `SourceFailed` card beside the figure is what keeps
   * distinct from "we could not tell".
   */
  it("never reports a negative age", () => {
    expect(oldestAgeInHours([branch(new Date("2026-08-29T12:05:00.000Z"))], NOW)).toBe(0);
  });
});

describe("the source registry", () => {
  /**
   * **The registry is empty, deliberately, and this test is what makes that a
   * statement rather than an oversight.**
   *
   * All five of the spec's branches read tables stories 3, 7, 8 and 10 create. A
   * source stubbed to return invented rows would make `/admin` look finished while
   * showing a moderator data that is not there — the one thing a moderation queue
   * must never do. So the queue renders its empty state, honestly, and the story
   * that adds a source deletes this assertion in the same commit that makes it
   * false.
   */
  it("is empty until a story adds a source that has something to list", () => {
    expect(QUEUE_SOURCES).toEqual([]);
  });
});
