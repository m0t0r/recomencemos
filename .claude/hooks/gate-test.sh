#!/usr/bin/env bash
# Drive the repo's own gates with fixtures.
#
# Most of them are stage hooks, driven with PreToolUse payloads: all four run on
# every call, as Claude Code runs them, and deny wins. The later sections drive
# the two gates that are not hooks at all -- the dependency audit and migration
# integrity, both of which CI runs on every PR -- because they are the same kind
# of thing: repo logic deciding whether work may proceed, and so a test suite
# rather than a script somebody remembers to run.
set -uo pipefail

# Quiet on success, like every other test runner here. A hundred ok-lines scroll the
# rest of `pnpm test` off the screen, and Turborepo replays a cache hit's stdout
# verbatim, so the volume was paid on every run rather than only on a real one.
# Failures always print in full, with their section header. `-v` restores the
# whole enumeration for when you want to read what the suite actually covers.
VERBOSE=0
args=()
for a in "$@"; do
  case "$a" in
    -v | --verbose) VERBOSE=1 ;;
    --) ;; # pnpm forwards its own separator through to us
    *) args+=("$a") ;;
  esac
done
set -- "${args[@]+"${args[@]}"}"

HOOKS="$1"
# The audit gate lives outside .claude/, so reach the repo root from the hooks
# directory rather than from $PWD -- pnpm and turbo do not agree on the latter.
REPO=$(cd "$HOOKS/../.." && pwd)
PLAN="$HOOKS/plan-to-design-gate.sh"
BUILD="$HOOKS/design-to-build-gate.sh"
GUARD="$HOOKS/build-guard.sh"
SHIP="$HOOKS/build-to-deploy-gate.sh"
WT="$HOOKS/worktree-gate.sh"

ROOT=$(mktemp -d)
export CLAUDE_PROJECT_DIR="$ROOT"

mk() { mkdir -p "$ROOT/docs/efforts/$1"; }

mk 0001-good
cat > "$ROOT/docs/efforts/0001-good/intent.md" <<'EOF'
---
stage: intent
status: approved
issue: #10
---
## Open questions
- [x] **Q1** — answered.
EOF
cat > "$ROOT/docs/efforts/0001-good/spec.md" <<'EOF'
---
stage: spec
status: approved
issue: #11
intent: ./intent.md
---
## Flagged concerns
_No concerns raised._
EOF

mk 0002-draft
cat > "$ROOT/docs/efforts/0002-draft/intent.md" <<'EOF'
---
stage: intent
status: draft
issue: #20
---
## Open questions
- [ ] **Q1** — unresolved. **Blocks:** everything.
EOF
cat > "$ROOT/docs/efforts/0002-draft/spec.md" <<'EOF'
---
stage: spec
status: draft
issue: #21
intent: ./intent.md
---
## Flagged concerns
- [ ] **C1** — unresolved. **Owner:** Data lead.
EOF

mk 0003-openconcern
cat > "$ROOT/docs/efforts/0003-openconcern/intent.md" <<'EOF'
---
stage: intent
status: approved
issue: #30
---
EOF
cat > "$ROOT/docs/efforts/0003-openconcern/spec.md" <<'EOF'
---
stage: spec
status: approved # trailing comment must not break parsing
issue: #31
intent: ./intent.md
---
## Flagged concerns
- [ ] **C1** — unresolved. **Owner:** Security owner.
EOF

mk 0004-openq
cat > "$ROOT/docs/efforts/0004-openq/intent.md" <<'EOF'
---
stage: intent
status: approved
issue: #40
---
## Open questions
- [ ] **Q1** — still open.
EOF

# Rule H reads the install manifest. to-tickets is vendored; to-spec is forked
# and deliberately absent, which is what forking means.
cat > "$ROOT/skills-lock.json" <<'EOF'
{"version":1,"skills":{"to-tickets":{"source":"mattpocock/skills"},"tdd":{"source":"mattpocock/skills"}}}
EOF

# Rule J reads the journal sitting beside the file being written, so the fixture
# is a migration directory rather than a path pattern: `0000_init` is shipped and
# `0001_draft` is a .sql no journal names.
mkdir -p "$ROOT/drizzle/meta"
printf '%s\n' '{"version":"7","dialect":"postgresql","entries":[{"idx":0,"version":"7","when":1750000000000,"tag":"0000_init","breakpoints":true}]}' > "$ROOT/drizzle/meta/_journal.json"
printf '%s\n' 'CREATE TABLE "offer" ("id" uuid PRIMARY KEY);' > "$ROOT/drizzle/0000_init.sql"
mkdir -p "$ROOT/broken/meta"
printf '%s\n' 'entries: not json' > "$ROOT/broken/meta/_journal.json"

# Rule G reads the default branch from the remote. A real repo with a known one
# beats mocking git.
git -C "$ROOT" init -q -b main
git -C "$ROOT" symbolic-ref refs/remotes/origin/HEAD refs/remotes/origin/main
git -C "$ROOT" -c user.email=t@t -c user.name=t commit -q --allow-empty -m init

pass=0; fail=0
sec_name=""; sec_pass=0; sec_fail=0; sec_shown=0

# In quiet mode a clean section collapses to one line carrying its count, so the
# suite still reports what it covered rule by rule rather than a bare total.
flush_section() {
  [ -n "$sec_name" ] || return 0
  [ "$VERBOSE" = 1 ] && return 0
  if [ "$sec_fail" -eq 0 ]; then
    printf '  %-50s %2d passed\n' "$sec_name" "$sec_pass"
  else
    printf '  %-50s %2d passed  %d FAILED\n' "$sec_name" "$sec_pass" "$sec_fail"
  fi
}

section() {
  flush_section
  sec_name="$1"; sec_pass=0; sec_fail=0; sec_shown=0
  [ "$VERBOSE" = 1 ] && printf '== %s ==\n' "$sec_name"
  return 0
}

# A failure needs its header for context, and in quiet mode nothing has printed
# it yet. Print it once, on the first failure in the section.
show_header() {
  [ "$sec_shown" = 1 ] && return 0
  sec_shown=1
  [ "$VERBOSE" = 1 ] || printf '== %s ==\n' "$sec_name"
  return 0
}

run() { # name expect json
  local name="$1" expect="$2" json="$3" out decision="allow" o
  for gate in "$PLAN" "$BUILD" "$GUARD" "$SHIP"; do
    o=$(printf '%s' "$json" | bash "$gate" 2>&1)
    if [ -n "$o" ]; then
      out="$o"
      decision=$(printf '%s' "$o" | jq -r '.hookSpecificOutput.permissionDecision // "ERR"' 2>/dev/null || echo ERR)
      [ "$decision" = "deny" ] && break
    fi
  done
  if [ "$decision" = "$expect" ]; then
    pass=$((pass+1)); sec_pass=$((sec_pass+1))
    [ "$VERBOSE" = 1 ] && printf '  ok   %-51s -> %s\n' "$name" "$decision"
  else
    fail=$((fail+1)); sec_fail=$((sec_fail+1)); show_header
    printf '  FAIL %-51s -> %s (want %s)\n' "$name" "$decision" "$expect"
    printf '       %s\n' "${out:-<empty>}"
  fi
  return 0
}

bj() { jq -nc --arg c "$1" '{tool_name:"Bash",tool_input:{command:$c}}'; }
wj() { jq -nc --arg t "$1" --arg p "$2" --arg c "$3" '{tool_name:$t,tool_input:{file_path:$p,content:$c}}'; }

section "Bash: artifact writes must go through Write/Edit"
run "heredoc body merely mentions docs/efforts/x/spec.md" allow \
  "$(bj 'cat > .claude/hooks/x.sh <<EOF
# gates docs/efforts/NNNN/spec.md writes
EOF')"
run "grep over docs/efforts/x/intent.md"                  allow "$(bj 'grep -r status docs/efforts/0001-x/intent.md')"
run "redirect into spec.md"                               deny  "$(bj 'cat > docs/efforts/0001-x/spec.md <<EOF
hi
EOF')"
run "append into intent.md"                               deny  "$(bj 'echo hi >> docs/efforts/0001-x/intent.md')"
run "sed -i on spec.md"                                   deny  "$(bj "sed -i '' s/a/b/ docs/efforts/0001-x/spec.md")"
run "tee into intent.md"                                  deny  "$(bj 'echo x | tee docs/efforts/0001-x/intent.md')"
run "redirect with a relative ./ prefix"                  deny  "$(bj 'printf x > ./docs/efforts/0001-x/spec.md')"

# The publish protocol in docs/agents/issue-tracker.md puts a "Source of truth:"
# line naming the artifact inside an issue body. Every one of these is prose.
run "issue create, heredoc body naming the artifact"      allow "$(bj 'gh issue create --label ready-for-agent --title "Intent: t" --body-file - <<EOF
A summary.

> Source of truth: docs/efforts/0001-x/intent.md
EOF')"
run "issue comment carrying a pinned permalink"           allow "$(bj 'gh issue comment 12 --body "Revised: <https://gh/o/r/blob/abc/docs/efforts/0001-x/spec.md>"')"
run "blockquote in a quoted --body string"                allow "$(bj 'gh issue comment 7 --body "> Source of truth: docs/efforts/0001-x/spec.md"')"
run "arrow prose naming the artifact"                     allow "$(bj 'gh issue comment 5 --body "intent -> docs/efforts/0001-x/intent.md is the source"')"
run "HTML comment naming the artifact"                    allow "$(bj 'gh issue comment 7 --body "<!-- see docs/efforts/0001-x/spec.md -->"')"
run "git commit naming the artifact"                      allow "$(bj 'git commit -m "docs(effort): 0001 intent" -- docs/efforts/0001-x/intent.md')"
run "reading the artifact"                                allow "$(bj 'cat docs/efforts/0001-x/intent.md')"
run "heredoc into a scratch file naming the artifact"     allow "$(bj 'cat > /tmp/body.md <<EOF
Source of truth: docs/efforts/0001-x/intent.md
EOF')"

section "Rule E: sub-issues under a spec's issue"
run "parent 11 — approved, clean"                         allow "$(bj 'gh api --method POST repos/o/r/issues/11/sub_issues -F sub_issue_id=99')"
run "parent 21 — draft spec"                              deny  "$(bj 'gh api --method POST repos/o/r/issues/21/sub_issues -F sub_issue_id=99')"
run "parent 31 — approved, concern still open"            deny  "$(bj 'gh api --method POST repos/o/r/issues/31/sub_issues -F sub_issue_id=99')"
run "parent 77 — no spec claims it"                       allow "$(bj 'gh api --method POST repos/o/r/issues/77/sub_issues -F sub_issue_id=99')"
run "plain gh issue create"                               allow "$(bj 'gh issue create --title t --body b')"

section "Rule A: intent approval integrity"
run "intent set to approved"                              deny  "$(wj Write "$ROOT/docs/efforts/0009-n/intent.md" '---
stage: intent
status: approved
---')"
run "intent approved with trailing comment"               deny  "$(wj Edit "$ROOT/docs/efforts/0009-n/intent.md" 'status: approved # done')"
run "intent left draft"                                   allow "$(wj Write "$ROOT/docs/efforts/0009-n/intent.md" '---
stage: intent
status: draft
---')"

