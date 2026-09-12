/**
 * The arithmetic half of DD6 step 1.
 *
 * **What is testable here and what is not, stated rather than implied.**
 * happy-dom has no 2D canvas context and no `createImageBitmap`, so the drawing
 * and the encoding cannot run in this environment — they verify at seam 3
 * against a real browser, which is where a canvas actually exists. What runs
 * here is {@link fit}, which is the whole of the sizing decision and the part
 * that is wrong in ways a screenshot would not show: an upscaled thumbnail, a
 * short edge rounded to zero, a portrait bounded on the wrong axis.
 *
 * Exporting `fit` for this is the shape `codebase-design` argues for — the seam
 * goes where the logic is, not where the boundary happens to be.
 */

import { MAX_LONG_EDGE_PX } from "@repo/storage/limits";
import { fit } from "./downscale";

describe("fit", () => {
  it("leaves a picture already inside the bound alone", () => {
    expect(fit(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fit(MAX_LONG_EDGE_PX, 900)).toEqual({ width: MAX_LONG_EDGE_PX, height: 900 });
  });

  /**
   * **Never upscales**, which matters on this product's primary surface: a photo
   * off a cheap front camera is often smaller than the bound, and enlarging it
   * would spend her mobile data to make it blurrier.
   */
  it("never enlarges a small picture to reach the bound", () => {
    expect(fit(240, 180)).toEqual({ width: 240, height: 180 });
  });

  /**
   * The bound is on the **long** edge whichever edge that is. Bounding width
   * alone would leave a portrait photo — which on a phone is most of them — at
   * four times the intended area, and the ceiling is what a portrait would then
   * fail.
   */
  it("bounds the long edge in either orientation", () => {
    const landscape = fit(4000, 2000);
    const portrait = fit(2000, 4000);

    expect(landscape.width).toBe(MAX_LONG_EDGE_PX);
    expect(portrait.height).toBe(MAX_LONG_EDGE_PX);
  });

  it("keeps the aspect ratio", () => {
    const { width, height } = fit(4000, 3000);

    expect(width / height).toBeCloseTo(4000 / 3000, 2);
  });

  it("keeps a square square", () => {
    expect(fit(3000, 3000)).toEqual({ width: MAX_LONG_EDGE_PX, height: MAX_LONG_EDGE_PX });
  });

  /**
   * A panorama's short edge rounds below one, and a canvas of width 0 encodes to
   * nothing at all — silently, with no error to notice. The floor is what stops
   * a valid picture becoming an empty upload.
   */
  it("never rounds an edge to zero", () => {
    const { width, height } = fit(40_000, 10);

    expect(width).toBe(MAX_LONG_EDGE_PX);
    expect(height).toBeGreaterThanOrEqual(1);
  });

  it("returns whole pixels, because a canvas has no fractional ones", () => {
    const { width, height } = fit(3333, 2777);

    expect(Number.isInteger(width)).toBe(true);
    expect(Number.isInteger(height)).toBe(true);
  });
});
