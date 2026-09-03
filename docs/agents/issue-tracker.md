# Issue tracker: GitHub

Issues for this repo live as GitHub issues, driven by the `gh` CLI. Intents and specs are files in
`docs/efforts/`, published to an issue that points at them: see "When a skill says publish to the issue
tracker" below.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v`; `gh` does this automatically when run inside a clone.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using the `gh pr` equivalents:

- **Read a PR**: `gh pr view <number> --comments` and `gh pr diff <number>` for the diff.
- **List external PRs for triage**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments` then keep only `authorAssociation` of `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, or `NONE` (drop `OWNER`/`MEMBER`/`COLLABORATOR`).
- **Comment / label / close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub shares one number space across issues and PRs, so a bare `#42` may be either: resolve with `gh pr view 42` and fall back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Two kinds of artifact publish differently.

**Intents and specs are files.** `intent.md` and `spec.md` are the versioned artifacts of the
AI-native SDLC: git is their **source of truth**, and the GitHub issue is a workflow surface that
points at the file. `/to-intent` and `/to-spec` publish these.

**Every other ticket is a GitHub issue and nothing more.** `/to-tickets`, `/wayfinder`, and
`/triage` call `gh issue create` directly. Tickets are decomposition, not the audit trail.

### Publishing an intent or a spec

Efforts live at `docs/efforts/<NNNN>-<slug>/`, numbered from `0001`. Take the next number by scanning
`docs/efforts/`; reuse the existing folder when the effort already has one.

1. Write `docs/efforts/<NNNN>-<slug>/<stage>.md`, leaving `issue:` empty:

   ```yaml
   ---
   stage: spec # intent | spec
   status: draft # draft | approved | superseded
   issue: # filled in at step 3
   intent: ./intent.md # spec only: the intent this derives from
   ---
   ```

2. `gh issue create --label ready-for-agent --title "<Stage>: <title>"`. The body is a **stub**: a
   one-paragraph summary, then a `Source of truth:` line linking the file on the default branch.
3. Write the issue number `gh` returned into the file's `issue:` field.
4. Commit the file: `docs(effort): <NNNN> <stage> — <title>`. See "Commit messages" below.
5. **Push, and confirm the commit reached the remote.** A permalink pins a SHA, and GitHub cannot
   serve a blob for an object it has never received — a link to an unpushed commit 404s, while
   looking exactly like a working one. Effort artifacts land on the **default branch**, which
   [`../policy/build.md`](../policy/build.md) forbids an agent from pushing to, so an agent
   **stops here and asks the human to push**. Confirm before step 6:

   ```sh
   git branch -r --contains <sha>          # names a remote branch, or the commit is not published
   ```

6. `gh issue comment <n>` with a permalink pinned to that commit's SHA. Read the SHA from git —
   `SHA=$(git rev-parse HEAD)` — rather than extending a short hash by hand.

The stub summarises and the file carries the content, so the tracker has one link to follow rather
than a copy that goes stale the first time the file is edited.

**Revising a published artifact**: edit the file, commit, push (step 5 again — the same 404 applies),
then add one comment carrying the new commit-pinned permalink and a line on what changed. The issue's
comment history is the artifact's changelog.

### Commit messages for an effort artifact

Every commit touching one takes the same shape, so `git log --oneline --grep "<NNNN> <stage>"` is
the artifact's whole history:

| When          | Message                                                            |
| ------------- | ------------------------------------------------------------------ |
| First publish | `docs(effort): 0001 intent — observability`                        |
| Revision      | `docs(effort): 0001 intent — record answers to the open questions` |
| Approval      | `docs(effort): 0001 intent — approved`                             |

A bare `approve <slug>` is **not** it. [`../policy/build.md`](../policy/build.md) fixes Conventional
Commits, and a message with no type is outside the convention. One such message is already in this
repo's history — do not copy it. `build.md` cites the history itself as the record of the
convention, which is precisely how a non-conforming message propagates, so the format is written
here rather than left to be inferred.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Build operations

Used by `/to-tickets` and `/implement`. The **plan** is not a document: it is the spec's issue with
its tickets hanging off it, so it reports its own state and cannot fall out of date.

