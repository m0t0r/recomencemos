/**
 * @vitest-environment node
 *
 * NFR7's oldest-item arithmetic, which is the one figure on `/admin` that is
 * computed rather than displayed.
 *
 * Pure, so it is tested here rather than at seam 3: the clock is a parameter
 * precisely so that "19 hours old" is a fact a test can fix instead of a race
 * against the wall clock.
 *
 * **A Node environment, because the module under test binds three domain
 * facades** and a facade imports the pooled connection, whose package refuses to
 * load where a `window` exists. Nothing here asserts against a DOM.
 */

import { OFFER_WORKER_PROFILE_FIELD, workerPausedSince } from "./messages";
import {
  isPastBand,
  liveSources,
  oldestAgeInHours,
  pendingSources,
  QUEUE_SOURCES,
  type QueueBranch,
  type QueueItem,
  queueRows,
  type QueueSource,
  type SectionState,
  waitingAcross,
} from "./queue-sources";

/**
 * **The Offers read is doubled, and only it.** The branch's `load` is the thing
 * under test — what an item may carry — and the read behind it is seam 2's, where
 * `pendingOffers` is asserted against PGlite. Nothing else in this file calls a
 * facade, so the other two stay real.
 */
const { pending } = vi.hoisted(() => ({ pending: vi.fn() }));

vi.mock("@repo/domain/offers", () => ({ offers: { pending } }));

const NOW = new Date("2026-08-29T12:00:00.000Z");

const branch = (oldestArrivedAt: Date | null, total = 1): QueueBranch => ({
  items: [],
  total,
  oldestArrivedAt,
});

const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000);

const anItem = (id: string, hours: number): QueueItem => ({
  id,
  summary: `Elemento ${id}`,
  arrivedAt: hoursAgo(hours),
});

const aSource = (key: string, bandHours: number | null = null): QueueSource => ({
  key,
  label: `Fuente ${key}`,
  bandHours,
});

const loaded = (items: readonly QueueItem[], total = items.length): SectionState => ({
  status: "loaded",
  branch: {
    items,
    total,
    oldestArrivedAt: items.reduce<Date | null>(
      (oldest, item) => (!oldest || item.arrivedAt < oldest ? item.arrivedAt : oldest),
      null,
    ),
  },
});

describe("queueRows", () => {
  /**
   * **One list, oldest first, across every source** — the whole of what the
   * owner chose in the UX lab. Interleaved on purpose: a merge that concatenated
   * branches in registry order would pass a test whose sources happened to
   * arrive already sorted.
   */
  it("puts every source in one list, oldest first", () => {
    const rows = queueRows(
      [
        { source: aSource("offers", 24), state: loaded([anItem("o1", 5), anItem("o2", 30)]) },
        { source: aSource("photos"), state: loaded([anItem("p1", 12)]) },
        { source: aSource("skillRequests"), state: loaded([anItem("s1", 40)]) },
      ],
      NOW,
    );

    expect(rows.map((row) => row.item.id)).toEqual(["s1", "o2", "p1", "o1"]);
    expect(rows.map((row) => row.ageHours)).toEqual([40, 30, 12, 5]);
  });

  /**
   * **A source that failed or has no resolver contributes no rows, and is not
   * silently zero.** Its absence is said elsewhere — the failure card names it
   * and the coverage line names the rest — so this function's job is only not to
   * invent anything for it.
   */
  it("skips a source that failed and a source that is not counting", () => {
    const rows = queueRows(
      [
        { source: aSource("offers", 24), state: loaded([anItem("o1", 5)]) },
        { source: aSource("photos"), state: { status: "failed" } },
        { source: aSource("reports"), state: { status: "absent" } },
      ],
      NOW,
    );

    expect(rows.map((row) => row.sourceKey)).toEqual(["offers"]);
  });

  /**
   * **A photo is keyed by its profile and an Offer by its own id**, so nothing
   * stops two sources sharing an id. The key is what the table selects, expands
   * and hands focus by — two rows answering to one key would move the cursor
   * onto a row the Admin was not looking at.
   */
  it("keys each row so two sources can never collide", () => {
    const rows = queueRows(
      [
        { source: aSource("offers", 24), state: loaded([anItem("same", 5)]) },
        { source: aSource("photos"), state: loaded([anItem("same", 6)]) },
      ],
      NOW,
    );

    expect(new Set(rows.map((row) => row.key)).size).toBe(2);
  });

  /**
   * **Late is the row's own source's band, and only Offers have one.** A photo
   * four hundred hours old is not marked, for the reason `isPastBand` records:
   * nothing is late against a clock nobody set.
   */
  it("marks a row late against its own source's band", () => {
    const rows = queueRows(
      [
        { source: aSource("offers", 24), state: loaded([anItem("late", 24), anItem("fine", 23)]) },
        { source: aSource("photos"), state: loaded([anItem("old", 400)]) },
      ],
      NOW,
    );

    expect(Object.fromEntries(rows.map((row) => [row.item.id, row.late]))).toEqual({
      old: false,
      late: true,
      fine: false,
    });
  });
});

