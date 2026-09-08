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

import { and, asc, desc, eq, like, type SQL, sql } from "drizzle-orm";
import type { DomainDatabase } from "#database";
import type { CityId } from "#policy/cities";
import { type Page, PAGE_SIZE, pageOf } from "#policy/listing";
import type { PhotoState } from "#policy/profile-states";
import { toSearchPatterns } from "#policy/search-text";
/**
 * **`/photo-url` rather than `/photos`, and the difference is load-bearing.**
 * That subpath is isomorphic — a URL builder and two environment readers, no
 * credential and no SDK — while `/photos` constructs an S3 client at module
 * load and carries `assertServerOnly`. This module is reached from
 * `apps/web`'s client graph in a happy-dom test, and a static import of the
 * server-only subpath made the backstop throw across a whole file. It was
 * right to.
 */
import { photoUrl, publicBase, transformationsEnabled } from "@repo/storage/photo-url";
import { type PublicProfile, toPublicProfile } from "#projections";
import * as schema from "#schema";
import type { VocabularyEntry } from "#skills";

export interface ListOptions {
  /** The slug of the last profile on the previous page, or nothing for the first. */
  readonly after?: string | null;
  readonly limit?: number;
}

/**
 * What narrows the browsable list, on top of the published predicate every read
 * of it already carries.
 *
 * **All three are optional and all three combine**, and each maps to one index
 * the schema already declares rather than to a scan: the city to the leading
 * column of `capability_profile_browse_city_idx`, the Skill to
 * `profile_skill_skill_id_idx`, the typed words to
 * `capability_profile_search_idx`.
 *
 * **Nothing here touches the ordering.** The attention spread is the same
 * comparison over a smaller population, which is what makes the fairness
 * property true of a filtered list without a second code path claiming it is.
 */
export interface BrowseFilters {
  /** A `Skill`'s slug. A slug naming no Skill matches nothing, which is the honest answer. */
  readonly skill?: string | null;
  readonly city?: CityId | null;
  /** What a Hirer typed, raw. Folded and split by `#policy/search-text`, never here. */
  readonly query?: string | null;
}

export interface BrowseOptions extends ListOptions, BrowseFilters {}

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
 *
 * **The table and column names are written out rather than interpolated from the
 * schema, and that asymmetry with the keyset predicate below is deliberate.**
 * Drizzle renders a column unqualified inside a select-list `sql` template, so
 * `${schema.skill.slug}` here would emit a bare `"slug"` that resolves against
 * whichever scope reaches it first — silently the wrong column, since the
 * correlated outer table has a `slug` too. What holds these five names to the
 * schema is `listing.integration.test.ts`, which reads every one of them back
 * through a real engine: a rename that type-checks fails there.
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
  photoKey: schema.capabilityProfile.photoKey,
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
  readonly photoKey: string | null;
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
    /**
     * **The URL is resolved here and gated twice, and both locks are load-bearing.**
     *
     * The first is this line: nothing is resolved unless the state is
     * `approved`, so a `pending` or `rejected` row hands the projection `null`
     * and every public surface renders her initial — _"one shape, two causes"_.
     * The second is inside `photoUrl` itself, which refuses a key that is not a
     * *public* key, so even a row whose two columns had somehow disagreed cannot
     * produce a URL into quarantine. NFR6 counts objects, and this is the last
     * place a public one could be named for an unreviewed photo.
     *
     * `null` also whenever the Cloudflare zone is not configured yet (runbook
     * §3), which is DD6's _"photos serve at full size until it is done"_ read
     * from the other end — an unconfigured deploy degrades into the initial,
     * which is a state the design already has.
     */
    photoUrl:
      row.photoState === "approved" && row.photoKey
        ? photoUrl({
            key: row.photoKey,
            base: publicBase(),
            transformations: transformationsEnabled(),
          })
        : null,
    skills: row.skills,
    workHistory: [],
    publishedAt: row.publishedAt,
  });
}

const publishedOnly = eq(schema.capabilityProfile.state, "published");

/**
 * What separates one list from the other: how it sorts, and how a cursor is
 * turned into "everything after this row".
 *
 * Everything else — the columns, the published predicate, the probe row, the
 * projection — is the same read twice, so it is written once in
 * {@link readPage}. The two orderings are the difference, and this is the shape
 * that keeps them the *visible* difference.
 */
interface Ordering {
  readonly orderBy: SQL[];
  /** The keyset predicate for a cursor, against an aliased copy of the table. */
  readonly after: (cursor: string) => SQL;
}

const NEWEST_FIRST: Ordering = {
  orderBy: [desc(schema.capabilityProfile.publishedAt), desc(schema.capabilityProfile.id)],
  after: (cursor) =>
    sql`(${schema.capabilityProfile.publishedAt}, ${schema.capabilityProfile.id}) < (
      select anchor.published_at, anchor.id
      from capability_profile anchor
      where anchor.slug = ${cursor}
    )`,
};

