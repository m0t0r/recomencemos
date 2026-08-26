#!/usr/bin/env bash
# Drive the repo's own gates with fixtures.
#
# Most of them are stage hooks, driven with PreToolUse payloads: all four run on
# every call, as Claude Code runs them, and deny wins. The last section drives a
# gate that is not a hook at all -- the dependency audit CI runs on every PR --
# because it is the same kind of thing: repo logic deciding whether work may
# proceed, and so a test suite rather than a script somebody remembers to run.
set -uo pipefail

# Quiet on success, like every other test runner here. 58 ok-lines scrolled the
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

AUDIT="$REPO/scripts/audit-direct.mjs"
AR="$ROOT/auditrepo"
mkdir -p "$AR/packages/thing" "$AR/apps/app"
cat > "$AR/pnpm-workspace.yaml" <<'EOF'
packages:
  - "apps/*"
  - "packages/*"
EOF
printf '%s\n' '{"name":"root","devDependencies":{"turbo":"^2.10.11"}}' > "$AR/package.json"
printf '%s\n' '{"name":"thing","dependencies":{"next":"16.3.2"}}' > "$AR/packages/thing/package.json"
printf '%s\n' '{"name":"app","devDependencies":{"vitest":"^4"}}' > "$AR/apps/app/package.json"

# One advisory, parameterised by the two fields the gate actually reads.
adv() { jq -nc --arg m "$1" --arg s "$2" \
  '{advisories:{"1":{module_name:$m,severity:$s,title:"fixture",vulnerable_versions:"<1",patched_versions:">=1",url:"https://example.test"}}}'; }

run_audit() { # name expect-exit json
  local name="$1" expect="$2" json="$3" out code
  printf '%s' "$json" > "$ROOT/audit-input.json"
  out=$(node "$AUDIT" --root "$AR" --input "$ROOT/audit-input.json" 2>&1)
  code=$?
  if [ "$code" = "$expect" ]; then
    pass=$((pass+1)); sec_pass=$((sec_pass+1))
    [ "$VERBOSE" = 1 ] && printf '  ok   %-51s -> exit %s\n' "$name" "$code"
  else
    fail=$((fail+1)); sec_fail=$((sec_fail+1)); show_header
    printf '  FAIL %-51s -> exit %s (want %s)\n' "$name" "$code" "$expect"
    printf '       %s\n' "${out:-<empty>}"
  fi
  return 0
}

section "Dependency audit: high or above, direct only"
run_audit "high in a dependency of a workspace"           1 "$(adv next high)"
run_audit "critical in a dependency of a workspace"       1 "$(adv next critical)"
run_audit "high in a root devDependency"                  1 "$(adv turbo high)"
run_audit "high in a workspace devDependency"             1 "$(adv vitest high)"
run_audit "high with no direct path at all"               0 "$(adv postcss high)"
run_audit "moderate in a direct dependency"               0 "$(adv next moderate)"
run_audit "low in a direct dependency"                    0 "$(adv next low)"
run_audit "nothing found"                                 0 '{"advisories":{}}'

section "unrelated paths"
run "ordinary source file saying status: approved"        allow "$(wj Write "$ROOT/apps/web/app/page.tsx" 'status: approved')"

flush_section
echo
echo "passed: $pass  failed: $fail"
rm -rf "$ROOT"
[ "$fail" -eq 0 ]
