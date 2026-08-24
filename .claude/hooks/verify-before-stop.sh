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
#     logic, and `gate-test.sh` is the suite that covers them.
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
  grep -E '\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|css|sh)$|(^|/)(package\.json|turbo\.json|tsconfig\.json|next\.config\.ts)$|(^|/)\.claude/settings(\.local)?\.json$' || true)

[ -n "$changed" ] || exit 0

block() {
  jq -nc --arg r "$1" '{decision: "block", reason: $r}'
  exit 0
}

out=$(pnpm lint 2>&1) || block "\`pnpm lint\` fails, so this change is not done. Fix it rather than relaxing --max-warnings 0; a scoped overrides entry or an oxlint-disable-next-line with a reason is the escape hatch, not the flag.

$out"

out=$(pnpm exec turbo run check-types test test:gates --output-logs=errors-only 2>&1) ||
  block "\`check-types\`, \`test\`, or \`test:gates\` fails, so this change is not done.

$out"

exit 0
