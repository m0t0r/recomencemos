/**
 * Seam 1 on the migrator: does `MIGRATIONS_FOLDER` actually point at the
 * committed migrations?
 *
 * The narrow question, and the one worth a test. **Applying** them needs a real
 * Postgres, which `pnpm test` deliberately does not have — CI starts no database
 * service and `CLAUDE.md` forbids adding one, because the moment a test needs a
 * database seam 2's argument has been lost. So the apply leg is verified by
 * running `pnpm db:migrate` against the Compose stack and recording it, and what
 * is automated here is the failure that would otherwise be silent.
 *
 * And it is silent: a migrator handed a folder that does not exist, or one
 * resolved against the wrong working directory, **reports success having applied
 * nothing**. A Vitest worker and a Fly `release_command` do not share a working
 * directory, which is exactly why the constant is resolved from `import.meta.url`
 * — and exactly why that resolution deserves an assertion rather than trust.
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { MIGRATIONS_FOLDER } from "#migrate";

describe("MIGRATIONS_FOLDER", () => {
  it("resolves to a directory that exists", async () => {
    await expect(stat(MIGRATIONS_FOLDER).then((entry) => entry.isDirectory())).resolves.toBe(true);
  });

  it("is the committed folder, not an empty one a migrator would call a success", async () => {
    const journal = JSON.parse(
      await readFile(join(MIGRATIONS_FOLDER, "meta", "_journal.json"), "utf8"),
    );

    expect(journal.entries.length).toBeGreaterThan(0);
  });

  it("holds a .sql file for every tag the journal names", async () => {
    // The journal and the files are what production and seam 2 each read, and a
    // tag with no file is the shape a mis-resolved merge leaves behind.
    const journal = JSON.parse(
      await readFile(join(MIGRATIONS_FOLDER, "meta", "_journal.json"), "utf8"),
    );
    const present = new Set(
      (await readdir(MIGRATIONS_FOLDER)).filter((name) => name.endsWith(".sql")),
    );

    for (const { tag } of journal.entries) expect(present).toContain(`${tag}.sql`);
  });
});
