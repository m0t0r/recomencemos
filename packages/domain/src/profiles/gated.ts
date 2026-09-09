/**
 * The gated read: one published CapabilityProfile, by its opaque slug, for a
 * signed-in Account who is not the owner.
 *
 * **Two functions rather than one, because the route streams them separately.**
 * `/profile/[slug]` renders identity first and the work history inside its own
 * Suspense boundary (the spec's boundary table), so a single function returning
 * a whole `GatedProfile` would make that boundary decorative: the page could not
 * paint until the slower half had arrived. Splitting the *query* is what makes
 * the split in the UI real.
 *
 * The cost is one extra round trip on the streamed half, and it is worth naming
 * rather than hiding: the alternative — one statement with the history as a
 * correlated aggregate, the shape `listing.ts` uses for Skills — is faster in
 * total and cannot stream. A list page reads many rows and wants the single
 * statement; this page reads one row and wants the first half on screen.
 *
 * **Nothing here reads a gated column it does not put in a projection**, and
 * nothing here is cached (DD1). `state = 'published'` is a predicate on both
 * statements rather than a filter the caller remembers: a taken-down profile is
 * as absent as one that never existed, which is what makes moderation actually
 * remove something.
 */

import { photoUrl, publicBase, transformationsEnabled } from "@repo/storage/photo-url";
import { and, asc, eq, sql } from "drizzle-orm";
import type { DomainDatabase } from "#database";
import type { CityId } from "#policy/cities";
import type { PhotoState } from "#policy/profile-states";
import { type GatedIdentity, toGatedIdentity } from "#projections";
import * as schema from "#schema";
import type { VocabularyEntry } from "#skills";

/**
 * Her Skills, aggregated inside the identity statement.
 *
 * The same shape and the same warning as `listing.ts`'s: the table and column
 * names are written out because Drizzle renders a column unqualified inside a
 * select-list `sql` template, and `capability_profile` has a `slug` of its own
 * for a bare `"slug"` to resolve against. `gated.integration.test.ts` reads
 * every one of these names back through a real engine, so a rename that
 * type-checks fails there.
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

/**
 * The first half: everything but the work history.
 *
 * `null` for an unknown slug **and** for a taken-down one, which is the same
 * answer on purpose — the route turns both into the missing-profile response,
 * and so does a freeze on the caller's side. One shape, three causes, and
 * nothing on the page distinguishes them.
 */
export async function findGatedIdentity(
  db: DomainDatabase,
  slug: string,
): Promise<GatedIdentity | null> {
  const [row] = await db
    .select({
      slug: schema.capabilityProfile.slug,
      firstName: schema.capabilityProfile.firstName,
      lastInitial: schema.capabilityProfile.lastInitial,
      city: schema.capabilityProfile.city,
      headline: schema.capabilityProfile.headline,
      about: schema.capabilityProfile.about,
      photoState: schema.capabilityProfile.photoState,
      photoKey: schema.capabilityProfile.photoKey,
      publishedAt: schema.capabilityProfile.publishedAt,
      skills: skillsOfProfile.as("skills"),
    })
    .from(schema.capabilityProfile)
    .where(
      and(eq(schema.capabilityProfile.slug, slug), eq(schema.capabilityProfile.state, "published")),
    )
    .limit(1);

  if (!row) return null;

  /**
   * Through the projection every other read uses, so `fullName`, `phone` and
   * `email` are absent by construction rather than by this module remembering
   * to leave them out. The three are passed as empty values because the record
   * type is the projection's input and no gated column was read to fill them —
   * the same argument `listing.ts` makes for `toPublic`.
   *
   * The two casts read `CHECK` constraints: `capability_profile_city_known` and
   * `_photo_state_known` refuse anything else at write time.
   */
  return toGatedIdentity({
    slug: row.slug,
    fullName: "",
    firstName: row.firstName,
    lastInitial: row.lastInitial,
    city: row.city as CityId,
    headline: row.headline,
    about: row.about,
    phone: "",
    email: "",
    photoState: row.photoState as PhotoState,
    /**
     * **Resolved here, and gated exactly as `listing.ts` gates it** — the state
     * first, then `photoUrl`'s own refusal of any key that is not a *public*
     * one, so a row whose two columns had somehow disagreed still cannot name a
     * quarantine object.
     *
     * This was `null` behind a comment reading "no photo path exists yet", which
     * was true when it was written and stopped being true the moment the photo
     * path landed. Nothing went red: the pure projection is covered but this
     * read is not, and `gated-profile-view.tsx` already branches on
     * `profile.photoUrl`, so its image branch was simply dead. The visible
     * symptom was the wrong way round — a **signed-in** reader saw the initial
     * where an **anonymous** Wall visitor saw the approved face.
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

/**
 * The second half, in `position` order — which is why that column exists.
 * "Ordered" with no ordering column means an edit silently reorders her
 * history, and this is the read that would show it.
 *
 * `[]` for an unknown or taken-down slug, the same value as a profile that
 * listed nothing. The caller has already learned whether the profile exists
 * from {@link findGatedIdentity}, so there is no second absence for this
 * function to report — and returning `null` here would give the route a fourth
 * state to render that means nothing to a reader.
 */
export async function findGatedWorkHistory(
  db: DomainDatabase,
  slug: string,
): Promise<readonly string[]> {
  const rows = await db
    .select({ text: schema.workHistoryEntry.text })
    .from(schema.workHistoryEntry)
    .innerJoin(
      schema.capabilityProfile,
      eq(schema.capabilityProfile.id, schema.workHistoryEntry.capabilityProfileId),
    )
    .where(
      and(eq(schema.capabilityProfile.slug, slug), eq(schema.capabilityProfile.state, "published")),
    )
    .orderBy(asc(schema.workHistoryEntry.position));

  return rows.map((row) => row.text);
}
