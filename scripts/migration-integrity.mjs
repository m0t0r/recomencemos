#!/usr/bin/env node
// NFR30, made mechanical: the migration history is append-only by nature and
// editable by accident, so the four counts DD13 names are checked rather than
// agreed.
//
// It runs twice, and both halves are inside `pnpm test`, which
// `docs/policy/build.md` -> `required-checks` already puts on every pull request.
// `gate-test.sh` drives it over fixture repositories, and the `//#migrations:check`
// task runs it against this repository — uncached, because that answer depends on
// git history and on migration files no `inputs` glob covers, so a cached replay
// would report a pass nothing had checked. A gate that only ever sees fixtures
// guards nothing, and a gate whose live run can be replayed from cache is the
// same thing wearing a green tick.
//
// Four refusals, in the order they are checked:
//
//   1. The journal is append-only. Two branches adding migrations always collide
//      in `meta/_journal.json`, so a merge resolved the wrong way is the ordinary
//      way an entry gets reordered or dropped — after which production and the
//      test seam apply different SQL in a different order.
//   2. A migration already on the default branch is immutable. This is the quiet
//      one: editing it changes nothing in production, because Drizzle will not
//      re-run it, but PGlite replays every migration from scratch on every test
//      run — so seam 2 starts testing a schema production does not have, and goes
//      green doing it.
//   3. A destructive statement travels alone, in a migration whose name says so.
//      Mixing one with additive statements means the additive half cannot be
//      rolled back without also reversing the drop, and the drop is the half that
//      has already destroyed the data.
//   4. A marked migration does not share a pull request with a change to
//      `@repo/domain`'s query modules. Ship the code that stops using the column,
//      deploy, then drop it — DD10's expand/contract rule, enforced at the part a
//      human forgets under time pressure.
//
// **The marker is the word `contract` in the migration's tag** —
// `0004_contract_drop_offer_note.sql`. One marker rather than two, because every
// statement in NFR30's destructive list *is* the contract half of an
// expand/contract; a second spelling would leave rule 4 a hole to fall through.
// It is an opt-in and not a prohibition, per NFR30's second half: every refusal
// names the statement, the file, and the marker it wanted, because a guardrail
// that cannot be satisfied becomes a reason to edit production by hand.
//
// **Git is the hash record.** DD13 asks for content hashed at a tag's first
// appearance and compared thereafter; a blob at the merge base is exactly that,
// and it needs no second manifest that could be edited alongside the file it
// vouches for.
//
// **Three exit codes, for the reason `audit-direct.mjs` has three.** `0` is a
// pass, `1` is a refusal, and `2` is the gate failing to reach an answer at all —
// an unreadable journal, a shallow clone with no merge base. The third exists so
// that a broken gate cannot be mistaken for a clean one.
//
// Output goes through `process.stdout.write` rather than `console.log`, for the
// reason `CLAUDE.md` gives: this runs before, and outside, the application, so
// there is no logger on this path and the console is not an output channel here.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// The tag marker, and the modules a marked migration may still move with. The
// Drizzle schema is what a contract migration is *generated from*, so refusing it
// would refuse the only way to satisfy the rule; `migrate` is the migrator, and
// `policy` and `projections` are the two modules the spec calls pure.
const MARKER = /(^|_)contract(_|$)/i;
const NOT_A_QUERY_MODULE = new Set(["schema", "migrate", "policy", "projections"]);
const DOMAIN_PACKAGE = "@repo/domain";

// Exactly the statements NFR30 enumerates, and nothing invented beside them. A
// rule nobody wrote down is a rule nobody can satisfy on purpose.
const DESTRUCTIVE = [
  [/\bDROP\s+TABLE\b/, "DROP TABLE"],
  [/\bDROP\s+COLUMN\b/, "DROP COLUMN"],
  [/\bDROP\s+CONSTRAINT\b/, "DROP CONSTRAINT"],
  [/\bALTER\s+(?:COLUMN\s+)?\S+\s+(?:SET\s+DATA\s+)?TYPE\b/, "ALTER COLUMN … TYPE"],
  [/\bALTER\s+(?:COLUMN\s+)?\S+\s+SET\s+NOT\s+NULL\b/, "ALTER COLUMN … SET NOT NULL"],
  [/\bRENAME\b/, "RENAME"],
];

