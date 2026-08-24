# @repo/design-system

Guidance for working inside `packages/design-system`. Repo-wide conventions are in the root `CLAUDE.md`.

**`@repo/design-system` has no build step.** Its `exports` map points subpaths straight at source — `"./components/*": "./src/components/*.tsx"`, plus `./lib/*`, `./hooks/*`, `./globals.css`, and `./postcss.config` — so consumers import raw TSX (`import { Button } from "@repo/design-system/components/button"`) and Next.js transpiles it. There is no `build` script and no `dist` in the dependency graph. The file name _is_ the public subpath; there is no barrel file to update.

**The design system is shadcn/ui on Base UI, not Radix.** It was generated from preset `b1Z6BvKBU` (`vega` style, `zinc` base, `blue` theme, `lucide` icons, Inter, small radius) with `--pointer`, which is why `globals.css` ends with a `@layer base` rule giving every non-disabled `button` / `[role="button"]` `cursor: pointer`.

- **Add components with the CLI, never by hand:** `pnpm dlx shadcn@latest add <component> -c packages/design-system`. `packages/design-system/components.json` already maps the aliases to `@repo/design-system/*`, so generated imports come out correct.
- **Base UI, not Radix**, means custom triggers use the `render` prop, not `asChild` — `<DialogTrigger render={<Button>Open</Button>} />`.
- **Files under `src/components/` are registry output.** Prefer re-running the CLI (`add --diff` / `--overwrite`) over editing them, because hand edits are lost on the next update. That is also why the two a11y rules they trip are turned off through scoped `overrides` in `packages/design-system/.oxlintrc.json` rather than with inline `oxlint-disable` comments the CLI would clobber.
- `theme-provider.tsx`, `theme-toggle.tsx`, and the `toast` re-export at the bottom of `sonner.tsx` are **ours**, not registry output — keep them when regenerating.

**Tailwind v4, one stylesheet, owned by the design system.** `packages/design-system/src/styles/globals.css` holds the `@theme inline` token map and the light/dark variable blocks; `apps/web/app/layout.tsx` imports it as `@repo/design-system/globals.css` and `apps/web/postcss.config.mjs` re-exports the package's PostCSS config. There is no `tailwind.config.js` — v4 is CSS-first. The `@source` globs in that file are what tell Tailwind to scan `apps/**`, so a new app workspace needs a glob added there or its classes will be missing from the build. Dark mode is class-based (`.dark`) and driven by `next-themes`; use semantic tokens (`bg-background`, `text-muted-foreground`) rather than `dark:` colour overrides.