- **Parent**: the spec's issue, the number recorded in `spec.md`'s `issue:` field. `/to-tickets`
  publishes every ticket as a **sub-issue** of it, so the effort needs no extra bookkeeping field.
- **Sub-issues, blocking edges, and the frontier query** work exactly as in Wayfinding operations
  below: the same `gh api` calls, the same numeric database id for dependency edges, and the same
  fallbacks where sub-issues or dependencies are unavailable.
- **Reading the plan**: `gh issue view <parent> --comments` lists the sub-issues with each ticket's
  state, and GitHub renders progress and blocked-by in its own UI. This is what answers "where did
  we get to" at the top of a session.
- **Resuming across sessions**: an `/implement` session opens by running the frontier query against
  the parent, then claims the first open, unblocked, unassigned ticket with
  `gh issue edit <n> --add-assignee @me`. The session holds no position; the tracker does. That is
  what makes `/clear` between tickets safe.
- **Changing the plan**: splitting a ticket adds a sub-issue and rewires the edges around it, and
  the parent's progress follows on its own — there is no plan document to bring back in line.
- **A spec's `## Runbook obligations` section is a ticket, and `/to-tickets` cuts it like any other.**
  The skill drafts _tracer-bullet vertical slices_, which is a shape a runbook step does not have —
  provisioning a bucket, printing backup codes and filing a DPA are nobody's user-visible behaviour,
  so left to the default reading they are read as prose and dropped. Where a spec carries that
  section, its rows are the ticket's acceptance criteria and the runbook file is what the ticket
  works through. The coupling lives here, in an artifact this repo owns, exactly as the ticket claim
  and the frontier query do — **`/to-tickets` is not forked for it**.
  The section earns its place the same way an NFR's `Binds:` line does: a spec that names a step only
  a human can take, and produces no ticket, has moved that work nowhere.
- **Summaries lag their edges.** `sub_issues_summary` and `issue_dependencies_summary` are computed
  a second or two behind the writes that change them, so a frontier query run immediately after
  wiring edges can read a ticket as unblocked when it isn't. When the answer has to be right straight
  after a write, read the edges themselves — `gh api repos/<owner>/<repo>/issues/<n>/dependencies/blocked_by`
  returns the blocking issues with their `state`, and is consistent immediately.

### A Build session, start to finish

`/implement` is vendored unmodified and is deliberately thin — it says to implement the work, use
`/tdd` at agreed seams, run `/code-review`, and commit. Everything below is the part that is
**this repo's**, and it reaches the skill the same way `/to-tickets`' sub-issue convention does:
through `CLAUDE.md` pointing here. Do not fork the skill to add any of it.

Read [`../policy/build.md`](../policy/build.md) first. It holds the branch pattern, the merge rules,
and the four conditions that define **done**.

1. **Claim.** Run the frontier query against the parent, take the first open, unblocked, unassigned
   ticket, and `gh issue edit <n> --add-assignee @me`. This is the session's first write. One ticket
   per session — `/clear` between them, which is safe because the position lives in the tracker.
2. **Worktree, then branch.** Open a worktree **before the first write** — before the plan comment,
   before any code. `ticket/<issue-number>-<slug>` is the branch, so the branch names its ticket and
   the frontier query can find its work. This is [`../policy/build.md`](../policy/build.md)'s
   `worktree-required`, and `.claude/hooks/worktree-gate.sh` refuses a commit made anywhere else.
   See "Working in a worktree" below for how, and for what a worktree does not isolate.
3. **Plan, and post it.** Plan the change, then post the approved plan as a **comment on the ticket**
   before writing code. The playbook commits a `plan.md` for this reason — _"the PR review play
   checks the eventual diff against it"_ — and the Spec axis of `/code-review` is what does the
   checking. A comment rather than a file because the plan is decomposition, not the audit trail:
   the same reason tickets are issues and specs are files.
