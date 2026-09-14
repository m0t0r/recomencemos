#!/usr/bin/env node
// How a machine files a finding: the `needs-triage` issue that
// `docs/adr/0001-findings-enter-through-triage.md` fixes as the only door into
// Plan, opened from CI rather than from a person.
//
// Three callers, three subcommands, one lifecycle:
//
//   findings.mjs breach              a control-band breach, from needs-triage.yml
//   findings.mjs audit [...]         the daily dependency audit, from security-audit.yml
//   findings.mjs dependabot [...]    the daily Dependabot watch, from dependabot-watch.yml
//
// The first two used to live as `run:` blocks inside their workflows -- ~160
// lines of bash between them, duplicating the label step, and exercised only by
// hand with a stubbed `gh` because CI neither lints nor runs a workflow it is
// not triggered by. A workflow is wiring; the decision about what to file, edit,
// close or leave alone is repo logic, and repo logic here lives in `scripts/`
// with a file under `.claude/hooks/tests/` driving it. That is the whole reason
// this file exists (`docs/adr/0020-…`).
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
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
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
const DEPENDABOT_WATCH = {
  name: "dependabot-watch",
  color: "0366d6",
  description: "Opened by the scheduled Dependabot watch",
};

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

/** ` [Run](url)` when the workflow passed its own run's address, else nothing. */
function runLinkFromEnv() {
  const runUrl = process.env.RUN_URL;
  return runUrl ? ` [Run](${runUrl})` : "";
}

// --- the lifecycle -------------------------------------------------------------

// **The marker, not the label, is the handle.** A label is something a person
// can put on any issue, and this edits and closes what it finds -- so keying on
// the label alone would let a mislabelled issue get its body overwritten or
// closed. Requiring the marker means it only ever touches an issue it wrote,
// and each subcommand's marker is its own, so the audit never closes the
// watch's issue or the other way round.
const markerFor = (kind) => `<!-- ${kind}-fingerprint: `;
const fingerprintIn = (kind, text) =>
  text?.match(new RegExp(`${kind}-fingerprint: ([0-9a-f]+)`))?.[1];

/**
 * File, edit in place, close when it clears, and honour a closed issue as a
 * dismissal of that exact fingerprint. `fingerprint` undefined means there is
 * nothing to report. Both scheduled subcommands route through here, so the two
 * cannot drift into two different ideas of what a dismissal is.
 */
function route({ repo, kind, label, fingerprint, title, body, cleared, clearedLine, changed }) {
  const marker = markerFor(kind);
  const runLink = runLinkFromEnv();

  ensureLabel(repo, NEEDS_TRIAGE);
  ensureLabel(repo, label);

  // Everything this has ever filed, open and closed. Closed ones matter: see
  // the dismissal branch at the bottom.
  const history = JSON.parse(
    gh([
      "issue",
      "list",
      "--repo",
      repo,
      "--label",
      label.name,
      "--state",
      "all",
      "--limit",
      "50",
      "--json",
      "number,state,body",
    ]),
  );
  const existing = history.find((i) => i.state === "OPEN" && i.body?.includes(marker));

  if (fingerprint === undefined) {
    if (existing) {
      gh([
        "issue",
        "comment",
        String(existing.number),
        "--repo",
        repo,
        "--body",
        `${cleared} Closing.${runLink}`,
      ]);
      gh(["issue", "close", String(existing.number), "--repo", repo]);
      out(`closed #${existing.number}: ${clearedLine}`);
    } else {
      out("clean, and no open finding to close");
    }
    return;
  }

  if (existing) {
    // Same set as the open issue already carries -> say nothing. A daily
    // comment on an unchanged finding is how a feed gets muted.
    if (fingerprintIn(kind, existing.body) === fingerprint) {
      out(`#${existing.number} already describes this exact set; nothing to do`);
      return;
    }
    // Edited in place rather than superseded, so the issue keeps one URL and
    // whatever discussion is already on it.
    gh(["issue", "edit", String(existing.number), "--repo", repo, "--body-file", "-"], body);
    gh([
      "issue",
      "comment",
      String(existing.number),
      "--repo",
      repo,
      "--body",
      `${changed}${runLink}`,
    ]);
    out(`updated #${existing.number}`);
    return;
  }

  // **A dismissal has to be durable, or this becomes a daily re-file.** Closing
  // the issue is the only way a person can say "we have looked at this and it
  // does not warrant action" -- without this branch the next run would see no
  // open issue and file a fresh one every day, each with a new number and none
  // of the reasoning. The suppression is per fingerprint, so it is narrow on
  // purpose: anything that changes the hash opens a fresh issue rather than
  // hiding behind the old dismissal.
  const dismissed = history.find(
    (i) => i.state === "CLOSED" && i.body?.includes(marker + fingerprint),
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
      label.name,
      "--title",
      title,
      "--body-file",
      "-",
    ],
    body,
  );
  out(`filed ${url.trim()}`);
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

  const report = spawnSync(process.execPath, [REPORT, ...reportArgs], { encoding: "utf8" });
  // The report's stderr reaches the job log on every path, as it did when the
  // workflow ran the report itself; only its stdout is the finding.
  if (report.stderr) process.stderr.write(report.stderr);
  if (report.status !== 0 && report.status !== 1) {
    throw new FindingError(
      `the dependency report could not run (exit ${report.status ?? report.signal})\n${report.stdout ?? ""}`.trim(),
    );
  }

  let fingerprint;
  if (report.status === 0) {
    out(report.stdout.trimEnd());
  } else {
    // The fingerprint is over what identifies the advisories, not what
    // describes them, so an upstream re-wording does not read as a new finding.
    fingerprint = fingerprintIn("audit", report.stdout);
    if (!fingerprint)
      throw new FindingError("the report carried no fingerprint, so it cannot be deduplicated");
  }

  route({
    repo,
    kind: "audit",
    label: SECURITY_AUDIT,
    fingerprint,
    title: "Dependency advisories found by the scheduled audit",
    body: report.stdout,
    cleared: "A later scheduled audit found nothing at or above the reporting threshold.",
    clearedLine: "the tree is clean",
    changed: "The set of advisories changed; the description above has been updated.",
  });
}