section "Rules B, C, D: spec writes"
OK='---
stage: spec
status: draft
issue:
intent: ./intent.md
---
## Flagged concerns
_No concerns raised._'
run "spec beside approved clean intent"                   allow "$(wj Write "$ROOT/docs/efforts/0001-good/spec.md" "$OK")"
run "spec set to approved by agent"                       deny  "$(wj Write "$ROOT/docs/efforts/0001-good/spec.md" '---
status: approved
---
## Flagged concerns')"
run "spec beside draft intent"                            deny  "$(wj Write "$ROOT/docs/efforts/0002-draft/spec.md" "$OK")"
run "spec beside approved intent w/ open question"        deny  "$(wj Write "$ROOT/docs/efforts/0004-openq/spec.md" "$OK")"
run "spec with no intent.md sibling"                      deny  "$(wj Write "$ROOT/docs/efforts/0099-none/spec.md" "$OK")"
run "spec missing Flagged concerns section"               deny  "$(wj Write "$ROOT/docs/efforts/0001-good/spec.md" '---
status: draft
---
## Problem Statement')"
run "Edit fragment on a spec"                             allow "$(wj Edit "$ROOT/docs/efforts/0001-good/spec.md" 'some prose edit')"

section "Rule F: the agent may not approve or merge"
run "gh pr create"                                        allow "$(bj 'gh pr create --title x --body y')"
run "gh pr merge"                                         deny  "$(bj 'gh pr merge 5 --squash')"
run "gh stack merge"                                      deny  "$(bj 'gh stack merge 3')"
run "gh pr review --approve"                              deny  "$(bj 'gh pr review 5 --approve')"
run "gh pr review --comment"                              allow "$(bj 'gh pr review 5 --comment --body findings')"
run "gh pr merge inside a heredoc body"                   allow "$(bj 'cat > x.md <<EOF
do not run gh pr merge yourself
EOF')"

run "gh pr merge in a heredoc, at line start"              allow "$(bj "git commit -F - <<EOF
gh pr ""merge is what the gate refuses
EOF")"
run "an approving review in a heredoc, at line start"     allow "$(bj "git commit -F - <<EOF
gh pr ""review --approve is what the gate refuses
EOF")"
run "the approving flag elsewhere in the script"          allow "$(bj 'gh pr review 5 --comment --body x && echo "--approve is for humans"')"
run "an approving review for real"                        deny  "$(bj "gh pr revi""ew 5 --comment --body x; gh pr revi""ew --approve 6")"
run "push to main inside a heredoc"                       allow "$(bj "git commit -F - <<EOF
git ""push origin main is refused by rule G
EOF")"

section "Rule G: no direct push to the default branch"
run "push origin main"                                    deny  "$(bj 'git push origin main')"
run "push HEAD:main"                                      deny  "$(bj 'git push origin HEAD:main')"
run "push a ticket branch"                                allow "$(bj 'git push -u origin ticket/12-add-widget')"
run "bare push while on main"                             deny  "$(bj 'git push')"

git -C "$ROOT" checkout -q -b ticket/12-add-widget
run "bare push while on a ticket branch"                  allow "$(bj 'git push')"
run "push origin main from a ticket branch"               deny  "$(bj 'git push origin main')"

section "Rule H: vendored skills, advisories, the lockfile"
run "edit a vendored skill (in the lock)"                  deny  "$(wj Write "$ROOT/.agents/skills/to-tickets/SKILL.md" 'x')"
run "edit a forked skill (absent from the lock)"           allow "$(wj Write "$ROOT/.agents/skills/to-spec/SKILL.md" 'x')"
run "edit impeccable (vendored, never in the lock)"        deny  "$(wj Edit "$ROOT/.claude/skills/impeccable/SKILL.md" 'x')"
run "edit a committed advisory"                            deny  "$(wj Write "$ROOT/docs/efforts/0001-good/advisories/security.md" 'x')"
run "hand-edit pnpm-lock.yaml"                             deny  "$(wj Edit "$ROOT/pnpm-lock.yaml" 'x')"
run "ordinary source file"                                 allow "$(wj Write "$ROOT/apps/web/app/thing.ts" 'export const a = 1;')"

section "Rule I: credentials"
run "an AWS access key id"                                 deny  "$(wj Write "$ROOT/apps/web/a.ts" "const k = \"AK""IAABCDEFGHIJKLMNOP\";")"
run "a private key block"                                  deny  "$(wj Write "$ROOT/apps/web/b.ts" "-----BEGIN RSA PRIV""ATE KEY-----")"
run "a GitHub token"                                       deny  "$(wj Write "$ROOT/apps/web/c.ts" "const t = \"gh""p_0123456789abcdefghijklmnopqrstuvwxyz\";")"
run "prose about passwords"                                allow "$(wj Write "$ROOT/apps/web/d.ts" 'export const passwordFieldLabel = "Password";')"

section "Rule J: a journaled migration is never hand-edited"
run "Write to a migration the journal names"               deny  "$(wj Write "$ROOT/drizzle/0000_init.sql" 'DROP TABLE "offer";')"
run "Edit to a migration the journal names"                deny  "$(wj Edit "$ROOT/drizzle/0000_init.sql" 'ALTER TABLE "offer" DROP COLUMN "note";')"
run "Write to a .sql no journal names"                     allow "$(wj Write "$ROOT/drizzle/0001_draft.sql" 'CREATE TABLE "x" ("id" uuid);')"
run "Write to a .sql outside any migration directory"      allow "$(wj Write "$ROOT/scripts/report.sql" 'SELECT 1;')"
run "Write to a .sql beside an unreadable journal"         deny  "$(wj Write "$ROOT/broken/0000_init.sql" 'SELECT 1;')"
run "an ADR quoting the destructive list"                  allow "$(wj Write "$ROOT/docs/adr/0013-x.md" 'DROP TABLE, DROP COLUMN, DROP CONSTRAINT and any RENAME.')"

section "unrelated paths"
run "ordinary source file saying status: approved"        allow "$(wj Write "$ROOT/apps/web/app/page.tsx" 'status: approved')"

# Rule K gets its own fixtures and its own runner, and both are deliberate.
#
# Its question is "which checkout is this command about", so a shared payload
# shape cannot ask it: every case needs a `cwd`, and the interesting ones need two
# real checkouts of one repository that disagree about the branch. `run_mig` and
# `run_ident` set the precedent for a gate-specific runner.
#
# It is also NOT added to run(). That runner drives every gate over one fixture on
# one branch, and four of its existing cases are `git commit -F - <<EOF` written
# to prove that rules F and G read a commit MESSAGE as prose -- with the fixture
# sitting on its default branch, which is precisely what rule K refuses. Both
# behaviours are right; they just cannot share a fixture.
WTMAIN="$ROOT/wt/main"
WTREE="$ROOT/wt/tree"
WTALT="$ROOT/wt/alt"
mkdir -p "$ROOT/wt" "$ROOT/wt/plain"

# The default branch is read from the remote, so the fixture that matters most is
# one whose default is NOT the name a hardcoded guess would pick.
git -C "$ROOT" init -q "$WTMAIN" -b dev
git -C "$WTMAIN" symbolic-ref refs/remotes/origin/HEAD refs/remotes/origin/dev
git -C "$WTMAIN" -c user.email=t@t -c user.name=t commit -q --allow-empty -m init
git -C "$WTMAIN" worktree add -q "$WTREE" -b ticket/12-add-widget

# A second repository, default `main`, to prove the name comes from the remote in
# both directions rather than from this repo's own answer.
git -C "$ROOT" init -q "$WTALT" -b main
git -C "$WTALT" symbolic-ref refs/remotes/origin/HEAD refs/remotes/origin/main
git -C "$WTALT" -c user.email=t@t -c user.name=t commit -q --allow-empty -m init

wtj() { jq -nc --arg c "$1" --arg d "$2" '{tool_name:"Bash",cwd:$d,tool_input:{command:$c}}'; }

run_wt() { # name expect json [project-dir]
  local name="$1" expect="$2" json="$3" pdir="${4:-$CLAUDE_PROJECT_DIR}" out decision="allow"
  out=$(printf '%s' "$json" | CLAUDE_PROJECT_DIR="$pdir" bash "$WT" 2>&1)
  [ -n "$out" ] && decision=$(printf '%s' "$out" | jq -r '.hookSpecificOutput.permissionDecision // "ERR"' 2>/dev/null || echo ERR)
  if [ "$decision" = "$expect" ]; then
    pass=$((pass+1)); sec_pass=$((sec_pass+1))
    [ "$VERBOSE" = 1 ] && printf '  ok   %-51s -> %s\n' "$name" "$decision"
  else
    fail=$((fail+1)); sec_fail=$((sec_fail+1)); show_header
    printf '  FAIL %-51s -> %s (want %s)\n' "$name" "$decision" "$expect"
    printf '       %s\n' "${out:-<empty>}"
  fi
  return 0
}

section "Rule K: no commit on the default branch"
run_wt "git commit on the default branch"                 deny  "$(wtj 'git commit -m x' "$WTMAIN")"
run_wt "git commit -am on the default branch"             deny  "$(wtj 'git commit -am x' "$WTMAIN")"
run_wt "git commit --amend on the default branch"         deny  "$(wtj 'git commit --amend --no-edit' "$WTMAIN")"
run_wt "git cherry-pick on the default branch"            deny  "$(wtj 'git cherry-pick 0123abc' "$WTMAIN")"
run_wt "git revert on the default branch"                 deny  "$(wtj 'git revert 0123abc' "$WTMAIN")"
run_wt "git am on the default branch"                     deny  "$(wtj 'git am patch.mbox' "$WTMAIN")"
run_wt "a commit after && on the default branch"          deny  "$(wtj 'git add -A && git commit -m x' "$WTMAIN")"
run_wt "a commit in a subshell on the default branch"     deny  "$(wtj '(git commit -m x)' "$WTMAIN")"
run_wt "git -c k=v commit on the default branch"          deny  "$(wtj 'git -c user.name=t commit -m x' "$WTMAIN")"

# The case the whole gate exists to allow.
run_wt "git commit from a worktree of the same repo"      allow "$(wtj 'git commit -m x' "$WTREE")"
run_wt "a commit after && from a worktree"                allow "$(wtj 'git add -A && git commit -m x' "$WTREE")"

# And the case that pins WHY the gate reads the payload rather than the
# environment. CLAUDE_PROJECT_DIR keeps naming the checkout the session launched
# from -- the main one, on the default branch -- for the whole life of a worktree
# session. A gate reading it would refuse every commit from every worktree, which
# is the exact inverse of what it is for. This case forces that arrangement: the
# variable on the default branch, the payload in the worktree.
run_wt "the worktree case with the env on the default"    allow "$(wtj 'git commit -m x' "$WTREE")" "$WTMAIN"
run_wt "the default-branch case with the env in a tree"   deny  "$(wtj 'git commit -m x' "$WTMAIN")" "$WTREE"

section "Rule K: the checkout the command is about"
run_wt "git -C at the default branch, from a worktree"    deny  "$(wtj "git -C $WTMAIN commit -m x" "$WTREE")"
run_wt "git -C at a worktree, from the default branch"    allow "$(wtj "git -C $WTREE commit -m x" "$WTMAIN")"
run_wt "an attached -C at the default branch"             deny  "$(wtj "git -C$WTMAIN commit -m x" "$WTREE")"
run_wt "a relative -C resolved against the payload cwd"   deny  "$(wtj 'git -C ../main commit -m x' "$WTREE")"
run_wt "a second repo, default main, on main"             deny  "$(wtj 'git commit -m x' "$WTALT")"

git -C "$WTALT" checkout -q -b ticket/13-other
run_wt "a second repo, default main, on a ticket branch"  allow "$(wtj 'git commit -m x' "$WTALT")"

section "Rule K: what it must not refuse"
run_wt "git status on the default branch"                 allow "$(wtj 'git status --short' "$WTMAIN")"
run_wt "git pull on the default branch"                   allow "$(wtj 'git pull --ff-only' "$WTMAIN")"
run_wt "git push on the default branch"                   allow "$(wtj 'git push' "$WTMAIN")"
run_wt "git log on the default branch"                    allow "$(wtj 'git log --oneline -5' "$WTMAIN")"
run_wt "git commit-graph write on the default branch"     allow "$(wtj 'git commit-graph write' "$WTMAIN")"
run_wt "a command that merely contains the word commit"   allow "$(wtj 'grep -rn "git commit" docs/' "$WTMAIN")"
run_wt "a commit message that names the refused act"      allow "$(wtj 'gh issue comment 5 --body "run git commit on a branch"' "$WTMAIN")"
run_wt "the act named inside a heredoc body"              allow "$(wtj 'gh issue create --body-file - <<EOF
git commit on dev is what the gate refuses
EOF' "$WTMAIN")"
run_wt "a commit outside any repository"                  allow "$(wtj 'git commit -m x' "$ROOT/wt/plain")"

