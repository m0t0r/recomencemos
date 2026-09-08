/**
 * DD6 step 1: shrink and re-encode the picture **in her browser**, before a
 * single byte crosses the network.
 *
 * > The client **downscales and re-encodes to ~1600 px and ≤ 2 MB in a canvas**
 * > before upload, which also serves NFR3's mobile-data premise and strips EXIF
 * > as a side effect.
 *
 * **Three things this buys, and only one of them is the size.** The upload over
 * mobile data goes from 2–5 MB to a few hundred kilobytes, which is the premise
 * NFR3 rests on and the difference between a photo that arrives and one she
 * abandons. A canvas re-encode drops EXIF — including GPS — so the coordinates
 * never leave her phone at all, which is a strictly better place to lose them
 * than the server-side re-encode that is the real defence. And the 2 MB ceiling
 * on the presigned PUT becomes something she meets rather than something that
 * refuses her.
 *
 * **None of it is a control, and that is the important half.** The bytes arrive
 * at a presigned URL from a browser, so nothing here is trusted: the signature
 * bounds the length, and `@repo/storage`'s re-encode decides the format from the
 * bytes and drops the metadata again. This is a courtesy to her connection. The
 * server behaves identically whether it ran or not.
 *
 * **`createImageBitmap` rather than an `<img>` and a load event.** It decodes off
 * the main thread, it is Baseline Widely Available well inside NFR5's floor
 * (Chrome on Android 10+, Safari on iOS 16+), and it honours EXIF orientation
 * through `imageOrientation: "from-image"` — which an `<img>` does too, but a
 * bitmap does it without a layout pass. The orientation matters for the same
 * reason it does on the server: it is the one EXIF tag whose loss is visible.
 */

import { MAX_LONG_EDGE_PX, MAX_UPLOAD_BYTES } from "@repo/storage/limits";

/** What the browser produces and hands to the presigned PUT. */
export interface DownscaledPhoto {
  readonly blob: Blob;
  readonly contentType: string;
  readonly byteLength: number;
  /** For the preview. Revoked by the caller when it stops rendering it. */
  readonly previewUrl: string;
}

/**
 * Why the picture could not be used, as a value rather than a throw.
 *
 * Both are ordinary answers to an ordinary form — she chose a file that is not
 * a picture, or a picture we could not make small enough — so the surface
 * renders a sentence and the form stays usable. Nothing is reported.
 */
export type DownscaleRefusal = "unreadable" | "too-large";

export type DownscaleOutcome =
  | { readonly ok: true; readonly photo: DownscaledPhoto }
  | { readonly ok: false; readonly reason: DownscaleRefusal };

/**
 * The qualities tried, in order, until one fits under the ceiling.
 *
 * **A ladder rather than a computed quality**, because there is no closed form
 * for "what quality makes this particular image 2 MB": it depends on the
 * content. Three attempts is enough — at 1600 px on the long edge, a photograph
 * at quality 0.5 is well under a megabyte, and anything that still will not fit
 * is not a photograph.
 */
const QUALITY_LADDER = [0.82, 0.7, 0.5] as const;

/**
 * WebP, with JPEG behind it.
 *
 * **The fallback is real rather than defensive.** `canvas.toBlob` silently
 * produces a PNG when it is handed a type it does not support — it does not
 * throw and it does not report — and a PNG of a photograph is several times the
 * size of the JPEG it replaced, which would make the ceiling unreachable for
 * reasons nobody could see. So the result's own `type` is what decides, never
 * the type that was asked for.
 */
const ENCODE_TYPES = ["image/webp", "image/jpeg"] as const;

/**
 * Read a file she picked, and hand back something small enough to upload.
 *
 * The `Blob` is produced from a canvas, so what comes out is bytes this code
 * wrote — the original file is never uploaded, whatever it was.
 */
export async function downscale(file: File): Promise<DownscaleOutcome> {
  const bitmap = await decode(file);

  if (!bitmap) return { ok: false, reason: "unreadable" };

  try {
    const { width, height } = fit(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return { ok: false, reason: "unreadable" };

    context.drawImage(bitmap, 0, 0, width, height);

    const encoded = await encodeUnderCeiling(canvas);
    if (!encoded) return { ok: false, reason: "too-large" };

    return {
      ok: true,
      photo: {
        blob: encoded,
        contentType: encoded.type,
        byteLength: encoded.size,
        previewUrl: URL.createObjectURL(encoded),
      },
    };
  } finally {
    // Frees the decoded pixels rather than waiting for a collection that may
    // not come before she picks the next one. A 12-megapixel bitmap is ~48 MB.
    bitmap.close();
  }
}

/**
 * The size to draw at: the long edge bounded, the aspect ratio kept, and never
 * larger than what she gave us.
 *
 * **Exported because it is the whole of the arithmetic and the only part of
 * this module a test can reach without a canvas.** happy-dom has no 2D context,
 * so the drawing and the encoding verify at seam 3 against a real browser; this
 * verifies here.
 */
export function fit(
  width: number,
  height: number,
): { readonly width: number; readonly height: number } {
  const longest = Math.max(width, height);

  if (longest <= MAX_LONG_EDGE_PX) return { width, height };

  const scale = MAX_LONG_EDGE_PX / longest;

  // Rounded, and floored at 1: a very long thin image would otherwise scale its
  // short edge to zero, and a canvas of width 0 encodes to nothing at all.
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function decode(file: File): Promise<ImageBitmap | null> {
  try {
    // `from-image` applies the EXIF orientation tag to the pixels, which is the
    // one tag whose loss would be visible — everything else in EXIF, GPS
    // included, is dropped by the canvas round trip.
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // An SVG, a PDF she renamed, a truncated download, a HEIC on a browser that
    // cannot decode one. All the same answer to her: pick another.
    return null;
  }
}

/**
 * Encode until something fits, or give up.
 *
 * Two loops rather than one: format first, then quality, because a browser that
 * cannot write WebP should fall back to JPEG at full quality rather than
 * crawling down the ladder in a format it is silently ignoring.
 */
async function encodeUnderCeiling(canvas: HTMLCanvasElement): Promise<Blob | null> {
  for (const type of ENCODE_TYPES) {
    for (const quality of QUALITY_LADDER) {
      // Sequential on purpose: each attempt exists only because the previous one
      // was too big, so encoding all six in parallel would do five times the
      // work on a phone to discard most of it.
      // oxlint-disable-next-line no-await-in-loop
      const blob = await toBlob(canvas, type, quality);

      if (!blob) break;

      // **The blob's own type, never the one we asked for.** `toBlob` falls back
      // to PNG in silence for an unsupported type, and a PNG of a photograph is
      // large enough to make the ceiling unreachable for a reason nobody could
      // see from the outside.
      if (blob.type !== type) break;

      if (blob.size <= MAX_UPLOAD_BYTES) return blob;
    }
  }

  return null;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}
