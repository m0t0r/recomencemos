# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

**Recomencemos**, a product. It connects people in Pereira, Dosquebradas and Santa Rosa de Cabal (Risaralda, Colombia) who lost their income in the 10 August 2026 earthquake with anyone, anywhere, willing to pay them for work — and it introduces the two sides and then steps out of the way. It is a Turborepo/pnpm monorepo (Next.js 16 + React 19), built with the AI-native SDLC described in <https://claude.com/blog/the-ai-native-sdlc-playbook>.

This repository was a project template before it was this product, and it stopped being one deliberately. Nothing here is judged by what it does for a downstream clone any more.

Four consequences for how you work here:

- **A change is judged by what it does for a Worker publishing from a phone and a Hirer sending a concrete Offer.** Not by what it does for a demo, and not by what it would do for someone else's project.
- **[`docs/efforts/0002-profile-to-contact-exchange/spec.md`](docs/efforts/0002-profile-to-contact-exchange/spec.md) is the authority on what gets built**, [`CONTEXT.md`](CONTEXT.md) is the binding vocabulary in both languages, [`PRODUCT.md`](PRODUCT.md) is why the product is shaped this way, and [`docs/policy/voice.md`](docs/policy/voice.md) is the binding register for every string a person reads. A ticket that contradicts one of them is a spec amendment, not a ticket.
- **Three refusals hold the design together, and each is load-bearing rather than a limitation to route around**: the platform never handles money ([ADR-0007](docs/adr/0007-the-platform-never-handles-money.md)), verifies nobody and publishes that absence ([ADR-0008](docs/adr/0008-open-enrolment-with-published-non-verification.md)), and adjudicates nothing — no ratings, no reviews, no reputation, no arbitration. A feature that quietly reintroduces one is the failure mode to watch for.
- **What is genuinely still unbuilt is listed in `README.md` under "Still to replace"**, and each row names who owns it. Add a row when something lands half-done rather than leaving it implied; delete a row when it is done.

## Before you change anything: open a worktree

**If this session is going to change anything, open a worktree first — before the first write, not
before the first commit.** Use the harness's worktree tool. This is not scoped to Build sessions or
to parallel ones: an ADR, a spec amendment, a runbook edit and a one-line fix are all work, and none
of them is written in the checkout that has `dev` out. Reading, searching, running the suite and
exploring on `dev` need no worktree at all.

Three things follow immediately, and each has cost a session:

- **Rename the branch.** The tool names it for itself — asked for `chore/foo` it produces
  `worktree-chore+foo`. `git branch -m ticket/<issue>-<slug>` (or `<type>/<slug>` for work with no
  ticket) before writing anything, because a branch that does not match those patterns is one neither
  the frontier query nor the PR linkage can read.
- **A worktree isolates git and nothing else.** No `node_modules` until you run `pnpm install` in it,
  no `.env.local`, and the Docker database on 5432/6432 is shared with every other tree. The **dev
  server is not** — see the `pnpm dev` paragraph under **Commands**, which is what
  [ADR-0018](docs/adr/0018-a-dev-server-is-reached-by-name-not-by-port.md) bought.
- **Use absolute paths.** The shell's working directory does not reliably persist between calls, and
  the same relative path exists in both trees — so a relative write lands in the main checkout
  silently, and the tests pass identically either way.

`.claude/hooks/worktree-gate.sh` rule K refuses a commit made in a checkout that has the default
branch out, which is the backstop rather than the mechanism: a session that opened a worktree never
reaches it. [ADR-0017](docs/adr/0017-work-is-written-in-a-worktree-and-merged-into-the-default-branch.md)
is why, `docs/policy/build.md`'s `worktree-required` is the policy, and
`docs/agents/issue-tracker.md` → "Working in a worktree" is the procedure, including the stacked-PR
case the harness tool cannot serve and the cleanup after a merge.

**A hook reads repo state through its payload, never through `CLAUDE_PROJECT_DIR`** — that
variable names the main checkout even inside a worktree. `.claude/hooks/CLAUDE.md` has why, and the
helper to use.

## Commands

Run from the repo root; `turbo` fans out to every workspace — the scripts are in `package.json`. pnpm 12 is pinned via `packageManager`; do not use npm/yarn.

**`pnpm dev` serves each worktree at its own HTTPS hostname, and there is no port to hold in your
head** ([ADR-0018](docs/adr/0018-a-dev-server-is-reached-by-name-not-by-port.md)). `apps/web`'s `dev`
script is `portless`, which assigns an ephemeral port, injects it as `PORT`, and runs `dev:app`
(`next dev`) behind a proxy on 443. In a linked worktree it prepends the **branch name**, so parallel
sessions cannot collide and a URL says which tree produced it:

```
https://web.recomencemos.localhost                 # the main checkout
https://124-add-widget.web.recomencemos.localhost  # ticket/124-add-widget
```

Four things follow, and each has a reason rather than a preference behind it:

- **Read the URL off the banner `portless` prints**, above Next's own. `portless list` is what answers
  "is the server on this route mine" — it replaced `lsof -i :3000`, which could not tell two trees
  apart.
- **The origin is HTTPS, and that is load-bearing rather than cosmetic.** `secureCookies()` and Better
  Auth's `useSecureCookies` both derive `Secure` from whether the base URL is `https://`, so
  development now exercises the cookie path production uses. It did not at `http://localhost:3000`,
  and that gap already cost this repo one real bug — the comment above
  `SIGN_IN_CHALLENGE_COOKIE_ATTRIBUTES` in `packages/domain/src/admin/challenge.ts` is the record.
- **`BETTER_AUTH_URL` is not what the app runs at under the proxy.** `authBaseUrl` in
  `packages/domain/src/auth/config.ts` prefers `PORTLESS_URL` outside production, because the
  hostname carries the branch and no static `.env.local` value can be right for every worktree at
  once. Do not "fix" `.env.local` to match a hostname you saw.
- **A command run from a second terminal is a child of nothing, so it asks.** `scripts/dev-origin.mjs`
  puts the question to the proxy — `portless get` for the hostname this tree would register, then
  `portless list` for whether it is registered — and prints the origin or nothing. `pnpm admin:enrol`
  is wired to it, which is what makes its setup link open; `pnpm dev:origin` is the same answer by
  hand. Nothing is printed when no route exists, so `PORTLESS=0` and a stopped server both fall back
  to `BETTER_AUTH_URL`, and an explicitly set `PORTLESS_URL` still wins over both.
- **`PORTLESS=0 pnpm dev` is the way back to `:3000`**, and it is what the **Google sign-in door**
  needs — Google will not register a `.localhost` redirect URI. The variable is declared in
  `turbo.json`'s `globalPassThroughEnv`; without that declaration `strict` environment mode filters it
  out and the bypass fails silently.

The proxy is installed once per machine by a human, because binding 443 needs privilege an agent does
not have: [`docs/runbooks/portless-setup.md`](docs/runbooks/portless-setup.md). If `pnpm dev` reports
no running proxy, that runbook is the fix — not a `--port` flag added back to the script.

