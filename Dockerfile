# The production image, and it is the **monorepo** rather than the app.
#
# One image has to serve two entry points, which is the whole reason this file
# is shaped the way it is:
#
#   - `next start`, which the machine runs, and
#   - `node /app/packages/domain/src/migrate/cli.ts`, which Fly's
#     `release_command` runs before any machine is replaced (DD10).
#
# Next's `output: "standalone"` traces only what the **server** imports, and the
# migrate CLI is imported by nothing — `@repo/domain` publishes `./health` and
# `./migrate`, and the app takes only the first. A standalone image would
# therefore deploy with no migrator in it, and the release command would fail
# every deploy for a reason that looks like a missing file rather than a design
# mistake. So the runner keeps the workspace layout and installs production
# dependencies into it.
#
# Node 24 because `engines.node` is `>=24` and `engineStrict` makes that a
# failure rather than a warning; `slim` rather than `alpine` because Next ships
# per-platform SWC binaries and the glibc ones are the better-trodden path.

FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# Corepack reads `packageManager` from package.json, so the pinned pnpm 11 is
# the one that runs here too — the version is not restated in this file.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

# ---------------------------------------------------------------------------
# The package store, fetched from the lockfile alone.
#
# `pnpm fetch` reads only `pnpm-lock.yaml`, so this layer is invalidated by a
# dependency change and by nothing else — an ordinary code change reuses it.
# It is a *stage*, never a base for the runner: the store is ~1 GB and must not
# reach the final image, so both consumers reach it through a bind mount.
# ---------------------------------------------------------------------------
FROM base AS store
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm fetch

# ---------------------------------------------------------------------------
# The build.
# ---------------------------------------------------------------------------
FROM base AS builder
COPY . .

RUN --mount=type=bind,from=store,source=/pnpm/store,target=/pnpm/store,rw \
    --mount=type=bind,from=store,source=/root/.cache/pnpm,target=/root/.cache/pnpm,rw \
    pnpm install --frozen-lockfile --offline

# Baked into the build output, which is why they are build arguments rather than
# Fly secrets. `turbo.json` declares all four on `build`; `scripts/deploy.sh` is
# what supplies them.
#
# `NEXT_PUBLIC_RELEASE` is NFR25's: without it every log line reads
# `release: "unknown"` while Sentry events carry a plugin-injected one, and the
# two halves of the same incident disagree about which deploy they came from.
ARG NEXT_PUBLIC_RELEASE
ARG NEXT_PUBLIC_SENTRY_DSN
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ENV NEXT_PUBLIC_RELEASE=$NEXT_PUBLIC_RELEASE
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
ENV SENTRY_ORG=$SENTRY_ORG
ENV SENTRY_PROJECT=$SENTRY_PROJECT

# **A secret, so a mount and not an `ARG`.** A build argument is recorded in the
# image's own history and is readable by anyone who can pull it; this token is
# write-scoped to a Sentry project. It is absent on a build that is not
# uploading source maps, and `next.config.ts` gates the whole upload on the
# triple being present, so an absent token is a quiet build rather than a
# failing one.
RUN --mount=type=bind,from=store,source=/pnpm/store,target=/pnpm/store,rw \
    --mount=type=bind,from=store,source=/root/.cache/pnpm,target=/root/.cache/pnpm,rw \
    --mount=type=secret,id=sentry_auth_token \
    SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token 2>/dev/null || true)" \
    pnpm exec turbo run build --filter=web

# ---------------------------------------------------------------------------
# The runner: two trees, deliberately kept apart.
#
#   /app        Next's standalone output — the traced server and nothing else.
#   /migrator   `@repo/domain` with the production dependencies its CLI needs.
#
# **They are separate directories because a `pnpm install` under `/app` would
# rewrite `/app/node_modules`**, and the only two things in there are
# `import-in-the-middle` and `require-in-the-middle` — the module-interception
# packages `@sentry/nextjs` loads by bare specifier from inside its own server
# instrumentation, which `pnpm-workspace.yaml` public-hoists for exactly that
# reason. Losing them would take error reporting down on a machine whose health
# check still answers 200.
# ---------------------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production

# The migrator first, so the layer that changes least often sits lowest: it is
# invalidated by the lockfile and by `packages/`, not by an app change.
WORKDIR /migrator
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
# Every workspace manifest, because `--frozen-lockfile` verifies the lockfile
# against the whole workspace and not against the one project being filtered.
COPY apps/web/package.json ./apps/web/package.json
COPY packages ./packages

# `--filter @repo/domain` and not `@repo/domain...`: the CLI's import graph is
# `#migrate` → `drizzle-orm`, `pg`, `#config` → `@repo/errors` (which has no
# dependencies at all, by design) → and nothing else. `@repo/observability` is a
# declared dependency of the package but is unreachable from this entry point,
# and deliberately so — its own docstring records that importing the logger here
# fails at module load, because `@sentry/nextjs` is CommonJS and a release
# command has no bundler. Pulling its tree in would add ~80 MB to serve an
# import that must never exist.
RUN --mount=type=bind,from=store,source=/pnpm/store,target=/pnpm/store,rw \
    --mount=type=bind,from=store,source=/root/.cache/pnpm,target=/root/.cache/pnpm,rw \
    pnpm install --frozen-lockfile --offline --prod --filter @repo/domain

# The server. `.next/static` is emitted *beside* the standalone tree rather than
# inside it, so it is a second COPY — miss it and the app serves HTML with no
# CSS or JS, which looks like a styling bug rather than a packaging one.
WORKDIR /app
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

EXPOSE 3000

# `HOSTNAME=0.0.0.0` explicitly: Fly's proxy reaches the machine over its
# private network, and a server bound to loopback answers nothing while looking
# perfectly healthy from inside the container. The standalone server reads both
# of these from the environment.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
