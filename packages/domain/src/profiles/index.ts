/**
 * `@repo/domain/profiles` — the CapabilityProfile aggregate: publishing one,
 * and reading one's own.
 *
 * **`publishProfile` is one transaction, and the Consent row is inside it.**
 * Profile, Skills, work history and the Worker's _autorización_ commit together
 * or not at all — story 14's whole point, made structural by `recordConsent`
 * taking a `DomainTransaction` and nothing else. A failure anywhere in the
 * sequence leaves none of the four (seam 2 asserts this from both ends).
 *
 * **Nothing waits on a person** (NFR1). The profile is `published` on commit;
 * the photo, which is the one thing a person reviews, is another ticket's and
 * arrives as a state change on an already-live row.
 *
 * **Every refusal is returned, never thrown** (NFR26's second half, C51): a
 * contact detail in a free-text field, an unknown Skill, an unreadable phone,
 * and an Account that already holds a profile are all ordinary answers to an
 * ordinary form, and a crawler that could raise an `AppError` from any of them
 * would spend the month's Sentry allowance in a day. What *does* throw is a
 * database that will not answer, which is a real incident.
 *
 * **Every function takes the handle first and the principal second**, the shape
 * `#database` fixes. The `profiles` object at the foot binds the pooled
 * connection for `apps/web`, which ADR-0010 leaves with no handle of its own.
 */

import { presignReview, publicPhotoUrl } from "@repo/storage/photos";
import { and, asc, count, eq, gte, inArray } from "drizzle-orm";
import { db as pooledDatabase } from "#connection";
import { recordConsent } from "#consent/index";
import type { ConsentVersions } from "#consent/registry";
import type { DomainDatabase } from "#database";
import { type CityId, isCityId } from "#policy/cities";
import { type ContactDetailKind, rejectContactDetails } from "#policy/contact-details";
import { normalizeColombianPhone } from "#policy/phone";
import { normalizeSearchText } from "#policy/search-text";
import { findGatedIdentity, findGatedWorkHistory } from "#profiles/gated";
import {
  type BrowseOptions,
  type ListOptions,
  listBrowse,
  listWall,
  type ProfileListPage,
} from "#profiles/listing";
import { mintSlug } from "#profiles/slug";
import type { PhotoState } from "#policy/profile-states";
import {
  type GatedIdentity,
  type OwnProfile,
  type ProfileRecord,
  toOwnProfile,
} from "#projections";
import * as schema from "#schema";

/**
 * **What a person types about herself**, and the whole of it — publishing and
 * editing write the same nine fields, which is the API contract's own reading
 * of the edit action ("`publishProfile`'s field set **minus `consentVersion`**").
 *
 * Declaring it once is what makes that relationship structural rather than a
 * comment two interfaces have to keep agreeing with: {@link PublishProfileInput}
 * is this plus the consent versions, {@link UpdateProfileInput} is this exactly,
 * and {@link refusalsFor} takes this, so the rejector cannot drift between the
 * two paths.
 */
export interface ProfileFields {
  readonly fullName: string;
  readonly firstName: string;
  readonly lastInitial: string;
  readonly city: string;
  readonly headline: string;
  readonly about: string;
  readonly phone: string;
  readonly skillSlugs: readonly string[];
  readonly workHistory: readonly string[];
}

/** What the boundary parse hands over. Shape has been checked; substance is checked here. */
export interface PublishProfileInput extends ProfileFields {
  readonly consentVersions: ConsentVersions;
}

/** The same fields with no consent: an edit is not a fresh collection of her data. */
export type UpdateProfileInput = ProfileFields;

/** The fields a refusal can name. English identifiers; the surface maps them to labels. */
export type ProfileField = "headline" | "about" | "workHistory" | "skillSlugs" | "phone" | "city";

/**
 * One reason a submission was refused, with what the surface needs to say it:
 * the field, the kind, and — for the rejector — the fragment (NFR12).
 *
 * Shared by both write paths, because both run the same rejector on the same
 * fields and the surface renders one set of sentences for either.
 */
export type ProfileRefusal =
  | {
      readonly field: "headline" | "about" | "workHistory";
      readonly code: "contact_detail";
      readonly kind: ContactDetailKind;
      readonly fragment: string;
      /** Which work-history line, when the field is `workHistory`. */
      readonly index?: number;
    }
  | {
      readonly field: "skillSlugs";
      readonly code: "unknown_skill";
      readonly slugs: readonly string[];
    }
  | { readonly field: "skillSlugs"; readonly code: "no_skill" }
  | { readonly field: "phone"; readonly code: "phone_unrecognised" }
  | { readonly field: "city"; readonly code: "city_unknown" };

