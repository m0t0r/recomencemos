# Build policy

Owner: **Repo owner** ([owners.md](owners.md)). Read by `/implement` through the "Build operations"
section of [`../agents/issue-tracker.md`](../agents/issue-tracker.md), and enforced by
`.claude/hooks/build-guard.sh` and `.claude/hooks/build-to-deploy-gate.sh`.

An `UNSET` value is raised as a flagged concern naming this file and the key. It is never guessed.

**Not every answer here is `UNSET`, and that is deliberate.** The keys below the first table are
**fixed by this template** — a working default exists, and adopting it commits the organization to
nothing. Branch naming is the clearest case: an `UNSET` there would stop the first Build session of
every new project on a question with no wrong answer, which is not what that mechanism is for.
`UNSET` is reserved for decisions that carry real consequence and that no template can make.

## Keys

| Key                 | Value                                                                                                                                                                                            | What it settles                                                                                                                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stacked-prs`       | **Yes**, for genuine chains only — a maximal chain of blocking edges publishes as a stack; a ticket with two blockers stays serialized; unrelated tickets are never stacked                      | Whether a chain of blocking edges is published as a stack of PRs (`gh stack`) or as independent ones. See the section below                                                                                                                                    |
| `pr-merge-method`   | **Rebase**                                                                                                                                                                                       | Squash, merge commit, or rebase. Decides what a ticket looks like in the history, and interacts with `stacked-prs` — a stack is a chain of branches each based on the one below, and squashing a lower PR rewrites the base every branch above it was cut from |
| `who-may-merge`     | **Repo owner**                                                                                                                                                                                   | The role that may merge to the default branch. Never the agent — that part is fixed below, not a choice                                                                                                                                                        |
| `required-checks`   | **`lint`, `check-types`, `test` (including `test:gates`), `build`, and a dependency audit failing on `high` or above in a direct dependency**                                                    | The checks that must be green before a PR is mergeable. Until CI exists, this is what a human runs by hand                                                                                                                                                     |
| `pr-size-ceiling`   | `1000`                                                                                                                                                                                           | Changed lines (additions + deletions) counting only files a person reviews — lockfiles and generated files are excluded. Above it, the PR body must say why the ticket was not split; effort 0001's largest PR was +1,832 with nothing measuring it            |
| `coverage-floor`    | `UNSET`                                                                                                                                                                                          | The coverage number a change may not drop below, or "none" — a real answer that stops `/tdd` asking                                                                                                                                                            |
| `branch-protection` | **Required status checks and no direct push to the default branch; no required reviews** — on a one-person repository a required review either locks the operator out or normalizes admin bypass | Whether the remote enforces no-direct-push and required reviews. Until set, the hooks are the only thing enforcing it                                                                                                                                          |

## Fixed by this repo

Not `UNSET` — decided, and a ticket may not reopen them without an ADR.

| Fact                                                                                                                                                                                   | Where it comes from                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **The agent may open a PR and may never approve or merge one.** This is the production gate                                                                                            | The playbook; `.claude/hooks/build-to-deploy-gate.sh`    |
| **The agent may not push directly to the default branch.** Everything it writes becomes a PR                                                                                           | Same                                                     |
| Branch name: `ticket/<issue-number>-<slug>`, so the branch names its ticket and the frontier query can find its work                                                                   | This file                                                |
| Work with no ticket (ADRs, process docs, spec amendments) branches as `<type>/<slug>` using its Conventional Commit type — `docs/adr-0005-field-source-names`, `chore/oxc-migration`   | This file; the existing history                          |
| **One ticket, one PR.** Two tickets share a PR only when the human authorizes it, and the plan comment on each ticket records the reason — #49 and #50 are the precedent and its shape | This file; `docs/agents/issue-tracker.md`                |
| Commit convention: Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`)                                                                                              | The existing history — `git log --oneline` is the record |
| A ticket's implementation plan is posted as a comment on its issue **before** any code is written                                                                                      | `docs/agents/issue-tracker.md`, "Build operations"       |
| Worktrees for parallel sessions live under `.claude/worktrees/`                                                                                                                        | This file                                                |
| Vendored skills under `.agents/skills/` are never hand-edited; re-run the installer                                                                                                    | Root `CLAUDE.md`; `.claude/hooks/build-guard.sh`         |
| Committed advisories under `docs/efforts/*/advisories/` are verbatim and never edited after the fact                                                                                   | `/to-spec` Phase B3; same hook                           |

## What "done" means

A ticket is done when all four hold. Three of them are machine-checked, which is the point — a
definition of done that only a human can evaluate is a definition of done that erodes.

1. **Every acceptance criterion on the issue is checked, and each one names its evidence** — the
   command that proves it, or the test that covers it. A criterion checked with no evidence is a
   claim, and the Spec axis of `/code-review` is what catches it.
2. `pnpm lint && pnpm check-types && pnpm test` is green. Add `pnpm build` where the change touches
   Next.js config, routing, Tailwind sources, or `@repo/design-system` exports.
3. Where the change touches `apps/web`, it has been verified **running** — `next-dev-loop`, not just
   a green build. Vitest cannot reach `async` Server Components, so a compile is not a verification.
4. A PR is open and links its ticket. **The agent stops here.** Merging is the human's act.

## Stacked pull requests

`stacked-prs` is **yes** for genuine chains, set by effort 0002 (concern C16). `/implement` publishes a
maximal chain of blocking edges as a stack and opens an independent PR for everything else.

What that buys, and what it costs, is worth understanding. `/to-tickets` already emits the structure a
stack needs: every ticket declares the tickets that **block** it, and a chain of blocking edges _is_
a stack. Publishing it as one means ticket N's branch is based on ticket N-1's rather than on the
default branch, so a blocked ticket can start before its blocker merges, and a reviewer still gets
one small PR per slice instead of one large one per effort.

Three things it costs, and they are the reason this is a decision rather than a default:

- **A stack is a path; the ticket graph is a DAG.** A ticket with two blockers cannot sit above both.
  The decomposition rule is in `docs/agents/issue-tracker.md`; tickets that do not fit a chain stay
  serialized.
- **Rebase churn.** A review fix on a lower PR rebases everything above it. `/resolving-merge-conflicts`
  exists for this, and it is the main tax.
- **More PRs to review.** `REVIEW.md` has to say that per-PR passes run on each diff while the
  compliance-against-spec pass runs once, at the top of the stack — otherwise the spec gets reviewed
  five times and the effort never gets reviewed as a whole.

It requires the `gh stack` extension (`gh extension install github/gh-stack`), which is `v0.1.0` — a
young tool on the critical path of every chained ticket. That immaturity was the standing reason to
leave this key open; effort 0002 accepted it knowingly, against 17 `Must` stories whose diffs are
smaller and more reviewable stacked than independent.
