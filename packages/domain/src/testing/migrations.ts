/**
 * One committed migration's SQL, for a seam-2 test that replays it over rows
 * the post-migration snapshot does not hold.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { MIGRATIONS_FOLDER } from "#migrate";

/**
 * A journalled migration's SQL, found through the journal rather than by a
 * filename typed in a test.
 *
 * A hardcoded path would go quietly stale if the migration were ever renamed —
 * the read would throw, someone would "fix" the test, and the check would have
 * moved to whatever file the new name pointed at. Reading the journal means a
 * rename that a test cannot follow fails as a rename, naming the tag it looked
 * for.
 */
export async function journalledSql(tagFragment: string): Promise<string> {
  const journal = JSON.parse(
    await readFile(join(MIGRATIONS_FOLDER, "meta", "_journal.json"), "utf8"),
  ) as { entries: { tag: string }[] };

  const entries = journal.entries.filter((entry) => entry.tag.includes(tagFragment));
  if (entries.length !== 1) {
    throw new Error(
      `expected exactly one journalled migration whose tag contains "${tagFragment}", found ${entries.length}. ` +
        "If it was renamed, this test has lost the file whose behaviour it checks.",
    );
  }

  return readFile(join(MIGRATIONS_FOLDER, `${entries[0]?.tag}.sql`), "utf8");
}
