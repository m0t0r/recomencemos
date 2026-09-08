/**
 * The text box's styling contract, and nothing else — `button-variants.tsx` for
 * the input, split out for the same shape of reason.
 *
 * **It exists so a native control can wear the registry's box.** `input.tsx`
 * imports `@base-ui/react/input`, and there is one control this design system
 * has no component for: a `<select>` that works with JavaScript unavailable. The
 * registry's `Select` is a Base UI widget whose trigger is a `<button>`, so it
 * opens nothing and submits nothing on the no-JavaScript path — which is the
 * path `/profiles` is built on. Before this split the only way to make that
 * `<select>` match the box beside it was to copy the class string, and the copy
 * had already lost `dark:bg-input/30`, the `aria-invalid` ring and the disabled
 * state.
 *
 * So the contract is declared once and both wear it. A change to the box moves
 * the `Input` and the `<select>` together, which is what "the design system is
 * the source of truth for presentational elements" has to mean when one of the
 * elements is a bare HTML tag.
 *
 * **`.tsx` despite holding no JSX**, because the package's `exports` map is
 * `"./components/*": "./src/components/*.tsx"` — the extension is the subpath's,
 * not this file's opinion.
 *
 * Taken verbatim from the registry's `input.tsx`; `input.tsx` now imports it
 * rather than restating it, so `shadcn add --overwrite` on that file is a
 * divergence to re-apply. See `packages/design-system/CLAUDE.md`.
 */

/** Height, border, radius, type scale, focus ring, invalid ring, disabled state. */
export const inputBox =
  "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-2.5 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40";

/** What only a `file` input needs, kept off every other control that wears the box. */
export const inputFileSlot =
  "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground";

/**
 * The box on a native `<select>`.
 *
 * `appearance-none` stops the platform drawing its own chrome inside a box that
 * already has one, and `select-chevron` — a utility in `styles/globals.css` —
 * draws the arrow back, so the control still says it opens a list. `pr-9` is the
 * room that arrow needs.
 *
 * **The arrow is a stylesheet utility rather than a Tailwind arbitrary value for
 * `background-image`, and that is a measurement rather than a preference.** A
 * data URI carries quotes, spaces and slashes, and Tailwind does not parse one:
 * the value it emitted was a literal ellipsis, which renders no chevron and, on
 * the next rebuild, fails outright as a module Turbopack cannot resolve. The
 * reason it is written down twice — here and beside the utility — is that
 * Tailwind scans comments too, so the note that names the broken class is what
 * generates it. See `select-chevron` in `styles/globals.css`.
 */
export const selectBox = `${inputBox} select-chevron appearance-none pr-9`;