4. **Capture the before, if the ticket touches a rendered surface.** The worktree is still at
   `origin/<default>`, so the before-state is sitting there for free — and only here. Reconstructed at
   PR time it costs a second checkout, a second `next dev` on another port, and a shared database that
   may have moved underneath it. `ui-proof` is the method and
   [`../policy/build.md`](../policy/build.md)'s `ui-evidence-required` decides whether anything is
   owed at all; the skill's own table decides what to capture, keyed on whether the change is in time,
   in space, or in the accessibility tree alone. Both answer to
   [ADR-0019](../adr/0019-ui-change-carries-recorded-proof-not-asserted-proof.md). Where the
   ticket is a bug fix the before **is the reproduction**, so capture it while diagnosing rather than
   staging it again afterwards. A session that reaches the end with no before says so in the PR body
   and does not manufacture one by reverting the change — that captures a tree nobody reviewed.
5. **Build.** `/tdd` at the seams **the spec already agreed** — they are in the spec's
   `## Testing Decisions` section, which `/to-spec` A5 fills in after checking them with the user
   before Phase B. That section is the answer to `tdd`'s "no test is written at an unconfirmed seam",
   so read it rather than re-interviewing the user about something Design settled.
6. **Verify, with evidence.** Work `build.md`'s definition of done. Tick each acceptance criterion on
   the issue and **name what proves it** — the test, or the command and its output. A criterion
   ticked with no evidence is a claim. Take the **after** capture here, against the same session,
   viewport and fixtures the before used; a pair that differs in anything else diffs on things nobody
   changed. **A ticket with a spec parent takes one more capture: the story demo**, named `demo-`
   rather than `after-`, which is what the publish step reads to put it under the durable prefix. It
   is not the after clip renamed — it starts from an empty or signed-out state and walks the story end
   to end, because it answers "what does this look like working" rather than "what did this change".
   `ui-evidence-retention` in [`../policy/build.md`](../policy/build.md) is the rule; the naming is in
   the `ui-proof` skill.
7. **Open a PR.** Title from the ticket. Body: what changed, the evidence from step 6, and
   `Closes #<ticket>` so merging closes it. Never `--fill` from commits alone; the ticket is the
   contract, and the PR body is what the reviewer compares against. Where a capture was taken, the
   seam-3 row of the Evidence table **links the artifact rather than narrating it** — and the
   structural half of "what changed" is written as a `show-me` diff sketch or a mermaid diagram in the
   body itself, which renders natively, stays in git, and is reviewable against the diff. The hosted
   artifact is a media viewer, never a second copy of the prose — `pnpm ui-proof publish --pr <n>`
   uploads it and edits the body, and it is generated **from** that body, so the order is: write the
   PR, then publish. Run it with `--dry-run` first; that form reaches nothing and is where a misnamed
   or truncated capture is named.
8. **Stop.** The agent may open a PR and may not approve or merge one — `build-to-deploy-gate.sh`
   refuses both. Report the PR and the ticket, and say which acceptance criteria carry weak evidence.

Where the ticket came from `/triage` rather than `/to-tickets` there is no parent and no spec. Steps
1–8 are unchanged except that step 5 has no agreed seam to read, so the seams are confirmed with the
user in-session, as `tdd` requires — and that the ticket produces **review proof only**. A durable
story demo answers "what does this story look like working", which is a question a ticket with no
spec parent was never asked; `ui-evidence-retention` in [`../policy/build.md`](../policy/build.md) is
where that split is decided, and having the parent decide it means no session has to judge it.

### Working in a worktree

This applies to **every** session that changes anything, not only a Build session and not only
parallel ones: an ADR, a spec amendment, a runbook edit and a one-line fix are all work, and
[`../policy/build.md`](../policy/build.md) makes no exception for any of them. Reading, searching and
exploring on the default branch are untouched.

**The default route is the harness's own worktree tool**, which creates the worktree under
`.claude/worktrees/`, branches it from the current `origin/<default>` and moves the session into it.
It names the branch for itself, though, so **rename it straight away** — asked for
`chore/foo` it produces `worktree-chore+foo`, and a branch that does not match
`ticket/<issue>-<slug>` or `<type>/<slug>` is one neither the frontier query nor the PR linkage can
read:

