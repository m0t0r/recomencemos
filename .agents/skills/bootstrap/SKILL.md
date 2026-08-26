---
name: bootstrap
description: Make a fresh clone of this template yours — the placeholder sweep, the coupled renames, the verification gate, and the hand-off to the human half. Run once, before the first Plan session.
disable-model-invocation: true
---

# Bootstrap

One session, run once in a fresh clone, before any SDLC stage. The split is the method: this skill
does the **agent half** — every rename an editor can make and a gate can verify — and hands the
**human half** to `scripts/setup.sh`, the committed wizard. It ends with a report, never with a
spec: the SDLC starts afterwards, with `/grill-with-docs` → `/to-intent`.

## Process

### 1. Read the table

`README.md` → **"Placeholders to change"** is the source of truth and the work list. Read it now;
this skill carries no copy, so a placeholder added to the table is in scope with no edit here.
Classify each row: **mechanical** (a rename or file edit this session performs) or **human** (a
decision or an asset — the brand preset, the favicon, the typeface, `PRODUCT.md`'s truth,
`DESIGN.md`'s frontmatter).

**Done when:** every row is classified and the mechanical rows form an ordered plan.

### 2. Ask for the three names, once

Project name, app name, and the `@repo` scope — replace or keep. One question, up front, because
every mechanical row derives from these three. Keeping `@repo` is a real answer and goes in the
report, not a skipped row.

### 3. Sweep the mechanical rows

The renames are coupled beyond what the table's "Where" column lists. This map is the skill's
reason to exist — each entry is a miss that survives the gate:

- **The app name** (`web`) reaches: the workspace `name` and every `--filter=web`; the `@source`
  globs in `packages/design-system/src/styles/globals.css` — a missed glob makes Tailwind silently
  stop seeing the app (`packages/design-system/CLAUDE.md`); the `SERVICE_NAME` constant in
  `packages/observability/src/logger-options.ts` — a constant on purpose, so nothing errors when it
  is missed and every log line just keeps saying `"web"`; and the directory `apps/web` itself if
  renamed, which moves the tsconfig `include` for `next.config.ts`. The regenerated block in
  `apps/web/AGENTS.md` is `next dev`'s to write — edit around its markers, and put nothing inside
  them.
- **The project name** (`recomencemos`) reaches: the root `package.json` name, and the local
  development database — the compose project `name`, `POSTGRES_USER`/`POSTGRES_PASSWORD`/
  `POSTGRES_DB` in `docker-compose.yaml`, the entry and the user in `docker/pgbouncer/*`, and both
  URLs in `apps/web/.env.example`. Miss **all four** and nothing breaks — the dev database just
  keeps the template's name forever, which is the version nobody notices. Miss **some** and
  `pnpm db:up` starts a database `pnpm dev` then cannot connect to.
- **The scope** (`@repo`) reaches: every `packages/*/package.json` name, every `workspace:*`
  dependency, the design system's own import paths, and `components.json` aliases.
- **Package names changed means `pnpm install`**: the lockfile follows the manifests, the installer
  is the only tool that edits it, and the Build guard enforces exactly that.

**Done when:** a repo-wide search for each replaced name finds only `.agents/`, `.claude/`, git
history, and rows the user chose to keep.

### 4. Verify

`pnpm lint && pnpm check-types && pnpm test && pnpm build`, all green — then boot `pnpm dev` and
load the app once. The boot is not optional: the `@source`-glob miss ships unstyled pages through a
green gate, and the running app is the only place it shows.

**Done when:** the gate is green and the app served a styled page.

### 5. Hand off the human half

Tell the user to run `bash scripts/setup.sh`. The wizard walks the origin remote, the brand
preset, and the assets — the steps only they can perform — and its closing summary lists what it
skipped. Its stages (below the `STAGES` marker) are this repo's to edit and extend via `/wizard`;
the library above the marker is the vendored template's, regenerated rather than edited.

### 6. Report, and stop before the SDLC

- Every table row: changed to what, or kept and why.
- The human rows still open — the wizard's summary, plus the two writing sessions no wizard stage
  covers: `PRODUCT.md` rewritten to the product's own truth, and `DESIGN.md`'s frontmatter after
  the preset lands.
- Every `UNSET` under `docs/policy/` stays as it is: each is answered later, through the flagged
  concern a skill raises when it first needs the value. Name the mechanism in the report so the
  user expects those questions instead of pre-answering them.
- Close with the next step: `/grill-with-docs` over the initial requirements, then `/to-intent` —
  and the first effort cut as one thin end-to-end slice, with everything else left for
  efforts `0002+`.