git -C "$WTMAIN" checkout -q --detach
run_wt "a commit on a detached HEAD"                      allow "$(wtj 'git commit -m x' "$WTMAIN")"
git -C "$WTMAIN" checkout -q dev

# The dependency audit is not a hook, but it is the same kind of thing: repo
# logic deciding whether work may proceed. Its fixture repository is built here
# in four shapes, because the way this gate fails open is by failing to read a
# workspace file and then counting only the root manifest as direct.
AUDIT="$REPO/scripts/audit-direct.mjs"

mkaudit() { # dir packages-block
  local dir="$1"
  mkdir -p "$dir/packages/thing" "$dir/apps/app"
  printf '%s' "$2" > "$dir/pnpm-workspace.yaml"
  printf '%s\n' '{"name":"root","devDependencies":{"turbo":"^2.10.11"}}' > "$dir/package.json"
  printf '%s\n' '{"name":"thing","dependencies":{"next":"16.3.2"}}' > "$dir/packages/thing/package.json"
  printf '%s\n' '{"name":"app","devDependencies":{"vitest":"^4"}}' > "$dir/apps/app/package.json"
}

AR="$ROOT/audit-block"
mkaudit "$AR" 'packages:
  - "apps/*"
  - "packages/*"
'
# Flow style, and a block interrupted by a blank line and a comment: both are
# valid YAML this gate used to read as "no workspaces", which made a workspace
# dependency look transitive and exit 0.
AR_FLOW="$ROOT/audit-flow"
mkaudit "$AR_FLOW" 'packages: ["apps/*", "packages/*"]
'
AR_GAPS="$ROOT/audit-gaps"
mkaudit "$AR_GAPS" 'packages:
  # the app
  - "apps/*"

  - "packages/*"

publicHoistPattern:
  - "next"
'
AR_BROKEN="$ROOT/audit-broken"
mkaudit "$AR_BROKEN" 'engineStrict: true
'

# One advisory, parameterised by the two fields the gate actually reads.
adv() { jq -nc --arg m "$1" --arg s "$2" \
  '{advisories:{"1":{module_name:$m,severity:$s,title:"fixture",vulnerable_versions:"<1",patched_versions:">=1",url:"https://example.test"}}}'; }

# Exit code *and* a line of output, because a script that crashed on every input
# would exit 1 and pass every blocking case on the code alone.
run_audit() { # name expect-exit expect-grep root json
  local name="$1" expect="$2" want="$3" dir="$4" json="$5" out code
  printf '%s' "$json" > "$ROOT/audit-input.json"
  out=$(node "$AUDIT" --root "$dir" --input "$ROOT/audit-input.json" 2>&1)
  code=$?
  if [ "$code" = "$expect" ] && printf '%s' "$out" | grep -qE "$want"; then
    pass=$((pass+1)); sec_pass=$((sec_pass+1))
    [ "$VERBOSE" = 1 ] && printf '  ok   %-51s -> exit %s\n' "$name" "$code"
  else
    fail=$((fail+1)); sec_fail=$((sec_fail+1)); show_header
    printf '  FAIL %-51s -> exit %s (want %s matching /%s/)\n' "$name" "$code" "$expect" "$want"
    printf '       %s\n' "${out:-<empty>}"
  fi
  return 0
}

section "Dependency audit: high or above, direct only"
run_audit "high in a dependency of a workspace"           1 "^BLOCKING .*next"     "$AR"        "$(adv next high)"
run_audit "critical in a dependency of a workspace"       1 "^BLOCKING .*critical" "$AR"        "$(adv next critical)"
run_audit "high in a root devDependency"                  1 "^BLOCKING .*turbo"    "$AR"        "$(adv turbo high)"
run_audit "high in a workspace devDependency"             1 "^BLOCKING .*vitest"   "$AR"        "$(adv vitest high)"
run_audit "high with no direct path at all"               0 "^transitive .*postcss" "$AR"       "$(adv postcss high)"
run_audit "moderate in a direct dependency"               0 "passed: 0 blocking"   "$AR"        "$(adv next moderate)"
run_audit "low in a direct dependency"                    0 "passed: 0 blocking"   "$AR"        "$(adv next low)"
run_audit "nothing found"                                 0 "passed: 0 blocking"   "$AR"        '{"advisories":{}}'

section "Dependency audit: the ways it must not fail open"
run_audit "flow-style packages: still finds the workspace" 1 "^BLOCKING .*next"    "$AR_FLOW"   "$(adv next high)"
run_audit "comments and blank lines inside the block"      1 "^BLOCKING .*next"    "$AR_GAPS"   "$(adv next high)"
run_audit "a workspace file with no packages: key"         2 "could not run"       "$AR_BROKEN" "$(adv next high)"
run_audit "an audit payload that is not an audit"          2 "could not run"       "$AR"        '{"error":"registry unreachable"}'
run_audit "an audit payload that is not JSON"              2 "not JSON"            "$AR"        'upstream said no'


# The reporting half of the same pair. It shares `audit-lib.mjs` with the gate
# above, so these reuse that gate's fixtures deliberately: if the two ever
# disagreed about which dependency is direct, these cases and those would have to
# disagree too, which is the whole reason the reading lives in one file.
REPORT="$REPO/scripts/audit-report.mjs"

run_report() { # name expect-exit expect-grep root json
  local name="$1" expect="$2" want="$3" dir="$4" json="$5" out code
  printf '%s' "$json" > "$ROOT/audit-input.json"
  out=$(node "$REPORT" --root "$dir" --input "$ROOT/audit-input.json" 2>&1)
  code=$?
  if [ "$code" = "$expect" ] && printf '%s' "$out" | grep -qE "$want"; then
    pass=$((pass+1)); sec_pass=$((sec_pass+1))
    [ "$VERBOSE" = 1 ] && printf '  ok   %-51s -> exit %s\n' "$name" "$code"
  else
    fail=$((fail+1)); sec_fail=$((sec_fail+1)); show_header
    printf '  FAIL %-51s -> exit %s (want %s matching /%s/)\n' "$name" "$code" "$expect" "$want"
    printf '       %s\n' "${out:-<empty>}"
  fi
  return 0
}

# Two advisories in one payload, parameterised so the same pair can be fed in
# either order. That is what the fingerprint stability case needs.
advs() { jq -nc --arg m1 "$1" --arg s1 "$2" --arg m2 "$3" --arg s2 "$4" \
  '{advisories:{
     "1":{module_name:$m1,severity:$s1,title:"one",vulnerable_versions:("<"+$m1),patched_versions:">=1",url:"https://example.test/1"},
     "2":{module_name:$m2,severity:$s2,title:"two",vulnerable_versions:("<"+$m2),patched_versions:">=2",url:"https://example.test/2"}}}'; }

# The fingerprint of one ordering, read back out of the report itself, so the
# case below asserts against what the script actually produces rather than
# against a hash restated here that could drift from it.
fingerprint_of() { # json
  printf '%s' "$1" > "$ROOT/audit-fp.json"
  node "$REPORT" --root "$AR" --input "$ROOT/audit-fp.json" 2>/dev/null \
    | sed -n 's/.*audit-fingerprint: \([0-9a-f]*\).*/\1/p'
}
FP_ONE=$(fingerprint_of "$(advs next high postcss moderate)")

section "Dependency report: what reaches a person"
run_report "a transitive high the blocking gate lets past"  1 "postcss.*transitively"  "$AR" "$(adv postcss high)"
run_report "a transitive moderate, below the blocking bar"  1 "moderate"               "$AR" "$(adv postcss moderate)"
run_report "a direct high says every PR is already red"     1 "already failing"        "$AR" "$(adv next high)"
run_report "a direct moderate does not claim CI is red"     1 "None of these blocks"   "$AR" "$(adv next moderate)"
run_report "a direct dependency is named as direct"         1 "next.*directly"         "$AR" "$(adv next high)"
run_report "a critical is reported, not just high"          1 "critical"               "$AR" "$(adv next critical)"
run_report "low is below the reporting threshold"           0 "nothing at moderate"    "$AR" "$(adv next low)"
run_report "info is below it too"                           0 "nothing at moderate"    "$AR" "$(adv next info)"
run_report "nothing found at all"                           0 "nothing at moderate"    "$AR" '{"advisories":{}}'

# The workflow says nothing when the fingerprint is unchanged, so a fingerprint
# that moved on its own would post a comment a day about an unchanged finding,
# and one that never moved would hide a genuinely new advisory.
section "Dependency report: the fingerprint the workflow deduplicates on"
run_report "a finding carries one"                          1 "audit-fingerprint: [0-9a-f]{16}" "$AR" "$(adv next high)"
run_report "the same set in the other order hashes alike"   1 "audit-fingerprint: $FP_ONE"      "$AR" "$(advs postcss moderate next high)"

# Inequality, which no `grep -E` pattern can express: POSIX ERE has no negative
# lookahead, so this compares the two values instead of matching one.
fp_differs() { # name other-json
  local name="$1" other; other=$(fingerprint_of "$2")
  if [ -n "$other" ] && [ "$other" != "$FP_ONE" ]; then
    pass=$((pass+1)); sec_pass=$((sec_pass+1))
    [ "$VERBOSE" = 1 ] && printf '  ok   %-51s -> %s\n' "$name" "$other"
  else
    fail=$((fail+1)); sec_fail=$((sec_fail+1)); show_header
    printf '  FAIL %-51s -> %s (want a value, differing from %s)\n' "$name" "${other:-<none>}" "$FP_ONE"
  fi
  return 0
}

fp_differs "a changed severity is a different finding"     "$(advs next critical postcss moderate)"
fp_differs "a changed package is a different finding"      "$(advs turbo high postcss moderate)"

section "Dependency report: the ways it must not fail open"
run_report "a workspace file with no packages: key"         2 "could not run" "$AR_BROKEN" "$(adv next high)"
run_report "an audit payload that is not an audit"          2 "could not run" "$AR"        '{"error":"registry unreachable"}'
run_report "an audit payload that is not JSON"              2 "not JSON"      "$AR"        'upstream said no'


# The migration-integrity gate is the second non-hook here, and for the same
# reason as the audit above: repo logic deciding whether work may proceed.
#
# Its fixtures are real git repositories rather than mocks, because the gate's
# entire frame is `git merge-base <default branch> HEAD` -- there is nothing left
# to mock that would still be the thing under test. Each fixture commits a base
# state, points refs/remotes/origin/main at it, branches, and leaves the change
# in the working tree, which is also how a developer meets this gate before
# committing anything.
MIG="$REPO/scripts/migration-integrity.mjs"

# A Drizzle journal naming the given tags in order. `when` is derived from the
# index rather than read from a clock, so a fixture reads the same on every run.
journal() {
  local idx=0 sep="" out='{"version":"7","dialect":"postgresql","entries":['
  for tag in "$@"; do
    out="$out$sep{\"idx\":$idx,\"version\":\"7\",\"when\":$((1750000000000 + idx)),\"tag\":\"$tag\",\"breakpoints\":true}"
    idx=$((idx + 1)); sep=","
  done
  printf '%s]}' "$out"
}

mig_repo() { # name -> path
  local dir="$ROOT/mig-$1"
  mkdir -p "$dir/drizzle/meta"
  git -C "$dir" init -q -b main
  git -C "$dir" symbolic-ref refs/remotes/origin/HEAD refs/remotes/origin/main
  printf '%s' "$dir"
}

