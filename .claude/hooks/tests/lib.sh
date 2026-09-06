#!/usr/bin/env bash
# Shared by every file under tests/. Sourced by gate-test.sh, never run.
#
# Two things live here and nothing else: how an outcome is reported, and the two
# assertions every case is written with. A test file that needs a runner of its
# own writes a one-line adapter over one of these -- the arguments it adds are
# the gate's, the bookkeeping is not. Twelve copies of the same ten lines is
# what this file replaced.
#
# The runner exports HOOKS, REPO, ROOT, VERBOSE and RESULTS before sourcing a
# test file, and CLAUDE_PROJECT_DIR points at ROOT for the hooks that read it.

PLAN="$HOOKS/plan-to-design-gate.sh"
BUILD="$HOOKS/design-to-build-gate.sh"
GUARD="$HOOKS/build-guard.sh"
SHIP="$HOOKS/build-to-deploy-gate.sh"
WT="$HOOKS/worktree-gate.sh"

# --- Reporting ---------------------------------------------------------------

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

# One line per outcome into $RESULTS rather than a counter, because each test
# file runs in a subshell of its own and a variable it increments dies with it.
ok() { # name detail
  sec_pass=$((sec_pass+1)); echo ok >> "$RESULTS"
  [ "$VERBOSE" = 1 ] && printf '  ok   %-51s -> %s\n' "$1" "$2"
  return 0
}

ko() { # name detail [line...]
  sec_fail=$((sec_fail+1)); echo fail >> "$RESULTS"; show_header
  printf '  FAIL %-51s -> %s\n' "$1" "$2"
  shift 2
  for line in "$@"; do printf '       %s\n' "$line"; done
  return 0
}

# --- Assertions --------------------------------------------------------------

# A PreToolUse payload through the stage hooks, as Claude Code runs them: every
# gate sees every call, and deny wins. The four artifact-and-ship gates are the
# default; a case about one gate names it.
expect_decision() { # name allow|deny json [gate...]
  local name="$1" expect="$2" json="$3" out="" decision="allow" o gate
  shift 3
  [ $# -gt 0 ] || set -- "$PLAN" "$BUILD" "$GUARD" "$SHIP"
  for gate in "$@"; do
    o=$(printf '%s' "$json" | bash "$gate" 2>&1)
    if [ -n "$o" ]; then
      out="$o"
      decision=$(printf '%s' "$o" | jq -r '.hookSpecificOutput.permissionDecision // "ERR"' 2>/dev/null || echo ERR)
      [ "$decision" = "deny" ] && break
    fi
  done
  if [ "$decision" = "$expect" ]; then
    ok "$name" "$decision"
  else
    ko "$name" "$decision (want $expect)" "${out:-<empty>}"
  fi
}

# A pattern is an ERE. EMPTY asserts nothing was written; `-` asserts nothing.
# `--` before the pattern: a want like "--pr" is a flag to grep otherwise.
matches() { # pattern text
  case "$1" in
    -) return 0 ;;
    EMPTY) [ -z "$2" ] ;;
    *) printf '%s' "$2" | grep -qE -- "$1" ;;
  esac
}

# A command, judged on its exit code AND its output. Both, because a script that
# crashed on every input would exit non-zero and pass every refusing case on the
# code alone.
#
#   expect_run NAME EXIT PATTERN -- cmd...      stdout and stderr read together
#   expect_run NAME EXIT OUT ERR -- cmd...      each stream asserted on its own
#
# The split form is for a script whose caller is a command substitution: a note
# landing on stdout becomes the answer, so which stream a line took is the case.
expect_run() {
  local name="$1" expect="$2" want_out="$3" want_err="" split=0 out err="" code good=1
  shift 3
  if [ "${1:-}" != "--" ]; then want_err="${1:-}"; split=1; shift || true; fi
  [ "${1:-}" = "--" ] || { ko "$name" "expect_run needs -- before the command"; return 0; }
  shift
  if [ "$split" = 1 ]; then
    out=$("$@" 2>"$ROOT/.expect-run.err")
    code=$?
    err=$(cat "$ROOT/.expect-run.err")
  else
    out=$("$@" 2>&1)
    code=$?
  fi
  [ "$code" = "$expect" ] || good=0
  matches "$want_out" "$out" || good=0
  [ "$split" = 0 ] || matches "$want_err" "$err" || good=0
  if [ "$good" = 1 ]; then
    ok "$name" "exit $code"
  elif [ "$split" = 1 ]; then
    ko "$name" "exit $code (want $expect, out /$want_out/, err /$want_err/)" \
      "out: ${out:-<empty>}" "err: ${err:-<empty>}"
  else
    ko "$name" "exit $code (want $expect matching /$want_out/)" "${out:-<empty>}"
  fi
}

# For a script that reads its directory from the process rather than a flag.
in_dir() { # dir cmd...
  local d="$1"; shift
  (cd "$d" && "$@")
}

# --- Payloads ----------------------------------------------------------------

bj() { jq -nc --arg c "$1" '{tool_name:"Bash",tool_input:{command:$c}}'; }
wj() { jq -nc --arg t "$1" --arg p "$2" --arg c "$3" '{tool_name:$t,tool_input:{file_path:$p,content:$c}}'; }
wtj() { jq -nc --arg c "$1" --arg d "$2" '{tool_name:"Bash",cwd:$d,tool_input:{command:$c}}'; }
