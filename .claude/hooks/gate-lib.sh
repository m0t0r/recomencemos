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

# The checkout a payload is about, as an absolute path — never CLAUDE_PROJECT_DIR.
#
# That variable names the directory the session was LAUNCHED from, and it goes on
# naming the main checkout after the session enters a worktree under
# .claude/worktrees/. Measured, not assumed: a marker added to the worktree's copy
# of build-guard.sh never appeared in the refusal that copy would have produced,
# so the hook that ran was the main checkout's.
#
# Everything downstream of that is wrong in the same direction. A gate reading
# repo state through CLAUDE_PROJECT_DIR reads the tree the work is NOT in: it sees
# a clean status, an unchanged spec, a branch nobody is on. Pass the payload's
# `cwd` here instead, or the file_path of the write being judged, and the answer
# follows the work.
#
# Returns non-zero when the hint names nothing git can resolve, so a caller can
# tell "outside any repository" from "on the default branch". Callers that must
# not guess treat the failure as its own answer rather than as a pass.
tree_for() { # dir-or-file-hint
  local hint="$1" top
  [ -n "$hint" ] || hint="${CLAUDE_PROJECT_DIR:-.}"
  # A Write names a file that may not exist yet, in a directory that may not
  # either, so climb until something does. Stop at the root rather than loop.
  while [ ! -d "$hint" ] && [ "$hint" != "/" ] && [ "$hint" != "." ]; do
    hint=$(dirname "$hint")
  done
  top=$(git -C "$hint" rev-parse --show-toplevel 2>/dev/null) || return 1
  [ -n "$top" ] || return 1
  printf '%s' "$top"
}

# The branch a checkout has, and the branch the remote calls default. Both read
# through `git -C`, so both follow tree_for() rather than the process's cwd.
#
# A detached HEAD returns empty, which is not the default branch and is not
# refused — the acts this repo gates are the ones that put work on a named
# branch.
branch_of() { git -C "$1" symbolic-ref --quiet --short HEAD 2>/dev/null || true; }

# Read from the remote, so a fork that renames its default branch stays covered
# without editing a hook. Same three-step fallback rule G uses.
default_branch_of() {
  local d="$1" default
  default=$(git -C "$d" symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')
  [ -n "$default" ] || default=$(git -C "$d" config --get init.defaultBranch 2>/dev/null) || true
  [ -n "$default" ] || default="main"
  printf '%s' "$default"
}
