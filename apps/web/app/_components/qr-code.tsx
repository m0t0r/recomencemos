/**
 * The enrolment QR, rendered server-side as SVG.
 *
 * **Hand-rolled because the registry has none.** `REVIEW.md`'s registry-equivalents
 * pass asks that the shadcn registry be read before writing a presentational
 * element; it was (`shadcn search @shadcn -q "qr"` returns two unrelated items), so
 * this is the case that rule leaves open. `@shadcn/input-otp` beside it *is* from
 * the registry, which is the other half of the same check.
 *
 * **It renders one `<path>`, and the reason is DD7's rule.** Every QR library's
 * convenient API returns an SVG *string*, which reaches the DOM only through
 * `dangerouslySetInnerHTML` — and DD7's third clause is "no `dangerouslySetInnerHTML`,
 * no `<Markdown>` over user text, and no `href` built from user text, in the app or
 * in a template". `uqr` hands back a boolean matrix instead, so the modules become
 * ordinary JSX and the rule is not approached, let alone argued with.
 *
 * **No client JavaScript and no image host.** This is a Server Component: the
 * matrix is computed during the render and the markup is what streams. The
 * alternative most guides reach for — an `<img>` at a Google Charts URL — would
 * send the Admin's **TOTP secret to a third party** as a query string, which is
 * the single worst thing this screen could do and which NFR18 and DD16's boundary
 * list both forbid.
 *
 * **The `d` attribute is not a URL.** DD7's clause about attributes built from
 * user text is about URL-valued ones; this is path geometry computed from a
 * server-minted `otpauth://` URI, and no value a person typed reaches it.
 */

import { encode } from "uqr";

export interface QrCodeProps {
  /** Server-minted, always. Never built from anything a person typed. */
  readonly value: string;
  /** What a screen reader announces. The surface owns the Spanish (ADR-0012). */
  readonly label: string;
}

export function QrCode({ value, label }: QrCodeProps) {
  const { size, data } = encode(value);

  /**
   * One `<path>` rather than one `<rect>` per module: a 35×35 code is ~600 dark
   * modules, and 600 elements is a measurable amount of markup to stream and of
   * DOM to build for a picture of a square. The path is the same geometry in a
   * few hundred bytes.
   */
  let d = "";
  for (const [y, row] of data.entries()) {
    for (const [x, dark] of row.entries()) {
      if (dark) d += `M${x} ${y}h1v1h-1z`;
    }
  }

  return (
    <svg
      /*
        The rule reads `role="img"` as an element that should have been an
        `<img>`, and here it is the opposite: this **is** the accessible pattern
        for an inline SVG — `<svg>` has no implicit role that assistive technology
        can rely on, so `role="img"` plus a name is what makes it announceable at
        all. Replacing it with an `<img>` would mean a `src`, which means either a
        data URI or a third party, and the second would send the Admin's TOTP
        secret off this machine.
      */
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      /**
       * **Explicit colours, not tokens.** Every other surface in this product uses
       * semantic tokens and `DESIGN.md` is emphatic about it — this is the one
       * place that would be a bug rather than a deviation. A QR scanner needs dark
       * modules on a light ground at a real contrast ratio; a token that a future
       * theme resolves to something softer produces a code that renders perfectly
       * and does not scan, on the one screen with no second chance.
       */
      className="h-auto w-full max-w-56 rounded-md bg-white p-3"
      shapeRendering="crispEdges"
    >
      <path d={d} fill="#000000" />
    </svg>
  );
}
