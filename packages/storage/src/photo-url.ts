/**
 * The URL an approved photo is read through — the delivery half of DD6, which
 * is what NFR3's image clause actually turns on.
 *
 * **Isomorphic, and it has to be.** `next/image`'s custom loader runs in the
 * browser as well as on the server, so this module carries no `browser`
 * condition and imports nothing but `#limits`. There is no credential here and
 * nothing to sign: a public object is public, and the transformation is a path
 * prefix rather than an authorization.
 *
 * **Why a transformation URL rather than the object itself.** DD6:
 * _"One ~1600 px image served into a Wall grid on a 4×-throttled mid-range
 * Android is how LCP ≤ 2.5 s gets missed; photos are the dominant bytes on that
 * page."_ So the width is named in the URL and the format is negotiated, and
 * both happen at Cloudflare's edge — never on the Fly machine, whose CPU and
 * memory DD7 already names as the saturating resource.
 *
 * **The budget is why {@link PUBLIC_WIDTHS} is three values and not a free
 * parameter.** Cloudflare Images' free plan allows 5,000 unique transformations
 * a month against images stored outside Images, and a transformation is cached
 * after its first request — so the budget is spent by new (image × variant)
 * pairs rather than by traffic. Three widths is ~1,600 new profiles a month; a
 * loader that passed `next/image`'s raw `width` through would mint a variant per
 * device pixel ratio per breakpoint and exhaust it in an afternoon.
 */

import { isPublicKey } from "#key-shapes";
import { PUBLIC_WIDTHS } from "#limits";

/**
 * Re-exported here, on the subpath that has no server-only guard.
 *
 * **`#config` holds no credential and touches nothing** — it reads an
 * environment record and returns strings, exactly as `@repo/domain`'s own
 * `config.ts` does. What is server-only in this package is `#client` and
 * `#photos`, which construct an S3 client and sign with the secret; those carry
 * `assertServerOnly` and the `browser` condition, and neither is reachable from
 * here.
 *
 * The reason this re-export exists is a measured one rather than a tidiness
 * one: `@repo/domain/profiles` resolves a photo URL, `apps/web` imports that
 * module from a path a test renders under happy-dom, and a static import of
 * `@repo/storage/photos` made the runtime backstop throw across a whole test
 * file. Importing the two readers from here instead keeps the store's client
 * out of that graph entirely — which is what the guard was telling us.
 */
export { publicBase, transformationsEnabled } from "#config";

/**
 * The widest of the three, for a caller that has no width to offer.
 *
 * Deliberately not the narrowest: this is what `/my-profile` and the public card
 * render, where the photo is the largest thing on the screen.
 */
export const DEFAULT_WIDTH = PUBLIC_WIDTHS[PUBLIC_WIDTHS.length - 1] as number;

/**
 * The narrowest width in {@link PUBLIC_WIDTHS} that still covers what was asked
 * for.
 *
 * **Snapping rather than passing through is the whole budget mechanism.** A
 * request for 200 px on a 2× screen is 400 device pixels and is served the
 * 384 px variant, which is inside NFR3's _"no Wall card requests an image more
 * than 2× its rendered CSS width"_ and mints no new pair. Anything above the
 * widest is clamped to it — the stored object is 1600 px on its long edge and
 * asking the edge to upscale would buy nothing but a variant.
 */
export function snapWidth(requested: number): number {
  return PUBLIC_WIDTHS.find((width) => width >= requested) ?? DEFAULT_WIDTH;
}

export interface PhotoUrlOptions {
  /** The public key from the row. Never a quarantine key — see the note below. */
  readonly key: string;
  /** The origin the public prefix is served from, or `null` where none is configured. */
  readonly base: string | null;
  /**
   * Whether the origin above is a Cloudflare zone with image transformations
   * **explicitly enabled** — DD6's first precondition, and a dashboard step
   * rather than a code change (runbook §3).
   *
   * **A declared flag rather than something inferred from the origin**, because
   * inferring it is exactly the heuristic
   * [ADR-0006](../../../docs/adr/0006-name-the-exposure-rather-than-ship-a-heuristic.md)
   * refuses: no pattern distinguishes a zone with transformations on from one
   * with them off, and guessing wrong in one direction serves a 404 to every
   * visitor while guessing wrong in the other quietly serves 1600 px images
   * into a phone grid and misses NFR3. DD6 already frames it as a state to be
   * in — _"photos serve at full size until it is done"_ — so it is a state this
   * reader is told about.
   */
  readonly transformations: boolean;
  /** What the slot needs, in CSS pixels × the device pixel ratio. */
  readonly width?: number;
}

/**
 * Where to fetch an approved photo, or `null`.
 *
 * **`null` where there is no configured origin**, because runbook §3's zone step
 * is a dashboard action a human takes and DD6 says photos _"serve at full size
 * until it is done"_. A caller that gets `null` renders the initial, which is a
 * state every surface already has — so an unconfigured zone degrades to the
 * design's own fallback rather than to a broken image.
 *
 * **It refuses a quarantine key by shape**, and that refusal is load-bearing
 * rather than defensive. This function's output is a public URL; handed a
 * quarantine key it would publish exactly the object NFR6 counts. The projection
 * layer already gates on `photoState === "approved"`, and this is the second
 * lock on the same door — the one that does not depend on a caller having read
 * the right column.
 */
export function photoUrl({ key, base, transformations, width }: PhotoUrlOptions): string | null {
  if (!base) return null;

  if (!isPublicKey(key)) {
    throw new Error(
      "photoUrl was given a key that is not a public one. A quarantined object has not been " +
        "reviewed, and a public URL for one would make an unreviewed photo reachable by anyone " +
        "who has the address. The row's photoState is what decides whether there is a URL.",
    );
  }

  // DD6's own fallback, and the state a deploy is in until runbook §3 has been
  // worked: the object itself, at the one size it was stored at. It is correct
  // and it is slow, which is the honest pair — NFR3's image clause is missed
  // rather than silently satisfied, and the go-live checklist has a line for it.
  if (!transformations) return `${base}/${key}`;

  return `${base}/cdn-cgi/image/width=${snapWidth(width ?? DEFAULT_WIDTH)},format=auto,fit=cover/${key}`;
}
