# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary user is a **developer starting a new product** — not an end user of any
shipped app. They clone this repository as the first act of a project, before there is a
product to speak of, and their job is to get from "empty idea" to "a typed monorepo whose
conventions an agent can already act on" without assembling that toolchain themselves.

Audience today is **the team**; the repository is written so it could be published to
developers adopting the AI-native SDLC playbook without a rewrite. That means conventions
must be legible to someone who did not write them, and internal shorthand does not belong
in committed files.

The second reader of everything here is **Claude Code itself**. `CLAUDE.md`, `AGENTS.md`,
the vendored skills, and the hooks are consumed by an agent, not skimmed by a human, and
they are as much the product as the code is.

## Product Purpose

A **project template**, not a product. It exists so that a new product can start with the
AI-native SDLC — the model in
<https://claude.com/blog/the-ai-native-sdlc-playbook>, where an agent participates at
every stage and humans hold the judgment calls — already wired up rather than described.

Success is that a downstream project inherits working conventions and never has to
re-derive them: the toolchain is pinned and enforced, the artifact chain
(`intent.md` → `spec.md` → tickets → PR review → triage) has a place to live, and the
gates that make agent participation safe are executable rather than aspirational.

Changes here are judged by whether they make the **template** better for a downstream
project — never by whether they make the demo app better. Product-specific code does not
belong on the default branch.

## Positioning

Most starters give you a stack. This one gives you a **working model for how the work
gets done**, and encodes the parts of it that only hold if they are enforced:

- The **Plan gate** is a `PreToolUse` hook, not a norm. An agent cannot set an intent to
  `status: approved`, so approval stays a human act. Without that first rule, the gate on
  writing `spec.md` would be theatre.
- Toolchain requirements **fail** rather than warn — `engineStrict` makes `pnpm install`
  refuse an older Node instead of printing advice.
- The plan is **a query, not a document**: the spec's issue with its tickets as sub-issues,
  so progress and blocked-by are computed rather than restated and go stale.

Each artifact names exactly one system as its source of truth: intents and specs are
files in git, tickets are GitHub issues, and every published artifact gets an issue
holding a summary and a permalink.

## Operating Context

- **Monorepo:** Turborepo on pnpm 11, TypeScript 7 throughout. `apps/web` (Next.js 16 App
  Router, React 19), `packages/design-system` (shadcn/ui on Base UI + Tailwind v4,
  consumed as source), `packages/typescript-config`.
- **Node 24.x** and **pnpm 11**, both enforced rather than suggested.
- **Issue tracker:** GitHub Issues via the `gh` CLI. SDLC artifacts live under
  `docs/efforts/<NNNN>-<slug>/`; a folder there means a human decided something is work.
- **Findings enter through `/triage`**, never as auto-created intents — see
  `docs/adr/0001-findings-enter-through-triage.md`.
- Skills are **vendored** under `.agents/skills/` and symlinked into `.claude/skills/`,
  tracked by `skills-lock.json`. They are installed with the `skills` CLI and never
  hand-edited.
- `next dev` writes a managed block into `apps/web/AGENTS.md` and a lock file recording its
  PID/port; both are facts of the environment, not diffs to clean up.

## Capabilities and Constraints

**Fixed — future design work must preserve these:**

- **The shadcn/Base UI + Tailwind v4 token layer is the design surface.** Components stay
  shadcn-generated and swappable via `pnpm dlx shadcn@latest apply <preset> -c packages/design-system`.
  Visual change goes through the tokens in `packages/design-system/src/styles/globals.css`,
  not through hand-editing generated component files.
- **The Placeholders table is part of the contract.** Anything a downstream project must
  rename or replace stays listed in `README.md` under "Placeholders to change", updated in
  the same change that adds, renames, or removes it.
- **`apps/web` is a disposable scaffold.** `app/page.tsx` and `app/showcase.tsx` are a
  wiring check that the design system renders — deleted on day one of a real project. They
  must stay _obviously_ placeholder so nobody mistakes them for product code. The
  `title: "Create Next App"` metadata is a deliberate placeholder, not an oversight to fix
  silently.

**Undecided — do not invent an answer:**

- **No test runner is wired up.** `turbo.json` defines only `build`, `check-types`, `dev`,
  and the root `lint`/`format` tasks. Do not claim tests pass or invent a `pnpm test`;
  adding a runner and a `test` task is part of whatever change first needs it.
- Stages after Plan (Test, Deploy, Maintain) are **deliberately unwired**. `.claude/agents/`,
  `REVIEW.md`, and `.github/workflows/` are extension points a downstream project fills in
  when the need shows up, not gaps to close preemptively.
- **Light/dark parity is not a stated commitment.** `ThemeProvider` and `ThemeToggle` ship
  and both themes currently work; whether every future surface must be correct in both is
  an open call, not an established rule.

**Terminology:**

- _Placeholder_ — scaffolding a downstream project is expected to replace, and which is
  therefore listed in the README table.
- _Effort_ — a numbered folder under `docs/efforts/` holding one `intent.md` and one
  `spec.md`. Its existence means a human decided it is work.
- _The Plan gate_ — the human approval of an intent, enforced by `.claude/hooks/plan-gate.sh`.

## Brand Commitments

**The theme and branding are per-project placeholders.** The current visual identity —
the shadcn preset `b1Z6BvKBU` (`vega` style, `zinc` base, `blue` theme, `lucide` icons,
Inter + Geist Mono, small radius), the `create-next-app` favicon, and the app metadata —
exists to be replaced by each downstream project. It is a **default, not an identity**,
and no future work should treat it as a brand to be consistent with.

The template itself has no brand beyond its repository name (`ai-native-project`, itself a
placeholder). There is no logo, no wordmark, no palette, and no voice guide to honor.

## Evidence on Hand

- `README.md` — the authoritative account of what ships, what is a placeholder, and how to
  wire the Plan stage in a fresh clone.
- `CLAUDE.md` (root), `packages/design-system/CLAUDE.md`, `apps/web/AGENTS.md` — the
  conventions an agent reads.
- `docs/adr/0001-findings-enter-through-triage.md` — the one recorded architectural
  decision.
- `docs/agents/{issue-tracker,triage-labels,domain}.md` — tracker, label, and domain-doc
  conventions.
- Version-matched Next.js docs bundled at `apps/web/node_modules/next/dist/docs/`, preferred
  over recall when writing Next.js code.

**Absences future work must not fabricate:** there are no users, no customers, no
testimonials, no benchmarks, no pricing, no deployment, and no CI. The repository has never
shipped a product. Nothing in this template may claim otherwise.

## Product Principles

1. **The template is the deliverable, not the demo.** Judge every change by what it does
   for a downstream project on day one.
2. **Enforce, don't advise.** A convention that matters becomes a hook, an engine
   constraint, or a failing exit code. Documentation states the rule; something executable
   holds it.
3. **One source of truth per artifact.** Everything else links to it. Never restate state
   that a system can compute.
4. **Placeholders are labeled, never disguised.** Scaffolding announces itself and is
   listed where a new project will find it.
5. **Approval is a human act.** The agent proposes, gates refuse, and a person decides —
   this is what makes agent participation at every stage safe.

## Accessibility & Inclusion

**WCAG 2.2 AA** is a commitment of the template, so downstream projects inherit it rather
than retrofitting it. It binds the token layer in particular: any preset or palette applied
to `packages/design-system/src/styles/globals.css` must clear AA contrast in the themes it
ships, since every downstream surface reads from those tokens.
