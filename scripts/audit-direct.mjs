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
// Output goes through `process.stdout.write` rather than `console.log`, for the
// reason `CLAUDE.md` gives: the console is not an output channel here, and the
// logger this repo does use writes through the process stream too. There is no
// logger on this path — it runs before, and outside, the application.

import { execFileSync } from "node:child_process";
import { globSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BLOCKING = new Set(["high", "critical"]);
const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];

const out = (line = "") => process.stdout.write(`${line}\n`);
const countAdvisories = (n) => `${n} ${n === 1 ? "advisory" : "advisories"}`;

function parseArgs(argv) {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const options = { root: repoRoot, input: null };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--root" || flag === "--input") {
      if (value === undefined) throw new Error(`${flag} needs a value`);
      options[flag.slice(2)] = resolve(value);
      i += 1;
    } else {
      throw new Error(`unknown argument: ${flag}`);
    }
  }
  return options;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

// The workspace globs come from `pnpm-workspace.yaml` rather than from a copy of
// them, so adding a workspace cannot silently narrow what this gate considers
// direct. Only the `packages:` list is read, which is a flat list of strings.
function workspaceGlobs(root) {
  let yaml;
  try {
    yaml = readFileSync(join(root, "pnpm-workspace.yaml"), "utf8");
  } catch {
    return [];
  }
  const block = yaml.match(/^packages:\n((?:[ \t]+-[ \t]*.+\n?)+)/m);
  if (!block) return [];
  return [...block[1].matchAll(/^[ \t]+-[ \t]*["']?([^"'\n]+?)["']?[ \t]*$/gm)].map((m) => m[1]);
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
// is not the answer to our question and the payload is read instead. A failure to
// produce JSON is a different matter: an unreachable registry must not read as a
// clean audit.
function auditReport(root, input) {
  if (input) return readJson(input);
  let stdout;
  try {
    stdout = execFileSync("pnpm", ["audit", "--json"], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    stdout = error.stdout;
    if (!stdout) throw error;
  }
  return JSON.parse(stdout);
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

main();
