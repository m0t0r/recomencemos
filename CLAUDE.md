# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A **project template**, not a product. It is a Turborepo/pnpm monorepo (Next.js 16 + React 19) whose purpose is to be cloned as the starting point for new products that run the AI-native SDLC described in <https://claude.com/blog/the-ai-native-sdlc-playbook>.

Two consequences for how you work here:

- Changes are judged by whether they make the _template_ better for a downstream project, not by whether they make the demo app better. Product-specific code does not belong on `main`.
- Anything a new project must rename or replace is a **placeholder** and must stay listed in `README.md` under "Placeholders to change". If you add, rename, or remove one, update that table in the same change.

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

**The test runner is Vitest.** `pnpm test` runs `turbo run test test:gates`, which is four suites:

- `@repo/design-system:test` — `vitest run`, **happy-dom**, React Testing Library. Config in `vitest.config.mts`, cleanup between tests in `vitest.setup.ts`.
- `@repo/errors:test` — `vitest run`, **Node default environment**, no plugin and no setup file. The prior art for a Node package here: a `vitest.config.mts` carrying `resolve.tsconfigPaths`, `globals`, and an `include` glob, and nothing else.
- `@repo/observability:test` — `vitest run`, Node environment, the same minimal config as `@repo/errors`. It is the **stdout seam**: a test that asserts on a _line_ builds a `pino` instance from `createLoggerOptions` over an in-memory `Writable`, and pino's own test utility is deliberately unused because it asserts on `pid`/`hostname` before stripping them, which these options replace. The two modules that emit no line — the report seam and the trace-context reader — are tested against the real SDK with no client initialised, which is a real state the template ships in rather than a mock.
- `//#test:gates` — `gate-test.sh`, the 58 cases that drive the stage hooks. The hooks are the repo's own logic, so they are a test suite and not a script to remember to run.

All three package suites follow the same three rules. Tests sit **beside their source** — `src/**/*.test.{ts,tsx}` in the design system, `src/**/*.test.ts` in a package with no JSX — so `check-types` covers them (the tsconfig `include` is `src`). Every workspace with tests sets `"types": ["vitest/globals"]` in its tsconfig. And:

> **Vitest globals are ON. Never `import { describe, it, expect } from "vitest"` in a test.** Those names are already in scope through `test.globals: true` plus the `vitest/globals` types entry, and a test file that imports them is the mistake to correct on sight — in review, or the moment you notice one while editing. Import from `"vitest"` only for something that genuinely is not a global. This repo shipped the opposite convention once and every new package copied it from the prior art, which is why it is written here as a rule rather than left to be inferred from a config file.

**The DOM environment is happy-dom, not the jsdom Next's docs prescribe.** That is a deliberate deviation from the framework's documented path, so it was measured rather than preferred. Three axes, all favouring happy-dom:

|                           | jsdom 30                               | happy-dom 20          |
| ------------------------- | -------------------------------------- | --------------------- |
| `engines.node`            | `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0` | `>=20.0.0`            |
| transitive packages       | 39                                     | 10                    |
| vitest `environment` cost | ~330 ms per test file                  | ~135 ms per test file |

The engines line is the one that forced the decision: with `engineStrict` on, jsdom raises this repo's floor from any 24.x to 24.15+, and a template should not narrow the runtime its users may run over a test dependency. The environment cost is paid **per test file**, so it scales with the suite rather than being a one-off.

**The correctness axis went the other way from the folklore.** A probe of eighteen DOM APIs found nine differences and every one favoured happy-dom: `matchMedia`, `ResizeObserver`, `IntersectionObserver`, `scrollIntoView`, `dialog.showModal`, `inert`, `checkVisibility`, `elementFromPoint`, and `Range.getClientRects` are all missing or throwing under jsdom and present under happy-dom. Nothing was present under jsdom and missing under happy-dom. That matters concretely here: `next-themes` reads `matchMedia` and Base UI reaches for `ResizeObserver`, so the jsdom route needs a setup file full of mocks before the first component test runs.

Be honest about what that probe shows, though: it tested **presence, not fidelity**. jsdom's stated philosophy is to omit what it cannot implement correctly, so a happy-dom API that exists but never fires would be worse than an absent one you knowingly mocked. `src/components/dialog.test.tsx` is the guard against that — a portal plus a real `user-event` click is where a DOM environment actually breaks, and it is the case downstream hits long before it hits Button. If it ever fails, reconsider the environment rather than the test.

`apps/web` has **no `test` script on purpose.** It is `create-next-app` showcase scaffolding a downstream project deletes, so a suite there would either be vacuously green (`--passWithNoTests` tells `/implement` a lie) or test code destined for deletion. Wire it — copy the design system's config — in the change that first puts real code in the app. Until then `apps/web` verifies through `next build`, `check-types`, and the `next-dev-loop` skill, which is what Next's own docs prescribe: Vitest **cannot test `async` Server Components**, so the runtime leg is not optional there.

## Verifying your work

