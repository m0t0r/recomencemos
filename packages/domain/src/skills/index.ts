/**
 * `@repo/domain/skills` — reads over the closed vocabulary, and the reason there
 * is no write here at all.
 *
 * **The vocabulary is a migration, not a table this package fills.** DD12 ships
 * the seed as an idempotent migration precisely so the list seam 2 tests against
 * and the list production serves cannot drift; a `seedSkills()` function beside
 * these reads would be a second way to put a row in, and the two would agree
 * until the day they did not. The list grows through Admin promotion — story 3's
 * `promoteSkill`, which is #20's, and which will write through `#admin`'s audited
 * path rather than through this module.
 *
 * **What crosses is `{ slug, labelEs }` and nothing else.** The row carries a
 * `BIGINT` id, a `cuocCode` and an `active` flag, and none of the three is
 * anybody's business outside this package: the id is a key that reaches no URL,
 * `cuocCode` is provenance for the person maintaining the seed, and `active` is
 * already answered by whether an entry appears at all. Building the shape field
 * by field is [ADR-0003](../../../../docs/adr/0003-no-tojson-on-cross-boundary-types.md)'s
 * rule, and the `mode: "bigint"` id is the backstop underneath it — `JSON.stringify`
 * throws on a `BigInt`, so a row passed whole to a serializer fails loudly rather
 * than publishing a key.
 */

import { asc, eq, inArray } from "drizzle-orm";
import type { DomainDatabase } from "#database";
import * as schema from "#schema";

/**
 * One entry of the vocabulary, as it crosses the boundary.
 *
 * `slug` is the identifier a browse filter puts in a query parameter and
 * `labelEs` is the `es-CO` string a person reads — the identifier/value line
 * NFR29 draws, in one object.
 */
export interface VocabularyEntry {
  readonly slug: string;
  readonly labelEs: string;
}

/**
 * The two columns that cross, and the order they cross in, stated once.
 *
 * Both reads below differ only in which rows they want; sharing the projection
 * and the ordering is what leaves that difference visible in the `where` clause
 * instead of buried in two near-identical query builders. It is also the one
 * place ADR-0003's field-by-field whitelist has to be got right — a column added
 * to the table reaches a caller only by being added here, on purpose.
 */
const ENTRY = { slug: schema.skill.slug, labelEs: schema.skill.labelEs };
const RENDERED_ORDER = asc(schema.skill.labelEs);

/**
 * The whole choosable vocabulary, in the order it is rendered.
 *
 * **Ordered by label rather than by insertion**, because the picker and the
 * browse filter both render it to a person and the seed's own row order is the
 * order of nothing. Sorting in the engine rather than in JavaScript is what makes
 * the partial index on `(label_es) WHERE active` the answer to this query instead
 * of decoration.
 *
 * **Retired entries are absent.** A Skill is never deleted — a profile may
 * already point at it — so `active` is how one stops being offered, and this read
 * is the only place that distinction has to be remembered.
 */
export async function listActiveSkills(db: DomainDatabase): Promise<VocabularyEntry[]> {
  return db
    .select(ENTRY)
    .from(schema.skill)
    .where(eq(schema.skill.active, true))
    .orderBy(RENDERED_ORDER);
}

/**
 * The entries for a set of slugs, in the same rendered order.
 *
 * **Retired entries are included here, and that asymmetry with
 * {@link listActiveSkills} is the point.** A Worker who chose a Skill that was
 * later retired still said something true about herself, and a profile that
 * silently dropped it would be the platform editing her words. So one read
 * answers *what may still be chosen* and the other answers *what does this
 * profile hold* — and a caller validating a submission wants the first.
 *
 * **An unknown slug is absent from the result rather than an error.** The caller
 * that cares — the publishing form, checking what was submitted against the
 * closed list — learns it from the count, and the caller that does not is
 * rendering a profile whose rows came from this table in the first place.
 *
 * An empty request is answered without asking the engine: `IN ()` is not valid
 * SQL, and Drizzle's rendering of an empty `inArray` is not a shape worth relying
 * on either way.
 */
export async function findSkillsBySlug(
  db: DomainDatabase,
  slugs: readonly string[],
): Promise<VocabularyEntry[]> {
  if (slugs.length === 0) return [];

  return db
    .select(ENTRY)
    .from(schema.skill)
    .where(inArray(schema.skill.slug, [...slugs]))
    .orderBy(RENDERED_ORDER);
}

/**
 * **The pooled bindings: what a Server Component or Server Action calls.**
 *
 * ADR-0010 withholds `#connection`, so `apps/web` has no handle to pass. The
 * dynamic import is the mechanism `ceilings`, `admin` and `consent` already use,
 * and for the same reason: `#connection` carries `import "server-only"`, which
 * throws under plain `node`, and a static import here would make this module
 * unimportable at seam 1 and seam 2 — the two places its logic is actually
 * tested.
 */
export const skills = {
  async listActive(): Promise<VocabularyEntry[]> {
    const { db } = await import("#connection");
    return listActiveSkills(db());
  },

  async findBySlug(slugs: readonly string[]): Promise<VocabularyEntry[]> {
    const { db } = await import("#connection");
    return findSkillsBySlug(db(), slugs);
  },
};