const ATTENTION_SPREAD: Ordering = {
  orderBy: [
    asc(schema.capabilityProfile.deliveredOfferCount),
    asc(schema.capabilityProfile.rotationKey),
    asc(schema.capabilityProfile.id),
  ],
  after: (cursor) =>
    sql`(
      ${schema.capabilityProfile.deliveredOfferCount},
      ${schema.capabilityProfile.rotationKey},
      ${schema.capabilityProfile.id}
    ) > (
      select anchor.delivered_offer_count, anchor.rotation_key, anchor.id
      from capability_profile anchor
      where anchor.slug = ${cursor}
    )`,
};

/**
 * The filters, as predicates against the same statement — one per term a caller
 * actually set, and nothing at all when it set none.
 *
 * **Each one is written so an index can answer it**, which is the criterion this
 * whole story turns on. Concretely: no function wraps a column, so nothing here
 * forces the engine to compute a value per row before it can compare one.
 *
 * - **City** is plain equality on the column the browse-plus-city index leads
 *   with.
 * - **Skill** is an `EXISTS` over the join table keyed the reverse way from the
 *   natural primary key — `profile_skill_skill_id_idx`, which DD2 declared for
 *   exactly this read. The slug is resolved in an **uncorrelated** subquery, so
 *   the engine looks the Skill up once against its unique index rather than once
 *   per candidate profile. A join to `skill` instead would multiply the rows
 *   before the page's `LIMIT` could cut them.
 * - **The typed words** are `LIKE` against the folded column, one predicate per
 *   word, answered by the trigram index — see `#policy/search-text` for why they
 *   are separate and how they are escaped, and `#schema` for why the column is
 *   plain text rather than an expression.
 *
 * The one shape worth knowing before reading an `EXPLAIN` here, because it looks
 * like a regression and is not: **a GIN index supplies no ordering**, so a text
 * query combined with the attention-spread sort is a bitmap scan plus a sort
 * rather than an ordered walk. DD4 records that as the accepted cost of an
 * honest accent fold, at a launch volume where the sort is measured in
 * milliseconds.
 */
function filtersOf(filters: BrowseFilters): SQL[] {
  const predicates: SQL[] = [];

  if (filters.city) predicates.push(eq(schema.capabilityProfile.city, filters.city));

  if (filters.skill) {
    predicates.push(sql`exists (
      select 1
      from profile_skill
      where profile_skill.capability_profile_id = ${schema.capabilityProfile.id}
        and profile_skill.skill_id = (select skill.id from skill where skill.slug = ${filters.skill})
    )`);
  }

  for (const pattern of filters.query ? toSearchPatterns(filters.query) : []) {
    predicates.push(like(schema.capabilityProfile.searchText, pattern));
  }

  return predicates;
}

/** One page of published profiles in the given ordering. */
async function readPage(
  db: DomainDatabase,
  ordering: Ordering,
  options: BrowseOptions,
): Promise<ProfileListPage> {
  const limit = options.limit ?? PAGE_SIZE;
  const after = options.after ? ordering.after(options.after) : undefined;

  const rows = await db
    .select(PUBLIC_COLUMNS)
    .from(schema.capabilityProfile)
    .where(and(publishedOnly, ...filtersOf(options), ...(after ? [after] : [])))
    .orderBy(...ordering.orderBy)
    // One more than the page shows, so "is there another page" is answered by a
    // row rather than guessed from a full one.
    .limit(limit + 1);

  const page = pageOf(rows, limit);

  return { items: page.items.map(toPublic), nextCursor: page.nextCursor };
}

/**
 * The Wall: the most recently published profiles, newest first.
 *
 * Answered by `capability_profile_wall_idx`, the partial index on
 * `(published_at DESC, id DESC) WHERE state = 'published'`.
 */
export function listWall(db: DomainDatabase, options: ListOptions = {}): Promise<ProfileListPage> {
  return readPage(db, NEWEST_FIRST, options);
}

/**
 * The browsable list: fewest delivered Offers first, then the rotation key.
 *
 * Answered by `capability_profile_browse_idx`. The ordering is the attention
 * spread this product commits to, and the middle term is what keeps it a
 * rotation rather than a queue — see `#policy/listing`.
 *
 * **A filter narrows the population and changes nothing else** — not the
 * ordering, not the keyset, not the projection. So the fairness property holds
 * inside a filtered set for the same reason it holds outside one, and the cursor
 * a filtered page hands back keeps working as long as the same filters travel
 * with it. They have to: the cursor names a row's position in an ordering, and
 * an ordering over a different population is a different ordering.
 */
export function listBrowse(
  db: DomainDatabase,
  options: BrowseOptions = {},
): Promise<ProfileListPage> {
  return readPage(db, ATTENTION_SPREAD, options);
}
