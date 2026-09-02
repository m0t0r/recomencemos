---
status: proposed
---

# Work is written in a worktree and merged into the default branch

`docs/policy/build.md` has always said the agent may not push to the default branch, and
`build-to-deploy-gate.sh` rule G enforces it. What neither said is **where work is written**. The
answer was left to each session to arrive at, and the one sentence pointing at it —
_"Worktrees for parallel sessions live under `.claude/worktrees/`"_ — names a **location** and scopes
it to sessions that happen to run in parallel. It is not an obligation, and step 2 of the Build
session says "Branch", not "Worktree".

So the default path a session falls into is: edit `dev` in the main checkout, commit to `dev`,
discover at push time that rule G refuses, and recover with `git branch <name>` plus
`git reset --hard origin/dev`. That is not hypothetical — it happened on the #96 spec amendment, and
the human's correction was _"I expect a PR, not direct pushed to dev."_

This record fixes where work is written, and closes two bugs that made the previous arrangement
worse than it looked.

## The decision

**A session that is going to change anything opens a worktree first, and the default branch is
somewhere work is merged rather than somewhere it is written.**

Three parts, and only the second is new machinery:

1. **The instruction.** `CLAUDE.md` tells a session to open a worktree before its first write, which
   is also what licenses the harness's worktree tool — that tool acts only when the user or the
   project's own instructions say so, so a policy file alone would never have reached it.
2. **The backstop.** `worktree-gate.sh` rule **K** refuses a commit made in a checkout that has the
   default branch checked out.
3. **The procedure.** `docs/agents/issue-tracker.md` step 2 is where a Build session does it, and it
   carries the costs a worktree does not isolate.

## Why the gate refuses the commit and not the write

The obvious stronger rule is to refuse every `Write` and `Edit` while the default branch is checked
out, which would make "worktree before any work" true by construction rather than by instruction. It
was considered and not taken.

**Reading, searching and exploring on the default branch are legitimate and constant**, and a
write-time rule cannot tell an exploratory scratch edit from the first line of a feature. More
importantly the two rules differ in what they cost when they fire on the wrong thing: a refused
commit leaves the working tree intact and the remedy is one `git switch -c` that carries every change
across, while a refused write leaves the session unable to proceed at all.

The commit is also the exact moment the mistake becomes expensive. Before it, the work is a working
tree that belongs to no branch and can be moved with one command. After it, the recovery is the
`git reset --hard` manoeuvre above — performed under pressure, on the branch everything else is based
on. **Rule G refuses the same mistake one step too late; rule K refuses it while it is still free.**

`git merge` and `git pull` are deliberately outside the rule. Fast-forwarding the main checkout from
the remote is legitimate and frequent, and at the level a hook reads a command it is indistinguishable
from merging a feature branch by hand. That gap is named rather than closed with a heuristic — the
same move [ADR-0006](0006-name-the-exposure-rather-than-ship-a-heuristic.md) makes — and rules F and
G are what stop the result of the second one reaching anybody.

## What this record found, which is the part worth reading

Mandating worktrees turned out to be the easy half. **Two hooks were already reading the wrong
checkout**, and both failures point the same way, so they are one bug with two faces.

`CLAUDE_PROJECT_DIR` names the directory the session was **launched** from. It goes on naming the
main checkout after the session enters a worktree. That was measured rather than assumed: a marker
added to a worktree's copy of `build-guard.sh` never appeared in the refusal that copy would have
produced, so the hook that ran was the main checkout's.

- **`verify-before-stop.sh` silently verified nothing in a worktree session.** It did
  `cd "$CLAUDE_PROJECT_DIR"` and then `git status --porcelain`. The main checkout is clean — the
  worktree's changes are invisible there, and `.claude/worktrees/` is gitignored — so the
  changed-files test found nothing and the hook exited before running lint, format, `check-types` or
  the suite. **The strongest gate in the Build stage did nothing, for exactly the sessions this
  record makes standard.** Mandating worktrees without this fix would have been a regression wearing
  a policy's clothes.
- **`design-to-build-gate.sh` rule E scanned the wrong specs.** It walked
  `$CLAUDE_PROJECT_DIR/docs/efforts/*/spec.md`, so `/to-tickets` run from a worktree was judged
  against the specs on the default branch and could not see the one the session had just written.

Both now resolve the tree from the hook payload through `tree_for()` in `gate-lib.sh`, and rule K
uses the same helper. **A hook that reads repo state reads it through the payload; a hook that reads
it through the environment is reading the tree the work is not in.** That is the durable rule here,
and it is why this record exists at all rather than a policy line.

`build-guard.sh` rule J and `plan-to-design-gate.sh` were already correct, because they derive their
paths from the write being judged rather than from the environment. They are the shape the other two
were brought to.

## Considered options

**Refuse writes as well as commits.** Rejected above: it cannot distinguish exploration from work,
and it fails in the direction that leaves a session stuck rather than the direction that leaves it one
command from correct. Worth revisiting if commits on the default branch are still reaching the gate
after this is in place — that would be evidence the instruction is not landing and the harder rule is
owed.

**An environment-variable override**, in the shape of `DEPLOY_ALLOW_BRANCH=1` in `scripts/deploy.sh`.
Rejected because the precedent does not transfer: that variable is set by a **human** running a
script, whereas an agent composes its own commands and can set the variable in the same line it is
gated by. An escape hatch the gated party controls is not an escape hatch.

**Policy and procedure with no gate.** The status quo, and the status quo is what produced the #96
recovery. A written convention is what this repo already had.

**Letting the harness's branch names stand.** The worktree tool names its branch for itself — asked
for `chore/worktree-before-any-work` it produced `worktree-chore+worktree-before-any-work`. Rejected:
`ticket/<issue>-<slug>` is what makes a branch name its ticket, which the frontier query and the PR
linkage both read. The procedure renames with `git branch -m` instead, which is one command and keeps
the convention in the artifact this repo owns.

## Consequences

**Every Build session opens a worktree at step 2, before the plan comment and before any code.** The
position still lives in the tracker, so `/clear` between tickets is unaffected.

**A worktree does not isolate what is not in git**, and the procedure now says so rather than leaving
each session to find out. It has no `node_modules` until something installs them, no `.env.local`, and
it shares the Docker database on 5432/6432 and port 3000 with every other tree. The stop gate blocks
with a message naming `pnpm install` rather than a missing-binary error, because that is the one a
session hits first.

**A stacked ticket cannot use the harness's worktree tool alone.** That tool always branches from the
current `origin/<default>`, and a stacked ticket must be based on its blocker's branch. The procedure
carries the `git worktree add -b <branch> <blocker-branch>` route for that case, entered by path.

**Rule K is expected to be quiet.** A session that followed the procedure never reaches it. A gate
that fires routinely is a gate somebody learns to route around, so if it starts refusing often the
thing to fix is the instruction, not the rule.