// --- dependabot ---------------------------------------------------------------

// **Dependabot fails without telling anyone.** A failed update job opens no
// pull request and sends no notification; it is a red run under the `dynamic`
// event in the Actions tab. Every npm job failed that way for a week after the
// move to pnpm 12 before anyone looked, which is the whole reason this exists.
// It reads the same runs a person would, and turns "the latest scheduled job for
// an ecosystem did not succeed" into the finding every other machine finding
// here already is.

// A run is named after Dependabot's package manager, not after the key
// `.github/dependabot.yml` uses. An ecosystem missing from this map is refused
// rather than skipped: a new entry nobody watches is the failure this closes.
const RUN_NAMES = {
  npm: "npm_and_yarn",
  "github-actions": "github_actions",
  "docker-compose": "docker_compose",
  docker: "docker",
};

// The scheduled job, and nothing else. `npm_and_yarn in /. - Update #123` is a
// version-update run; `npm_and_yarn in /. for qs - Update #124` is a security
// update or a pull request refresh for one dependency, and those are left out
// on purpose: a transitive advisory Dependabot cannot patch under pnpm fails
// its security job every time, and the daily audit already routes advisories.
// What this answers is narrower -- is the weekly job working at all.
const SCHEDULED_RUN = /^([a-z_]+) in (.+) - Update #\d+$/;

// A run that finished without a verdict is not evidence either way.
const HEALTHY = new Set(["success", "neutral", "skipped"]);
const NO_VERDICT = new Set(["cancelled"]);

// Every entry in `.github/dependabot.yml` is weekly, so a job older than a week
// and a day means Dependabot stopped running it -- which is what an invalid
// config or a disabled ecosystem looks like from here: no red run, just none.
const STALE_DAYS = 8;
const DAY_MS = 24 * 60 * 60 * 1000;
const dateOf = (at) => new Date(at).toISOString().slice(0, 10);