export type PublishProfileOutcome =
  | { readonly ok: true; readonly slug: string }
  | { readonly ok: false; readonly reason: "already_has_profile" }
  | {
      readonly ok: false;
      readonly reason: "refused";
      readonly refusals: readonly ProfileRefusal[];
    };

/**
 * An edit's outcomes. `no_profile` is the edit-side counterpart of publishing's
 * `already_has_profile`: an ordinary answer to an ordinary request, returned
 * rather than thrown, so a caller who has nothing to edit costs no Sentry event.
 */
export type UpdateProfileOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "no_profile" }
  | {
      readonly ok: false;
      readonly reason: "refused";
      readonly refusals: readonly ProfileRefusal[];
    };

/** The pure half: everything that can be refused without a row. */
function refusalsFor(input: ProfileFields): ProfileRefusal[] {
  const refusals: ProfileRefusal[] = [];

  const headline = rejectContactDetails(input.headline);
  if (!headline.ok) {
    refusals.push({
      field: "headline",
      code: "contact_detail",
      kind: headline.kind,
      fragment: headline.fragment,
    });
  }

  const about = rejectContactDetails(input.about);
  if (!about.ok) {
    refusals.push({
      field: "about",
      code: "contact_detail",
      kind: about.kind,
      fragment: about.fragment,
    });
  }

  input.workHistory.forEach((line, index) => {
    const verdict = rejectContactDetails(line);
    if (!verdict.ok) {
      refusals.push({
        field: "workHistory",
        code: "contact_detail",
        kind: verdict.kind,
        fragment: verdict.fragment,
        index,
      });
    }
  });

  if (input.skillSlugs.length === 0) refusals.push({ field: "skillSlugs", code: "no_skill" });
  if (!normalizeColombianPhone(input.phone).ok)
    refusals.push({ field: "phone", code: "phone_unrecognised" });
  if (!isCityId(input.city)) refusals.push({ field: "city", code: "city_unknown" });

  return refusals;
}

/**
 * Everything that can be refused before a row is read, plus the two values the
 * refusals were the price of narrowing.
 *
 * **The two re-checks are what buy the types, and they name their own field.**
 * `refusalsFor` has already refused an unrecognised phone and an unknown city,
 * so reaching either branch below means the two functions disagree — which is a
 * defect, not a submission. Returning the empty list `refusalsFor` produced
 * would hand the surface a refusal with no sentence in it, so each branch says
 * which field it is about instead.
 */
function narrowFields(
  input: ProfileFields,
):
  | { readonly ok: true; readonly phone: string; readonly city: CityId }
  | { readonly ok: false; readonly refusals: readonly ProfileRefusal[] } {
  const refusals = refusalsFor(input);
  if (refusals.length > 0) return { ok: false, refusals };

  const phone = normalizeColombianPhone(input.phone);
  if (!phone.ok) return { ok: false, refusals: [{ field: "phone", code: "phone_unrecognised" }] };
  if (!isCityId(input.city))
    return { ok: false, refusals: [{ field: "city", code: "city_unknown" }] };

  return { ok: true, phone: phone.e164, city: input.city };
}

/**
 * What a profile is found by, from whichever path wrote it.
 *
 * Shared so the two write paths cannot disagree about what a search reads: an
 * edit that recomputed a different set of parts from a publish would make a
 * profile findable by different words after a correction than before one.
 */
function searchTextFor(
  input: ProfileFields,
  city: CityId,
  skills: readonly { readonly labelEs: string }[],
): string {
  return normalizeSearchText(
    input.firstName,
    city,
    input.headline,
    ...skills.map((skill) => skill.labelEs),
  );
}

/**
 * Her work history, written from scratch. Empty lines are dropped rather than
 * stored — the form starts with one and she may leave it — and `position` is
 * the order she typed, so it is assigned after the drop rather than before.
 */
async function writeWorkHistory(
  tx: Parameters<Parameters<DomainDatabase["transaction"]>[0]>[0],
  capabilityProfileId: typeof schema.workHistoryEntry.$inferInsert.capabilityProfileId,
  lines: readonly string[],
): Promise<void> {
  const history = lines.map((text) => text.trim()).filter((text) => text.length > 0);
  if (history.length === 0) return;

  await tx
    .insert(schema.workHistoryEntry)
    .values(history.map((text, position) => ({ capabilityProfileId, position, text })));
}