mig_ship() { # dir -- freeze the current state as what the default branch holds
  git -C "$1" add -A >/dev/null 2>&1
  git -C "$1" -c user.email=t@t -c user.name=t commit -q -m base >/dev/null 2>&1
  git -C "$1" update-ref refs/remotes/origin/main HEAD
  git -C "$1" checkout -q -B ticket/1-work
}

mig_start() { # name -> a repo with 0000_init already on the default branch
  local d
  d=$(mig_repo "$1")
  printf '%s\n' 'CREATE TABLE "offer" ("id" uuid PRIMARY KEY);' > "$d/drizzle/0000_init.sql"
  journal 0000_init > "$d/drizzle/meta/_journal.json"
  mig_ship "$d"
  printf '%s' "$d"
}

mig_seeded() { # name sql -> a repo whose shipped 0000_init carries that SQL
  local d
  d=$(mig_repo "$1")
  printf '%s\n' "$2" > "$d/drizzle/0000_init.sql"
  journal 0000_init > "$d/drizzle/meta/_journal.json"
  mig_ship "$d"
  printf '%s' "$d"
}

mig_add() { # dir tag sql-line... -- add a migration on the branch
  local dir="$1" tag="$2"
  shift 2
  printf '%s\n' "$@" > "$dir/drizzle/$tag.sql"
  journal 0000_init "$tag" > "$dir/drizzle/meta/_journal.json"
}

# `@repo/domain` does not exist yet, so the gate finds it by manifest name rather
# than by a path that would go stale silently. The fixture is the same shape.
mig_domain() { # dir
  mkdir -p "$1/packages/domain/src"
  printf '%s\n' '{"name":"@repo/domain","version":"0.0.0"}' > "$1/packages/domain/package.json"
  printf '%s\n' 'export const listOffers = () => [];' > "$1/packages/domain/src/offers.ts"
  printf '%s\n' 'export const schema = {};' > "$1/packages/domain/src/schema.ts"
  printf '%s\n' 'export const canAccept = () => true;' > "$1/packages/domain/src/policy.ts"
}

# Exit code *and* a line of output, for the reason run_audit gives: a script that
# crashed on every input would exit non-zero and pass every refusing case on the
# code alone.
# GITHUB_BASE_REF is unset for every case. CI sets it on a pull_request event, and
# the gate reads it ahead of origin/HEAD -- correctly, for the repository CI
# checked out, and disastrously for a fixture, which is a different repository
# with no such ref. Thirty-five cases went red on the first CI run for exactly
# this: ambient environment reaching a fixture that is supposed to be sealed.
# The one case that wants it sets it explicitly.
run_mig() { # name expect-exit expect-grep root
  local name="$1" expect="$2" want="$3" dir="$4" out code
  out=$(env -u GITHUB_BASE_REF node "$MIG" --root "$dir" 2>&1)
  code=$?
  if [ "$code" = "$expect" ] && printf '%s' "$out" | grep -qE "$want"; then
    pass=$((pass+1)); sec_pass=$((sec_pass+1))
    [ "$VERBOSE" = 1 ] && printf '  ok   %-51s -> exit %s\n' "$name" "$code"
  else
    fail=$((fail+1)); sec_fail=$((sec_fail+1)); show_header
    printf '  FAIL %-51s -> exit %s (want %s matching /%s/)\n' "$name" "$code" "$expect" "$want"
    printf '       %s\n' "${out:-<empty>}"
  fi
  return 0
}

section "Migration integrity: the journal is append-only"

D=$(mig_start append)
mig_add "$D" 0001_add_note 'ALTER TABLE "offer" ADD COLUMN "note" text;'
run_mig "an appended entry"                               0 "^Migration integrity passed" "$D"

D=$(mig_start removed)
journal > "$D/drizzle/meta/_journal.json"
run_mig "a committed entry removed"                       1 "append-only"                 "$D"

D=$(mig_start reordered)
mig_add "$D" 0001_add_note 'ALTER TABLE "offer" ADD COLUMN "note" text;'
journal 0001_add_note 0000_init > "$D/drizzle/meta/_journal.json"
run_mig "two entries swapped"                             1 "append-only"                 "$D"

D=$(mig_start retagged)
journal 0000_renamed > "$D/drizzle/meta/_journal.json"
run_mig "a committed tag rewritten"                       1 "append-only"                 "$D"

D=$(mig_start rewhen)
printf '%s\n' '{"version":"7","dialect":"postgresql","entries":[{"idx":0,"version":"7","when":1,"tag":"0000_init","breakpoints":true}]}' > "$D/drizzle/meta/_journal.json"
run_mig "a committed \`when\` rewritten"                   1 "append-only"                 "$D"

section "Migration integrity: a shipped migration is immutable"

D=$(mig_start edited)
printf '%s\n' 'CREATE TABLE "offer" ("id" uuid PRIMARY KEY, "note" text);' > "$D/drizzle/0000_init.sql"
run_mig "a shipped migration edited"                      1 "immutable"                   "$D"

D=$(mig_start deleted)
rm "$D/drizzle/0000_init.sql"
run_mig "a shipped migration deleted"                     1 "immutable"                   "$D"

# Immutability begins at the merge base. A migration this branch added is still
# the branch's to rewrite -- refusing that would make the gate unsatisfiable
# during the very session that generates the file.
D=$(mig_start reworked)
mig_add "$D" 0001_add_note 'ALTER TABLE "offer" ADD COLUMN "note" text;'
mig_add "$D" 0001_add_note 'ALTER TABLE "offer" ADD COLUMN "note" varchar(500);'
run_mig "a migration this branch added, reworked"         0 "^Migration integrity passed" "$D"

section "Migration integrity: a destructive statement travels alone"

D=$(mig_start mixed)
mig_add "$D" 0001_tidy 'ALTER TABLE "offer" ADD COLUMN "note" text;' 'ALTER TABLE "offer" DROP COLUMN "memo";'
run_mig "a drop sharing a migration with an add"          1 "travels alone"               "$D"

D=$(mig_start unmarked)
mig_add "$D" 0001_tidy 'ALTER TABLE "offer" DROP COLUMN "memo";'
run_mig "a drop alone, but the name does not say so"      1 "marker"                      "$D"

D=$(mig_start marked)
mig_add "$D" 0001_contract_drop_memo 'ALTER TABLE "offer" DROP COLUMN "memo";'
run_mig "a drop alone, in a migration named for it"       0 "^Migration integrity passed" "$D"

D=$(mig_start droptable)
mig_add "$D" 0001_contract_drop_draft 'DROP TABLE "draft";' 'ALTER TABLE "offer" DROP CONSTRAINT "offer_draft_fk";'
run_mig "two destructive statements together"             0 "^Migration integrity passed" "$D"

D=$(mig_start notnull)
mig_add "$D" 0001_tighten 'CREATE INDEX "offer_idx" ON "offer" ("id");' 'ALTER TABLE "offer" ALTER COLUMN "note" SET NOT NULL;'
run_mig "SET NOT NULL sharing a migration with an index"  1 "travels alone"               "$D"

D=$(mig_start coltype)
mig_add "$D" 0001_widen 'ALTER TABLE "offer" ALTER COLUMN "note" SET DATA TYPE varchar(500);' 'CREATE INDEX "offer_idx" ON "offer" ("id");'
run_mig "a column retype sharing a migration"             1 "travels alone"               "$D"

D=$(mig_start renamed)
mig_add "$D" 0001_contract_rename_note 'ALTER TABLE "offer" RENAME COLUMN "note" TO "terms";'
run_mig "a rename alone, marked"                          0 "^Migration integrity passed" "$D"

section "Migration integrity: a CHECK re-created under its own name is a widening"

# DD2 makes an enum-shaped column `TEXT` with a `CHECK (col IN (...))` so that
# widening the set is a constraint change — and Postgres offers exactly one way to
# widen one, which is to drop it and add it back. Before #17 that made every such
# widening unsatisfiable: rule 3 refused the pair and rule 4 kept the marked
# migration out of any PR touching a query module, which is every PR that needs the
# new member.
#
# **The carve-out reads two things, and a security review is why it reads the
# second.** The same migration must add a `CHECK` back under the dropped name, and
# an *earlier* migration must have declared that name a check. `DROP CONSTRAINT`
# does not say what kind it removes, so the first condition alone exempted dropping
# a `UNIQUE` and putting a check back under its name. The fixtures below therefore
# seed a history: `mig_seeded` ships an `0000_init` that says what the constraint
# was, which is the fact the gate is now consulting.

CHECK_HISTORY='CREATE TABLE "session" ("sign_in_method" text NOT NULL, CONSTRAINT "session_method_known" CHECK ("sign_in_method" IN ('"'a'"')));'
UNIQUE_HISTORY='CREATE TABLE "user" ("email" text NOT NULL, CONSTRAINT "user_email_unique" UNIQUE("email"));'

D=$(mig_seeded checkwiden "$CHECK_HISTORY")
mig_add "$D" 0001_admin_methods \
  'ALTER TABLE "session" DROP CONSTRAINT "session_method_known";' \
  'ALTER TABLE "user" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;' \
  'ALTER TABLE "session" ADD CONSTRAINT "session_method_known" CHECK ("sign_in_method" IN ('"'a'"', '"'b'"'));'
run_mig "a CHECK dropped and re-added under one name"     0 "^Migration integrity passed" "$D"

# The `IF EXISTS` spelling is the one a hand-written migration reaches for, and it
# must land on the same side as the generated one.
D=$(mig_seeded checkwidenifexists "$CHECK_HISTORY")
mig_add "$D" 0001_admin_methods \
  'ALTER TABLE "session" DROP CONSTRAINT IF EXISTS "session_method_known";' \
  'ALTER TABLE "session" ADD CONSTRAINT "session_method_known" CHECK ("sign_in_method" IN ('"'a'"'));'
run_mig "a CHECK re-added after DROP CONSTRAINT IF EXISTS" 0 "^Migration integrity passed" "$D"

# **The case the security review found.** The name was a `UNIQUE`, and putting a
# check back under it is the removal of a uniqueness guarantee wearing the shape of
# a widening — on `user.email` that is what stops one person holding two Accounts
# by capitalising. It must refuse, and it must refuse because the history says the
# name was never a check.
D=$(mig_seeded uniquedroppedaschecked "$UNIQUE_HISTORY")
mig_add "$D" 0001_swap \
  'ALTER TABLE "user" DROP CONSTRAINT "user_email_unique";' \
  'ALTER TABLE "user" ADD CONSTRAINT "user_email_unique" CHECK (true);'
run_mig "a UNIQUE dropped and re-added as a CHECK"        1 "travels alone"               "$D"

# A name no migration has ever declared at all is the same answer for the same
# reason — the gate fails closed rather than assuming.
D=$(mig_seeded checkunknownname "$CHECK_HISTORY")
mig_add "$D" 0001_swap \
  'ALTER TABLE "session" DROP CONSTRAINT "session_never_declared";' \
  'ALTER TABLE "session" ADD CONSTRAINT "session_never_declared" CHECK (true);'
run_mig "a drop of a name the history never declared"     1 "travels alone"               "$D"

# The three cases the carve-out must decline even with a genuine check history,
# because each is a different act than widening a predicate.

D=$(mig_seeded checkdroponly "$CHECK_HISTORY")
mig_add "$D" 0001_loosen \
  'ALTER TABLE "session" DROP CONSTRAINT "session_method_known";' \
  'ALTER TABLE "user" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;'
run_mig "a CHECK dropped and never added back"            1 "travels alone"               "$D"

D=$(mig_seeded checkothername "$CHECK_HISTORY")
mig_add "$D" 0001_swap \
  'ALTER TABLE "session" DROP CONSTRAINT "session_method_known";' \
  'ALTER TABLE "session" ADD CONSTRAINT "session_other_known" CHECK ("sign_in_method" IN ('"'a'"'));'
