---
name: Recomencemos
description: The ruled notebook — ink on paper. shadcn/ui on Base UI, Tailwind v4 tokens chosen for this product with #178. Light only — there is no dark mode.
colors:
  background: "oklch(0.99 0.004 250)"
  foreground: "oklch(0.23 0.035 268)"
  card: "oklch(0.99 0.004 250)"
  card-foreground: "oklch(0.23 0.035 268)"
  popover: "oklch(0.99 0.004 250)"
  popover-foreground: "oklch(0.23 0.035 268)"
  primary: "oklch(0.46 0.16 268)"
  primary-foreground: "oklch(1 0 0)"
  ink: "oklch(0.46 0.16 268)"
  ink-foreground: "oklch(1 0 0)"
  ink-muted: "oklch(0.92 0.05 262)"
  secondary: "oklch(0.95 0.02 255)"
  secondary-foreground: "oklch(0.23 0.035 268)"
  muted: "oklch(0.965 0.01 250)"
  muted-foreground: "oklch(0.5 0.04 265)"
  accent: "oklch(0.95 0.02 255)"
  accent-foreground: "oklch(0.23 0.035 268)"
  destructive: "oklch(0.45 0.13 22)"
  destructive-foreground: "oklch(1 0 0)"
  success: "oklch(0.45 0.1 155)"
  warning: "oklch(0.45 0.094 75)"
  border: "oklch(0.895 0.03 240)"
  input: "oklch(0.6 0.06 265)"
  ring: "oklch(0.46 0.16 268)"
  margin: "oklch(0.78 0.09 18)"
typography:
  # The ramp, enumerated. Every step is a whole number in BOTH rem and px, which
  # is a constraint rather than a coincidence: `@repo/notifications` renders to
  # email, where `rem` is unsupported and `pixelBasedPreset` forces px, so a step
  # that is clean in one unit and fractional in the other cannot be shared. The
  # named roles below point into this ladder.
  scale:
    caption: "0.875rem"
    body: "1rem"
    lead: "1.125rem"
    h4: "1.25rem"
    h3: "1.5rem"
    h2: "1.75rem"
    h1: "2rem"
    display: "2.25rem"
  display:
    fontFamily: "Alegreya, Georgia, ui-serif, serif"
    fontSize: "2.25rem"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.01em"
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
  sm: "0.3rem"
  md: "0.4rem"
  lg: "0.5rem"
  xl: "0.7rem"
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

## The world

**Recomencemos looks like the ruled notebook a tienda in Risaralda keeps** — the _cuaderno_ where
the barrio's names and work are written down by hand, and one person keeps the book. It was chosen
with [#178](https://github.com/m0t0r/recomencemos/issues/178) from seven candidates grounded in the
audience's own world, over the two the category always ships (the marketplace grid and the stark
manifesto), and it carries the product's mechanism exactly: a person writes what she can do in her
own words, a human reads every Offer before it reaches her, and her number is only handed over when
she says so.

Four consequences, and every visual decision below is downstream of one of them:

- **Two inks, one paper.** Ballpoint blue is the only accent; the page is paper white with a faint
  cool cast; light-blue rulings are every divider and a rose margin line runs beside every list.
  There is no third colour to reach for, which is what keeps the palette from becoming a kit.
- **Her own words are the only thing set in the display face.** Alegreya carries headings and the
  headline on a card; everything that is a control, a label or data is Inter. The contrast between
  the two is the hierarchy of the whole product — what she wrote, and what the platform wrote.
- **State is a mark, never a hue.** A pending photo is her initial; a current session is a word; a
  chosen item is a filled ink shape. Colour is never the only thing that says what state a thing is
  in, and `destructive` is only ever a limit of the platform.
- **The cover is the one place the ink is spent.** The landing's first viewport is a solid field of
  ink carrying the proposition; nothing else in the product paints a region that size. A second
  cover would make the first one ordinary.

**The honest risk is that a notebook reads as a doodle.** The discipline is that rulings are
structure — the line between two rows, the margin beside a list — and never texture. No paper grain,
no torn edges, no handwriting font.

## Overview

The design surface is **shadcn/ui on Base UI with Tailwind v4**, consumed as source from
`@repo/design-system`. There is no build step: the `exports` map points subpaths straight at TSX, so
the file name _is_ the public subpath.

**One stylesheet owns the tokens.** `packages/design-system/src/styles/globals.css` holds the
`@theme inline` map and the `:root` block. `apps/web` imports it as `@repo/design-system/globals.css`.
There is no `tailwind.config.js` — v4 is CSS-first.

