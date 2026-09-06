// @vitest-environment node

/**
 * The design system's values exist in four files, and this is what stops them
 * disagreeing. Two axes: **colour**, below, and the **type ramp** at the end of
 * the file — the same argument, and both were added for the same reason.
 *
 * `packages/design-system/src/styles/globals.css` is the **source**: `oklch()`
 * custom properties over a private `--brand-*` ramp. Three files copy it, and
 * every copy is necessary rather than sloppy:
 *
 * - `DESIGN.md`'s frontmatter, in `oklch()`, because that is what the impeccable
 *   design hook reads — it does not parse a stylesheet.
 * - `packages/notifications/src/palette.ts`, in **hex**, because an inbox never
 *   sees `globals.css` and email clients support neither `oklch()` nor custom
 *   properties. There is no build step that could derive it at render time.
 * - `apps/web/app/global-error.tsx`, in **hex**, because that boundary replaces
 *   the root layout and no stylesheet is mounted when it renders.
 *
 * So the copies cannot be removed. What was missing is that nothing checked
 * them: `palette.ts` carried the drift as *"a real maintenance cost with a
 * manual mitigation — when `DESIGN.md`'s colours change, this file is
 * reviewed"*, which is a discipline rather than a mechanism, and the kind that
 * holds until the one time it matters.
 *
 * **It lives in `apps/web` for the reason `domain-boundary.test.ts` and
 * `notifications-boundary.test.ts` do**: it is a claim *between* packages, and
 * `apps/web` is the workspace that depends on both. `@repo/notifications` could
 * not host it — it may not depend on the design system, and its own palette is
 * behind a `#` specifier that `notifications-boundary.test.ts` separately proves
 * is unreachable from outside.
 *
 * **The files are read as text rather than imported**, which is not a shortcut.
 * `globals.css` is a stylesheet, `DESIGN.md` is frontmatter, and `palette.ts` is
 * withheld by its package's `exports` map. Reading the bytes is the only access
 * all three share, and it is also what lets the assertions cover the **doc
 * comments** — the `oklch()` value written above each hex is a claim a reader
 * trusts, and a stale one misleads exactly as badly as a stale hex.
 *
 * The type half exists because the impeccable design hook flagged a 24px heading
 * in an email template as off-ramp and was **right**: `DESIGN.md` named three
 * type steps while its own prose asserted a ratio ladder with more. The fix was
 * to enumerate the ladder rather than suppress the finding, and this is what
 * keeps the two surfaces that cannot read the stylesheet on it.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "..", "..");

const read = (path: string) => readFileSync(join(REPO_ROOT, path), "utf8");

/**
 * oklch → OKLab → linear sRGB → gamma-encoded sRGB, rounded to 8 bits.
 *
 * Written out rather than taken from a colour library on purpose: the whole
 * value of this file is that it is an *independent* derivation of the numbers in
 * `palette.ts`. A dependency shared with whatever produced them would assert
 * that two copies of one implementation agree.
 *
 * The matrices are Björn Ottosson's published OKLab constants. The check that
 * they are transcribed correctly is the suite itself — seven committed hex
 * values reproduce exactly, and a typo in any coefficient would break them.
 */
function oklchToHex(l: number, c: number, hDegrees: number): string {
  const h = (hDegrees * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);

  const lRoot = l + 0.3963377774 * a + 0.2158037573 * b;
  const mRoot = l - 0.1055613458 * a - 0.0638541728 * b;
  const sRoot = l - 0.0894841775 * a - 1.291485548 * b;

  const long = lRoot ** 3;
  const medium = mRoot ** 3;
  const short = sRoot ** 3;

  const linear = [
    4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
    -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
    -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short,
  ];

  return `#${linear
    .map((channel) => {
      const encoded = channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055;
      return Math.round(Math.min(1, Math.max(0, encoded)) * 255)
        .toString(16)
        .padStart(2, "0");
    })
    .join("")}`;
}