export async function publishProfile(
  db: DomainDatabase,
  accountId: string,
  input: PublishProfileInput,
): Promise<PublishProfileOutcome> {
  const narrowed = narrowFields(input);
  if (!narrowed.ok) return { ok: false, reason: "refused", refusals: narrowed.refusals };

  const { phone, city } = narrowed;

  return db.transaction(async (tx) => {
    /**
     * The unique constraint is the guarantee; this read is what turns it into a
     * returned refusal rather than a thrown constraint error on the ordinary
     * path. A race between two submits from one Account still meets the
     * constraint, which is the right answer for the one interleaving this
     * read cannot see.
     */
    const [existing] = await tx
      .select({ id: schema.capabilityProfile.id })
      .from(schema.capabilityProfile)
      .where(eq(schema.capabilityProfile.accountId, accountId))
      .limit(1);

    if (existing) return { ok: false as const, reason: "already_has_profile" as const };

    /**
     * Only the **active** vocabulary may be chosen (`listActiveSkills`'s
     * rule); a retired entry or a slug nobody seeded is refused by name, so the
     * surface can say which. Read inside the transaction so a promotion or a
     * retirement racing this publish is seen or not seen whole.
     */
    const wanted = [...new Set(input.skillSlugs)];
    const skills = await tx
      .select({ id: schema.skill.id, slug: schema.skill.slug, labelEs: schema.skill.labelEs })
      .from(schema.skill)
      .where(and(inArray(schema.skill.slug, wanted), eq(schema.skill.active, true)));

    if (skills.length !== wanted.length) {
      const known = new Set(skills.map((skill) => skill.slug));
      return {
        ok: false as const,
        reason: "refused" as const,
        refusals: [
          {
            field: "skillSlugs" as const,
            code: "unknown_skill" as const,
            slugs: wanted.filter((slug) => !known.has(slug)),
          },
        ],
      };
    }

    const slug = mintSlug();

    const [profile] = await tx
      .insert(schema.capabilityProfile)
      .values({
        accountId,
        slug,
        fullName: input.fullName,
        firstName: input.firstName,
        lastInitial: input.lastInitial,
        city,
        headline: input.headline,
        about: input.about,
        phone,
        searchText: searchTextFor(input, city, skills),
      })
      .returning({ id: schema.capabilityProfile.id });

    // `RETURNING` on an insert always yields the row; a missing one means the
    // driver did something this code does not model, and throwing rolls back.
    if (!profile)
      throw new Error("Inserting the profile returned no row; the transaction rolls back.");

    await tx
      .insert(schema.profileSkill)
      .values(skills.map((skill) => ({ capabilityProfileId: profile.id, skillId: skill.id })));

    await writeWorkHistory(tx, profile.id, input.workHistory);

    // Last, inside the same transaction, and it throws on a stale version —
    // which rolls back everything above. See `#consent`.
    await recordConsent(tx, { accountId, side: "worker", versions: input.consentVersions });

    return { ok: true as const, slug };
  });
}

/**
 * **Change what a published profile says.** One transaction, the same rejector,
 * and two columns it must not touch.
 *
 * **`published_at` is not stamped, and `slug` is not reminted.** The Wall reads
 * `(published_at DESC, id DESC) WHERE state = 'published'`, so an edit that
 * stamped it would make editing a free bump to the top of the site's
 * most-linked surface — and story 20's attention-spread measurement would go on
 * reporting a fairness property the site no longer had. The slug is stable
 * across edits (NFR9), so an address a Hirer already holds keeps resolving.
 * `updated_at` is the column that moves, and no index reads it. Both properties
 * are asserted at seam 2 rather than left to this comment.
 *
 * **No Consent row.** An edit is a change to what her profile says, not a fresh
 * collection of her data, so `publishProfile`'s consent write has no
 * counterpart here. Whether a `consentVersion` that has moved since she
 * published needs a fresh one is a Ley 1581 question filed separately; nothing
 * here decides it.
 *
 * **Skills and work history are replaced, not merged** — the form submits the
 * whole set, so anything absent from it is something she removed.
 */
