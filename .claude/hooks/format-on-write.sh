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

root="${CLAUDE_PROJECT_DIR:-.}"
path=$(cat | jq -r '.tool_input.file_path // ""')
[ -n "$path" ] && [ -f "$path" ] || exit 0

case "$path" in
*/.agents/* | */.claude/* | */node_modules/* | */pnpm-workspace.yaml) exit 0 ;;
*.ts | *.tsx | *.mts | *.cts | *.js | *.jsx | *.mjs | *.cjs | *.json | *.jsonc | *.md | *.css) ;;
*) exit 0 ;;
esac

cd "$root" || exit 0
pnpm exec oxfmt "$path" >/dev/null 2>&1 || true
exit 0
