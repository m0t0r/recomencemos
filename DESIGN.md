---
name: ai-native-project
description: The template's default design system — shadcn/ui on Base UI, Tailwind v4 tokens, light and dark.
colors:
  background: "oklch(1 0 0)"
  foreground: "oklch(0.141 0.005 285.823)"
  card: "oklch(1 0 0)"
  card-foreground: "oklch(0.141 0.005 285.823)"
  popover: "oklch(1 0 0)"
  popover-foreground: "oklch(0.141 0.005 285.823)"
  primary: "oklch(0.488 0.243 264.376)"
  primary-foreground: "oklch(0.97 0.014 254.604)"
  secondary: "oklch(0.967 0.001 286.375)"
  secondary-foreground: "oklch(0.21 0.006 285.885)"
  muted: "oklch(0.967 0.001 286.375)"
  muted-foreground: "oklch(0.552 0.016 285.938)"
  accent: "oklch(0.967 0.001 286.375)"
  accent-foreground: "oklch(0.21 0.006 285.885)"
  destructive: "oklch(0.577 0.245 27.325)"
  border: "oklch(0.92 0.004 286.32)"
  input: "oklch(0.92 0.004 286.32)"
  ring: "oklch(0.705 0.015 286.067)"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  sm: "0.27rem"
  md: "0.36rem"
  lg: "0.45rem"
  xl: "0.63rem"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2.5rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.background}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.lg}"
    padding: "1.5rem"
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 0.75rem"
---

# Design

> **The frontmatter above is a placeholder. Everything below it is not.**
>
> Those token values come from shadcn preset `b1Z6BvKBU` (`vega` style, `zinc` base, `blue` theme,
> `lucide` icons, Inter + Geist Mono, `0.45rem` radius). A new project replaces them by applying its
> own preset and regenerating this block — see `README.md` → "Placeholders to change".
>
> The prose below records how the system _works_, not what colour it is. It survives a re-theme, and
> a downstream project inherits it rather than rewriting it.

## Overview

The design surface is **shadcn/ui on Base UI with Tailwind v4**, consumed as source from
`@repo/design-system`. There is no build step: the `exports` map points subpaths straight at TSX, so
the file name _is_ the public subpath.

**One stylesheet owns the tokens.** `packages/design-system/src/styles/globals.css` holds the
`@theme inline` map and both theme blocks. `apps/web` imports it as `@repo/design-system/globals.css`.
There is no `tailwind.config.js` — v4 is CSS-first.

**Visual change goes through tokens, never through generated components.** Files under
`src/components/` are registry output and are replaced wholesale by the CLI. A hand edit there is
lost on the next `shadcn add --overwrite`, which is why the two a11y rules they trip are silenced by
scoped `overrides` in the package's `.oxlintrc.json` rather than by inline comments the CLI would
clobber. `theme-provider.tsx`, `theme-toggle.tsx`, and the `toast` re-export at the bottom of
`sonner.tsx` are ours — keep them when regenerating.

The default visitor mode is **Operate**: this is product UI, so scanability, consistency, and
familiar affordances outrank expression. A marketing surface built on this system is Persuade and
may take more; it says so in its own surface brief rather than changing anything here.

## Colors

**Semantic tokens only.** A spec or component names `bg-background`, `text-muted-foreground`,
`border-border` — never a colour value, and never a `dark:` override. Dark mode is class-based
(`.dark`, driven by `next-themes`) and **both themes already live in the tokens**, so a `dark:`
utility on a colour is a bug: it means someone bypassed the layer that makes re-theming possible.

The frontmatter records the **light** values, because the token schema has no theme dimension. The
dark values sit in the `.dark` block of `globals.css` and are equally normative.

The palette is **Restrained** by default — neutrals plus one accent. `primary` carries primary
actions, current selection, and state indicators. It is not decoration. A single surface may earn
**Committed** (one saturated colour across 30–60% of the surface); that is a surface-brief decision,
not a system-wide one.

**WCAG 2.2 AA is a commitment of this template**, recorded in `PRODUCT.md` and in
`docs/policy/ux.md`. It binds this layer in particular: any preset or palette applied to
`globals.css` must clear AA contrast **in both themes**, because every downstream surface reads from
these tokens. Checking one theme and shipping is how the commitment quietly lapses.

