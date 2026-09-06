# The stage hooks: rules A through J, driven with PreToolUse payloads through
# all four artifact-and-ship gates at once, as Claude Code runs them. Rule K has
# a file of its own (worktree.sh) because its fixtures cannot share a branch
# with these.
#
# One fixture tree holds two efforts in every state the gates read, an install
# manifest for rule H, a migration journal for rule J, and a git repository on
# `main` so rule G has a default branch to refuse.
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

section "Bash: artifact writes must go through Write/Edit"
expect_decision "heredoc body merely mentions docs/efforts/x/spec.md" allow \
  "$(bj 'cat > .claude/hooks/x.sh <<EOF
# gates docs/efforts/NNNN/spec.md writes
EOF')"
expect_decision "grep over docs/efforts/x/intent.md"                  allow "$(bj 'grep -r status docs/efforts/0001-x/intent.md')"
expect_decision "redirect into spec.md"                               deny  "$(bj 'cat > docs/efforts/0001-x/spec.md <<EOF
hi
EOF')"
expect_decision "append into intent.md"                               deny  "$(bj 'echo hi >> docs/efforts/0001-x/intent.md')"
expect_decision "sed -i on spec.md"                                   deny  "$(bj "sed -i '' s/a/b/ docs/efforts/0001-x/spec.md")"
expect_decision "tee into intent.md"                                  deny  "$(bj 'echo x | tee docs/efforts/0001-x/intent.md')"
expect_decision "redirect with a relative ./ prefix"                  deny  "$(bj 'printf x > ./docs/efforts/0001-x/spec.md')"

# The publish protocol in docs/agents/issue-tracker.md puts a "Source of truth:"
# line naming the artifact inside an issue body. Every one of these is prose.
expect_decision "issue create, heredoc body naming the artifact"      allow "$(bj 'gh issue create --label ready-for-agent --title "Intent: t" --body-file - <<EOF
A summary.

> Source of truth: docs/efforts/0001-x/intent.md
EOF')"
expect_decision "issue comment carrying a pinned permalink"           allow "$(bj 'gh issue comment 12 --body "Revised: <https://gh/o/r/blob/abc/docs/efforts/0001-x/spec.md>"')"
expect_decision "blockquote in a quoted --body string"                allow "$(bj 'gh issue comment 7 --body "> Source of truth: docs/efforts/0001-x/spec.md"')"
expect_decision "arrow prose naming the artifact"                     allow "$(bj 'gh issue comment 5 --body "intent -> docs/efforts/0001-x/intent.md is the source"')"
expect_decision "HTML comment naming the artifact"                    allow "$(bj 'gh issue comment 7 --body "<!-- see docs/efforts/0001-x/spec.md -->"')"
expect_decision "git commit naming the artifact"                      allow "$(bj 'git commit -m "docs(effort): 0001 intent" -- docs/efforts/0001-x/intent.md')"
expect_decision "reading the artifact"                                allow "$(bj 'cat docs/efforts/0001-x/intent.md')"
expect_decision "heredoc into a scratch file naming the artifact"     allow "$(bj 'cat > /tmp/body.md <<EOF
Source of truth: docs/efforts/0001-x/intent.md
EOF')"

section "Rule E: sub-issues under a spec's issue"
expect_decision "parent 11 — approved, clean"                         allow "$(bj 'gh api --method POST repos/o/r/issues/11/sub_issues -F sub_issue_id=99')"
expect_decision "parent 21 — draft spec"                              deny  "$(bj 'gh api --method POST repos/o/r/issues/21/sub_issues -F sub_issue_id=99')"
expect_decision "parent 31 — approved, concern still open"            deny  "$(bj 'gh api --method POST repos/o/r/issues/31/sub_issues -F sub_issue_id=99')"
expect_decision "parent 77 — no spec claims it"                       allow "$(bj 'gh api --method POST repos/o/r/issues/77/sub_issues -F sub_issue_id=99')"
expect_decision "plain gh issue create"                               allow "$(bj 'gh issue create --title t --body b')"

section "Rule A: intent approval integrity"
expect_decision "intent set to approved"                              deny  "$(wj Write "$ROOT/docs/efforts/0009-n/intent.md" '---
stage: intent
status: approved
---')"
expect_decision "intent approved with trailing comment"               deny  "$(wj Edit "$ROOT/docs/efforts/0009-n/intent.md" 'status: approved # done')"
expect_decision "intent left draft"                                   allow "$(wj Write "$ROOT/docs/efforts/0009-n/intent.md" '---
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
expect_decision "spec beside approved clean intent"                   allow "$(wj Write "$ROOT/docs/efforts/0001-good/spec.md" "$OK")"
expect_decision "spec set to approved by agent"                       deny  "$(wj Write "$ROOT/docs/efforts/0001-good/spec.md" '---
status: approved
---
## Flagged concerns')"
expect_decision "spec beside draft intent"                            deny  "$(wj Write "$ROOT/docs/efforts/0002-draft/spec.md" "$OK")"
expect_decision "spec beside approved intent w/ open question"        deny  "$(wj Write "$ROOT/docs/efforts/0004-openq/spec.md" "$OK")"
expect_decision "spec with no intent.md sibling"                      deny  "$(wj Write "$ROOT/docs/efforts/0099-none/spec.md" "$OK")"
expect_decision "spec missing Flagged concerns section"               deny  "$(wj Write "$ROOT/docs/efforts/0001-good/spec.md" '---
status: draft
---
## Problem Statement')"
expect_decision "Edit fragment on a spec"                             allow "$(wj Edit "$ROOT/docs/efforts/0001-good/spec.md" 'some prose edit')"