run_mig "a different constraint added in its place"       1 "travels alone"               "$D"

# Re-adding as UNIQUE is not the same act: the drop takes an index with it, and a
# narrower unique can fail against rows that already exist.
D=$(mig_seeded checkreaddunique "$CHECK_HISTORY")
mig_add "$D" 0001_swap \
  'ALTER TABLE "session" DROP CONSTRAINT "session_method_known";' \
  'ALTER TABLE "session" ADD CONSTRAINT "session_method_known" UNIQUE ("sign_in_method");'
run_mig "a constraint re-added as UNIQUE, not CHECK"      1 "travels alone"               "$D"

# **The same bypass wearing a second table**, found reviewing #93. A constraint
# name is unique per *table* in Postgres, not per schema, and a `CHECK` creates no
# index to collide with the `UNIQUE` of the same name — so a decoy table declaring
# `user_email_unique` as a check is legal SQL, and it used to teach the history
# scan that the name was a predicate. The migration after it then dropped the real
# uniqueness on `"user"` and put a `CHECK (true)` back, and both of the carve-out's
# conditions passed. Two migrations rather than one, because a migration may not
# vouch for itself — that hole was closed first, and this is the way round it.
D=$(mig_seeded checkdecoytable "$UNIQUE_HISTORY")
printf '%s\n' 'CREATE TABLE "decoy" ("x" integer, CONSTRAINT "user_email_unique" CHECK (true));' \
  > "$D/drizzle/0001_decoy.sql"
printf '%s\n' \
  'ALTER TABLE "user" DROP CONSTRAINT "user_email_unique";' \
  'ALTER TABLE "user" ADD CONSTRAINT "user_email_unique" CHECK (true);' \
  > "$D/drizzle/0002_swap.sql"
journal 0000_init 0001_decoy 0002_swap > "$D/drizzle/meta/_journal.json"
run_mig "a decoy CHECK of that name on another table"     1 "travels alone"               "$D"

# The table is read on the re-add side too: putting the check back somewhere else
# is not re-creating the one that was dropped.
D=$(mig_seeded checkreaddothertable "$CHECK_HISTORY")
mig_add "$D" 0001_swap \
  'ALTER TABLE "session" DROP CONSTRAINT "session_method_known";' \
  'ALTER TABLE "decoy" ADD CONSTRAINT "session_method_known" CHECK (true);'
run_mig "a CHECK re-added on a different table"           1 "travels alone"               "$D"

# One `ALTER TABLE` carrying both actions past a comma, which is the spelling that
# loses its table to `actions` — the pair must still read as a widening, and this
# is the case that fails if the table is not threaded through the split.
D=$(mig_seeded checkwidenoneline "$CHECK_HISTORY")
mig_add "$D" 0001_admin_methods \
  'ALTER TABLE "session" DROP CONSTRAINT "session_method_known", ADD CONSTRAINT "session_method_known" CHECK ("sign_in_method" IN ('"'a'"', '"'b'"'));'
run_mig "a CHECK widened by one multi-action ALTER TABLE" 0 "^Migration integrity passed" "$D"

# The carve-out reaches one statement kind and no other: a DROP COLUMN beside a
# genuine CHECK widening is still a mixture, and still the thing rule 3 is for.
D=$(mig_seeded checkwidenplusdrop "$CHECK_HISTORY")
mig_add "$D" 0001_both \
  'ALTER TABLE "session" DROP CONSTRAINT "session_method_known";' \
  'ALTER TABLE "session" ADD CONSTRAINT "session_method_known" CHECK ("sign_in_method" IN ('"'a'"'));' \
  'ALTER TABLE "offer" DROP COLUMN "memo";'
run_mig "a DROP COLUMN beside a CHECK widening"           1 "travels alone"               "$D"

# The prose cases. Every one of these is text that names a destructive statement
# without being one, and four false refusals were found the last time these rules
# were written.
D=$(mig_start prose_comment)
mig_add "$D" 0001_add_note '-- supersedes the DROP COLUMN "memo" this replaces' 'ALTER TABLE "offer" ADD COLUMN "note" text;'
run_mig "DROP COLUMN inside a SQL line comment"           0 "^Migration integrity passed" "$D"

D=$(mig_start prose_block)
mig_add "$D" 0001_add_note '/* DROP TABLE "draft" is the contract half, next release */' 'ALTER TABLE "offer" ADD COLUMN "note" text;'
run_mig "DROP TABLE inside a SQL block comment"           0 "^Migration integrity passed" "$D"

D=$(mig_start prose_literal)
mig_add "$D" 0001_seed_skill "INSERT INTO \"skill\" (\"label_es\") VALUES ('DROP TABLE y RENAME');"
run_mig "a destructive phrase inside a string literal"    0 "^Migration integrity passed" "$D"

D=$(mig_start addconstraint)
mig_add "$D" 0001_add_fk 'ALTER TABLE "offer" ADD CONSTRAINT "offer_hirer_fk" FOREIGN KEY ("hirer_id") REFERENCES "account"("id");'
run_mig "ADD CONSTRAINT is not DROP CONSTRAINT"           0 "^Migration integrity passed" "$D"

D=$(mig_start addnotnull)
mig_add "$D" 0001_add_note 'ALTER TABLE "offer" ADD COLUMN "note" text NOT NULL DEFAULT '"''"';'
run_mig "ADD COLUMN ... NOT NULL is not SET NOT NULL"     0 "^Migration integrity passed" "$D"

D=$(mig_start createtype)
mig_add "$D" 0001_add_status 'CREATE TYPE "offer_status" AS ENUM('"'draft'"', '"'sent'"');' 'ALTER TABLE "offer" ADD COLUMN "status" "offer_status";'
run_mig "CREATE TYPE is not ALTER COLUMN ... TYPE"        0 "^Migration integrity passed" "$D"

# A quoted identifier now leaves its *name* in the scanned text rather than a bare
# `ident`, so that rule 3's CHECK carve-out can pair a drop with its re-add. These
# three are what say the erasure still does its original job: a name cannot become
# a destructive phrase, whether it is plain, punctuated, or quote-escaped.
D=$(mig_start identunderscore)
mig_add "$D" 0001_add_flag 'ALTER TABLE "offer" ADD COLUMN "drop_table" boolean;'
run_mig "a column whose name is drop_table"               0 "^Migration integrity passed" "$D"

D=$(mig_start identspace)
mig_add "$D" 0001_add_flag 'ALTER TABLE "offer" ADD COLUMN "drop table" boolean;'
run_mig "a column whose quoted name holds a space"        0 "^Migration integrity passed" "$D"

D=$(mig_start identrename)
mig_add "$D" 0001_add_flag 'ALTER TABLE "offer" ADD COLUMN "rename" boolean;'
run_mig "a column named for a destructive keyword"        0 "^Migration integrity passed" "$D"

section "Migration integrity: contract and code ship separately"

D=$(mig_start contract_code)
mig_domain "$D"
mig_ship "$D"
mig_add "$D" 0001_contract_drop_memo 'ALTER TABLE "offer" DROP COLUMN "memo";'
printf '%s\n' 'export const listOffers = () => [1];' > "$D/packages/domain/src/offers.ts"
run_mig "a contract migration beside a query module"      1 "ship separately"             "$D"

# The schema is what a contract migration is generated *from*, so it has to be
# allowed to move with it or the rule refuses the only way to satisfy itself.
D=$(mig_start contract_schema)
mig_domain "$D"
mig_ship "$D"
mig_add "$D" 0001_contract_drop_memo 'ALTER TABLE "offer" DROP COLUMN "memo";'
printf '%s\n' 'export const schema = { offer: {} };' > "$D/packages/domain/src/schema.ts"
run_mig "a contract migration beside the schema"          0 "^Migration integrity passed" "$D"

D=$(mig_start contract_pure)
mig_domain "$D"
mig_ship "$D"
mig_add "$D" 0001_contract_drop_memo 'ALTER TABLE "offer" DROP COLUMN "memo";'
printf '%s\n' 'export const canAccept = () => false;' > "$D/packages/domain/src/policy.ts"
run_mig "a contract migration beside a pure module"       0 "^Migration integrity passed" "$D"

D=$(mig_start additive_code)
mig_domain "$D"
mig_ship "$D"
mig_add "$D" 0001_add_note 'ALTER TABLE "offer" ADD COLUMN "note" text;'
printf '%s\n' 'export const listOffers = () => [1];' > "$D/packages/domain/src/offers.ts"
run_mig "an additive migration beside a query module"     0 "^Migration integrity passed" "$D"

D=$(mig_start contract_adr)
mig_domain "$D"
mig_ship "$D"
mig_add "$D" 0001_contract_drop_memo 'ALTER TABLE "offer" DROP COLUMN "memo";'
mkdir -p "$D/docs/adr"
printf '%s\n' '# ADR-0013' 'DROP TABLE, DROP COLUMN, DROP CONSTRAINT, ALTER COLUMN ... TYPE and any RENAME.' > "$D/docs/adr/0013-x.md"
run_mig "a contract migration beside an ADR quoting it"   0 "^Migration integrity passed" "$D"

# Every case below is a hole /code-review found in the first draft of this gate.
# Four of them passed green while checking nothing, which is the one way a
# guardrail is worse than no guardrail at all.
section "Migration integrity: the holes review found"

# A backslash-escaped quote inside an E-string left the quote count odd, and the
# scan then swallowed the rest of the file -- so every statement after it went
# unread. Postgres ships standard_conforming_strings on, so `\` escapes in
# `E'...'` and nowhere else; both halves need their case.
D=$(mig_start estring)
mig_add "$D" 0001_tidy "ALTER TABLE \"o\" ADD COLUMN \"c\" text DEFAULT E'it\\'s';" 'DROP TABLE "z";'
run_mig "a DROP after an escaped quote in an E-string"    1 "travels alone"               "$D"

D=$(mig_start plainquote)
mig_add "$D" 0001_seed "INSERT INTO \"skill\" VALUES ('a backslash \\\\ is literal here');" 'DROP TABLE "z";'
run_mig "a DROP after a backslash in a plain string"      1 "travels alone"               "$D"

# One ALTER TABLE carries as many comma-separated actions as it likes, so the
# statement was the wrong unit: this is exactly the mixture rule 3 exists to
# refuse, and it passed because `additive.length` was 0.
D=$(mig_start commaactions)
mig_add "$D" 0001_contract_tidy 'ALTER TABLE "offer" ADD COLUMN "a" text, DROP COLUMN "b";'
run_mig "ADD and DROP as two actions of one ALTER"        1 "travels alone"               "$D"

# ...but splitting a list is not the same as splitting actions. `DROP TABLE a, b`
# is one action over two names, and reading `b` as additive would refuse a
# migration that is wholly destructive.
D=$(mig_start droplist)
mig_add "$D" 0001_contract_drop_both 'DROP TABLE "draft", "memo";'
run_mig "DROP TABLE over a list of two names"             0 "^Migration integrity passed" "$D"

D=$(mig_start altercols)
mig_add "$D" 0001_contract_drop_two 'ALTER TABLE "offer" DROP COLUMN "a", DROP COLUMN "b";'
run_mig "two DROP COLUMN actions in one ALTER"            0 "^Migration integrity passed" "$D"

D=$(mig_start parencomma)
mig_add "$D" 0001_widen 'ALTER TABLE "offer" ADD COLUMN "amount" numeric(12, 2);'
run_mig "a comma inside a type's parentheses"             0 "^Migration integrity passed" "$D"

