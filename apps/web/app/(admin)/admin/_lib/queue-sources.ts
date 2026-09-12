/**
 * The queue's five sources, as a registry the one list is merged from and each
 * source ticket plugs into.
 *
 * **One list, oldest first, across every source** — the shape the UX lab chose
 * in #277, replacing #96's sidebar with a route per concern. What the registry
 * still buys is that a source is independently buildable: the page already knows
 * how to count a branch, age it, mark it late, merge it and say it is missing, so
 * a source arrives by gaining a `load` and nothing else.
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
 * **Two of the five have no `load`, and they are absent rather than stubbed.**
 * Reports and bounced addresses read tables later stories create; Offers, photos
 * and Skill requests are live. A source with no resolver reports **no count and
 * no age** — never a zero. Zero is the good news an Admin scans for, and
 * reporting it for a branch nobody queried is the instrument that lies about
 * exactly the thing this surface exists to prevent. `coverageNotice` is the
 * visible half of the same fact.
 *
 * **Each branch is `LIMIT`-capped for display while its count and age-of-oldest
 * are computed over the whole branch** (C55). That is a property of a `load`
 * implementation rather than of this type, and it is written here because the
 * first person to add a source is the person who would otherwise cap all three
 * together — leaving a queue that reports a depth of 20 when 400 Offers are
 * waiting, which is NFR7's detector silently disabled.
 */

import { offers } from "@repo/domain/offers";
import { photos } from "@repo/domain/photos";
import { skills } from "@repo/domain/skills";
import {
  BOUNCES_LABEL,
  OFFER_PAY_FIELD,
  OFFER_WHEN_FIELD,
  OFFER_WORK_FIELD,
  OFFER_WORKER_PROFILE_FIELD,
  offerSummary,
  OFFERS_LABEL,
  photoWaitingSince,
  PHOTOS_LABEL,
  REPORTS_LABEL,
  SKILL_REQUESTS_LABEL,
  workerPausedSince,
} from "./messages";

/**
 * One labelled thing an item carries, where its summary line cannot hold it.
 *
 * Named rather than left inline because four more sections are expected to use
 * it, and because both halves are subject to NFR11 exactly as the summary is —
 * a type with a name is a type a reader can be told that about.
 */
export interface QueueItemField {
  readonly label: string;
  readonly value: string;
}

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
  readonly fields?: readonly QueueItemField[];
  /** When it arrived. The oldest across all sources is what renders first. */
  readonly arrivedAt: Date;
  /**
   * A short-lived signed URL for an item whose **content is an image** — today
   * the photo branch and nothing else.
   *
   * **Optional on the shared type rather than a photo-shaped `QueueItem` of its
   * own**, because every other part of the queue — the count, the age, the cap,
   * the empty state, the failure card — is the same for a photo as for a Skill
   * request, and a parallel type would fork all of that to carry one field. A
   * source with no image simply does not set it.
   *
   * **It is signed and it expires in a minute**, which is what keeps NFR6's
   * count at zero: the object is refused to anyone without a credential, and
   * this URL is minted server-side inside a render that has already been through
   * the Admin gate. Never logged, never persisted.
   */
  readonly imageUrl?: string;
  /**
   * The key {@link QueueItem.imageUrl} was signed for — set by the same source,
   * on the same items, and never independently of it.
   *
   * **It is what a decision on this item is bound to.** The profile id names the
   * row and the row's key can move; this names the object that was rendered, so
   * approving or rejecting applies to the picture the Admin was looking at
   * rather than to whatever is under the row by the time the action commits.
   *
   * **It puts nothing new on the page.** The signed URL beside it is built from
   * this key and carries it in its path, so the browser already holds it — and
   * holding it is not a capability: reading the object needs the signature, and
   * attaching it to a row needs an intent row minted for that Account.
   */
  readonly photoKey?: string;
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
   * The Spanish name a row's source column and the filter show, and the noun
   * `sourceFailed` uses.
   */
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
 * The five, in the order the filter offers them.
 *
 * **This order no longer decides what an Admin sees first** — the list is
 * ordered by arrival across all five, so an old photo sits above a new Offer
 * rather than behind a section nobody opened. Offers still lead the filter,
 * because they are the only branch with a deadline attached: NFR7's band is per
 * Offer.
 *
 * A sixth source is a spec amendment, not a ticket — the same rule the four
 * signals are held to.
 */
