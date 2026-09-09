/**
 * The queue's five sections, as a registry the shell renders and each section
 * ticket plugs into.
 *
 * **One route per concern, behind one shell** — the shape #96 settled, replacing
 * the single page that held all five. What that buys is that a section is
 * independently buildable: the shell below already knows how to count a branch,
 * age it, mark it late and say it is missing, so a section arrives by gaining a
 * `load` and nothing else.
 *
 * **No `import "server-only"`, and that is ADR-0013's table applied rather than
 * skipped.** Mechanism 2 is for a module that is Next-only; this one holds types,
 * a registry and pure functions over dates. What needs guarding is the database
 * read inside a `load`, and that is guarded where it lives — `@repo/domain`'s
 * `exports` map withholds the connection outright (mechanism 1, the strongest
 * form), and `#connection` carries the marker itself. A marker here would add no
 * guard and would make the arithmetic below untestable at `web:test`, since a
 * Node-environment Vitest run sets no `react-server` condition and `server-only`
 * throws there. `queue-data.ts` beside this file is where the gate goes.
 *
 * **Four of the five have no `load`, and they are absent rather than stubbed.**
 * Offers, photos, Reports and bounced addresses read tables that stories 6, 8, 10
 * and 15 create. A source with no resolver reports **no count and no age** —
 * never a zero. Zero is the good news an Admin scans for, and reporting it for a
 * branch nobody queried is the instrument that lies about exactly the thing this
 * surface exists to prevent. `coverageNotice` is the visible half of the same
 * fact.
 *
 * **Each branch is `LIMIT`-capped for display while its count and age-of-oldest
 * are computed over the whole branch** (C55). That is a property of a `load`
 * implementation rather than of this type, and it is written here because the
 * first person to add a source is the person who would otherwise cap all three
 * together — leaving a queue that reports a depth of 20 when 400 Offers are
 * waiting, which is NFR7's detector silently disabled.
 */

import { offers } from "@repo/domain/offers";
import { skills } from "@repo/domain/skills";
import {
  BOUNCES_LABEL,
  OFFER_PAY_FIELD,
  OFFER_WHEN_FIELD,
  OFFER_WORK_FIELD,
  offerSummary,
  OFFERS_LABEL,
  PHOTOS_LABEL,
  REPORTS_LABEL,
  SKILL_REQUESTS_LABEL,
} from "./messages";

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
  /**
   * The item's own fields, where one summary line cannot carry it.
   *
   * **Added by the Offers source, and general because the four sections after it
   * have the same shape of problem.** An Offer is three things a person wrote —
   * the work, the pay, the when — and the section's whole rule is that a branch
   * renders in full so nothing is acted on unread. Flattening them into one
   * sentence would either lose a field or invent a separator no reader was
   * promised.
   *
   * **Every value here is built by the source and is subject to NFR11**, exactly
   * as {@link QueueItem.summary} is: what an Offer item may carry is the body and
   * the Worker's display identity, and **no** phone number.
   */
  readonly fields?: readonly { readonly label: string; readonly value: string }[];
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
  /**
   * The route segment under `/admin`. English, per ADR-0012 — a URL is an
   * identifier and not UI copy — and deliberately not the same string as
   * {@link QueueSource.key}: the Skill requests branch is keyed `skillRequests`
   * and routed `skills`, because the key names the thing waiting and the segment
   * names the section.
   */
  readonly segment: string;
  /** The Spanish nav label, page heading, and the noun `sourceFailed` uses. */
  readonly label: string;
  /**
   * The hours this section's oldest item may reach before it is late, or `null`
   * where nothing states one.
   *
   * **Only Offers have a band, and inventing one for the other four would be a
   * spec amendment.** NFR7 states a single number and states it per Offer;
   * `.impeccable/briefs/admin-queue.md` says the rest of it in as many words —
   * _"a Report or a Skill request has no equivalent clock"_. A section with no
   * band is never marked late, which is the honest answer rather than a lenient
   * one.
   */
  readonly bandHours: number | null;
  /**
   * How this section reads its branch, or **absent** while the story that
   * creates its table has not landed. Absence is rendered as absence; see the
   * class comment.
   */
  readonly load?: () => Promise<QueueBranch>;
}

/**
 * The five, in the order they appear in the nav and in the order an Admin works
 * them.
 *
 * **Offers lead, and the redirect at `/admin` follows from it**: they are the
 * only branch with a deadline attached, because NFR7's band is per Offer. A
 * Report or a Skill request has no equivalent clock, so nothing else competes for
 * the first position.
 *
 * A sixth section is a spec amendment, not a ticket — the same rule the four
 * signals are held to.
 */
