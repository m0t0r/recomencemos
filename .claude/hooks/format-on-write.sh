#!/usr/bin/env bash
# Format what was just written, so the formatter is never a review comment.
#
# oxfmt reads .gitignore and the ignorePatterns in .oxfmtrc.json, but only when
# it walks the tree itself — an explicit path argument bypasses both. So the
# ignored roots are re-checked here rather than trusted to the tool.
#
# PostToolUse: advisory by construction. A formatting failure never blocks a
# write, it just leaves the file for `pnpm format:fix`.
set -uo pipefail

# shellcheck source=./gate-lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/gate-lib.sh"

path=$(cat | jq -r '.tool_input.file_path // ""')
[ -n "$path" ] && [ -f "$path" ] || exit 0

case "$path" in
*/.agents/* | */.claude/* | */node_modules/* | */pnpm-workspace.yaml) exit 0 ;;
*.ts | *.tsx | *.mts | *.cts | *.js | *.jsx | *.mjs | *.cjs | *.json | *.jsonc | *.md | *.css) ;;
*) exit 0 ;;
esac

# The formatter runs from the tree the file is in, so it reads that tree's
# config and binary rather than the launch checkout's -- tree_for() in
# gate-lib.sh is why. A file outside any repository is left alone.
root=$(tree_for "$path") || exit 0
cd "$root" || exit 0
pnpm exec oxfmt "$path" >/dev/null 2>&1 || true
exit 0
