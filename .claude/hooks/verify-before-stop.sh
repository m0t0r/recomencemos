#!/usr/bin/env bash
# The verification loop, as a gate rather than as a good intention.
#
# The playbook's hardest Build requirement is that "a session checks its own work
# and fixes its own mistakes before an engineer sees them". A CLAUDE.md sentence
# asking for that is advice; this makes stopping on red something the session
# cannot do.
#
# Three conditions keep it from being noise:
#
#   - It never fires twice. `stop_hook_active` means we already blocked once this
#     turn; blocking again on a failure the session cannot fix is a loop.
#   - It only fires when tracked CODE changed. A conversation or a doc edit does
#     not run the suite. A hook edit does: the stage hooks are this repo's own
#     logic, and `gate-test.sh` is the suite that covers them. So does a migration
#     or a journal, which are what `migrations:check` reads (NFR30, DD13).
#   - Turborepo caches every task it runs, so a clean tree costs about a second.
#
# THE TREE IS READ FROM THE PAYLOAD, and that is not tidiness. This hook used to
# `cd "$CLAUDE_PROJECT_DIR"`, which keeps naming the checkout the session launched
# from even after the session enters a worktree -- so in a worktree session it ran
# `git status` against the MAIN checkout, found it clean, and exited at the
# changed-file test below having verified nothing at all. The strongest gate in
# the Build stage silently did nothing for exactly the sessions the worktree rule
# now makes standard. tree_for() in gate-lib.sh carries the measurement.
#
# See README "The Build stage" and CLAUDE.md "Verifying your work".
set -uo pipefail

# shellcheck source=./gate-lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/gate-lib.sh"

input=$(cat)
[ "$(printf '%s' "$input" | jq -r '.stop_hook_active // false')" = "true" ] && exit 0

command -v git >/dev/null 2>&1 || exit 0

root=$(tree_for "$(printf '%s' "$input" | jq -r '.cwd // ""')") || exit 0
cd "$root" || exit 0

# Staged, unstaged, and untracked alike. Untracked counts: a source file the
# session just created is the work product, and genuinely ignored scratch never
# shows up in `git status` without --ignored.
changed=$(git status --porcelain 2>/dev/null |
  sed -E 's/^.{3}//; s/^.* -> //; s/^"(.*)"$/\1/' |
  grep -E '\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|css|sh|sql)$|(^|/)(package\.json|turbo\.json|tsconfig\.json|next\.config\.ts)$|(^|/)\.claude/settings(\.local)?\.json$|(^|/)meta/_journal\.json$' || true)

[ -n "$changed" ] || exit 0

block() {
  jq -nc --arg r "$1" '{decision: "block", reason: $r}'
  exit 0
}

# A fresh worktree has no node_modules of its own, and it cannot borrow the main
# checkout's: the workspace symlinks are relative, so every @repo/* in a worktree
# resolves inside that worktree or not at all. `pnpm exec` installs on demand and
# `pnpm run` does not, so without this the first stop in a new worktree blocks on
# a missing-binary error that names neither the cause nor the fix.
if [ ! -d "$root/node_modules" ]; then
  block "This worktree has no node_modules, so none of the checks below can run — and a check that could not run is not a check that passed. Run \`pnpm install\` here first; the store is shared with the main checkout, so it costs seconds rather than a full download."
fi

out=$(pnpm lint 2>&1) || block "\`pnpm lint\` fails, so this change is not done. Fix it rather than relaxing --max-warnings 0; a scoped overrides entry or an oxlint-disable-next-line with a reason is the escape hatch, not the flag.

$out"

# `pnpm format` is `oxfmt --check`, so this reports rather than rewrites.
#
# It is here because its absence was measured rather than predicted: three files
# under `docs/` sat unformatted on `dev`, every local `pnpm format:fix` rewrote
# them, and 54 lines of unrelated churn then appeared in whatever change its
# author happened to be writing. During #80 that happened three times and was
# reverted three times. The cost of formatting drift is always paid by a
# *different* change than the one that caused it, which is why neither the author
# nor the reviewer ever has the incentive to fix it.
#
# The remedy is `pnpm format:fix`, never hand-formatting -- and never widening
# `ignorePatterns` to make a file pass. That list is for files another tool owns
# (`pnpm-workspace.yaml`, `packages/domain/drizzle/`, committed advisories), and
# adding to it to silence this gate removes the gate for everything in the
# pattern.
out=$(pnpm format 2>&1) || block "\`pnpm format\` fails, so this change is not done. Run \`pnpm format:fix\` -- do not hand-format, and do not add the file to oxfmt's ignorePatterns to make this pass.

$out"

# The root scripts, and nothing restated. This used to spell out the task list
# behind `pnpm test`, which meant anything added to that script had to be added
# here too or a session could report done with the new gate red -- the drift
# CLAUDE.md names for CI in the same words. Two turbo invocations instead of
# one cost a fraction of a second; a list in two places cost a gate.
out=$(pnpm check-types 2>&1) || block "\`pnpm check-types\` fails, so this change is not done.

$out"

out=$(pnpm test 2>&1) || block "\`pnpm test\` fails, so this change is not done. It runs the package suites, the gate suite, the spec-identifier reader and migration integrity; the output names which.

$out"

exit 0