The `chart-1` … `chart-5` ramp exists for data visualization and is ordered, not categorical-random.
`sidebar-*` is a second neutral layer for chrome — sidebars, toolbars, panels — deliberately
distinct from the content surface.

## Typography

**One family carries the interface.** `--font-heading` is defined as `var(--font-sans)`, which is a
decision, not an oversight: product UI has more type elements than a brand surface, and exaggerated
display/body contrast reads as noise. Headings differ by size and weight, not by face.

- **Fixed rem scale, not fluid.** No `clamp()` on UI type. Users view at consistent DPI, and a
  heading that shrinks inside a sidebar looks worse, not better.
- **Tight scale ratio** — roughly 1.125–1.2 between steps.
- **Prose stays at 65–75ch.** Data and compact UI may run denser; tables at 120ch+ are fine.
- Mono (`Geist Mono`) is for code, identifiers, and tabular figures. Not for labels.

## Layout

Responsive behaviour is **structural**, not fluid: collapse the sidebar, switch the table to a
stacked view, change the column count at a breakpoint. Resist fluid typography.

One spacing rhythm throughout, with more space above a heading than below it — the heading belongs
to the content that follows it.

## Elevation & Depth

Depth is carried by the second neutral layer and by borders, not by heavy shadows. `card` and
`popover` sit on `background`; `sidebar` is its own surface. Shadows mark things that genuinely
float — popovers, dialogs, toasts — and nothing else.

**Overlays must escape their container.** An absolutely positioned dropdown inside an
`overflow: hidden` or `overflow: auto` ancestor gets clipped. Use `<dialog>`, the popover API,
`position: fixed`, or a portal.

## Shapes

`--radius` is `0.45rem` and every other radius derives from it by multiplication, so re-theming the
corner language is a one-value change. Use the `rounded-sm/md/lg/xl` steps rather than arbitrary
values — an arbitrary radius is a token that escaped.

Non-disabled `button` and `[role="button"]` get `cursor: pointer` from a `@layer base` rule (the
preset was generated with `--pointer`). That is deliberate; do not re-add it per component.

## Components

**Add components with the CLI, never by hand:**
`pnpm dlx shadcn@latest add <component> -c packages/design-system`. The aliases in `components.json`
already map to `@repo/design-system/*`, so generated imports come out correct.

**Base UI, not Radix.** Custom triggers use the `render` prop, not `asChild`:
`<DialogTrigger render={<Button>Open</Button>} />`.

**Every interactive component ships its full interaction set:** default, hover, focus, active,
disabled, loading, error. Shipping half of these is the most common way a system rots.

**Every surface ships its full state set** — empty, loading, partial, error, permission denied,
success. The six are defined in `docs/policy/ux.md` and are not optional. Loading is a **skeleton**
(`skeleton.tsx`), not a spinner dropped into the middle of content, and a Suspense fallback of a
different shape than the content it replaces is a layout shift you just specified.

Consistency across surfaces is a virtue here. The same button shape, the same form-control
vocabulary, the same icon style (`lucide`), screen to screen.

## Do's and Don'ts

**Do**

- Reach for a registry component before building one. A spec needing a component the registry does
  not provide says so, because building it is scope the ticket has to carry.
- Name the keyboard path through every new surface, and where focus lands after an async state
  resolves.
- Say what is announced when a state changes. A screen-reader user gets nothing from a spinner
  swapping to content unless something says so.
- Add a `@source` glob to `globals.css` for any new app workspace, or its classes are silently
  missing from the build.
- Keep motion at 150–250 ms and let it convey state — change, feedback, loading, reveal.

**Don't**

- Don't hand-edit files under `src/components/`. Re-run the CLI.
- Don't use `dark:` colour overrides. The tokens carry both themes.
- Don't put display faces in labels, buttons, or data.
- Don't reinvent standard affordances for flavour — custom scrollbars, novel form controls,
  non-standard modals.
- Don't reach for a modal first. Exhaust inline and progressive alternatives; a modal is usually the
  lazy answer to a layout problem.
- Don't orchestrate page-load sequences. Product UI loads into a task; nobody wants to watch it
  arrive.