const JOURNAL_SUFFIX = "meta/_journal.json";

const out = (line = "") => process.stdout.write(`${line}\n`);
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Anything that stops the gate reaching an answer, as against an answer of "no".
class GateError extends Error {}

function parseArgs(argv) {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const options = { root: repoRoot, base: null };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag !== "--root" && flag !== "--base") {
      throw new GateError(`unknown argument: ${flag}`);
    }
    const value = argv[i + 1];
    if (value === undefined) throw new GateError(`${flag} needs a value`);
    options[flag.slice(2)] = flag === "--root" ? resolve(value) : value;
    i += 1;
  }
  return options;
}

function git(root, args, { optional = false } = {}) {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    if (optional) return null;
    // git's own stderr, not Node's summary of it: "fatal: bad revision" is the
    // sentence that tells you what to fix.
    const reason = `${error.stderr ?? ""}`.trim() || error.message;
    throw new GateError(`\`git ${args.join(" ")}\` failed: ${reason}`);
  }
}

const lines = (text) => (text ?? "").split("\0").filter(Boolean);

// Everything the repository holds, tracked or not. The untracked half matters:
// a migration generated this session is untracked, and a gate blind to it would
// pass the pull request that introduces the very file it exists to check.
function repoFiles(root) {
  return [
    ...lines(git(root, ["ls-files", "-z"])),
    ...lines(git(root, ["ls-files", "--others", "--exclude-standard", "-z"])),
  ];
}

function changedFiles(root, base) {
  return [
    ...lines(git(root, ["diff", "--name-only", "-z", base, "--"])),
    ...lines(git(root, ["ls-files", "--others", "--exclude-standard", "-z"])),
  ];
}

