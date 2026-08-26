#!/usr/bin/env node
// The dependency audit named in `docs/policy/build.md` -> `required-checks` and
// `docs/policy/security.md` -> `dependency-policy`: fail on `high` or above in a
// **direct** dependency, and never on a transitive one.
//
// `pnpm audit --audit-level=high` cannot be that gate. This repo already carries
// a `high` advisory against `nanoid`, reachable only through `postcss` under
// `next`, `vitest` and `@sentry/nextjs` — seventeen paths, not one of them
// direct. A gate red on day one is bypassed within a week, which is exactly the
// reasoning C7 records for direct-only.
//
// "Direct" means declared by this repository: a name appearing in a dependency
// field of the root manifest or of any workspace `pnpm-workspace.yaml` matches.
// That is read off the manifests rather than parsed out of pnpm's advisory path
// strings, whose format is not a documented interface.
//
// **Three exit codes, because two of them are different answers.** `0` is a pass,
// `1` is a blocking advisory, and `2` is the gate failing to run at all — an
// unreadable workspace file, an audit payload that is not an audit. The third
// exists so that a broken gate cannot be mistaken for a clean one, in CI or in
// the cases `gate-test.sh` drives.
//
// Output goes through `process.stdout.write` rather than `console.log`, for the
// reason `CLAUDE.md` gives: the console is not an output channel here, and the
// logger this repo does use writes through the process stream too. There is no
// logger on this path — it runs before, and outside, the application.

import { execFileSync } from "node:child_process";
import { globSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BLOCKING = new Set(["high", "critical"]);
// `peerDependencies` is deliberately absent: a peer is declared for a consumer
// to install, so it is not something this repository depends on.
const DEPENDENCY_FIELDS = ["dependencies", "devDependencies", "optionalDependencies"];

const out = (line = "") => process.stdout.write(`${line}\n`);
const countAdvisories = (n) => `${n} ${n === 1 ? "advisory" : "advisories"}`;

// Anything that stops the gate reaching an answer, as against an answer of "no".
class GateError extends Error {}

function parseArgs(argv) {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const options = { root: repoRoot, input: null };
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
// adding a workspace cannot silently narrow what this gate considers direct.
//
// A file that exists but yields no globs is a **hard failure**, not an empty
// list. That distinction is the whole safety of this function: an unparsed
// `packages:` would leave the root manifest as the only direct one, and a `high`
// in a workspace dependency would then print as transitive and exit 0 — a green
// run proving nothing. Both list styles YAML permits are read, and blank lines
// and comments inside the block do not end it.
function workspaceGlobs(root) {
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

function directDependencies(root) {
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
function auditReport(root, input) {
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

function main() {
  const { root, input } = parseArgs(process.argv.slice(2));
  const direct = directDependencies(root);
  const report = auditReport(root, input);
  const advisories = Object.values(report.advisories ?? {}).filter((a) => BLOCKING.has(a.severity));

  const blocking = advisories.filter((a) => direct.has(a.module_name));
  const transitive = advisories.filter((a) => !direct.has(a.module_name));

  for (const a of blocking) {
    out(`BLOCKING  ${a.severity}  ${a.module_name}@${a.vulnerable_versions}  ${a.title}`);
    out(`          direct dependency; fixed in ${a.patched_versions}  ${a.url}`);
  }
  // Named, never silently dropped: a transitive advisory is still a thing to know
  // about, and a gate that prints nothing about what it let past reads as though
  // it found nothing.
  for (const a of transitive) {
    out(`transitive  ${a.severity}  ${a.module_name}@${a.vulnerable_versions}  ${a.title}`);
    out(`            no direct path; not blocking  ${a.url}`);
  }

  if (blocking.length > 0) {
    out();
    out(
      `Dependency audit failed: ${countAdvisories(blocking.length)} of high or above in a direct dependency.`,
    );
    process.exit(1);
  }
  out(
    `Dependency audit passed: 0 blocking. ${countAdvisories(transitive.length)} of high or above reached no direct dependency.`,
  );
}

try {
  main();
} catch (error) {
  out(`Dependency audit could not run: ${error.message}`);
  process.exit(2);
}
