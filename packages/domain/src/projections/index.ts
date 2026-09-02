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
 * - {@link toExchangedContact} — what crosses at Contact Exchange and nowhere
 *   else: full name, phone, email. {@link toExchangedProfile} is that beside the
 *   gated shape, which is what the other side holds after acceptance and what
 *   NFR10 counts as "all five".
 *
 * And one more that is hers alone: {@link toOwnProfile}, the gated shape plus
 * the three held fields and her photo whatever its state, for `/my-profile`.
 *
 * Pure, and seam 1's: `projections.test.ts` puts five distinct sentinels into
 * one record and counts them in each output.
 */

import type { CityId } from "#policy/cities";
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

export interface GatedProfile extends PublicProfile {
  readonly about: string;
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

export function toGatedProfile(record: ProfileRecord): GatedProfile {
  return {
    ...toPublicProfile(record),
    about: record.about,
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
