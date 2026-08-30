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

## Commands

Run from the repo root; `turbo` fans out to every workspace — the scripts are in `package.json`. pnpm 11 is pinned via `packageManager`; do not use npm/yarn. `pnpm dev` puts web on `:3000`.

Scope to one workspace with a filter (the workspace name, not the directory):

```sh
pnpm exec turbo dev --filter=web
pnpm exec turbo check-types --filter=@repo/design-system
```

`lint` and `format` are Turborepo **root tasks** (`//#lint`, `//#format`), not per-package scripts — oxlint and oxfmt are fast enough to cover the whole repo in one pass, so `apps/web` and `packages/design-system` have no `lint` script of their own. `pnpm exec turbo run quality` runs both checks; `quality:fix` runs `lint:fix` then `format:fix` (in that order, so the formatter has the last word).

## Toolchain

The repo requires the **active Node LTS** (24.x) and **pnpm 11**, and it enforces both rather than suggesting them:

- `engines.node` is `>=24` (major-version compatibility only — any 24.x satisfies it), and `engineStrict: true` in `pnpm-workspace.yaml` makes `pnpm install` **fail** on an older runtime instead of printing a warning. `.npmrc` sets the equivalent `engine-strict=true` so a stray `npm install` fails the same way — pnpm 11 reads its own settings from `pnpm-workspace.yaml`, not `.npmrc`, which is why both exist.
- `.nvmrc` says `24`, so `fnm use` / `nvm use` picks the latest installed 24.x. If `pnpm install` refuses to run, the fix is `fnm use` / `nvm use`, not editing `engines`.
- **TypeScript is 7.x** (pinned exactly, same version in the root and every workspace). TS 7 is the native compiler, and it ships **only a `tsc` binary** — there is no `tsserver`, and the JavaScript compiler API is gone (`node_modules/typescript` exports just the version string plus `./unstable/*` entry points). Two things follow:
  - `next build` type-checks by shelling out to the project-local `tsc` CLI, which is the Next 16 default. Do **not** set `experimental.useTypeScriptCli: false` — that switches Next back to the JS compiler API, which TS 7 does not provide, and the build exits. Diagnostics come out as plain `tsc` output without Next's code frames.
  - The `plugins: [{ "name": "next" }]` entry in the tsconfigs is a **tsserver** plugin, so it does nothing while an editor is pointed at the workspace TypeScript. It is kept because it costs nothing and is what Next's docs prescribe; "Use Workspace Version" in VS Code is not available under TS 7.
- pnpm 11 applies a **supply-chain cooldown** (`minimumReleaseAge`) to new releases. Installing a package published inside that window appends pinned entries to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml` — that list is a record of deliberately-accepted fresh releases, not cruft. Prune entries when the versions they name are no longer the ones installed.
- `pnpm-workspace.yaml` is in oxfmt's `ignorePatterns` because pnpm writes those generated entries single-quoted and oxfmt rewrites them double-quoted, so the two tools would flip the file back and forth on every install. pnpm owns that file; do not remove the ignore.
- `docs/efforts/*/advisories/` is ignored for the same shape of reason: a committed advisory is **verbatim** and `.claude/hooks/build-guard.sh` refuses to edit one, so a formatter rewriting it would make `pnpm format` and the Build gate contradict each other. `/spec-review` diffs the spec against those files; reformatting them is editing them.

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

**The test runner is Vitest.** `pnpm test` runs `turbo run test test:gates migrations:check`, which is six suites plus one live gate:

- `@repo/design-system:test` — `vitest run`, **happy-dom**, React Testing Library. Config in `vitest.config.mts`, cleanup between tests in `vitest.setup.ts`.
- `@repo/errors:test` — `vitest run`, **Node default environment**, no plugin and no setup file. The prior art for a Node package here: a `vitest.config.mts` carrying `resolve.tsconfigPaths`, `globals`, and an `include` glob, and nothing else.
- `@repo/observability:test` — `vitest run`, Node environment, the same minimal config as `@repo/errors`. It is the **stdout seam**: a test that asserts on a _line_ builds a `pino` instance from `createLoggerOptions` over an in-memory `Writable`, and pino's own test utility is deliberately unused because it asserts on `pid`/`hostname` before stripping them, which these options replace. The two modules that emit no line — the report seam and the trace-context reader — are tested against the real SDK with no client initialised, which is a real state this repo runs in rather than a mock.
- `@repo/domain:test` — `vitest run`, Node environment, and **two seams as two Vitest projects** in one config (spec 0002, `## Testing Decisions`). Seam 1 is pure — the connection-string resolvers, the server-only backstop — in the same minimal shape `@repo/errors` set. Seam 2 runs against **PGlite in-process**, replaying the **committed migrations** rather than a `CREATE TABLE` written for tests, which is the whole reason it is a seam and not a mock. PGlite 0.5.7 reports **PostgreSQL 18.3** against PlanetScale's 18.4 — read out of the running engine by the suite itself, so the claim cannot go stale silently.
  - **The filename is the seam.** `src/**/*.integration.test.ts` is seam 2; every other `*.test.ts` is seam 1. The projects exist so that `globalSetup` applies only to the files that need it — it is per-config, so before the split a run touching only the pure resolvers still replayed every migration into PGlite and dumped a data directory before the first assertion. `pnpm exec vitest --project seam-1` is now a real thing to run while iterating on a pure function.
  - **The database arrives as a `test.extend` fixture, not as hooks.** Import `test` from `#testing/fixtures` in an `*.integration.test.ts` and destructure `{ database }`; the restore-and-close lifecycle is the fixture's. Three files used to open with the identical `let database` / `beforeEach` / `afterEach`. The fixture lives in `#testing/fixtures` and **not** in `#testing/database` on purpose: `global-setup.ts` imports the latter for `SNAPSHOT_PATH`, and a `test.extend` at that module's top level aborts the run with _"Vitest failed to find the current suite"_ because `globalSetup` runs with no suite. The globals stay — this replaces `describe`/`it`/`expect` with nothing.
  - `globalSetup` builds the post-migration snapshot **once per run** and dumps it to `node_modules/.cache/pglite/`; each test file restores from that in milliseconds, so no test truncates and no test sees another's rows.
