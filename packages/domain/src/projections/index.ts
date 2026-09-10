/**
 * `@repo/domain/projections` — the three shapes a CapabilityProfile crosses a
 * boundary in, counted (NFR10), and the reason ADR-0003 is enforceable here
 * rather than aspirational.
 *
 * **Membership means: exactly these keys are present on the wire, and adding a
 * field to the entity reaches none of them until someone writes it into one.**
 * That is the API contract's own sentence, and each function below is built
 * field by field from a whitelist for that reason. None of the outputs defines
 * `toJSON`, and the record they read is never handed to a serializer whole.
 *
 * The three, in order of what they release:
 *
 * - {@link toPublicProfile} — what the Wall and `/profiles` show anyone: first
 *   name, last initial, city, headline, Skills, an **approved** photo, and when.
 *   None of the four gated fields (ADR-0009).
 * - {@link toGatedProfile} — what a signed-in Account reads at `/profile/[slug]`:
 *   the public shape plus `about` and the work history. **Not `fullName`**,
 *   which is collected at publish and crosses only at exchange (C1).
 *   {@link toGatedIdentity} is its first half, and exists because that route
 *   streams the work history inside its own Suspense boundary — see
 *   {@link GatedIdentity} for why the split is a type rather than an optional
 *   field.
 * - {@link toExchangedContact} — what crosses at Contact Exchange and nowhere
 *   else: full name, phone, email. {@link toExchangedProfile} is that beside the
 *   gated shape, which is what the other side holds after acceptance and what
 *   NFR10 counts as "all five".
 *
 * And one more that is hers alone: {@link toOwnProfile}, the gated shape plus
 * the three held fields and her photo whatever its state, for `/my-profile`.
 *
 * **Two more since story 6, and they are the same discipline over an Offer**:
 * {@link toSentOffer} is what its sender reads and {@link toReceivedOffer} is
 * what its addressee reads. The field that has to be counted here is the
 * Hirer's phone — self-asserted, `personal`, and held on his Account — which
 * reaches **neither**: it crosses at Contact Exchange and nowhere earlier,
 * which is the same rule her number is held to, applied in the other direction.
 *
 * Pure, and seam 1's: `projections.test.ts` puts five distinct sentinels into
 * one record and counts them in each output.
 */

import type { CityId } from "#policy/cities";
import { asOfferState, isOfferReviewDelayed, type OfferState } from "#policy/offer-states";
import type { PhotoState } from "#policy/profile-states";
import type { VocabularyEntry } from "#skills";

/**
 * Everything a projection may read. The query modules build this; nothing
 * outside this package ever sees it whole.
 *
 * `photoUrl` arrives already resolved by the reader — the projection's only
 * decision about it is *whether* it crosses, which it does at `approved` and
 * at no other state (NFR6).
 */
export interface ProfileRecord {
  readonly slug: string;
  readonly fullName: string;
  readonly firstName: string;
  readonly lastInitial: string;
  readonly city: CityId;
  readonly headline: string;
  readonly about: string;
  readonly phone: string;
  readonly email: string;
  readonly photoState: PhotoState;
  readonly photoUrl: string | null;
  readonly skills: readonly VocabularyEntry[];
  readonly workHistory: readonly string[];
  readonly publishedAt: Date;
}

export interface PublicProfile {
  readonly slug: string;
  readonly firstName: string;
  readonly lastInitial: string;
  readonly city: CityId;
  readonly headline: string;
  readonly skills: readonly VocabularyEntry[];
  readonly photoUrl: string | null;
  readonly publishedAt: Date;
}

/**
 * **The gated shape minus the work history**, because the route that renders it
 * streams the two halves separately.
 *
 * `/profile/[slug]` renders identity first and the work history inside its own
 * Suspense boundary (the spec's boundary table), so the page has to hold a
 * complete, whitelisted value *before* the history resolves. Widening
 * {@link GatedProfile} to make `workHistory` optional would have been the other
 * way to do that, and it is the wrong one: `undefined` and "she listed nothing"
 * are different facts, and a projection whose membership depends on when it is
 * read is a projection NFR10 can no longer count.
 *
 * So the split is a type, and both halves are built from the same whitelist:
 * `toGatedIdentity` is what streams first and `toGatedProfile` is that plus the
 * history. Neither may ever carry `fullName`, `phone` or `email`.
 */