```sh
git branch -m ticket/124-add-widget    # from inside the new worktree
git branch --show-current              # confirm before writing anything
```

**A stacked ticket takes the other route.** The harness tool always branches from
`origin/<default>`, and a stacked ticket must be based on its blocker's branch, so create the
worktree by hand and enter it by path:

```sh
git worktree add .claude/worktrees/ticket+124-add-widget \
  -b ticket/124-add-widget ticket/123-the-blocker
```

**What a worktree does not isolate.** It isolates git and nothing else, and each of these has cost a
session before:

- **`node_modules`.** A fresh worktree has none, and it cannot borrow the main checkout's — the
  workspace symlinks are relative, so every `@repo/*` resolves inside the worktree or not at all. Run
  `pnpm install` in it; the store is shared, so it costs seconds. `pnpm exec` installs on demand and
  `pnpm run` does not, which is why the stop gate checks for the directory and names the fix.
- **`.env.local`.** Gitignored, so it is absent. `cp apps/web/.env.example apps/web/.env.local`
  again, or `pnpm dev` fails in a way that looks like a code problem.
- **The database.** `docker-compose.yaml` binds one Postgres on 5432 and one PgBouncer on 6432 for
  the whole machine, and every tree writes into them. Two sessions working the same tables will see
  each other's rows.
- **The dev server is the exception, and it is isolated deliberately**
  ([ADR-0018](../adr/0018-a-dev-server-is-reached-by-name-not-by-port.md)). `pnpm dev` runs through
  `portless`, which serves this worktree at `https://<branch>.web.recomencemos.localhost` on a port
  it picks. Read the URL off the banner it prints above Next's own, and use `portless list` rather
  than `lsof` to see what else is running — the route is named for the branch, so ownership is no
  longer something a session has to establish by PID. If the banner reports no proxy, the fix is
  [`docs/runbooks/portless-setup.md`](../runbooks/portless-setup.md), a one-time step a human runs;
  it is not a `--port` flag put back in `apps/web/package.json`.
- **The stash.** One stack, shared by every tree and every session. Prefer a WIP commit.

**Before starting, check the tree is not already mid-task** — `git status --short` in the main
checkout. Uncommitted work there belongs to somebody, and it is not yours to build on top of.

**Keep the worktree until the PR is merged or closed**, then remove it. `-D` rather than `-d` is
expected and is not a warning about lost work: `pr-merge-method` is rebase, and after a rebase-merge
`-d` refuses a branch whose commits are all upstream under different hashes.

```sh
git worktree remove .claude/worktrees/ticket+124-add-widget
git branch -D ticket/124-add-widget
```

