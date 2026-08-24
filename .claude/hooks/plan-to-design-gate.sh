#!/usr/bin/env bash
# The Plan gate: may Design start? Two rules, enforced before the write lands.
#
#   A. The agent may never set status: approved in an intent.md.
#   B. A spec.md may only be written once its sibling intent is approved and
#      every open question is resolved.
#
# Rule A is the load-bearing one. Without it B is theatre: an agent that wants to
# finish flips the intent to approved and walks straight through. Approval has to
# be an act the agent cannot perform.
#
# See README "The Plan stage" and docs/adr/0001-findings-enter-through-triage.md.
# This gates artifacts only, never a PR: the playbook's 3-sigma runbook route
# stays open.
set -uo pipefail

# shellcheck source=./gate-lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/gate-lib.sh"

input=$(cat)
tool=$(printf '%s' "$input" | jq -r '.tool_name // ""')

case "$tool" in
  Bash)
    raw=$(printf '%s' "$input" | jq -r '.tool_input.command // ""')
    # Heredoc bodies are DATA. The publish protocol in docs/agents/issue-tracker.md
    # puts a `Source of truth:` line naming the artifact inside an issue body, and
    # a body is prose no matter how many times it says intent.md.
    cmd=$(printf '%s' "$raw" | strip_heredocs)

    art='[^[:space:]]*docs/efforts/[^[:space:]]*(intent|spec)\.md'

    # A redirect's target is the token IMMEDIATELY after the operator. The old
    # pattern allowed any number of tokens in between, so `intent -> spec.md` in
    # an issue comment read as a write — and so did a markdown blockquote.
    #
    # `[^->]` before the operator is what excludes the arrow: in `-> path` the
    # character before `>` is a dash, in a real redirect it is a space, a digit's
    # neighbour, or the end of a word (`cat>path`).
    if printf '%s' "$cmd" | grep -qE "(^|[^->])[0-9]?>>?[[:space:]]*$art"; then
      deny "The stage gates read intent.md and spec.md writes through the Write and Edit tools. Write this file with Write or Edit so the gate can evaluate it."
    fi

    # `tee` and `sed -i` take the path as an argument rather than after an
    # operator, so a few tokens may sit in between (`sed -i '' s/a/b/ path`).
    # Bounded, so prose cannot walk the whole line into a match.
    if printf '%s' "$cmd" |
      grep -qE "(tee|sed[[:space:]]+-i)[[:space:]]+([^[:space:]>|]+[[:space:]]+){0,3}$art"; then
      deny "The stage gates read intent.md and spec.md writes through the Write and Edit tools. Write this file with Write or Edit so the gate can evaluate it."
    fi
    exit 0
    ;;
  Write | Edit) ;;
  *) exit 0 ;;
esac

path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // ""')
incoming=$(printf '%s' "$input" | jq -r '.tool_input.content // .tool_input.new_string // ""')

case "$path" in
*/docs/efforts/*/intent.md)
  # Rule A.
  if approves "$incoming"; then
    deny "Approving an intent is the human's decision — it is the Plan gate. Leave status: draft and ask the user to approve it themselves; resolving its open questions is what they are approving."
  fi
  ;;
*/docs/efforts/*/spec.md)
  # Rule B.
  intent="$(dirname "$path")/intent.md"
  [ -f "$intent" ] || deny "No intent.md beside this spec. Design starts from an approved intent — run /to-intent first, or promote the finding through /triage."

  status=$(field "$intent" status)
  [ "$status" = "approved" ] || deny "$intent is status: ${status:-unset}. A spec is written from an approved intent — report its unresolved open questions and let the user approve it."

  open=$(unchecked "$intent")
  [ "$open" -eq 0 ] || deny "$intent still has $open unresolved open question(s). Each names what it blocks; the user resolves them, not you."
  ;;
esac
exit 0