/** WCAG 2.2 relative luminance. Its own sRGB linearization, which is not the one above. */
function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map(
    (offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255,
  );
  const [r, g, b] = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].toSorted(
    (a, b) => b - a,
  ) as [number, number];

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * The `:root` block of `globals.css`, with `var(--brand-N)` resolved.
 *
 * One level of indirection is enough because the stylesheet's own rule is that
 * the ramp is private and the semantic layer is the seam — `--primary` is
 * `var(--brand-700)` and nothing points at a semantic token in turn. A second
 * level appearing would surface here as an unresolved value rather than silently.
 */
function semanticTokens(): ReadonlyMap<string, string> {
  const css = read("packages/design-system/src/styles/globals.css");
  const root = css.slice(css.indexOf(":root {"), css.indexOf("\n}", css.indexOf(":root {")));

  const declared = new Map<string, string>();
  for (const [, name, value] of root.matchAll(/^\s*--([\w-]+):\s*([^;]+);/gm)) {
    declared.set(name as string, (value as string).trim());
  }

  const resolved = new Map<string, string>();
  for (const [name, value] of declared) {
    const reference = /^var\(--([\w-]+)\)$/.exec(value);
    resolved.set(name, reference ? (declared.get(reference[1] as string) ?? value) : value);
  }

  return resolved;
}

/** `oklch(L C H)` → its three numbers. Returns `undefined` for anything else. */
function parseOklch(value: string): readonly [number, number, number] | undefined {
  const match = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(value.trim());
  if (!match) return undefined;

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

describe("DESIGN.md's frontmatter against the stylesheet", () => {
  const tokens = semanticTokens();
  const frontmatter = read("DESIGN.md").split("---")[1] ?? "";

  const declared = [...frontmatter.matchAll(/^\s{2}([\w-]+):\s*"(oklch\([^"]+\))"$/gm)].map(
    ([, name, value]) => [name as string, value as string] as const,
  );

  // The list is read rather than hardcoded, so a colour added to DESIGN.md is
  // covered without editing this file — and a colour that exists there and
  // nowhere in the stylesheet fails the next case rather than being skipped.
  it("declares colours at all, so an empty parse cannot pass vacuously", () => {
    expect(declared.length).toBeGreaterThanOrEqual(20);
  });

  it.each(declared)("%s matches globals.css", (name, value) => {
    expect(tokens.get(name), `--${name} is not declared in globals.css`).toBe(value);
  });
});

/** `mutedForeground` in the palette is `--muted-foreground` in the stylesheet. */
const kebab = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

describe("the email palette against the stylesheet", () => {
  const tokens = semanticTokens();
  const source = read("packages/notifications/src/palette.ts");

  /**
   * Each entry is a doc comment claiming an `oklch()` source, then a hex value.
   * Both halves are captured because both are claims, and they fail differently:
   * a wrong hex renders wrong in an inbox, a wrong comment misleads whoever next
   * updates the palette by hand.
   */
  const entries = [
    ...source.matchAll(/\/\*\* `(oklch\([^)]+\))` \*\/\s*\n\s*(\w+): "(#[0-9a-f]{6})",/g),
  ].map(([, claimed, name, hex]) => ({
    name: name as string,
    claimed: claimed as string,
    hex: hex as string,
  }));

  it("parses every entry, so a reformat cannot silently empty this suite", () => {
    // `palette.ts` copies only the tokens the templates use; eight is that set.
    // If it grows, this number is raised deliberately rather than drifting.
    expect(entries).toHaveLength(8);
  });

  it.each(entries)("$name's comment names the token's real value", ({ name, claimed }) => {
    expect(tokens.get(kebab(name)), `--${kebab(name)} is not declared in globals.css`).toBe(
      claimed,
    );
  });

  it.each(entries)("$name's hex is that value converted", ({ claimed, hex }) => {
    const oklch = parseOklch(claimed);
    expect(oklch, `${claimed} is not a plain oklch() triple`).toBeDefined();

    const [l, c, h] = oklch as readonly [number, number, number];
    expect(oklchToHex(l, c, h)).toBe(hex);
  });
});

/**
 * The root error boundary, which is the **fourth** copy and the easiest to
 * forget.
 *
 * `app/global-error.tsx` replaces the root layout, so no stylesheet is mounted
 * and it cannot reach the token layer at all — the same predicament as email,
 * reached from the other direction. It therefore carries six literal hex values,
 * and until this case existed they were Tailwind's zinc defaults: a palette this
 * product does not ship, on the one screen a visitor sees when everything else
 * has already failed.
 *
 * Each declaration names the token it came from in a trailing comment, and this
 * reads that comment rather than a hardcoded list here — so the assertion is
 * against the file's own claim about itself.
 */
