import type { Metadata } from "next";
import { sectionPageTitle } from "./messages";

/**
 * What every section route exports as its `metadata`.
 *
 * **`robots` is the `<meta>` half of NFR8 and is not optional per page.** The
 * `X-Robots-Tag` header arrives from `next.config.ts` for everything under
 * `/admin`, and NFR8 asks for both halves — so this exists to make five files
 * state it once each without five chances to forget.
 */
export function sectionMetadata(label: string): Metadata {
  return {
    title: sectionPageTitle(label),
    robots: { index: false, follow: false },
  };
}