**Visual change goes through tokens, never through generated components.** Files under
`src/components/` are registry output and are replaced wholesale by the CLI. A hand edit there is
lost on the next `shadcn add --overwrite`, which is why the two a11y rules they trip are silenced by
scoped `overrides` in the package's `.oxlintrc.json` rather than by inline comments the CLI would
clobber. The `toast` re-export at the bottom of `sonner.tsx` is ours — keep it when regenerating.

The default visitor mode is **Operate**: this is product UI, so scanability, consistency, and
familiar affordances outrank expression. The landing (`/`) is **Persuade** and is the one surface
that spends the cover; it says so in its own brief at `.impeccable/briefs/wall.md`.

## Colors

**Semantic tokens only.** A spec or component names `bg-background`, `text-muted-foreground`,
`border-border` — never a colour value, and never a `dark:` override. **There is no dark mode**: the
paper is the product's one ground, and `globals.css` binds Tailwind's `dark` variant to a class
nothing sets so the visitor's OS cannot decide otherwise. `theme-parity` in `docs/policy/ux.md`
records this as light only.

The palette sits behind a seam. Eleven `--brand-*` shades at **hue 268 — ballpoint ink** — are the
private source; only the semantic names below reach Tailwind, so a component can never reach past
the semantic layer into a raw shade, and swapping the hue is one edit to the ramp.

| Token                                 | Role                                                                                                                                           |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `background` / `foreground`           | Paper and ink. The paper is not pure white and the ink is not neutral black; both carry the hue faintly                                        |
| `primary`                             | Shade 700. Primary actions, current selection, state indicators. Never decoration                                                              |
| `ink` / `ink-muted`                   | The primary shade as a field owning a whole region, and secondary text on it — tinted, never greyed. One per product                           |
| `secondary` / `accent`                | A light wash of the ink: hover, a selected chip, the second half of a button pair                                                              |
| `muted` / `muted-foreground`          | A recessed surface and the text that sits back from the ink                                                                                    |
| `border`                              | **The ruling.** Every divider is one. It identifies nothing, so it may be faint                                                                |
| `input`                               | An input's boundary is the only thing identifying the control, so it clears 3:1 (SC 1.4.11). Not the ruling                                    |
| `margin`                              | **The margin line** beside a list. Rose, not red, so it can never be read as `destructive`. Never a state                                      |
| `success` / `warning` / `destructive` | Each a triad with a surface and a border. `destructive` is only ever a limit of the platform; `warning` never a state the person is waiting on |

The palette is **Restrained** on every Operate surface — neutrals plus the one ink. The landing is
**Committed**: the cover carries roughly a third of the first viewport and nothing else on it paints a
region. That is the only surface with that permission.

**WCAG 2.2 AA is committed** in `PRODUCT.md` and `docs/policy/ux.md`, and it binds this layer in
particular. It is not a discipline here but a test: `apps/web/design-tokens.test.ts` resolves every
text pair in `globals.css` and fails under 4.5:1, every non-text pair under 3:1, and re-derives the
email palette and the root boundary's hex from the same values. A lightness value that breaks a pair
is red before it is reviewed.

The `chart-1` … `chart-5` ramp is ordered, not categorical-random, and slot 1 is `--brand-600`
verbatim. Its colour-vision distances were derived for the previous hue and have not been re-measured;
no chart ships today, and the first surface that draws one re-derives the four non-brand slots first.
`sidebar-*` is a second neutral layer for the operator's chrome, one step off the page.

## Typography

**Two families, clearly distinct, and the distinction is the hierarchy.**

- **Alegreya** — `--font-display`, and `--font-heading` points at it. Huerta Tipográfica, Buenos
  Aires: a Latin American face drawn for long Spanish reading, with a calligraphic rhythm that reads
  as written by a person without the costume of a handwriting font. Weights 500 and 600, both
  styles. It carries every heading and **her own words** — the headline on a card, which is the only
  line nobody else could have written. The italic is the voice of a quotation.
- **Inter** — `--font-sans`, the working face. Body, labels, controls, data, the Admin queue. A form
  set in the display face would be a form that asked to be admired.
- **Geist Mono** — code, identifiers, and tabular figures. Not for labels.

A display face never appears in a button, a label, a chip or a table cell. When something is set in
Alegreya, that is the signal that it is a heading or that she wrote it.

- **Fixed rem scale, not fluid.** No `clamp()` on UI type. The cover's headline is the one exception
  and it is a step of the ladder at each breakpoint, not a fluid value.
