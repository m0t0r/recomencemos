---
name: ci-and-dependencies
description: This repository's CI, coverage, dependency-audit and Dependabot arrangements, and which pnpm 12 commands it adopted or refused. Load before editing .github/workflows/ or .github/dependabot.yml, adding a pnpm-workspace.yaml override, changing scripts/audit-*.mjs, scripts/findings.mjs or scripts/coverage-merge.mjs, or bumping, overriding or proposing a dependency or a pnpm command.
---

# CI and dependencies

Moved from the root `CLAUDE.md`, which still carries the toolchain gotchas every session needs and
the six CI jobs. This is the part only dependency and CI work reads.

## What pnpm 12 shipped, and what this repo took

**What else pnpm 12 shipped, and what this repo took from it** (#213). Each candidate was measured
against this repository rather than read off the changelog, and the refusals are written down so the
next session does not re-propose one. **None of what was adopted is a decision a machine makes about
this repository, so none of it has a script under `scripts/` or a file under `.claude/hooks/tests/`**
— [ADR-0020](../../../docs/adr/0020-gate-logic-is-a-script-with-a-suite-and-the-wiring-stays-thin.md)'s own
words are that a root `package.json` script is wiring, and wiring holds no branching. A test would
also have to reach the registry from inside `pnpm test`, which `gate-test.sh` is deliberately free of.

- **`pnpm deps:outdated`** is `pnpm outdated --include-github-actions`. pnpm 12's `outdated` reads
  GitHub Actions as well as npm packages, which gives the SHA pin in `.github/actions/setup/action.yml`
  a **second reader** beside Dependabot's `directories:` glob — whose failure mode is silence.
  Measured: it reads `.github/workflows/*` and **follows** a `uses: ./.github/actions/<name>` into the
  composite file; it resolves a SHA pin without reading the trailing `# vX.Y.Z` comment, so a comment
  that has drifted does not fool it; and it does **not** read an `action.yml` no workflow references, which is why that second
  `directories:` entry is still not redundant. It exits `1` when anything is behind, and it is a
  command a person runs rather than a check: an upstream release makes it red the day it lands, which
  is `docs/policy/security.md` C7's argument against a gate red on arrival. `.github/dependabot.yml`
  is where it is pointed at, because reviewing that SHA pin is the occasion to run it.
- **`pnpm peers`** replaces the removed `--resolution-only` and is how an unmet peer gets read. An
  unmet peer makes it red, and there is one in this tree, which is the same reason it is not a gate —
  the pair is named in the pull request that adopted it rather than here, because which peer is unmet
  changes and this sentence would not.
- **`pnpm sbom` is a policy answer rather than a job.** `docs/policy/security.md` → `sbom`: generated
  on demand from the committed lockfile, never stored, and it covers the npm graph and not the base
  image under it.
- **Refused: `pnpm ci`, `audit.ignorePrune`, `pnpm runtime` and `pnpm shim`.** `pnpm ci` is `clean`
  then a frozen install, and CI has no `node_modules` to clean — `actions/setup-node`'s `cache: pnpm`
  restores the **store** — so it swaps one line for one line and adds a footgun, since a `clean` script
  in `package.json` silently overrides the builtin. `audit.ignorePrune` drops spent entries from
  `audit.ignoreGhsas`, and this repo keeps no such list: a dismissal here is a **closed issue** keyed
  by `scripts/audit-report.mjs`'s fingerprint, which is a person's act with a paper trail that expires
  itself when the advisory set changes. `pnpm runtime` reads `devEngines.runtime` and `pnpm shim`
  serves binaries that are not installed locally — a fourth selector for a question `.nvmrc`,
  `engines.node` and `engineStrict` already answer once, and a shim for a `node_modules` every binary
  here already comes out of through `pnpm exec` or turbo.

## Coverage, the audit report and Dependabot

**Coverage is measured on every pull request, reported on it, and gates nothing.**
`.github/workflows/coverage.yml` runs `pnpm test:coverage` — `turbo run test:coverage` followed by
`scripts/coverage-merge.mjs` — and posts one comment through
`davelosert/vitest-coverage-report-action`, updated in place on each push. Four things about it are
decisions rather than defaults:

- **It is not a job in `ci.yml`, and it is not in `required-checks`.** Those six jobs are one per
  entry so a human can require each by name; coverage is deliberately not one a human should require.
  `ci.yml` is also `workflow_call`ed by `deploy.yml`, which grants `contents: read` — a job there
  asking for `pull-requests: write` would exceed the caller's grant and fail every deploy.
- **`coverage-floor` is `none`, and that is an answer rather than a gap.** A route handler, a Server
  Action and an `async` Server Component all verify at seam 3 against a running `next dev`, which a
  line-coverage number cannot see — so a large part of `apps/web` is uncovered by design, and a floor
  would apply pressure to close it with exactly the wiring tests this repo cuts. The full argument is
  in `docs/policy/build.md` under **Why `coverage-floor` is `none`**. Raising it into a gate needs an
  ADR.
- **No Vitest config carries a `thresholds` key**, because a threshold fails the run and would be the
  same gate by another route.
- **The merge exists because six workspaces would otherwise be six comments.** The reporting action
  keys its sticky comment on the report name, so `scripts/coverage-merge.mjs` folds the six
  `coverage-summary.json`/`coverage-final.json` pairs into one at the repo root first. It reads its
  workspace list from `pnpm-workspace.yaml` through `audit-lib.mjs`'s `workspaceGlobs` so a seventh
  workspace cannot go silently unmeasured, and it exits `2` rather than publishing a partial merge —
  a total that looks like the repository and is not is the failure it is arranged against.

**The transitive half is not unwatched, and `audit:direct` is deliberately only one of the two
answers.** `pnpm audit:report` (`scripts/audit-report.mjs`) reports every advisory at `moderate` or
above wherever it sits, blocks nothing, and is run daily by
`.github/workflows/security-audit.yml`, which routes the finding to a `needs-triage` issue and
closes it again when a later run comes back clean. The threshold is
`docs/policy/security.md` → `audit-report-threshold`, not a number chosen in the script.

**The routing is `scripts/findings.mjs`, and the workflow is one line calling it**
([ADR-0020](../../../docs/adr/0020-gate-logic-is-a-script-with-a-suite-and-the-wiring-stays-thin.md)). Its
`audit` subcommand runs the report and performs the lifecycle — file, edit in place when the set
changes, close when clean, honour a closed issue as a dismissal of that exact fingerprint — its
`dependabot` subcommand runs the same lifecycle over Dependabot's own jobs (below), and its
`breach` subcommand is what `needs-triage.yml` calls with a control-band payload. The two scheduled
ones share one `route()` and each keys on a marker of its own, so neither can close the other's
issue. All three are driven
by `.claude/hooks/tests/findings.sh` with `gh` stubbed on `PATH` and its call log asserted, which is
the rule that ADR sets for every gate and automation here: **the decision is a script with a test
file named for it; a workflow `run:` line and a `settings.json` entry are wiring and hold no
branching.** The script imports nothing outside Node's standard library because
`needs-triage.yml` runs it with no `pnpm install`.

Two things make that workflow load-bearing rather than belt-and-braces, and both were measured:
six advisories — four of them `high` — sat on the default branch while every pull request went
green, and **Dependabot opened no pull request for any of them** even with security updates enabled,
because dependabot-core does not support updating transitive dependencies for the pnpm ecosystem.
Every one was transitive, and each was fixed by a scoped `overrides` entry in `pnpm-workspace.yaml`,
which is a manifest edit no version bump produces. The workflow reads `pnpm audit` rather than the
Dependabot alerts API because the default `GITHUB_TOKEN` can never hold that permission; the two were
checked against each other and agreed on all six.

Both scripts read the manifests and the audit payload through `scripts/audit-lib.mjs`, for the reason
`.claude/hooks/gate-lib.sh` exists — two gates that disagreed about which dependency is direct would
be worse than either one alone.

**Dependabot is the other half of the audit job, and it has one coupling worth knowing.**
`.github/dependabot.yml` covers npm (one entry — Dependabot expands `pnpm-workspace.yaml`'s globs
itself), `github-actions`, `docker-compose` — for the four image digests in `docker-compose.yaml`,
whose whole failure mode is that an exact pin never moves — and `docker`, for the `node:24-slim`
digest the `Dockerfile` pins, which is the one image a deployment runs and which ignores Node majors
for the `@types/node` reason below. `docker-compose` is
**version updates only**, with no security-update channel, which is acceptable only because those
containers are loopback-bound development ones in no deployment path. Its `cooldown` is set against **`minimumReleaseAge` in
`pnpm-workspace.yaml`**, which is 1440 minutes: a package published inside that window does not
resolve locally at all, so a PR raised sooner is one nobody could install. Dependabot's own default
is already stricter, so the two cannot currently disagree — it is pinned anyway because the number
that matters is the relationship between the two files. The `github-actions` entry names
`/.github/actions/*` as well as `/`, without which the SHA pin in the composite setup action would
never be updated. Its commit messages are prefixed to stay inside Conventional Commits.

**Dependabot fails silently, so `.github/workflows/dependabot-watch.yml` watches it.** A failed
update job opens nothing and notifies nobody — it is a red run under the `dynamic` event — and every
npm job failed that way from 2026-09-07 to 2026-09-14 before a person noticed that no pull request
had arrived. The watch reads the latest **scheduled** job per ecosystem (a `… for <dependency>` run
is a security or refresh job and is ignored, since a transitive pnpm advisory fails that job every
time and the audit already routes advisories), and files a `needs-triage` + `dependabot-watch`
issue when one failed or has not run for eight days. The fingerprint keys on each ecosystem's
**failure episode** — the first failure since the last success — so the same outage stays one issue,
and a relapse after a recovery is a fresh one rather than hiding behind an old dismissal. It reads
the ecosystem list from `dependabot.yml` and refuses one it has no run name for, so an entry added
there without a mapping in `findings.mjs` goes red rather than unwatched. It needs only
`actions: read`: Dependabot's jobs are ordinary workflow runs, which the default token can list.

**Two failures this caught on the day it was written, both worth knowing before trusting a green
Dependabot tab.** The npm jobs fail at the lockfile *write*, not the read: `pmOnFail: ignore` keeps
the lockfile one document so Dependabot parses the graph and finds the updates, and then pnpm 12's
launcher downloads its native binary with a bare `fetch()` that ignores the job's proxy
(dependabot-core#16170, open). No setting here reaches it. And the `docker-compose` job failed once
Docker Hub removed the namespace of the object store this repository then ran; #316 replaced that
store with Versity S3 Gateway, whose server and init images are both on Docker Hub.

**It also ignores `@types/node` majors, and that is the one hole `engineStrict` cannot cover.** The
repo requires the active LTS and enforces it by reading each package's `engines` field —
`@types/node` has none, because it is types rather than code, so a `@types/node@26` installs clean on
Node 24 and then teaches `check-types` an API surface the runtime does not have. Green CI is the
symptom, not the reassurance. Majors are ignored rather than a `versions:` range spelled out because
`.nvmrc`, `engines.node` and this dependency move together in one deliberate edit; that edit is where
the types package is raised by hand. `ignore` is blunt enough to suppress security advisories too,
which is tolerable only because the package ships no runtime code — do not copy the rule onto one
that does.
