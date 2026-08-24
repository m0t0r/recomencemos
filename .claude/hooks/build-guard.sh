#!/usr/bin/env bash
# Build-phase write guard. Two rules, enforced before the write lands.
#
#   H. A vendored skill is never hand-edited.
#   I. A credential is never written into the repo.
#
# Rule H's test is mechanical rather than a hand-kept list: skills-lock.json is
# the install manifest, so a skill named in it belongs to its upstream and
# `skills update` will overwrite anything done to it here. The repo's own skills
# live in the same directory and are NOT in the lock — that is exactly what
# forking one means (docs/agents/forked-skills.md), so the lock stays the right
# question to ask. `impeccable` is vendored by its own installer and never enters
# the lock, so it is named.
#
# The guard watches Write and Edit only. The installers write through Bash, so
# `npx skills add` and impeccable's installer keep working; what is refused is a
# hand edit, which is the thing that gets silently clobbered.
#
# Rule I is deliberately narrow: only credential formats that are unambiguous on
# sight. A blocking hook that cries wolf is a blocking hook someone turns off, so
# there is no "looks like a secret" heuristic here.
#
# See README "The Build stage".
set -uo pipefail

root="${CLAUDE_PROJECT_DIR:-.}"

# shellcheck source=./gate-lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/gate-lib.sh"

input=$(cat)
case "$(printf '%s' "$input" | jq -r '.tool_name // ""')" in
  Write | Edit) ;;
  *) exit 0 ;;
esac

path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // ""')
incoming=$(printf '%s' "$input" | jq -r '.tool_input.content // .tool_input.new_string // ""')

# Rule H.
case "$path" in
*/.agents/skills/*/* | */.claude/skills/*/*)
  skill=$(printf '%s' "$path" | sed -nE 's|.*/\.(agents\|claude)/skills/([^/]+)/.*|\2|p')
  lock="$root/skills-lock.json"

  vendored=no
  [ "$skill" = "impeccable" ] && vendored=yes
  if [ "$vendored" = no ] && [ -f "$lock" ]; then
    jq -e --arg s "$skill" '.skills | has($s)' "$lock" >/dev/null 2>&1 && vendored=yes
  fi

  if [ "$vendored" = yes ]; then
    deny "'$skill' is a vendored skill: skills-lock.json is an install manifest, so \`skills update\` and \`skills experimental_install\` both overwrite whatever you write here. Re-run the installer instead. If the procedure itself genuinely differs, fork it — that means leaving the lock and adding a row to docs/agents/forked-skills.md. Do not fork for a small diff: put the coupling in an artifact this repo owns (the spec template, docs/policy/, docs/agents/issue-tracker.md) so the vendored skill picks it up through what it already reads."
  fi
  ;;
*/docs/efforts/*/advisories/*)
  deny "Advisories are committed verbatim and never edited after the fact — /spec-review reads them to check what the synthesis dropped, and an edited advisory is one that can no longer disagree with the spec. Record the disagreement in the spec's Further Notes instead."
  ;;
*/pnpm-lock.yaml)
  deny "pnpm owns pnpm-lock.yaml. Change dependencies with \`pnpm add\`/\`pnpm remove\`/\`pnpm update\` and let it write the lock; a hand-edited lockfile passes review and fails install."
  ;;
esac

# Rule I.
secret=""
printf '%s' "$incoming" | grep -qE 'AKIA[0-9A-Z]{16}' && secret="an AWS access key id"
printf '%s' "$incoming" | grep -qE 'gh[pousr]_[A-Za-z0-9]{36}' && secret="a GitHub token"
printf '%s' "$incoming" | grep -qE 'sk-ant-[A-Za-z0-9_-]{24}' && secret="an Anthropic API key"
printf '%s' "$incoming" | grep -qE 'xox[baprs]-[A-Za-z0-9-]{12}' && secret="a Slack token"
printf '%s' "$incoming" | grep -qE -- '-----BEGIN [A-Z ]*PRIVATE KEY-----' && secret="a private key"

if [ -n "$secret" ]; then
  deny "This write contains what looks like $secret. Credentials do not go in the repo, and one committed is one to rotate — git keeps it after the deleting commit. Put it in the environment and read it from there; docs/policy/security.md records where this project's secrets live."
fi

exit 0
