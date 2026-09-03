#!/usr/bin/env node
// The other half of `audit-direct.mjs`: everything that gate correctly lets
// past, written up as a finding a person can act on.
//
// **Why this exists at all.** The blocking gate refuses `high` or above in a
// direct dependency and never blocks on a transitive one, which is the right
// blocking rule and leaves a hole nothing else covered. Measured rather than
// predicted: six advisories sat on the default branch — four of them `high` —
// while every pull request went green. Nothing was wrong with the gate. There
// was simply no actor for the half it prints and ignores.
//
// **And Dependabot is not that actor here, which is the part worth knowing
// before anyone deletes this.** Security updates are enabled on this repository
// and Dependabot still opened no pull request for any of the six, because
// dependabot-core does not support updating transitive dependencies for the
// pnpm ecosystem (dependabot/dependabot-core#13177). Every one of the six was
// transitive. The fix each needed was a `pnpm-workspace.yaml` override, which
// is a manifest edit no version bump produces.
//
// So the loop this closes is: nobody is told. It reports; it does not fix, and
// it does not block. The three exit codes are the whole interface:
//
//   0  nothing at or above the reporting threshold
//   1  something to report; the issue body is on stdout
//   2  could not reach an answer at all
//
// `2` rather than `0` on a broken run, for the reason its sibling gives: a gate
// that cannot run must never be readable as a gate that found nothing.
//
// The threshold is a policy answer, not a craft one, so it is not chosen here —
// `docs/policy/security.md` -> `audit-report-threshold` holds it, and this
// constant is that key transcribed. Change it there first.

import { createHash } from "node:crypto";

import { auditReport, countAdvisories, directDependencies, out, parseArgs } from "./audit-lib.mjs";

// Ascending, so an index comparison is a severity comparison.
const SEVERITIES = ["info", "low", "moderate", "high", "critical"];
const THRESHOLD = "moderate";

const rank = (severity) => SEVERITIES.indexOf(severity);
const atOrAbove = (severity) => rank(severity) >= rank(THRESHOLD);

// The fingerprint answers one question for the workflow: is this the same set of
// advisories the open issue already describes? It is built from what identifies
// an advisory rather than from what describes it, so re-wording a title upstream
// does not read as a new finding, and a genuinely new advisory always does.
//
// The vulnerable range is in the hash on purpose. An advisory whose range widens
// to cover a version this repository now installs is a different fact about this
// repository, even under the same identifier.
function fingerprint(advisories) {
  const identity = advisories
    .map((a) => `${a.module_name}@${a.vulnerable_versions}:${a.severity}`)
    .toSorted()
    .join("\n");
  return createHash("sha256").update(identity).digest("hex").slice(0, 16);
}

function table(rows) {
  const lines = [
    "| Severity | Package | Vulnerable | Fixed in | Reaches us |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const { advisory, direct } of rows) {
    const where = direct ? "**directly**" : "transitively";
    // `url` comes from the registry, so it is rendered as a link only when it
    // is plainly an https one, and as text otherwise.
    const safe = typeof advisory.url === "string" && advisory.url.startsWith("https://");
    const link = safe ? `[${advisory.module_name}](${advisory.url})` : advisory.module_name;
    lines.push(
      `| \`${advisory.severity}\` | ${link} | \`${advisory.vulnerable_versions}\` |` +
        ` \`${advisory.patched_versions}\` | ${where} |`,
    );
  }
  return lines.join("\n");
}

function body(rows, digest) {
  const blocking = rows.filter((r) => r.direct && rank(r.advisory.severity) >= rank("high"));
  const worst = SEVERITIES[Math.max(...rows.map((r) => rank(r.advisory.severity)))];

  const verdict =
    blocking.length > 0
      ? `**${countAdvisories(blocking.length)} of high or above reached a direct dependency, so \`pnpm audit:direct\` is red and every pull request is already failing.** Fix before anything else merges.`
      : "**None of these blocks a pull request.** The audit gate refuses `high` or above in a *direct* dependency only, so every advisory below reached this repository through a path it deliberately lets past. That is the gate working, not the gate failing — this issue is how somebody hears about it anyway.";

  return `A scheduled \`pnpm audit\` found ${countAdvisories(rows.length)} at ${THRESHOLD} or above. Worst severity: \`${worst}\`.

${verdict}

${table(rows)}

## Why this is not a Dependabot pull request

Dependabot security updates are enabled here, and for a **transitive** dependency in a pnpm workspace it cannot open one: dependabot-core does not support updating transitive dependencies for this ecosystem. A transitive advisory is fixed by adding a scoped entry to \`overrides\` in \`pnpm-workspace.yaml\`, which is a manifest edit no version bump produces. Every entry in that file carries its reasoning beside it; copy that shape.

## What to check before patching

- Which package actually pulls it in — \`pnpm why <package> -r\` — and whether any of those paths is a request path or only a build- or CLI-time one.
- Whether the parent's declared range already admits the fix. If it does, the override is a floor rather than a forced upgrade, and should say so.
- Whether the patched version is older than pnpm's release cooldown. If it is not, it needs a \`minimumReleaseAgeExclude\` entry pinned to the exact version, and that entry is spent the moment the lock stops naming it.

## What happens next, and what is yours

Nothing patches these automatically. Dependabot cannot, for the reason above, and this audit only reports — so the next step is a person's: triage this issue, and if it warrants a patch, open a session against it.

## Housekeeping

This issue is opened, updated and closed by \`.github/workflows/security-audit.yml\`. It closes itself when a later run finds nothing at or above the threshold, and it is edited in place rather than duplicated when the set of advisories changes.

**Closing it by hand is how you dismiss this exact set.** Later runs will stay quiet about these same advisories rather than re-filing them daily. A new advisory, or one whose severity moves, changes the fingerprint below and opens a fresh issue — so a dismissal never hides something new.

<!-- audit-fingerprint: ${digest} -->
`;
}

function main() {
  const { root, input } = parseArgs(process.argv.slice(2));
  const direct = directDependencies(root);
  const report = auditReport(root, input);

  const advisories = Object.values(report.advisories ?? {}).filter((a) => atOrAbove(a.severity));
  if (advisories.length === 0) {
    out(`Dependency report: nothing at ${THRESHOLD} or above.`);
    return;
  }

  const rows = advisories
    .map((advisory) => ({ advisory, direct: direct.has(advisory.module_name) }))
    .toSorted(
      (a, b) =>
        rank(b.advisory.severity) - rank(a.advisory.severity) ||
        a.advisory.module_name.localeCompare(b.advisory.module_name),
    );

  out(body(rows, fingerprint(advisories)));
  process.exit(1);
}

try {
  main();
} catch (error) {
  out(`Dependency report could not run: ${error.message}`);
  process.exit(2);
}
