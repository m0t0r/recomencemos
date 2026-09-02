/**
 * The two public reads: the Wall and the browsable list.
 *
 * **One statement per page, and the Skills come back inside it.** A list that
 * reads its rows and then asks for each row's Skills is the way the read-latency
 * requirement is actually missed — it looks correct, it passes every test that
 * checks the returned value, and its cost grows with the page size. The Skills
 * arrive through a correlated aggregate in the select list, which Postgres
 * evaluates only for the rows that survive `LIMIT`.
 *
 * **Keyset, never `OFFSET`.** Both orderings match a partial index the schema
 * declares, and both are keyed from the last row of the previous page rather
 * than from a row count — so a profile published while somebody is reading page
 * three does not shift page four underneath them.
 *
 * **The cursor is a slug, and that is a boundary decision rather than a
 * convenience.** The obvious keyset cursor is the ordering's own terms, and the
 * last of those terms is the `BIGINT` primary key — which the schema keeps off
 * every boundary, because a key in a query parameter publishes the platform's
 * profile count. So the cursor names the row by its opaque public handle and the
 * statement resolves that handle back to the ordering terms itself, in a
 * subquery against an aliased copy of the same table.
 *
 * The anchor lookup deliberately does **not** filter on `state`: a profile taken
 * down between one page and the next still positions the page that follows it,
 * so the reader loses that profile and nothing else. A cursor naming no profile
 * at all yields no rows, which is the right answer to a hand-typed one.
 *
 * Nothing here is cached, and there is no `use cache` anywhere near it.
 */

import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { DomainDatabase } from "#database";
import type { CityId } from "#policy/cities";
import { type Page, PAGE_SIZE, pageOf } from "#policy/listing";
import type { PhotoState } from "#policy/profile-states";
import { type PublicProfile, toPublicProfile } from "#projections";
import * as schema from "#schema";
import type { VocabularyEntry } from "#skills";

export interface ListOptions {
  /** The slug of the last profile on the previous page, or nothing for the first. */
  readonly after?: string | null;
  readonly limit?: number;
}

/** What a page of either list is. */
export type ProfileListPage = Page<PublicProfile>;

/**
 * Every profile's Skills, aggregated per row inside the same statement.
 *
 * Ordered by the label rather than by the join's row order, matching the
 * vocabulary reads: the picker and the card render the same list to a person, so
 * they may not disagree about its order. `[]` rather than `NULL` for a profile
 * with no Skills, because the alternative is a `LEFT JOIN` that either drops the
 * row or forces the whole page through a `GROUP BY`.
 */
const skillsOfProfile = sql<VocabularyEntry[]>`(
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
const PUBLIC_COLUMNS = {
  slug: schema.capabilityProfile.slug,
  firstName: schema.capabilityProfile.firstName,
  lastInitial: schema.capabilityProfile.lastInitial,
  city: schema.capabilityProfile.city,
  headline: schema.capabilityProfile.headline,
  photoState: schema.capabilityProfile.photoState,
  publishedAt: schema.capabilityProfile.publishedAt,
  skills: skillsOfProfile.as("skills"),
};

interface PublicRow {
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
 * this module remembering to leave them out.
 *
 * The two casts read `CHECK` constraints rather than assume anything about the
 * data: `capability_profile_city_known` and `_photo_state_known` refuse anything
 * else at write time. The fields a `PublicProfile` never carries are passed as
 * empty values: the record type is the projection's input, not a row, and
 * nothing here has read a gated column to put in them.
 */
function toPublic(row: PublicRow): PublicProfile {
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

const publishedOnly = eq(schema.capabilityProfile.state, "published");

/**
 * The Wall: the most recently published profiles, newest first.
 *
 * Answered by `capability_profile_wall_idx`, the partial index on
 * `(published_at DESC, id DESC) WHERE state = 'published'`.
 */
export async function listWall(
  db: DomainDatabase,
  options: ListOptions = {},
): Promise<ProfileListPage> {
  const limit = options.limit ?? PAGE_SIZE;

  const after = options.after
    ? sql`(${schema.capabilityProfile.publishedAt}, ${schema.capabilityProfile.id}) < (
        select anchor.published_at, anchor.id
        from capability_profile anchor
        where anchor.slug = ${options.after}
      )`
    : undefined;

  const rows = await db
    .select(PUBLIC_COLUMNS)
    .from(schema.capabilityProfile)
    .where(after ? and(publishedOnly, after) : publishedOnly)
    .orderBy(desc(schema.capabilityProfile.publishedAt), desc(schema.capabilityProfile.id))
    // One more than the page shows, so "is there another page" is answered by a
    // row rather than guessed from a full one.
    .limit(limit + 1);

  const page = pageOf(rows, limit);

  return { items: page.items.map(toPublic), nextCursor: page.nextCursor };
}

/**
 * The browsable list: fewest delivered Offers first, then the rotation key.
 *
 * Answered by `capability_profile_browse_idx`. The ordering is the attention
 * spread this product commits to, and the middle term is what keeps it a
 * rotation rather than a queue — see `#policy/listing`.
 */
export async function listBrowse(
  db: DomainDatabase,
  options: ListOptions = {},
): Promise<ProfileListPage> {
  const limit = options.limit ?? PAGE_SIZE;

  const after = options.after
    ? sql`(
        ${schema.capabilityProfile.deliveredOfferCount},
        ${schema.capabilityProfile.rotationKey},
        ${schema.capabilityProfile.id}
      ) > (
        select anchor.delivered_offer_count, anchor.rotation_key, anchor.id
        from capability_profile anchor
        where anchor.slug = ${options.after}
      )`
    : undefined;

  const rows = await db
    .select(PUBLIC_COLUMNS)
    .from(schema.capabilityProfile)
    .where(after ? and(publishedOnly, after) : publishedOnly)
    .orderBy(
      asc(schema.capabilityProfile.deliveredOfferCount),
      asc(schema.capabilityProfile.rotationKey),
      asc(schema.capabilityProfile.id),
    )
    .limit(limit + 1);

  const page = pageOf(rows, limit);

  return { items: page.items.map(toPublic), nextCursor: page.nextCursor };
}