function ecosystemsIn(configPath) {
  let config;
  try {
    config = readFileSync(configPath, "utf8");
  } catch {
    throw new FindingError(`cannot read ${configPath}`);
  }
  const keys = [...config.matchAll(/^\s*-\s*package-ecosystem:\s*["']?([\w-]+)["']?\s*$/gm)].map(
    (m) => m[1],
  );
  if (keys.length === 0)
    throw new FindingError(
      `${configPath} declares no package-ecosystem, so there is nothing to watch`,
    );
  const names = keys.map((key) => {
    const name = RUN_NAMES[key];
    if (!name)
      throw new FindingError(
        `no run name is known for the "${key}" ecosystem, so its jobs cannot be told apart; add it to RUN_NAMES`,
      );
    return name;
  });
  return [...new Set(names)];
}

function scheduledRuns(repo) {
  const listing = JSON.parse(gh(["api", `repos/${repo}/actions/runs?event=dynamic&per_page=100`]));
  if (!Array.isArray(listing?.workflow_runs))
    throw new FindingError("the runs listing carried no workflow_runs, so nothing can be judged");
  return listing.workflow_runs
    .flatMap((run) => {
      const match = run.name?.match(SCHEDULED_RUN);
      if (!match || match[2].includes(" for ")) return [];
      if (run.status !== "completed" || NO_VERDICT.has(run.conclusion)) return [];
      return [
        {
          ecosystem: match[1],
          healthy: HEALTHY.has(run.conclusion),
          at: Date.parse(run.created_at),
          id: run.id,
          url: run.html_url,
        },
      ];
    })
    .toSorted((a, b) => b.at - a.at);
}

/** One problem per unhealthy ecosystem, with the key its share of the fingerprint is built from. */
function problemsIn(ecosystems, runs, now) {
  const problems = [];
  for (const ecosystem of ecosystems) {
    const mine = runs.filter((r) => r.ecosystem === ecosystem);
    const [latest] = mine;
    if (!latest) {
      problems.push({ ecosystem, state: "no completed job found", key: "none" });
      continue;
    }
    if (!latest.healthy) {
      // The episode is the run of failures back to the last success, and its
      // first failure is what the fingerprint keys on. So the same episode
      // hashes alike every day, and a recovery followed by a new failure is a
      // new episode -- a fresh issue, not one hiding behind an old dismissal.
      const lastGood = mine.findIndex((r) => r.healthy);
      const episode = lastGood === -1 ? mine : mine.slice(0, lastGood);
      const first = episode.at(-1);
      problems.push({
        ecosystem,
        state: "failing",
        latest,
        since: lastGood === -1 ? `${dateOf(first.at)} or earlier` : dateOf(first.at),
        key: lastGood === -1 ? "before-window" : String(first.id),
      });
      continue;
    }
    const age = Math.floor((now - latest.at) / DAY_MS);
    if (age > STALE_DAYS)
      problems.push({
        ecosystem,
        state: `no job for ${age} days`,
        latest,
        key: `stale-${latest.id}`,
      });
  }
  return problems;
}

function watchBody(problems, fingerprint) {
  const rows = problems.map(({ ecosystem, state, latest, since }) => {
    const job = latest ? `[${dateOf(latest.at)}](${latest.url})` : "—";
    return `| \`${ecosystem}\` | ${state} | ${job} | ${since ?? "—"} |`;
  });
  return (
    `## Dependabot is not updating this repository\n\n` +
    `The latest scheduled update job for each ecosystem below did not succeed. ` +
    `A failed job opens no pull request and notifies nobody, so until one succeeds ` +
    `none of the updates it would have proposed are arriving.\n\n` +
    `| Ecosystem | State | Latest job | Failing since |\n` +
    `| --- | --- | --- | --- |\n` +
    `${rows.join("\n")}\n\n` +
    `## First thing to check\n\n` +
    `The job's log ends in a table of the dependencies it could not update and the error ` +
    `type for each; the lines just above it carry the underlying error. ` +
    `\`.github/dependabot.yml\` records the known causes beside each ecosystem. ` +
    `Until it is fixed, \`pnpm deps:outdated\` lists what the job would have proposed.\n\n` +
    `This issue closes itself once every ecosystem's latest job succeeds. Closing it by hand ` +
    `dismisses this exact set of failures: a new failure, or the same one after a recovery, ` +
    `opens a fresh issue.\n\n` +
    `---\n\nOpened by \`.github/workflows/dependabot-watch.yml\`.\n\n` +
    `${markerFor("dependabot")}${fingerprint} -->\n`
  );
}

function dependabot(args) {
  let configPath = ".github/dependabot.yml";
  for (let i = 0; i < args.length; i += 2) {
    if (args[i] === "--config" && args[i + 1]) configPath = args[i + 1];
    else throw new FindingError("usage: findings.mjs dependabot [--config <dependabot.yml>]");
  }
  const repo = repoFromEnv();
  const ecosystems = ecosystemsIn(configPath);
  const problems = problemsIn(ecosystems, scheduledRuns(repo), Date.now());

  let fingerprint;
  let body = "";
  if (problems.length === 0) {
    out(`every watched ecosystem's latest update job succeeded: ${ecosystems.join(", ")}`);
  } else {
    for (const p of problems) out(`${p.ecosystem}: ${p.state}`);
    const identity = problems.map(
      (p) => `${p.ecosystem}:${p.state === "failing" ? "failing" : "stale"}:${p.key}`,
    );
    fingerprint = createHash("sha256")
      .update(identity.toSorted().join("\n"))
      .digest("hex")
      .slice(0, 16);
    body = watchBody(problems, fingerprint);
  }

  route({
    repo,
    kind: "dependabot",
    label: DEPENDABOT_WATCH,
    fingerprint,
    title: "Dependabot update jobs are failing",
    body,
    cleared: "Every watched ecosystem's latest Dependabot update job succeeded.",
    clearedLine: "every ecosystem is healthy",
    changed: "The set of failing ecosystems changed; the description above has been updated.",
  });
}

// --- entry --------------------------------------------------------------------

function main(argv) {
  const [command, ...rest] = argv;
  if (command === "breach" && rest.length === 0) return breach();
  if (command === "audit") return audit(rest);
  if (command === "dependabot") return dependabot(rest);
  throw new FindingError(
    "usage: findings.mjs breach | findings.mjs audit [--root <dir>] [--input <file>] | findings.mjs dependabot [--config <file>]",
  );
}

try {
  main(process.argv.slice(2));
} catch (error) {
  err(`findings: ${error instanceof FindingError ? error.message : (error.stack ?? error)}`);
  process.exit(2);
}