# Rule 3 used to check every journal entry rather than only the new ones, which
# deadlocks the repository: a mixed migration that reached the default branch
# would refuse every later pull request, while rule 2 forbids editing the file
# that would fix it. NFR30's second half rules that out.
D=$(mig_repo shipped_mixed)
printf '%s\n' 'ALTER TABLE "offer" ADD COLUMN "note" text;' 'ALTER TABLE "offer" DROP COLUMN "memo";' > "$D/drizzle/0000_tidy.sql"
journal 0000_tidy > "$D/drizzle/meta/_journal.json"
mig_ship "$D"
printf '%s\n' 'export const unrelated = 1;' > "$D/unrelated.ts"
run_mig "a mixed migration already on the default branch" 0 "^Migration integrity passed" "$D"

# A stack is the correct expand/contract split, not a violation of it: the
# contract migration is PR N and the query-module change is PR N+1. Measured
# against the default branch both land in one diff, so the gate reads the PR's
# own base branch where CI names it.
D=$(mig_start stacked)
mig_domain "$D"
mig_ship "$D"
mig_add "$D" 0001_contract_drop_memo 'ALTER TABLE "offer" DROP COLUMN "memo";'
git -C "$D" add -A >/dev/null 2>&1
git -C "$D" -c user.email=t@t -c user.name=t commit -q -m "contract" >/dev/null 2>&1
git -C "$D" update-ref refs/remotes/origin/ticket-1 HEAD
git -C "$D" checkout -q -b ticket/2-stop-using-it
printf '%s\n' 'export const listOffers = () => [1];' > "$D/packages/domain/src/offers.ts"
run_mig "the query change stacked above the contract PR"  1 "ship separately"             "$D"
out=$(GITHUB_BASE_REF=ticket-1 node "$MIG" --root "$D" 2>&1)
if [ "$?" = 0 ] && printf '%s' "$out" | grep -qE "^Migration integrity passed"; then
  pass=$((pass+1)); sec_pass=$((sec_pass+1))
  [ "$VERBOSE" = 1 ] && printf '  ok   %-51s -> exit 0\n' "the same stack, measured against its own base"
else
  fail=$((fail+1)); sec_fail=$((sec_fail+1)); show_header
  printf '  FAIL %-51s -> want exit 0 and a pass\n' "the same stack, measured against its own base"
  printf '       %s\n' "${out:-<empty>}"
fi

# A manifest at the repository root made the prefix "./src/", which matches no
# path git ever prints -- rule 4 became a silent no-op rather than an answer.
D=$(mig_start rootdomain)
mkdir -p "$D/src"
printf '%s\n' '{"name":"@repo/domain","version":"0.0.0"}' > "$D/package.json"
printf '%s\n' 'export const listOffers = () => [];' > "$D/src/offers.ts"
mig_ship "$D"
mig_add "$D" 0001_contract_drop_memo 'ALTER TABLE "offer" DROP COLUMN "memo";'
printf '%s\n' 'export const listOffers = () => [1];' > "$D/src/offers.ts"
run_mig "@repo/domain declared at the repository root"    1 "ship separately"             "$D"

section "Migration integrity: the ways it must not fail open"

D=$(mig_repo none)
rm -rf "$D/drizzle"
printf '%s\n' '{"name":"root"}' > "$D/package.json"
mig_ship "$D"
run_mig "a repository with no migrations at all"          0 "no migrations"               "$D"

D=$(mig_start notjson)
printf '%s\n' 'entries: []' > "$D/drizzle/meta/_journal.json"
run_mig "a journal that is not JSON"                      2 "could not run"               "$D"

D=$(mig_start noentries)
printf '%s\n' '{"version":"7","dialect":"postgresql"}' > "$D/drizzle/meta/_journal.json"
run_mig "a journal with no entries array"                 2 "could not run"               "$D"

D=$(mig_start nofile)
mig_add "$D" 0001_add_note 'ALTER TABLE "offer" ADD COLUMN "note" text;'
rm "$D/drizzle/0001_add_note.sql"
run_mig "a journal entry with no .sql beside it"          2 "could not run"               "$D"

# GITHUB_BASE_REF naming a ref this repository does not have is the shape of the
# bug that turned 35 of these cases red on the first CI run. It must read as
# "could not run" and never as a pass -- an unresolvable base compared nothing.
D=$(mig_start badbaseref)
mig_add "$D" 0001_add_note 'ALTER TABLE "offer" ADD COLUMN "note" text;'
out=$(GITHUB_BASE_REF=no-such-branch node "$MIG" --root "$D" 2>&1)
code=$?
if [ "$code" = 2 ] && printf '%s' "$out" | grep -qE "could not run"; then
  pass=$((pass+1)); sec_pass=$((sec_pass+1))
  [ "$VERBOSE" = 1 ] && printf '  ok   %-51s -> exit 2\n' "GITHUB_BASE_REF naming a ref that is not there"
else
  fail=$((fail+1)); sec_fail=$((sec_fail+1)); show_header
  printf '  FAIL %-51s -> exit %s (want 2 matching /could not run/)\n' "GITHUB_BASE_REF naming a ref that is not there" "$code"
  printf '       %s\n' "${out:-<empty>}"
fi

# The shape CI actually checks out, and the one no case here had: `actions/checkout`
# writes no `refs/remotes/origin/HEAD`, and on a `push` event GitHub sets no
# GITHUB_BASE_REF either -- so the gate has no default branch to measure against
# and must say so. Every fixture above is handed one by `mig_repo`, which is why
# this went uncaught until the run on `dev` went red the day the first migration
# landed. `ci.yml`'s `git remote set-head origin --auto` is the answer to it; this
# case is what says the refusal it answers is the correct one.
D=$(mig_start nodefaultbranch)
mig_add "$D" 0001_add_note 'ALTER TABLE "offer" ADD COLUMN "note" text;'
git -C "$D" symbolic-ref -d refs/remotes/origin/HEAD
run_mig "no origin/HEAD and no GITHUB_BASE_REF"           2 "could not run"               "$D"

# A shallow clone has no merge base, and that is the failure this gate must not
# report as a pass: nothing was compared, so nothing was checked.
D=$(mig_start nobase)
git -C "$D" checkout -q --orphan unrelated
git -C "$D" -c user.email=t@t -c user.name=t commit -q -m unrelated >/dev/null 2>&1
run_mig "no merge base with the default branch"           2 "could not run"               "$D"

# The run against *this* repository is deliberately not here. This suite is
# cached on `.claude/hooks/**` plus the two scripts, and the gate's answer also
# depends on git history and on migrations none of those inputs cover -- so a
# cached replay would report a pass nothing had checked. It runs uncached as the
# `//#migrations:check` task instead, inside the same `pnpm test`.



# The spec-identifier gate is the third non-hook here, for the reason the other
# two are: repo logic deciding whether work may proceed. `REVIEW.md` carries the
# rule -- a spec identifier may not appear in any string that leaves the source
# file, and comments are the record and are never touched.
#
# The run against *this* repository is deliberately not here, exactly as it is
# not for migration integrity: this suite is cached on `.claude/hooks/**` plus
# the scripts, and this gate's answer also depends on every source file in the
# repo, so a cached replay would report a pass nothing had checked. It runs as
# the `//#spec-identifiers` task, inside the same `pnpm test`.
IDENT="$REPO/scripts/spec-identifiers.mjs"

# One tree per case, so no case can pass because of a file another case wrote.
ident_dir() { local d="$ROOT/ident/$1"; mkdir -p "$d"; echo "$d"; }

# Most cases are one line of source, and reading them as one line is the point:
# the difference between a pass and a refusal is visible without opening a file.
ident_one() { # name filename content -> prints the tree
  local d; d=$(ident_dir "$1"); printf '%s\n' "$3" > "$d/$2"; echo "$d"
}

# Exit code *and* a line of output, for the reason run_audit gives.
run_ident() { # name expect-exit expect-grep root [extra arguments]
  local name="$1" expect="$2" want="$3" dir="$4" out code
  shift 4
  out=$(node "$IDENT" --root "$dir" "$@" 2>&1)
  code=$?
  if [ "$code" = "$expect" ] && printf '%s' "$out" | grep -qE "$want"; then
    pass=$((pass+1)); sec_pass=$((sec_pass+1))
    [ "$VERBOSE" = 1 ] && printf '  ok   %-51s -> exit %s\n' "$name" "$code"
  else
    fail=$((fail+1)); sec_fail=$((sec_fail+1)); show_header
    printf '  FAIL %-51s -> exit %s (want %s matching /%s/)\n' "$name" "$code" "$expect" "$want"
    printf '       %s\n' "${out:-<empty>}"
  fi
  return 0
}

CLEAN="^Spec-identifier check passed"

section "Spec identifiers: the citations a string may not carry"
run_ident "a requirement number"  1 "^BLOCKING .*NFR8"     "$(ident_one nfr     a.ts 'const m = "the floor is NFR8";')"
run_ident "a decision record"     1 "^BLOCKING .*ADR-0004" "$(ident_one adr     a.ts 'const m = "trimmed by ADR-0004";')"
run_ident "a deep dive"           1 "^BLOCKING .*DD2"      "$(ident_one dd      a.ts 'const m = "DD2 caps the pool";')"
run_ident "a flagged concern"     1 "^BLOCKING .*C43"      "$(ident_one concern a.ts 'const m = "locked out, which is C43";')"
run_ident "a user story"          1 "^BLOCKING .*story 7"  "$(ident_one story   a.ts 'const m = "story 7 asks for it";')"
run_ident "an effort number"      1 "^BLOCKING .*spec 0002" "$(ident_one effort a.ts 'const m = "named in spec 0002";')"
run_ident "a runbook section"     1 "^BLOCKING .*§6"       "$(ident_one section a.ts 'const m = "see the runbook §6";')"
run_ident "an issue reference"    1 "^BLOCKING .*#17"      "$(ident_one issue   a.ts 'const m = "introduced by #17";')"
run_ident "a string carrying none of them" 0 "$CLEAN"      "$(ident_one none    a.ts 'const m = "the level floor";')"

section "Spec identifiers: every place a string is written"
run_ident "a test name"           1 "^BLOCKING .*NFR8"     "$(ident_one testname a.test.ts 'describe("NFR8 — the level floor", () => {});')"
run_ident "an operator-facing message" 1 "^BLOCKING .*DD5" "$(ident_one message  a.ts 'throw new AppError({ message: "DD5 declares it" });')"
run_ident "a line written to stdout" 1 "^BLOCKING .*§6"    "$(ident_one stdout   a.ts 'process.stdout.write("print them; see runbook §6");')"
run_ident "a single-quoted string" 1 "^BLOCKING .*NFR8"    "$(ident_one single   a.ts "const m = 'the floor is NFR8';")"
run_ident "a template literal chunk" 1 "^BLOCKING .*NFR8"  "$(ident_one template a.ts 'const m = `${x} is NFR8 as written`;')"
run_ident "an identifier-shaped variable in a substitution" 0 "$CLEAN" "$(ident_one substitution a.ts 'const m = `${NFR8} holds`;')"

section "Spec identifiers: comments are the record and are never read"
D=$(ident_dir linecomment)
cat > "$D/a.ts" <<'EOF'
// The floor is NFR8, cited here rather than in the message below.
const m = "the level floor";
EOF
run_ident "a line comment"                    0 "$CLEAN" "$D"

D=$(ident_dir blockcomment)
cat > "$D/a.ts" <<'EOF'
/*
 * NFR8 sets the floor, and this continuation line is the false positive a
 * line-prefix test cannot tell from a string.
 */
const m = "the level floor";
EOF
run_ident "a continuation line of a block comment" 0 "$CLEAN" "$D"

D=$(ident_dir jsxcomment)
cat > "$D/a.tsx" <<'EOF'
export function Panel() {
  return (
    <div>
      {/* Two standing notices, which is story 11. */}
      <p>Hola</p>
    </div>
  );
}
EOF
run_ident "a JSX comment block"               0 "$CLEAN" "$D"

