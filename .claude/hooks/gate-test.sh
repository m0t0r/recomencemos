#!/usr/bin/env bash
# Drive the repo's own gates with fixtures.
#
# This is the runner and nothing else. The cases live one file per thing under
# test in `tests/` -- the stage hooks, the worktree gate, and every script under
# `scripts/` that decides or measures something -- and `tests/lib.sh` holds the
# two assertions they are written with. Adding a gate is adding a file here;
# nothing in this runner names one.
#
# Most of what is driven is a stage hook, fed PreToolUse payloads as Claude Code
# runs them. The rest are the gates that are not hooks at all -- the dependency
# audit, migration integrity, the spec-identifier reader -- and the scripts that
# are not gates but are repo logic all the same: the same kind of thing, and so
# a test suite rather than a script somebody remembers to run.
#
#   pnpm test:gates                  every file, one line per section
#   pnpm test:gates -v               every case enumerated
#   pnpm test:gates migrations       one file, by its name under tests/
#
# Each file runs in a subshell of its own with a fresh fixture root, so no case
# can pass because of a file another one wrote, and a fixture is torn down with
# the file that built it.
set -uo pipefail

HOOKS=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO=$(cd "$HOOKS/../.." && pwd)
TESTS="$HOOKS/tests"

# Quiet on success, like every other test runner here. A hundred ok-lines scroll
# the rest of `pnpm test` off the screen, and Turborepo replays a cache hit's
# stdout verbatim, so the volume was paid on every run rather than only on a
# real one. Failures always print in full, with their section header.
VERBOSE=0
names=()
for a in "$@"; do
  case "$a" in
    -v | --verbose) VERBOSE=1 ;;
    --) ;; # pnpm forwards its own separator through to us
    -*)
      echo "gate-test.sh: unknown option $a" >&2
      exit 2
      ;;
    *) names+=("$a") ;;
  esac
done

if [ ${#names[@]} -eq 0 ]; then
  for f in "$TESTS"/*.sh; do
    n=$(basename "$f" .sh)
    [ "$n" = lib ] || names+=("$n")
  done
fi

# A name that is not a file is refused rather than skipped: a typo that ran
# nothing and reported nothing failed would read as a pass.
for n in "${names[@]}"; do
  if [ ! -f "$TESTS/$n.sh" ] || [ "$n" = lib ]; then
    echo "gate-test.sh: no such test file: tests/$n.sh" >&2
    echo "available: $(cd "$TESTS" && ls ./*.sh | sed 's|^\./||; s|\.sh$||' | grep -v '^lib$' | tr '\n' ' ')" >&2
    exit 2
  fi
done

export HOOKS REPO VERBOSE

# Every file at once, each in its own subshell with its own fixture root and its
# own output file, then the outputs replayed in name order. The files share
# nothing but the scripts under test, so the wall clock is the slowest file
# rather than the sum -- and this suite runs inside every `pnpm test` and every
# Stop hook, so the sum was paid many times a session.
WORK=$(mktemp -d)
pids=()
for n in "${names[@]}"; do
  ROOT="$WORK/$n"
  mkdir -p "$ROOT"
  # The hooks that still fall back to the launch directory get the fixture root,
  # so a case that passes no cwd is judged against the fixture and never against
  # this repository.
  (
    export ROOT CLAUDE_PROJECT_DIR="$ROOT" RESULTS="$WORK/$n.results"
    # shellcheck source=./tests/lib.sh
    . "$TESTS/lib.sh"
    # shellcheck source=/dev/null
    . "$TESTS/$n.sh"
    flush_section
  ) > "$WORK/$n.out" 2>&1 &
  pids+=("$!")
done

# A file that died before its cases ran -- a syntax error, an unbound variable
# under `set -u`, a fixture that could not be built -- has written no results,
# and a tally that only counts what was written would read it as clean. So each
# subshell's exit is read, and a file that exited non-zero or reported nothing
# is a refusal: the suite exits 2, the way every gate here does when it cannot
# reach an answer, rather than 0 with a smaller number.
broken=()
i=0
for n in "${names[@]}"; do
  wait "${pids[$i]}" || broken+=("$n")
  [ -s "$WORK/$n.results" ] || broken+=("$n")
  i=$((i + 1))
done

for n in "${names[@]}"; do
  cat "$WORK/$n.out"
done
pass=$(cat "$WORK"/*.results 2>/dev/null | grep -c '^ok$' || true)
fail=$(cat "$WORK"/*.results 2>/dev/null | grep -c '^fail$' || true)
rm -rf "$WORK"

echo
echo "passed: $pass  failed: $fail"
if [ ${#broken[@]} -gt 0 ]; then
  echo "gate-test.sh: could not reach an answer for: ${broken[*]} (exited non-zero or ran no case)" >&2
  exit 2
fi
[ "$fail" -eq 0 ]