Before reporting a change complete, run `pnpm lint && pnpm check-types && pnpm test` (add `pnpm build` for anything touching Next.js config, routing, Tailwind sources, or `@repo/design-system` exports). Healthy output is Turborepo's summary with every task `cached` or `successful` and a non-zero `Tasks: N successful`.

`pnpm lint` is stricter than it looks. The root `.oxlintrc.json` puts oxlint's `correctness` category at `error` but `suspicious` and `perf` at `warn`; the `--max-warnings 0` flag in the root `lint` script is the only thing that turns those warnings into a failing exit code. Never relax that flag to make lint pass, and don't silence a rule repo-wide when a scoped `overrides` entry or an `// oxlint-disable-next-line` with a reason would do.

## Architecture

Workspaces are declared in `pnpm-workspace.yaml` (`apps/*`, `packages/*`) and referenced across packages as `workspace:*`. Guidance for `packages/design-system` — including the single Tailwind v4 stylesheet it owns, whose `@source` globs a new app workspace must be added to — lives in `packages/design-system/CLAUDE.md`; `apps/web`'s Cache Components rules live in `apps/web/AGENTS.md`.

**`@repo/errors` has no `dependencies` key, and that absence is the design.** It is isomorphic — importable from a Server Component, a Client Component, a Route Handler, a Server Action, or either instrumentation entry point — and the empty dependency list is what _enforces_ that rather than documenting it: a stray `import pino` there fails to resolve under pnpm's isolated store, where a semantic subpath in a single package would only fail a `.next/static` grep after the fact. Never add a runtime dependency to it. Anything needing one belongs in a server-only package instead — which is what `@repo/observability` is.

**`@repo/observability` is the other half of that split, and it is server-only.** It depends on `pino`, `pino-pretty`, their stream packages, and `@sentry/nextjs` — which is what makes it the home of the report seam and the trace-context reader — so it may not be imported from a Client Component, from `instrumentation-client.ts`, or from anything on a `"use client"` path. What actually keeps it out of the browser is that no client module imports it — the same physical argument the empty dependency list makes for `@repo/errors`. `assertServerOnly()` is the backstop, not the mechanism: it turns a bad import into a loud throw instead of stream machinery shipped to every visitor. A browser module that needs an error type imports `@repo/errors`, which is isomorphic by construction.

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

**The template is its own exception to that rule, and it is the only one.** `context.path` on the
request-completion line carries the concrete request path on every request, so a credential in a URL
**path segment** is logged verbatim by code no caller wrote.
[ADR-0006](docs/adr/0006-name-the-exposure-rather-than-ship-a-heuristic.md) is why nothing ships to
guess at it — no mechanism can tell a reset token from an order id, and any bound also lands on
`/orders/42`. `secrets-in-url-paths` in [`docs/policy/security.md`](docs/policy/security.md) is the
question a project answers, and the go-live runbook's §10 is how it bounds the path when the answer is
yes. Do not read the exception as licence: it exists because the template cannot know the
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

## Things to get right

- **Spanish is the interface; English is the code** ([ADR-0012](docs/adr/0012-spanish-is-the-interface-english-is-the-code.md)). `es-CO` is the product's only language and it governs **only what a person reads**. Every identifier you type is English: route segments, file and directory names, database tables and columns, enum values, query parameters, API field names, log `event` names, test names, branch names. The line is **identifier versus value** — `Skill.labelEs` is an English column holding a Spanish string. So the route is `/offers`, the table is `offer`, the entity is `Offer`, and the page says _Propuesta_. This is written down because effort 0002's spec routed the entire product in Spanish — `/perfiles`, `/publicar`, `app/mi-perfil/page.tsx` — through the API contract and the deep dives before a human caught it. `CONTEXT.md`'s glossary gives every term both names; use the English one everywhere except the rendered string.
- `apps/web/app/layout.tsx` still carries `create-next-app` metadata (`title: "Create Next App"`). That is a placeholder, not an oversight to fix silently — see the README table.
- `apps/web/app/page.tsx` and `apps/web/app/showcase.tsx` are a design-system showcase, not product code. Treat them as scaffolding a downstream project replaces.
- The React version is 19 and Next is 16 (App Router). Server Components are the default; the registry marks the components that need `"use client"` (anything with state, effects, or handlers). New interactive components need the same directive.
- `apps/web/next.config.ts` is TypeScript, and it is listed in `apps/web/tsconfig.json`'s `include`. If you rename it, update that entry too.
- oxfmt runs on the tool's defaults except for `ignorePatterns` (`.agents/`, `.claude/`, `docs/efforts/*/advisories/`, `pnpm-workspace.yaml`) — note `printWidth` is **100**, not Prettier's 80. Run `pnpm format:fix` rather than hand-formatting. It reads `.gitignore`, so ignored files are skipped automatically.
- **oxlint ignores `.agents/` and `.claude/` too.** Vendored skills ship real JavaScript (impeccable alone is ~40 scripts) and it is not ours to fix — hand edits there are clobbered by the installer. Do not narrow those two patterns to make a vendored file lint; app and package code is still fully covered.
- oxlint has no equivalent of `eslint-plugin-turbo`'s `turbo/no-undeclared-env-vars`; undeclared env vars are no longer caught at lint time. `turbo build --dry` still reports the env keys a task hashes.

