#!/usr/bin/env node
// The dependency audit named in `docs/policy/build.md` -> `required-checks` and
// `docs/policy/security.md` -> `dependency-policy`: fail on `high` or above in a
// **direct** dependency, and never on a transitive one.
//
// `pnpm audit --audit-level=high` cannot be that gate. A repository carrying one
// `high` advisory reachable only through a transitive path — this one carried
// exactly that against `nanoid`, through `postcss` under `next`, `vitest` and
// `@sentry/nextjs`, seventeen paths and not one of them direct — would have that
// gate red from the day it was added. A gate red on day one is bypassed within a
// week, which is exactly the reasoning C7 records for direct-only.
//
// **This gate is deliberately half of the answer, and the other half is
// `audit-report.mjs`.** Letting a transitive advisory past is the correct
// blocking decision and a poor stopping point: six of them sat on the default
// branch — four `high` — while every pull request went green, because nothing
// was watching the half this gate prints and ignores. The scheduled reporter
// watches it. Do not close that gap by lowering the bar here; a blocking gate
// and a reporting one answer different questions, and only one of them may stop
// a person's work.
//
// **Three exit codes, because two of them are different answers.** `0` is a pass,
// `1` is a blocking advisory, and `2` is the gate failing to run at all — an
// unreadable workspace file, an audit payload that is not an audit. The third
// exists so that a broken gate cannot be mistaken for a clean one, in CI or in
// the cases `gate-test.sh` drives.
//
// What it reads and how it reads it lives in `audit-lib.mjs`, shared with the
// reporter so the two cannot disagree about which dependency is direct.

import { auditReport, countAdvisories, directDependencies, out, parseArgs } from "./audit-lib.mjs";

const BLOCKING = new Set(["high", "critical"]);

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