- **Tight scale ratio** — roughly 1.11–1.2 between steps. The ladder is `14 · 16 · 18 · 20 · 24 ·
28 · 32 · 36`, enumerated as `typography.scale` in the frontmatter so it is machine-readable.
  Tailwind's `text-3xl` is re-pointed at 32 px in `globals.css` so the utility a page heading
  reaches for lands on the ladder; `page-heading` is that step in the display face, and it is the
  one class every `<h1>` in the product carries.

**Every step is a whole number in both rem and px, and that is a constraint rather than a tidy
coincidence.** `@repo/notifications` renders the same visual system into email, where `rem` is
unsupported and `pixelBasedPreset` forces pixels — so a step that is clean in one unit and
fractional in the other cannot be shared between the two surfaces. **A size outside this ladder is a
change to it**, made here, not in the file that wanted it. `apps/web/design-tokens.test.ts` asserts
that every literal font size in the email templates and in the root error boundary is on this ladder.

Email keeps Inter alone: Alegreya is self-hosted by `next/font` and an inbox cannot load it, so a
template heading in the display face would render in whatever serif the client had. One face there is
the honest rendering.

- **Prose stays at 65–75ch.** Data and compact UI may run denser; tables at 120ch+ are fine.
- Serif text takes a little more line-height than sans: 1.1 for the display face at display sizes,
  1.25 at heading sizes.

## Layout

**Every list is a ruled page.** Rows are separated by the ruling (`border`), never by cards, and a
margin line (`margin`) runs down the left of the list on any viewport wide enough to spare it. A row
carries her words first, then who and where, then her Skills as chips; nothing about that order changes
between the Wall, Browse and her own profile.

Responsive behaviour is **structural**, not fluid: collapse the sidebar, change the column count at a
breakpoint, drop the margin line rather than shrink it. One spacing rhythm throughout, with more space
above a heading than below it — the heading belongs to the content that follows it.

## Elevation & Depth

Depth is carried by the second neutral layer and by rulings, not by shadows. `card` and `popover` sit
on `background`; `sidebar` is its own surface. Shadows mark things that genuinely float — popovers,
dialogs, toasts, and a stuck header over content passing beneath it — and nothing else. A shadow
carries an offset and a soft blur; a zero-offset halo is decoration.

**Overlays must escape their container.** An absolutely positioned dropdown inside an
`overflow: hidden` or `overflow: auto` ancestor gets clipped. Use `<dialog>`, the popover API,
`position: fixed`, or a portal.

## Motion

**One authored moment in the product**: the vocabulary strip on the landing drifts, slowly, and stops
under `prefers-reduced-motion`. Its keyframes live in `globals.css` as `--animate-drift` so a second
surface reaching for the same motion gets the same motion. Everything else answers a person's action —
a menu opening, a header earning its shadow, a confirmation arriving — in 150–250 ms with an
exponential ease-out, and product UI never orchestrates a page-load sequence: nobody wants to watch a
form arrive. `motion-policy` in `docs/policy/ux.md` is still `UNSET`, so honouring reduced motion is a
habit here rather than a requirement; the day it is set, this section is what it binds.

## Shapes

`--radius` is `0.5rem` and every other radius derives from it by multiplication, so re-theming the
corner language is a one-value change. Use the `rounded-sm/md/lg/xl` steps rather than arbitrary
values — an arbitrary radius is a token that escaped.

Non-disabled `button` and `[role="button"]` get `cursor: pointer` from a `@layer base` rule (the
preset was generated with `--pointer`). That is deliberate; do not re-add it per component.

**The parts of the page nobody draws still carry the palette.** The selection is ink on a light wash,
the caret is ink, the scrollbar thumb is a light ink, and links underline from the font with a small
offset. All of it is in `globals.css`'s base layer and none of it belongs in a component.

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
- Separate rows with the ruling and put the margin beside the list. That is what makes a list here
  look like this product's list.

**Don't**

- Don't hand-edit files under `src/components/`. Re-run the CLI.
- Don't use `dark:` colour overrides, and don't add a `.dark` block. There is one ground.
- Don't put the display face in labels, buttons, chips, or data.
- Don't paint a second cover. One region of solid ink per product.
- Don't add texture — paper grain, torn edges, a handwriting font. The notebook is structure, not
  costume.
- Don't reinvent standard affordances for flavour — novel form controls, non-standard modals.
- Don't reach for a modal first. Exhaust inline and progressive alternatives; a modal is usually the
  lazy answer to a layout problem.
- Don't orchestrate page-load sequences. Product UI loads into a task; nobody wants to watch it
  arrive.
