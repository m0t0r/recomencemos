/**
 * `@repo/domain/export` — NFR16's subject-access export: everything held about
 * one person, in one function.
 *
 * **It exists now because story 14 needs it to.** The consent record has to be
 * inside the export a *consulta* is answered from — a Consent row nobody can read
 * back is a proof of authorization that cannot be produced — and this module did
 * not exist. So it ships carrying what the schema actually holds today: the
 * Account, and its Consent rows. It grows by one entry per `personal` column that
 * lands, and story 13 is what makes it reachable by the person it is about.
 *
 * **Built field by field from a whitelist, and no `toJSON` anywhere near it**
 * ([ADR-0003](../../../docs/adr/0003-no-tojson-on-cross-boundary-types.md)). Both
 * halves are load-bearing: the absent serialisation hook stops a field being
 * published implicitly, and never handing a row whole to anything that
 * serialises is what stops the rest of it leaking. The mechanism is the same one
 * the three profile projections use, deliberately, so that a new `personal`
 * column omitted from here fails the same class of sentinel test — which is the
 * only thing that keeps an export honest as a schema grows.
 *
 * **Session and Verification are excluded, and that is a decision rather than an
 * omission.** Both are classified `secret` (C28): a session token and a
 * magic-link token are credentials, and handing a *titular* her own session token
 * is a credential disclosure, not habeas data. `export.test.ts` asserts their
 * absence, because an exclusion nobody tests is an exclusion the next person
 * deletes as an oversight.
 *
 * **The clocks are not here.** A *consulta* is answered within 10 business days
 * and a *reclamo* within 15, and neither is something a diff advances — Colombia
 * has around eighteen public holidays and `America/Bogota` is UTC−5, so the
 * calendar is real work and it lives in the go-live runbook (C53). This module is
 * the half a diff can satisfy.
 */

import { asc, eq, or } from "drizzle-orm";
import { db as pooledDatabase } from "#connection";
import type { ConsentSide } from "#consent/registry";
import type { DomainDatabase } from "#database";
import {
  asOfferSendingState,
  MOST_RESTRICTIVE_OFFER_SENDING_STATE,
  type OfferSendingState,
} from "#policy/account-states";
import * as schema from "#schema";

/**
 * Her CapabilityProfile, whole — every `personal` and `public` column, because
 * the export is what a *consulta* is answered with and a column silently
 * omitted here is the same bug as one leaked elsewhere, wearing a compliance
 * hat. The photo's storage key is the one deliberate absence: a locator into a
 * bucket says nothing to her, and the photo ticket owns exporting the object.
 */
export interface ExportedProfile {
  readonly slug: string;
  readonly fullName: string;
  readonly firstName: string;
  readonly lastInitial: string;
  readonly city: string;
  readonly headline: string;
  readonly about: string;
  readonly phone: string;
  readonly photoState: string;
  /**
   * When the photo now waiting went in front of a person, or `null`.
   *
   * **Carried rather than excluded**, and the direction is habeas data's: it is
   * a fact about her photo's life that she has no other way to learn, and "how
   * long has this been waiting" is exactly the question the review gate makes
   * it reasonable for her to ask. `photoKey` beside it stays excluded because a
   * bucket locator answers no question she has.
   */
  readonly photoAttachedAt: Date | null;
  readonly state: string;
  /**
   * Her Pause: when she took the profile off the site herself, or `null`.
   * Carried because it is a decision she took about her own visibility, and a
   * _consulta_ asking what the platform holds about her is owed it (NFR16).
   */
  readonly pausedAt: Date | null;
  readonly publishedAt: Date;
  readonly deliveredOfferCount: number;
  readonly skills: readonly string[];
  readonly workHistory: readonly string[];
}

/**
 * One Consent row as it appears in the export.
 *
 * Every field is what a *reclamo* asks for: which side, which two documents, that
 * the international transmission was expressly authorized, and when. The row's
 * `id` is not here — it is a `BIGINT` primary key that reaches no URL and means
 * nothing to the person reading her own export.
 */