// What this change is measured against, in three steps.
//
// `--base` wins. Then `GITHUB_BASE_REF`, which is **the pull request's own base
// branch** — and that is not a nicety, because `docs/policy/build.md` sets
// `stacked-prs` to yes. On a stack, PR N+1 sits on PR N's branch, so measuring
// against the default branch would pull PR N's contract migration into PR N+1's
// diff and refuse the correct expand/contract split for being exactly what it
// is. Only failing that, the default branch as the remote has it — resolved
// rather than named, so a clone whose default branch is not `main` is not a
// special case.
//
// A missing merge base is a hard failure and never a pass: a shallow checkout
// compared nothing, which is not the same answer as "nothing changed".
function baseCommit(root, base) {
  let ref = base;
  if (!ref && process.env.GITHUB_BASE_REF) {
    ref = `origin/${process.env.GITHUB_BASE_REF}`;
  }
  if (!ref) {
    const head = git(root, ["symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"], {
      optional: true,
    });
    if (!head) {
      throw new GateError(
        "no `refs/remotes/origin/HEAD` to read the default branch from; pass --base <ref>",
      );
    }
    ref = head.trim().replace(/^refs\/remotes\//, "");
  }
  const merged = git(root, ["merge-base", ref, "HEAD"], { optional: true });
  if (!merged) {
    throw new GateError(
      `no merge base between ${ref} and HEAD — a shallow clone compares nothing, ` +
        "so set `fetch-depth: 0` on the checkout, or pass --base <ref> if that is not the branch " +
        "this change should be measured against",
    );
  }
  // The ref travels with the commit so that every line this gate prints names the
  // frame it judged against. A gate whose base is invisible is a gate nobody can
  // second-guess -- and its base can come from a flag, the environment, or the
  // remote, which is three places to be wrong.
  return { ref, commit: merged.trim() };
}

function parseJournal(text, where) {
  let journal;
  try {
    journal = JSON.parse(text);
  } catch (error) {
    throw new GateError(`${where} is not JSON: ${error.message}`);
  }
  if (!journal || !Array.isArray(journal.entries)) {
    throw new GateError(`${where} carries no \`entries\` array`);
  }
  for (const entry of journal.entries) {
    if (!entry || typeof entry.tag !== "string") {
      throw new GateError(`${where} has an entry with no \`tag\``);
    }
  }
  return journal.entries;
}

// Comments and quoted text are the prose case this whole rule set is written
// around: a migration whose comment names `DROP COLUMN`, and a seed whose values
// contain the phrase, are both text rather than acts. Each one collapses to a
// space so the tokens either side cannot fuse into something new.
function stripQuotedAndCommented(sql) {
  let result = "";
  let i = 0;
  while (i < sql.length) {
    const two = sql.slice(i, i + 2);
    if (two === "--") {
      while (i < sql.length && sql[i] !== "\n") i += 1;
      result += " ";
      continue;
    }
    if (two === "/*") {
      let depth = 1; // Postgres block comments nest
      i += 2;
      while (i < sql.length && depth > 0) {
        if (sql.slice(i, i + 2) === "/*") {
          depth += 1;
          i += 2;
        } else if (sql.slice(i, i + 2) === "*/") {
          depth -= 1;
          i += 2;
        } else {
          i += 1;
        }
      }
      result += " ";
      continue;
    }
    if (sql[i] === "'" || sql[i] === '"') {
      const quote = sql[i];
      // Postgres ships `standard_conforming_strings = on`, so a backslash is an
      // ordinary character inside `'...'` and `''` is the only escape — except in
      // an `E'...'` string, where `\'` does escape. Reading a plain string as if
      // backslashes escaped (or an E-string as if they did not) leaves the quote
      // count odd, and the scan then swallows the rest of the file: every rule
      // downstream of it goes blind, which is a gate failing open in silence.
      const before = sql[i - 1];
      const beforeThat = sql[i - 2];
      const escapes =
        (before === "E" || before === "e") && (i < 2 || !/[A-Za-z0-9_]/.test(beforeThat ?? ""));
      i += 1;
      while (i < sql.length) {
        if (escapes && sql[i] === "\\") {
          i += 2;
          continue;
        }
        if (sql[i] === quote && sql[i + 1] === quote) {
          i += 2;
          continue;
        }
        if (sql[i] === quote) {
          i += 1;
          break;
        }
        i += 1;
      }
      // A quoted identifier leaves a token behind, so `ALTER COLUMN "x" TYPE`
      // still reads as the three words the pattern is looking for.
      result += quote === '"' ? " ident " : " literal ";
      continue;
    }
    if (sql[i] === "$") {
      const opener = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
      if (opener) {
        const tag = opener[0];
        const end = sql.indexOf(tag, i + tag.length);
        i = end === -1 ? sql.length : end + tag.length;
        result += " literal ";
        continue;
      }
    }
    result += sql[i];
    i += 1;
  }
  return result;
}

function statements(sql) {
  return stripQuotedAndCommented(sql)
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim().toUpperCase())
    .filter(Boolean);
}

