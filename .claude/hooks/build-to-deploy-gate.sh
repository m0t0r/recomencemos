#!/usr/bin/env bash
# The Build gate: may this change ship? Two rules, enforced before the command runs.
#
#   F. The agent may never approve or merge a pull request.
#   G. The agent may never push directly to the default branch.
#
# Rule F is the load-bearing one, exactly as rule A is for the Plan gate and rule
# C for the Design gate. The playbook draws the line here: "the agent may act up
# to the production gate and cannot pass it." Rule G is what stops the gate being
# routed around — approval is meaningless if the agent can push past the PR
# entirely.
#
# This is the one gate that DOES touch a PR, and that is not a contradiction of
# the Plan gate's "never a PR" note. That note keeps the agent's route *into*
# review open; this one keeps it from walking out the other side.
#
# Unlike rules B and E, neither rule reads an artifact: there is no state under
# which an agent may merge. docs/policy/build.md records that as a fixed fact
# rather than a key, so there is nothing here to configure.
#
# Both rules read the command with heredoc bodies stripped and match only at a
# command position. Without that, a commit message *describing* the rules trips
# them — which is exactly what happened while this file was being written, and is
# why gate-test.sh now carries the prose cases.
#
# See README "The Build stage".
set -uo pipefail

# shellcheck source=./gate-lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/gate-lib.sh"

input=$(cat)
[ "$(printf '%s' "$input" | jq -r '.tool_name // ""')" = "Bash" ] || exit 0
raw=$(printf '%s' "$input" | jq -r '.tool_input.command // ""')
cmd=$(printf '%s' "$raw" | strip_heredocs)

# WHICH CHECKOUT rule G asks about comes from the payload, never from
# CLAUDE_PROJECT_DIR. That variable keeps naming the main checkout after the
# session enters a worktree, and the main checkout has the default branch out by
# construction -- so a gate reading it refused every bare `git push` from every
# worktree as a push to the default branch (#174). tree_for() in gate-lib.sh
# carries the measurement; `-C` is not honoured here, the way it is for rule K,
# because a push aimed at another checkout by flag is a shape no session has
# produced, and the heuristic stays as narrow as its cases. Resolved inside rule
# G rather than up here, so the one command in a hundred that is a push is the
# only one that pays for a `git rev-parse`.

# Rule F. Three ways to pass the gate, all refused. A stack merge is a merge, so
# stacks change how work is published and never who ships it.
if printf '%s' "$cmd" | grep -qE "${CMD_START}gh[[:space:]]+pr[[:space:]]+merge([[:space:]]|$)"; then
  deny "Merging a pull request is the human's act — it is the Build gate, and the production gate the playbook draws. Open the PR, report it, and stop. docs/policy/build.md records who may merge."
fi

if printf '%s' "$cmd" | grep -qE "${CMD_START}gh[[:space:]]+stack[[:space:]]+merge([[:space:]]|$)"; then
  deny "A stack merge is a merge. Stacked PRs change how work is published, never who may ship it — the whole stack still waits on a human. docs/policy/build.md records who may merge."
fi

# One expression, so the approving flag has to belong to the review command
# rather than merely appear somewhere else in the same script. `[^;&|]*` and not
# `.*` is what makes that true: with `.*` a review posted as a comment was
# refused because a later `echo` in the same line mentioned the flag.
if printf '%s' "$cmd" |
  grep -qE "${CMD_START}gh[[:space:]]+pr[[:space:]]+review([[:space:]]|$)[^;&|]*(--approve([[:space:]]|=|$)|[[:space:]]-a([[:space:]]|$))"; then
  deny "An agent may not approve a pull request, including its own. Review passes report findings; approval is the human judgment those findings inform. Post the review as a comment instead, with the --comment flag."
fi

# Rule G. The default branch is read from the remote, so a fork of this template
# that renames it stays protected without editing this hook. Outside any
# repository there is nothing to push from, so there is nothing to refuse.
if printf '%s' "$cmd" | grep -qE "${CMD_START}git[[:space:]]+push([[:space:]]|$)"; then
  tree=$(tree_for "$(printf '%s' "$input" | jq -r '.cwd // ""')") || exit 0
  default=$(default_branch_of "$tree")

  # `git push [flags] [remote] [refspec]`. Drop flags and anything after a shell
  # operator, then the second positional is the refspec: "main", "HEAD:main",
  # ":main" (a delete) all resolve to the branch after the last colon. With no
  # refspec the push follows the current branch.
  #
  # A flag that takes a separate value (`-o <opt>`) would be read as a
  # positional. Like the Plan gate's redirect match this is a heuristic, not a
  # seal — branch protection on the remote is the seal.
  #
  # No \b in the sed: BSD sed (macOS) does not support it, and silently not
  # matching left the whole command in $tail, so the second "positional" was the
  # word `push`. gate-test.sh covers it.
  tail=$(printf '%s' "$cmd" | sed -E 's/.*git[[:space:]]+push//; s/[;&|].*//')
  refspec=$(printf '%s' "$tail" | tr ' \t' '\n\n' | grep -v '^-' | grep -v '^$' | sed -n 2p)

  if [ -n "$refspec" ]; then
    dst="${refspec##*:}"
  else
    dst=$(branch_of "$tree")
  fi

  if [ "$dst" = "$default" ]; then
    deny "Pushing to '$default' directly bypasses review. Everything the agent writes becomes a PR: branch as ticket/<issue>-<slug>, push that, and open a PR. See docs/policy/build.md."
  fi
fi

exit 0