D=$(ident_dir doccomment)
cat > "$D/a.ts" <<'EOF'
/** Bounded by NFR16, and read beside the code that proves it. */
export const MAX = 1;
EOF
run_ident "a doc-comment"                     0 "$CLEAN" "$D"

D=$(ident_dir markdown)
mkdir -p "$D/docs"
printf '%s\n' '# NFR8 and the level floor' > "$D/docs/notes.md"
printf '%s\n' 'const m = "the level floor";' > "$D/a.ts"
run_ident "a markdown file beside the source" 0 "$CLEAN" "$D"

section "Spec identifiers: the ways it must not fail open"
D=$(ident_dir jsxtags)
cat > "$D/a.tsx" <<'EOF'
export function Panel() {
  return (
    <div>
      <p>Hola</p>
    </div>
  );
}
const m = "the floor is NFR8";
EOF
run_ident "a closing JSX tag does not swallow what follows" 1 "^BLOCKING .*NFR8" "$D"

D=$(ident_dir jsxapostrophe)
cat > "$D/a.tsx" <<'EOF'
export function Panel() {
  return <p>Don't stop reading here</p>;
}
const m = "the floor is NFR8";
EOF
run_ident "an apostrophe in JSX text does not hide the rest" 1 "^BLOCKING .*NFR8" "$D"