export interface ExportedConsent {
  readonly side: ConsentSide;
  readonly noticeVersion: string;
  readonly authorizationVersion: string;
  readonly transmissionAcknowledged: boolean;
  readonly consentedAt: Date;
}

/**
 * The Account's own `personal` columns.
 *
 * `isAdmin` is absent: the grant is `internal` rather than `personal`, and it is
 * a fact about the platform's staffing rather than about her. `image` is Google's
 * avatar URL, which is hers and is held here, so it crosses.
 *
 * **`offerSendingState` crosses, and the argument for it is the opposite of
 * `isAdmin`'s** (story 5, which added the column). A grant says how the platform
 * is staffed; a freeze is a decision this platform took *about the person
 * reading the export*, and one that suspends what they may do here. Ley 1581
 * gives the *titular* the right to know what is held about them, and a state
 * that restricts them is the clearest case there is — an export that named her
 * headline and not her suspension would be the "silently omitted `personal`
 * column" NFR16's mechanism exists to make impossible.
 *
 * **It does not weaken C22.** The indistinguishable-404 at `/profile/[slug]` is
 * about a page an unknown caller can sweep; this is a legal instrument served to
 * one authenticated *titular* about herself, and `sendOffer` tells her the same
 * thing the moment she tries to send.
 */
export interface ExportedAccount {
  readonly email: string;
  readonly name: string;
  readonly emailVerified: boolean;
  readonly imageUrl: string | null;
  readonly offerSendingState: OfferSendingState;
  /**
   * **What he told this platform to call him, and the number he said to reach
   * him on** (story 6, C4). `null` until his first Offer, which is the whole of
   * what that `null` means.
   *
   * They are `personal` and self-asserted, and both facts matter here: Ley 1581
   * gives the *titular* the right to know what is held about him, and this is
   * held about him *and disclosed to somebody else* — a Worker reads them on
   * every Offer he sends and keeps them after a Contact Exchange. An export that
   * carried his email and not the name under which strangers have been reading
   * his Offers would omit the more consequential of the two.
   */
  readonly hirerName: string | null;
  readonly hirerPhone: string | null;
  readonly registeredAt: Date;
}

/**
 * One Offer this Account is a party to, from whichever side it stands on.
 *
 * **Both sides are carried, and the reason is the requirement's own wording**:
 * *everything held about one person*. An Offer he sent holds three things he
 * wrote; an Offer sent to her is held against her profile, is the reason her
 * delivered-Offer count moved, and is what a person read about her before
 * deciding to write. `side` is what tells the two apart in the document —
 * without it, a *titular* who is both a Worker and a Hirer would read a list
 * whose rows have no attribution.
 *
 * **The counterpart is not named**, which is the one thing this shape withholds.
 * An export is served to *one* person about *herself*, and identifying the
 * other party would make a habeas data request a way of learning about somebody
 * who did not make one — the same rule the `ReceivedOffer` projection follows
 * one boundary over, applied to a document rather than to a page.
 */
export interface ExportedOffer {
  readonly side: "sent" | "received";
  readonly workDescription: string;
  readonly payTerms: string;
  readonly whenText: string;
  readonly state: string;
  readonly sentAt: Date;
  /** When a person read it and let it through. `null` while it is still waiting. */
  readonly deliveredAt: Date | null;
}

/** Everything this platform holds about one person, as of today's schema. */
export interface SubjectAccessExport {
  readonly account: ExportedAccount;
  readonly consents: readonly ExportedConsent[];
  /** `null` until she publishes; an Account is not obliged to hold one. */
  readonly profile: ExportedProfile | null;
  /** Both sides, oldest first. Empty for an Account that is party to none. */
  readonly offers: readonly ExportedOffer[];
}

