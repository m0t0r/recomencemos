---
status: proposed
---

# Gate logic is a script with a suite, and the wiring around it stays thin

This repository has two places where a machine decides whether work may proceed, or files what it
found: the session side — `.claude/settings.json` and the hooks it names — and the CI side —
`.github/workflows/` and the scripts they call. Both grew one gate at a time, and by the time they
held twenty-odd decisions between them, the shape of a new one was whatever the last one happened to
be. This record fixes the shape.

**The tell was measured, not felt.** `security-audit.yml` carried a hundred and ten lines of bash
implementing an issue lifecycle — find the open finding by its fingerprint marker, close it when the
tree is clean, edit it in place when the set changes, honour a closed one as a dismissal, file
otherwise. `needs-triage.yml` carried fifty more, and duplicated the label step. Neither was under
`gate-test.sh`, and CI neither lints nor runs a workflow it is not triggered by, so both merged on
logic exercised only by extracting the `run:` block by hand and stubbing `gh`. That method found two
real defects on #164 — an issue lookup filtered to open issues that turned a human's dismissal into a
re-file every morning, and a label used as the handle that let a mislabelled issue be overwritten —
which is the argument for making it a suite rather than a thing someone remembers to do.

The session side had the mirror problem. `gate-test.sh` was one file of 2,107 lines with twelve
copies of the same ten lines of pass/fail bookkeeping, one per runner function, and every new script
under `scripts/` cost a thirteenth. The cases were good; the container did not scale.

## The decision

**A decision a machine makes about this repository lives in a script, and that script has a file
under `.claude/hooks/tests/` driving it. What names the script — a workflow `run:` line, a
`settings.json` entry, a root `package.json` script — is wiring, and wiring holds no branching.**

Three consequences, each already in place:

1. **A workflow `run:` block is one command.** `ui-proof-expire.yml` set the shape — checkout, Node,
   one script call, no `pnpm install` where the script needs nothing outside Node's standard library
   — and `security-audit.yml` and `needs-triage.yml` now follow it through `scripts/findings.mjs`.
   A `run:` that grows an `if` is a script waiting to be extracted; a `run:` that shells out to
   `gh` more than once is one already.
2. **Every script has a test file named for it**, one file per thing under test, run by
   `gate-test.sh` as the runner and nothing else. `tests/lib.sh` holds the two assertions a case is
   written with — a hook decision, or a command's exit code and output — and a gate-specific runner
   is a one-line adapter over one of those, never its own bookkeeping. A script that shells out is
   driven with the binary stubbed on `PATH`, logging its calls, because the call log is the
   assertion: a lifecycle that exited `0` having closed the wrong issue passes on the code alone.
3. **A list of checks has one home.** `docs/policy/build.md` → `required-checks` is the policy; the
   root `package.json` scripts are its executable form; `ci.yml`, `verify-before-stop.sh` and
   `CLAUDE.md` all invoke those scripts and none restates the task list behind them. The same rule
   reaches prose: a count of jobs or cases is never written down, because the day it is written is
   the last day it is right — README said five checks when there were six, and 58 cases when there
   were 337.

## What this record does not decide

**`ci.yml` stays one job per required check**, and a matrix that would fold the six into one entry
was considered and left. A required status check is a job name, the six names are what a human
requires in branch protection, and the duplication is five lines of YAML per job around a comment
that says why that job exists. Folding it would save fifteen lines and cost the reader the reason.

**The scripts keep their own argument parsers.** `audit-lib.mjs` argues that the duplication worth
removing is the duplication that can disagree about an answer, and five `parseArgs` functions that
differ by which flags they accept cannot. Their exit and message shapes differ by audience on
purpose — one script's caller is a command substitution and needs its note on stderr — and a shared
wrapper would flatten a difference that is doing work.

## Consequences

- A new gate or automation is three files: the script, its test file, and one line of wiring. The
  runner discovers the test file by name; nothing else has to learn the gate exists.
- `pnpm test:gates <name>` runs one file, and the files run concurrently, so a suite that is inside
  every `pnpm test` and every Stop hook costs the slowest file rather than the sum.
- A workflow can be read in one screen, and what it does when the finding is a dismissal is answered
  by a test name rather than by reading bash inside YAML.
- The price is a second process: `findings.mjs` spawns `audit-report.mjs` rather than importing it,
  so the report's three exit codes stay the contract and the suite drives the real report. That is
  one extra Node start per daily run.