## AI-native SDLC conventions

The playbook's artifact chain is the intended workflow for projects built from this template: `intent.md` (Plan) → `spec.md` (Design) → tickets + code (Build) → PR review (Deploy) → monitoring findings back through `/triage` (Maintain). Intents and specs are committed under `docs/efforts/<NNNN>-<slug>/`, so git carries the decision record; tickets are sub-issues of the spec's issue, so the plan reports its own state instead of being restated in a document.

Repo-level surfaces that support it — create them as the project needs them, and keep them in git:

- `CLAUDE.md` (this file) — commands, conventions, architecture, recurring mistakes, verification steps. Update it whenever a correction had to be repeated.
- `.claude/skills/<name>/SKILL.md` — **method**: how the work is done. Craft, not policy. A downstream project inherits these rather than rewriting them.
- `docs/policy/*.md` — **policy**: the answers only an organization can give. Every value is set or literally `UNSET`, and a skill needing an `UNSET` value raises a flagged concern naming the file and the key rather than guessing. This is the placeholder; the skills are not.
- `docs/runbooks/*.md` — **procedure**: what a human does to take something live or recover it, as numbers and commands rather than advice. A runbook step that ends in a decision names the `docs/policy/` key rather than making it. [`observability-go-live.md`](docs/runbooks/observability-go-live.md) is the one that ships: it carries the environment-variable phase split, the vendor's free-tier caps **pinned at a date**, the two control-band numbers and their arithmetic, the go-live check that proves `trace_id` correlation end to end, the breach path from webhook to `needs-triage` issue, and what was verified against the installed SDK rather than recalled.
- `.claude/agents/<name>.md` — scoped subagents for recurring work such as verification, research, or simplification.
- `.claude/settings.json` — hooks as deterministic gates (protected paths, formatters, credential scanning, deploy authorization).
- `REVIEW.md` — the PR review passes beyond `code-review`'s two axes, and the severity threshold that blocks a merge. Under stacked PRs it also says what runs per-PR and what runs once at the top of the stack.

**The method/policy split is the load-bearing idea.** Mixing them is what turns a skill into a form nobody fills in: a file that says "the WCAG level is your organization's call" teaches the reader that the whole document is negotiable. Put the craft in the skill and the answer in `docs/policy/`, and each half can be judged on its own terms.

**A runbook is a third thing, and it is what the split produces rather than an exception to it.** Method is how the work is done and is the same everywhere; policy is the answer only an organization gives. A runbook is the _procedure_ that carries a reader from one to the other — ordered steps, real numbers, real commands — and it is neither craft nor an answer. The test that keeps it honest is that **a runbook step ending in a decision names the `docs/policy/` key instead of making it**: that is why `observability-go-live.md` can state the two band numbers as arithmetic while still leaving `alert-destination` `UNSET`. A runbook that quietly answers a policy key has stopped being a runbook and become the form nobody filled in.

`CLAUDE.md`, `AGENTS.md`, `.agents/skills/`, `.claude/agents/`, `.claude/hooks/`, `.claude/settings.json`, `docs/policy/`, `docs/runbooks/`, `DESIGN.md`, and `.mcp.json` all ship with the template. `REVIEW.md` and `.github/workflows/` do not — they are the extension points a new project fills in, along with every `UNSET` value under `docs/policy/`.

The `code-review` skill ships and `REVIEW.md` does not, and that is the method/policy split again: the two-axis review is craft, while which extra passes run, what severity blocks a merge, and which paths are excluded are answers only an organization gives.

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
- `wizard` — generates a bash wizard that walks a human through steps only they can perform.
  `scripts/setup.sh` is its committed product here: the template-adoption steps that are the
  human's. Extend that script through `/wizard`; the library above its `STAGES` marker is the
  template's, never hand-edited.
- `bootstrap` — this repo's own, absent from the lock: the once-per-clone sweep that makes a fresh
  clone yours. It reads the README's placeholder table as its work list, carries the rename
  coupling map, verifies with the full gate plus a dev-server boot, and hands the human rows to
  `scripts/setup.sh`. It stops before the SDLC; `/grill-with-docs` → `/to-intent` is what follows.
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

**The Build gate.** Two hooks, five rules, all covered by `gate-test.sh`:

| Hook                      | Rule                                                                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `build-to-deploy-gate.sh` | **F.** never approve or merge a PR — `gh pr merge`, an approving `gh pr review`, and `gh stack merge`, because a stack merge is a merge |
| `build-to-deploy-gate.sh` | **G.** never push to the default branch. Without it F is theatre                                                                        |
| `build-guard.sh`          | **H.** never hand-edit a vendored skill, a committed advisory, or `pnpm-lock.yaml`                                                      |
| `build-guard.sh`          | **I.** never write a credential into the repo                                                                                           |
| `verify-before-stop.sh`   | a `Stop` hook: the session may not report done while lint, `check-types`, `test`, or `test:gates` is red                                |

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
