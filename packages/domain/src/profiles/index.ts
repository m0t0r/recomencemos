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

import { and, asc, eq, inArray } from "drizzle-orm";
import { recordConsent } from "#consent/index";
import type { ConsentVersions } from "#consent/registry";
import type { DomainDatabase } from "#database";
import { type CityId, isCityId } from "#policy/cities";
import { type ContactDetailKind, rejectContactDetails } from "#policy/contact-details";
import { normalizeColombianPhone } from "#policy/phone";
import { normalizeSearchText } from "#policy/search-text";
import { mintSlug } from "#profiles/slug";
import { type OwnProfile, type PhotoState, type ProfileRecord, toOwnProfile } from "#projections";
import * as schema from "#schema";

/** What the boundary parse hands over. Shape has been checked; substance is checked here. */
export interface PublishProfileInput {
  readonly fullName: string;
  readonly firstName: string;
  readonly lastInitial: string;
  readonly city: string;
  readonly headline: string;
  readonly about: string;
  readonly phone: string;
  readonly skillSlugs: readonly string[];
  readonly workHistory: readonly string[];
  readonly consentVersions: ConsentVersions;
}

/** The fields a refusal can name. English identifiers; the surface maps them to labels. */
export type PublishField = "headline" | "about" | "workHistory" | "skillSlugs" | "phone" | "city";

/**
 * One reason a submission was refused, with what the surface needs to say it:
 * the field, the kind, and — for the rejector — the fragment (NFR12).
 */
export type PublishRefusal =
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
      readonly refusals: readonly PublishRefusal[];
    };

/** The pure half: everything that can be refused without a row. */
function refusalsFor(input: PublishProfileInput): PublishRefusal[] {
  const refusals: PublishRefusal[] = [];

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

export async function publishProfile(
  db: DomainDatabase,
  accountId: string,
  input: PublishProfileInput,
): Promise<PublishProfileOutcome> {
  const refusals = refusalsFor(input);
  if (refusals.length > 0) return { ok: false, reason: "refused", refusals };

  // Narrowed by `refusalsFor` above; restated here so the types agree without a cast.
  const phone = normalizeColombianPhone(input.phone);
  if (!phone.ok || !isCityId(input.city)) return { ok: false, reason: "refused", refusals };
  const city: CityId = input.city;

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
      .select({ id: schema.skill.id, slug: schema.skill.slug })
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

    const labels = await tx
      .select({ labelEs: schema.skill.labelEs })
      .from(schema.skill)
      .where(inArray(schema.skill.slug, wanted));

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
        phone: phone.e164,
        searchText: normalizeSearchText(
          input.firstName,
          city,
          input.headline,
          ...labels.map((label) => label.labelEs),
        ),
      })
      .returning({ id: schema.capabilityProfile.id });

    // `RETURNING` on an insert always yields the row; a missing one means the
    // driver did something this code does not model, and throwing rolls back.
    if (!profile)
      throw new Error("Inserting the profile returned no row; the transaction rolls back.");

    await tx
      .insert(schema.profileSkill)
      .values(skills.map((skill) => ({ capabilityProfileId: profile.id, skillId: skill.id })));

    const history = input.workHistory.map((text) => text.trim()).filter((text) => text.length > 0);

    if (history.length > 0) {
      await tx
        .insert(schema.workHistoryEntry)
        .values(
          history.map((text, position) => ({ capabilityProfileId: profile.id, position, text })),
        );
    }

    // Last, inside the same transaction, and it throws on a stale version —
    // which rolls back everything above. See `#consent`.
    await recordConsent(tx, { accountId, side: "worker", versions: input.consentVersions });

    return { ok: true as const, slug };
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
    // No photo path exists yet, so there is no URL to resolve. The photo ticket
    // replaces this with the derivation DD6 describes.
    photoUrl: null,
    skills,
    workHistory: history.map((entry) => entry.text),
    publishedAt: row.publishedAt,
  };

  return toOwnProfile(record);
}

/**
 * **The pooled bindings: what a Server Component or Server Action calls.**
 *
 * ADR-0010 withholds `#connection`, so `apps/web` has no handle to pass. The
 * dynamic import is the mechanism every other public subpath uses, and for the
 * same reason: `#connection` carries `import "server-only"`, which throws under
 * plain `node`, and a static import here would make this module unimportable at
 * seam 1 and seam 2.
 */
export const profiles = {
  async publish(accountId: string, input: PublishProfileInput): Promise<PublishProfileOutcome> {
    const { db } = await import("#connection");
    return publishProfile(db(), accountId, input);
  },

  async has(accountId: string): Promise<boolean> {
    const { db } = await import("#connection");
    return hasProfile(db(), accountId);
  },

  async prefill(accountId: string): Promise<{ readonly fullName: string }> {
    const { db } = await import("#connection");
    return readPublishPrefill(db(), accountId);
  },

  async findOwn(accountId: string): Promise<OwnProfile | null> {
    const { db } = await import("#connection");
    return findOwnProfile(db(), accountId);
  },
};

export { SLUG_PATTERN } from "#profiles/slug";
export type { OwnProfile } from "#projections";
