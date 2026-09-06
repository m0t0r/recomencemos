# Recomencemos

**Recomencemos introduces two people and then steps out of the way.**

A person in Pereira, Dosquebradas or Santa Rosa de Cabal who lost her income in the 10 August 2026 earthquake publishes what she can do — from a phone, in Spanish, in one sitting, with no document to produce. Someone anywhere in the world sends her an Offer naming the work, the pay and the when. A human reads it before she does. She accepts or rejects, and on acceptance each side receives the other's contact details. That is the terminal event: everything after it happens off the platform.

It handles no money, verifies nobody, and adjudicates nothing — and it says all three on every surface. [`PRODUCT.md`](./PRODUCT.md) is why; [`CONTEXT.md`](./CONTEXT.md) is the vocabulary, in both languages; [`docs/efforts/0002-profile-to-contact-exchange/spec.md`](./docs/efforts/0002-profile-to-contact-exchange/spec.md) is the approved design and the authority on what gets built.

It is built with an **AI-native SDLC** — the working model described in [The AI-native SDLC playbook](https://claude.com/blog/the-ai-native-sdlc-playbook), where an agent participates at every stage and humans hold the judgment calls. This README carries the toolchain, the conventions, and how that loop actually runs here.

**Spanish is the interface; English is the code.** `es-CO` governs only what a person reads. Every identifier — route segments, file names, tables, columns, enum values, log `event` names, test names — is English ([ADR-0012](./docs/adr/0012-spanish-is-the-interface-english-is-the-code.md)). So the route is `/offers`, the table is `offer`, and the page says _Propuesta_.

## What's inside

A [Turborepo](https://turborepo.dev) monorepo on pnpm, TypeScript throughout:

| Workspace                    | Package name              | Purpose                                                                                                                                                                                        |
| ---------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`                   | `web`                     | Next.js 16 App Router app (React 19) — the product surface, and the only one                                                                                                                   |
| `packages/design-system`     | `@repo/design-system`     | shadcn/ui on Base UI + Tailwind v4, consumed as source (no build step)                                                                                                                         |
| `packages/domain`            | `@repo/domain`            | The only door to the database — schema, both connections, and the per-aggregate models ([ADR-0010](./docs/adr/0010-the-domain-package-is-the-only-door-to-the-database.md))                    |
| `packages/errors`            | `@repo/errors`            | The owned error shape and the shared redaction list — isomorphic, **zero runtime dependencies**, consumed as source                                                                            |
| `packages/notifications`     | `@repo/notifications`     | The only door out to a person — the seam, its transports and the React Email templates. **Server-only**, and it carries the kill switch ([its own README](./packages/notifications/README.md)) |
| `packages/observability`     | `@repo/observability`     | The pino logger, the single report site, and the trace-context reader — **server-only**, the other half of the split                                                                           |
| `packages/typescript-config` | `@repo/typescript-config` | Shared tsconfigs: `base`, `nextjs`, `react-library`                                                                                                                                            |

Requires the **active Node LTS** (24.x — see `.nvmrc`) and **pnpm 11** (pinned via `packageManager`). The Node requirement is enforced, not suggested: `engineStrict` in `pnpm-workspace.yaml` makes `pnpm install` fail outright on an older runtime. Run `fnm use` or `nvm use` first.

**`pnpm dev` also needs Docker** (Engine 20.10+, Compose v2.20+) — `docker-compose.yaml` is the local development database, Postgres 18 behind PgBouncer in transaction-pooling mode. Nothing else needs it: `pnpm test` runs against PGlite in-memory and CI starts no database, so the whole gate is green on a machine without Docker. See `docs/policy/data.md` → `local-database`.

```sh
pnpm install
pnpm dev          # web on https://web.recomencemos.localhost — see below
pnpm build
pnpm check-types
pnpm test         # vitest + the stage-hook suite
pnpm lint         # oxlint, whole repo
pnpm format       # oxfmt --check
pnpm lint:fix     # oxlint --fix
pnpm format:fix   # oxfmt, writes changes
```

**`pnpm dev` serves by name, not by port** ([ADR-0018](./docs/adr/0018-a-dev-server-is-reached-by-name-not-by-port.md)). `apps/web`'s `dev` script runs [portless](https://github.com/vercel-labs/portless), which picks an ephemeral port and fronts it with an HTTPS proxy, so the main checkout answers at `https://web.recomencemos.localhost` and each git worktree gets the branch prepended — `https://124-add-widget.web.recomencemos.localhost`. Parallel sessions stop colliding on 3000, and local development finally runs on `https`, which is what the `Secure` cookie flag depends on. Read the URL off the banner `portless` prints; `PORTLESS=0 pnpm dev` is the way back to `:3000`, and it is what the Google sign-in door needs.

It takes **one setup step per machine**, and it is a human's because binding 443 needs privilege: [`docs/runbooks/portless-setup.md`](./docs/runbooks/portless-setup.md).

The development database is separate, because it is the one thing here that needs Docker:

```sh
cp apps/web/.env.example apps/web/.env.local   # once
pnpm db:up        # postgres on :5432, pgbouncer on :6432, waits for both to be healthy
pnpm db:down      # stop; the data volume survives
pnpm db:reset     # stop and discard the volume
pnpm db:migrate   # apply the committed migrations on the direct connection
pnpm db:generate  # write a new migration from `packages/domain/src/schema.ts`
```

The app connects through **6432** and migrations through **5432**, and that split is the point: PgBouncer runs in transaction-pooling mode, the mode PlanetScale's pooler runs in, so session advisory locks, `LISTEN`/`NOTIFY`, temp tables and cross-transaction prepared statements fail here exactly as they would in production.

### Design system

`packages/design-system` is [shadcn/ui](https://ui.shadcn.com) on [Base UI](https://base-ui.com) primitives. Components ship as raw TSX — `import { Button } from "@repo/design-system/components/button"` — and every token lives in `packages/design-system/src/styles/globals.css`, which `apps/web/app/layout.tsx` imports.

**The components and the colours have different origins, and that matters when you regenerate.** The components came from preset [`b1Z6BvKBU`](https://ui.shadcn.com/create?preset=b1Z6BvKBU) (`vega` style, `lucide` icons, Inter, pointer cursor on buttons). The **colours and the typefaces did not** — they were chosen for this product with [#178](https://github.com/m0t0r/recomencemos/issues/178), and [`DESIGN.md`](./DESIGN.md) → The world is why. So `pnpm dlx shadcn@latest apply <preset>` would overwrite the palette; change the ramp instead.

#### The token layers

**A private ramp, a semantic seam.** Eleven `--brand-*` shades at **hue 268 — ballpoint ink** — carry the whole palette, and nothing outside `globals.css` may reference them — only the semantic names below reach Tailwind through `@theme inline`, so no component can reach past the seam into a raw shade. **Swapping the brand hue is one edit** to the eleven ramp lines.

```css
--brand-50   oklch(0.975 0.012 262)      --brand-500  oklch(0.62  0.16  268)
--brand-100  oklch(0.94  0.04  262)      --brand-600  oklch(0.54  0.17  268)   → --chart-1
--brand-200  oklch(0.88  0.08  264)      --brand-700  oklch(0.46  0.16  268)   → --primary, --ring, --ink
--brand-300  oklch(0.79  0.12  266)      --brand-800  oklch(0.38  0.14  268)
--brand-400  oklch(0.68  0.15  268)      --brand-900  oklch(0.28  0.1   268)
                                          --brand-950  oklch(0.22  0.07  268)
```

**Contrast is a property of the lightness ramp, not the hue, and it is asserted rather than remembered.** `apps/web/design-tokens.test.ts` resolves every text pair in `globals.css` and fails under WCAG 2.2 AA's 4.5:1, every non-text pair under SC 1.4.11's 3:1. `--primary` is shade **700** and carries white at 7.4:1.

| Layer           | Tokens                                                                                | Notes                                                                                                                                                                                                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ground and ink  | `background` `foreground` `card` `card-foreground` `popover` `popover-foreground`     | Paper and ink. The page is `oklch(0.99 0.004 250)` — not pure white — and the ink is `oklch(0.23 0.035 268)`, the brand hue at near-black rather than neutral grey                                                                                                                                                 |
| Brand roles     | `primary` `primary-foreground` `secondary` `accent` `muted` `muted-foreground` `ring` | `primary` and `ring` are both `--brand-700`                                                                                                                                                                                                                                                                        |
| Edges           | `border` `input`                                                                      | **Two jobs, never collapse them.** `border` is the ruling — a divider identifies nothing, so it is faint (`L 0.895`). An input's boundary is the only thing identifying the control, so `input` is `L 0.6` — WCAG 2.2 SC 1.4.11 wants 3:1 against the page. `margin` is the rose line beside a list, never a state |
| Ink             | `ink` `ink-foreground` `ink-muted`                                                    | A solid field of ink owning a whole region. The landing's first viewport, and nothing smaller — one per product                                                                                                                                                                                                    |
| Semantic triads | `success` `warning` `destructive`, each with `-surface` and `-border`                 | Every state ships a foreground, a surface and a border, so nothing invents one inline                                                                                                                                                                                                                              |
| Chart series    | `chart-1`…`chart-5`                                                                   | Fixed order, assigned in sequence, never cycled                                                                                                                                                                                                                                                                    |
| Sidebar         | `sidebar` + 7 more                                                                    | One step off the page, same hue; three stop being aliases, the rest stay aliases deliberately                                                                                                                                                                                                                      |
| Radius          | `--radius: 0.5rem`                                                                    | `sm`…`4xl` are `calc()` multiples of it (`×0.6` to `×2.6`), so one edit rescales all seven                                                                                                                                                                                                                         |

**Two usage rules ride with the triads**, and they are why the tokens exist rather than decoration: `destructive` is only ever a **limit of the platform**, never anything a person did; `warning` is never a state the person is merely **waiting on**. Colour never carries meaning alone (WCAG 1.4.1) — every state ships with text.

**The chart palette is ordered for colour vision, and its distances are owed a re-measurement.** Slot 1 is `--brand-600` for cohesion with `--primary` while sitting one step off it, so a data mark never reads as a button. The other four are ≥45° apart in hue from each other and the brand, and ≥25° clear of every semantic hue so a series can never impersonate a state. The ΔE figures under simulated protanopia/deuteranopia were derived for the previous hue and have **not** been re-measured since the ramp moved; no chart ships today, and the first surface that draws one re-derives the four non-brand slots first. **On the all-pairs list — scatter, bubble, map, small multiples — five slots cannot pass and no ordering fixes it.** Those forms carry **two** series from this palette; more means facets, or folding the tail into "Other".

#### There is no dark mode

The paper is the product's one ground ([`DESIGN.md`](./DESIGN.md) → The world), so `next-themes`, the theme provider and the toggle are gone and there is no `.dark` block.

`globals.css` still declares `@custom-variant dark (&:is(.dark *));` and **that line is load-bearing** — deleting it does not remove dark styling. Registry components ship `dark:` utility classes, and Tailwind's _built-in_ `dark` variant is `@media (prefers-color-scheme: dark)`, so removing the line hands those overrides to the visitor's OS and applies them against a palette with no dark values. Binding the variant to a class nothing sets keeps them inert. Use semantic tokens rather than `dark:` overrides; add the mode deliberately or not at all.

#### Measured contrast

Taken from the **rendered** page, not from the source values — computed in a real browser against the resolved colours, so the alias chain (`--primary` → `--brand-700`) is included:

| Pair                                | Ratio                            | Floor                               |
| ----------------------------------- | -------------------------------- | ----------------------------------- |
| `foreground` on `background`        | 18.04                            | 4.5                                 |
| `destructive` on `background`       | 7.95                             | 4.5                                 |
| `warning` on `background`           | 7.60                             | 4.5                                 |
| `success` on `background`           | 7.09                             | 4.5                                 |
| `primary-foreground` on `primary`   | **6.51**                         | 4.5                                 |
| `muted-foreground` on `background`  | 5.04                             | 4.5                                 |
| `chart-1`…`chart-5` on `background` | 4.95 / 3.56 / 3.20 / 7.00 / 3.12 | 3.0 (SC 1.4.11)                     |
| `input` on `background`             | 3.21                             | 3.0 (SC 1.4.11)                     |
| `border` on `background`            | 1.29                             | none — a divider identifies nothing |

The 6.51 confirms the ramp comment's claim that shade 700 carries white at ~6.5:1 where 600 would give ~4.9:1.

> **There is no script to re-prove this.** The source repo audits its ramp with `scripts/check-contrast.mjs`, which was **not** copied here — the table above was measured once, by hand, at adoption. Port that script before changing any `L` value, or these numbers silently go stale.

Add components with the CLI rather than by hand, pointing it at the package:

```sh
pnpm dlx shadcn@latest add <component> -c packages/design-system
```

Linting and formatting are [Oxc](https://oxc.rs) tools — `oxlint` and `oxfmt` — wired as Turborepo [root tasks](https://turborepo.dev/docs/guides/tools/oxc), so one pass covers every workspace. `pnpm exec turbo run quality` runs both checks together, `quality:fix` fixes both. Per-workspace rules live in nested `.oxlintrc.json` files that extend the root one; `oxfmt` runs on defaults (note `printWidth` is 100).

Scope any task to one workspace with a filter:

```sh
pnpm exec turbo dev --filter=web
```

### Next.js: Cache Components

`apps/web/next.config.ts` sets `cacheComponents: true`. Data is dynamic by default and you opt into caching with the [`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache) directive. The same flag makes [Partial Prerendering](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents) the App Router default — a static shell is prerendered and dynamic content streams in — so there is no separate `experimental.ppr` to enable; it was removed in Next 16.

Reading uncached data outside a `<Suspense>` boundary is a build error by design. The error prints the three ways to fix it (`[stream]`, `[cache]`, `[block]`) with the trade-off of each.

### The error page, and the reference a user quotes

Both error boundaries — `apps/web/app/error.tsx` inside the app shell, `apps/web/app/global-error.tsx` when the root layout itself failed — show the user one line they can quote to support:

```
Reference: 3846760449
```

**What that string is depends on where the error was thrown**, and the difference matters to whoever answers the support ticket:

| The reference looks like  | It is                             | Because                                                                                                                   |
| ------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| a short number            | the framework's `digest`          | The error was thrown on the **server**. It was reported there, once, and the browser deliberately did not report it again |
| a 32-character hex string | the reporting platform's event id | The error was thrown in the **browser**, so the browser is what reported it, and the id is the one it was given           |

**A digest identifies an error class, not an occurrence.** It is a hash of the error, so two users hitting the same bug quote the **same** string, and one user hitting it twice quotes it twice — it answers "what broke", never "when, for whom". To get from a quoted digest to a single occurrence, pivot: digest → the issue in the reporting platform → a `trace_id` on one of its events → that request's lines in the log drain. Every reported server error puts `event_id` and `trace_id` on its log line precisely so that pivot works from either end.

Nothing else about the failure reaches the page. Neither boundary renders a message, a stack, or a route — an error crossing to the browser from the server has already been replaced with a generic one by the framework, and the operator detail stays in the log line.

### Set up for coding agents

Configured per [Next.js: set up your project for AI coding agents](https://nextjs.org/docs/app/guides/ai-agents):

| File                                   | Role                                                                                                                                                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AGENTS.md`                            | Repo-root pointer at `CLAUDE.md`, for agents that read `AGENTS.md`                                                                                                                                                                          |
| `apps/web/AGENTS.md`                   | Managed block written and re-added by `next dev`; points agents at the version-matched docs bundled in `node_modules/next/dist/docs/`. Commit it — deleting it only recreates the diff. Your own notes go outside the `BEGIN`/`END` markers |
| `apps/web/CLAUDE.md`                   | `@AGENTS.md`                                                                                                                                                                                                                                |
| `.mcp.json`                            | [`next-devtools-mcp`](https://nextjs.org/docs/app/guides/mcp) — live errors, logs, routes, and per-route compilation from the running dev server                                                                                            |
| `.agents/skills/` + `skills-lock.json` | Vendored skills, symlinked into `.claude/skills/`. Add more with `npx skills add <owner>/<repo> --skill <name>`                                                                                                                             |

Bundled tool skills: [`next-dev-loop`](https://www.skills.sh/vercel/next.js/next-dev-loop) (verify a change against a running dev server), [`next-partial-prefetching-adoption`](https://www.skills.sh/vercel/next.js/next-partial-prefetching-adoption) (move the app onto a shared App Shell), [`turborepo`](https://www.skills.sh/vercel/turborepo), and [`shadcn`](https://www.skills.sh/shadcn/ui). The Plan-stage workflow skills are covered under [The Plan stage](#the-plan-stage).

Two more Next.js skills are worth adding once a project has real routes — [`next-cache-components-adoption`](https://www.skills.sh/vercel/next.js/next-cache-components-adoption) (unnecessary here: the flag is already on) and [`next-cache-components-optimizer`](https://www.skills.sh/vercel/next.js/next-cache-components-optimizer) (needs a test runner in `apps/web`, which is wired in the change that first puts real code there).

`logging.browserToTerminal` is enabled, so browser console errors surface in `next dev` stdout where an agent can read them.

The runner is **Vitest**, wired in `packages/design-system` (happy-dom + React Testing Library), `packages/errors`, and `packages/observability` (both Node environment, no plugins). Tests sit beside their source as `src/**/*.test.{ts,tsx}`, and **Vitest globals are on** — a test never imports `describe`/`it`/`expect` from `"vitest"`. The DOM environment is happy-dom rather than the jsdom Next's docs prescribe — a deviation that was measured, not preferred: jsdom 30 would raise the repo's Node floor from any 24.x to 24.15+, pulls 39 transitive packages against happy-dom's 10, costs ~330 ms of per-test-file environment setup against ~135 ms, and is missing nine of the DOM APIs a component library reaches for (`matchMedia`, `ResizeObserver`, `scrollIntoView`, `inert`, `elementFromPoint` among them) where happy-dom has them. `dialog.test.tsx` renders a Base UI portal through a real click to keep the swap honest. `pnpm test` runs it alongside `//#test:gates`, the suite that drives the stage hooks — so the repo's own logic is covered by the same command as its code.

> **`apps/web` has no `test` script yet.** A suite arrives with the change that first puts real product code in the app — copy the design system's `vitest.config.mts` then. Wiring one earlier would be vacuously green, and `--passWithNoTests` tells `/implement` a lie. Note Vitest cannot test `async` Server Components — Next's docs point at E2E for those, which is what [`next-dev-loop`](https://www.skills.sh/vercel/next.js/next-dev-loop) covers here.

## Still to replace

**This was a "Placeholders to change" table, read by `/bootstrap` as a fresh clone's work list. Both are gone.** Every row this product has in fact answered is gone from the list. Most were answered by being changed — the project name, the development database credentials, the tracker, the app README, the page metadata, the showcase page, `PRODUCT.md`, this README. Two were answered by a **decision to keep**, which is a real answer and not a skipped row: the app is still `web` and the scope is still `@repo`. The third — the port — was answered by being **removed**: [ADR-0018](./docs/adr/0018-a-dev-server-is-reached-by-name-not-by-port.md) serves each worktree at its own hostname, so there is no port left to change. What is left is **this product's own open work**, and each row says who owns it. A row is deleted when it is done, not when it is inconvenient.

| Still open                                                             | Where                                                                                                                                             | What it needs, and who owns it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page weight on every route, **measured** and over NFR3's budget        | The framework baseline underneath every route, `packages/design-system`'s popup machinery, and the form layer on `/publish` and `/sign-in`        | Re-measured after [#157](https://github.com/m0t0r/recomencemos/issues/157) with `pnpm page-weight`, which is the method rather than a recollection of it — gzip on the wire, every `<script>` the prerendered document requests, the `noModule` bundle no browser fetches excluded: `/` **208 KB**, `/profiles` **209 KB**, `/privacy` **206 KB**, `/sign-in` **298 KB**, `/publish` **309 KB**. #157 took **84 KB** off every route by moving the Sentry SDK behind a dynamic import and the `<Toaster />` out of the root layout, and it is the end of what those two levers have: a build with Sentry deleted outright measures 207 KB on `/`, one kilobyte below where it now sits. **NFR3's amended budget — `/` ≤ 140 KB, `/publish` ≤ 250 KB — is therefore not reachable and was never reachable**, because the attribution it was set from credited Sentry with 148 KB of `/`'s 292 KB when its true marginal cost was 85 KB; the rest of that chunk is code the page needs anyway. What is actually left on `/` is React and react-dom at **72 KB**, Base UI's popup stack at **63 KB** and the Next runtime at **73 KB**. Owner: the human, as a spec amendment — the budget is the thing that has to move, or Base UI and the form layer are the next levers, and neither is #157's |
| Favicon                                                                | `apps/web/app/favicon.ico`                                                                                                                        | Still Next.js's. Recomencemos has a name and no mark yet — [`PRODUCT.md`](./PRODUCT.md) → Brand Commitments says so. Design work, not a ticket                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| The icon set                                                           | `components.json`                                                                                                                                 | `lucide` came with the preset. The palette is no longer open: the `--brand-*` ramp at hue 268 was chosen for this product with [#178](https://github.com/m0t0r/recomencemos/issues/178) and [`DESIGN.md`](./DESIGN.md) records why, and every semantic pair's contrast is asserted by `apps/web/design-tokens.test.ts` rather than by a script to remember to run. The ramp is **not** shadcn-preset output, so `shadcn apply` would overwrite it — edit the ramp instead                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `service` base field (`"web"`)                                         | `packages/observability/src/logger-options.ts` — the `SERVICE_NAME` constant                                                                      | Every log line carries it and a drain filters on it, so it should name the service rather than the workspace. It is a constant rather than an environment variable on purpose: Turborepo's strict mode filters an undeclared variable out of a task's environment entirely, so adding one means declaring it in `turbo.json` too. Changing it is a deploy-time decision — [#9](https://github.com/m0t0r/recomencemos/issues/9)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Redaction key names (`authorization`, `cookie`, `token`, `api_key`, …) | `packages/errors/src/redaction.ts` — the module-internal list                                                                                     | The shipped list is **advisory**: a floor that proves the mechanism works, never a claim that these names are sufficient for this product's data. It is deliberately not exported, so extend the list in place. Each effort that adds a sentinel field adds its name here                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `NEXT_PUBLIC_SENTRY_DSN` (unset)                                       | The environment; `apps/web/instrumentation-client.ts` and `instrumentation.ts` both read it, `turbo.json` declares it on `build`                  | The Sentry project's DSN. Left unset the SDK is never initialised at all — not merely disabled — on **both** sides: `register()` checks it before importing `sentry.server.config.ts`, so the repo runs, builds and tests with no monitoring account. It is public by construction: anything holding it can post into the quota, so the runbook's spike protection and inbound filters are the mitigation, not secrecy. [#36](https://github.com/m0t0r/recomencemos/issues/36)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `SENTRY_ORG` / `SENTRY_PROJECT` (unset)                                | The environment; `turbo.json` declares both on `build`                                                                                            | Source-map upload is attempted only when these **and** `SENTRY_AUTH_TOKEN` are all present. **The token never goes in a `.env` file** — `turbo.json` declares `.env*` a `build` input, so its content is hashed into the cache key however the variable is declared, and under remote caching it would travel with the artifact. It is passed through to `web#build` alone. [#36](https://github.com/m0t0r/recomencemos/issues/36)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `NEXT_PUBLIC_RELEASE` (unset)                                          | The environment; the `release` base field on every log line, the release on every Sentry event, and the name uploaded source maps are filed under | A commit SHA, set by whatever builds the app. **It is published to every browser, so nothing else belongs in it.** Left unset, the build plugin detects the `HEAD` SHA itself and log lines read `release: "unknown"`. [#9](https://github.com/m0t0r/recomencemos/issues/9)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `NOTIFICATIONS_TRANSPORT` (`terminal`)                                 | `apps/web/.env.example`; the environment                                                                                                          | `terminal` in development, `resend` wherever mail must actually leave. The terminal transport is the **development inbox**: it prints each notification — the magic link first, on a line of its own — to the terminal running `pnpm dev`, so a sign-in loop needs no mailbox, no `RESEND_API_KEY` and no verified domain. It refuses to construct outside `NODE_ENV` `development`/`test`, so it cannot reach a deploy and swallow real mail. **No default and an unset value throws**, because neither answer is safe in both places                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `NOTIFICATIONS_KILL_SWITCH` (`off`)                                    | `apps/web/.env.example`; the environment                                                                                                          | The switch that stops **all** sending without a deploy. Its polarity is deliberate: empty, `off`, `false`, `0` and `no` disengage it and _everything else engages it_, a typo included, because the failure worth designing against is a switch someone believes is on and isn't. It ships `off` because `NOTIFICATIONS_TRANSPORT=terminal` already makes development safe — engage it if you point a development machine at `resend`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `NOTIFICATIONS_FROM` (`hola@mail.recomencemos.online`)                 | `apps/web/.env.example`; read by `@repo/notifications/send`                                                                                       | **This one is no longer a placeholder.** `mail.recomencemos.online` is verified in Resend and its SPF, DKIM and DMARC records resolve, so the committed example is the real sending identity — neither half is a secret, and runbook §4 wants every developer send counting toward the warm-up curve. It has no default: `senderIdentity()` throws rather than invent one, and it is still **never `noreply@`**. **There is no `NOTIFICATIONS_REPLY_TO` any more**: the subdomain is send-only, so it publishes no MX and nothing receives — DD14's monitored reply-to is amended away in the spec, and returns the day a mailbox exists. The credential itself, `RESEND_API_KEY`, is absent from every `.env` file in git — `turbo.json` declares `.env*` a `build` input. Runbook §4                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Error-boundary copy (heading, body, button label, reference line)      | `apps/web/app/error.tsx`, `apps/web/app/global-error.tsx`                                                                                         | **The strings are still English.** They were settled at Design before [`docs/policy/voice.md`](./docs/policy/voice.md) existed, and are deliberately plain — "Something went wrong", a retry, and a reference identifier. Rewrite them in `es-CO` under the voice guide; keep the shape, since the reference line is what support asks for                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Root-boundary palette (six hex values, twice)                          | `apps/web/app/global-error.tsx` — the `styles` string                                                                                             | They are literal hex rather than design-system tokens because this boundary **replaces the root layout**: no stylesheet is mounted, so it cannot reach the token layer. They follow the palette through `apps/web/design-tokens.test.ts`, so the row is open only for the strings beside them (the row above)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Worked example Route Handler                                           | `apps/web/app/api/example-error/route.ts`                                                                                                         | Scaffolding: one handler, two branches, showing the handled-and-returned path and the rethrown one, so a reader learns **thrown is reported, returned is logged** from running code rather than from a test file. `docs/runbooks/observability-go-live.md` §7 already carries "deleted before public traffic" as a checkbox, so [#36](https://github.com/m0t0r/recomencemos/issues/36) owns the deletion                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Pinned vendor figures in the go-live runbook                           | `docs/runbooks/observability-go-live.md` — the "Date figures checked" row, §3's free-tier table, §5's two band numbers, and §8's CSP host         | Re-derived against the actual plan before go-live, and the date re-stamped. The free-tier caps are **pinned at a date** (2026-08-23, Sentry Developer) precisely so a stale figure is visible as stale rather than trusted; the two bands are arithmetic on the error allowance; the CSP host is read off the DSN's origin. [#36](https://github.com/m0t0r/recomencemos/issues/36)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Every remaining `UNSET` value                                          | `docs/policy/*.md`                                                                                                                                | `grep -rn UNSET docs/policy/` is the whole list, and it is short — most keys were answered by effort 0002's design interview. An unset key surfaces as a flagged concern on every spec that needs it rather than being guessed. `analytics-consent` is the one that gates a whole capability: under Ley 1581 that consent precedes instrumentation, so nothing is instrumented until it is answered                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

Repo-level things set up outside the code: the local dev proxy, once per machine and by a human because it binds 443 ([`docs/runbooks/portless-setup.md`](./docs/runbooks/portless-setup.md) — until it is installed, `pnpm dev` reports no running proxy), a remote cache (`pnpm exec turbo login && pnpm exec turbo link`), and branch protection so an agent cannot approve its own code — requiring every status check `.github/workflows/ci.yml` publishes — one job per entry in `docs/policy/build.md` → `required-checks`.

## How this project runs the AI-native SDLC

The playbook chains a versioned artifact through each stage; the next stage reads the previous one, and git becomes the decision record. Effort 0002 — [`docs/efforts/0002-profile-to-contact-exchange/`](./docs/efforts/0002-profile-to-contact-exchange/) — is the worked example of every row below, and effort 0001 before it is what put the logger and the error shape in.

| Stage    | Artifact               | Lives in                                            | What happens                                                                                                                                                                                                                                                                                                                |
| -------- | ---------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan     | `intent.md`            | `docs/efforts/<NNNN>-<slug>/` + a GitHub issue stub | Problem, proposed outcome, affected users/systems, constraints, open questions                                                                                                                                                                                                                                              |
| Design   | `spec.md`              | the same folder + a GitHub issue stub               | The architect drafts, four advisors consult in isolation, the architect synthesizes. Flagged concerns resolved with their owners before engineering picks it up                                                                                                                                                             |
| Build    | Tickets + code         | sub-issues of the spec's issue; code in git         | `/to-tickets` cuts one tracer-bullet slice per user story, with blocking edges, each sized to one session. Every NFR that named that story rides along as an acceptance criterion. Then `/implement` works one ticket per session: claim, plan onto the ticket, `/tdd` at the spec's seams, verify with evidence, open a PR |
| Test     | Evals in CI            | `.github/workflows/`                                | A suite of real tasks with acceptance checks, re-run whenever `CLAUDE.md`, skills, or hooks change; every incident becomes a permanent eval                                                                                                                                                                                 |
| Deploy   | PR + review findings   | the GitHub PR                                       | `/code-review` runs two axes in parallel — Standards and Spec. `REVIEW.md`, where this project would add its own passes and its merge-blocking severity, is still unwritten. The agent may open a PR and may not approve or merge one; a hook enforces it                                                                   |
| Maintain | A `needs-triage` issue | GitHub Issues                                       | Deterministic monitoring escalates by tier — log, diagnose read-only, propose a fix. `/triage` promotes what deserves it back into Plan                                                                                                                                                                                     |

Per the playbook, each artifact names **one** system as its source of truth and everything else links to it. Here that split is: intents and specs are files in git, tickets are GitHub issues, and every published artifact gets an issue holding a summary and a permalink. `docs/agents/issue-tracker.md` is the rule every skill reads.

**The plan is a query, not a document.** The playbook's Build artifact is a `plan.md`; here that role is played by the spec's issue with its tickets as sub-issues, because a prose plan goes stale the moment a ticket is split and nothing forces it back in line. GitHub computes progress and blocked-by from the edges themselves, so `gh issue view <spec-issue>` is always the current plan. An `/implement` session opens by querying the frontier — the open, unblocked, unassigned tickets — and claims one by assigning it. The session holds no position, the tracker does, which is what makes `/clear` between tickets safe and lets one plan outlive any number of sessions. See "Build operations" in `docs/agents/issue-tracker.md`.

### The Plan stage

Plan, Design, and Build are wired up here and effort 0002 has run all three: an approved `intent.md`, an approved `spec.md`, and 23 tickets hanging off the spec's issue. Deploy has CI ([#5](https://github.com/m0t0r/recomencemos/issues/5)) and is waiting on `REVIEW.md`; Test and Maintain are not wired — `diagnosing-bugs` and `/triage` are vendored and ready, and the eval suite is not written.

**What's installed.** Eighteen skills from [mattpocock/skills](https://github.com/mattpocock/skills), vendored into `.agents/skills/` like every other skill here, plus `to-intent`, which is ours, and `to-spec`, which started as Matt's and was rewritten far enough to become a **fork** — it leaves `skills-lock.json` so `npx skills update` cannot clobber it, and [`docs/agents/forked-skills.md`](./docs/agents/forked-skills.md) records what it forked from and at which hash. Only some are model-invocable; the rest carry `disable-model-invocation: true`, so a human types them and the agent cannot reach them on its own. That split is deliberate: user-invoked skills orchestrate, model-invoked skills hold reusable discipline.

**The loop.** Three on-ramps into Plan, plus one shortcut past it:

```
NEW IDEA, one session's worth
  /grill-with-docs  ─┐   (+ /research in the background, /prototype when a
                     │    question needs a runnable answer)
BIG FOGGY EFFORT     │
  /wayfinder  ───────┼──▶  /to-intent  ──▶  intent.md  ──▶  /to-spec  ──▶  spec.md
   a map of decision │                          │
   tickets, one per  │                    human approves             /to-tickets
   session           │                     (the Plan gate)                │
INBOUND WORK         │                                                    ▼
  /triage  ──────────┘                                            /implement per ticket
      └──────────── ready-for-agent: small and clear ───────────────────▲
```

**Triage has two exits, and that is deliberate.** Something small and clear leaves as a
`ready-for-agent` issue that `/implement` picks up directly — no intent, no spec, no effort folder,
because a three-artifact chain buys nothing for a one-line fix. Something large or ambiguous goes
through `/to-intent` and gets promoted to a numbered effort. A human picks the exit at triage, so a
folder under `docs/efforts/` means someone decided this is work. See
[ADR-0001](./docs/adr/0001-findings-enter-through-triage.md) for why findings enter as issues rather
than as intents the way the playbook describes.

| Command            | Use it when                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| `/grill-with-docs` | An idea you can hold in one session. Interviews you in rounds, and writes `CONTEXT.md` + ADRs             |
| `/wayfinder`       | An effort too big for one session. Charts a map of decision tickets and works them one by one             |
| `/triage`          | Work that arrived rather than started — bug reports, monitoring findings. Closes the Maintain → Plan loop |
| `/to-intent`       | The thinking is done. Synthesizes the conversation into `intent.md` and publishes it                      |
| `/to-spec`         | The intent is `approved`. Runs the three-phase Design stage and publishes `spec.md`                       |
| `/spec-review`     | The spec is written. Checks it against the advisories it was built from                                   |

`/research` and `/prototype` are model-invoked, so the agent reaches for them when a question needs a fact or a runnable answer. Name either one to force it.

**The Plan gate.** An intent stays `status: draft` while any open question is unchecked, and every open question has to name what it blocks — that is what makes the list something a human can approve against. Moving it to `approved` is the human's call.

A `PreToolUse` hook enforces it — [`.claude/hooks/plan-to-design-gate.sh`](./.claude/hooks/plan-to-design-gate.sh), wired in [`.claude/settings.json`](./.claude/settings.json). Two rules:

| Rule                   | Refuses                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| **Approval integrity** | any agent write setting `status: approved` in an `intent.md`                                        |
| **The gate**           | writing a `spec.md` whose sibling intent is missing, still `draft`, or has unchecked open questions |

The first rule is the one that matters. Without it the second is theatre: an agent that wants to finish flips the intent to `approved` and walks straight through. Approval has to be an act the agent cannot perform.

It gates `spec.md` and **never a PR**, so the playbook's 3σ route — "Claude may act, though only by opening a PR into the review gate or triggering a pre-approved runbook" — stays open.

The hook watches `Write` and `Edit`, and pattern-matches `Bash` for shell redirects at those paths, which is a heuristic rather than a seal.

**That heuristic used to fight the publish protocol.** `docs/agents/issue-tracker.md` puts a `Source of truth:` line naming the artifact inside an issue body, and the original pattern matched a `>` followed by the path _anywhere later on the line_ — so a markdown blockquote or an `intent -> spec.md` arrow in a `gh issue create` body read as a write, and the very protocol the gate exists to protect was refused. Two narrowings fixed it: heredoc bodies are stripped before matching, because a body is prose however often it says `intent.md`; and a redirect's target must be the token **immediately** after the operator, with a preceding `-` excluding the arrow. Nine protocol shapes are now regression cases in `gate-test.sh`. One ambiguity is left on purpose: a blockquote of the bare form `> docs/efforts/…/intent.md` is still refused, because that is also exactly what a shell redirect looks like. It also binds only agents on a machine that has this repo's settings loaded. Neither stops _you_: editing `intent.md` in your own editor is exactly how approval is meant to happen.

Both gates share [`gate-lib.sh`](./.claude/hooks/gate-lib.sh) and are covered by [`gate-test.sh`](./.claude/hooks/gate-test.sh), the runner over one test file per gate under [`.claude/hooks/tests/`](./.claude/hooks/tests/), run by `pnpm test` as the `//#test:gates` task:

```sh
pnpm test:gates            # every gate — one line per section
pnpm test:gates hooks      # one file, by its name under tests/
pnpm test:gates -- -v      # every case enumerated, for reading what is covered
pnpm test                  # the hooks plus the design system's suite
```

It is **quiet on success**, like the runners beside it: a clean rule collapses to one line carrying
its count, and only failures print in full — with their section header, so a red case still reads in
context. The full enumeration was the default once, and 58 ok-lines scrolled the rest of `pnpm test`
off the screen; Turborepo replays a cache hit's stdout verbatim, so that volume was paid on every run
rather than only on a real one.

**How that was wired, and what re-running it costs.** The skills are vendored under `.agents/skills/`; the per-repo configuration around them is not, so it is recorded here rather than remembered.

```sh
npx skills update      # or `npx skills add mattpocock/skills`
# `gh label create` takes one name per call, so loop
for l in needs-triage needs-info ready-for-agent ready-for-human wontfix \
         wayfinder:map wayfinder:research wayfinder:prototype wayfinder:grilling wayfinder:task; do
  gh label create "$l" --force
done
```

`bug` and `enhancement` — the two triage _category_ roles — ship as GitHub defaults, so they need no creating. Then run `/setup-matt-pocock-skills` once. It rewrites `docs/agents/issue-tracker.md` from its own seed template, so **re-apply the "publish to the issue tracker" section afterward** or intents and specs go back to being issue bodies. Take single-context on the domain-docs question: `pnpm-workspace.yaml` trips its monorepo detection, but the workspaces here are build targets, not bounded contexts.

Installing Matt's skills as a Claude Code plugin instead of vendoring them means uninstalling the plugin first (`claude plugin uninstall mattpocock-skills --scope user`) — running both loads every skill twice.

### The Design stage

Design turns an approved `intent.md` into a `spec.md` shaped like a system design doc: requirements → core entities → API contract → high-level design → deep dives. It runs in **three phases**, because the interview is a pipeline and not a fan-out — the API depends on the entities, and an advisor spawned before the API exists is guessing.

```
intent.md [approved]
     │
     ▼
  /to-spec
     │
   PHASE A   the architect drafts a skeleton, alone, in interview order
     │       user stories → NFRs → core entities → API → high-level design
     │       (deep dives left empty; seams checked with you)
     ▼
   PHASE B   four advisors fan out, isolated, concurrent
     │       security · data · operability · simplicity      ← subagents
     │       ux                                              ← main session, it may interview you
     │       each returns an ADVISORY, committed to advisories/
     ▼
   PHASE C   the architect synthesizes, writes the deep dives,
     │       records every override, proposes ADRs where precedent is set
     ▼
  spec.md [draft]  +  ## Flagged concerns
     │
     ▼
  /spec-review     one fidelity check: what did synthesis drop or dilute?
     │             (--adversarial re-runs all four against the finished spec)
     ▼
  you resolve the concerns → status: approved → /to-tickets
```

**Advisors advise; the architect writes.** If each advisor authored its own section the spec would read as four documents stapled together, and the genuine conflicts between them — security wants the check in the data layer, latency wants the cached read — would get buried instead of surfaced. Two advisors reaching opposite conclusions becomes one concern stating both positions, arbitrated by the Tech lead.

**Method and policy are separate, and that is the whole design.** The skills carry craft, which is the same in any project; [`docs/policy/`](./docs/policy/) carries the answers only this project can give. Every policy value is set or literally `UNSET`, and a skill that needs an `UNSET` value raises a concern naming the file and the key rather than picking a default:

```sh
grep -rn UNSET docs/policy/     # the whole day-one list
```

| Skill                | Runs as               | Carries                                                                                                                    |
| -------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `system-design`      | the architect         | The interview method, back-of-envelope, deep-dive selection, monorepo placement, ADRs                                      |
| `security-design`    | `security-advisor`    | Secure by design, zero trust, least privilege — STRIDE per boundary, where authorization lives, what crosses to the client |
| `data-design`        | `data-advisor`        | Entities → schema, indexes from access patterns, expand–contract, cache ownership, classification                          |
| `operability-design` | `operability-advisor` | SLI before SLO, control bands, golden signals, rollback classes, the release moment                                        |
| `simplicity`         | `simplicity-advisor`  | The counterweight — the fewest moving parts that satisfy the intent                                                        |
| `ux-design`          | the architect         | A **router**, not a rulebook: [impeccable](https://impeccable.style/docs/) owns the depth                                  |

**The UX lens is a router**, and it runs in the main session because one of its cases interviews you. It asks who consumes the surface this change adds:

| Case                                | What runs                    | The spec's UX section says                          |
| ----------------------------------- | ---------------------------- | --------------------------------------------------- |
| No consumed surface                 | nothing                      | `_No consumed surface._` and why                    |
| Local change to an existing surface | nothing at Design            | the surface, its brief, the states this change adds |
| New surface or flow                 | `/impeccable shape <target>` | the decisions, and a link to the surface brief      |
| Agent-facing (a skill, `CLAUDE.md`) | `writing-for-agents`         | the consumer, its trigger, its failure mode         |

It keeps only what nobody else holds at spec time: the six-state set, the Suspense-fallback-as-designed-state bridge, and the actual copy. [`DESIGN.md`](./DESIGN.md) is the visual authority — **its frontmatter still carries tokens inherited rather than chosen, its prose body does not**.

**The spec reaches Build through the artifact, not through a modified skill.** Each non-functional requirement names the user stories it binds, and `/to-tickets` — vendored and unmodified — cuts one ticket per story and copies the spec's criteria onto it. So a `p95 under 200 ms` that named story 1 arrives as a checkbox on story 1's ticket, rather than sitting in a section nobody re-reads at implementation time. An NFR binding no story is a finding, reported at the end of `/to-spec`.

**`/prototype` complements `shape` rather than competing with it.** `shape` decides direction in prose and produces a durable brief; `/prototype` tests a hypothesis in throwaway code. Its LOGIC branch answers "does this state model or API shape hold up" (a Phase A/C question, and the validated reducer gets inlined into the spec); its UI branch answers "which concrete alternative wins" and needs an existing page to sit against, which is why it belongs to the local-change case. Prototypes at Design are the one exception to "no code yet" — throwaway branch, never promoted, and the architect proposes rather than auto-runs.

**The Design gate.** A spec stays `status: draft` while any concern is unchecked. [`design-to-build-gate.sh`](./.claude/hooks/design-to-build-gate.sh) adds three rules to the Plan gate's two:

| Rule                   | Refuses                                                                          |
| ---------------------- | -------------------------------------------------------------------------------- |
| **Approval integrity** | any agent write setting `status: approved` in a `spec.md`                        |
| **Concerns exist**     | writing a `spec.md` with no `## Flagged concerns` section, even an empty one     |
| **The gate**           | hanging a ticket off the issue of a spec still `draft` or carrying open concerns |

The middle rule is what gives the third something to read. A concerns list that can be silently omitted is a gate that never fires.

### The Build stage

Build turns an approved `spec.md` into tickets and then into merged code. **Both of its skills are
vendored and unmodified** — everything that makes them fit this repo lives in artifacts the repo
owns, which is the same move the Design stage makes with the spec template.

```
spec.md [approved]
     │
     ▼
  /to-tickets     one tracer-bullet ticket per user story, with blocking edges
     │            each bound NFR rides along as an acceptance criterion
     │            published as sub-issues of the spec's issue — that IS the plan
     ▼
  the frontier    open · unblocked · unassigned
     │
     ▼
  /implement      one ticket, one session
     │  claim ──▶ plan (posted as a ticket comment) ──▶ /tdd at the spec's seams
     │                                                        │
     │                                     verify: lint · check-types · test
     │                                     + next-dev-loop where apps/web changed
     │                                                        ▼
     │                                     tick each criterion WITH its evidence
     ▼
  a PR            ← the agent stops here. Merging is the human's act
```

**The plan is a query, and the ticket-level plan is a comment.** The playbook commits a `plan.md`;
here the effort-level plan is the spec's issue with its tickets hanging off it, because a prose plan
goes stale the moment a ticket is split. The _ticket_-level plan is still written — plan mode, then
posted as a comment on the ticket before any code — because the playbook wants the PR review to check
the diff against it, and that is precisely what the **Spec** axis of `/code-review` does.

**The seams were already agreed at Design.** `tdd` refuses to write a test at an unconfirmed seam;
`/to-spec` A5 checks the seams with you before Phase B. So Build reads the spec rather than
re-interviewing you — a coupling that existed before this stage was wired and just needed saying.

**Verification is two-legged.** `packages/design-system` has Vitest. `apps/web` does not, and its leg
is [`next-dev-loop`](https://www.skills.sh/vercel/next.js/next-dev-loop) against a running dev
server, because Vitest cannot test `async` Server Components — Next's own docs say so. A criterion
ticked without naming its evidence is a claim, not a check.

| Skill                       | Runs as       | Carries                                                                                  |
| --------------------------- | ------------- | ---------------------------------------------------------------------------------------- |
| `to-tickets`                | you type it   | Vertical slices, blocking edges, expand–contract for a wide refactor                     |
| `implement`                 | you type it   | The session. Thin on purpose — the repo's half is in `docs/agents/issue-tracker.md`      |
| `tdd`                       | model-invoked | Red/green, what a good test is, and "no test at an unconfirmed seam"                     |
| `code-review`               | you type it   | Two axes in parallel subagents: Standards (with a Fowler smell baseline) and Spec        |
| `codebase-design`           | model-invoked | The deep-module vocabulary `tdd` cites when the interface's shape is itself the question |
| `resolving-merge-conflicts` | model-invoked | The tax on stacked PRs                                                                   |

#### Stacked pull requests

Off by default — `stacked-prs` is `UNSET` in [`docs/policy/build.md`](./docs/policy/build.md). Turn
it on and a chain of blocking edges is published as a chain of PRs, each based on the last:

```sh
gh extension install github/gh-stack
gh stack init && gh stack add ticket/124-slug && gh stack submit
```

The reason it fits is that **`/to-tickets` already emits the structure**: every ticket declares what
blocks it, and a chain of blocking edges _is_ a stack. Nothing new has to be recorded. What it buys
is `implement-spec`'s concurrency with `/implement`'s reviewability — a blocked ticket can start
before its blocker merges, and a reviewer still gets one small PR per slice instead of one large one
per effort.

**A stack is a path; the ticket graph is a DAG.** Maximal chains become stacks, a ticket with two
blockers stays serialized, and unrelated tickets are never stacked for tidiness — a stack asserts an
ordering, and asserting one that does not exist makes the review worse. The rule is in
[`docs/agents/issue-tracker.md`](./docs/agents/issue-tracker.md). The canonical case is the
expand–contract sequence `/to-tickets` produces for a wide refactor: a single chain by construction,
and `gh stack merge`'s all-or-nothing merge is exactly the "green is promised only at the integrate
ticket" guarantee that skill describes.

It costs rebase churn — a fix low in the stack rebases everything above it — and it multiplies PRs,
which is why `REVIEW.md` has to say what runs per-PR and what runs once at the top.

**The Build gate.** Three `PreToolUse` hooks and one `Stop` hook add six rules to the five before them:

| Rule                   | Refuses                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| **F. The ship gate**   | `gh pr merge`, an approving `gh pr review`, or `gh stack merge` — a stack merge is a merge             |
| **G. No side door**    | `git push` to the default branch. Without it F is theatre                                              |
| **H. Protected paths** | hand-editing a vendored skill, a committed advisory, or `pnpm-lock.yaml`                               |
| **I. Credentials**     | writing an AWS key, GitHub token, Anthropic key, Slack token, or private key into the repo             |
| **J. Shipped schema**  | hand-editing a migration a `meta/_journal.json` beside it already names                                |
| **K. The wrong tree**  | committing in a checkout that has the default branch out. G refuses the same mistake one step too late |

Rule F is the load-bearing one, exactly as **A** is for Plan and **C** for Design: the act has to be
one the agent cannot perform. Unlike **B** and **E** it reads no artifact, because there is no state
under which an agent may merge — `build.md` records that as a fixed fact rather than a key.

Rule H's test is **`skills-lock.json`** rather than a hand-kept list, and that is what makes it
survive: a skill named in the lock is one `skills update` overwrites, and this repo's own skills sit
in the same directory precisely because forking one means leaving the lock.

Rule **K** is the one that says where work is _written_, and it is a backstop rather than the
mechanism: `CLAUDE.md` tells a session to open a worktree before its first write, which is also what
licenses the harness's worktree tool. A session that did so never reaches the rule. It refuses the
commit rather than the write because that is where the mistake stops being free — before it, one
`git switch -c` carries everything across; after it, the recovery is a `git reset --hard` on the
branch everything else is based on.
[ADR-0017](./docs/adr/0017-work-is-written-in-a-worktree-and-merged-into-the-default-branch.md)
carries the argument and the two hook bugs it found.

`verify-before-stop.sh` closes the loop the playbook cares most about — _"a session checks its own
work and fixes its own mistakes before an engineer sees them."_ It refuses to let the session stop
while `pnpm lint`, `pnpm format`, `pnpm check-types` or `pnpm test` is red — the four root scripts
the definition of done names, so it restates no task list — fires only when code actually changed,
and never twice. **A hook edit counts as code here** — the stage hooks are this repo's own logic, so a
session that changes one runs `gate-test.sh` before it may stop.

**It reads the tree from the hook payload, and that was a bug before it was a convention.** Every
hook here used to resolve the repository through `CLAUDE_PROJECT_DIR`, which names the directory the
session was _launched_ from and goes on naming the main checkout after the session enters a worktree.
So in a worktree session this gate ran `git status` against the main checkout, found it clean, and
reported a pass having verified nothing at all. `tree_for()` in `gate-lib.sh` is the fix, and the
rule it stands for is that a hook reading repo state reads it through the payload.

**A gate that blocks correct work is a gate someone turns off.** All four false refusals found while
writing these were exactly that, and two are worth knowing about: a commit message _naming_ the
commands rule F refuses tripped rule F, so `gate-lib.sh` now strips heredoc bodies before matching;
and BSD `sed` has no `\b`, so a silently-non-matching strip made rule G refuse nothing at all. Every
new rule gets a prose case in `gate-test.sh`.

### What is wired, and what is still open

| File                                                    | Role                                                                                                                                                                                         |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`CLAUDE.md`](./CLAUDE.md) / [`AGENTS.md`](./AGENTS.md) | **Included.** Commands, conventions, architecture, recurring mistakes, how to verify work. Update whenever a correction has to be repeated                                                   |
| [`.mcp.json`](./.mcp.json)                              | **Included.** `next-devtools-mcp`, so agents can read the running dev server's errors, routes, and compilation state                                                                         |
| `.agents/skills/<name>/SKILL.md`                        | **Included** — tool skills, the Plan-stage set, and the Design-stage method. These carry craft, not policy, so inherit them rather than rewriting them                                       |
| [`docs/policy/`](./docs/policy/)                        | **Included, and mostly answered.** Eight files of keys; effort 0002's design interview set most of them, and `grep -rn UNSET docs/policy/` is what is left                                   |
| [`.claude/agents/<name>.md`](./.claude/agents/)         | **Included** — four Design advisors and the fidelity checker. Yours go here too: verification, research, whatever recurs                                                                     |
| [`.claude/settings.json`](./.claude/settings.json)      | **Included.** Both stage gates as `PreToolUse` hooks, plus impeccable's design detector. Yours go here too: protected paths, formatters, credential scanning, deploy authorization           |
| `REVIEW.md`                                             | **Not written.** The review passes beyond `code-review`'s two axes, the severity that blocks a merge, and — `stacked-prs` being `yes` — what runs per-PR versus once at the top of the stack |
| [`.github/workflows/`](./.github/workflows/)            | **Included** — `ci.yml` runs the required checks on every PR, one job per entry in `required-checks`, `needs-triage.yml` files findings. The non-interactive eval suite is not written                                          |

The two still open are open on purpose. Each is worth writing when the need for it shows up rather than upfront — `REVIEW.md` when a review pass beyond the two axes is actually wanted, the eval suite when there is an incident to turn into one.

## Useful links

- [The AI-native SDLC playbook](https://claude.com/blog/the-ai-native-sdlc-playbook)
- [Claude Code docs](https://docs.claude.com/en/docs/claude-code/overview)
- Next.js for agents: [setup guide](https://nextjs.org/docs/app/guides/ai-agents) · [MCP server](https://nextjs.org/docs/app/guides/mcp) · [Cache Components](https://nextjs.org/docs/app/getting-started/caching) · [skills on skills.sh](https://www.skills.sh/vercel/next.js)
- [Turborepo: tasks](https://turborepo.dev/docs/crafting-your-repository/running-tasks) · [caching](https://turborepo.dev/docs/crafting-your-repository/caching) · [filtering](https://turborepo.dev/docs/crafting-your-repository/running-tasks#using-filters)
