#!/usr/bin/env bash
#
# The deploy path (#9, spec 0002 DD10). `fly.toml` holds everything that is a
# property of the app; this script holds the three things that are properties of
# *this* deploy and cannot be written down in advance.
#
#   1. NEXT_PUBLIC_RELEASE, from the commit being deployed. NFR25 asks for it by
#      name: without it every log line reads `release: "unknown"` while Sentry
#      events carry a release the build plugin injected from HEAD, and the two
#      halves of one incident disagree about which deploy produced it.
#   2. SENTRY_AUTH_TOKEN, as a **build secret** rather than a build argument. A
#      build argument is recorded in the image's own history and readable by
#      anyone who can pull it; this token is write-scoped to a Sentry project.
#   3. The refusal to deploy a dirty or unpushed tree, because a release name
#      that does not name a commit anyone else can fetch is worse than none.
#
# Rollback is not here. It is two commands in
# `docs/runbooks/deploy-and-rollback.md`, deliberately typed by a human who has
# decided to roll back.

set -euo pipefail

cd "$(dirname "$0")/.."

die() {
  printf '\n  %s\n\n' "$1" >&2
  exit 1
}

command -v fly >/dev/null || die "flyctl is not installed. https://fly.io/docs/flyctl/install/"
fly auth whoami >/dev/null 2>&1 || die "flyctl is not logged in. Run: fly auth login"

# --- What is being deployed -------------------------------------------------

RELEASE="$(git rev-parse HEAD)"

if [ -n "$(git status --porcelain)" ]; then
  die "The working tree is dirty. NEXT_PUBLIC_RELEASE would be ${RELEASE:0:7}, which is not what would be running."
fi

if [ -z "$(git branch -r --contains HEAD 2>/dev/null)" ]; then
  die "HEAD is on no remote branch. A release nobody can fetch cannot be looked up when the incident arrives. Push first."
fi

# --- Build-time environment (NFR24: baked in, so none of it is a credential) --

BUILD_ARGS=(--build-arg "NEXT_PUBLIC_RELEASE=${RELEASE}")

# **And again at runtime, which is not redundant.** `NEXT_PUBLIC_*` is inlined
# into the *client* bundle at build time, but `@repo/observability`'s logger is
# externalised out of the server bundle and reads `process.env` when the process
# starts. Pass it only as a build argument and the browser reports the release
# correctly while every server log line reads `release: "unknown"` — which is
# exactly the disagreement NFR25 names, observed on this app's first real deploy.
#
# `--env` and not `fly secrets set`: a secret change restarts the machine, and
# this value is a property of the deploy that is being made anyway.
RUNTIME_ENV=(--env "NEXT_PUBLIC_RELEASE=${RELEASE}")

for var in NEXT_PUBLIC_SENTRY_DSN SENTRY_ORG SENTRY_PROJECT; do
  value="${!var:-}"
  [ -n "$value" ] && BUILD_ARGS+=(--build-arg "${var}=${value}")
done

# `next.config.ts` gates source-map upload on the full triple of SENTRY_ORG,
# SENTRY_PROJECT and this token, so an absent token is a quiet build rather than
# a failing one — and a deploy with no stack-trace symbolication rather than no
# deploy at all.
BUILD_SECRETS=()
if [ -n "${SENTRY_AUTH_TOKEN:-}" ]; then
  BUILD_SECRETS+=(--build-secret "sentry_auth_token=${SENTRY_AUTH_TOKEN}")
else
  printf '  note: SENTRY_AUTH_TOKEN is unset, so this build uploads no source maps.\n' >&2
fi

printf '  deploying %s\n\n' "$RELEASE"

# `--strategy` is deliberately absent: `fly.toml` says `bluegreen`, and a flag
# here would be a second place for that answer to live. Passing one is how a
# deploy silently becomes a rolling one — a stop and a start on a single machine.
exec fly deploy \
  "${BUILD_ARGS[@]}" \
  "${RUNTIME_ENV[@]}" \
  ${BUILD_SECRETS+"${BUILD_SECRETS[@]}"} \
  "$@"