export const QUEUE_SOURCES: readonly QueueSource[] = [
  {
    key: "offers",
    segment: "offers",
    label: OFFERS_LABEL,
    // NFR7: age of the oldest undelivered Offer ≤ 24 h.
    bandHours: 24,
    async load(): Promise<QueueBranch> {
      const branch = await offers.pending(OFFER_DISPLAY_CAP);

      return {
        /**
         * **What an Offer item may carry, and what it may not.** NFR11's one
         * stated exception is bounded per queue item: Offer review renders the
         * body and her display identity, and **no** phone — hers or his. So the
         * summary names both people the way the surfaces they appear on name
         * them, and the three fields are what one person wrote to another.
         *
         * His name is badged as declared rather than verified everywhere else it
         * appears, and an Account that has never named itself carries `null`
         * here — which is a real state, not a placeholder, and the sentence says
         * so rather than rendering an empty string.
         */
        items: branch.items.map((offer) => ({
          id: offer.id,
          summary: offerSummary(offer.workerFirstName, offer.workerLastInitial, offer.hirerName),
          fields: [
            { label: OFFER_WORK_FIELD, value: offer.workDescription },
            { label: OFFER_PAY_FIELD, value: offer.payTerms },
            { label: OFFER_WHEN_FIELD, value: offer.whenText },
          ],
          arrivedAt: offer.sentAt,
        })),
        total: branch.total,
        oldestArrivedAt: branch.oldestSentAt,
      };
    },
  },
  {
    key: "photos",
    segment: "photos",
    label: PHOTOS_LABEL,
    bandHours: null,
  },
  {
    key: "reports",
    segment: "reports",
    label: REPORTS_LABEL,
    bandHours: null,
  },
  {
    key: "skillRequests",
    segment: "skills",
    label: SKILL_REQUESTS_LABEL,
    bandHours: null,
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
  {
    key: "bounces",
    segment: "bounces",
    label: BOUNCES_LABEL,
    bandHours: null,
  },
];

/** The section a URL segment names, or `undefined` — which is a 404, not a 403. */
export function sourceForSegment(segment: string): QueueSource | undefined {
  return QUEUE_SOURCES.find((source) => source.segment === segment);
}

/** The sections that have a resolver, in nav order. */
export function liveSources(): readonly QueueSource[] {
  return QUEUE_SOURCES.filter((source) => source.load !== undefined);
}

/** The sections that do not, in nav order. */
export function pendingSources(): readonly QueueSource[] {
  return QUEUE_SOURCES.filter((source) => source.load === undefined);
}

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
 * How many Offers render at once (C55).
 *
 * **The cap is on the rendering and not on the count**, and the domain read
 * enforces that by computing the depth and the age-of-oldest over the whole
 * predicate in a second statement. Twenty is a screenful an Admin can work
 * through in one sitting; the number beside the heading is what says there are
 * more, and NFR7's band is what says whether that matters today.
 */
export const OFFER_DISPLAY_CAP = 20;

/**
 * The age of one instant, in whole hours.
 *
 * Never negative: clock skew between the app server and Postgres can put an
 * arrival marginally in the future, and "-1 h" reads as a bug in the queue rather
 * than in a clock.
 */
export function ageInHours(at: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - at.getTime()) / 3_600_000));
}

/**
 * The age of the oldest item across every source, in whole hours — NFR7's
 * number, and the one that renders first.
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
 * function's problem.** The shell passes only the branches that loaded, and the
 * failure card beside this figure is what says the depth is unknown — one fact
 * per element, rather than a number that has to mean two things. A source with no
 * resolver is absent for the same reason.
 *
 * The clock is a parameter so the shell reads it once and every figure on the
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

  return ageInHours(oldest, now);
}

/**
 * Whether this section's oldest item has passed the band it is held to.
 *
 * **`false` where there is no band and `false` where there is nothing waiting**,
 * and the two are the same answer for different reasons — nothing is late against
 * a clock nobody set, and an empty branch has nothing to be late. Only a section
 * with both a band and an item can be marked, which is why the marker cannot
 * appear on the four sections whose stories have not landed.
 *
 * The comparison is `>=` on whole hours: an item that has reached the band has
 * reached it, and a detector that waited for the twenty-fifth hour would report
 * green for the whole of the hour the requirement is about.
 */
export function isPastBand(branch: QueueBranch, bandHours: number | null, now: Date): boolean {
  if (bandHours === null || branch.oldestArrivedAt === null) return false;

  return ageInHours(branch.oldestArrivedAt, now) >= bandHours;
}