**`pnpm page-weight` is how NFR3's byte budget is checked, and it is the only way it may be quoted.**
`scripts/first-load-bytes.mjs` reads a production build — run `pnpm build` first — and prints, per
route, every `<script src>` the prerendered document requests, each chunk compressed on its own and
summed, in gzip and brotli, with the `noModule` polyfill bundle excluded and reported separately
because no browser inside NFR5's floor fetches it. Pass route paths (`pnpm page-weight / /publish`)
to narrow it. It blocks nothing and exits `2` rather than `0` when it cannot reach an answer — a
route with no prerendered document, a chunk the build does not contain, a script served from
somewhere else. **A figure quoted from memory is how three documents came to carry numbers 39 KB too
high for two efforts** (#157): re-take it rather than repeat it, and name the compression wherever it
is written down.

`lint` and `format` are Turborepo **root tasks** (`//#lint`, `//#format`), not per-package scripts — oxlint and oxfmt are fast enough to cover the whole repo in one pass, so `apps/web` and `packages/design-system` have no `lint` script of their own. `pnpm exec turbo run quality` runs both checks; `quality:fix` runs `lint:fix` then `format:fix` (in that order, so the formatter has the last word).

## Toolchain

The repo requires the **active Node LTS** (24.x) and **pnpm 12**, and it enforces both rather than suggesting them:

- `engines.node` is `>=24` (major-version compatibility only — any 24.x satisfies it), and `engineStrict: true` in `pnpm-workspace.yaml` makes `pnpm install` **fail** on an older runtime instead of printing a warning. `.npmrc` sets the equivalent `engine-strict=true` so a stray `npm install` fails the same way — pnpm reads its own settings from `pnpm-workspace.yaml`, not `.npmrc`, which is why both exist. `engines.pnpm` is `>=12` and is enforced the same way: pnpm 11 against this repo exits `ERR_PNPM_UNSUPPORTED_ENGINE` rather than installing.
- `.nvmrc` says `24`, so `fnm use` / `nvm use` picks the latest installed 24.x. If `pnpm install` refuses to run, the fix is `fnm use` / `nvm use`, not editing `engines`.
- **TypeScript is 7.x** (pinned exactly, same version in the root and every workspace). TS 7 is the native compiler, and it ships **only a `tsc` binary** — there is no `tsserver`, and the JavaScript compiler API is gone (`node_modules/typescript` exports just the version string plus `./unstable/*` entry points). Two things follow:
  - `next build` type-checks by shelling out to the project-local `tsc` CLI, which is the Next 16 default. Do **not** set `experimental.useTypeScriptCli: false` — that switches Next back to the JS compiler API, which TS 7 does not provide, and the build exits. Diagnostics come out as plain `tsc` output without Next's code frames.
  - The `plugins: [{ "name": "next" }]` entry in the tsconfigs is a **tsserver** plugin, so it does nothing while an editor is pointed at the workspace TypeScript. It is kept because it costs nothing and is what Next's docs prescribe; "Use Workspace Version" in VS Code is not available under TS 7.
- pnpm applies a **supply-chain cooldown** (`minimumReleaseAge`, 1440 minutes, its default since v11) to new releases. Installing a package published inside that window appends pinned entries to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml` — that list is a record of deliberately-accepted fresh releases, not cruft. Prune entries when the versions they name are no longer the ones installed; the list is **currently empty and the key absent**, which is its steady state rather than an omission.
  **pnpm 12 is a Rust rewrite, and one line in `pnpm-workspace.yaml` is what keeps Dependabot able to read this repo.** Left to its default, pnpm 12 manages its own version and records that in a **second YAML document** at the head of `pnpm-lock.yaml`; dependabot-core reads only the first document, so it reports **zero dependencies and closes existing alerts without performing an update** (dependabot/dependabot-core#15904, open — pnpm 12 is unsupported there). `pmOnFail: ignore` suppresses that document, and `error` and `warn` do **not** — both still emit it. Three consequences worth holding:

- **`grep -c '^---$' pnpm-lock.yaml` must be `0`.** That is the whole check, and it is the acceptance criterion the migration was held to. A non-zero answer means Dependabot has gone blind.
- **What `ignore` gives up is pnpm's own enforcement of the `packageManager` pin, and `engines.pnpm` is what covers it** — `>=12` under `engineStrict`, so pnpm 11 exits `ERR_PNPM_UNSUPPORTED_ENGINE`. Corepack and `pnpm/action-setup` select the version; that engine field refuses the wrong one.
- **Corepack has a floor of 0.35.0**, because pnpm 12 resolves through per-platform `@pnpm/exe.*` packages rather than the `bin/pnpm.cjs` pnpm 11 shipped. 0.34.0 (Node 24.11.0) dies with `MODULE_NOT_FOUND`; 0.35.0 (Node 24.20.0, what `node:24-slim` ships) works. This binds the `Dockerfile` and anyone driving pnpm through Corepack — a standalone pnpm install is unaffected.

- `pnpm-workspace.yaml` is in oxfmt's `ignorePatterns` because pnpm writes those generated entries single-quoted and oxfmt rewrites them double-quoted, so the two tools would flip the file back and forth on every install. pnpm owns that file; do not remove the ignore.
- `docs/efforts/*/advisories/` is ignored for the same shape of reason: a committed advisory is **verbatim** and `.claude/hooks/build-guard.sh` refuses to edit one, so a formatter rewriting it would make `pnpm format` and the Build gate contradict each other. `/spec-review` diffs the spec against those files; reformatting them is editing them.

**What else pnpm 12 shipped, which of it this repo adopted and which it refused, is in the
`ci-and-dependencies` skill** — read it before proposing `pnpm ci`, `pnpm runtime`, `pnpm shim`
or `audit.ignorePrune` here.

**Docker is required for `pnpm dev`, and for nothing else.** `docs/policy/data.md` → `local-database`
puts the development database in `docker-compose.yaml` at the repo root: `postgres:18-alpine` on
**5432**, and **PgBouncer in transaction-pooling mode** on **6432** in front of it, because that is
the mode PlanetScale's pooler runs in (spec 0002, DD2) and a plain unpooled Postgres would accept
code that fails after deploy. `pnpm db:up` starts it, `pnpm db:down` stops it, `pnpm db:reset`
discards the volume. `cp apps/web/.env.example apps/web/.env.local` is the only other step — that
file lives in `apps/web` because that is the directory `next dev` loads `.env.local` from.

**The floor is Docker Engine 20.10+ and Docker Compose v2**, the two things `depends_on: condition:
service_healthy` and `docker compose up --wait` between them require. Verified 2026-08-26 on Engine
29.7.2 and Compose v5.3.1. **The exact v2 minor was not bisected**, so the floor is stated at the
major rather than at a number nobody measured — if `pnpm db:up` fails on an old Compose, that is
where to look.

**It is opt-in, and the boundary is exact.** `pnpm test` runs against PGlite in-memory (spec 0002,
Testing Decisions seam 2) and CI starts no database service, so `install`, `lint`, `check-types`,
`test` and `build` all pass on a machine with no Docker at all. Do not add a database service to a
test or to CI — the moment either needs one, seam 2's argument has been lost.

**The test runner is Vitest.** `pnpm test` runs `turbo run test test:gates spec-identifiers migrations:check`, which is six suites plus two live gates:

- `@repo/design-system:test` — `vitest run`, **happy-dom**, React Testing Library. Config in `vitest.config.mts`, cleanup between tests in `vitest.setup.ts`.
- `@repo/errors:test` — `vitest run`, **Node default environment**, no plugin and no setup file. The prior art for a Node package here: a `vitest.config.mts` carrying `resolve.tsconfigPaths`, `globals`, and an `include` glob, and nothing else.
- `@repo/observability:test` — `vitest run`, Node environment, the same minimal config as `@repo/errors`. It is the **stdout seam**: a test that asserts on a _line_ builds a `pino` instance from `createLoggerOptions` over an in-memory `Writable`, and pino's own test utility is deliberately unused because it asserts on `pid`/`hostname` before stripping them, which these options replace. The two modules that emit no line — the report seam and the trace-context reader — are tested against the real SDK with no client initialised, which is a real state this repo runs in rather than a mock.
- `@repo/domain:test` — `vitest run`, Node environment, and **two seams as two Vitest projects** in one config (spec 0002, `## Testing Decisions`). Seam 1 is pure — the connection-string resolvers, the server-only backstop — in the same minimal shape `@repo/errors` set. Seam 2 runs against **PGlite in-process**, replaying the **committed migrations** rather than a `CREATE TABLE` written for tests, which is the whole reason it is a seam and not a mock. PGlite 0.5.7 reports **PostgreSQL 18.3** against PlanetScale's 18.4 — read out of the running engine by the suite itself, so the claim cannot go stale silently.
  - **The filename is the seam.** `src/**/*.integration.test.ts` is seam 2; every other `*.test.ts` is seam 1. Neither project restates `resolve.tsconfigPaths` any more — Vitest 5 defaults an inline project's `extends` to `true`, so the root's Vite config is inherited rather than copied into each. The projects exist so that `globalSetup` applies only to the files that need it — it is per-config, so before the split a run touching only the pure resolvers still replayed every migration into PGlite and dumped a data directory before the first assertion. `pnpm exec vitest --project seam-1` is now a real thing to run while iterating on a pure function.
  - **The database arrives as a `test.extend` fixture, not as hooks.** Import `test` from `#testing/fixtures` in an `*.integration.test.ts` and destructure `{ database }`; the restore-and-close lifecycle is the fixture's. Three files used to open with the identical `let database` / `beforeEach` / `afterEach`. The fixture lives in `#testing/fixtures` and **not** in `#testing/database` on purpose: `global-setup.ts` imports the latter for `SNAPSHOT_PATH`, and a `test.extend` at that module's top level aborts the run with _"Vitest failed to find the current suite"_ because `globalSetup` runs with no suite. The globals stay — this replaces `describe`/`it`/`expect` with nothing.
  - `globalSetup` builds the post-migration snapshot **once per run** and dumps it to `node_modules/.cache/pglite/`; each test file restores from that in milliseconds, so no test truncates and no test sees another's rows.
- `@repo/notifications:test` — `vitest run`, Node environment, `@repo/errors`' config plus `.tsx` in the include glob and **no React plugin**: that plugin exists for Fast Refresh and a DOM, and a template here is rendered to a _string_ in Node by `@react-email/render`. Vite's esbuild transform reads `jsx: "react-jsx"` out of the tsconfig, which is all a `.tsx` file needs. A template test that reached for happy-dom would be asserting against a DOM no email client has.
- `web:test` — `vitest run`, **happy-dom**, the design system's config plus `vitest.setup.ts` and one setting of its own: **`pool: "vmThreads"`, which no other suite here has**. A DOM environment is built per test file, and on `forks` the reporter attributes ~37% of this suite's time to `environment`; the vm pool keeps per-file isolation and builds one per _worker_ instead, which drops that share to ~27%. Four runs of each on one machine: 1.8-1.9s against 2.6-3.6s. The ratio is the finding and the seconds are illustrative — both moved ~20% between a quiet machine and a busy one. **The saving is per-file, so it needs files to amortise over, and that is the thing to measure before copying the line into a seventh suite**: `@repo/design-system` spends the same ~50% on its environment but across three files, and came out marginally _slower_; `@repo/domain` reuses a module graph but is 90%+ its own test time, so the gain vanished into noise on a second measurement. The other three are Node-environment suites with no environment to amortise. All five stay on the default `forks`. It covers what a running server cannot show, starting with the proof that `@repo/domain`'s `exports` map withholds what ADR-0010 says it withholds. Route handlers, Server Components and Server Actions verify at seam 3 instead, against a running `next dev`. Its setup file registers **`toMatchSchema`** from `apps/web/testing/matchers.ts` — a custom matcher taking a **Standard Schema** rather than a Zod schema, so nothing in a test has an opinion about the validation library. Reach for a matcher over a helper when the assertion's failure message is the thing worth owning: `expect(x).toBe(true)` on a `safeParse` result reports `false is not true` and names neither the rule nor the value.
- `//#test:gates` — `gate-test.sh`, the cases that drive the repo's own gates. About a quarter are the stage hooks; the rest drive the gates that are not hooks at all, which are the same kind of thing — repo logic deciding whether work may proceed, so a test suite and not a script to remember to run. Its `inputs` cover `.claude/hooks/**`, every script it drives, and the lint configuration `lint.sh` exercises (every `.oxlintrc.json`, `package.json` for the pinned versions, `pnpm-lock.yaml`), which is the part to keep in step: a script added here and not there is one whose change a cache hit replays a pass for.
  - Each gate's case-level notes — the runner's layout, what the ui-proof, audit, migration and
    spec-identifier suites cover, the rule-3 carve-out and the holes `/code-review` found — are in
    `scripts/CLAUDE.md`, which loads when you work in `scripts/`. Read it before touching a gate.

- `//#spec-identifiers` — that same gate, run against **this** repository rather than a fixture,
  which is the `migrations:check` split below for the same reason. It is not `cache: false`: unlike
  the migration gate its answer depends only on the source files themselves, so its `inputs` name the
  source globs and a cache hit is a real one. `REVIEW.md`'s **Spec identifiers stay in the source**
  pass is what it makes red rather than reviewed, and that pass says what a reviewer still has to
  judge — whether the string that replaced a citation says the substance, and whether a comment lost
  one. It reads shell too, through a second tokeniser. Its walk skips `.agents/` and `.claude/`, so
  vendored skills are unread and so is `gate-test.sh` itself, whose fixtures are the citations it
  refuses — which is why that suite runs the gate over the hooks beside it instead.

- `//#migrations:check` — the same migration gate, run against **this** repository rather than a fixture. It is `cache: false` on purpose and it is not a case inside `gate-test.sh`: that suite is cached on `.claude/hooks/**` plus the three scripts, and this answer also depends on git history and on migration files none of those inputs cover, so a cached replay would report a pass nothing had checked. CI's `test` job therefore checks out with `fetch-depth: 0` **and points `origin/HEAD` at the default branch the webhook payload names** — a shallow clone has no merge base, and a checkout with no `refs/remotes/origin/HEAD` has no default branch to take one against; the gate refuses to call "I could not compare" a pass on either count. `GITHUB_BASE_REF` covers the `pull_request` event only, so the second half is what the **deploy** needs: `deploy.yml` calls `ci.yml` as a reusable workflow and that arrives as a `push` to the release branch, carrying no such variable. It used to be the merge run on `dev` that needed it, and that run is gone — CI runs on the pull request and on the deploy, and on nothing else.

**`pnpm exec vitest doctor` is how a claim about a suite's speed gets made here.** It re-runs the
suite under each alternative pool and setting and prints the deltas, so a config change arrives with
a number rather than an intuition — it is what produced `apps/web`'s pool above, and what refused the
same change for the other five. Two cautions, both met while using it: its `maxWorkers` suggestion is
tuned to the machine it ran on and does not belong in a committed config, and a single measurement of
a fast suite is mostly cache state — the design-system reading reversed on repetition. Run each side
several times before writing the number down.

All three package suites follow the same three rules. Tests sit **beside their source** — `src/**/*.test.{ts,tsx}` in the design system, `src/**/*.test.ts` in a package with no JSX — so `check-types` covers them (the tsconfig `include` is `src`). Every workspace with tests sets `"types": ["vitest/globals"]` in its tsconfig. And:

**`clearMocks` defaults to `true`, and that is Vitest 5's default rather than this repo's choice.** `vi.clearAllMocks()` runs before every test, so call history never survives one. It does **not** reset an implementation, which is why the handful of `mockReset()` calls in a `beforeEach` are still doing work rather than being redundant — clearing drops the calls, resetting drops what `mockResolvedValue` put there. A test that needs history to accumulate across cases has to say so, and should probably be one test.

> **Vitest globals are ON. Never `import { describe, it, expect } from "vitest"` in a test.** Those names are already in scope through `test.globals: true` plus the `vitest/globals` types entry, and a test file that imports them is the mistake to correct on sight — in review, or the moment you notice one while editing. Import from `"vitest"` only for something that genuinely is not a global. This repo shipped the opposite convention once and every new package copied it from the prior art, which is why it is written here as a rule rather than left to be inferred from a config file.

**A mocked module is imported statically, and `vi.hoisted` is what makes that possible.** `vi.mock` is lifted above _every_ statement in the file, so a factory closing over a plain `const handler = vi.fn()` reads that binding in its temporal dead zone the moment a static import evaluates the mocked module — `ReferenceError: Cannot access 'handler' before initialization`. The tempting fix is `const { Thing } = await import("./thing")` after the consts, which works only because a dynamic import runs after the module body; this repo shipped that shape once and it spread by copying. Define the doubles inside `vi.hoisted(() => ({ … }))` instead and keep the imports static — that is what the helper exists for, and it leaves the file's imports looking like every other file's.

**Query a component through the accessibility tree — role, label, text — and never through raw DOM access; `pnpm lint` refuses it** (#261). A test that finds an element by CSS selector asserts that the markup has a shape; a test that finds it by role asserts that a _user_ can reach it, which is the thing NFR20 is about. The two come apart exactly where a bug lives — a `<div aria-live="polite">` with no `role` is reachable by `querySelector` and by nothing a screen-reader user has, and the selector in the test is the tell that nobody noticed. `@testing-library/jest-dom` is registered in `apps/web/vitest.setup.ts`, so an accessibility question is written as the question: `toHaveAccessibleDescription` resolves `aria-describedby` to the text that is actually announced, rather than the `container.querySelector('#' + id)` this repo hand-rolled once.

**The gate is `eslint-plugin-testing-library`'s `no-container` and `no-node-access`, loaded through
oxlint's `jsPlugins`.** The root `.oxlintrc.json` declares the plugin and turns both rules to `error`
in an `overrides` entry scoped to `*.test.ts(x)`, so both workspace configs inherit it through
`extends` and ordinary source is untouched. It refuses `container.querySelector`, `querySelector` on
a query result, `.closest`, `document.activeElement` and the rest of the traversal API. It replaced
a documented escape hatch — a hidden input's absence, and the HTML that survives without JavaScript
— and every call the hatch covered was migrated onto the two answers below rather than exempted.

**What the tree does not contain still has an answer, and neither answer is DOM access:**

- **What a form posts is the browser's question, so ask the browser.** Reach the form from a control
  the tree found — `getByRole<HTMLButtonElement>("button", { name }).form` — then `new FormData(form)`
  for what a native submit would send and `form.checkValidity()` for what it would refuse. A hidden
  input is a key nobody typed; "one form" is two controls whose `.form` is the same object. A
  component with no form of its own renders inside a named test form. `@/testing/form-data` holds
  all of it — `formOf`, `submittedFrom`, `fieldNamesFrom` and `renderInForm` — so a control outside
  any form fails one way everywhere. This is stronger than the selector it replaced: it asserts the submission
  rather than the shape of the markup. A radio or checkbox posts only once chosen, so choose it
  before asking what it sends.
- **Markup the tree does not report is read as the string React sends** — `renderToStaticMarkup`
  from `react-dom/server`, or `prerender` from `react-dom/static` where a Suspense boundary has to
  resolve first. That covers an `aria-live` with no role, an `svg` (which takes no role under
  happy-dom, hidden or not), a native `<details>`, how many `<form>` elements a component renders,
  and a URL-valued attribute (`urlAttributesIn` in `@/testing/markup`). Count what a loop over the
  string iterates, so it cannot pass by finding nothing.

**Scanning `document.body.innerHTML` is not a third route.** Neither rule flags reading a string,
so it would pass the gate while being the same DOM access by another name. `container.textContent`
survives where the question is the rendered text itself — the order in which the Offer form's
notices are met, and that the session menu's row does not show the address — rather than the shape
of the markup.

A `data-testid` is the last resort, and none exists in this repository: one needs a comment naming
the assertion no accessible query could express. What is **not** a reason for one is that the
element is awkward to query — if a role query cannot find it, first check whether the component
should have told the accessibility tree it exists.

**`oxlint` and the plugin are both pinned exactly because of this gate.** oxlint's own schema calls
JS plugins alpha and outside semver, so a minor release could stop loading the plugin and leave
`pnpm lint` green on a tree full of selectors — the gate failing open on an upgrade nobody connected
to it — and a plugin release can change what the two rules flag.
`.claude/hooks/tests/lint.sh` lints fixtures through each real config and goes red if the refusal
goes quiet; raise the pin in a change that runs it.

**The DOM environment is happy-dom, not the jsdom Next's docs prescribe, and that was measured rather
than preferred.** The measurements and the guard test are in `packages/design-system/CLAUDE.md`; if
`src/components/dialog.test.tsx` ever fails, reconsider the environment rather than the test.

**What that script may not be used for is unchanged, and it is the important half.** Vitest **cannot test `async` Server Components**, and an imported Server Action is not the compiled POST endpoint an attacker reaches — so a green test there would assert authorization on a code path nobody attacks. Both verify at seam 3, against a running `next dev` through the `next-dev-loop` skill, and `docs/policy/build.md`'s definition of done requires that leg for any change touching `apps/web`. What belongs in `web:test` is what a running server cannot show: module resolution, Client Components, and table-driven assertions over a route list.

## Verifying your work

Before reporting a change complete, run `pnpm lint && pnpm format && pnpm check-types && pnpm test` (add `pnpm build` for anything touching Next.js config, routing, Tailwind sources, or `@repo/design-system` exports). Healthy output is Turborepo's summary with every task `cached` or `successful` and a non-zero `Tasks: N successful`.

**CI runs exactly these commands, on every pull request.** `.github/workflows/ci.yml` is six jobs — `lint`, `format`, `check-types`, `test`, `build`, `audit` — one per entry in `docs/policy/build.md`'s `required-checks`, named so that a human can require each by name as a status check (`docs/runbooks/recomencemos-go-live.md` §8). Each job runs the **root script**, never a `turbo run` restated in YAML, so the two cannot drift; the Node and pnpm versions are read from `.nvmrc` and `packageManager` for the same reason. The last job is `pnpm audit:direct`, which is `scripts/audit-direct.mjs`: `high` or above in a **direct** dependency fails the run, and a transitive advisory is printed but never blocking (`docs/policy/security.md` → `dependency-policy`). Do not reach for `pnpm audit --audit-level=high` instead: it is red on any repository carrying one transitive advisory, and a gate red on arrival is bypassed within a week — which is the reasoning C7 records for direct-only, not an observation about today's tree.

**Coverage (reported on every pull request, gating nothing), the daily transitive-advisory report
and its issue lifecycle, Dependabot and its coupling to `minimumReleaseAge`, and why `@types/node`
majors are ignored are in the `ci-and-dependencies` skill.** Load it before touching `.github/`,
a dependency override or an audit script. The rule it applies is
[ADR-0020](docs/adr/0020-gate-logic-is-a-script-with-a-suite-and-the-wiring-stays-thin.md): the
decision is a script with a test file named for it, and a workflow `run:` line holds no branching.

`pnpm lint` is stricter than it looks. The root `.oxlintrc.json` puts oxlint's `correctness` category at `error` but `suspicious` and `perf` at `warn`; the `--max-warnings 0` flag in the root `lint` script is the only thing that turns those warnings into a failing exit code. Never relax that flag to make lint pass, and don't silence a rule repo-wide when a scoped `overrides` entry or an `// oxlint-disable-next-line` with a reason would do.

## Architecture

Workspaces are declared in `pnpm-workspace.yaml` (`apps/*`, `packages/*`) and referenced across packages as `workspace:*`. Guidance for `packages/design-system` — including the single Tailwind v4 stylesheet it owns, whose `@source` globs a new app workspace must be added to — lives in `packages/design-system/CLAUDE.md`; `apps/web`'s Cache Components rules live in `apps/web/AGENTS.md`. Four more nested files load only where they apply: `packages/CLAUDE.md` (package boundaries), `packages/observability/CLAUDE.md` (the log line's own behaviour), `scripts/CLAUDE.md` (the gates, case by case) and `.claude/hooks/CLAUDE.md` (writing a hook).

**`apps/web`'s own architecture — a surface as a folder, the three route groups, the real `/admin`
403, the rules every Server Action is built under, and the `@/` import alias — is in
`apps/web/AGENTS.md`**, which loads whenever you work there.

**`@repo/errors` has no `dependencies` key, and that absence is the design.** It is isomorphic — importable from a Server Component, a Client Component, a Route Handler, a Server Action, or either instrumentation entry point — and the empty dependency list is what _enforces_ that rather than documenting it: a stray `import pino` there fails to resolve under pnpm's isolated store, where a semantic subpath in a single package would only fail a `.next/static` grep after the fact. Never add a runtime dependency to it. Anything needing one belongs in a server-only package instead — which is what `@repo/observability` is.

**`@repo/observability` is the other half of that split, and it is server-only.** It depends on `pino`, `pino-pretty`, their stream packages, and `@sentry/nextjs` — which is what makes it the home of the report seam and the trace-context reader — so it may not be imported from a Client Component, from `instrumentation-client.ts`, or from anything on a `"use client"` path. What actually keeps it out of the browser is its `exports` map: **every entry carries a `browser` condition pointing at `src/browser-refusal.ts`**, so a `"use client"` import fails to resolve at build and `pino` never enters the client graph at all — mechanism 1 in the table below, in its strongest form, with the observed Turbopack error recorded in that file. `assertServerOnly()` is the backstop, not the mechanism. A browser module that needs an error type imports `@repo/errors`, which is isomorphic by construction.

**`@repo/domain` is the only door to the database, and its `exports` map is what makes that true rather than aspirational** ([ADR-0010](docs/adr/0010-the-domain-package-is-the-only-door-to-the-database.md)). It publishes per-aggregate model subpaths and **withholds** the Drizzle schema, both connections, and (with #12) the Better Auth instance — an unexported subpath is unresolvable under pnpm's isolated store, so reaching past the domain layer is a module-resolution error rather than a review comment somebody has to notice. `apps/web/domain-boundary.test.ts` asserts both halves against **Node's own resolver**, which is the one `next build` uses. Widening the map "just for a script" removes the boundary with no compile error anywhere; the one subpath added beyond the spec's table is `./health`, and the reason is written at the top of `packages/domain/src/health.ts`.

**Two connections, and they are not interchangeable.** The **pooled** one (`DATABASE_URL`, PgBouncer on 6432 locally, PlanetScale's pooler in production) is what every request path uses; the **direct** one (`DIRECT_DATABASE_URL`, 5432) is what migrations run on. Transaction-pooling mode removes `LISTEN`/`NOTIFY`, session advisory locks, temp tables and cross-transaction prepared statements, so DDL in a long transaction cannot cross it (spec 0002, DD2). Neither variable appears in **any** `turbo.json` task and neither may be added to one — NFR24 names both as runtime credentials, and `.env*` is a `build` input. `turbo build --dry` is how you check.

**How a server-only package is guarded — three mechanisms, which package carries which, and what
the boundary tests assert — how `@repo/domain` imports internally, and when a dynamic `import()` is
allowed are in `packages/CLAUDE.md`.** A new server-only package reads that first
([ADR-0013](docs/adr/0013-a-server-only-package-declares-which-guards-it-has.md)).

**An Admin comes into existence from a shell — `pnpm admin:enrol <email>` — and nowhere else.** No
form creates one. The enrolment's ordering, and why that ordering is the security property, are in
`packages/CLAUDE.md`.

**There is more than one Admin, and no code or copy may assume otherwise.** Enrol at least two — the
recovery path that costs nobody a printed backup code is another Admin who can still sign in — and
write every string and comment for "an Admin" rather than "the Admin".

**Migrations are generated, never hand-written.** `pnpm db:generate` writes them from `packages/domain/src/schema.ts`; `pnpm db:migrate` applies them on the direct connection. `.claude/hooks/build-guard.sh` rule J refuses a `Write` or `Edit` to a migration the journal already names — `drizzle-kit` writes through `Bash`, which is exactly the split that rule intends. `packages/domain/drizzle/` is oxfmt-ignored for the `pnpm-workspace.yaml` reason: `drizzle-kit` owns those files and rewrites them in its own style on every generate.

**Config is consumed by extension, not by copying.** `packages/typescript-config/base.json` sets the strict baseline (`strict`, `noUncheckedIndexedAccess`, NodeNext resolution); `nextjs.json` and `react-library.json` extend it and override module resolution per target. Tighten compiler options there so every workspace inherits them — not in individual workspace configs.

**Lint config is nested, not packaged.** oxlint discovers `.oxlintrc.json` files automatically and applies the nearest one to each file, so the root config holds the repo-wide baseline and each workspace's `.oxlintrc.json` `extends` it and adds what only that workspace needs.

`plugins` **overwrites** rather than merges, so a workspace config must relist the inherited plugins alongside its own. Put a rule everyone should follow in the root config; put a framework-specific one in the workspace that has that framework.

**A task-specific entry `replaces` the base task; it does not merge with it.** `web#build` restates
`dependsOn`, `inputs`, `outputs`, and `env` verbatim from `build` and adds one thing of its own —
`passThroughEnv: ["SENTRY_AUTH_TOKEN"]`, task-scoped so a write-scoped token never reaches `dev`,
`lint`, `test`, or `check-types`. The duplication is load-bearing: deleting the restated keys as
redundant silently drops the app's outputs, its topological order, and its environment declarations.
`turbo build --dry` prints the `Resolved Task Definition` and is how you check.

**Turborepo runs in `strict` environment mode**, which is 2.x's default — an undeclared variable is
filtered out of a task's environment entirely, not merely out of its hash. Declaring one is a
correctness requirement, not tidiness: variables baked into build output go in `env` on `build`,
runtime-only ones go in `globalPassThroughEnv` (hashing those would invalidate the cache for values
no build reads), and a secret goes in `passThroughEnv` on the one task that needs it.

## Logging and errors

Which package owns what is in Architecture above; this is how to use them.

**Emit every diagnostic through the logger** — `logger` from `@repo/observability/logger` on a server
path, or `logRequestError` for a request failure. The root `.oxlintrc.json` enforces it with
`no-console` and `allow: ["error", "warn"]`, so `console.log`, `console.debug`, and `console.info`
fail `pnpm lint`. The logger writes through the process stream rather than the console, so **no
workspace needs an exemption** — a file that looks like it needs one has the wrong import.

**The console allowance is for bootstrap, and is never an error channel.** `console.error` and
`console.warn` survive the rule so a path that runs before the logger singleton exists can still say
something. A console call carries no base fields, joins no trace, and bypasses the shared redaction
list on **both** sides of the wire, so an error routed there is an error a drain never sees and a
scrubber never reaches. If review finds the allowance abused, the correction is one line — drop the
`allow` array — and [the effort's spec](docs/efforts/0001-observability/spec.md) asks for _evidence
of misuse_ before taking it rather than a prediction of it.

**The audience split is a property of `AppError`, not a habit of the caller.** `message` is
operator-facing English and reaches the log line; `userMessage` is the only string permitted to reach
a browser. Both egresses build their body from one whitelist — `toErrorResponse` for a Route
Handler, `toClientError` for a Server Action or an RSC payload — so the two cannot drift apart, and
`packages/errors/src/app-error.ts` is where its keys are fixed. There is deliberately no code path from
`message` to `userMessage`: defaulting one to the other is the single mistake that turns this design
into a leak.

**No `toJSON` on a type that crosses the RSC boundary — and that is precedent, not a note about
`AppError`.** [ADR-0003](docs/adr/0003-no-tojson-on-cross-boundary-types.md) binds every future type a
Server Component passes as a prop, a Server Action returns, or a Route Handler puts in a body: no
`toJSON`, no implicit serialisation hook, and one named projection per egress built field by field from
a whitelist. Two halves, both load-bearing — the absent hook stops a field being published implicitly,
and never handing the value itself to a serializer is what stops the rest of it leaking. Passing a
cross-boundary value whole to anything that serialises is the move that defeats the rule while looking
like compliance.

How a stack is trimmed on a line, and why an unrouted success emits no completion line, are
`@repo/observability` behaviour and live in `packages/observability/CLAUDE.md`.

**`context` carries identifiers and shapes** — ids, counts, enum values, truncated inputs. Never
credentials, tokens, whole request bodies, or raw personal data; a secret never enters it. This is
the rule redaction **cannot** enforce, which is why it is written here rather than left implied by
`redaction.ts`: that list matches key _names_, so it catches a secret at `password` and misses the
same secret at `value`.

**The request-completion line is the one exception to that rule, and it is the only one.** `context.path` on the
request-completion line carries the concrete request path on every line it emits — which is every
request the app **routed**, plus any unrouted failure (#81) — so a credential in a URL
**path segment** is logged verbatim by code no caller wrote. Narrowing the population narrowed
nothing about the exposure: a tokened route is a routed request.
[ADR-0006](docs/adr/0006-name-the-exposure-rather-than-ship-a-heuristic.md) is why nothing ships to
guess at it — no mechanism can tell a reset token from an order id, and any bound also lands on
`/orders/42`. `secrets-in-url-paths` in [`docs/policy/security.md`](docs/policy/security.md) is the
question this product still has to answer, and the go-live runbook's §10 is how it bounds the path when
the answer is yes. Do not read the exception as licence: it exists because the logger cannot know the
classification of a value it writes on the caller's behalf, which is never true of a `context` a caller
builds.

**Thrown is reported; returned is logged.** An error that escapes a request reaches `onRequestError`
and costs one event plus one `error` line carrying that event's id. An error handled and returned
through `toErrorResponse` costs one `warn` line and no event. That is the only quota lever in the
design — there is no status-based pre-send filter behind it — so which one a handler picks is a real
decision. `apps/web/app/api/example-error/route.ts` is the worked example of both, and reading its
stdout under `LOG_FORMAT=json pnpm dev` is the demonstration.

**Three rules about where a log call may sit.** They are one boundary seen from three sides, and
Cache Components is what puts the boundary there:

- **Log at the dynamic boundary, never inside a cached function.** A call inside a `use cache` scope
  runs at cache-fill time: it emits once per miss, carries the `trace_id` of whichever request filled
  the entry, and emits nothing at all on a hit — so it attributes one user's incident to another
  user's trace.
- **Return data from a cached function; let an `AppError` be thrown.** A returned error is an
  ordinary value, so a cached one becomes a shared entry serving one request's `requestId` to every
  later user.
- **Log from components that render dynamically.** `pino` stamps `time` from the clock, and reading
  the current time makes a prerender non-deterministic, so a `logger.info()` in a Server Component
  that prerenders fails `next build` with `blocking-prerender-current-time`. The fix is
  `await connection()` at the boundary, not a change to the logger. This is the framework enforcing
  the first rule from the other side, and it is written down because the error message names the
  clock rather than the logger.

**Field names on a line are `snake_case` — all of them.** The line is its own namespace and names
what it carries for itself, whatever the source called it, so `AppError.requestId` reaches the line
as `request_id`. [ADR-0005](docs/adr/0005-log-line-fields-are-named-for-the-line.md) is the rule and
is honest about its one price: the browser receives `requestId`, so that identifier has two spellings
across that hop and a support engineer has to know the log field is the `snake_case` one. What the
rule buys is that every other field name is predictable, and that `trace_id`/`span_id` — the two a
drain pivots to the reporting platform on — are passed through from `spanToJSON()` with no mapping
layer at all.

The guaranteed names — `service`, `env`, `release`, `level`, `time`, `msg`, plus
`trace_id`/`span_id`/`event_id` and `request_id` where they apply — are a **stability contract**:
every clone's drain queries bind to them, and no clone can be migrated by us.

**A spec identifier may not appear in any string that leaves the source file — this is a hard rule.**
`NFR14`, `ADR-0015`, `DD5`, `C43`, `story 7`, `#17`: none of them belongs in a test name, a log
message, an `AppError.message`, a thrown `Error`, an HTTP response body, an RSC payload, CLI output,
or anything a person reads on screen. They belong in **comments, doc-comments and commit messages**,
which is where this repository's traceability lives and where it stays — do not strip them from there.

The line is where the string is read, not what it says. A comment is read beside the code that proves
it; a log line is read at 3am by an operator who may not hold the spec at all, and a test name is read
in CI output by someone who does not have it open. `ADR-0005` already makes this argument for field
names — _the line is its own namespace and names what it carries for itself_ — and this is the same
rule applied to the message. A citation also goes stale silently: spec numbering is renegotiated at
Design and the string quoting it is never re-read.

**Say the substance instead.** `"a session that is not an authenticated Admin (NFR14)"` becomes
`"a session that presented no password and no second factor"`, which is shorter and is the thing the
reader needed. Where the citation is load-bearing, put it in the comment directly above the string.
`REVIEW.md`'s **Spec identifiers stay in the source** pass is the blocking version of this and carries
the per-surface table; the audit behind it is in #93.

**`pnpm spec-identifiers` is the machine half, and it runs inside `pnpm test`.** It tokenises every
JavaScript, TypeScript, JSX and shell file, reads only the string literals, and names the file, the
line and the string. What it cannot judge is whether the sentence that replaced a citation says the
substance or merely got shorter — and it never reads a comment, so it is equally silent about one
stripped from there.

How it reads shell, and why its walk skips `.agents/` and `.claude/`, is in `scripts/CLAUDE.md`.

## Things to get right

- **No `apps/web` module may import `better-auth/react`, and nothing in a browser holds an auth client**
  ([ADR-0015](docs/adr/0015-both-doors-are-server-actions-and-the-browser-holds-no-auth-client.md)).
  Both sign-in doors are Server Actions calling `@repo/domain/auth-handler`. The vendor adapter
  `@next-safe-action/adapter-better-auth` cannot be used here either — it takes the Better Auth
  _instance_, which ADR-0010 withholds — so an authenticated action gets a local middleware over
  `AuthHandler.getSession`. `sign-in-form.test.tsx` asserts the first half over the surface's source.
- **Spanish is the interface; English is the code** ([ADR-0012](docs/adr/0012-spanish-is-the-interface-english-is-the-code.md)). `es-CO` is the product's only language and it governs **only what a person reads**. Every identifier you type is English: route segments, file and directory names, database tables and columns, enum values, query parameters, API field names, log `event` names, test names, branch names. The line is **identifier versus value** — `Skill.labelEs` is an English column holding a Spanish string. So the route is `/offers`, the table is `offer`, the entity is `Offer`, and the page says _Propuesta_. This is written down because effort 0002's spec routed the entire product in Spanish — `/perfiles`, `/publicar`, `app/mi-perfil/page.tsx` — through the API contract and the deep dives before a human caught it. `CONTEXT.md`'s glossary gives every term both names; use the English one everywhere except the rendered string.
- `apps/web/app/layout.tsx` carries the product's metadata and `lang="es-CO"`. The `lang` attribute is not decoration: every string below it is Spanish, and a wrong `lang` has a screen reader announce Spanish with English phonemes.
- **Before writing any presentational element, read `packages/design-system/src/components/`.** A component the registry lacks is added with `pnpm dlx shadcn@latest add <component> -c packages/design-system`; hand-roll only what has no registry equivalent. `REVIEW.md`'s registry-equivalents pass blocks a merge on a hand-rolled equivalent — PR #77 hand-rolled three the registry already exported (#79 row 8).
- `apps/web/next.config.ts` is TypeScript, and it is listed in `apps/web/tsconfig.json`'s `include`. If you rename it, update that entry too.
- oxfmt runs on the tool's defaults except for `ignorePatterns` (`.agents/`, `.claude/`, `docs/efforts/*/advisories/`, `pnpm-workspace.yaml`, `packages/domain/drizzle/`) — note `printWidth` is **100**, not Prettier's 80. Run `pnpm format:fix` rather than hand-formatting. It reads `.gitignore`, so ignored files are skipped automatically.
- **oxlint ignores `.agents/` and `.claude/` too.** Vendored skills ship real JavaScript (impeccable alone is ~40 scripts) and it is not ours to fix — hand edits there are clobbered by the installer. Do not narrow those two patterns to make a vendored file lint; app and package code is still fully covered.
- oxlint has no equivalent of `eslint-plugin-turbo`'s `turbo/no-undeclared-env-vars`; undeclared env vars are no longer caught at lint time. `turbo build --dry` still reports the env keys a task hashes.

## AI-native SDLC conventions

The playbook's artifact chain is how work reaches this repo: `intent.md` (Plan) → `spec.md` (Design) → tickets + code (Build) → PR review (Deploy) → monitoring findings back through `/triage` (Maintain). Intents and specs are committed under `docs/efforts/<NNNN>-<slug>/`, so git carries the decision record; tickets are sub-issues of the spec's issue, so the plan reports its own state instead of being restated in a document.

Repo-level surfaces that support it — create them as the work needs them, and keep them in git:

- `CLAUDE.md` (this file) — commands, conventions, architecture, recurring mistakes, verification steps. Update it whenever a correction had to be repeated.
- `.claude/skills/<name>/SKILL.md` — **method**: how the work is done. Craft, not policy, and the same in any project.
- `docs/policy/*.md` — **policy**: the answers only this organization can give. Every value is set or literally `UNSET`, and a skill needing an `UNSET` value raises a flagged concern naming the file and the key rather than guessing. Effort 0002's design interview set most of them; `grep -rn UNSET docs/policy/` is what is left.
- `docs/runbooks/*.md` — **procedure**: what a human does to take something live or recover it, as numbers and commands rather than advice. A runbook step that ends in a decision names the `docs/policy/` key rather than making it. [`observability-go-live.md`](docs/runbooks/observability-go-live.md) is the one that ships: it carries the environment-variable phase split, the vendor's free-tier caps **pinned at a date**, the two control-band numbers and their arithmetic, the go-live check that proves `trace_id` correlation end to end, the breach path from webhook to `needs-triage` issue, and what was verified against the installed SDK rather than recalled.
- `.claude/agents/<name>.md` — scoped subagents for recurring work such as verification, research, or simplification. Five are the Design stage's advisors and fidelity checker; the sixth, `security-auditor`, is the in-house security expert — see **Security audit** under Agent skills below.
- `.claude/settings.json` — hooks as deterministic gates (protected paths, formatters, credential scanning, deploy authorization).
- `REVIEW.md` — the PR review passes beyond `code-review`'s two axes, and the severity threshold that blocks a merge. Under stacked PRs it also says what runs per-PR and what runs once at the top of the stack. Three passes now, and the third is the one that is deliberately **not** mechanised: recorded proof for a visible change is a reading rather than a run, because a machine can check a link is present and not that the artifact shows the criterion it is cited against.

**The method/policy split is the load-bearing idea.** Mixing them is what turns a skill into a form nobody fills in: a file that says "the WCAG level is your organization's call" teaches the reader that the whole document is negotiable. Put the craft in the skill and the answer in `docs/policy/`, and each half can be judged on its own terms.

**A runbook is a third thing, and it is what the split produces rather than an exception to it.** Method is how the work is done and is the same everywhere; policy is the answer only an organization gives. A runbook is the _procedure_ that carries a reader from one to the other — ordered steps, real numbers, real commands — and it is neither craft nor an answer. The test that keeps it honest is that **a runbook step ending in a decision names the `docs/policy/` key instead of making it**: that is why `observability-go-live.md` could state the two band numbers as arithmetic while still leaving `alert-destination` `UNSET` for the effort that had grounds to set it (0002 since has). A runbook that quietly answers a policy key has stopped being a runbook and become the form nobody filled in.

`CLAUDE.md`, `AGENTS.md`, `.agents/skills/`, `.claude/agents/`, `.claude/hooks/`, `.claude/settings.json`, `docs/policy/`, `docs/runbooks/`, `DESIGN.md`, `.mcp.json`, and `REVIEW.md` all exist — `REVIEW.md` was the last one in, created by the retro on #79 with the registry-equivalents pass as its first. What remains genuinely missing is every remaining `UNSET` value under `docs/policy/`. `.github/workflows/` was filled by effort 0002's story 15 — see the CI paragraph under **Verifying your work** above.

The `code-review` skill and `REVIEW.md` are the method/policy split again: the two-axis review is craft, while which extra passes run, what severity blocks a merge, and what changes under a stack are answers only this project gives — and the skill discovers `REVIEW.md` as a standards source on its own, so a pass written there runs on every review with the vendored skill unmodified.

### Agent surfaces that already exist here

**`AGENTS.md` at two levels.** The repo-root one is a thin pointer at this file, for agents that read `AGENTS.md` rather than `CLAUDE.md`. `apps/web/AGENTS.md` carries a `<!-- BEGIN:nextjs-agent-rules -->` block that **`next dev` writes and re-adds** — it directs agents to the version-matched docs bundled at `apps/web/node_modules/next/dist/docs/`. Do not delete that block to clean a diff; it will come straight back on the next `next dev`. Project-specific instructions go _outside_ the markers, where they survive regeneration. `apps/web/CLAUDE.md` is just `@AGENTS.md`.

Prefer those bundled docs over recall when writing Next.js code. They match the installed version exactly and cost no network request. `next dev` also writes its PID/port/URL to `apps/web/.next/dev/lock`, so a second `next dev` reports the running server instead of starting a duplicate — connect to the existing one.

**Skills, vendored under `.agents/skills/`** and symlinked into `.claude/skills/`, tracked by `skills-lock.json`. Installed with `npx skills add <owner>/<repo> --skill <name>`; do not hand-edit the vendored files, re-run the installer.

**Editing a vendored skill means forking it**, because `skills-lock.json` is an install manifest — `skills update` pulls latest and `skills experimental_install` restores from it, so either overwrites local changes. A fork leaves the lock and gains a row in `docs/agents/forked-skills.md` recording its upstream path and the hash it forked at. **Do not fork for a small diff**: put the coupling in an artifact this repo owns (the spec template, `docs/policy/`, `CONTEXT.md`) so the vendored skill picks it up through what it already reads. Fork only when the procedure itself differs.

- `next-dev-loop` — the runtime foundation. Use it to verify a change actually _works_ against a
  running dev server, not merely that it compiles. Reach for it after edits to `apps/web`.

  **Its two views now sit at two addresses, and the skill is unmodified — this is the coupling it
  reads from here** ([ADR-0018](docs/adr/0018-a-dev-server-is-reached-by-name-not-by-port.md)). The
  skill's preflight already says to read the port off the banner and set `NEXT_MCP_URL` when it is
  not 3000; these are the values:
  - **`agent-browser` opens the proxied HTTPS URL** — `$PORTLESS_URL`, or `portless list`. That is
    the origin the cookies, the `Secure` flag and the CSRF check see, so it is the only one worth
    asserting a user-visible behaviour against.
  - **`/_next/mcp` is probed at `http://127.0.0.1:$PORT`**, the ephemeral port from the banner. Same
    process, same MCP state, and it avoids handing `curl` a private CA for nothing.

  It also blunts that skill's worst gotcha. _"A stale or misdirected browser session"_ was hard to
  spot because every tree answered on one origin; now the hostname names the tree, and
  `agent-browser`'s `--scope worktree` session id lines up with it.

- `next-partial-prefetching-adoption` — moves an app onto Partial Prefetching (one shared App Shell). **This app is already on it**: `partialPrefetching: true` landed with #228, and the comment on that key in `apps/web/next.config.ts` carries what it bought and what it cost. The skill's step 1 — auditing `<Link prefetch={true}>` calls — still finds nothing here, and its remaining steps are about the deeper `'use cache'` half that ADR-0011 refuses for this app's session-shaped reads. This is a workflow, not a lookup.
- `implement` — the Build session. Vendored **thin on purpose**: it delegates to `/tdd` and `/code-review` and knows nothing of the frontier query, the ticket claim, or the PR. That is this repo's, and it lives in `docs/agents/issue-tracker.md`. Do not fork the skill to add it.
- `tdd` — red/green, and "no test is written at an unconfirmed seam". The seams were already confirmed at Design, so read the spec's `## Testing Decisions` section rather than re-interviewing the user.
- `code-review` — two axes, in parallel subagents: **Standards** (repo conventions plus a Fowler smell baseline) and **Spec** (does the diff do what was asked). It reads the plan comment `/implement` posted on the ticket. `REVIEW.md` is where a project adds its own passes and severity thresholds.
- `diagnosing-bugs` — the Maintain-stage loop that produces what `/triage` promotes. Its reproduction
  **is** the "before" capture for a bug-fix ticket; take it there rather than staging it again later.
- `show-me` — explanation, not evidence: pseudocode, call trees, component trees, mermaid, and
  `diff`-shaped structural sketches. It is what writes the structural half of a PR body, and it is
  bounded by two rules. **Its HTML branch does not apply to PR artifacts** — a local file opened with
  `Bash(open …)` reaches no reviewer and outlives no session. And **a `show-me` diagram never ticks an
  acceptance criterion**: it draws what the agent believes, which is exactly the artifact class that
  can be confidently wrong and look right. It explains; `ui-proof` proves.
- `ui-proof` — **this repo's**, not vendored. Captures the seam-3 leg as video, a before/after still
  pair, or an accessibility-tree diff, and carries the `ffmpeg` preflight, the determinism pinning
  that keeps a pair comparable, and the list of what may never be in frame.
- `wizard` — generates a bash wizard for steps only a human can perform. Its two committed products,
  and the rule for where a captured secret goes, are in `scripts/CLAUDE.md`.

- `impeccable` — interface design at depth: `shape` (brief before code), `critique`/`audit`, `polish`/`harden`, `live`. It owns `PRODUCT.md`, `DESIGN.md`, and the surface briefs under `.impeccable/briefs/`. The Design stage's `ux-design` routes into it rather than restating it.

**`impeccable` is vendored by its own installer, not the `skills` CLI**, which is why `skills-lock.json` does not track it. It is installed twice on purpose — `.agents/skills/impeccable/` (Codex flavor, with `agents/*.toml`) and `.claude/skills/impeccable/` (Claude flavor, with `user-invocable`, `argument-hint`, and `allowed-tools`). They differ in more than paths, so the usual vendor-and-symlink convention does not apply; do not "fix" the duplication. Its design detector runs as a `PostToolUse` and `Stop` hook in both `.claude/settings.json` and `.codex/hooks.json`.

Framework _knowledge_ comes from the bundled docs; skills are for multi-step workflows. Do not install a skill to answer a question the docs already answer.

**`.mcp.json`** registers `next-devtools-mcp`, which discovers the running `next dev` server and exposes `get_errors`, `get_logs`, `get_routes`, `get_compilation_issues`, and `compile_route`. `compile_route` and `get_compilation_issues` answer "does this compile" straight from the dev server — cheaper than a full `next build`.

## Agent skills

### Issue tracker

Issues live as GitHub issues in this repo, driven by the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles, used verbatim as label strings. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` plus `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Security audit

**The method is the vendored `security-audit` skill; the auditor is the `security-auditor` subagent;
the coupling between them and this repository is `docs/agents/security-audit.md`.** Read that file
before either a full `/security-audit` run or the `REVIEW.md` **Security review** pass, and do not
fork the skill — the trust model, the list of designed behaviours that look like findings, the
OWASP/ASVS/CWE tagging, the run directory and the filing rules all live in the coupling doc, which
is what the agent reads first.

Three things follow, and each closes a gap that was measured rather than guessed:

- **The auditor is a subagent, so it cannot spawn agents and cannot write files.** The vendored skill
  expects a hunter to delegate a rabbit hole and an orchestrator to write the run directory; here the
  hunter returns the rabbit hole under **Handoffs** and the main session does every write. That is
  the same split that keeps the four Design advisors read-only by contract.
- **Prior runs are `security-finding` issues, not files under the home directory.** The skill
  deduplicates against earlier `findings.json` files; here a finding's durable record is the tracker
  (ADR-0001), a closed `wontfix` is an accepted risk that is never re-filed, and the fingerprint is
  the sink file plus the CWE so two wordings of one bug meet. The run directory itself is
  `.security-audit/runs/` and is gitignored.
- **Dynamic confirmation runs against this tree's dev server and nothing else** — never the deployed
  origin, never a live third-party endpoint, never a real person's data — and nothing the auditor
  returns may hold a token, a secret or an enrolment URL, because an issue on this repository is
  public. The list is the security policy's own "What a published artifact may never contain".

### SDLC artifacts

`intent.md` and `spec.md` live in git under `docs/efforts/<NNNN>-<slug>/`; their GitHub issue holds a
stub and a link. Tickets are issues only. See `docs/agents/issue-tracker.md`.

`/to-spec` works from an intent whose `status:` is `approved`. Against a `draft` intent, report its
unresolved open questions and stop. That gate is a human's call, not yours, and
`.claude/hooks/plan-to-design-gate.sh` refuses both the spec write and any attempt to set
`status: approved` yourself. `.claude/hooks/design-to-build-gate.sh` does the same for a spec, and
also refuses a spec written with no `## Flagged concerns` section. Both share `gate-lib.sh` and are
covered by `gate-test.sh`, which runs as part of `pnpm test` (the `//#test:gates` task). Run it alone
with `pnpm test:gates`.

A folder under `docs/efforts/` means a human decided something is work. Findings arrive as
`needs-triage` issues and reach Plan only when `/triage` promotes them; see
`docs/adr/0001-findings-enter-through-triage.md`.

### The Design stage

Read [`docs/agents/sdlc-stages.md`](docs/agents/sdlc-stages.md) before a `/to-spec`, `/spec-review`
or `/prototype` session: the three phases and why they are ordered, what an advisor may write, the
`Binds:` and `## Runbook obligations` couplings to Build, and how deep dives are chosen.

### The Build stage

`/to-tickets` cuts the spec into tracer-bullet tickets; `/implement` works one of them, per session.
**Both skills are vendored and unmodified**, and everything that makes them fit this repo lives in
`docs/agents/issue-tracker.md` — "Build operations" and the two subsections under it. Read that
before a Build session, and `docs/policy/build.md` with it. Do not fork either skill.

**One ticket, one session.** The session opens by querying the frontier and claiming a ticket with
`--add-assignee @me`, and closes by opening a PR. The position lives in the tracker, never in the
session, which is what makes `/clear` between tickets safe.

**The plan is posted as a comment on the ticket before any code is written.** The playbook commits a
`plan.md` so "the PR review play checks the eventual diff against it"; here it is a comment, because
the plan is decomposition and not the audit trail. The **Spec** axis of `/code-review` is what reads
it back.

**Verification is two-legged, and which leg applies depends on where the change lands.**
`packages/design-system` has Vitest. `apps/web` does not, and its leg is `next-dev-loop` against a
running dev server — Vitest cannot test `async` Server Components, so a green build there is not a
verification. Every acceptance criterion gets ticked with the evidence that proves it; a criterion
ticked with no evidence is a claim.

**A change that alters what a person sees carries recorded proof, not a narrative**
([ADR-0019](docs/adr/0019-ui-change-carries-recorded-proof-not-asserted-proof.md)). `ui-proof` is the
method and `REVIEW.md` blocks a merge on it. Take the before capture right after the worktree
opens, and read the recorded-proof section of [`docs/agents/sdlc-stages.md`](docs/agents/sdlc-stages.md)
before the first capture.

**Stacked PRs are opt-in**, through `stacked-prs` in `docs/policy/build.md`. The mechanism is already
in the data: a chain of blocking edges _is_ a stack. But a stack is a path and the ticket graph is a
DAG, so the decomposition rule (maximal chains become stacks; a ticket with two blockers stays
serialized) is in `issue-tracker.md`. Never stack unrelated tickets for tidiness — a stack asserts an
ordering, and a false one makes review worse.

**The Build gate.** Three hooks, seven rules, all covered by `gate-test.sh`:

| Hook                      | Rule                                                                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `build-to-deploy-gate.sh` | **F.** never approve or merge a PR — `gh pr merge`, an approving `gh pr review`, and `gh stack merge`, because a stack merge is a merge |
| `build-to-deploy-gate.sh` | **G.** never push to the default branch. Without it F is theatre                                                                        |
| `build-guard.sh`          | **H.** never hand-edit a vendored skill, a committed advisory, or `pnpm-lock.yaml`                                                      |
| `build-guard.sh`          | **I.** never write a credential into the repo                                                                                           |
| `build-guard.sh`          | **J.** never hand-edit a migration already named by a `meta/_journal.json` beside it                                                    |
| `worktree-gate.sh`        | **K.** never commit in a checkout that has the default branch out. Rule G refuses the same mistake one step too late                    |
| `verify-before-stop.sh`   | a `Stop` hook: the session may not report done while lint, `check-types`, `test`, `test:gates`, or `migrations:check` is red            |

Rule F is load-bearing exactly as rule A is for Plan and C for Design — the act must be one the agent
cannot perform. Unlike B and E it reads no artifact, because there is no state under which an agent
may merge.

Rule H's test is **`skills-lock.json`**, not a hand-kept path list: a skill named in the lock is one
`skills update` will overwrite. This repo's own skills sit in the same directory and are absent from
the lock, which is exactly what forking one means. The guard watches `Write` and `Edit` only, so the
installers keep working through `Bash`.