describe("waitingAcross", () => {
  /**
   * **C55 as a test: the whole branch's count, never the rendered rows.** Each
   * branch is capped for display, so a headline summing `items.length` would say
   * forty while four hundred wait — the queue's depth detector reading a number
   * that cannot exceed the display cap.
   */
  it("sums each whole branch rather than the rows that render", () => {
    expect(waitingAcross([branch(hoursAgo(3), 412), branch(null, 0), branch(hoursAgo(1), 7)])).toBe(
      419,
    );
  });
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
  it("holds the five kinds of pending work", () => {
    expect(QUEUE_SOURCES.map((source) => source.key)).toEqual([
      "offers",
      "photos",
      "reports",
      "skillRequests",
      "bounces",
    ]);
  });

  /**
   * **English keys, Spanish labels** (ADR-0012). The key is an identifier and not
   * UI copy; the label is the only one of the two a person reads. This is the
   * assertion that would have caught the spec naming the whole product in Spanish
   * before a human did.
   */
  it("names in English and speaks in Spanish", () => {
    for (const source of QUEUE_SOURCES) {
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
    expect(banded.map((source) => source.key)).toEqual(["offers"]);
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
    expect(liveSources().map((source) => source.key)).toEqual([
      "offers",
      "photos",
      "skillRequests",
    ]);
    expect(pendingSources().map((source) => source.key)).toEqual(["reports", "bounces"]);
  });
});

/**
 * **Her Pause, where an Admin sees her** (story 25). The queue is not changed by
 * a pause — an Offer sent before it is still read and delivered — but the Admin
 * delivering it is told she is not on the site right now, as one more field on
 * the item. It is present only while she is paused, so the three terms stay the
 * whole row for everybody else.
 */
/** One pending Offer as `offers.pending` returns it, to a Worker paused since `workerPausedAt` or not. */
function anOffer(id: string, workerPausedAt: Date | null) {
  return {
    id,
    workDescription: "Cocinar para ocho personas el sábado",
    payTerms: "$120.000 por el día",
    whenText: "El sábado",
    sentAt: new Date("2026-09-10T12:00:00.000Z"),
    workerFirstName: "Lucía",
    workerLastInitial: "M",
    workerPausedAt,
    hirerName: "Carlos Restrepo",
  };
}

/** The Offers section's branch, through the registry the shell renders from. */
async function loadOffers() {
  const source = sourceForSegment("offers");
  if (!source?.load) throw new Error("the Offers section has no resolver");
  return source.load();
}

describe("the Offers branch", () => {
  const PAUSED_AT = new Date("2026-09-11T14:00:00.000Z");

  it("says since when she is paused, on an Offer to a paused Worker", async () => {
    pending.mockResolvedValue({
      items: [anOffer("a", PAUSED_AT)],
      total: 1,
      oldestSentAt: new Date("2026-09-10T12:00:00.000Z"),
    });

    const [item] = (await loadOffers()).items;

    expect(item?.fields).toContainEqual({
      label: OFFER_WORKER_PROFILE_FIELD,
      value: workerPausedSince(PAUSED_AT),
    });
  });

  it("carries only the three terms for a Worker who is not paused", async () => {
    pending.mockResolvedValue({
      items: [anOffer("b", null)],
      total: 1,
      oldestSentAt: new Date("2026-09-10T12:00:00.000Z"),
    });

    const [item] = (await loadOffers()).items;

    expect(item?.fields).toHaveLength(3);
    expect(item?.fields?.map((field) => field.label)).not.toContain(OFFER_WORKER_PROFILE_FIELD);
  });
});
