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

| Key                     | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | What it settles                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `stacked-prs`           | **Yes**, for genuine chains only — a maximal chain of blocking edges publishes as a stack; a ticket with two blockers stays serialized; unrelated tickets are never stacked                                                                                                                                                                                                                                                                                                                                                                                  | Whether a chain of blocking edges is published as a stack of PRs (`gh stack`) or as independent ones. See the section below                                                                                                                                                                                                                                                                                                                                        |
| `pr-merge-method`       | **Rebase**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Squash, merge commit, or rebase. Decides what a ticket looks like in the history, and interacts with `stacked-prs` — a stack is a chain of branches each based on the one below, and squashing a lower PR rewrites the base every branch above it was cut from                                                                                                                                                                                                     |
| `who-may-merge`         | **Repo owner**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | The role that may merge to the default branch. Never the agent — that part is fixed below, not a choice                                                                                                                                                                                                                                                                                                                                                            |
| `required-checks`       | **`lint`, `format`, `check-types`, `test` (including `test:gates`, `spec-identifiers` and `migrations:check`), `build`, and a dependency audit failing on `high` or above in a direct dependency**                                                                                                                                                                                                                                                                                                                                                           | The checks that must be green before a PR is mergeable. Run on every PR by `.github/workflows/ci.yml`, one job per entry, so each is requirable by name. `format` is `oxfmt --check` and reports rather than rewrites — see the note below                                                                                                                                                                                                                         |
| `pr-size-ceiling`       | `1000`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Changed lines (additions + deletions) counting only files a person reviews — lockfiles and generated files are excluded. Above it, the PR body must say why the ticket was not split; effort 0001's largest PR was +1,832 with nothing measuring it                                                                                                                                                                                                                |
| `coverage-floor`        | `UNSET`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | The coverage number a change may not drop below, or "none" — a real answer that stops `/tdd` asking                                                                                                                                                                                                                                                                                                                                                                |
| `release-branch`        | **`main`**, with `dev` as the default branch — a ticket merges into `dev` and reaching `main` is a deliberate promotion. `.github/workflows/deploy.yml` deploys on a push to `main` and on nothing else; `scripts/deploy.sh` refuses any other branch unless `DEPLOY_ALLOW_BRANCH=1`                                                                                                                                                                                                                                                                         | Which branch is deployed, and therefore what a merge means. Set by #9, which amended NFR25 — see the spec. Deploying from the default branch would make every merged ticket a production release                                                                                                                                                                                                                                                                   |
| `branch-protection`     | **Required status checks and no direct push to the default branch; no required reviews** — on a one-person repository a required review either locks the operator out or normalizes admin bypass                                                                                                                                                                                                                                                                                                                                                             | Whether the remote enforces no-direct-push and required reviews. Until set, the hooks are the only thing enforcing it                                                                                                                                                                                                                                                                                                                                              |
| `worktree-required`     | **Yes, for every session that changes anything** — under `.claude/worktrees/`, branched from the current `origin/<default>`. Reading and exploring on the default branch are untouched                                                                                                                                                                                                                                                                                                                                                                       | Whether a session works in an isolated git worktree or in the main checkout. Set by [ADR-0017](../adr/0017-work-is-written-in-a-worktree-and-merged-into-the-default-branch.md); enforced at the commit by `.claude/hooks/worktree-gate.sh` rule K                                                                                                                                                                                                                 |
| `ui-evidence-required`  | **Yes, where a change alters what a person sees** — a rendered surface, its copy, its focus order or its states. A change to server-only code carries none                                                                                                                                                                                                                                                                                                                                                                                                   | Whether a PR touching a rendered surface must carry a recorded artifact, or may assert the seam-3 leg in prose. Set by [ADR-0019](../adr/0019-ui-change-carries-recorded-proof-not-asserted-proof.md). **Which** artifact is method, not policy — the `ui-proof` skill owns that table, keyed on whether the change is in time, in space, or in the accessibility tree alone, and never on ticket size                                                             |
| `ui-evidence-hosting`   | **Cloudflare R2**, one bucket, public read under an unguessable prefix. Never GitHub's own attachments                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Where an artifact is served from. GitHub has no attachment API and its markdown strips `<video>`, so the only route to GitHub's storage is driving `github.com` in a browser — which puts the agent one click from Merge and defeats `build-to-deploy-gate.sh` rule F                                                                                                                                                                                              |
| `ui-evidence-retention` | **Review proof: 30 days after it is published**, by the bucket's own lifecycle rule — an object-store rule counts from upload, and a key promising "30 days past merge" would have promised a pull request open three weeks nine days it did not have. **Story demo: kept**, under a prefix with no rule. A ticket with a **spec parent** produces both; a ticket from `/triage` and work with **no ticket at all** produce review proof only. Whatever expires an artifact also rewrites the line that linked it, to say what it showed and that it is gone | How long each artifact lives, and what decides which is which. Expiry is a lifecycle rule plus a `pull_request_target: closed` workflow rather than a step, because the agent stops at "PR opened" and is not present when an artifact should die. The rewrite is part of the answer, not a nicety — without it every merged PR ends up pointing at a 404. It says the artifact is **no longer linked** rather than gone, because at close it usually still exists |

