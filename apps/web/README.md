# web

The Next.js 16 App Router app (React 19). Run it from the repo root — the root README carries the
commands, the toolchain requirements, and the Cache Components rules:

```sh
pnpm dev                          # this app at the hostname the banner prints
pnpm exec turbo dev --filter=web  # this app alone
```

There is no port to remember: the dev proxy serves each worktree at its own HTTPS hostname, so the
main checkout is `https://web.recomencemos.localhost` and a worktree prepends its branch. Read the
URL off the banner `portless` prints above Next's own, or ask `portless list`. `PORTLESS=0 pnpm dev`
is the way back to `:3000`, and it is what the Google sign-in door needs.

`AGENTS.md` in this directory points agents at the version-matched Next.js docs bundled in
`node_modules/next/dist/docs/`. Prefer those over recall. Cache Components is on
(`next.config.ts` → `cacheComponents: true`), so data is dynamic by default and reading uncached
data outside a `<Suspense>` boundary is a build error.

This app has no Vitest suite on purpose: Vitest cannot test `async` Server Components, so it
verifies through `next build`, `check-types`, and the `next-dev-loop` skill against a running dev
server. Wire a suite here in the change that first puts real code in the app.
