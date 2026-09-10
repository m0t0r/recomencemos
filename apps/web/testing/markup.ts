/**
 * Reading the HTML React sends, for what the accessibility tree does not report
 * (#261).
 *
 * The string comes from `renderToStaticMarkup` or `prerender`, never from the
 * rendered DOM — that is the line the lint gate draws. React writes every
 * attribute value double-quoted and escapes a `"` inside one, so a quoted value
 * is the whole value.
 */

/** Every `href`, `src` and `action` value in a string of HTML, in order. */
export function urlAttributesIn(html: string): string[] {
  return [...html.matchAll(/\b(?:href|src|action)="([^"]*)"/g)].map(([, url]) => url ?? "");
}