**A Build session that discovers it is setting a convention stops and surfaces it before writing the
ADR.** The tell is scope: the decision would bind surfaces beyond this ticket — a form idiom eight
later screens will copy, an error envelope every action shares. Post the discovery as a comment on
the ticket (what the convention is, what it binds, why this ticket surfaced it) and wait for the
human's call: split it into its own `<type>/<slug>` PR, amend the spec, or proceed in-PR with the
reason recorded in the plan comment. The ADR stays `status: proposed` on every path — what the stop
buys is a review moment the convention gets on its own. ADR-0014 was adopted from inside story 1's
PR, where it competed for review attention with security-critical auth code in a diff already 5×
over the ceiling (#79 row 3); argued in the open is not the same as reviewed on its own terms.

**A ticket or brief may not sequence its work on another PR merging first.** The agent cannot merge
(`build-to-deploy-gate.sh`), so "land #63 before starting" is an instruction no Build session can
satisfy — it either stalls the ticket or gets silently ignored, and effort 0001 hit exactly that on
#55. A document the work depends on rides the ticket's own branch, or is referenced by its
default-branch path with a note that the reference resolves when both merge — and the PR body says
so, so the human merging knows the order that makes both links true.

### Stacked pull requests

Only when [`../policy/build.md`](../policy/build.md) sets `stacked-prs: yes`. While it is `UNSET`,
every ticket gets an independent PR based on the default branch, and the rest of this section does
not apply.

`/to-tickets` already emits what a stack needs: each ticket declares the tickets that **block** it,
and a chain of blocking edges is a stack. Publishing it as one lets a blocked ticket start before its
blocker merges while keeping one small PR per slice.

**A stack is a path; the ticket graph is a DAG.** Decompose before you publish:

- Walk the blocking edges and take each **maximal chain** — a run of tickets where each has exactly
  one blocker and at most one dependent. Each chain becomes one stack, in dependency order.
- A ticket with **two or more blockers** cannot sit above both. It ends the chains that reach it and
  stays serialized: it starts once its blockers have merged, on its own branch off the default.
- A ticket that **fans out** to several dependents ends its chain too; each dependent starts a new
  stack once it merges, or waits.
- Tickets with no edges at all are independent PRs. Do not stack them for tidiness — a stack asserts
  an ordering, and asserting one that does not exist makes the review worse.

The expand–contract sequence `/to-tickets` produces for a wide refactor is the canonical case: expand
→ migrate batches → contract is a single chain by construction, and `gh stack merge` is atomic up to
a chosen PR, which is exactly the "green is promised only at the integrate-and-verify ticket"
guarantee that skill describes.

```sh
gh stack init                     # start a stack targeting the default branch
gh stack add ticket/124-slug      # add the next ticket's branch on top
gh stack submit                   # push and create/update the PRs (--auto to skip the editor)
gh stack sync                     # after a lower PR changes — this is the tax
gh stack view                     # where am I
```

Two things to hold onto:

- **Rebase churn is the cost.** A review fix on a lower PR rebases everything above it. `gh stack
sync` does the mechanical part; `/resolving-merge-conflicts` is for when it does not.
- **`gh stack merge` is a merge**, so the gate refuses it to an agent exactly as it refuses
  `gh pr merge`. Stacks change how work is _published_, never who may ship it.

`gh stack` is the `github/gh-stack` extension at `v0.1.0` — `gh extension install github/gh-stack`.
Its version is one of the reasons `stacked-prs` is `UNSET` rather than `yes`.

## Triage operations

Used by `/triage`, which is vendored unmodified — these rules reach it the same way Build operations
reach `/implement`: through `CLAUDE.md` pointing here. They apply at step 3 (verify) and step 5
(promote) of that skill's loop.

**A verified bug names its class, and the brief answers "where else?".** Reproducing the reported
case scopes the fix to the level the reproduction happened to exercise, and that is how effort 0001
fixed "a record dropped whole loses its ids" at `err.context` (#52) while the same defect sat at
top-level `context` (#65) — same file, same mechanism, one level up. So before a bug brief is
posted, state the general class in one sentence ("a record-valued field outside the admit loops is
dropped whole") and sweep for its other instances. What the sweep finds is folded into the ticket
when it is the same fix, or filed as sibling findings when it is not; either way the brief records
that the sweep ran and where it looked. A brief that scopes to the reproduction alone is the
point-fix bias written down.

**Three post-merge fix tickets in one module is a churn trigger.** The fourth finding in the same
area is promoted as a **redesign ticket** — "make the mechanism one thing" — rather than another
patch, and any open point-fix in that area is folded into it instead of landing first (a fix inside
the old shape is one more loop for the redesign to unwind). Effort 0001's line-cap subsystem is the
worked example: five sequential patches (#48, #52, #53, #54, #55) each fixed the level its finding
exercised, and the residue is three admit loops whose seams are where #65 lived. Three is a working
default in the `build.md` sense — a project may move it, but `UNSET` it is not.

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (`gh api` on the sub-issues endpoint). Where sub-issues aren't enabled, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: GitHub's **native issue dependencies**, the canonical, UI-visible representation. Add an edge with `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, _not_ the `#number` or `node_id`). GitHub reports `issue_dependencies_summary.blocked_by` (open blockers only, the live gate). Where dependencies aren't available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the map's open children (`gh issue list --state open`, scoped to the map's sub-issues / task list), drop any with an open blocker (`issue_dependencies_summary.blocked_by > 0`, or an open issue in the `Blocked by` line) or an assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me`, the session's first write.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then append a context pointer (gist + link) to the map's Decisions-so-far.
