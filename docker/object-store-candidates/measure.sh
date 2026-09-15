#!/usr/bin/env bash
# Measure one candidate object store against the photo path's storage checks (#299).
#
#   docker/object-store-candidates/measure.sh <candidate>
#
# Every candidate is measured by this one script, so the numbers in the results
# comment are comparable. It reads `<candidate>/store.env`, which declares:
#
#   STORE_ENDPOINT           the S3 API origin, no trailing slash
#   STORE_PUBLIC_BASE        where an approved photo is read anonymously, up to
#                            and including whatever names the photos bucket
#   STORE_ACCESS_KEY_ID      the credential pair the init service declares
#   STORE_SECRET_ACCESS_KEY
#   STORE_PUBLIC_LIST        the anonymous ListObjectsV2 URL on the public origin
#
# The candidate runs as its own Compose project, `store-<candidate>`, on its own
# loopback ports. The shared `recomencemos` project is never addressed here.
#
# Nothing on this branch merges: the swap ticket that follows the maintainer's
# pick starts from the chosen candidate's directory.

set -uo pipefail

candidate="${1:?usage: measure.sh <candidate>}"
here="$(cd "$(dirname "$0")" && pwd)"
dir="$here/$candidate"
repo="$(cd "$here/../.." && pwd)"
results="$here/results"
project="store-$candidate"

[ -f "$dir/compose.yaml" ] || { echo "no $dir/compose.yaml" >&2; exit 2; }
[ -f "$dir/store.env" ] || { echo "no $dir/store.env" >&2; exit 2; }

set -a
# shellcheck disable=SC1091
. "$dir/store.env"
set +a

mkdir -p "$results"
compose=(docker compose -p "$project" -f "$dir/compose.yaml")

section() { printf '\n== %s\n' "$1"; }

section "up --wait"
"${compose[@]}" up -d --wait
echo "exit=$?"

section "init, first run"
"${compose[@]}" run --rm init
echo "exit=$?"

section "init, second run (idempotency)"
"${compose[@]}" run --rm init
echo "exit=$?"

section "health"
"${compose[@]}" ps --format '{{.Service}}\t{{.Status}}'

section "storage suite"
json="$results/$candidate.json"
(cd "$repo/packages/storage" &&
  pnpm exec vitest run --config vitest.store.config.mts --reporter=json --outputFile="$json" \
    >/dev/null 2>&1)
echo "exit=$?"
jq -r '.testResults[].assertionResults[] |
  "\(.status)\t\(.fullName)" + (if .status == "failed"
    then "\n\t" + ((.failureMessages[0] // "") | split("\n")[0]) else "" end)' "$json"
jq -r '"passed \(.numPassedTests) / \(.numTotalTests)"' "$json"

# Status and the first 300 bytes of the body, so a refusal says what refused.
probe() {
  local label="$1"
  shift
  local out
  out="$(curl -s -o /tmp/store-probe-body.$$ -w '%{http_code}' "$@")"
  printf '%s\t%s\t%s\n' "$label" "$out" "$(head -c 300 /tmp/store-probe-body.$$ | tr '\n' ' ')"
  rm -f /tmp/store-probe-body.$$
}

section "anonymous probes (no credentials)"
probe "list public bucket, public origin" "$STORE_PUBLIC_LIST"
probe "list public bucket, S3 API" "$STORE_ENDPOINT/recomencemos-photos?list-type=2"
probe "list quarantine bucket, S3 API" "$STORE_ENDPOINT/recomencemos-photos-quarantine?list-type=2"
probe "PUT into public bucket, S3 API" -X PUT --data-binary 'anon' \
  -H 'Content-Type: text/plain' "$STORE_ENDPOINT/recomencemos-photos/photos/anon-probe"
probe "PUT into quarantine bucket, S3 API" -X PUT --data-binary 'anon' \
  -H 'Content-Type: text/plain' "$STORE_ENDPOINT/recomencemos-photos-quarantine/quarantine/anon-probe"
probe "PUT into public bucket, public origin" -X PUT --data-binary 'anon' \
  -H 'Content-Type: text/plain' "$STORE_PUBLIC_BASE/photos/anon-probe"
probe "read back the S3 API anon PUT, public origin" "$STORE_PUBLIC_BASE/photos/anon-probe"

section "images"
"${compose[@]}" images --format '{{.Repository}}:{{.Tag}}\t{{.ID}}' 2>/dev/null ||
  "${compose[@]}" images