- `web:test` — `vitest run`, **happy-dom**, the design system's config copied per the paragraph below, plus `vitest.setup.ts`. It covers what a running server cannot show, starting with the proof that `@repo/domain`'s `exports` map withholds what ADR-0010 says it withholds. Route handlers, Server Components and Server Actions verify at seam 3 instead, against a running `next dev`. Its setup file registers **`toMatchSchema`** from `apps/web/testing/matchers.ts` — a custom matcher taking a **Standard Schema** rather than a Zod schema, so nothing in a test has an opinion about the validation library. Reach for a matcher over a helper when the assertion's failure message is the thing worth owning: `expect(x).toBe(true)` on a `safeParse` result reports `false is not true` and names neither the rule nor the value.
- `//#test:gates` — `gate-test.sh`, the 134 cases that drive the repo's own gates. Sixty-four are the stage hooks; the rest drive the two gates that are not hooks at all, which are the same kind of thing — repo logic deciding whether work may proceed, so a test suite and not a script to remember to run. Its `inputs` cover `.claude/hooks/**` and both scripts.
  - The **dependency audit** (`scripts/audit-direct.mjs`), thirteen cases. Five exist because the way that gate fails is by **failing open**: an unread `pnpm-workspace.yaml` would leave only the root manifest counting as direct, and a `high` in a workspace dependency would print as transitive and exit 0.
  - **Migration integrity** (`scripts/migration-integrity.mjs`), fifty-seven cases across NFR30's four counts — an append-only journal, immutable shipped migrations, destructive statements travelling alone under a `contract` marker, and a marked migration never sharing a pull request with `@repo/domain`'s query modules. Its fixtures are real git repositories, because the gate's whole frame is `git merge-base <base branch> HEAD` and there is nothing left to mock that would still be the thing under test. Ten of the fifty-seven are a section of their own — holes `/code-review` found in the first draft, four of which passed green while checking nothing. Read them before touching the SQL scan: an escaped quote that swallowed the rest of the file, and an `ALTER TABLE` whose comma-separated actions hid a `DROP` beside an `ADD`. **`run_mig` unsets `GITHUB_BASE_REF` for every case**, and that is load-bearing: CI sets it on a `pull_request` event, the gate reads it ahead of `origin/HEAD`, and a fixture is a different repository with no such ref — thirty-five cases went red on the first CI run for exactly that.

  Both exit `2` rather than `0` or `1` when they cannot reach an answer, so a broken gate cannot be read as a clean one.

  **One carve-out in rule 3, added by #17 and worth reading before widening it.** A `DROP CONSTRAINT
"x"` on table `t` is not counted destructive when the same migration adds an `ADD CONSTRAINT "x"
CHECK` back **on `t`**, and an earlier migration already declared `t`.`x` a `CHECK` — so it is a
  re-creation rather than a removal. DD2 makes every enum-shaped column a `TEXT` with a `CHECK`
  _"precisely so that widening the set is a constraint change"_, and Postgres offers exactly one way
  to widen one; before the carve-out, rule 3 refused the pair and rule 4 kept the marked migration
  out of any PR touching a query module, which made every widening unsatisfiable. The gate's own
  reason — _"the drop has already destroyed the data"_ — does not reach a `CHECK`.

  **Both of the qualifications above are patched bypasses, not caution, and they are why this is
  worth reading before touching it.** `DROP CONSTRAINT` does not say what _kind_ of constraint it
  removes, so matching the re-add alone let a `UNIQUE` be dropped and a `CHECK (true)` put back under
  its name — that is what the history condition closed. And a constraint name is unique **per table**
  in Postgres rather than per schema, so a decoy `CREATE TABLE "decoy" (…, CONSTRAINT
"user_email_unique" CHECK (true))` in one migration used to vouch for dropping the real uniqueness in
  the next — that is what keying on `table.name` closed (review of #93). It fails closed on every
  axis: an unknown name, an unreadable table, an unusual spelling all refuse. It is otherwise
  deliberately narrow — a bare drop, a re-add under another name, a re-add on another table, and a
  re-add as `UNIQUE` all still refuse, and twenty `gate-test.sh` cases say so.

- `//#migrations:check` — the same migration gate, run against **this** repository rather than a fixture. It is `cache: false` on purpose and it is not a case inside `gate-test.sh`: that suite is cached on `.claude/hooks/**` plus the two scripts, and this answer also depends on git history and on migration files none of those inputs cover, so a cached replay would report a pass nothing had checked. CI's `test` job therefore checks out with `fetch-depth: 0` **and points `origin/HEAD` at the default branch the webhook payload names** — a shallow clone has no merge base, and a checkout with no `refs/remotes/origin/HEAD` has no default branch to take one against; the gate refuses to call "I could not compare" a pass on either count. `GITHUB_BASE_REF` covers the `pull_request` event only, so the `push` run on `dev` is what needs the second half.

All three package suites follow the same three rules. Tests sit **beside their source** — `src/**/*.test.{ts,tsx}` in the design system, `src/**/*.test.ts` in a package with no JSX — so `check-types` covers them (the tsconfig `include` is `src`). Every workspace with tests sets `"types": ["vitest/globals"]` in its tsconfig. And:

> **Vitest globals are ON. Never `import { describe, it, expect } from "vitest"` in a test.** Those names are already in scope through `test.globals: true` plus the `vitest/globals` types entry, and a test file that imports them is the mistake to correct on sight — in review, or the moment you notice one while editing. Import from `"vitest"` only for something that genuinely is not a global. This repo shipped the opposite convention once and every new package copied it from the prior art, which is why it is written here as a rule rather than left to be inferred from a config file.

**A mocked module is imported statically, and `vi.hoisted` is what makes that possible.** `vi.mock` is lifted above _every_ statement in the file, so a factory closing over a plain `const handler = vi.fn()` reads that binding in its temporal dead zone the moment a static import evaluates the mocked module — `ReferenceError: Cannot access 'handler' before initialization`. The tempting fix is `const { Thing } = await import("./thing")` after the consts, which works only because a dynamic import runs after the module body; this repo shipped that shape once and it spread by copying. Define the doubles inside `vi.hoisted(() => ({ … }))` instead and keep the imports static — that is what the helper exists for, and it leaves the file's imports looking like every other file's.

