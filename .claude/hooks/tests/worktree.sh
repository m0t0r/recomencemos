# Rule K: the worktree gate. Its own file rather than a section of hooks.sh, and
# that is deliberate.
#
# Its question is "which checkout is this command about", so a shared payload
# shape cannot ask it: every case needs a `cwd`, and the interesting ones need two
# real checkouts of one repository that disagree about the branch.
#
# It is also NOT driven through the four-gate loop hooks.sh uses. That loop
# drives every gate over one fixture on one branch, and four of its cases are
# `git commit -F - <<EOF` written to prove that rules F and G read a commit
# MESSAGE as prose -- with the fixture sitting on its default branch, which is
# precisely what rule K refuses. Both behaviours are right; they just cannot
# share a fixture.
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

# The fourth argument is the launch directory the hook would see, so a case can
# put the environment on one checkout and the payload on another.
run_wt() { # name expect json [project-dir]
  local saved="$CLAUDE_PROJECT_DIR"
  export CLAUDE_PROJECT_DIR="${4:-$saved}"
  expect_decision "$1" "$2" "$3" "$WT"
  export CLAUDE_PROJECT_DIR="$saved"
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
