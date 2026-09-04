/**
 * NFR7's oldest-item arithmetic, which is the one figure on `/admin` that is
 * computed rather than displayed.
 *
 * Pure, so it is tested here rather than at seam 3: the clock is a parameter
 * precisely so that "19 hours old" is a fact a test can fix instead of a race
 * against the wall clock.
 */

import {
  isPastBand,
  liveSources,
  oldestAgeInHours,
  pendingSources,
  QUEUE_SOURCES,
  type QueueBranch,
  sourceForSegment,
} from "./queue-sources";

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

describe("the band", () => {
  const late = (hours: number): QueueBranch => branch(new Date(NOW.getTime() - hours * 3_600_000));

  /**
   * **Only Offers have a band, and inventing one for the other four would be a
   * spec amendment.** NFR7 states one number and states it per Offer; the surface
   * brief says the rest of it — a Report or a Skill request has no equivalent
   * clock. A section with no band is never marked, which is the honest answer
   * rather than a lenient one.
   */
  it("never marks a section that is held to no band", () => {
    expect(isPastBand(late(400), null, NOW)).toBe(false);
  });

  /**
   * `>=`, not `>`. An item that has reached the band has reached it, and a
   * detector that waited for the twenty-fifth hour would report green for the
   * whole of the hour the requirement is about.
   */
  it("marks a section whose oldest item has reached the band", () => {
    expect(isPastBand(late(24), 24, NOW)).toBe(true);
    expect(isPastBand(late(23), 24, NOW)).toBe(false);
    expect(isPastBand(late(48), 24, NOW)).toBe(true);
  });

  /** Nothing is late when nothing is waiting. */
  it("never marks a section with nothing in it", () => {
    expect(isPastBand(branch(null, 0), 24, NOW)).toBe(false);
  });
});

describe("the source registry", () => {
  /**
   * **Five, and a sixth is a spec amendment rather than a ticket.** Story 7 names
   * them: unreviewed Offers, unreviewed photos, Reports, Skill requests and
   * bounced addresses. Frozen Hirers are deliberately absent — a freeze is reached
   * *from* a Report, so it lives on those rows.
   */
  // Story 7 names the five: unreviewed Offers, unreviewed photos, Reports,
  // Skill requests and bounced addresses.
  it("holds the five kinds of pending work, in nav order", () => {
    expect(QUEUE_SOURCES.map((source) => source.segment)).toEqual([
      "offers",
      "photos",
      "reports",
      "skills",
      "bounces",
    ]);
  });

  /**
   * **English segments and keys, Spanish labels** (ADR-0012). The URL is an
   * identifier and not UI copy; the label is the only one of the three a person
   * reads. This is the assertion that would have caught the spec routing the whole
   * product in Spanish before a human did.
   */
  it("routes in English and speaks in Spanish", () => {
    for (const source of QUEUE_SOURCES) {
      expect(source.segment).toMatch(/^[a-z][a-z-]*$/);
      expect(source.key).toMatch(/^[a-zA-Z]+$/);
      expect(source.label.trim().length).toBeGreaterThan(0);
    }
  });

  /**
   * **Only Offers carry a band today**, for the reason the band cases above
   * record. This is what makes adding one elsewhere a deliberate edit rather than
   * something that arrives with a copy-pasted row.
   */
  // NFR7's 24 hours is the one band this product states, and it states it per
  // Offer.
  it("holds the twenty-four-hour band on Offers and on nothing else", () => {
    const banded = QUEUE_SOURCES.filter((source) => source.bandHours !== null);
    expect(banded.map((source) => source.segment)).toEqual(["offers"]);
    expect(banded[0]?.bandHours).toBe(24);
  });

  /**
   * **A source without a resolver is absent, not stubbed.** A stubbed source
   * returning invented rows would make the queue look finished while showing an
   * Admin data that is not there, which is the one thing a moderation queue must
   * never do. The story that adds each resolver edits this list in the same commit
   * that makes it true — and #111 deletes the coverage line when the last one
   * lands.
   */
  it("has a resolver only where the data exists", () => {
    expect(liveSources().map((source) => source.segment)).toEqual(["skills"]);
    expect(pendingSources().map((source) => source.segment)).toEqual([
      "offers",
      "photos",
      "reports",
      "bounces",
    ]);
  });

  it("finds a section by the segment its route carries", () => {
    expect(sourceForSegment("skills")?.key).toBe("skillRequests");
    // A segment nobody routed is a 404 from the router, never a section.
    expect(sourceForSegment("hirers")).toBeUndefined();
  });
});