export async function updateProfile(
  db: DomainDatabase,
  accountId: string,
  input: UpdateProfileInput,
): Promise<UpdateProfileOutcome> {
  const narrowed = narrowFields(input);
  if (!narrowed.ok) return { ok: false, reason: "refused", refusals: narrowed.refusals };

  const { phone, city } = narrowed;

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: schema.capabilityProfile.id })
      .from(schema.capabilityProfile)
      .where(eq(schema.capabilityProfile.accountId, accountId))
      .limit(1);

    if (!existing) return { ok: false as const, reason: "no_profile" as const };

    /**
     * **The choosable set on an edit is the active vocabulary plus what she
     * already holds**, which is where this parts company with publishing.
     *
     * `publishProfile` admits only active Skills, which is right for a first
     * publish. Applied to an edit it would mean that retiring one Skill froze
     * every profile holding it — a save that only corrected a phone number
     * would be refused for a Skill she never touched, naming a slug she cannot
     * remove without noticing the refusal first. So a Skill she holds stays
     * choosable, and a Skill she is *adding* must still be active. Read inside
     * the transaction so a promotion or retirement racing this save is seen
     * whole or not at all.
     */
    const held = await tx
      .select({ id: schema.skill.id, slug: schema.skill.slug, labelEs: schema.skill.labelEs })
      .from(schema.profileSkill)
      .innerJoin(schema.skill, eq(schema.skill.id, schema.profileSkill.skillId))
      .where(eq(schema.profileSkill.capabilityProfileId, existing.id));

    const wanted = [...new Set(input.skillSlugs)];
    const active = await tx
      .select({ id: schema.skill.id, slug: schema.skill.slug, labelEs: schema.skill.labelEs })
      .from(schema.skill)
      .where(and(inArray(schema.skill.slug, wanted), eq(schema.skill.active, true)));

    const choosable = new Map(active.map((skill) => [skill.slug, skill]));
    for (const skill of held) if (!choosable.has(skill.slug)) choosable.set(skill.slug, skill);

    const unknown = wanted.filter((slug) => !choosable.has(slug));
    if (unknown.length > 0) {
      return {
        ok: false as const,
        reason: "refused" as const,
        refusals: [
          { field: "skillSlugs" as const, code: "unknown_skill" as const, slugs: unknown },
        ],
      };
    }

    // Non-null by the `unknown` check above; `wanted` is the order she chose.
    const skills = wanted.map((slug) => choosable.get(slug) as (typeof active)[number]);

    await tx
      .update(schema.capabilityProfile)
      .set({
        fullName: input.fullName,
        firstName: input.firstName,
        lastInitial: input.lastInitial,
        city,
        headline: input.headline,
        about: input.about,
        phone,
        searchText: searchTextFor(input, city, skills),
        // Explicit: the column defaults on insert, and Postgres does not move it
        // on its own. `published_at` is deliberately absent from this object.
        updatedAt: new Date(),
      })
      .where(eq(schema.capabilityProfile.id, existing.id));

    await tx
      .delete(schema.profileSkill)
      .where(eq(schema.profileSkill.capabilityProfileId, existing.id));

    await tx
      .insert(schema.profileSkill)
      .values(skills.map((skill) => ({ capabilityProfileId: existing.id, skillId: skill.id })));

    await tx
      .delete(schema.workHistoryEntry)
      .where(eq(schema.workHistoryEntry.capabilityProfileId, existing.id));

    await writeWorkHistory(tx, existing.id, input.workHistory);

    return { ok: true as const };
  });
}

/** Whether this Account already holds a profile — what `/publish`'s gate asks. */
export async function hasProfile(db: DomainDatabase, accountId: string): Promise<boolean> {
  const rows = await db
    .select({ id: schema.capabilityProfile.id })
    .from(schema.capabilityProfile)
    .where(eq(schema.capabilityProfile.accountId, accountId))
    .limit(1);

  return rows.length > 0;
}

/**
 * How many profiles were published since a given instant — the arithmetic behind
 * the Admin queue's platform signal (C24).
 *
 * **It counts the act, not the row's present state**, and the unfiltered `WHERE`
 * is the whole decision. The signal exists to notice somebody publishing faster
 * than displaced people plausibly arrive; a flooder who publishes fifty and takes
 * forty-nine down inside the hour has done exactly the thing being watched for,
 * and a `state = 'published'` predicate would hand them the way out. So the
 * window is the only condition, and `state` is deliberately absent.
 *
 * **The price is that this read uses no index**, because the two indexes on this
 * column are partial on `state = 'published'` (DD2) and a count over every state
 * cannot use either. That is accepted rather than overlooked: the table holds one
 * row per Account across three municipalities, and this runs once per Admin page
 * render — a few times a day, by one person. A partial index on `published_at`
 * alone is the fix if it ever appears in a slow-query log; it is not worth a
 * migration before then.
 *
 * **`since` is a parameter, like every instant in this package**, so the window
 * is the caller's arithmetic and seam 2 can fix both ends of it rather than wait
 * an hour.
 */
