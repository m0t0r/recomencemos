/**
 * The one `select` list a `PublicProfile` is read through, and the one function
 * that turns it into the shape that crosses.
 *
 * **Extracted because there is now a third reader.** The Wall and the browsable
 * list have always shared this; story 6's `/sent-offers` needs the same identity
 * beside each Offer, and story 8's `/offers` will want it beside each one going
 * the other way. Three copies of the correlated aggregate below would be three
 * places for the column names inside a raw `sql` template to drift from the
 * schema — which is precisely the failure the comment on {@link skillsOfProfile}
 * describes, and which the compiler cannot see.
 *
 * Nothing here is cached and nothing here reads a clock.
 */

import { sql } from "drizzle-orm";
import type { CityId } from "#policy/cities";
import type { PhotoState } from "#policy/profile-states";
import { type PublicProfile, toPublicProfile } from "#projections";
import * as schema from "#schema";
import type { VocabularyEntry } from "#skills";

/**
 * Her Skills, as one correlated aggregate in the select list rather than a
 * second query per row.
 *
 * **A list that reads its rows and then asks for each row's Skills is the way
 * the read-latency requirement is actually missed** — it looks correct, it
 * passes every test that checks the returned value, and its cost grows with the
 * page size. Postgres evaluates a correlated aggregate only for the rows that
 * survive `LIMIT`.
 *
 * **The five column names inside this template are written as literal SQL rather
 * than through the schema, and that asymmetry is deliberate.** Drizzle renders a
 * column unqualified inside a select-list `sql` template, so
 * `${schema.skill.slug}` here would emit a bare `"slug"` that resolves against
 * whichever scope reaches it first — silently the wrong column, since the
 * correlated outer table has a `slug` too. What holds these names to the schema
 * is that every reader is covered at seam 2 against a real engine: a rename that
 * type-checks fails there.
 *
 * **It correlates on `capability_profile.id`, so a statement using it must have
 * that table in scope under its own name** — not under an alias. Both list reads
 * and both Offer reads do.
 */
export const skillsOfProfile = sql<VocabularyEntry[]>`(
  select coalesce(
    json_agg(
      json_build_object('slug', skill.slug, 'labelEs', skill.label_es)
      order by skill.label_es
    ),
    '[]'::json
  )
  from profile_skill
  inner join skill on skill.id = profile_skill.skill_id
  where profile_skill.capability_profile_id = capability_profile.id
)`;

/** Exactly the columns a `PublicProfile` is built from, and no others. */
export const PUBLIC_COLUMNS = {
  slug: schema.capabilityProfile.slug,
  firstName: schema.capabilityProfile.firstName,
  lastInitial: schema.capabilityProfile.lastInitial,
  city: schema.capabilityProfile.city,
  headline: schema.capabilityProfile.headline,
  photoState: schema.capabilityProfile.photoState,
  publishedAt: schema.capabilityProfile.publishedAt,
  skills: skillsOfProfile.as("skills"),
};

export interface PublicRow {
  readonly slug: string;
  readonly firstName: string;
  readonly lastInitial: string;
  readonly city: string;
  readonly headline: string;
  readonly photoState: string;
  readonly publishedAt: Date;
  readonly skills: VocabularyEntry[];
}

/**
 * A row into the shape that crosses, through the same projection every other
 * read uses — so the four gated fields are absent by construction rather than by
 * a reader remembering to leave them out.
 *
 * The two casts read `CHECK` constraints rather than assume anything about the
 * data: `capability_profile_city_known` and `_photo_state_known` refuse anything
 * else at write time. The fields a `PublicProfile` never carries are passed as
 * empty values: the record type is the projection's input, not a row, and
 * nothing here has read a gated column to put in them.
 */
export function toPublic(row: PublicRow): PublicProfile {
  return toPublicProfile({
    slug: row.slug,
    fullName: "",
    firstName: row.firstName,
    lastInitial: row.lastInitial,
    city: row.city as CityId,
    headline: row.headline,
    about: "",
    phone: "",
    email: "",
    photoState: row.photoState as PhotoState,
    // No photo path exists yet, so there is no URL to resolve; the projection
    // withholds it at every state but `approved` regardless.
    photoUrl: null,
    skills: row.skills,
    workHistory: [],
    publishedAt: row.publishedAt,
  });
}