export interface GatedIdentity extends PublicProfile {
  readonly about: string;
}

export interface GatedProfile extends GatedIdentity {
  readonly workHistory: readonly string[];
}

export interface ExchangedContact {
  readonly fullName: string;
  readonly phone: string;
  readonly email: string;
}

export interface ExchangedProfile extends GatedProfile {
  readonly contact: ExchangedContact;
}

export interface OwnProfile extends GatedProfile {
  readonly fullName: string;
  readonly phone: string;
  readonly email: string;
  readonly photoState: PhotoState;
}

export function toPublicProfile(record: ProfileRecord): PublicProfile {
  return {
    slug: record.slug,
    firstName: record.firstName,
    lastInitial: record.lastInitial,
    city: record.city,
    headline: record.headline,
    skills: record.skills.map((skill) => ({ slug: skill.slug, labelEs: skill.labelEs })),
    // The one field whose crossing depends on state: an unreviewed photo
    // reaches no public surface (NFR6), so anything but `approved` is `null`.
    photoUrl: record.photoState === "approved" ? record.photoUrl : null,
    publishedAt: record.publishedAt,
  };
}

export function toGatedIdentity(record: ProfileRecord): GatedIdentity {
  return {
    ...toPublicProfile(record),
    about: record.about,
  };
}

export function toGatedProfile(record: ProfileRecord): GatedProfile {
  return {
    ...toGatedIdentity(record),
    workHistory: [...record.workHistory],
  };
}

export function toExchangedContact(record: ProfileRecord): ExchangedContact {
  return {
    fullName: record.fullName,
    phone: record.phone,
    email: record.email,
  };
}

export function toExchangedProfile(record: ProfileRecord): ExchangedProfile {
  return {
    ...toGatedProfile(record),
    contact: toExchangedContact(record),
  };
}

export function toOwnProfile(record: ProfileRecord): OwnProfile {
  return {
    ...toGatedProfile(record),
    fullName: record.fullName,
    phone: record.phone,
    email: record.email,
    photoState: record.photoState,
    // Her own view shows her photo whatever its state, which is the one place
    // `photoUrl` crosses before approval.
    photoUrl: record.photoUrl,
  };
}

/**
 * Everything an Offer projection may read — the row plus the two identities it
 * sits between. Built by `#offers`; nothing outside this package sees it whole.
 *
 * **`hirerName` and `hirerPhone` are both on here and only one of them ever
 * crosses.** They are `NULL` until his first Offer and the reader hands them
 * through as they are; the *decision* about which reaches a browser is made
 * below, once, where NFR11 can be counted — the same arrangement `photoUrl` has,
 * where the reader resolves and the projection decides.
 */
export interface OfferRecord {
  readonly id: string;
  readonly state: string;
  readonly workDescription: string;
  readonly payTerms: string;
  readonly whenText: string;
  readonly sentAt: Date;
  readonly deliveredAt: Date | null;
  /** The Worker this Offer is for, as she appears to anyone. */
  readonly worker: PublicProfile;
  /** What he called himself on his first Offer. `null` before it. */
  readonly hirerName: string | null;
  /** What he gave as his number. **Never crosses on an Offer** — see below. */
  readonly hirerPhone: string | null;
}

/**
 * What one of these looks like on the wire, both ways round.
 *
 * The API contract fixes the shared half — _"`id`, `state`, `workDescription`,
 * `payTerms`, `whenText`, `sentAt`, plus the counterpart's `PublicProfile`-shaped
 * identity and nothing more until exchange"_ — and each side adds exactly one
 * field of its own.
 */
interface OfferBase {
  readonly id: string;
  readonly state: OfferState;
  readonly workDescription: string;
  readonly payTerms: string;
  readonly whenText: string;
  readonly sentAt: Date;
}