describe("the root error boundary against the stylesheet", () => {
  const tokens = semanticTokens();
  const source = read("apps/web/app/global-error.tsx");

  const declared = [
    ...source.matchAll(/--[\w-]+:\s*(#[0-9a-f]{6});\s*\/\* --([\w-]+)\s+(oklch\([^)]+\))\s*\*\//g),
  ].map(([, hex, token, claimed]) => ({
    hex: hex as string,
    token: token as string,
    claimed: claimed as string,
  }));

  it("parses all six, so a reformat cannot silently empty this suite", () => {
    expect(declared).toHaveLength(6);
  });

  it.each(declared)(
    "--$token is $hex, converted from the stylesheet",
    ({ hex, token, claimed }) => {
      expect(tokens.get(token), `--${token} is not declared in globals.css`).toBe(claimed);

      const oklch = parseOklch(claimed);
      expect(oklch, `${claimed} is not a plain oklch() triple`).toBeDefined();

      const [l, c, h] = oklch as readonly [number, number, number];
      expect(oklchToHex(l, c, h)).toBe(hex);
    },
  );

  /**
   * The product is light-only and `globals.css` binds Tailwind's `dark` variant
   * to a class nothing sets, precisely so the OS cannot decide it. This boundary
   * had one anyway, which made the failure screen the only dark surface in the
   * product.
   *
   * **Scoped to the `styles` template literal, not the whole file**, and that is
   * not fussiness: the first draft asserted over the source and went red on the
   * doc comment above this module explaining why the block was removed. A
   * prose-versus-code false positive is the same failure the repo's own gates
   * are written to avoid.
   */
  it("declares no dark scheme, because the product has none", () => {
    const start = source.indexOf("const styles = `");
    const stylesheet = source.slice(start, source.indexOf("`;", start));

    expect(start, "the styles template literal moved or was renamed").toBeGreaterThan(-1);
    expect(stylesheet).not.toContain("prefers-color-scheme");
    expect(stylesheet).toContain("color-scheme: light;");
  });
});

/**
 * The six pairs `palette.ts` tabulates, re-measured.
 *
 * The table in that file is the reason a template author does not re-measure,
 * so a stale number there is worse than no number. `mutedForeground` on `muted`
 * is the tight one — the footer, at 5.45 — and it is the row that would go red
 * first if the ramp moved.
 */
describe("the contrast table in palette.ts", () => {
  const hexes = new Map(
    [...read("packages/notifications/src/palette.ts").matchAll(/(\w+): "(#[0-9a-f]{6})",/g)].map(
      ([, name, hex]) => [name as string, hex as string],
    ),
  );

  const documented = [
    ["foreground", "background", 16.49],
    ["foreground", "muted", 15.34],
    ["primary", "background", 7.22],
    ["primaryForeground", "primary", 7.42],
    ["mutedForeground", "background", 5.86],
    ["mutedForeground", "muted", 5.45],
  ] as const;

  it.each(documented)("%s on %s is the documented %s", (fg, bg, expected) => {
    const foreground = hexes.get(fg);
    const background = hexes.get(bg);
    expect(foreground, `${fg} missing from the palette`).toBeDefined();
    expect(background, `${bg} missing from the palette`).toBeDefined();

    const measured = contrastRatio(foreground as string, background as string);

    expect(measured).toBeCloseTo(expected, 1);
    expect(measured, "every documented pair must clear WCAG 2.2 AA").toBeGreaterThanOrEqual(4.5);
  });
});

/**
 * Every semantic pair in the stylesheet, under WCAG 2.2 AA — the token layer's
 * own guarantee, asserted where it is declared rather than remembered.
 *
 * `globals.css` used to carry a note saying its lightness ramp had been audited
 * in another repository by a script that was never copied here, so any change
 * to an `L` value was unverified until somebody noticed. This is that audit,
 * run on every `pnpm test`: each pair is resolved from the `:root` block, so a
 * new value is measured before it is reviewed. Text pairs clear 4.5:1; the
 * non-text pairs — an input's boundary, a chart mark, the margin line — clear
 * SC 1.4.11's 3:1.
 *
 * The pairs are the ones components actually paint. `border` on `background`
 * is deliberately absent: a ruling identifies nothing, so it may be faint, and
 * that is written beside `--border` in the stylesheet.
 */
describe("the stylesheet's semantic pairs against WCAG 2.2 AA", () => {
  const tokens = semanticTokens();

  const text = [
    ["foreground", "background"],
    ["foreground", "muted"],
    ["foreground", "secondary"],
    ["card-foreground", "card"],
    ["popover-foreground", "popover"],
    ["secondary-foreground", "secondary"],
    ["accent-foreground", "accent"],
    ["sidebar-accent-foreground", "sidebar-accent"],
    ["muted-foreground", "background"],
    ["muted-foreground", "muted"],
    ["muted-foreground", "secondary"],
    ["primary", "background"],
    ["primary-foreground", "primary"],
    ["ink-foreground", "ink"],
    ["ink-muted", "ink"],
    ["success", "background"],
    ["success", "success-surface"],
    ["warning", "background"],
    ["warning", "warning-surface"],
    ["destructive", "background"],
    ["destructive", "destructive-surface"],
    ["destructive-foreground", "destructive"],
    ["sidebar-foreground", "sidebar"],
    ["sidebar-primary-foreground", "sidebar-primary"],
  ] as const;

  const nonText = [
    ["input", "background"],
    ["ring", "background"],
    ["chart-1", "background"],
    ["chart-2", "background"],
    ["chart-3", "background"],
    ["chart-4", "background"],
    ["chart-5", "background"],
  ] as const;

  const hexOf = (name: string): string => {
    const value = tokens.get(name);
    expect(value, `--${name} is not declared in globals.css`).toBeDefined();
    const oklch = parseOklch(value as string);
    expect(oklch, `--${name} is ${value}, not a plain oklch() triple`).toBeDefined();
    const [l, c, h] = oklch as readonly [number, number, number];
    return oklchToHex(l, c, h);
  };

  it.each(text)("%s on %s clears 4.5:1", (fg, bg) => {
    expect(contrastRatio(hexOf(fg), hexOf(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(nonText)("%s on %s clears 3:1", (fg, bg) => {
    expect(contrastRatio(hexOf(fg), hexOf(bg))).toBeGreaterThanOrEqual(3);
  });
});

/**
 * The type ramp, on the two surfaces that cannot read the stylesheet.
 *
 * The same argument as the palette, one axis over. `DESIGN.md` states the scale;
 * the email templates and the root error boundary each hold literal sizes,
 * because email cannot resolve `rem` (`pixelBasedPreset` forces px) and the
 * boundary has no stylesheet mounted at all.
 *
 * **This case exists because the ramp had a hole.** The frontmatter named three
 * roles — `display`, `body`, `mono` — so the email `<h1>` at 24px was off-ramp,
 * and the impeccable design hook said so. The intermediate steps were always
 * implied by the prose's ratio rule; `typography.scale` enumerates them, and
 * this asserts the templates stay on the enumeration rather than beside it.
 */
describe("literal font sizes against DESIGN.md's ramp", () => {
  const frontmatter = read("DESIGN.md").split("---")[1] ?? "";

  /**
   * Every size in the frontmatter, in px — the `scale` ladder plus each named
   * role's `fontSize`, unioned exactly the way the design hook unions them, so
   * this and the hook cannot disagree about what "on the ramp" means.
   */
  // Sliced to the `typography:` block first. Without that, `rounded` and
  // `spacing` — which are also bare rem values one indent down — join the ramp
  // and 0.25rem silently becomes a legal font size.
  const typography = frontmatter.slice(
    frontmatter.indexOf("\ntypography:"),
    frontmatter.indexOf("\nrounded:"),
  );

  const ramp = new Set(
    [...typography.matchAll(/^\s+(?:\w[\w-]*|fontSize):\s*"([\d.]+)(rem|px)"$/gm)].map(
      ([, size, unit]) => Number(size) * (unit === "rem" ? 16 : 1),
    ),
  );

  it("enumerates a ladder rather than three roles", () => {
    // 14 · 16 · 18 · 20 · 24 · 28 · 32 · 36. Fewer than eight means `scale` was
    // dropped and the hole this suite closed has reopened.
    expect([...ramp].toSorted((a, b) => a - b)).toEqual([14, 16, 18, 20, 24, 28, 32, 36]);
  });

  /**
   * Read as text for the reason the palette cases are: these are literals inside
   * a Tailwind class string and a template literal, neither of which is a value
   * any import would expose.
   */
  const surfaces = [
    "packages/notifications/src/templates/base.tsx",
    "packages/notifications/src/templates/magic-link.tsx",
    "apps/web/app/global-error.tsx",
  ];

  const sizes = surfaces.flatMap((path) => {
    const source = read(path);

    return [
      ...[...source.matchAll(/\btext-\[([\d.]+)px\]/g)].map(([, px]) => ({
        path,
        written: `${px}px`,
        px: Number(px),
      })),
      ...[...source.matchAll(/font-size:\s*([\d.]+)(rem|px)\s*;/g)].map(([, size, unit]) => ({
        path,
        written: `${size}${unit}`,
        px: Number(size) * (unit === "rem" ? 16 : 1),
      })),
    ];
  });

  it("finds sizes on every surface, so a rename cannot empty this suite", () => {
    for (const path of surfaces) {
      expect(
        sizes.some((size) => size.path === path),
        `no font size found in ${path}`,
      ).toBe(true);
    }
  });

  it.each(sizes)("$path uses $written, which is on the ramp", ({ px, written }) => {
    expect(ramp.has(px), `${written} (${px}px) is not a step in DESIGN.md's typography.scale`).toBe(
      true,
    );
  });
});

/**
 * The corner language, on the one surface that cannot read the stylesheet.
 *
 * **A third axis, added for the reason the second was: something drifted and
 * nothing caught it.** The root boundary carried `0.25rem` and `0.375rem` —
 * Tailwind's `rounded-sm` and `rounded-md`, not this product's `0.3rem` and
 * `0.4rem` — which is exactly the class of mistake the zinc palette was, one
 * property over. The impeccable design hook reported one of the two and not the
 * other, because it reports what it happens to scan; a suite reports every
 * literal in the file.
 *
 * The email templates are deliberately **not** included. `pixelBasedPreset`
 * renders their radii in px through Tailwind class names rather than as literal
 * `border-radius` declarations, so there is nothing here to read — a case
 * asserting over an empty set would pass while checking nothing, which is the
 * failure the `finds sizes on every surface` case above exists to prevent.
 */
describe("literal radii against DESIGN.md's rounded scale", () => {
  const frontmatter = read("DESIGN.md").split("---")[1] ?? "";

  // Sliced to the `rounded:` block, exactly as the type ramp slices to
  // `typography:` — the neighbouring blocks are bare rem values one indent down
  // too, and unsliced they would make any spacing step a legal radius.
  const rounded = frontmatter.slice(
    frontmatter.indexOf("\nrounded:"),
    frontmatter.indexOf("\nspacing:"),
  );

  const scale = new Set(
    [...rounded.matchAll(/^\s+\w[\w-]*:\s*"([\d.]+)rem"$/gm)].map(([, size]) => Number(size)),
  );

  it("enumerates the four steps rather than none", () => {
    expect([...scale].toSorted((a, b) => a - b)).toEqual([0.3, 0.4, 0.5, 0.7]);
  });

  const source = read("apps/web/app/global-error.tsx");
  const radii = [...source.matchAll(/border-radius:\s*([\d.]+)rem\s*;/g)].map(([, value]) => ({
    written: `${value}rem`,
    rem: Number(value),
  }));

  it("finds radii at all, so a rewrite cannot silently empty this suite", () => {
    expect(radii.length).toBeGreaterThanOrEqual(2);
  });

  it.each(radii)("$written is a step in the rounded scale", ({ rem, written }) => {
    expect(scale.has(rem), `${written} is not a step in DESIGN.md's rounded scale`).toBe(true);
  });
});
