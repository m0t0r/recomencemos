# The two assertions in `lib.sh`, driven the way every other file here drives a
# gate. They are the one piece of this suite with no test above it: a gate that
# refuses correctly is reported by `expect_run`, so an `expect_run` that is wrong
# about its own answer is invisible in exactly the place a reader looks.
#
# That is not hypothetical. `matches` used to feed the text through a pipe, the
# runner sets `pipefail`, and `grep -q` exits the instant it matches -- so a
# writer still writing when the reader went away died of SIGPIPE and the
# pipeline reported 141 while grep had reported a match. The window opens once
# the text no longer fits one buffered write and the match sits near the top,
# which is the shape of every long refusal this suite asserts on. Two CI runs on
# one unchanged branch failed one case each, in different files, and both read
# as a contradiction: an output printed directly underneath the words saying it
# did not match. The lead-match cases below are that bug, and they fail against
# the pipe.

# `matches` in a subshell carrying the runner's own shell options, because
# `pipefail` is half of what went wrong and a case that dropped it would pass
# against the bug. The payload is built inside the subshell so its size is the
# case's rather than this file's.
matches_case() { # name expect-exit pattern lead|trail filler-bytes
  expect_run "$1" "$2" - -- bash -c '
    set -uo pipefail
    HOOKS="$1"
    . "$HOOKS/tests/lib.sh"
    line="a refusal naming the append-only journal"
    filler=$(printf "%*s" "$4" "")
    if [ "$3" = lead ]; then text="$line
$filler"; else text="$filler
$line"; fi
    matches "$2" "$text"
  ' _ "$HOOKS" "$3" "$4" "$5"
}

section "Assertions: a match is a match whatever the output's size"

# 200 KB is comfortably past one buffered write on every libc this runs on, so
# the reader is gone long before the writer is done.
matches_case "a long output matching on its first line"   0 "append-only" lead  200000
matches_case "a long output matching on its last line"    0 "append-only" trail 200000
matches_case "a short output matching on its first line"  0 "append-only" lead  0
matches_case "a long output that genuinely does not match" 1 "no such words" lead 200000
matches_case "an ERE, not a literal"                      0 "append(-only)?" lead 200000

section "Assertions: EMPTY and the pattern that asserts nothing"

matches_case "EMPTY against text is a failure"            1 "EMPTY" lead 0
matches_case "a dash asserts nothing about a long output"  0 "-"     lead 200000

# EMPTY against genuinely empty text cannot go through the helper above, which
# always writes a line. It is the one case that builds its own payload.
expect_run "EMPTY against no output at all" 0 - -- bash -c '
  set -uo pipefail
  HOOKS="$1"
  . "$HOOKS/tests/lib.sh"
  matches EMPTY ""
' _ "$HOOKS"

section "Assertions: expect_run reports its own answer honestly"

# The end-to-end shape of the bug: a command refusing with a long message whose
# first line is what the case asserts on. `expect_run` must report this as a
# pass, which in quiet mode means printing nothing at all -- a `ko` would print
# `FAIL`. Its bookkeeping is pointed at a scratch file so this case cannot
# disturb the count the runner is keeping.
expect_run "a long refusal matching early is a pass, not a FAIL" 0 EMPTY -- bash -c '
  set -uo pipefail
  HOOKS="$1"
  RESULTS="$2"
  VERBOSE=0
  . "$HOOKS/tests/lib.sh"
  section "inner"
  expect_run "a refusal with a long message" 1 "append-only" -- bash -c "
    printf %s\\\\n \"the journal is append-only\"
    printf \"%*s\" 200000 \"\"
    exit 1
  "
' _ "$HOOKS" "$ROOT/.assertions-inner-results"
