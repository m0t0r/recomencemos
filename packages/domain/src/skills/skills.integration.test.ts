/**
 * Seam 2 over the Skill vocabulary: **the seed applies, applying it again
 * changes nothing, and the module reads back what it wrote.**
 *
 * The three are one property seen from three sides, and none of them can be
 * asserted anywhere else. The list is not a TypeScript constant this package
 * exports — it is rows a committed migration inserts — so a pure test would have
 * nothing to read, and a fixture written for the test would be a second copy of
 * the very list the migration exists to be the only source of.
 *
 * **Idempotency is tested by re-running the artifact, not by re-describing it.**
 * The seed's SQL is read off disk and executed a second time against the restored
 * snapshot, which is exactly what a re-deploy against a database that has already
 * seen it would do. Asserting on `ON CONFLICT DO NOTHING` appearing in the file
 * would be asserting on the spelling of the fix rather than on the behaviour.
 *
 * **The vocabulary's own rules are asserted here too**, because the database is
 * where the vocabulary actually lives. A label that needs a slash form, a label
 * longer than a label, a Spanish slug, a `cuoc_code` that is not a CUOC code —
 * every one of those is a mistake a later Admin promotion can make just as easily
 * as this seed could, and this is the one place that can notice.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { count, eq } from "drizzle-orm";
import { MIGRATIONS_FOLDER } from "#migrate";
import * as schema from "#schema";
import { findSkillsBySlug, listActiveSkills } from "#skills";
import { test } from "#testing/fixtures";
import type { TestDatabase } from "#testing/fixtures";

/**
 * The seed migration's SQL, found through the journal rather than by a filename
 * typed here.
 *
 * A hardcoded path would go quietly stale if the migration were ever renamed —
 * the read would throw, someone would "fix" the test, and the idempotency check
 * would have moved to whatever file the new name pointed at. Reading the journal
 * means a rename that this test cannot follow fails as a rename, naming the tag
 * it looked for.
 */
async function seedSql(): Promise<string> {
  const journal = JSON.parse(
    await readFile(join(MIGRATIONS_FOLDER, "meta", "_journal.json"), "utf8"),
  ) as { entries: { tag: string }[] };

  const entries = journal.entries.filter((entry) => entry.tag.includes("seed_skill_vocabulary"));
  if (entries.length !== 1) {
    throw new Error(
      `expected exactly one journalled migration whose tag names the vocabulary seed, found ${entries.length}. ` +
        "If it was renamed, this test has lost the file whose idempotency it checks.",
    );
  }

  return readFile(join(MIGRATIONS_FOLDER, `${entries[0]?.tag}.sql`), "utf8");
}

/** Every seeded row, including the columns the module deliberately withholds. */
async function everyRow(database: TestDatabase) {
  return database.db
    .select({
      slug: schema.skill.slug,
      labelEs: schema.skill.labelEs,
      cuocCode: schema.skill.cuocCode,
      active: schema.skill.active,
    })
    .from(schema.skill)
    .orderBy(schema.skill.slug);
}

describe("the seeded vocabulary", () => {
  test("arrives with the migrations, so the tests and production hold one list", async ({
    database,
  }) => {
    const rows = await everyRow(database);

    // A number rather than "more than zero": a seed that half-applied would still
    // be non-empty, and this is the count the PR body's coverage claim is about.
    expect(rows).toHaveLength(91);
    expect(rows.every((row) => row.active)).toBe(true);
  });

  test("is idempotent — applying it a second time changes nothing", async ({ database }) => {
    const before = await everyRow(database);

    await database.client.exec(await seedSql());

    expect(await everyRow(database)).toEqual(before);
  });

  /**
   * **Every entry the migration seeded**, which in this suite is every entry
   * there is. The column is nullable because the vocabulary has a second source —
   * an Admin promoting what a Worker asked for, which may answer to no CUOC
   * *Ocupación* at all — and `?? ""` fails this assertion rather than passing it,
   * so a seeded row that lost its code is still red here.
   */
  test("records a five-digit CUOC code as the provenance of every seeded entry", async ({
    database,
  }) => {
    const rows = await everyRow(database);

    expect(rows.filter((row) => !/^\d{5}$/.test(row.cuocCode ?? ""))).toEqual([]);
  });

  /**
   * NFR29's identifier half. The slug is what a browse filter carries in a query
   * parameter, so it is an identifier and stays English and ASCII — an accent
   * here would be the Spanish leaking out of the one column that is allowed to
   * hold it.
   */
  test("keeps the slug an English kebab-case identifier", async ({ database }) => {
    const rows = await everyRow(database);

    expect(rows.filter((row) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(row.slug))).toEqual([]);
  });

  /**
   * The two rules `docs/policy/voice.md` states as countable, applied to the one
   * place labels are stored. The slash form is the gender rule: every label is a
   * verb phrase or a capability noun precisely so that none of them needs one.
   */
  test("keeps every label inside the voice guide's label rules", async ({ database }) => {
    const rows = await everyRow(database);

    expect(rows.filter((row) => row.labelEs.split(/\s+/).length > 5)).toEqual([]);
    expect(rows.filter((row) => row.labelEs.includes("/"))).toEqual([]);
    expect(rows.filter((row) => row.labelEs !== row.labelEs.trim())).toEqual([]);
  });

  /**
   * `CONTEXT.md`'s _Avoid_ list for Skill, plus the words `voice.md` never says
   * that could plausibly reach a label of work. Scoped to whole words so that
   * *Cuidar* is not read as an instance of *cuidado*.
   *
   * **`ayuda` is on the list and `ayudar` is deliberately not**, which is the
   * one place this check encodes a distinction rather than a word. The voice
   * guide bans the verb only *where the object is a person's situation* and
   * keeps it for a concrete task with a concrete object — its own example is
   * *"Te ayudamos a llenar el formulario"*. `Ayudar en la cocina` is that
   * shape; *ayuda* as a noun never is.
   */
  test("uses none of the words the vocabulary is defined against", async ({ database }) => {
    const forbidden = [
      "servicio",
      "servicios",
      "categoría",
      "categorias",
      "etiqueta",
      "competencia",
      "competencias",
      "vacante",
      "empleo",
      "candidato",
      "candidata",
      "ayuda",
      "trabajito",
    ];
    const rows = await everyRow(database);

    const offenders = rows.filter((row) =>
      forbidden.some((word) => new RegExp(`\\b${word}\\b`, "i").test(row.labelEs)),
    );

    expect(offenders).toEqual([]);
  });
});

