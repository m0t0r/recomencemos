#!/usr/bin/env bash
# Shared by the stage gates. Sourced, never run: each gate reads the PreToolUse
# payload on stdin and calls deny() to refuse the write.
#
# See README "The Plan gate" and "The Design gate".

deny() {
  jq -nc --arg r "$1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $r
    }
  }'
  exit 0
}

frontmatter() { awk 'NR==1 && $0=="---" {f=1; next} f && $0=="---" {exit} f' "$1"; }

# One frontmatter value, with any trailing "# comment" and padding removed. A
# leading "#" survives, so `issue: #12` reads back as `#12`.
field() {
  frontmatter "$1" | sed -nE "s/^$2:[[:space:]]*//p" | head -1 |
    sed -E 's/[[:space:]]+#.*$//; s/[[:space:]]+$//'
}

unchecked() { grep -cE '^[[:space:]]*- \[ \]' "$1" || true; }

approves() { printf '%s' "$1" | grep -qE '^status:[[:space:]]*approved([[:space:]]|$)'; }

# Everything between a heredoc marker and its terminator is DATA, not commands.
# A merge or approval command named inside a commit message is prose, and a gate
# that reads prose as an act refuses the very commit that documents it — which is
# how this function came to exist. Strip the bodies, then anchor every match at a
# command position.
#
# The marker's quoting is removed by dropping every non-word character, so the
# awk program needs to contain neither quote style. No \b and no GNU-only sed:
# BSD awk and GNU awk must agree.
strip_heredocs() {
  awk '
    inhd {
      t = $0
      sub(/^[[:space:]]+/, "", t)
      if (t == term) inhd = 0
      next
    }
    {
      print
      if (match($0, /<<-?[[:space:]]*[^[:space:];&|<]+/)) {
        term = substr($0, RSTART, RLENGTH)
        sub(/^<<-?[[:space:]]*/, "", term)
        gsub(/[^A-Za-z0-9_]/, "", term)
        if (term != "") inhd = 1
      }
    }
  '
}

# A command position: the start of a line, or just after a shell operator.
CMD_START='(^|[;&|(]|&&|\|\|)[[:space:]]*'
