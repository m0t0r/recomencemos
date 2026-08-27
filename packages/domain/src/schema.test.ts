/**
 * Seam 2, end to end: the committed migrations, replayed into PGlite, producing
 * the schema this package declares.
 *
 * What it is really asserting is that seam 2 is _"a real seam rather than a mock
 * in a database costume"_. Every case below would be false against a mock, and
 * three of them would be false against a `CREATE TABLE` written for tests: the
 * engine's own version, the extensions the design depends on, and the
 * constraints the migration — not the schema file — actually created.
 */

import { rateCounter } from "#schema";
import { restoreDatabase, type TestDatabase } from "#testing/database";

let database: TestDatabase;

beforeEach(async () => {
  database = await restoreDatabase();
});

afterEach(async () => {
  await database.close();
});

const aCounter = {
  principal: "worker@example.co",
  action: "requestMagicLink",
  windowStart: new Date("2026-08-27T10:00:00Z"),
};

describe("the engine seam 2 runs against", () => {
  it("is PostgreSQL 18, the major version PlanetScale runs", async () => {
    // Read out of the running engine rather than recalled. PlanetScale is 18.4
    // and this is 18.x: one major version, which is the alignment the whole
    // argument for testing here rests on. If this ever fails, seam 2's claim has
    // changed and `## Testing Decisions` needs revisiting — not this assertion.
    const { rows } = await database.client.query<{ version: string }>(
      "SELECT current_setting('server_version') AS version",
    );
    expect(rows[0]?.version).toMatch(/^18\./);
  });

  it("has the two extensions the design depends on, enabled out of band", async () => {
    const { rows } = await database.client.query<{ extname: string }>(
      "SELECT extname FROM pg_extension ORDER BY extname",
    );
    const installed = rows.map((row) => row.extname);

    expect(installed).toContain("citext"); // the unique email in DD2
    expect(installed).toContain("pg_trgm"); // NFR21's Spanish search
  });

  it("does not have `unaccent`, which DD4 deliberately does not use", async () => {
    // Normalising in the application removes a divergence risk rather than
    // testing around one. An `unaccent` that appeared here would mean somebody
    // reached for it, and the local engine would then be ahead of PlanetScale.
    const { rows } = await database.client.query<{ extname: string }>(
      "SELECT extname FROM pg_extension WHERE extname = 'unaccent'",
    );
    expect(rows).toHaveLength(0);
  });
});

describe("the committed migrations", () => {
  it("applied, and recorded themselves as applied", async () => {
    const { rows } = await database.client.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM drizzle.__drizzle_migrations",
    );
    expect(Number(rows[0]?.count)).toBe(1);
  });

  it("created `rate_counter` with the columns the schema declares", async () => {
    const { rows } = await database.client.query<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_name = 'rate_counter' ORDER BY ordinal_position`,
    );

    expect(rows).toEqual([
      { column_name: "id", data_type: "bigint" },
      { column_name: "principal", data_type: "text" },
      { column_name: "action", data_type: "text" },
      { column_name: "window_start", data_type: "timestamp with time zone" },
      { column_name: "count", data_type: "integer" },
      { column_name: "created_at", data_type: "timestamp with time zone" },
    ]);
  });

  it("made every column NOT NULL, which is DD2's first per-table rule", async () => {
    const { rows } = await database.client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'rate_counter' AND is_nullable = 'YES'`,
    );
    expect(rows).toEqual([]);
  });
});

describe("a rate counter row", () => {
  it("gets its id and its created_at from the database, not from the caller", async () => {
    const [written] = await database.db.insert(rateCounter).values(aCounter).returning();

    expect(written?.id).toBeTypeOf("bigint");
    expect(written?.count).toBe(0);
    expect(written?.createdAt).toBeInstanceOf(Date);
  });

  it("cannot have its identity overridden, because the key is GENERATED ALWAYS", async () => {
    await expect(
      database.client.query(
        "INSERT INTO rate_counter (id, principal, action, window_start) VALUES (1, 'a', 'b', now())",
      ),
    ).rejects.toThrow();
  });

  it("is unique per principal, action and window", async () => {
    await database.db.insert(rateCounter).values(aCounter);

    await expect(database.db.insert(rateCounter).values(aCounter)).rejects.toThrow();
  });

  it("is not unique across windows, which is what makes it a rolling ceiling", async () => {
    await database.db.insert(rateCounter).values(aCounter);
    await database.db
      .insert(rateCounter)
      .values({ ...aCounter, windowStart: new Date("2026-08-27T11:00:00Z") });

    const rows = await database.db.select().from(rateCounter);
    expect(rows).toHaveLength(2);
  });

  it("refuses a negative count, the backstop that must never fire", async () => {
    await expect(
      database.db.insert(rateCounter).values({ ...aCounter, count: -1 }),
    ).rejects.toThrow();
  });
});

describe("isolation between restores", () => {
  it("is real: a row written to one engine is invisible to another", async () => {
    // Two instances from the same snapshot rather than two test files, so the
    // proof does not depend on which file the runner happens to schedule first.
    const other = await restoreDatabase();

    try {
      await database.db.insert(rateCounter).values(aCounter);

      expect(await database.db.select().from(rateCounter)).toHaveLength(1);
      expect(await other.db.select().from(rateCounter)).toHaveLength(0);
    } finally {
      await other.close();
    }
  });

  it("starts every restore from the post-migration state, never a used one", async () => {
    const { rows } = await database.client.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM rate_counter",
    );
    expect(Number(rows[0]?.count)).toBe(0);

    await database.db.insert(rateCounter).values(aCounter);
    await expect(database.db.select().from(rateCounter)).resolves.toHaveLength(1);
  });
});

describe("the snapshot the schema is built from", () => {
  it("carries no data of its own, so a fixture cannot be inherited by accident", async () => {
    const { rows } = await database.client.query<{ relname: string }>(
      `SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r'`,
    );

    // Interpolated below, and safe because of this: these names come from
    // `pg_class` and are asserted to be bare lower-case identifiers before they
    // are spliced. A table this repo could not name that way is a table this
    // check should stop at rather than quote around.
    for (const { relname } of rows) expect(relname).toMatch(/^[a-z_][a-z0-9_]*$/);

    const counted = await Promise.all(
      rows.map(async ({ relname }) => {
        const { rows: result } = await database.client.query<{ count: string }>(
          `SELECT count(*)::text AS count FROM "${relname}"`,
        );
        return [relname, Number(result[0]?.count)];
      }),
    );

    expect(counted).toEqual(rows.map(({ relname }) => [relname, 0]));
  });
});