describe("reading the vocabulary back", () => {
  /**
   * **Two orderings are compared, and their agreement is the assertion.** The
   * engine sorts by its own collation; a person reading a picker expects `es-CO`.
   * They agree over this vocabulary, and the day a new entry makes them disagree
   * this test is the thing that says so — at which point the question is which
   * ordering is right for the person, and the answer is the second one.
   */
  test("lists the choosable entries in the order they are rendered", async ({ database }) => {
    const entries = await listActiveSkills(database.db);
    const [{ count: rowCount } = { count: 0 }] = await database.db
      .select({ count: count() })
      .from(schema.skill);

    expect(entries).toHaveLength(rowCount);
    expect(entries.map((entry) => entry.labelEs)).toEqual(
      entries.map((entry) => entry.labelEs).toSorted((a, b) => a.localeCompare(b, "es-CO")),
    );
  });

  /**
   * ADR-0003's rule, asserted on the object that crosses rather than on how it
   * was built: the id, the CUOC code and the flag are absent, and the `BIGINT`
   * key in particular never reaches a caller that could serialise it.
   */
  test("crosses the boundary as a slug and a label, and nothing else", async ({ database }) => {
    const [entry] = await listActiveSkills(database.db);

    expect(Object.keys(entry ?? {}).toSorted()).toEqual(["labelEs", "slug"]);
  });

  test("stops offering an entry that has been retired", async ({ database }) => {
    await database.db
      .update(schema.skill)
      .set({ active: false })
      .where(eq(schema.skill.slug, "knitting"));

    const slugs = (await listActiveSkills(database.db)).map((entry) => entry.slug);

    expect(slugs).not.toContain("knitting");
  });

  test("finds the entries for a set of slugs, in the same rendered order", async ({ database }) => {
    const entries = await findSkillsBySlug(database.db, ["plumbing", "child-care"]);

    // Label order, not the order the slugs were asked for — *Arreglar* precedes
    // *Cuidar*, and the caller rendering a profile's Skills should not have to
    // sort them again.
    expect(entries).toEqual([
      { slug: "plumbing", labelEs: "Arreglar tuberías y baños" },
      { slug: "child-care", labelEs: "Cuidar niños por horas" },
    ]);
  });

  /**
   * The asymmetry with {@link listActiveSkills}, and the reason it is deliberate:
   * a Worker who chose a Skill that was later retired still said something true
   * about herself, and a profile that dropped it would be the platform editing
   * her words.
   */
  test("still finds a retired entry, because a profile may already hold it", async ({
    database,
  }) => {
    await database.db
      .update(schema.skill)
      .set({ active: false })
      .where(eq(schema.skill.slug, "knitting"));

    expect(await findSkillsBySlug(database.db, ["knitting"])).toEqual([
      { slug: "knitting", labelEs: "Tejer a mano" },
    ]);
  });

  test("drops a slug the vocabulary does not have, rather than refusing", async ({ database }) => {
    const entries = await findSkillsBySlug(database.db, ["plumbing", "time-travel"]);

    expect(entries.map((entry) => entry.slug)).toEqual(["plumbing"]);
  });

  test("answers an empty request without asking the engine", async ({ database }) => {
    expect(await findSkillsBySlug(database.db, [])).toEqual([]);
  });
});
