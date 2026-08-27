/**
 * `DESIGN.md`'s palette, in hex, for the one rendering target that cannot read it.
 *
 * **This is a copy, and saying so is the honest part.** `DESIGN.md` states the
 * visual system as `oklch()` values delivered through CSS custom properties;
 * email clients support neither. There is no build step that could derive this
 * file — `globals.css` is a stylesheet a browser resolves, and an inbox never
 * sees it — so drift between the two is a real maintenance cost with a manual
 * mitigation: **when `DESIGN.md`'s colours change, this file is reviewed** (DD14).
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
 * | `foreground` on `background`      | 18.04 | pass                |
 * | `foreground` on `muted`           | 16.52 | pass                |
 * | `primary` on `background`         |  6.51 | pass                |
 * | `primaryForeground` on `primary`  |  6.51 | pass                |
 * | `mutedForeground` on `background` |  5.04 | pass                |
 * | `mutedForeground` on `muted`      |  4.62 | pass                |
 *
 * `mutedForeground` on `muted` is the tight one at 4.62. It is the footer, and a
 * template that puts smaller or lighter text there has spent the margin — which
 * is why the number is written down rather than left to be re-measured.
 */
export const palette = {
  /** `oklch(1 0 0)` */
  background: "#ffffff",
  /** `oklch(0.2 0.012 248)` */
  foreground: "#12171b",
  /** `oklch(0.48 0.122 248)` */
  primary: "#10619e",
  /** `oklch(1 0 0)` */
  primaryForeground: "#ffffff",
  /** `oklch(0.955 0.008 248)` */
  secondary: "#ecf1f5",
  /** `oklch(0.97 0.004 248)` */
  muted: "#f3f5f8",
  /** `oklch(0.54 0.02 248)` */
  mutedForeground: "#66707a",
  /** `oklch(0.915 0.006 248)` */
  border: "#e0e3e7",
} as const;

/**
 * `DESIGN.md`'s body stack, minus the `rem`. Email clients do not resolve `rem`,
 * which is also why every template sets `pixelBasedPreset`.
 */
export const FONT_STACK = "Inter, ui-sans-serif, system-ui, -apple-system, Arial, sans-serif";