export async function countPublishedSince(db: DomainDatabase, since: Date): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(schema.capabilityProfile)
    .where(gte(schema.capabilityProfile.publishedAt, since));

  // `COUNT(*)` with no `GROUP BY` always returns one row; `?? 0` keeps the figure
  // honest rather than optimistic if it somehow does not.
  return row?.total ?? 0;
}

/**
 * What the publishing form may prefill: the name Google handed over, when she
 * came in through that door. A magic-link Account has an empty name, so the
 * field is simply empty. Editable either way — prefilled is not the same as
 * decided.
 */
export async function readPublishPrefill(
  db: DomainDatabase,
  accountId: string,
): Promise<{ readonly fullName: string }> {
  const [row] = await db
    .select({ name: schema.user.name })
    .from(schema.user)
    .where(eq(schema.user.id, accountId))
    .limit(1);

  return { fullName: row?.name ?? "" };
}

/**
 * Her own profile, projected for `/my-profile`: the gated shape plus the three
 * held fields and her photo whatever its state. `null` when she has none.
 *
 * The principal is the Account, and the query is scoped by it — there is no
 * unscoped finder here or anywhere in this package (Core entities, ownership
 * edges).
 */
export async function findOwnProfile(
  db: DomainDatabase,
  accountId: string,
): Promise<OwnProfile | null> {
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
      photoKey: schema.capabilityProfile.photoKey,
      publishedAt: schema.capabilityProfile.publishedAt,
      email: schema.user.email,
    })
    .from(schema.capabilityProfile)
    .innerJoin(schema.user, eq(schema.user.id, schema.capabilityProfile.accountId))
    .where(eq(schema.capabilityProfile.accountId, accountId))
    .limit(1);

  if (!row) return null;

  const skills = await db
    .select({ slug: schema.skill.slug, labelEs: schema.skill.labelEs })
    .from(schema.profileSkill)
    .innerJoin(schema.skill, eq(schema.skill.id, schema.profileSkill.skillId))
    .where(eq(schema.profileSkill.capabilityProfileId, row.id))
    .orderBy(asc(schema.skill.labelEs));

  const history = await db
    .select({ text: schema.workHistoryEntry.text })
    .from(schema.workHistoryEntry)
    .where(eq(schema.workHistoryEntry.capabilityProfileId, row.id))
    .orderBy(asc(schema.workHistoryEntry.position));

  // The two casts are readings of `CHECK` constraints, not assumptions about the
  // data: `capability_profile_city_known` and `_photo_state_known` refuse
  // anything else at write time.
  const record: ProfileRecord = {
    slug: row.slug,
    fullName: row.fullName,
    firstName: row.firstName,
    lastInitial: row.lastInitial,
    city: row.city as CityId,
    headline: row.headline,
    about: row.about,
    phone: row.phone,
    email: row.email,
    photoState: row.photoState as PhotoState,
    photoUrl: await ownPhotoUrl(row.photoState as PhotoState, row.photoKey),
    skills,
    workHistory: history.map((entry) => entry.text),
    publishedAt: row.publishedAt,
  };

  return toOwnProfile(record);
}

/**
 * Where **she** sees her own photo — the one place a photo crosses before
 * anybody has approved it.
 *
 * The spec's `/my-profile` cell is explicit: _"photo pending → **her own photo
 * shown**, dignified, described as under review, not flagged"_. So the two
 * states resolve to two different kinds of URL, and the difference is not
 * cosmetic:
 *
 * - **`approved`** is the public object, read through the transformation origin
 *   like everybody else's.
 * - **`pending`** is a **signed, one-minute read of the quarantined object**,
 *   because the quarantine bucket has no public access and no origin in front
 *   of it — which is the whole of NFR6. There is no other way to show it to
 *   her, and showing it to her is the requirement.
 *
 * `absent` and `rejected` have no object at all: `rejectPhoto` sets `photoKey`
 * to `NULL` and deletes the bytes, so both render her initial and the sentence
 * beside it carries which of the two happened.
 *
 * **It never throws.** A store that is unconfigured or unreachable must not take
 * `/my-profile` down — she has a profile, it is published, and the photo is the
 * one part of that page that can be absent without the page being wrong. The
 * fallback is `null`, which every surface already renders as her initial.
 */