D=$(ident_dir regexquote)
cat > "$D/a.ts" <<'EOF'
const quoted = /["']/;
const m = "the floor is NFR8";
EOF
run_ident "a regular expression holding a quote"  1 "^BLOCKING .*NFR8" "$D"

D=$(ident_dir regexbody)
cat > "$D/a.ts" <<'EOF'
const cited = /\bNFR\d+\b/;
const m = "the level floor";
EOF
run_ident "a regular expression is not a string"  0 "$CLEAN" "$D"

D=$(ident_dir division)
cat > "$D/a.ts" <<'EOF'
const half = (a + b) / 2;
const rest = half / 4;
const m = "the floor is NFR8";
EOF
run_ident "division is not the start of a pattern" 1 "^BLOCKING .*NFR8" "$D"

# A pattern in an arrow-function body is the context this reader lost first, and
# these three are why losing it matters rather than being untidy: read as
# division, the body is tokenised as code, and a `/*`, a `//` or a backtick in it
# then runs past every string in the rest of the file. The middle one used to
# report a clean tree.
D=$(ident_dir arrowslash)
cat > "$D/a.ts" <<'EOF'
const f = (s) => /[//]/.test(s);
const m = "the floor is NFR8";
EOF
run_ident "a pattern holding // after an arrow"  1 "^BLOCKING .*NFR8" "$D"

D=$(ident_dir arrowcomment)
cat > "$D/a.ts" <<'EOF'
const f = (s) => /[/*]/.test(s);
const m = "the floor is NFR8";
EOF
run_ident "a pattern holding /* after an arrow"  1 "^BLOCKING .*NFR8" "$D"

D=$(ident_dir arrowtick)
cat > "$D/a.ts" <<'EOF'
const f = (s) => /`/.test(s);
const m = "the floor is NFR8";
EOF
run_ident "a pattern holding a backtick after an arrow" 1 "^BLOCKING .*NFR8" "$D"

D=$(ident_dir greaterthan)
cat > "$D/a.ts" <<'EOF'
const bigger = (a, b) => a > b / 2;
const m = "the level floor";
EOF
run_ident "a bare greater-than still divides"    0 "$CLEAN" "$D"

D=$(ident_dir jsxarrow)
cat > "$D/a.tsx" <<'EOF'
export function Panel({ items }) {
  return <ul>{items.map((i) => <li key={i}>{i}</li>)}</ul>;
}
const m = "the floor is NFR8";
EOF
run_ident "an arrow inside JSX does not lose the tags" 1 "^BLOCKING .*NFR8" "$D"

D=$(ident_dir extensions)
printf '%s\n' 'const m = "the floor is NFR8";' > "$D/a.tsx"
printf '%s\n' 'const m = "the floor is NFR8";' > "$D/b.mjs"
printf '%s\n' 'const m = "the floor is NFR8";' > "$D/c.cts"
run_ident "every source extension is read"    1 "c.cts:1:" "$D"

D=$(ident_dir nested)
mkdir -p "$D/packages/domain/src"
printf '%s\n' 'const m = "the floor is NFR8";' > "$D/packages/domain/src/a.ts"
run_ident "a workspace nested three deep"     1 "packages/domain/src/a.ts:1:" "$D"

D=$(ident_dir vendored)
mkdir -p "$D/.agents/skills/x" "$D/.claude/skills/x" "$D/node_modules/x"
printf '%s\n' 'const m = "the floor is NFR8";' > "$D/.agents/skills/x/a.mjs"
printf '%s\n' 'const m = "the floor is NFR8";' > "$D/.claude/skills/x/a.mjs"
printf '%s\n' 'const m = "the floor is NFR8";' > "$D/node_modules/x/a.mjs"
run_ident "vendored skills and dependencies"  0 "$CLEAN" "$D"

section "Spec identifiers: a colour is not an issue number"
run_ident "a six-digit hex colour"    0 "$CLEAN"          "$(ident_one colour6 a.ts 'const fg = "#000000";')"
run_ident "a three-digit hex colour"  0 "$CLEAN"          "$(ident_one colour3 a.ts 'const fg = "#000";')"
run_ident "a reference inside a sentence" 1 "^BLOCKING .*#17" "$(ident_one sentence a.ts 'const m = "the shape #17 introduced";')"
run_ident "a subpath import specifier" 0 "$CLEAN"         "$(ident_one subpath a.ts 'import { auth } from "#lib/auth";')"

# The shell half. A `.sh` file is read by a second tokeniser, because shell
# quoting is not JavaScript quoting: `'…'` takes no escapes, `"…"` interpolates,
# `$'…'` is a third form, a `#` opens a comment only at a word boundary, and a
# heredoc body is data rather than a message the script writes.

section "Spec identifiers: a shell script is read too"
run_ident "a single-quoted string"   1 "^BLOCKING .*NFR8" "$(ident_one shsingle a.sh "say 'the floor is NFR8'")"
run_ident "a double-quoted string"   1 "^BLOCKING .*NFR8" "$(ident_one shdouble a.sh 'say "the floor is NFR8"')"
run_ident "a shell script carrying none of them" 0 "$CLEAN" "$(ident_one shnone a.sh 'say "the level floor"')"

D=$(ident_dir shansi)
cat > "$D/a.sh" <<'FIXTURE'
printf $'the floor is NFR8\n'
FIXTURE
run_ident "an ANSI-C quoted string"           1 "^BLOCKING .*NFR8" "$D"

# A heredoc body is data, exactly as `gate-lib.sh` reads it for the neighbouring
# problem: a payload at a delimiter the script names, not a line it writes. This
# suite's own fixtures are why that distinction has to hold.
D=$(ident_dir shheredoc)
cat > "$D/a.sh" <<'FIXTURE'
cat > fixture.ts <<EOF
const m = "the floor is NFR8";
EOF
FIXTURE
run_ident "a heredoc body is data"            0 "$CLEAN" "$D"

D=$(ident_dir shheredocquoted)
cat > "$D/a.sh" <<'FIXTURE'
cat > fixture.ts <<'EOF'
const m = "the floor is NFR8";
EOF
FIXTURE
run_ident "a quoted heredoc delimiter"        0 "$CLEAN" "$D"

D=$(ident_dir shheredoctab)
printf 'cat <<-EOF\n\tNFR8 in an indented body is data.\n\tEOF\nsay "the level floor"\n' > "$D/a.sh"
run_ident "a tab-stripping heredoc"           0 "$CLEAN" "$D"

run_ident "a here-string is not a heredoc" 1 "^BLOCKING .*NFR8" \
  "$(ident_one shherestring a.sh 'grep -q floor <<<"the floor is NFR8"')"

section "Spec identifiers: a shell comment is the record"
D=$(ident_dir shcomment)
cat > "$D/a.sh" <<'FIXTURE'
# The floor is NFR8, cited here rather than in the line below.
say "the level floor"
FIXTURE
run_ident "a comment above the string"        0 "$CLEAN" "$D"

run_ident "a trailing comment after a command" 0 "$CLEAN" \
  "$(ident_one shtrailing a.sh 'say "the level floor"  # the floor is NFR8')"
run_ident "a hash inside a string is not a comment" 1 "^BLOCKING .*#17" \
  "$(ident_one shhash a.sh 'say "eight of them, and #17 added the ninth"')"
run_ident "an argument count does not open a comment" 1 "^BLOCKING .*NFR8" \
  "$(ident_one shargc a.sh '[ $# -gt 0 ] && say "the floor is NFR8"')"

section "Spec identifiers: the ways the shell reader must not fail open"
# An apostrophe in a comment is the shell's version of one in JSX text: read as
# an opening quote, it swallows every string in the rest of the file.
D=$(ident_dir shapostrophe)
cat > "$D/a.sh" <<'FIXTURE'
# Don't stop reading here.
say "the floor is NFR8"
FIXTURE
run_ident "an apostrophe in a comment"        1 "a.sh:2:" "$D"

# The terminator ends the heredoc rather than the read: the body is skipped and
# the file resumes.
D=$(ident_dir shheredocresume)
cat > "$D/a.sh" <<'FIXTURE'
cat <<'EOF'
NFR8 in a heredoc body is data.
EOF
say "the floor is NFR9"
FIXTURE
run_ident "a heredoc terminator ends the body" 1 "^BLOCKING .*NFR9" "$D"

D=$(ident_dir shsubst)
cat > "$D/a.sh" <<'FIXTURE'
say "$(printf %s 'the floor is NFR8')"
FIXTURE
run_ident "a command substitution's body is code" 1 "^BLOCKING .*NFR8" "$D"

run_ident "an identifier-shaped variable"     0 "$CLEAN" \
  "$(ident_one shvar a.sh 'say "$NFR8 holds"')"
run_ident "the same variable, braced"         0 "$CLEAN" \
  "$(ident_one shbraced a.sh 'say "${NFR8} holds"')"
run_ident "an escaped quote inside a double-quoted string" 1 "^BLOCKING .*NFR8" \
  "$(ident_one shescape a.sh 'say "she said \"the floor is NFR8\""')"

D=$(ident_dir shsinglehash)
cat > "$D/a.sh" <<'FIXTURE'
say 'a # and a " inside single quotes'
say "the floor is NFR8"
FIXTURE
run_ident "a hash and a quote inside single quotes" 1 "^BLOCKING .*NFR8" "$D"

# The tree walk still skips `.agents/` and `.claude/`, and for shell that skip
# earns a second reason: THIS file's fixtures are the citations the gate refuses,
# so it cannot be subject to itself. Every other hook can be, and this is where
# it happens -- `//#test:gates` already declares `.claude/hooks/**` as an input,
# so editing a deny message re-runs this case.
D=$(ident_dir hooks)
cp "$HOOKS"/*.sh "$D/"
rm -f "$D/gate-test.sh"
run_ident "the hooks this repository owns"    0 "$CLEAN" "$D"

# Four holes /code-review found in the first draft of this reader, and every one
# of them failed OPEN: the file was reported clean. They are the shell half of
# what the `=>` cases above are for the JavaScript one, so they are grouped
# rather than scattered.
section "Spec identifiers: the four holes the shell reader failed open on"

# A `${ … }` is not only a name. Skipping it whole lost every word form, and the
# repo already writes user-facing text into one: `plan-to-design-gate.sh` puts a
# `${status:-unset}` in the middle of a refusal a person reads.
run_ident "a default in a parameter expansion" 1 "^BLOCKING .*NFR8" \
  "$(ident_one shdefault a.sh 'say "${MSG:-refused, the floor is NFR8}"')"
run_ident "an error word in a parameter expansion" 1 "^BLOCKING .*NFR8" \
  "$(ident_one sherrword a.sh ': "${MSG:?the floor is NFR8}"')"
run_ident "a pattern substitution's replacement" 1 "^BLOCKING .*NFR8" \
  "$(ident_one shpatsub a.sh 'say "${MSG//floor/the floor is NFR8}"')"
run_ident "a length is an operator, not a word" 0 "$CLEAN" \
  "$(ident_one shlength a.sh 'say "${#items[@]} of them, at the level floor"')"

# A heredoc marker takes quote removal and nothing else. Dropping every
# non-word character turned this delimiter into one no line matches, so the body
# ran to the end of the file and took every string with it.
D=$(ident_dir shheredochyphen)
cat > "$D/a.sh" <<'FIXTURE'
cat <<END-OF-MSG
body line
END-OF-MSG
say "the floor is NFR8"
FIXTURE
run_ident "a hyphenated heredoc delimiter"    1 "^BLOCKING .*NFR8" "$D"

D=$(ident_dir shheredocdotted)
cat > "$D/a.sh" <<'FIXTURE'
cat <<EOF.1
body line
EOF.1
say "the floor is NFR8"
FIXTURE
run_ident "a dotted heredoc delimiter"        1 "^BLOCKING .*NFR8" "$D"

D=$(ident_dir shheredocbackslash)
cat > "$D/a.sh" <<'FIXTURE'
cat <<\EOF
body line
EOF
say "the floor is NFR8"
FIXTURE
run_ident "a backslash-quoted heredoc delimiter" 1 "^BLOCKING .*NFR8" "$D"

# `<<` in arithmetic is a shift. Read as a heredoc marker it announced a body
# terminated by `2`, and swallowed the rest of the file.
D=$(ident_dir shshift)
cat > "$D/a.sh" <<'FIXTURE'
n=$(( 1 << 2 ))
say "the floor is NFR8, and n is $n"
FIXTURE
run_ident "a shift inside arithmetic"         1 "^BLOCKING .*NFR8" "$D"

D=$(ident_dir shshiftbare)
cat > "$D/a.sh" <<'FIXTURE'
(( n = 1 << 2 ))
say "the floor is NFR8"
FIXTURE
run_ident "a shift inside a bare arithmetic command" 1 "^BLOCKING .*NFR8" "$D"

section "Spec identifiers: the report, and the refusals"
D=$(ident_dir report)
cat > "$D/b.ts" <<'EOF'
const first = "clean";
const second = "clean";
const m = "the floor is NFR8";
EOF
run_ident "names the file, the line and the string" 1 "^ +the floor is NFR8$" "$D"
run_ident "names the line the string starts on"     1 "b.ts:3:" "$D"

run_ident "a root that does not exist"   2 "could not run" "$ROOT/ident/absent"
D=$(ident_dir notadir)
printf '%s\n' 'const m = 1;' > "$D/a.ts"
run_ident "a root that is a file"        2 "could not run" "$D/a.ts"
run_ident "an argument it does not know" 2 "could not run" "$(ident_dir unknownarg)" --wat
run_ident "a flag with no value"         2 "could not run" "$(ident_dir novalue)" --root

# --- The artifact publisher -------------------------------------------------
#
# `ui-proof.mjs` is not a gate: it publishes rather than deciding whether work
# may proceed. It is driven here anyway, for the reason this suite already
# drives the audit and the migration gate -- it is repo logic living in
# `scripts/`, and the alternative is a second test runner for one file.
#
# Every case runs `--dry-run`, which is offline by construction: it reaches no
# pull request, no markdown renderer and no credential, so what is under test is
# the part that decides *what would be published* -- the naming rule, the
# grouping into comparisons, and the two prefixes that carry the two lifetimes.
# The single call that writes to the object store lives in its own module and is
# never imported on this path.
PROOF="$REPO/scripts/ui-proof.mjs"

# The script derives its directory from `git rev-parse --show-toplevel`, so a
# fixture is a repository -- the same reason the migration gate's fixtures are.
proof_repo() { # name -> path
  local d="$ROOT/proof/$1"
  mkdir -p "$d/.artifacts/ui-proof"
  git -C "$d" init -q 2>/dev/null
  echo "$d"
}

# A capture has to be big enough to be one, so fixtures are padded past the
# floor. A deliberately truncated fixture is written by hand where that is the
# case under test.
proof_file() { # dir filename
  head -c 2048 /dev/zero | tr '\0' 'x' > "$1/.artifacts/ui-proof/$2"
}

run_proof() { # name expect-exit expect-grep dir [extra arguments]
  local name="$1" expect="$2" want="$3" dir="$4" out code
  shift 4
  out=$( (cd "$dir" && node "$PROOF" "$@") 2>&1 )
  code=$?
  # `--` before the pattern: a want like "--pr" is a flag to grep otherwise, and
  # the case fails with grep's usage text rather than with anything about the
  # script under test.
  if [ "$code" = "$expect" ] && printf '%s' "$out" | grep -qE -- "$want"; then
    pass=$((pass+1)); sec_pass=$((sec_pass+1))
    [ "$VERBOSE" = 1 ] && printf '  ok   %-51s -> exit %s\n' "$name" "$code"
  else
    fail=$((fail+1)); sec_fail=$((sec_fail+1)); show_header
    printf '  FAIL %-51s -> exit %s (want %s matching /%s/)\n' "$name" "$code" "$expect" "$want"
    printf '       %s\n' "${out:-<empty>}"
  fi
  return 0
}

# The ordinary call: a dry-run publish against pull request 42.
run_pub() { # name expect-exit expect-grep dir
  run_proof "$1" "$2" "$3" "$4" publish --pr 42 --dry-run
}

section "Artifact publisher: the two lifetimes"
D=$(proof_repo lifetimes)
proof_file "$D" before-publish-form.png
proof_file "$D" after-publish-form.png
proof_file "$D" demo-publish-a-profile.webm
run_pub "a review capture takes the expiring prefix"  0 "review/pr-42-[0-9a-f]{16}/after-publish-form\.png" "$D"
run_pub "a demo takes the durable prefix"             0 "demos/pr-42-[0-9a-f]{16}/demo-publish-a-profile\.webm" "$D"
# The durable half needs a viewer that outlives the review prefix: a page under
# `review/` would be deleted out from under the clips it renders.
run_pub "the durable half gets a page of its own"     0 "demos/pr-42-[0-9a-f]{16}/index\.html" "$D"
run_pub "the review half gets its own page too"       0 "review/pr-42-[0-9a-f]{16}/index\.html" "$D"
run_pub "both pages are counted"                      0 "would publish 5 object" "$D"
run_pub "the link points at the review page"          0 "would link review/pr-42-.*/index\.html" "$D"
run_pub "a demo never lands under review/"            0 "^ +demos/pr-42-[0-9a-f]{16}/demo-publish-a-profile" "$D"
# A demo is the irreversible half, and the script cannot see the ticket graph
# that decides whether one is owed. So it says so rather than deciding quietly.
run_pub "publishing a demo is called out"             0 "durable clip.*never expire" "$D"
# Both prefixes are unguessable. The demo prefix is the one a guessable name
# would expose for longest, because nothing ever deletes it.
run_pub "the demo prefix is unguessable too"          0 "demos/pr-42-[0-9a-f]{16}/" "$D"

section "Artifact publisher: no demo, no second page"
D=$(proof_repo nodemo)
proof_file "$D" before-publish-form.png
proof_file "$D" after-publish-form.png
run_pub "one page when nothing is durable"            0 "would publish 3 object" "$D"
out=$( (cd "$D" && node "$PROOF" publish --pr 42 --dry-run) 2>&1 )
if printf '%s' "$out" | grep -q "demos/"; then
  fail=$((fail+1)); sec_fail=$((sec_fail+1)); show_header
  printf '  FAIL %-51s -> a durable prefix appeared with no demo\n' "no durable prefix is invented"
else
  pass=$((pass+1)); sec_pass=$((sec_pass+1))
  [ "$VERBOSE" = 1 ] && printf '  ok   %-51s\n' "no durable prefix is invented"
fi

section "Artifact publisher: names it refuses"
# No separator at all, so there is no state to read -- distinct from a name that
# has one and gets it wrong, which is the case below.
D=$(proof_repo nostate); proof_file "$D" screenshot.png
run_pub "a capture with no state"        1 "no state" "$D"
D=$(proof_repo badstate); proof_file "$D" beofre-publish-form.png
run_pub "a misspelled state"             1 "not one of before, after or demo" "$D"
D=$(proof_repo nosurface); proof_file "$D" after-.png
run_pub "a state with no surface"        1 "names a state but no surface" "$D"
# The link block records surfaces as a ", "-joined list so the expiry step can
# read them back. A surface carrying that separator would split into two.
D=$(proof_repo commasurface); proof_file "$D" "after-sign, in.png"
run_pub "a surface the link block cannot round-trip" 1 "round-trip" "$D"
# A file the script has no opinion about is ignored rather than refused: an
# operator's scratch notes beside the captures are not an error.
D=$(proof_repo ignores); proof_file "$D" after-publish-form.png
printf 'notes\n' > "$D/.artifacts/ui-proof/README.txt"
run_pub "an unrelated file is ignored, not refused" 0 "would publish 2 object" "$D"

section "Artifact publisher: nothing to publish"
D=$(proof_repo empty)
run_pub "an empty capture directory"     1 "nothing captured" "$D"
D="$ROOT/proof/absent"; mkdir -p "$D"; git -C "$D" init -q 2>/dev/null
run_pub "no capture directory at all"    1 "nothing captured" "$D"

section "Artifact publisher: a capture that is not one"
# The ffmpeg failure seen from the other end. `record start` reports success and
# `record stop` is where it breaks, so the wreckage is a truncated file rather
# than a missing one -- and an empty file publishes as a player showing nothing,
# which reads to a reviewer as a change that does nothing.
D=$(proof_repo truncated); proof_file "$D" before-publish-form.png
printf 'x' > "$D/.artifacts/ui-proof/after-publish-form.webm"
run_pub "a truncated recording"          1 "not a capture" "$D"
run_pub "and it names the file"          1 "after-publish-form\.webm" "$D"
D=$(proof_repo zero); : > "$D/.artifacts/ui-proof/after-publish-form.webm"
run_pub "a zero-byte recording"          1 "not a capture" "$D"

section "Artifact publisher: an unpaired comparison"
# Reported, never refused. A session that captured only one half has to say why
# in the pull request body, and dropping the file here would take that decision
# away from it -- so the half is published and the gap is named.
D=$(proof_repo unpaired); proof_file "$D" after-sign-in.webm
run_pub "an after with no before is named"   0 "has an after and no before" "$D"
run_pub "and it is still published"          0 "would publish 2 object"     "$D"
D=$(proof_repo unpaired2); proof_file "$D" before-sign-in.webm
run_pub "a before with no after is named"    0 "has a before and no after"  "$D"

section "Artifact publisher: refusals that are not answers"
D=$(proof_repo args); proof_file "$D" after-publish-form.png
run_proof "no pull request number"      2 "usage|--pr" "$D" publish --dry-run
run_proof "a command it does not know"  2 "usage"      "$D" ship --pr 42
run_proof "a pull request that is not a number" 2 "--pr" "$D" publish --pr abc --dry-run
# A real publish refuses before it makes a single network call, and it refuses
# with 1 rather than 2: an operator who has not worked the runbook yet is the
# ordinary state of a machine, not a broken script.
run_proof "an unconfigured store refuses with 1" 1 "not configured" "$D" publish --pr 42
run_proof "and it names every missing variable"  1 "UI_PROOF_PUBLIC_BASE" "$D" publish --pr 42

flush_section
echo
echo "passed: $pass  failed: $fail"
rm -rf "$ROOT"
[ "$fail" -eq 0 ]
