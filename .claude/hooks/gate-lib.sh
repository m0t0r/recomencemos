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
# Two errors are fatal, because every line they swallow is a command no gate sees
# and the gate allows it (#135): announcing a body bash would not read, and ending
# one later than bash would. Declining to announce a body can only make the gate
# read MORE, which at worst refuses prose loudly. So each rule below narrows what
# counts as a marker or ends a body where bash ends it, and a marker the gate
# cannot resolve is read rather than guessed at.
#
#   - The terminator is the marker word after quote removal and nothing else --
#     the rule scripts/spec-identifiers.mjs follows. Quotes are removed the way
#     bash removes them, so `<<END-OF-MSG` ends at `END-OF-MSG`, `<<'END MSG'` at
#     `END MSG`, and `<<'E"F'` at `E"F`.
#   - A body line is compared whole. Leading TABS are stripped only for `<<-`, and
#     spaces never, so an indented `  EOF` in a plain body is still body.
#   - `<<<` is a here-string and `<<=` an assignment; neither announces a body.
#     Nor does a `<<` inside `$(( ))` or a `(( ))` opened at a word boundary,
#     where it is a shift, nor one after a `#` that opens a comment. Arithmetic
#     is depth-counted and may span lines.
#   - A marker word holding `$` or a backtick, or a quote left open at the end
#     of the line, is not treated as a heredoc, so the lines after it are read as
#     commands. Bash would take `<<$D` literally; the gate declines to, because
#     the failure it cannot afford is the silent one.
#   - Several heredocs on one line are queued and read in order, each to its own
#     terminator. An unterminated one is body to the end, as in bash.
#
# ONE FATAL GAP IS KNOWN AND LEFT OPEN: quoting outside the marker is not
# tracked, so a `<<` inside a quoted string (`--body "see <<EOF"`) announces a
# body bash would not read, and the lines after it go unseen. Tracking it means
# following `"$(cat <<'EOF'` into a substitution inside a double quote -- the
# shape every commit message here takes -- and that is a shell parser, which
# these gates deliberately are not. Branch protection on the remote is the seal.
#
# The quote characters arrive through -v so the awk program contains neither
# quote style. No \b and no GNU-only functions: BSD awk, GNU awk and mawk must
# agree.
strip_heredocs() {
  awk -v sq="'" -v dq='"' '
    BEGIN { head = 1; tail = 0; arith = 0 }

    function scan(line,   n, i, j, c, prev, dash, term, ch, q, unresolved) {
      n = length(line)
      prev = " "
      i = 1
      while (i <= n) {
        c = substr(line, i, 1)
        if (arith > 0) {
          if (c == "(") arith++
          else if (c == ")") arith--
          prev = c; i++
          continue
        }
        if (c == "#" && prev ~ /[[:space:];&|(]/) return
        if (c == "(" && substr(line, i + 1, 1) == "(" && (prev == "$" || prev ~ /[[:space:];&|(]/)) {
          arith = 2; prev = "("; i += 2
          continue
        }
        if (c == "<" && substr(line, i + 1, 1) == "<") {
          ch = substr(line, i + 2, 1)
          if (ch == "<" || ch == "=") { prev = " "; i += 3; continue }
          j = i + 2
          dash = 0
          if (substr(line, j, 1) == "-") { dash = 1; j++ }
          while (j <= n && substr(line, j, 1) ~ /[ \t]/) j++
          # The marker word, with quote removal as bash does it: inside single
          # quotes everything is literal; inside double quotes a backslash
          # escapes only " \ $ and backtick; outside, a backslash escapes the
          # next character and a metacharacter ends the word.
          term = ""
          q = ""
          unresolved = 0
          while (j <= n) {
            ch = substr(line, j, 1)
            if (ch == "$" || ch == "`") unresolved = 1
            if (q == sq) {
              if (ch == sq) q = ""
              else term = term ch
            } else if (q == dq) {
              if (ch == dq) q = ""
              else if (ch == "\\" && index(dq "\\$`", substr(line, j + 1, 1)) > 0 && j < n) { j++; term = term substr(line, j, 1) }
              else term = term ch
            } else if (ch ~ /[[:space:];&|<>()]/) {
              break
            } else if (ch == sq || ch == dq) {
              q = ch
            } else if (ch == "\\") {
              if (j == n) unresolved = 1
              else { j++; term = term substr(line, j, 1) }
            } else {
              term = term ch
            }
            j++
          }
          if (q != "") unresolved = 1
          if (term != "" && !unresolved) { tail++; qterm[tail] = term; qdash[tail] = dash }
          prev = " "; i = j
          continue
        }
        prev = c; i++
      }
    }

    head <= tail {
      t = $0
      if (qdash[head]) sub(/^\t+/, "", t)
      if (t == qterm[head]) head++
      next
    }
    { print; scan($0) }
  '
}

# A command position: the start of a line, or just after a shell operator.
CMD_START='(^|[;&|(]|&&|\|\|)[[:space:]]*'

# The same command positions as a split: one command per output line, leading
# whitespace trimmed. Rules G and K read a command this way because each has to
# look past its first word -- at a subcommand, a flag, a refspec -- and neither
# question survives a regex over the whole command. Feed it a command whose
# heredoc bodies are already stripped.
segments_of() {
  tr ';&|(){}' '\n\n\n\n\n\n\n' | sed 's/^[[:space:]]*//'
}

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
