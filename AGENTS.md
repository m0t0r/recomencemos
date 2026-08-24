# AGENTS.md

Repo-wide conventions for coding agents live in [`CLAUDE.md`](./CLAUDE.md) — commands,
architecture, verification steps, and the mistakes that keep recurring. Read it first.
Claude Code loads it automatically; other agents should read it as part of this file.

Two things that are easy to get wrong and are not obvious from the code:

- **Node.** This repo requires the active Node LTS (see `.nvmrc`). `pnpm install` is
  configured to fail rather than warn on an older runtime, so run `fnm use` / `nvm use`
  before installing.
- **Next.js.** Anything under `apps/web` has its own [`AGENTS.md`](./apps/web/AGENTS.md)
  with a block that `next dev` writes and re-adds. It points at the version-matched docs
  bundled in `apps/web/node_modules/next/dist/docs/`. Read those before writing Next.js
  code — this repo runs Cache Components, which changes the caching and prerendering
  model relative to most training data.