section "Rule F: the agent may not approve or merge"
expect_decision "gh pr create"                                        allow "$(bj 'gh pr create --title x --body y')"
expect_decision "gh pr merge"                                         deny  "$(bj 'gh pr merge 5 --squash')"
expect_decision "gh stack merge"                                      deny  "$(bj 'gh stack merge 3')"
expect_decision "gh pr review --approve"                              deny  "$(bj 'gh pr review 5 --approve')"
expect_decision "gh pr review --comment"                              allow "$(bj 'gh pr review 5 --comment --body findings')"
expect_decision "gh pr merge inside a heredoc body"                   allow "$(bj 'cat > x.md <<EOF
do not run gh pr merge yourself
EOF')"

expect_decision "gh pr merge in a heredoc, at line start"              allow "$(bj "git commit -F - <<EOF
gh pr ""merge is what the gate refuses
EOF")"
expect_decision "an approving review in a heredoc, at line start"     allow "$(bj "git commit -F - <<EOF
gh pr ""review --approve is what the gate refuses
EOF")"
expect_decision "the approving flag elsewhere in the script"          allow "$(bj 'gh pr review 5 --comment --body x && echo "--approve is for humans"')"
expect_decision "an approving review for real"                        deny  "$(bj "gh pr revi""ew 5 --comment --body x; gh pr revi""ew --approve 6")"
expect_decision "push to main inside a heredoc"                       allow "$(bj "git commit -F - <<EOF
git ""push origin main is refused by rule G
EOF")"

section "Rule G: no direct push to the default branch"
expect_decision "push origin main"                                    deny  "$(bj 'git push origin main')"
expect_decision "push HEAD:main"                                      deny  "$(bj 'git push origin HEAD:main')"
expect_decision "push a ticket branch"                                allow "$(bj 'git push -u origin ticket/12-add-widget')"
expect_decision "bare push while on main"                             deny  "$(bj 'git push')"

git -C "$ROOT" checkout -q -b ticket/12-add-widget
expect_decision "bare push while on a ticket branch"                  allow "$(bj 'git push')"
expect_decision "push origin main from a ticket branch"               deny  "$(bj 'git push origin main')"

section "Rule H: vendored skills, advisories, the lockfile"
expect_decision "edit a vendored skill (in the lock)"                  deny  "$(wj Write "$ROOT/.agents/skills/to-tickets/SKILL.md" 'x')"
expect_decision "edit a forked skill (absent from the lock)"           allow "$(wj Write "$ROOT/.agents/skills/to-spec/SKILL.md" 'x')"
expect_decision "edit impeccable (vendored, never in the lock)"        deny  "$(wj Edit "$ROOT/.claude/skills/impeccable/SKILL.md" 'x')"
expect_decision "edit a committed advisory"                            deny  "$(wj Write "$ROOT/docs/efforts/0001-good/advisories/security.md" 'x')"
expect_decision "hand-edit pnpm-lock.yaml"                             deny  "$(wj Edit "$ROOT/pnpm-lock.yaml" 'x')"
expect_decision "ordinary source file"                                 allow "$(wj Write "$ROOT/apps/web/app/thing.ts" 'export const a = 1;')"

section "Rule I: credentials"
expect_decision "an AWS access key id"                                 deny  "$(wj Write "$ROOT/apps/web/a.ts" "const k = \"AK""IAABCDEFGHIJKLMNOP\";")"
expect_decision "a private key block"                                  deny  "$(wj Write "$ROOT/apps/web/b.ts" "-----BEGIN RSA PRIV""ATE KEY-----")"
expect_decision "a GitHub token"                                       deny  "$(wj Write "$ROOT/apps/web/c.ts" "const t = \"gh""p_0123456789abcdefghijklmnopqrstuvwxyz\";")"
expect_decision "prose about passwords"                                allow "$(wj Write "$ROOT/apps/web/d.ts" 'export const passwordFieldLabel = "Password";')"

section "Rule J: a journaled migration is never hand-edited"
expect_decision "Write to a migration the journal names"               deny  "$(wj Write "$ROOT/drizzle/0000_init.sql" 'DROP TABLE "offer";')"
expect_decision "Edit to a migration the journal names"                deny  "$(wj Edit "$ROOT/drizzle/0000_init.sql" 'ALTER TABLE "offer" DROP COLUMN "note";')"
expect_decision "Write to a .sql no journal names"                     allow "$(wj Write "$ROOT/drizzle/0001_draft.sql" 'CREATE TABLE "x" ("id" uuid);')"
expect_decision "Write to a .sql outside any migration directory"      allow "$(wj Write "$ROOT/scripts/report.sql" 'SELECT 1;')"
expect_decision "Write to a .sql beside an unreadable journal"         deny  "$(wj Write "$ROOT/broken/0000_init.sql" 'SELECT 1;')"
expect_decision "an ADR quoting the destructive list"                  allow "$(wj Write "$ROOT/docs/adr/0013-x.md" 'DROP TABLE, DROP COLUMN, DROP CONSTRAINT and any RENAME.')"

section "unrelated paths"
expect_decision "ordinary source file saying status: approved"        allow "$(wj Write "$ROOT/apps/web/app/page.tsx" 'status: approved')"
