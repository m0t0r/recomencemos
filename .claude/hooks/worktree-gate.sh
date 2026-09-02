#!/usr/bin/env bash
# The worktree gate: finished work is merged into the default branch, never
# written there. One rule, enforced before the command runs.
#
#   K. The agent may never create a commit in a checkout that has the default
#      branch checked out.
#
# Rule G already refuses a push to the default branch, but it refuses it at the
# END of the mistake. By then the commits exist, and the recovery is `git branch
# <name>` followed by `git reset --hard origin/<default>` — a manoeuvre nobody
# should be performing under pressure, and one this project has already had to
# perform once. This rule refuses the commit that starts it, at the point where
# the recovery is still a single `git switch -c` that carries the working tree
# across untouched.
#
# It is a backstop and not the mechanism. The mechanism is that a session opens a
# worktree before it writes anything: CLAUDE.md instructs it, docs/policy/build.md
# fixes it, and step 2 of the Build session in docs/agents/issue-tracker.md is
# where it happens. A session that followed the procedure never reaches this rule
# at all — which is the shape to want, because a gate that fires routinely is a
# gate somebody learns to route around.
#
# Reading, searching, building and exploring on the default branch are all
# untouched. The single refused act is the one that puts work there.
#
# WHICH CHECKOUT the rule asks about is the whole implementation, and taking it
# from CLAUDE_PROJECT_DIR would invert the rule exactly — see tree_for() in
# gate-lib.sh for the measurement. That variable keeps naming the main checkout
# after the session enters a worktree, so a gate reading it would see the default
# branch for every session and refuse every commit, including the ones made from
# the worktree it exists to encourage. The directory therefore comes from the
# payload's `cwd`, or from the invocation's own `-C` where it carries one.
#
# `git merge` and `git pull` are deliberately NOT refused, and the gap is named
# rather than closed with a heuristic. Fast-forwarding the main checkout from the
# remote is a legitimate and frequent act, and at this level it is
# indistinguishable from merging a feature branch by hand. Rules F and G are what
# stop the result of the second one reaching anybody.
#
# See README "The Build stage".
set -uo pipefail

# shellcheck source=./gate-lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/gate-lib.sh"

input=$(cat)
[ "$(printf '%s' "$input" | jq -r '.tool_name // ""')" = "Bash" ] || exit 0
raw=$(printf '%s' "$input" | jq -r '.tool_input.command // ""')
cmd=$(printf '%s' "$raw" | strip_heredocs)

cwd=$(printf '%s' "$input" | jq -r '.cwd // ""')

# Split on shell operators so each segment is one command, then read the segments
# that invoke git. This is the same job CMD_START does for the single-token rules,
# done as a split because this rule has to look PAST the flags: `git -C dir -c
# k=v commit` is a commit and `git commit-graph write` is not, and neither
# question survives a regex over the whole line.
#
# The loop runs in the current shell — a herestring, never a pipe — because deny()
# exits, and an exit inside a pipeline's subshell would print the refusal and then
# let the script carry on to `exit 0`.
sub=""
dir=""
while IFS= read -r seg; do
  seg="${seg#"${seg%%[![:space:]]*}"}"
  case "$seg" in
    git | git[[:space:]]*) ;;
    *) continue ;;
  esac

  # Word-splitting without globbing: `git commit -m *` must not expand against
  # whatever happens to sit in the hook's working directory.
  set -f
  # shellcheck disable=SC2086
  set -- $seg
  set +f
  shift || continue

  seg_dir=""
  seg_sub=""
  while [ $# -gt 0 ]; do
    case "$1" in
      # The two git flags that take a separate value. -C is the one that matters:
      # it moves the command to another checkout, and a rule reading the payload's
      # cwd would judge the wrong tree.
      -C) seg_dir="${2:-}"; shift 2 || break ;;
      -C*) seg_dir="${1#-C}"; shift ;;
      -c) shift 2 || break ;;
      -*) shift ;;
      *) seg_sub="$1"; break ;;
    esac
  done

  case "$seg_sub" in
    commit | cherry-pick | revert | am)
      sub="$seg_sub"
      dir="$seg_dir"
      break
      ;;
  esac
done <<EOF
$(printf '%s' "$cmd" | tr ';&|(){}' '\n\n\n\n\n\n')
EOF

[ -n "$sub" ] || exit 0

# A relative -C is relative to the command's own working directory, not to the
# hook's. Resolving it against the payload keeps `cd apps/web && git -C .. commit`
# pointing where the shell would have pointed it.
if [ -n "$dir" ]; then
  case "$dir" in
    /*) ;;
    *) [ -n "$cwd" ] && dir="$cwd/$dir" ;;
  esac
fi
[ -n "$dir" ] || dir="$cwd"

# Outside any repository there is no default branch to be on, so there is nothing
# to refuse. This is the one place the gate opens rather than closes, and it is
# safe because the act it guards cannot happen there either.
tree=$(tree_for "$dir") || exit 0

branch=$(branch_of "$tree")
[ -n "$branch" ] || exit 0

default=$(default_branch_of "$tree")
[ "$branch" = "$default" ] || exit 0

deny "This checkout has '$default' checked out, and '$default' is where finished work is merged rather than where it is written — so a commit here is one nobody reviewed. Open a worktree first and commit from there: it goes under .claude/worktrees/, branched from the current origin/$default, and docs/agents/issue-tracker.md carries the procedure and the branch names. If the change is already sitting in this working tree, \`git switch -c <branch>\` carries it across with nothing lost and nothing to unpick."