export const QUEUE_SOURCES: readonly QueueSource[] = [
  {
    key: "offers",
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
            // Her Pause (story 25): the Offer is still hers to receive, and the
            // Admin delivering it is told she is not on the site right now.
            ...(offer.workerPausedAt
              ? [
                  {
                    label: OFFER_WORKER_PROFILE_FIELD,
                    value: workerPausedSince(offer.workerPausedAt),
                  },
                ]
              : []),
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
    label: PHOTOS_LABEL,
    /**
     * **No band, and inventing one would be a spec amendment.** NFR7 states one
     * number and states it per Offer. A photo has no equivalent clock — and
     * unlike a Report, a photo waiting costs the Worker something concrete (her
     * face is not on her card yet), which is an argument for working the branch
     * promptly rather than an argument for a number nobody agreed.
     */
    bandHours: null,
    async load(): Promise<QueueBranch> {
      const branch = await photos.pending(PHOTO_DISPLAY_CAP);

      /**
       * **One signed URL per rendered row, and none for the rows past the cap.**
       * Signing is a local HMAC rather than a network call, so twelve cost
       * nothing measurable — but each is still a capability to read an
       * unreviewed photo, so only the rows actually being rendered get one.
       */
      const items = await Promise.all(
        branch.items.map(async (photo) => ({
          id: photo.profileId,
          /**
           * **The summary names nobody.** Every other source has words to show;
           * this one's item *is* the image, so the text beside it is the single
           * fact the decision needs. Her name, her city and her headline are
           * deliberately absent — an Admin is deciding whether an image may be
           * public, and every extra field is a fact the decision does not need.
           */
          summary: photoWaitingSince(photo.attachedAt),
          arrivedAt: photo.attachedAt,
          imageUrl: await photos.reviewUrl(photo.photoKey),
          photoKey: photo.photoKey,
        })),
      );

      return { items, total: branch.total, oldestArrivedAt: branch.oldestAttachedAt };
    },
  },
  {
    key: "reports",
    label: REPORTS_LABEL,
    bandHours: null,
  },
  {
    key: "skillRequests",
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
    label: BOUNCES_LABEL,
    bandHours: null,
  },
];

/**
 * What a source has to say about itself once it has been asked.
 *
 * Three states rather than two, and `absent` is the one that matters: a source
 * whose story has not landed is not an empty source. Collapsing the two would
 * report a depth of zero for a branch nobody counted.
 *
 * **Here rather than beside the read in `queue-data.ts`**, because that module is
 * `server-only` and the merge below is pure — the arithmetic is tested at
 * `web:test`, where a `server-only` import would throw.
 */
export type SectionState =
  | { readonly status: "absent" }
  | { readonly status: "loaded"; readonly branch: QueueBranch }
  | { readonly status: "failed" };

/** The branches that answered, for the figures computed across all of them. */
export function branchesThatLoaded(states: readonly SectionState[]): readonly QueueBranch[] {
  return states.filter((state) => state.status === "loaded").map((state) => state.branch);
}

/**
 * One row of the merged list: an item, the source it came from, and the two
 * figures the row shows about it.
 *
 * **Both figures are computed on the server, from the one clock reading the page
 * takes**, so the browser never reads the clock — a row that aged by an hour
 * between the server render and hydration would be a mismatch React reports and
 * an Admin reads as a flicker.
 */
export interface QueueRow {
  /**
   * `<source>:<id>`. A photo is keyed by its profile and an Offer by its own id,
   * so nothing stops two sources sharing one — and the key is what the table
   * selects, expands and hands focus by.
   */
  readonly key: string;
  readonly sourceKey: string;
  readonly sourceLabel: string;
  /** Whole hours, floored, never negative — `ageInHours`'s rules. */
  readonly ageHours: number;
  /** Past this row's own source's band. Only Offers have one. */
  readonly late: boolean;
  readonly item: QueueItem;
}

/**
 * Every source that answered, as one list, **oldest first** — the whole of what
 * the owner chose in the UX lab (#277, variant A): nothing old hides behind a
 * section nobody opened, because there are no sections to open.
 *
 * **Each branch is still capped for display (C55)**, so the merge is of the
 * oldest few of each rather than of everything waiting. That is honest about
 * order — every row shown is older than every row of its own branch that is not —
 * and the headline's count and age are computed over the whole branches instead,
 * so the cap can never make the queue look shallower than it is.
 *
 * A source that failed or has no resolver contributes nothing here. Its absence
 * is said by the failure card and the coverage line, one fact per element.
 *
 * Ties break on the key, so two items that arrived in the same millisecond render
 * in the same order on every load rather than trading places under the cursor.
 */
export function queueRows(
  sections: readonly { readonly source: QueueSource; readonly state: SectionState }[],
  now: Date,
): readonly QueueRow[] {
  return sections
    .flatMap(({ source, state }) =>
      state.status === "loaded"
        ? state.branch.items.map((item) => {
            const ageHours = ageInHours(item.arrivedAt, now);

            return {
              key: `${source.key}:${item.id}`,
              sourceKey: source.key,
              sourceLabel: source.label,
              ageHours,
              // `>=` for `isPastBand`'s reason: an item that has reached the band
              // has reached it.
              late: source.bandHours !== null && ageHours >= source.bandHours,
              item,
            };
          })
        : [],
    )
    .toSorted(
      (a, b) =>
        a.item.arrivedAt.getTime() - b.item.arrivedAt.getTime() || a.key.localeCompare(b.key),
    );
}

/**
 * How many items are waiting across every branch that answered — **the whole
 * branches, never the rows that render** (C55). A headline summing `items.length`
 * would say forty while four hundred wait, which is the queue's depth detector
 * reading a number that cannot exceed the display cap.
 */
export function waitingAcross(branches: readonly QueueBranch[]): number {
  return branches.reduce((sum, branch) => sum + branch.total, 0);
}

/** The sources that have a resolver, in filter order. */
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
 * How many photos render at once (C55), and it is deliberately smaller than the
 * Skill requests' twenty.
 *
 * Each row is an image rather than a sentence, so a screenful is fewer of them —
 * and every rendered row costs a signed URL and an image request over whatever
 * connection the Admin is on. The number beside the heading says whether there
 * are more, and it is computed over the whole branch rather than over this cap.
 */
export const PHOTO_DISPLAY_CAP = 12;

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