// One `ALTER TABLE` carries as many comma-separated actions as you like, so the
// statement is not the unit rule 3 cares about: `ADD COLUMN a, DROP COLUMN b` is
// precisely the mixture it exists to refuse, wearing a single semicolon.
//
// Only `ALTER TABLE` is split. `DROP TABLE a, b` is one action over a list, and
// splitting it would leave `b` looking additive and refuse a migration that is
// wholly destructive — a false refusal, which NFR30's second half rules out as
// firmly as a miss.
function actions(statement) {
  if (!/^ALTER\s+TABLE\b/.test(statement)) return [statement];
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < statement.length; i += 1) {
    const character = statement[i];
    if (character === "(") depth += 1;
    else if (character === ")") depth -= 1;
    else if (character === "," && depth === 0) {
      parts.push(statement.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(statement.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

const destructiveIn = (statement) => DESTRUCTIVE.find(([pattern]) => pattern.test(statement))?.[1];

// `@repo/domain` is found by manifest name rather than by a path, because the
// package does not exist yet and a hardcoded `packages/domain` would be a rule
// that goes stale without ever saying so.
function domainSource(root, files) {
  for (const file of files) {
    if (!file.endsWith("package.json")) continue;
    let name;
    try {
      name = JSON.parse(readFileSync(join(root, file), "utf8")).name;
    } catch {
      continue;
    }
    if (name !== DOMAIN_PACKAGE) continue;
    const dir = dirname(file);
    // `dirname("package.json")` is ".", and "./src/" would match no path git
    // ever prints -- a silent no-op where an answer belongs.
    return dir === "." ? "src/" : `${dir}/src/`;
  }
  return null;
}

// Defined by exclusion, so a module nobody has classified yet counts as one.
// The first path segment names the module, which is how the spec's export table
// reads it too: `./offers` is `src/offers.ts` or `src/offers/`.
function isQueryModule(relative) {
  if (!/\.tsx?$/.test(relative) || /\.test\.tsx?$/.test(relative)) return false;
  const [head = ""] = relative.split("/");
  return !NOT_A_QUERY_MODULE.has(head.replace(/\.tsx?$/, ""));
}

function checkJournal(refuse, journalPath, baseEntries, headEntries) {
  for (const [index, before] of baseEntries.entries()) {
    const after = headEntries[index];
    if (!after) {
      refuse(
        "the journal is append-only",
        `${journalPath}: entry ${index} (\`${before.tag}\`) is committed but no longer present`,
        "Two branches adding migrations always collide here; a merge resolved the wrong way is how an entry goes missing. Restore it and append yours after it.",
      );
      continue;
    }
    for (const key of ["idx", "tag", "when", "version"]) {
      if (JSON.stringify(after[key]) === JSON.stringify(before[key])) continue;
      refuse(
        "the journal is append-only",
        `${journalPath}: entry ${index} changed \`${key}\` from ${JSON.stringify(before[key])} to ${JSON.stringify(after[key])}`,
        "A committed entry is a record of what production has already applied. New migrations are appended after it, never over it.",
      );
    }
  }
}

function checkImmutable(root, base, refuse, dir, baseEntries) {
  for (const entry of baseEntries) {
    const path = `${dir}/${entry.tag}.sql`;
    const shipped = git(root, ["show", `${base}:${path}`], { optional: true });
    if (shipped === null) continue; // journalled at the base, but never had a file there
    let current;
    try {
      current = readFileSync(join(root, path), "utf8");
    } catch {
      refuse(
        "a shipped migration is immutable",
        `${path} is on the default branch but missing from this branch`,
        "Drizzle will not re-run it, so production keeps the old schema while PGlite replays whatever is here. Restore the file and write a new migration instead.",
      );
      continue;
    }
    if (current === shipped) continue;
    const blob = git(root, ["rev-parse", "--short", `${base}:${path}`], { optional: true });
    refuse(
      "a shipped migration is immutable",
      `${path} differs from the ${blob ? blob.trim() : "committed"} content it shipped with`,
      "Production will not re-run it; PGlite replays it from scratch on every test run, so seam 2 would start testing a schema production does not have — and go green. Write a new migration.",
    );
  }
}

// Scoped to the tags this branch adds, exactly as immutability is. Checking
// every entry instead would deadlock the repository the first time a mixed or
// unmarked migration reached the default branch: rule 3 would refuse every
// subsequent pull request, and rule 2 forbids editing the file that would fix
// it. NFR30's second half rules that out — "a guardrail that cannot be satisfied
// becomes a reason to edit production by hand, which is strictly worse than the
// drift it was built to stop". Nothing is lost by scoping: a migration is
// checked at the pull request that introduces it, and is immutable thereafter.
function checkDestructive(root, refuse, dir, headEntries, added, missing) {
  for (const entry of headEntries) {
    if (!added.has(entry.tag)) continue;
    const path = `${dir}/${entry.tag}.sql`;
    let sql;
    try {
      sql = readFileSync(join(root, path), "utf8");
    } catch {
      // Collected rather than thrown, because a definite refusal outranks "I
      // could not tell": a journal that renamed a committed tag has no file
      // under the new name either, and reporting that as a gate failure would
      // bury the append-only violation that caused it.
      missing.push(path);
      continue;
    }
    const parsed = statements(sql)
      .flatMap(actions)
      .map((statement) => ({ statement, destructive: destructiveIn(statement) }));
    const destructive = parsed.filter((s) => s.destructive);
    if (destructive.length === 0) continue;

    const additive = parsed.filter((s) => !s.destructive);
    if (additive.length > 0) {
      refuse(
        "a destructive statement travels alone",
        `${path} mixes ${destructive[0].destructive} with ${count(additive.length, "other statement", "other statements")}`,
        `Rolling the additive half back would mean reversing the drop, and the drop has already destroyed the data. Split it: the additive statements in one migration, the destructive ones in another named for what they are.`,
      );
    }
    if (!MARKER.test(entry.tag)) {
      refuse(
        "a destructive migration carries the marker",
        `${path} contains ${destructive[0].destructive} but its name does not say so`,
        "Regenerate it with a name carrying `contract` — `drizzle-kit generate --name contract_<what_it_drops>`. The marker is an opt-in, not a prohibition: it is what lets rule 4 keep the drop out of the deploy that changes the code.",
      );
    }
  }
}

function checkContractShipsSeparately(root, files, refuse, changed, addedTags) {
  const marked = addedTags.filter((tag) => MARKER.test(tag));
  if (marked.length === 0) return;
  const source = domainSource(root, files);
  if (!source) return; // no `@repo/domain` in this repository yet
  const offenders = changed
    .filter((file) => file.startsWith(source))
    .filter((file) => isQueryModule(file.slice(source.length)));
  if (offenders.length === 0) return;
  refuse(
    "contract and code ship separately",
    `${marked.join(", ")} shares this pull request with ${offenders.join(", ")}`,
    `Rolling the code back would leave a schema the old build does not understand, which is where NFR25's five minutes stops being true. Ship the code that stops using the column, deploy, then drop it. Everything under ${source} counts except tests, \`schema\`, \`migrate\`, \`policy\` and \`projections\`.`,
  );
}

function main() {
  const { root, base: baseRef } = parseArgs(process.argv.slice(2));

  // Discovery first, and through git rather than a hardcoded `drizzle/`: the
  // path is not settled until `@repo/domain` lands, and this also lets a
  // repository with no migrations answer without needing any history at all —
  // which is what keeps a shallow CI checkout honest today.
  const files = repoFiles(root);
  const journalPaths = files.filter((file) => file.endsWith(JOURNAL_SUFFIX)).toSorted();
  if (journalPaths.length === 0) {
    out("Migration integrity passed: no migrations in this repository yet.");
    return;
  }

  const { ref, commit: base } = baseCommit(root, baseRef);
  const changed = changedFiles(root, base);
  const refusals = [];
  const refuse = (rule, detail, remedy) => refusals.push({ rule, detail, remedy });

  let migrations = 0;
  const addedTags = [];
  const missing = [];

  for (const journalPath of journalPaths) {
    const dir = dirname(dirname(journalPath));
    const headEntries = parseJournal(readFileSync(join(root, journalPath), "utf8"), journalPath);
    const shipped = git(root, ["show", `${base}:${journalPath}`], { optional: true });
    const baseEntries = shipped === null ? [] : parseJournal(shipped, `${journalPath} at ${base}`);

    migrations += headEntries.length;
    const baseTags = new Set(baseEntries.map((entry) => entry.tag));
    const added = new Set(
      headEntries.map((entry) => entry.tag).filter((tag) => !baseTags.has(tag)),
    );
    addedTags.push(...added);

    checkJournal(refuse, journalPath, baseEntries, headEntries);
    checkImmutable(root, base, refuse, dir, baseEntries);
    checkDestructive(root, refuse, dir, headEntries, added, missing);
  }

  checkContractShipsSeparately(root, files, refuse, changed, addedTags);

  for (const { rule, detail, remedy } of refusals) {
    out(`REFUSED  ${rule}`);
    out(`         ${detail}`);
    out(`         ${remedy}`);
  }

  if (refusals.length > 0) {
    for (const path of missing) out(`         (${path} is named by the journal and is not there)`);
    out();
    out(
      `Migration integrity failed: ${count(refusals.length, "refusal", "refusals")}, ` +
        `measured against ${ref} (${base.slice(0, 7)}).`,
    );
    process.exit(1);
  }
  if (missing.length > 0) {
    throw new GateError(`${missing[0]} is named by the journal but is not there`);
  }
  out(
    `Migration integrity passed: ${count(migrations, "migration", "migrations")} across ` +
      `${count(journalPaths.length, "journal", "journals")}, ${addedTags.length} added since ` +
      `${ref} (${base.slice(0, 7)}).`,
  );
}

try {
  main();
} catch (error) {
  out(`Migration integrity could not run: ${error.message}`);
  process.exit(2);
}