/**
 * What a Hirer sees at `/sent-offers`: **state only, and no contact details
 * until an exchange**.
 *
 * `reviewDelayed` is the one field of its own (C41), and it is derived rather
 * than stored — `deliveredAt IS NULL AND sentAt < now() - 24 hours`, computed by
 * `isOfferReviewDelayed` and passed the clock so nothing under here reads it.
 */
export interface SentOffer extends OfferBase {
  readonly worker: PublicProfile;
  readonly reviewDelayed: boolean;
}

/**
 * What a Worker sees at `/offers`: the same terms, plus **`hirerName` and
 * nothing else about him** (C4).
 *
 * **His phone is deliberately not here, and this is the projection NFR11 is
 * counted over.** His number crosses at Contact Exchange and nowhere earlier —
 * the same rule her number is held to, in the same direction. `hirerName` is
 * badged as declared rather than verified by every surface that renders it, so
 * she judges knowing who *claims* to be asking.
 *
 * `null` is a real state and not a placeholder: it is an Offer written before
 * this platform asked its senders to name themselves. The surface says so rather
 * than rendering an empty string.
 */
export interface ReceivedOffer extends OfferBase {
  readonly hirerName: string | null;
}

/**
 * The sender's view, field by field from the whitelist.
 *
 * The clock is a parameter, so this stays pure and seam 1's, and so that a page
 * rendering twenty rows reads the time once — every row on the screen then
 * agrees about what "24 hours ago" means.
 */
export function toSentOffer(record: OfferRecord, now: Date): SentOffer {
  return {
    id: record.id,
    state: offerStateOf(record),
    workDescription: record.workDescription,
    payTerms: record.payTerms,
    whenText: record.whenText,
    sentAt: record.sentAt,
    worker: record.worker,
    reviewDelayed: isOfferReviewDelayed(record.sentAt, record.deliveredAt, now),
  };
}

/**
 * What the addressee's read hands over. **Neither her own `PublicProfile` nor
 * his phone is on it**, so the projection below cannot reach either — the
 * sender's record carries his number because the sender's view is built from the
 * same row, and this one has no reason to select it.
 */
export type ReceivedOfferRecord = Omit<OfferRecord, "worker" | "hirerPhone">;

/**
 * The terms half of {@link ReceivedOffer}: everything but who claims to be
 * asking.
 *
 * **It exists because `/offers/[id]` paints the terms first and streams his
 * identity in a boundary of its own** — the spec's `partial` cell for that
 * surface. Two reads need two shapes, and building the full projection from this
 * one keeps a single whitelist rather than two that have to agree.
 */
export type ReceivedOfferTerms = Omit<ReceivedOffer, "hirerName">;

export function toReceivedOfferTerms(
  record: Omit<ReceivedOfferRecord, "hirerName">,
): ReceivedOfferTerms {
  return {
    id: record.id,
    state: offerStateOf(record),
    workDescription: record.workDescription,
    payTerms: record.payTerms,
    whenText: record.whenText,
    sentAt: record.sentAt,
  };
}

/**
 * The addressee's view. Note what is absent: `hirerPhone`, and her own
 * `PublicProfile` — she knows who she is, and an Offer she received says nothing
 * about her that she did not already write.
 */
export function toReceivedOffer(record: ReceivedOfferRecord): ReceivedOffer {
  return {
    ...toReceivedOfferTerms(record),
    hirerName: record.hirerName,
  };
}

/**
 * The row's `TEXT` state, narrowed.
 *
 * `offer_state_known` makes an unknown value unreachable through the schema, so
 * this throws rather than falling back: unlike a sending state there is no
 * "most restrictive" member to pick, and quietly showing an Offer as
 * `pending_review` because its real state was unreadable would tell a person
 * something false about a decision that is hers.
 */
function offerStateOf(record: Pick<OfferRecord, "state">): OfferState {
  const state = asOfferState(record.state);

  if (!state) {
    throw new TypeError(
      `An Offer row carries the state "${record.state}", which is not one this product has. ` +
        "The offer_state_known constraint should make that unreachable, so something has " +
        "written to this table from outside the domain package.",
    );
  }

  return state;
}