**Query a component by role, and reach for `container.querySelector` only where the accessibility tree cannot answer.** A test that finds an element by CSS selector asserts that the markup has a shape; a test that finds it by role asserts that a _user_ can reach it, which is the thing NFR20 is about. The two come apart exactly where a bug lives — a `<div aria-live="polite">` with no `role` is reachable by `querySelector` and by nothing a screen-reader user has, and the selector in the test is the tell that nobody noticed. `@testing-library/jest-dom` is registered in `apps/web/vitest.setup.ts`, so an accessibility question is written as the question: `toHaveAccessibleDescription` resolves `aria-describedby` to the text that is actually announced, rather than the `container.querySelector('#' + id)` this repo hand-rolled once.

The escape hatch is real but narrow, and it is for **things the accessibility tree does not contain**:

- a **hidden input** — it has no accessible role by definition, so its _absence_ is unassertable any other way, and asserting that absence is how `sign-in-form.test.tsx` pins that bound arguments have not been re-introduced as hidden fields
- the **HTML that survives without JavaScript** — "two `<form>` elements, each with an `action`" is a question about NFR4, not about the accessibility tree, and a `<form>` gains a role only once it has an accessible name

What is **not** a reason: the element is awkward to query. If a role query cannot find it, the first thing to check is whether the component should have told the accessibility tree it exists. Both remaining `querySelector` calls in `apps/web` carry a comment saying which of the two cases they are.

**The DOM environment is happy-dom, not the jsdom Next's docs prescribe.** That is a deliberate deviation from the framework's documented path, so it was measured rather than preferred. Three axes, all favouring happy-dom:

|                           | jsdom 30                               | happy-dom 20          |
| ------------------------- | -------------------------------------- | --------------------- |
| `engines.node`            | `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0` | `>=20.0.0`            |
| transitive packages       | 39                                     | 10                    |
| vitest `environment` cost | ~330 ms per test file                  | ~135 ms per test file |

The engines line is the one that forced the decision: with `engineStrict` on, jsdom raises this repo's floor from any 24.x to 24.15+, which is a narrower runtime than anyone working here should have to hold for a test dependency. The environment cost is paid **per test file**, so it scales with the suite rather than being a one-off.

**The correctness axis went the other way from the folklore.** A probe of eighteen DOM APIs found nine differences and every one favoured happy-dom: `matchMedia`, `ResizeObserver`, `IntersectionObserver`, `scrollIntoView`, `dialog.showModal`, `inert`, `checkVisibility`, `elementFromPoint`, and `Range.getClientRects` are all missing or throwing under jsdom and present under happy-dom. Nothing was present under jsdom and missing under happy-dom. That matters concretely here: `next-themes` reads `matchMedia` and Base UI reaches for `ResizeObserver`, so the jsdom route needs a setup file full of mocks before the first component test runs.

Be honest about what that probe shows, though: it tested **presence, not fidelity**. jsdom's stated philosophy is to omit what it cannot implement correctly, so a happy-dom API that exists but never fires would be worse than an absent one you knowingly mocked. `src/components/dialog.test.tsx` is the guard against that — a portal plus a real `user-event` click is where a DOM environment actually breaks, and it is the case a real surface hits long before it hits Button. If it ever fails, reconsider the environment rather than the test.

`apps/web` **gained its `test` script with the change that first put real code in the app**, which is exactly the condition this file used to name while the app was still `create-next-app` scaffolding: a suite there before then would have been vacuously green (`--passWithNoTests` tells `/implement` a lie) or test code destined for deletion. The config is `packages/design-system/vitest.config.mts` copied, happy-dom and all.

**What that script may not be used for is unchanged, and it is the important half.** Vitest **cannot test `async` Server Components**, and an imported Server Action is not the compiled POST endpoint an attacker reaches — so a green test there would assert authorization on a code path nobody attacks. Both verify at seam 3, against a running `next dev` through the `next-dev-loop` skill, and `docs/policy/build.md`'s definition of done requires that leg for any change touching `apps/web`. What belongs in `web:test` is what a running server cannot show: module resolution, Client Components, and table-driven assertions over a route list.

## Verifying your work

Before reporting a change complete, run `pnpm lint && pnpm format && pnpm check-types && pnpm test` (add `pnpm build` for anything touching Next.js config, routing, Tailwind sources, or `@repo/design-system` exports). Healthy output is Turborepo's summary with every task `cached` or `successful` and a non-zero `Tasks: N successful`.

**CI runs exactly these commands, on every pull request.** `.github/workflows/ci.yml` is five jobs — `lint`, `check-types`, `test`, `build`, `audit` — one per entry in `docs/policy/build.md`'s `required-checks`, named so that a human can require each by name as a status check (`docs/runbooks/recomencemos-go-live.md` §8). Each job runs the **root script**, never a `turbo run` restated in YAML, so the two cannot drift; the Node and pnpm versions are read from `.nvmrc` and `packageManager` for the same reason. The fifth job is `pnpm audit:direct`, which is `scripts/audit-direct.mjs`: `high` or above in a **direct** dependency fails the run, and a transitive advisory is printed but never blocking (`docs/policy/security.md` → `dependency-policy`). Do not reach for `pnpm audit --audit-level=high` instead — this repo already carries a `high` transitive advisory, so that gate is red on arrival.

**Dependabot is the other half of the audit job, and it has one coupling worth knowing.**
`.github/dependabot.yml` covers npm (one entry — Dependabot expands `pnpm-workspace.yaml`'s globs
itself), `github-actions`, and `docker-compose` — the last for the two image digests in
`docker-compose.yaml`, whose whole failure mode is that an exact pin never moves. That ecosystem is
**version updates only**, with no security-update channel, which is acceptable only because those
containers are loopback-bound development ones in no deployment path. Its `cooldown` is set against **`minimumReleaseAge` in
`pnpm-workspace.yaml`**, which is 1440 minutes: a package published inside that window does not
resolve locally at all, so a PR raised sooner is one nobody could install. Dependabot's own default
is already stricter, so the two cannot currently disagree — it is pinned anyway because the number
that matters is the relationship between the two files. The `github-actions` entry names
`/.github/actions/*` as well as `/`, without which the SHA pin in the composite setup action would
never be updated. Its commit messages are prefixed to stay inside Conventional Commits.

