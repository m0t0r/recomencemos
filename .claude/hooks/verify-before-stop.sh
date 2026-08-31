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
# See README "The Build stage" and CLAUDE.md "Verifying your work".
set -uo pipefail

root="${CLAUDE_PROJECT_DIR:-.}"
cd "$root" || exit 0

input=$(cat)
[ "$(printf '%s' "$input" | jq -r '.stop_hook_active // false')" = "true" ] && exit 0

command -v git >/dev/null 2>&1 || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

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

# The task list is restated here rather than run through `pnpm test`, and that is
# a drift risk CLAUDE.md names for CI in the same words -- so anything added to
# the root `test` script has to be added here too, or a session can report done
# with the new gate red. `migrations:check` is the live half of NFR30.
out=$(pnpm exec turbo run check-types test test:gates spec-identifiers migrations:check --output-logs=errors-only 2>&1) ||
  block "\`check-types\`, \`test\`, \`test:gates\`, \`spec-identifiers\`, or \`migrations:check\` fails, so this change is not done.

$out"

exit 0