/**
 * Build the subject-access export for one Account, or `null` where there is no
 * such Account.
 *
 * **`null` rather than a throw**, because "no Account with that address" is an
 * ordinary answer to a *consulta* and not a fault — somebody asking about an
 * address that never registered here is entitled to be told so plainly.
 *
 * The handle is the first parameter, which is `#database`'s rule and what lets
 * seam 2 exercise this against the committed migrations rather than a mock.
 */
export async function buildSubjectAccessExport(
  db: DomainDatabase,
  accountId: string,
): Promise<SubjectAccessExport | null> {
  const accounts = await db
    .select({
      email: schema.user.email,
      name: schema.user.name,
      emailVerified: schema.user.emailVerified,
      image: schema.user.image,
      offerSendingState: schema.user.offerSendingState,
      hirerName: schema.user.hirerName,
      hirerPhone: schema.user.hirerPhone,
      createdAt: schema.user.createdAt,
    })
    .from(schema.user)
    .where(eq(schema.user.id, accountId))
    .limit(1);

  const row = accounts[0];
  if (!row) return null;

  const consents = await db
    .select({
      side: schema.consent.side,
      noticeVersion: schema.consent.noticeVersion,
      authorizationVersion: schema.consent.authorizationVersion,
      transmissionAcknowledged: schema.consent.transmissionAcknowledged,
      createdAt: schema.consent.createdAt,
    })
    .from(schema.consent)
    .where(eq(schema.consent.accountId, accountId))
    // Oldest first: an export read by a person is a history, and a history reads
    // forwards. It is also the order the index already holds them in.
    .orderBy(asc(schema.consent.createdAt));

  const profile = await exportedProfile(db, accountId);
  const offers = await exportedOffers(db, accountId);

  return {
    account: {
      email: row.email,
      name: row.name,
      emailVerified: row.emailVerified,
      imageUrl: row.image,
      // Through the registry's own narrower rather than a cast, and to the same
      // restrictive fallback `#accounts` uses. `user_offer_sending_state_known`
      // makes the fallback unreachable; what it buys is that the two readers of
      // this column cannot come to disagree about whether its values are
      // trustworthy — which they briefly did, a cast here against a narrowing
      // there.
      offerSendingState:
        asOfferSendingState(row.offerSendingState) ?? MOST_RESTRICTIVE_OFFER_SENDING_STATE,
      hirerName: row.hirerName,
      hirerPhone: row.hirerPhone,
      registeredAt: row.createdAt,
    },
    // Field by field, and the `side` cast is the one place the database's `TEXT`
    // meets the registry's union. It is safe because `consent_side_known` refuses
    // anything else at write time — the `CHECK` is what makes the cast a reading
    // of a constraint rather than an assumption about the data.
    consents: consents.map((consent) => ({
      side: consent.side as ConsentSide,
      noticeVersion: consent.noticeVersion,
      authorizationVersion: consent.authorizationVersion,
      transmissionAcknowledged: consent.transmissionAcknowledged,
      consentedAt: consent.createdAt,
    })),
    profile,
    offers,
  };
}

/**
 * Every Offer this Account is a party to, oldest first.
 *
 * **One statement over both sides**, keyed on his Account id for the ones he
 * sent and on her profile for the ones she received — a `LEFT JOIN` rather than
 * two queries, because an Account can be both and a *titular* who is both should
 * read one history rather than two lists that have to be merged by eye.
 *
 * `side` is derived from which key matched, in SQL, so a row cannot be
 * mislabelled by anything this function does after reading it.
 *
 * Oldest first, for the reason the consents are: an export read by a person is a
 * history, and a history reads forwards.
 */