**It also ignores `@types/node` majors, and that is the one hole `engineStrict` cannot cover.** The
repo requires the active LTS and enforces it by reading each package's `engines` field —
`@types/node` has none, because it is types rather than code, so a `@types/node@26` installs clean on
Node 24 and then teaches `check-types` an API surface the runtime does not have. Green CI is the
symptom, not the reassurance. Majors are ignored rather than a `versions:` range spelled out because
`.nvmrc`, `engines.node` and this dependency move together in one deliberate edit; that edit is where
the types package is raised by hand. `ignore` is blunt enough to suppress security advisories too,
which is tolerable only because the package ships no runtime code — do not copy the rule onto one
that does.

`pnpm lint` is stricter than it looks. The root `.oxlintrc.json` puts oxlint's `correctness` category at `error` but `suspicious` and `perf` at `warn`; the `--max-warnings 0` flag in the root `lint` script is the only thing that turns those warnings into a failing exit code. Never relax that flag to make lint pass, and don't silence a rule repo-wide when a scoped `overrides` entry or an `// oxlint-disable-next-line` with a reason would do.

## Architecture

Workspaces are declared in `pnpm-workspace.yaml` (`apps/*`, `packages/*`) and referenced across packages as `workspace:*`. Guidance for `packages/design-system` — including the single Tailwind v4 stylesheet it owns, whose `@source` globs a new app workspace must be added to — lives in `packages/design-system/CLAUDE.md`; `apps/web`'s Cache Components rules live in `apps/web/AGENTS.md`.

**A surface under `app/` is a folder, not a pile of files.** A route directory holds `page.tsx` and
`actions.ts` — the two things the framework and the network reach — and everything else sits in a
Next **private folder** (`_`-prefixed, so it is excluded from routing):

```
app/(site)/(auth)/sign-in/
  page.tsx                        # the route, and nothing else
  actions.ts                      # "use server"; one file, however many actions
  _components/{sign-in-form,google-mark}.tsx
  _lib/{schema,messages,use-sign-in}.ts
```

Route groups (`(auth)`) carry no URL segment and exist to group surfaces that share a shape. The
split is by **role**, not by kind: `_lib` holds what the surface knows (its schema, its Spanish, its
client machine) and `_components` holds what it renders. The flat twelve-file `app/sign-in/` this
replaced is the shape to avoid, and it is why `/code-review` should flag a route directory growing
past its two files plus two folders.

