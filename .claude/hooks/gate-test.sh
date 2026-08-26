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
run_mig() { # name expect-exit expect-grep root
  local name="$1" expect="$2" want="$3" dir="$4" out code
  out=$(node "$MIG" --root "$dir" 2>&1)
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


flush_section
echo
echo "passed: $pass  failed: $fail"
rm -rf "$ROOT"
[ "$fail" -eq 0 ]
