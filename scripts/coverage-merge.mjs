#!/usr/bin/env node
// Six workspaces produce six coverage reports; a pull request wants one number.
//
// `davelosert/vitest-coverage-report-action` keys its sticky comment on the
// report's name, so calling it once per workspace would leave six comments on
// every pull request rather than one. This is the alternative: fold the six
// pairs into one repo-root pair before the action runs, so the comment shows the
// repository and its per-file rows show whichever workspace a changed file lives
// in, without the reader having to know there were six runs.
//
// **The merge is a union, not an arithmetic reconciliation**, and that is a
// property of the format rather than a shortcut. Istanbul's `coverage-final.json`
// is keyed by absolute file path and `coverage-summary.json` is the same keys
// plus a `total`; each workspace's `coverage.include` is scoped to its own
// directory, so no file is measured twice and the union loses nothing. The one
// thing that has to be computed is `total`, because six totals cannot be
// averaged into one — they are summed, per metric, and the percentage is taken
// from the sums.
//
// **It fails closed on every axis**, which is the rule the three gates beside it
// follow and the reason this exits `2` rather than `0`: a partial merge would
// report a total that looks like the repository and is not. A workspace that
// declares `test:coverage` and left no report, a workspace list read as empty,
// and the same file claimed by two workspaces all refuse rather than proceed. It
// is not a gate — nothing here decides whether work may proceed — but it is repo
// logic living in `scripts/`, so `gate-test.sh` drives it for the reason
// `first-load-bytes.mjs` and `dev-origin.mjs` are driven there.
//
//   node scripts/coverage-merge.mjs [--root <dir>]

import { globSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { out, workspaceGlobs } from "./audit-lib.mjs";

// The two files the reporting action reads, and the only two written here. The
// `text` and `html` reporters are for a person at a terminal and are not merged:
// re-rendering them would mean re-implementing istanbul's renderers to say
// something the merged JSON already says.
const SUMMARY = "coverage-summary.json";
const FINAL = "coverage-final.json";

// Anything that stops the merge reaching an answer, as against an answer of
// "nothing was covered". Same shape and same reason as `audit-lib.mjs`'s.
class MergeError extends Error {}

const repoRoot = () => resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Only `--root`, because that is the only thing a test fixture has to move. An
// unknown flag refuses rather than being ignored, so a typo cannot produce a
// green run that merged a directory nobody meant.
function parseArgs(argv) {
  const options = { root: repoRoot() };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] !== "--root") throw new MergeError(`unknown argument: ${argv[i]}`);
    const value = argv[i + 1];
    if (value === undefined) throw new MergeError("--root needs a value");
    options.root = resolve(value);
    i += 1;
  }
  return options;
}

function readJson(path) {
  let source;
  try {
    source = readFileSync(path, "utf8");
  } catch {
    throw new MergeError(`${path}: not found — did \`turbo run test:coverage\` run?`);
  }
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new MergeError(`${path}: not valid JSON (${error.message})`);
  }
}

// A workspace is measured if its manifest declares `test:coverage`. That is read
// off the manifests rather than kept as a list here for the reason
// `directDependencies` reads them: a seventh workspace must not be able to go
// unmeasured because a list in this file was not updated with it.
export function measuredWorkspaces(root) {
  const directories = [];
  for (const glob of workspaceGlobs(root)) {
    for (const manifest of globSync(join(glob, "package.json"), { cwd: root })) {
      let pkg;
      try {
        pkg = JSON.parse(readFileSync(join(root, manifest), "utf8"));
      } catch {
        continue;
      }
      if (pkg.scripts?.["test:coverage"]) directories.push(dirname(manifest));
    }
  }
  if (directories.length === 0) {
    throw new MergeError("no workspace declares a `test:coverage` script");
  }
  return directories.toSorted();
}

// `covered / total`, with istanbul's own answer for the empty case: a file with
// nothing to cover is 100% covered, not 0% and not NaN.
const percent = (covered, total) =>
  total === 0 ? 100 : Number(((covered / total) * 100).toFixed(2));

// The metric names are taken from the entries rather than written here, so a
// provider that emits one this repository has not seen — istanbul's
// `branchesTrue` is the live example — is summed rather than silently dropped
// from the total.
export function totalOf(entries) {
  const total = {};
  for (const entry of entries) {
    for (const [metric, counts] of Object.entries(entry)) {
      const running = (total[metric] ??= { total: 0, covered: 0, skipped: 0, pct: 0 });
      running.total += counts.total ?? 0;
      running.covered += counts.covered ?? 0;
      running.skipped += counts.skipped ?? 0;
    }
  }
  for (const counts of Object.values(total)) {
    counts.pct = percent(counts.covered, counts.total);
  }
  return total;
}

// The union, with the collision refused rather than resolved. Two workspaces
// claiming one file means their `coverage.include` globs overlap, and there is
// no correct answer available here: taking either entry understates the file and
// summing them double-counts every line. Naming both workspaces and the file is
// the useful thing to do instead.
function union(sources, { root }) {
  const merged = {};
  const seen = new Map();
  for (const [workspace, entries] of sources) {
    for (const [path, entry] of Object.entries(entries)) {
      const previous = seen.get(path);
      if (previous !== undefined) {
        throw new MergeError(
          `${path.replace(`${root}/`, "")} is measured by both ${previous} and ${workspace} — ` +
            "their `coverage.include` globs overlap",
        );
      }
      seen.set(path, workspace);
      merged[path] = entry;
    }
  }
  return merged;
}

export function merge(root) {
  const workspaces = measuredWorkspaces(root);
  const summaries = [];
  const finals = [];

  for (const workspace of workspaces) {
    const directory = join(root, workspace, "coverage");
    const { total: _discarded, ...files } = readJson(join(directory, SUMMARY));
    summaries.push([workspace, files]);
    finals.push([workspace, readJson(join(directory, FINAL))]);
  }

  const files = union(summaries, { root });
  return {
    workspaces,
    summary: { total: totalOf(Object.values(files)), ...files },
    final: union(finals, { root }),
  };
}

function main() {
  const { root } = parseArgs(process.argv.slice(2));
  const { workspaces, summary, final } = merge(root);

  // Written compact, the way every coverage reporter writes them: the only
  // readers are the reporting action and a `gate-test.sh` grep, and indenting a
  // few hundred files' worth of counters costs an uploaded artifact real bytes
  // for a file nobody opens by hand.
  const directory = join(root, "coverage");
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, SUMMARY), `${JSON.stringify(summary)}\n`);
  writeFileSync(join(directory, FINAL), `${JSON.stringify(final)}\n`);

  const files = Object.keys(summary).length - 1;
  out(`Merged ${workspaces.length} workspaces, ${files} files, into coverage/`);
  for (const [metric, counts] of Object.entries(summary.total)) {
    out(
      `  ${metric.padEnd(12)} ${String(counts.pct).padStart(6)}%  ${counts.covered}/${counts.total}`,
    );
  }
}

// Only when run, so `gate-test.sh` can import the pieces above without the
// script writing anything.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`coverage-merge: ${error.message}\n`);
    process.exit(2);
  }
}
