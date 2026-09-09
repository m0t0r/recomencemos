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
#   3. The refusals: a dirty tree, an unpushed commit, or a branch that is not
#      the release branch. A release name that does not name a commit anyone
#      else can fetch is worse than none, and a deploy from a feature branch puts
#      code in production that never passed the gate on `dev`.
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

# **The binary is `flyctl`; `fly` is a symlink the installer makes.** The release
# tarball contains one file called `flyctl` and nothing else, and fly.io's
# install script is what adds the shorter alias — so `fly` exists on a developer
# machine and does not exist under `superfly/flyctl-actions/setup-flyctl`, which
# untars the release and puts that directory on `PATH`. Checking for `fly` alone
# is why the first deploy from CI died before `fly deploy` was reached. Prefer
# the alias when it is there, because that is what the runbooks tell a human to
# type, and fall back to the name the tarball actually ships.
FLY="$(command -v fly || command -v flyctl || true)"
[ -n "$FLY" ] || die "flyctl is not installed. https://fly.io/docs/flyctl/install/"
"$FLY" auth whoami >/dev/null 2>&1 || die "flyctl is not logged in. Run: fly auth login"

# --- What is being deployed -------------------------------------------------

RELEASE="$(git rev-parse HEAD)"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"

# **`main` is the release branch, and `dev` is not.** `dev` is where tickets
# integrate and where CI's five checks run on every pull request; `main` is what
# is deployed, and reaching it is a deliberate promotion rather than the side
# effect of merging a ticket. `.github/workflows/deploy.yml` is the path that
# normally takes it.
#
# The escape hatch is loud and env-shaped rather than a flag, because it should
# read like something you meant: a rehearsal against production — proving the
# health gate aborts a bad build, say — is a real reason to deploy a branch, and
# pretending otherwise just gets the check commented out.
RELEASE_BRANCH="main"

if [ "$BRANCH" != "$RELEASE_BRANCH" ] && [ "${DEPLOY_ALLOW_BRANCH:-}" != "1" ]; then
  die "On branch '${BRANCH}', and the release branch is '${RELEASE_BRANCH}'. Promote to ${RELEASE_BRANCH}, or set DEPLOY_ALLOW_BRANCH=1 for a deliberate rehearsal."
fi

if [ -n "$(git status --porcelain)" ]; then
  die "The working tree is dirty. NEXT_PUBLIC_RELEASE would be ${RELEASE:0:7}, which is not what would be running."
fi

if [ -z "$(git branch -r --contains HEAD 2>/dev/null)" ]; then
  die "HEAD is on no remote branch. A release nobody can fetch cannot be looked up when the incident arrives. Push first."
fi

# --- Build-time environment (NFR24: baked in, so none of it is a credential) --

BUILD_ARGS=(--build-arg "NEXT_PUBLIC_RELEASE=${RELEASE}")

# **The build argument is also what puts it in the running process**, and that is
# worth knowing rather than looking redundant. `NEXT_PUBLIC_*` is inlined into
# the *client* bundle by the build, but `@repo/observability`'s logger is
# externalised out of the server bundle and reads `process.env` at start — so the
# `Dockerfile`'s runner stage turns this argument into an image `ENV`. It is not
# passed with `--env` here on purpose: a machine-level value would be dropped by
# a `fly deploy --image <ref>` rollback, and re-supplied from `HEAD` it would
# stamp the *current* commit onto an *older* image.

for var in NEXT_PUBLIC_SENTRY_DSN SENTRY_ORG SENTRY_PROJECT PHOTO_S3_ENDPOINT PHOTO_PUBLIC_BASE; do
  value="${!var:-}"
  [ -n "$value" ] && BUILD_ARGS+=(--build-arg "${var}=${value}")
done

# An origin absent here is an origin the deployed CSP does not name, and that
# failure is silent on the server and fatal in the browser —
# `apps/web/lib/response-headers.ts` is where that is argued. Warned rather than
# refused, because a deploy with no photo path is still a deploy and this script
# has never been the thing that decides what is configured.
for var in PHOTO_S3_ENDPOINT PHOTO_PUBLIC_BASE; do
  if [ -z "${!var:-}" ]; then
    printf '  note: %s is unset, so the built CSP will not name it and photos will be blocked.\n' \
      "$var" >&2
  fi
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
exec "$FLY" deploy \
  "${BUILD_ARGS[@]}" \
  ${BUILD_SECRETS+"${BUILD_SECRETS[@]}"} \
  "$@"