async function ownPhotoUrl(state: PhotoState, key: string | null): Promise<string | null> {
  if (!key) return null;

  try {
    if (state === "approved") return publicPhotoUrl(key);
    if (state === "pending") return await presignReview(key);
  } catch {
    return null;
  }

  return null;
}

/**
 * **The pooled bindings: what a Server Component or Server Action calls.**
 *
 * ADR-0010 withholds `#connection`, so `apps/web` has no handle to pass and
 * reaches the database through this object or not at all.
 */
export const profiles = {
  async publish(accountId: string, input: PublishProfileInput): Promise<PublishProfileOutcome> {
    return publishProfile(pooledDatabase(), accountId, input);
  },

  async update(accountId: string, input: UpdateProfileInput): Promise<UpdateProfileOutcome> {
    return updateProfile(pooledDatabase(), accountId, input);
  },

  async has(accountId: string): Promise<boolean> {
    return hasProfile(pooledDatabase(), accountId);
  },

  async prefill(accountId: string): Promise<{ readonly fullName: string }> {
    return readPublishPrefill(pooledDatabase(), accountId);
  },

  async findOwn(accountId: string): Promise<OwnProfile | null> {
    return findOwnProfile(pooledDatabase(), accountId);
  },

  /**
   * The gated read, in the two halves `/profile/[slug]` streams.
   *
   * **Neither takes a principal, and unlike the two lists above that is not
   * because the shape is public.** It is not: `about` and the work history are
   * `personal` and gated. The authorization is a property of the *caller* — a
   * live session, and an `offerSendingState` that is not `frozen` — rather than
   * of the row, and neither is knowable from the slug, so passing one here
   * would be a parameter this function could do nothing with. The route holds
   * both checks, and `accounts.offerSendingState` is the second of them.
   */
  async findGated(slug: string): Promise<GatedIdentity | null> {
    return findGatedIdentity(pooledDatabase(), slug);
  },

  async gatedWorkHistory(slug: string): Promise<readonly string[]> {
    return findGatedWorkHistory(pooledDatabase(), slug);
  },

  /**
   * The Wall, newest first.
   *
   * **It takes no principal, and that is not an exception to the rule that every
   * function reading an owned row takes one first.** That rule is about owned
   * rows; a published profile's public projection is owned by nobody who has to
   * be checked, which is the whole of story 4 — a Hirer decides whether anyone
   * here is worth paying before he is asked to register.
   */
  async wall(options?: ListOptions): Promise<ProfileListPage> {
    return listWall(pooledDatabase(), options);
  },

  /**
   * The browsable list, fewest delivered Offers first. Public for the same
   * reason, and narrowed by whatever a Hirer put in the URL.
   *
   * The filters are the only thing this takes beyond the Wall's options, and
   * they are all optional: a caller that sets none reads the whole list.
   */
  async browse(options?: BrowseOptions): Promise<ProfileListPage> {
    return listBrowse(pooledDatabase(), options);
  },

  /**
   * How many profiles were published since `since` — the Admin queue's platform
   * signal, and the one read on this facade that answers a question about the
   * platform rather than about one profile.
   *
   * The caller supplies the instant so that one clock reading governs every
   * figure on the screen it renders into.
   */
  async publishedSince(since: Date): Promise<number> {
    return countPublishedSince(pooledDatabase(), since);
  },
};

/**
 * The two reads themselves are **not** re-exported, only their option and page
 * types. `listWall` and `listBrowse` take a `DomainDatabase`, and ADR-0010
 * withholds every handle from `apps/web` — so publishing them past the facade
 * would put a function on the public subpath that no caller outside this package
 * can supply an argument to. `profiles.wall()` and `profiles.browse()` are the
 * door; seam 2 reaches the functions through `#profiles/listing`, which is
 * private to this package.
 */
export type { BrowseFilters, BrowseOptions, ListOptions, ProfileListPage } from "#profiles/listing";
export { SLUG_PATTERN } from "#profiles/slug";
export type { GatedIdentity, GatedProfile, OwnProfile, PublicProfile } from "#projections";