**Three groups sit at the top level, and they exist to separate audiences rather than shapes** (#17,
#103). `app/(site)/` is the public product — the Wall, `/sign-in`, `/account` — and its layout
renders `SiteHeader`. `app/(admin)/` is the moderation queue and its door, and its layout renders
none of that chrome: the session menu, the signed-in identity and _salir_ are built for a Worker on a
phone, and two of their parts would be actively wrong above `/admin`. The **root** layout is
therefore `<html>`, the fonts and one `<Toaster />`, and nothing else — a nested layout cannot remove
a parent's chrome, so the only way for `/admin` to have a shell of its own was for the root to stop
having one. No group adds a URL segment.

**`app/(token)/` is the third, and it exists because that same sentence applies one level down.** It
holds the routes under `/admin` that are reached with a **token and no session** — today
`/admin/enrol/[token]`. They cannot sit in `(admin)`: `AdminHeader` answers "am I signed in, as
whom, how do I leave", and on a page where no session exists yet all three are meaningless. Worse,
it renders a wordmark linking to the queue, which tells the holder of a setup link that a queue is
there and then walks them into a 403 — on a surface whose brief refuses to name `/admin` at all. That
was observed running, not predicted. A nested layout cannot remove a parent's chrome, so the route
moved out of the group rather than the group growing a conditional.

**`/admin/*` refuses with a real 403, and the mechanism is worth knowing before changing it.** NFR14
asks for _"403, returned, not a redirect and not a thrown error"_, and the three callers answer it
differently:

- A **page** calls `requireAdminPage()` from `lib/admin.ts`, which calls `forbidden()` —
  `experimental.authInterrupts` is on for this and nothing else. It is a framework interrupt of the
  same class as `redirect()`, so it costs no Sentry event, and it is the only way an App Router page
  can set a status code.
- A **Server Action** is built from `adminActionClient`, whose `use()` middleware returns a 403
  `ClientError` **before** the boundary parse. Written as a first line in each action body it ran
  _after_ validation, which seam 3 caught.
- **`/admin` is `export const instant = false`.** That is `[block]` from Cache Components' own menu,
  chosen because a streamed shell is a **200** already on the wire by the time the gate answers. The
  queue's sources still stream inside the page.

`/admin/sign-in` is the one route under the prefix that does not call the gate, and it is an
exemption **by omission** — there is no allowlist, because a second place the boundary is described
is the first place a later route falls on the wrong side of.

**Every Server Action is built from `apps/web/lib/safe-action.ts`.** That module holds
`actionClient`, the `handleServerError` bridge from `AppError` to the client envelope,
`returnActionError` for an expected refusal, and `rateLimit` — NFR26's ceilings as `useValidated`
middleware an action opts into by naming its principals. Three rules, all in
[ADR-0015](docs/adr/0015-both-doors-are-server-actions-and-the-browser-holds-no-auth-client.md):

- **`.stateAction()` + React's `useActionState`.** Never next-safe-action's `useStateAction` or
  `useAction` — the vendor's own form guide marks both as not working without JavaScript, which
  would put NFR4 out of reach.
- **`returnActionError` for an expected refusal; `throw` for the unexpected.** That is "thrown is
  reported; returned is logged" made structural — a thrown error reaches `handleServerError` and
  costs a Sentry event, a returned one bypasses it and costs one `warn` line.
- **Values that travel with a submit but are not typed into it are bound arguments**, not hidden
  inputs. `action.bind(null, returnPath, sharedDevice)` with `bindArgsSchemas` is typed, validated on
  arrival, encoded by React, and survives with JavaScript unavailable. A hidden `<input>` mirroring a
  piece of client state is the shape to replace.

**`@repo/errors` has no `dependencies` key, and that absence is the design.** It is isomorphic — importable from a Server Component, a Client Component, a Route Handler, a Server Action, or either instrumentation entry point — and the empty dependency list is what _enforces_ that rather than documenting it: a stray `import pino` there fails to resolve under pnpm's isolated store, where a semantic subpath in a single package would only fail a `.next/static` grep after the fact. Never add a runtime dependency to it. Anything needing one belongs in a server-only package instead — which is what `@repo/observability` is.

**`@repo/observability` is the other half of that split, and it is server-only.** It depends on `pino`, `pino-pretty`, their stream packages, and `@sentry/nextjs` — which is what makes it the home of the report seam and the trace-context reader — so it may not be imported from a Client Component, from `instrumentation-client.ts`, or from anything on a `"use client"` path. What actually keeps it out of the browser is its `exports` map: **every entry carries a `browser` condition pointing at `src/browser-refusal.ts`**, so a `"use client"` import fails to resolve at build and `pino` never enters the client graph at all — mechanism 1 in the table below, in its strongest form, with the observed Turbopack error recorded in that file. `assertServerOnly()` is the backstop, not the mechanism. A browser module that needs an error type imports `@repo/errors`, which is isomorphic by construction.

**`@repo/domain` is the only door to the database, and its `exports` map is what makes that true rather than aspirational** ([ADR-0010](docs/adr/0010-the-domain-package-is-the-only-door-to-the-database.md)). It publishes per-aggregate model subpaths and **withholds** the Drizzle schema, both connections, and (with #12) the Better Auth instance — an unexported subpath is unresolvable under pnpm's isolated store, so reaching past the domain layer is a module-resolution error rather than a review comment somebody has to notice. `apps/web/domain-boundary.test.ts` asserts both halves against **Node's own resolver**, which is the one `next build` uses. Widening the map "just for a script" removes the boundary with no compile error anywhere; the one subpath added beyond the spec's table is `./health`, and the reason is written at the top of `packages/domain/src/health.ts`.

**Two connections, and they are not interchangeable.** The **pooled** one (`DATABASE_URL`, PgBouncer on 6432 locally, PlanetScale's pooler in production) is what every request path uses; the **direct** one (`DIRECT_DATABASE_URL`, 5432) is what migrations run on. Transaction-pooling mode removes `LISTEN`/`NOTIFY`, session advisory locks, temp tables and cross-transaction prepared statements, so DDL in a long transaction cannot cross it (spec 0002, DD2). Neither variable appears in **any** `turbo.json` task and neither may be added to one — NFR24 names both as runtime credentials, and `.env*` is a `build` input. `turbo build --dry` is how you check.

**Server-only is enforced by three mechanisms, and a new server-only package answers all three in order** ([ADR-0013](docs/adr/0013-a-server-only-package-declares-which-guards-it-has.md)). They are not alternatives — they fail at different moments, and a package may hold more than one:

| #   | Mechanism                                                                                                   | Fails at                                            | Apply it when                                                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **The `exports` map** — withhold the subpath, or point it at a refusal module under the `browser` condition | Module resolution, so **build**                     | Always. Withholding costs nothing; the `browser` condition costs one file and is what keeps the dependency out of the client graph rather than throwing once it is there |
| 2   | **`import "server-only"`**                                                                                  | Build, but **only inside the `react-server` layer** | The module is Next-only. It resolves to an empty module under the `react-server` condition and to a bare `throw` under every other                                       |
| 3   | **`assertServerOnly()`** from the package's own `#server-only`                                              | Runtime, at import                                  | Always, as a backstop. Never as the plan                                                                                                                                 |

**The dividing line for 2 is verified rather than assumed: plain `node` sets no `react-server` condition, so `server-only` throws there** — and plain `node` is what `packages/domain/src/migrate/cli.ts` is in a Fly `release_command`, what the `email dev` preview server is, and what every Node-environment Vitest file is. That is why `@repo/domain` carries the marker on `connection.ts` and `health.ts` and nowhere else, and why `@repo/observability` and `@repo/notifications` carry it nowhere at all. Route Handlers **are** inside the `react-server` layer (checked: `pnpm build` compiles and `GET /api/health` answers 200 with the marker in place). The root `.oxlintrc.json` allows `server-only` in `import/no-unassigned-import` for this, the same way it already allows `**/*.css` — that is the rule's own escape hatch, not a relaxation of `--max-warnings 0`.

**`@repo/notifications` holds mechanism 1 in both its forms too, and that closes ADR-0013's one named gap.** It publishes `./send` and `./templates/*` and withholds everything else, and each published entry points at `src/browser-refusal.ts` under the `browser` condition. Before that it had only the runtime backstop, which is why it was the package with the weakest guard and the strongest credential. What the fix measured, rather than predicted: a `"use client"` page calling the send seam used to **compile successfully** and put 152 occurrences of `resend`, the live `api.resend.com` endpoint and `RESEND_API_KEY` into `.next/static`; it now fails to resolve, and a server-path import leaves the client bundle with none of them. The counts and the verbatim Turbopack error are in that file.

**Mechanism 3 is duplicated in all three packages on purpose.** The shared part is the `globalThis.window` check; the part that matters is the package name, the thing it holds, and what to import instead — `pino` and its streams, a Node TCP client and the database credentials, `RESEND_API_KEY` and the one irreversible act in this system. A backstop that fires with the wrong name and the wrong remedy is worse than ten duplicated lines. ADR-0013 answers a review comment proposing to share it; do not re-argue it.

**Mechanism 1 is the mechanism, and it is the only one of the three with a test.** `apps/web/domain-boundary.test.ts` and `notifications-boundary.test.ts` assert it against **Node's own resolver**, which is the one `next build` uses.

**Inside `apps/web`, a cross-directory import is `@/`-prefixed.** `apps/web/tsconfig.json` maps `"@/*"` to `"./*"`, so `import { auth } from "@/lib/auth"` replaces `"../../../lib/auth"` — a specifier that changed every time a route moved, which is exactly what the `app/(auth)/sign-in/` folder move did to it. Next reads tsconfig `paths` natively and `apps/web/vitest.config.mts` already sets `resolve.tsconfigPaths`, so `tsc`, Turbopack and Vitest all resolve it with nothing further configured.

**It is tsconfig `paths` here and the `imports` field in `@repo/domain`, and the difference is not an inconsistency to tidy up.** The paragraph below is why the package uses `#`: it must resolve under plain `node`, which tsconfig `paths` cannot do. `apps/web` has the opposite constraint — it never runs outside the bundler, and **Turbopack does not resolve a package's own `imports` subpaths**. Measured, not assumed: `#lib/auth` type-checks and passes Vitest, then fails `next build` with `Module not found: Can't resolve '#lib/auth'`. Each side uses the one mechanism its own runtime supports.

**Inside `@repo/domain`, internal imports are `#`-prefixed** — `#config`, `#schema`, `#connection` — declared in the package's `imports` field. This is not style. The package withholds most of its own modules, so a self-reference through `@repo/domain/...` fails for exactly the reason it is supposed to; and a relative `./config.js` specifier resolves under Vite but **not** under plain `node`, which is what `packages/domain/src/migrate/cli.ts` runs as in a Fly `release_command`. The `imports` field is the one form Node, Vite and `tsc` all resolve identically, and a `#` specifier is private to the package that declares it, so it is not a second door into the domain.

**An Admin comes into existence from a shell and nowhere else** (#17, #103, runbook §6). No form
creates one; `isAdmin` is declared `input: false`, so no request body sets the grant on any Better
Auth route, and neither command below is in `@repo/domain`'s `exports` map. Both run over the
**direct** connection.

**`pnpm admin:enrol <email>` is the one to use, and the grant is its last step.** It mints a
single-use setup link and prints it; opening the link shows the TOTP QR, the manual-entry secret and
the ten backup codes **once**; the six digits from the authenticator are typed back into the prompt,
which verifies them and only then sets `isAdmin`. That ordering is the security property — an Account
cannot hold Admin authority until a working authenticator has proved itself, so a half-enrolled Admin
is unrepresentable and a link opened and abandoned leaves no Admin behind. Running it again is both
the second-Admin recovery path and the break-glass: it replaces the factor rather than adding one.

**`pnpm admin:grant <email>` is what it replaces, and it is still here only because the password door
is.** It sets the grant **first** and leaves the second factor to a later sign-in at `/admin/sign-in`,
which is the window the new command closes. It goes with the password door and Better Auth's
`twoFactor` plugin in the contract ticket; do not reach for it, and do not copy its shape.

**Migrations are generated, never hand-written.** `pnpm db:generate` writes them from `packages/domain/src/schema.ts`; `pnpm db:migrate` applies them on the direct connection. `.claude/hooks/build-guard.sh` rule J refuses a `Write` or `Edit` to a migration the journal already names — `drizzle-kit` writes through `Bash`, which is exactly the split that rule intends. `packages/domain/drizzle/` is oxfmt-ignored for the `pnpm-workspace.yaml` reason: `drizzle-kit` owns those files and rewrites them in its own style on every generate.

**Config is consumed by extension, not by copying.** `packages/typescript-config/base.json` sets the strict baseline (`strict`, `noUncheckedIndexedAccess`, NodeNext resolution); `nextjs.json` and `react-library.json` extend it and override module resolution per target. Tighten compiler options there so every workspace inherits them — not in individual workspace configs.

**Lint config is nested, not packaged.** oxlint discovers `.oxlintrc.json` files automatically and applies the nearest one to each file, so the root config holds the repo-wide baseline and each workspace's `.oxlintrc.json` `extends` it and adds what only that workspace needs.

`plugins` **overwrites** rather than merges, so a workspace config must relist the inherited plugins alongside its own. Put a rule everyone should follow in the root config; put a framework-specific one in the workspace that has that framework.

**Turborepo task graph.** `build`, `lint`, and `check-types` all declare `dependsOn: ["^build"]`/`["^lint"]`/`["^check-types"]`, so a topological order is enforced across workspaces. `dev` is `cache: false` and `persistent: true`. `build` inputs include `.env*`, so env files invalidate the cache.

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

**A stack on a log line is trimmed by value, and names generated code.**
[ADR-0004](docs/adr/0004-stack-frames-are-trimmed-by-value.md) fixes both halves. Runs of vendor
frames collapse to one counted marker, so the budget buys application frames — measured at 79% of a
Next.js request stack spent on `.pnpm` paths before it. And the logger resolves **no** source maps:
mapped frames in development are `node --enable-source-maps`, a process flag rather than a logging
feature, and in production the maps are deleted after upload. So a **thrown** error's mapped stack
lives in the reporting platform, and a **handled** one has none. That last gap is real, and named
there rather than closed.

**`context` carries identifiers and shapes** — ids, counts, enum values, truncated inputs. Never
credentials, tokens, whole request bodies, or raw personal data; a secret never enters it. This is
the rule redaction **cannot** enforce, which is why it is written here rather than left implied by
`redaction.ts`: that list matches key _names_, so it catches a secret at `password` and misses the
same secret at `value`.

**The request-completion line is the one exception to that rule, and it is the only one.** `context.path` on the
request-completion line carries the concrete request path on every request, so a credential in a URL
**path segment** is logged verbatim by code no caller wrote.
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

## Things to get right

- **No `apps/web` module may import `better-auth/react`, and nothing in a browser holds an auth client**
  ([ADR-0015](docs/adr/0015-both-doors-are-server-actions-and-the-browser-holds-no-auth-client.md)).
  Both sign-in doors are Server Actions calling `@repo/domain/auth-handler`. The vendor adapter
  `@next-safe-action/adapter-better-auth` cannot be used here either — it takes the Better Auth
  _instance_, which ADR-0010 withholds — so an authenticated action gets a local middleware over
  `AuthHandler.getSession`. `sign-in-form.test.tsx` asserts the first half over the surface's source.
- **Spanish is the interface; English is the code** ([ADR-0012](docs/adr/0012-spanish-is-the-interface-english-is-the-code.md)). `es-CO` is the product's only language and it governs **only what a person reads**. Every identifier you type is English: route segments, file and directory names, database tables and columns, enum values, query parameters, API field names, log `event` names, test names, branch names. The line is **identifier versus value** — `Skill.labelEs` is an English column holding a Spanish string. So the route is `/offers`, the table is `offer`, the entity is `Offer`, and the page says _Propuesta_. This is written down because effort 0002's spec routed the entire product in Spanish — `/perfiles`, `/publicar`, `app/mi-perfil/page.tsx` — through the API contract and the deep dives before a human caught it. `CONTEXT.md`'s glossary gives every term both names; use the English one everywhere except the rendered string.
- `apps/web/app/layout.tsx` carries the product's metadata and `lang="es-CO"`. The `lang` attribute is not decoration: every string below it is Spanish, and a wrong `lang` has a screen reader announce Spanish with English phonemes.
- `apps/web/app/page.tsx` is a **holding page**, not the Wall. Story 4 ([#21](https://github.com/m0t0r/recomencemos/issues/21)) replaces it. It deliberately makes no claim about verification or money — those are story 11's two standing notices ([#22](https://github.com/m0t0r/recomencemos/issues/22)), and a half-version anywhere else gives them a second source.
- **Before writing any presentational element, read `packages/design-system/src/components/`.** A component the registry lacks is added with `pnpm dlx shadcn@latest add <component> -c packages/design-system`; hand-roll only what has no registry equivalent. `REVIEW.md`'s registry-equivalents pass blocks a merge on a hand-rolled equivalent — PR #77 hand-rolled three the registry already exported (#79 row 8).
- The React version is 19 and Next is 16 (App Router). Server Components are the default; the registry marks the components that need `"use client"` (anything with state, effects, or handlers). New interactive components need the same directive.
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
- `.claude/agents/<name>.md` — scoped subagents for recurring work such as verification, research, or simplification.
- `.claude/settings.json` — hooks as deterministic gates (protected paths, formatters, credential scanning, deploy authorization).
- `REVIEW.md` — the PR review passes beyond `code-review`'s two axes, and the severity threshold that blocks a merge. Under stacked PRs it also says what runs per-PR and what runs once at the top of the stack.

**The method/policy split is the load-bearing idea.** Mixing them is what turns a skill into a form nobody fills in: a file that says "the WCAG level is your organization's call" teaches the reader that the whole document is negotiable. Put the craft in the skill and the answer in `docs/policy/`, and each half can be judged on its own terms.

**A runbook is a third thing, and it is what the split produces rather than an exception to it.** Method is how the work is done and is the same everywhere; policy is the answer only an organization gives. A runbook is the _procedure_ that carries a reader from one to the other — ordered steps, real numbers, real commands — and it is neither craft nor an answer. The test that keeps it honest is that **a runbook step ending in a decision names the `docs/policy/` key instead of making it**: that is why `observability-go-live.md` could state the two band numbers as arithmetic while still leaving `alert-destination` `UNSET` for the effort that had grounds to set it (0002 since has). A runbook that quietly answers a policy key has stopped being a runbook and become the form nobody filled in.

`CLAUDE.md`, `AGENTS.md`, `.agents/skills/`, `.claude/agents/`, `.claude/hooks/`, `.claude/settings.json`, `docs/policy/`, `docs/runbooks/`, `DESIGN.md`, `.mcp.json`, and `REVIEW.md` all exist — `REVIEW.md` was the last one in, created by the retro on #79 with the registry-equivalents pass as its first. What remains genuinely missing is every remaining `UNSET` value under `docs/policy/`. `.github/workflows/` was filled by effort 0002's story 15 — see the CI paragraph under **Verifying your work** above.

The `code-review` skill and `REVIEW.md` are the method/policy split again: the two-axis review is craft, while which extra passes run, what severity blocks a merge, and what changes under a stack are answers only this project gives — and the skill discovers `REVIEW.md` as a standards source on its own, so a pass written there runs on every review with the vendored skill unmodified.

### Agent surfaces that already exist here

**`AGENTS.md` at two levels.** The repo-root one is a thin pointer at this file, for agents that read `AGENTS.md` rather than `CLAUDE.md`. `apps/web/AGENTS.md` carries a `<!-- BEGIN:nextjs-agent-rules -->` block that **`next dev` writes and re-adds** — it directs agents to the version-matched docs bundled at `apps/web/node_modules/next/dist/docs/`. Do not delete that block to clean a diff; it will come straight back on the next `next dev`. Project-specific instructions go _outside_ the markers, where they survive regeneration. `apps/web/CLAUDE.md` is just `@AGENTS.md`.

Prefer those bundled docs over recall when writing Next.js code. They match the installed version exactly and cost no network request. `next dev` also writes its PID/port/URL to `apps/web/.next/dev/lock`, so a second `next dev` reports the running server instead of starting a duplicate — connect to the existing one.

**Skills, vendored under `.agents/skills/`** and symlinked into `.claude/skills/`, tracked by `skills-lock.json`. Installed with `npx skills add <owner>/<repo> --skill <name>`; do not hand-edit the vendored files, re-run the installer.

**Editing a vendored skill means forking it**, because `skills-lock.json` is an install manifest — `skills update` pulls latest and `skills experimental_install` restores from it, so either overwrites local changes. A fork leaves the lock and gains a row in `docs/agents/forked-skills.md` recording its upstream path and the hash it forked at. **Do not fork for a small diff**: put the coupling in an artifact this repo owns (the spec template, `docs/policy/`, `CONTEXT.md`) so the vendored skill picks it up through what it already reads. Fork only when the procedure itself differs.

- `next-dev-loop` — the runtime foundation. Use it to verify a change actually _works_ against a running dev server, not merely that it compiles. Reach for it after edits to `apps/web`.
- `next-partial-prefetching-adoption` — moves the app onto Partial Prefetching (one shared App Shell). Requires Cache Components, which is already on. This is a workflow, not a lookup: it audits `<Link prefetch>` calls with the user first.
- `turborepo` — task graph, caching, and filtering reference.
- `implement` — the Build session. Vendored **thin on purpose**: it delegates to `/tdd` and `/code-review` and knows nothing of the frontier query, the ticket claim, or the PR. That is this repo's, and it lives in `docs/agents/issue-tracker.md`. Do not fork the skill to add it.
- `tdd` — red/green, and "no test is written at an unconfirmed seam". The seams were already confirmed at Design, so read the spec's `## Testing Decisions` section rather than re-interviewing the user.
- `code-review` — two axes, in parallel subagents: **Standards** (repo conventions plus a Fowler smell baseline) and **Spec** (does the diff do what was asked). It reads the plan comment `/implement` posted on the ticket. `REVIEW.md` is where a project adds its own passes and severity thresholds.
- `codebase-design` — the deep-module vocabulary `tdd` cites when the shape of an interface is itself the question. A reference, not a session.
- `resolving-merge-conflicts` — the tax on stacked PRs: a review fix low in a stack rebases everything above it.
- `diagnosing-bugs` — the Maintain-stage loop that produces what `/triage` promotes.
- `wizard` — generates a bash wizard that walks a human through steps only they can perform:
  provisioning, credentials, a third-party dashboard, a one-off cutover. `scripts/go-live.sh` is
  its committed product here, and it is the shape to copy: the library above the `STAGES` marker is
  generated and never hand-edited, and the stages below it are authored through `/wizard`. The
  other one, `scripts/setup.sh`, was deleted with the template framing — it walked a human through
  claiming a fresh clone, which is not a procedure this repository has any more.
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

`/to-spec` runs three phases, and the ordering is not stylistic: the interview is a pipeline, so the
API depends on the entities and an advisor spawned before the API exists is guessing.

1. **Draft** — the architect alone, in interview order: user stories (prioritized `Must`/`Should`/`Could`) → non-functional requirements (with numbers) → core entities → API contract → high-level design. Seams checked with the user.
2. **Consult** — `security-advisor`, `data-advisor`, `operability-advisor`, `simplicity-advisor` fan out in isolated contexts and return **advisories**, committed to `docs/efforts/<NNNN>-<slug>/advisories/`. The UX lens runs in the main session because one of its cases interviews the user.
3. **Synthesize** — the architect writes the deep dives, records every override in **Further Notes**, and proposes ADRs where a deep dive sets durable precedent.

**Each non-functional requirement names the user stories it binds.** That `Binds:` line is the whole coupling to Build: `/to-tickets` cuts one ticket per story and copies the spec's criteria onto it, so a bound NFR becomes an acceptance criterion without `/to-tickets` needing to know anything new — the coupling lives in the artifact we own, not in a skill we vendored. An NFR binding no story is a finding.

**A spec whose answers end in steps only a human can take carries a `## Runbook obligations` section, and that section is a ticket.** It is the same coupling seen from the other side, and it exists because a runbook step is not a tracer-bullet vertical slice — provisioning a bucket, printing backup codes, filing a DPA — so `/to-tickets`' default reading treats it as prose and drops it. The section's rows become the ticket's acceptance criteria and the runbook file is what the ticket works through; `docs/agents/issue-tracker.md` carries the mechanics, and `/to-tickets` is **not** forked for it. A spec that names a human-only step and produces no ticket has moved that work nowhere.

**Advisors advise; the architect writes.** An advisory that arrives as a finished section is read
for its analysis and rewritten — five authors produce five documents stapled together and bury the
conflicts the Flagged concerns list exists to surface.

**Deep dives are selected by which NFR the high-level design does not already satisfy.** That is
where infrastructure enters: as the answer to a number, never as a section called "infra".

`ux-design` is a **router**, not a rulebook — `impeccable` already owns interface craft at depth, and
`DESIGN.md` owns the visual system. Do not restate either one in a spec.

`/spec-review` is a **fidelity check** by default: one agent comparing the committed advisories
against the finished spec for anything dropped or diluted. `--adversarial` re-runs all four lenses
against the finished document, and costs four more spawns.

Prototypes at Design are the one exception to "no code yet": throwaway branch, never promoted, and
proposed rather than auto-run. `/prototype` LOGIC answers a state-model or API-shape question;
`/prototype` UI answers "which alternative wins" and needs an existing page to sit against.

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

**Stacked PRs are opt-in**, through `stacked-prs` in `docs/policy/build.md`. The mechanism is already
in the data: a chain of blocking edges _is_ a stack. But a stack is a path and the ticket graph is a
DAG, so the decomposition rule (maximal chains become stacks; a ticket with two blockers stays
serialized) is in `issue-tracker.md`. Never stack unrelated tickets for tidiness — a stack asserts an
ordering, and a false one makes review worse.

**The Build gate.** Two hooks, six rules, all covered by `gate-test.sh`:

| Hook                      | Rule                                                                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `build-to-deploy-gate.sh` | **F.** never approve or merge a PR — `gh pr merge`, an approving `gh pr review`, and `gh stack merge`, because a stack merge is a merge |
| `build-to-deploy-gate.sh` | **G.** never push to the default branch. Without it F is theatre                                                                        |
| `build-guard.sh`          | **H.** never hand-edit a vendored skill, a committed advisory, or `pnpm-lock.yaml`                                                      |
| `build-guard.sh`          | **I.** never write a credential into the repo                                                                                           |
| `build-guard.sh`          | **J.** never hand-edit a migration already named by a `meta/_journal.json` beside it                                                    |
| `verify-before-stop.sh`   | a `Stop` hook: the session may not report done while lint, `check-types`, `test`, `test:gates`, or `migrations:check` is red            |

Rule F is load-bearing exactly as rule A is for Plan and C for Design — the act must be one the agent
cannot perform. Unlike B and E it reads no artifact, because there is no state under which an agent
may merge.

Rule H's test is **`skills-lock.json`**, not a hand-kept path list: a skill named in the lock is one
`skills update` will overwrite. This repo's own skills sit in the same directory and are absent from
the lock, which is exactly what forking one means. The guard watches `Write` and `Edit` only, so the
installers keep working through `Bash`.

**These gates refuse false positives loudly, so keep them honest.** Heredoc bodies are data — a
commit message naming `gh pr merge` is prose, and `gate-lib.sh`'s `strip_heredocs` plus the
`CMD_START` anchor are what stop the gate refusing the commit that documents it. Four false refusals
were found by `gate-test.sh` while these were written; every new rule needs its prose case.
