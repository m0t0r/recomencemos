#!/usr/bin/env bash
# The Design gate: may Build start? Three rules, enforced before the write lands.
#
#   C. The agent may never set status: approved in a spec.md.
#   D. Every spec.md carries a "## Flagged concerns" section, even when empty.
#   E. A ticket may only be hung off a spec's issue once that spec is approved
#      and every flagged concern is resolved.
#
# Rule C is the load-bearing one, exactly as rule A is for the Plan gate. Rule D
# exists so E has something to read: the concerns list is what the owners in
# docs/policy/owners.md resolve, and resolving it is what a human approves.
#
# Tickets hang off the spec's issue as sub-issues (see "Build operations" in
# docs/agents/issue-tracker.md), so linking one is the first act of Build that a
# deterministic gate can see. Creating an unlinked issue is not blocked; the plan
# is the parent plus its edges, and without the edge there is no plan.
#
# See README "The Design stage". This gates artifacts only, never a PR.
set -uo pipefail

# shellcheck source=./gate-lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/gate-lib.sh"

input=$(cat)
tool=$(printf '%s' "$input" | jq -r '.tool_name // ""')

# Rule E scans the effort artifacts, so it has to scan the tree the session is
# actually working in. CLAUDE_PROJECT_DIR names the checkout the session launched
# from and goes on naming it inside a worktree, so reading it here would judge
# `/to-tickets` against the specs on the default branch and never see the one the
# session just wrote. tree_for() in gate-lib.sh carries the measurement; the
# fallback is that same variable, which is the right answer outside a worktree.
root=$(tree_for "$(printf '%s' "$input" | jq -r '.cwd // ""')") || root="${CLAUDE_PROJECT_DIR:-.}"

case "$tool" in
  Bash)
    cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""')

    # Rule E.
    if printf '%s' "$cmd" | grep -qE 'issues/[0-9]+/sub_issues'; then
      parent=$(printf '%s' "$cmd" | sed -nE 's|.*issues/([0-9]+)/sub_issues.*|\1|p' | head -1)
      for spec in "$root"/docs/efforts/*/spec.md; do
        [ -f "$spec" ] || continue
        [ "$(field "$spec" issue | tr -d '#')" = "$parent" ] || continue

        status=$(field "$spec" status)
        [ "$status" = "approved" ] || deny "$spec is status: ${status:-unset}. Build starts from an approved spec — report its unresolved flagged concerns and let the user approve it. That approval is the Design gate."

        open=$(unchecked "$spec")
        [ "$open" -eq 0 ] || deny "$spec still has $open unresolved flagged concern(s). Each names its owner role in docs/policy/owners.md; that owner resolves it, not you."
      done
    fi
    exit 0
    ;;
  Write | Edit) ;;
  *) exit 0 ;;
esac

path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // ""')
incoming=$(printf '%s' "$input" | jq -r '.tool_input.content // .tool_input.new_string // ""')

case "$path" in
*/docs/efforts/*/spec.md)
  # Rule C.
  if approves "$incoming"; then
    deny "Approving a spec is the human's decision — it is the Design gate. Leave status: draft and ask the user to approve it themselves; resolving its flagged concerns with the owners named in docs/policy/owners.md is what they are approving."
  fi

  # Rule D. Checked on a full write, where the whole document is in hand.
  if [ "$tool" = "Write" ] && ! printf '%s' "$incoming" | grep -qE '^##[[:space:]]+Flagged concerns[[:space:]]*$'; then
    deny "This spec has no '## Flagged concerns' section. That list is what the owners in docs/policy/owners.md resolve and what a human approves against — write it, using '_No concerns raised._' when every advisory came back clean."
  fi
  ;;
esac
exit 0
