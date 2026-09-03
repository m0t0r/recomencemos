// What `audit-direct.mjs` and `audit-report.mjs` both need: read the workspace
// manifests to learn which package names this repository declares, and read a
// `pnpm audit` payload without mistaking a broken run for a clean one.
//
// It exists for the reason `.claude/hooks/gate-lib.sh` exists. Two gates asking
// the same question of the same files must not answer it two ways, and the way
// that divergence shows up is the worst one available: the reporter calls a
// dependency transitive, the blocking gate calls it direct, and whichever a
// person reads first is the one they believe.
//
// It is scoped to the two gates that read *these* files, deliberately.
// `spec-identifiers.mjs` and `migration-integrity.mjs` each carry their own
// `GateError` and argument parser, and folding those in would be a refactor of
// 129 further cases for a dozen shared lines — with no correctness argument
// behind it, since neither reads a manifest or an audit payload. The duplication
// worth removing was the duplication that could disagree about an answer.
//
// The split is by audience, not by size. This file knows about manifests and
// audit payloads. It knows nothing about severity thresholds, exit codes, or
// what either caller does with an answer — those are the two gates' own, and
// they differ precisely there: one blocks a pull request on `high` in a direct
// dependency, the other reports everything at `moderate` or above wherever it
// sits.

import { execFileSync } from "node:child_process";
import { globSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// `peerDependencies` is deliberately absent: a peer is declared for a consumer
// to install, so it is not something this repository depends on.
const DEPENDENCY_FIELDS = ["dependencies", "devDependencies", "optionalDependencies"];

// Anything that stops a gate reaching an answer, as against an answer of "no".
// Not exported: both callers catch everything their `main` throws and exit `2`,
// which is the distinction their third exit code is for, and neither needs to
// name the type to do it. Exporting it would advertise a discrimination nothing
// performs.
class GateError extends Error {}

const repoRoot = () => resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Both gates take the same two flags, so they parse them the same way. An
// unknown flag is a `GateError` rather than an ignored argument: a typo in a
// workflow that silently audited the wrong root would be a green run proving
// nothing, which is the failure this whole file is arranged against.
export function parseArgs(argv) {
  const options = { root: repoRoot(), input: null };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag !== "--root" && flag !== "--input") {
      throw new GateError(`unknown argument: ${flag}`);
    }
    const value = argv[i + 1];
    if (value === undefined) throw new GateError(`${flag} needs a value`);
    options[flag.slice(2)] = resolve(value);
    i += 1;
  }
  return options;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

const ITEM = /^\s+-\s*(?:"([^"]*)"|'([^']*)'|([^#\s]+))/;
const item = (line) => {
  const m = line.match(ITEM);
  return m ? (m[1] ?? m[2] ?? m[3]) : null;
};

// The globs come from `pnpm-workspace.yaml` rather than from a copy of them, so
// adding a workspace cannot silently narrow what a gate considers direct.
//
// A file that exists but yields no globs is a **hard failure**, not an empty
// list. That distinction is the whole safety of this function: an unparsed
// `packages:` would leave the root manifest as the only direct one, and a `high`
// in a workspace dependency would then print as transitive and exit 0 — a green
// run proving nothing. Both list styles YAML permits are read, and blank lines
// and comments inside the block do not end it.
export function workspaceGlobs(root) {
  const path = join(root, "pnpm-workspace.yaml");
  let yaml;
  try {
    yaml = readFileSync(path, "utf8");
  } catch {
    return []; // a single-package repository declares no workspaces
  }

  const lines = yaml.split("\n");
  const start = lines.findIndex((line) => line.startsWith("packages:"));
  if (start === -1) throw new GateError(`${path} declares no \`packages:\` key`);

  const globs = [];
  const flow = lines[start].slice("packages:".length).trim();
  if (flow.startsWith("[")) {
    for (const entry of flow.replace(/^\[|]\s*$/g, "").split(",")) {
      const value = item(` - ${entry.trim()}`);
      if (value) globs.push(value);
    }
  } else {
    for (const line of lines.slice(start + 1)) {
      if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
      const value = item(line);
      if (value === null) break; // the next top-level key: the block has ended
      globs.push(value);
    }
  }

  if (globs.length === 0) throw new GateError(`${path}: \`packages:\` read as empty`);
  return globs;
}

// "Direct" means declared by this repository: a name appearing in a dependency
// field of the root manifest or of any workspace `pnpm-workspace.yaml` matches.
// That is read off the manifests rather than parsed out of pnpm's advisory path
// strings, whose format is not a documented interface.
export function directDependencies(root) {
  const manifests = ["package.json"];
  for (const glob of workspaceGlobs(root)) {
    manifests.push(...globSync(join(glob, "package.json"), { cwd: root }));
  }
  const names = new Set();
  for (const manifest of manifests) {
    let pkg;
    try {
      pkg = readJson(join(root, manifest));
    } catch {
      continue;
    }
    for (const field of DEPENDENCY_FIELDS) {
      for (const name of Object.keys(pkg[field] ?? {})) names.add(name);
    }
  }
  return names;
}

// `pnpm audit` exits non-zero whenever it finds anything at all, so its exit code
// is not the answer to our question and the payload is read instead. A payload
// that is not an audit is a different matter: an unreachable registry, or an
// error object where the report should be, must not read as a clean audit.
export function auditReport(root, input) {
  let stdout;
  if (input) {
    stdout = readFileSync(input, "utf8");
  } else {
    try {
      stdout = execFileSync("pnpm", ["audit", "--json"], {
        cwd: root,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      });
    } catch (error) {
      stdout = error.stdout;
      if (!stdout) throw new GateError(`\`pnpm audit\` produced no output: ${error.message}`);
    }
  }

  let report;
  try {
    report = JSON.parse(stdout);
  } catch (error) {
    throw new GateError(`\`pnpm audit\` output is not JSON: ${error.message}`);
  }
  if (!report || typeof report !== "object" || !("advisories" in report || "metadata" in report)) {
    throw new GateError("audit payload carries neither `advisories` nor `metadata`");
  }
  return report;
}

// Output goes through `process.stdout.write` rather than `console.log`, for the
// reason `CLAUDE.md` gives: the console is not an output channel here, and the
// logger this repo does use writes through the process stream too. There is no
// logger on this path — it runs before, and outside, the application.
export const out = (line = "") => process.stdout.write(`${line}\n`);
export const countAdvisories = (n) => `${n} ${n === 1 ? "advisory" : "advisories"}`;
