/**
 * `DESIGN.md`'s palette, in hex, for the one rendering target that cannot read it.
 *
 * **This is a copy, and saying so is the honest part.** `DESIGN.md` states the
 * visual system as `oklch()` values delivered through CSS custom properties;
 * email clients support neither. There is no build step that could derive this
 * file — `globals.css` is a stylesheet a browser resolves, and an inbox never
 * sees it.
 *
 * **The mitigation is no longer manual, and that is the part worth knowing.**
 * This file used to say *when `DESIGN.md`'s colours change, this file is
 * reviewed* (DD14), which is a discipline rather than a mechanism.
 * `apps/web/design-tokens.test.ts` now re-derives every hex below from
 * `globals.css` — including the `oklch()` written in each doc comment, because a
 * stale comment misleads whoever next updates this by hand — and re-measures the
 * six contrast pairs in the table. Drift goes red. Do not restore the manual note.
 *
 * Only the eight tokens the templates actually use are copied. Copying the rest
 * would be eleven more values to keep in step for no reader.
 *
 * The conversion is oklch → OKLab → linear sRGB → gamma-encoded sRGB, rounded to
 * 8 bits per channel. Every ratio below is computed from *these* hex values
 * rather than from the `oklch()` source, because these are what an inbox
 * renders.
 *
 * | Pair                              | Ratio | WCAG 2.2 AA (4.5:1) |
 * | --------------------------------- | ----- | ------------------- |
 * | `foreground` on `background`      | 16.49 | pass                |
 * | `foreground` on `muted`           | 15.34 | pass                |
 * | `primary` on `background`         |  7.22 | pass                |
 * | `primaryForeground` on `primary`  |  7.42 | pass                |
 * | `mutedForeground` on `background` |  5.86 | pass                |
 * | `mutedForeground` on `muted`      |  5.45 | pass                |
 *
 * `mutedForeground` on `muted` is the tight one at 5.45. It is the footer, and a
 * template that puts smaller or lighter text there has spent the margin — which
 * is why the number is written down rather than left to be re-measured.
 */
export const palette = {
  /** `oklch(0.99 0.004 250)` */
  background: "#fafcfe",
  /** `oklch(0.23 0.035 268)` */
  foreground: "#161c2d",
  /** `oklch(0.46 0.16 268)` */
  primary: "#334db0",
  /** `oklch(1 0 0)` */
  primaryForeground: "#ffffff",
  /** `oklch(0.95 0.02 255)` */
  secondary: "#e6effc",
  /** `oklch(0.965 0.01 250)` */
  muted: "#eff4fa",
  /** `oklch(0.5 0.04 265)` */
  mutedForeground: "#58637b",
  /** `oklch(0.895 0.03 240)` */
  border: "#cbe0ef",
} as const;

/**
 * `DESIGN.md`'s body stack, minus the `rem`. Email clients do not resolve `rem`,
 * which is also why every template sets `pixelBasedPreset`.
 */
export const FONT_STACK = "Inter, ui-sans-serif, system-ui, -apple-system, Arial, sans-serif";
