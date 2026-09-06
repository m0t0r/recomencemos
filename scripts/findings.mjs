#!/usr/bin/env node
// How a machine files a finding: the `needs-triage` issue that
// `docs/adr/0001-findings-enter-through-triage.md` fixes as the only door into
// Plan, opened from CI rather than from a person.
//
// Two callers, two subcommands, one lifecycle:
//
//   findings.mjs breach          a control-band breach, from needs-triage.yml
//   findings.mjs audit [...]     the daily dependency audit, from security-audit.yml
//
// Both used to live as `run:` blocks inside their workflows -- ~160 lines of
// bash between them, duplicating the label step, and exercised only by hand
// with a stubbed `gh` because CI neither lints nor runs a workflow it is not
// triggered by. A workflow is wiring; the decision about what to file, edit,
// close or leave alone is repo logic, and repo logic here lives in `scripts/`
// with a file under `.claude/hooks/tests/` driving it. That is the whole
// reason this file exists (`docs/adr/0020-…`).
//
// **Node's standard library only.** `needs-triage.yml` runs this with no
// `pnpm install`, the way `ui-proof-expire.yml` runs the expiry, so an import
// from `node_modules` here would fail on the runner and not on a laptop.
//
// **`audit` runs the report itself**, passing `--root` and `--input` through to
// `audit-report.mjs`, so the suite drives the real report against the audit
// fixtures and stubs only `gh`. The three exit codes that script documents are
// read here as three answers: 0 nothing to report, 1 a finding on stdout, and
// anything else a report that could not run -- refused rather than routed,
// where it would surface as a confusing complaint about a missing fingerprint.
//
// Exit codes, the same contract as the gates beside it: 0 the finding was
// routed (or there was nothing to route), 2 this could not reach an answer.
// There is no 1: a finding is an answer, not a failure.