async function exportedOffers(
  db: DomainDatabase,
  accountId: string,
): Promise<readonly ExportedOffer[]> {
  const rows = await db
    .select({
      sent: eq(schema.offer.hirerAccountId, accountId),
      workDescription: schema.offer.workDescription,
      payTerms: schema.offer.payTerms,
      whenText: schema.offer.whenText,
      state: schema.offer.state,
      sentAt: schema.offer.createdAt,
      deliveredAt: schema.offer.deliveredAt,
    })
    .from(schema.offer)
    .leftJoin(
      schema.capabilityProfile,
      eq(schema.capabilityProfile.id, schema.offer.capabilityProfileId),
    )
    .where(
      or(
        eq(schema.offer.hirerAccountId, accountId),
        eq(schema.capabilityProfile.accountId, accountId),
      ),
    )
    .orderBy(asc(schema.offer.createdAt));

  // Field by field, like every other projection here, and the counterpart is
  // absent by construction rather than by being dropped afterwards.
  return rows.map((row) => ({
    side: row.sent ? ("sent" as const) : ("received" as const),
    workDescription: row.workDescription,
    payTerms: row.payTerms,
    whenText: row.whenText,
    state: row.state,
    sentAt: row.sentAt,
    deliveredAt: row.deliveredAt,
  }));
}

async function exportedProfile(
  db: DomainDatabase,
  accountId: string,
): Promise<ExportedProfile | null> {
  const [row] = await db
    .select({
      id: schema.capabilityProfile.id,
      slug: schema.capabilityProfile.slug,
      fullName: schema.capabilityProfile.fullName,
      firstName: schema.capabilityProfile.firstName,
      lastInitial: schema.capabilityProfile.lastInitial,
      city: schema.capabilityProfile.city,
      headline: schema.capabilityProfile.headline,
      about: schema.capabilityProfile.about,
      phone: schema.capabilityProfile.phone,
      photoState: schema.capabilityProfile.photoState,
      photoAttachedAt: schema.capabilityProfile.photoAttachedAt,
      state: schema.capabilityProfile.state,
      pausedAt: schema.capabilityProfile.pausedAt,
      publishedAt: schema.capabilityProfile.publishedAt,
      deliveredOfferCount: schema.capabilityProfile.deliveredOfferCount,
    })
    .from(schema.capabilityProfile)
    .where(eq(schema.capabilityProfile.accountId, accountId))
    .limit(1);

  if (!row) return null;

  const skills = await db
    .select({ labelEs: schema.skill.labelEs })
    .from(schema.profileSkill)
    .innerJoin(schema.skill, eq(schema.skill.id, schema.profileSkill.skillId))
    .where(eq(schema.profileSkill.capabilityProfileId, row.id))
    .orderBy(asc(schema.skill.labelEs));

  const history = await db
    .select({ text: schema.workHistoryEntry.text })
    .from(schema.workHistoryEntry)
    .where(eq(schema.workHistoryEntry.capabilityProfileId, row.id))
    // The position column is what the order *is*; it reaches the export as the
    // order of this array rather than as a number beside each line.
    .orderBy(asc(schema.workHistoryEntry.position));

  return {
    slug: row.slug,
    fullName: row.fullName,
    firstName: row.firstName,
    lastInitial: row.lastInitial,
    city: row.city,
    headline: row.headline,
    about: row.about,
    phone: row.phone,
    photoState: row.photoState,
    photoAttachedAt: row.photoAttachedAt,
    state: row.state,
    pausedAt: row.pausedAt,
    publishedAt: row.publishedAt,
    deliveredOfferCount: row.deliveredOfferCount,
    skills: skills.map((skill) => skill.labelEs),
    workHistory: history.map((entry) => entry.text),
  };
}

/**
 * **The pooled binding: what a Server Action calls.**
 *
 * ADR-0010 withholds `#connection`, so `apps/web` has no handle to pass and
 * reaches the database through this object or not at all.
 */
export const subjectAccess = {
  async build(accountId: string): Promise<SubjectAccessExport | null> {
    return buildSubjectAccessExport(pooledDatabase(), accountId);
  },
};