### Why `format` is a required check

It was not one until 2026-08-28, and the reason it became one is measured rather than argued.

Three files under `docs/` sat unformatted on the default branch. `oxfmt` is not run by CI and was not
run by `verify-before-stop.sh`, so nothing noticed. Every local `pnpm format:fix` rewrote them, and 54
lines of unrelated churn then appeared in whatever pull request its author happened to be writing.
During [#80](https://github.com/m0t0r/recomencemos/issues/80) that happened **three times** and was
reverted three times.

**The cost of formatting drift is always paid by a different change than the one that caused it**,
which is why neither the author nor the reviewer ever has the incentive to fix it, and why it needs a
gate rather than a convention.

Two things it deliberately is not:

- **It reports; it never rewrites.** The job runs `pnpm format`, which is `oxfmt --check`. A CI job
  that formatted the tree would push to a contributor's branch, which is a different and much larger
  decision.
- **It is not a licence to widen `ignorePatterns`.** That list exists for files another tool owns —
  `pnpm-workspace.yaml`, `packages/domain/drizzle/`, and the committed advisories under
  `docs/efforts/*/advisories/`, each for a reason recorded in the root `CLAUDE.md`. Adding an entry to
  make this gate pass removes the gate for everything the pattern matches. The remedy is
  `pnpm format:fix`.

## Fixed by this repo

Not `UNSET` — decided, and a ticket may not reopen them without an ADR.

| Fact                                                                                                                                                                                   | Where it comes from                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **The agent may open a PR and may never approve or merge one.** This is the production gate                                                                                            | The playbook; `.claude/hooks/build-to-deploy-gate.sh`                                                                         |
| **The agent may not push directly to the default branch.** Everything it writes becomes a PR                                                                                           | Same                                                                                                                          |
| Branch name: `ticket/<issue-number>-<slug>`, so the branch names its ticket and the frontier query can find its work                                                                   | This file                                                                                                                     |
| Work with no ticket (ADRs, process docs, spec amendments) branches as `<type>/<slug>` using its Conventional Commit type — `docs/adr-0005-field-source-names`, `chore/oxc-migration`   | This file; the existing history                                                                                               |
| **One ticket, one PR.** Two tickets share a PR only when the human authorizes it, and the plan comment on each ticket records the reason — #49 and #50 are the precedent and its shape | This file; `docs/agents/issue-tracker.md`                                                                                     |
| Commit convention: Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`)                                                                                              | The existing history — `git log --oneline` is the record                                                                      |
| A ticket's implementation plan is posted as a comment on its issue **before** any code is written                                                                                      | `docs/agents/issue-tracker.md`, "Build operations"                                                                            |
| **Work is written in a worktree under `.claude/worktrees/` and never in the checkout that has the default branch out.** The default branch is where work is merged                     | [ADR-0017](../adr/0017-work-is-written-in-a-worktree-and-merged-into-the-default-branch.md); `.claude/hooks/worktree-gate.sh` |
| Vendored skills under `.agents/skills/` are never hand-edited; re-run the installer                                                                                                    | Root `CLAUDE.md`; `.claude/hooks/build-guard.sh`                                                                              |
| Committed advisories under `docs/efforts/*/advisories/` are verbatim and never edited after the fact                                                                                   | `/to-spec` Phase B3; same hook                                                                                                |

## What "done" means

A ticket is done when all four hold. Three of them are machine-checked, which is the point — a
definition of done that only a human can evaluate is a definition of done that erodes.

1. **Every acceptance criterion on the issue is checked, and each one names its evidence** — the
   command that proves it, or the test that covers it. A criterion checked with no evidence is a
   claim, and the Spec axis of `/code-review` is what catches it.
2. `pnpm lint && pnpm format && pnpm check-types && pnpm test` is green. Add `pnpm build` where the change touches
   Next.js config, routing, Tailwind sources, or `@repo/design-system` exports.
3. Where the change touches `apps/web`, it has been verified **running** — `next-dev-loop`, not just
   a green build. Vitest cannot reach `async` Server Components, so a compile is not a verification.
   **And where it alters what a person sees, that verification is recorded** and the Evidence table's
   seam-3 row links the artifact instead of narrating it. `ui-evidence-required` above is the key;
   `ui-proof` is the method; `pnpm ui-proof publish` is the command. **Its gate is a reading, not a
   run** — the "Recorded proof for a visible change" pass in [`../../REVIEW.md`](../../REVIEW.md),
   blocking. That is a deliberate asymmetry with the three clauses above it, and the reason is that a
   machine can check a link is present but not that the artifact shows the criterion it is cited
   against. A check that passes on any link teaches a session to attach any link. A sixth required
   check was considered and deferred; `required-checks` is unchanged.
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