import { execFileSync, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const out = (s) => process.stdout.write(`${s}\n`);
const err = (s) => process.stderr.write(`${s}\n`);

/** Anything that stops this reaching an answer, as against an answer. */
class FindingError extends Error {}

const REPORT = join(dirname(fileURLToPath(import.meta.url)), "audit-report.mjs");

// Definitions: docs/agents/triage-labels.md. Created if absent, because
// `gh issue create --label` fails hard on a label the repository does not
// have, and losing a real finding to a missing label would be the worst
// available reason not to hear about one.
const NEEDS_TRIAGE = {
  name: "needs-triage",
  color: "fbca04",
  description: "Maintainer needs to evaluate this issue",
};
const SECURITY_AUDIT = {
  name: "security-audit",
  color: "d93f0b",
  description: "Opened by the scheduled dependency audit",
};

// **The marker, not the label, is the handle.** A label is something a person
// can put on any issue, and `audit` edits and closes what it finds -- so keying
// on the label alone would let a mislabelled issue get its body overwritten or
// closed. Requiring the marker means it only ever touches an issue it wrote.
const MARKER = "<!-- audit-fingerprint: ";
const fingerprintIn = (text) => text?.match(/audit-fingerprint: ([0-9a-f]+)/)?.[1];

/** `gh`, with stdin where a body travels, and a refusal naming the call on failure. */
function gh(args, stdin) {
  try {
    return execFileSync("gh", args, {
      encoding: "utf8",
      input: stdin,
      stdio: ["pipe", "pipe", "inherit"],
    });
  } catch (error) {
    throw new FindingError(`gh ${args.slice(0, 2).join(" ")} failed (exit ${error.status ?? "?"})`);
  }
}

/** Idempotent, and quiet about it: a parallel run may have just created it. */
function ensureLabel(repo, { name, color, description }) {
  spawnSync(
    "gh",
    ["label", "create", name, "--repo", repo, "--color", color, "--description", description],
    { stdio: "ignore" },
  );
}

function repoFromEnv() {
  const repo = process.env.REPO || process.env.GITHUB_REPOSITORY;
  if (!repo) throw new FindingError("REPO (or GITHUB_REPOSITORY) names the repository to file in");
  return repo;
}

// --- breach -------------------------------------------------------------------

// The four fields a finding is not a finding without
// (observability-go-live.md §6). A breach that reaches a person without its
// observed value or its surface costs a triage session to work out what it
// was even about. They arrive through the environment, never interpolated
// into a command: a `client_payload` is written by whatever holds the dispatch
// token.
const BREACH_FIELDS = ["BAND", "OBSERVED", "SURFACE", "FIRST_CHECK"];

function breach() {
  const repo = repoFromEnv();
  const missing = BREACH_FIELDS.filter((f) => !process.env[f]);
  if (missing.length > 0) {
    // On stdout, not stderr: GitHub parses workflow commands from a step's
    // stdout only, so `::error::` on stderr renders as plain text and never
    // becomes an annotation -- the one place a person looking at a failed run
    // would actually see it.
    out(
      `::error::incomplete breach payload, missing: ${missing.map((f) => f.toLowerCase()).join(" ")}`,
    );
    // The citation stays in the comment above: the go-live runbook is where the
    // four fields are defined, and the string says the substance.
    throw new FindingError(
      "a finding needs its band, its observed value, its surface and a first thing to check",
    );
  }
  const { BAND, OBSERVED, SURFACE, FIRST_CHECK } = process.env;
  const event = process.env.GITHUB_EVENT_NAME ?? "unknown";
  const body =
    `## Band\n\n${BAND}\n\n` +
    `## Observed\n\n${OBSERVED}\n\n` +
    `## Affected surface\n\n\`${SURFACE}\`\n\n` +
    `## First thing to check\n\n${FIRST_CHECK}\n\n` +
    `---\n\nOpened by \`.github/workflows/needs-triage.yml\` from a \`${event}\` event.\n`;

  ensureLabel(repo, NEEDS_TRIAGE);
  // `--label needs-triage` and nothing else. /triage assigns the rest; guessing
  // a role here would skip the human call ADR-0001 exists to preserve.
  const url = gh(
    [
      "issue",
      "create",
      "--repo",
      repo,
      "--label",
      "needs-triage",
      "--title",
      `Control-band breach: ${BAND}`,
      "--body-file",
      "-",
    ],
    body,
  );
  out(`filed ${url.trim()}`);
}

// --- audit --------------------------------------------------------------------

function audit(reportArgs) {
  const repo = repoFromEnv();
  const runUrl = process.env.RUN_URL;
  const runLink = runUrl ? ` [Run](${runUrl})` : "";

  const report = spawnSync(process.execPath, [REPORT, ...reportArgs], { encoding: "utf8" });
  // The report's stderr reaches the job log on every path, as it did when the
  // workflow ran the report itself; only its stdout is the finding.
  if (report.stderr) process.stderr.write(report.stderr);
  if (report.status !== 0 && report.status !== 1) {
    throw new FindingError(
      `the dependency report could not run (exit ${report.status ?? report.signal})\n${report.stdout ?? ""}`.trim(),
    );
  }

  ensureLabel(repo, NEEDS_TRIAGE);
  ensureLabel(repo, SECURITY_AUDIT);

  // Everything this has ever filed, open and closed. Closed ones matter: see
  // the dismissal branch at the bottom.
  const history = JSON.parse(
    gh([
      "issue",
      "list",
      "--repo",
      repo,
      "--label",
      "security-audit",
      "--state",
      "all",
      "--limit",
      "50",
      "--json",
      "number,state,body",
    ]),
  );
  const existing = history.find((i) => i.state === "OPEN" && i.body?.includes(MARKER));

  if (report.status === 0) {
    out(report.stdout.trimEnd());
    if (existing) {
      gh([
        "issue",
        "comment",
        String(existing.number),
        "--repo",
        repo,
        "--body",
        `A later scheduled audit found nothing at or above the reporting threshold. Closing.${runLink}`,
      ]);
      gh(["issue", "close", String(existing.number), "--repo", repo]);
      out(`closed #${existing.number}: the tree is clean`);
    } else {
      out("clean, and no open finding to close");
    }
    return;
  }

  // The fingerprint is over what identifies the advisories, not what describes
  // them, so an upstream re-wording does not read as a new finding.
  const fingerprint = fingerprintIn(report.stdout);
  if (!fingerprint)
    throw new FindingError("the report carried no fingerprint, so it cannot be deduplicated");

  if (existing) {
    // Same set as the open issue already carries -> say nothing. A daily
    // comment on an unchanged finding is how a feed gets muted.
    if (fingerprintIn(existing.body) === fingerprint) {
      out(`#${existing.number} already describes this exact set; nothing to do`);
      return;
    }
    // Edited in place rather than superseded, so the issue keeps one URL and
    // whatever discussion is already on it.
    gh(
      ["issue", "edit", String(existing.number), "--repo", repo, "--body-file", "-"],
      report.stdout,
    );
    gh([
      "issue",
      "comment",
      String(existing.number),
      "--repo",
      repo,
      "--body",
      `The set of advisories changed; the description above has been updated.${runLink}`,
    ]);
    out(`updated #${existing.number}`);
    return;
  }

  // **A dismissal has to be durable, or this becomes a daily re-file.** Closing
  // the issue is the only way a person can say "we have looked at these and
  // they do not warrant a patch" -- without this branch the next run would see
  // no open issue and file a fresh one every day, each with a new number and
  // none of the reasoning. The suppression is per fingerprint, so it is narrow
  // on purpose: a new advisory, or a severity that moved, changes the hash and
  // opens a fresh issue rather than hiding behind the old dismissal.
  const dismissed = history.find(
    (i) => i.state === "CLOSED" && i.body?.includes(MARKER + fingerprint),
  );
  if (dismissed) {
    out(`#${dismissed.number} carries this exact set and was closed; treating it as dismissed`);
    return;
  }

  const url = gh(
    [
      "issue",
      "create",
      "--repo",
      repo,
      "--label",
      "needs-triage",
      "--label",
      "security-audit",
      "--title",
      "Dependency advisories found by the scheduled audit",
      "--body-file",
      "-",
    ],
    report.stdout,
  );
  out(`filed ${url.trim()}`);
}

// --- entry --------------------------------------------------------------------

function main(argv) {
  const [command, ...rest] = argv;
  if (command === "breach" && rest.length === 0) return breach();
  if (command === "audit") return audit(rest);
  throw new FindingError(
    "usage: findings.mjs breach | findings.mjs audit [--root <dir>] [--input <file>]",
  );
}

try {
  main(process.argv.slice(2));
} catch (error) {
  err(`findings: ${error instanceof FindingError ? error.message : (error.stack ?? error)}`);
  process.exit(2);
}
