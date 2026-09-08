/**
 * DD6 step 4, which is the one step in the photo path that is a security control
 * rather than a transfer.
 *
 * > **Approval re-encodes server-side** from quarantine into the public prefix.
 * > The trusted re-encode happens once, on ≤ 2 MB, so the public object is
 * > always server-produced: EXIF GPS cannot survive it, and the SVG/polyglot
 * > route to stored XSS is closed by decoding to a raster allowlist rather than
 * > trusting `Content-Type`. Byte and pixel ceilings bound the decompression
 * > bomb.
 *
 * **Four separate defences are in that paragraph and each is a line below.**
 * They are written out here because the failure mode of an image pipeline is
 * that it looks like a resize and is doing four other jobs, and the next person
 * to "simplify" it will delete the one that mattered:
 *
 * 1. **EXIF is dropped**, and with it GPS. DD6 is blunt about the stake: _"EXIF
 *    GPS on an indexable Wall would publish the precise location of a displaced
 *    woman to anyone who downloads the file."_ `sharp` drops metadata unless
 *    `withMetadata()` asks for it, so the defence is an absent call — which is
 *    exactly the kind of defence that gets added back by accident, hence this
 *    sentence. **`.rotate()` before the resize is what makes that safe**: the
 *    orientation tag is the one piece of EXIF whose loss is visible, so it is
 *    applied to the pixels and then discarded with the rest.
 * 2. **The format is decided by the decoder, not by the caller.** `Content-Type`
 *    is attacker-controlled — it is a header on a PUT the browser made — so
 *    nothing here reads it. `sharp` sniffs the container, and a container that
 *    is not in {@link DECODABLE_FORMATS} is refused. SVG is absent from that
 *    list deliberately: libvips will happily rasterise one, and an SVG is a
 *    document that can carry script for whatever renders it next.
 * 3. **A pixel ceiling bounds the decompression bomb.** A 2 MB PNG can declare
 *    dimensions that allocate gigabytes on decode, which on a 1 GB machine (C34)
 *    is the whole process. `limitInputPixels` refuses before allocating.
 * 4. **One format out.** Whatever arrived, the public object is WebP produced
 *    here — so "is this object safe" is answered by where it came from rather
 *    than by inspecting it.
 */

import { AppError } from "@repo/errors/app-error";
import sharp, { type Metadata, type Sharp } from "sharp";
import {
  DECODABLE_FORMATS,
  type DecodableFormat,
  MAX_LONG_EDGE_PX,
  MAX_UPLOAD_BYTES,
  PUBLIC_QUALITY,
} from "#limits";
import { PHOTO_TOO_LARGE, PHOTO_UNREADABLE } from "#user-messages";

/**
 * The most pixels the decoder will allocate for, before any resize.
 *
 * `MAX_LONG_EDGE_PX` squared times four is a 6400 × 6400 square — well above any
 * phone camera's output and far below what a crafted header can declare. It is
 * expressed as a multiple of the edge the pipeline targets so that raising one
 * raises the other, rather than leaving a ceiling behind that nobody re-derived.
 */
export const MAX_INPUT_PIXELS = (MAX_LONG_EDGE_PX * 4) ** 2;

export interface ReencodedPhoto {
  readonly bytes: Buffer;
  readonly width: number;
  readonly height: number;
  /** What the *input* turned out to be. Useful on a log line; never trusted before this point. */
  readonly sourceFormat: DecodableFormat;
}

/**
 * Decode bytes we did not produce and re-encode them into bytes we did.
 *
 * **It throws rather than returning a refusal**, and the distinction is the one
 * CLAUDE.md draws: a photo that fails here has already passed a client-side
 * downscale, a byte ceiling on the presigned PUT and an Admin's eyes, so it is
 * not an ordinary answer to an ordinary request — it is either a corrupt object
 * or someone probing the decoder, and both have earned an event. The Admin
 * action above this catches it and turns it into one `warn` line and a refusal
 * on screen; nothing reaches a Worker.
 */
export async function reencodeForPublic(input: Buffer): Promise<ReencodedPhoto> {
  if (input.byteLength > MAX_UPLOAD_BYTES) {
    throw new AppError({
      code: "photo_over_byte_ceiling",
      status: 413,
      message:
        `A quarantined object was ${input.byteLength} bytes, over the ${MAX_UPLOAD_BYTES}-byte ` +
        "ceiling the presigned PUT is supposed to enforce. It was not decoded. Either the " +
        "bucket is not enforcing the content-length condition on the signature, or this object " +
        "did not arrive through one.",
      userMessage: PHOTO_TOO_LARGE,
      context: { byte_length: input.byteLength, ceiling: MAX_UPLOAD_BYTES },
    });
  }

  // `failOn: "error"` rather than sharp's default of `"warning"`: a truncated
  // or malformed file should stop here rather than produce a partial raster
  // that then gets published as somebody's face.
  const pipeline = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" });

  const metadata = await readMetadata(pipeline);
  const sourceFormat = decodableFormat(metadata.format);

  const { data, info } = await pipeline
    // Applies the EXIF orientation tag to the pixels. Everything else in EXIF —
    // GPS included — is dropped by the absence of `withMetadata()` below, and
    // this is the one tag whose loss would otherwise be visible as a sideways
    // photo.
    .rotate()
    .resize({
      width: MAX_LONG_EDGE_PX,
      height: MAX_LONG_EDGE_PX,
      // Bounds the long edge whichever it is, and never upscales a photo that
      // is already smaller — which matters on this product's primary surface,
      // where a picture off a cheap front camera is common.
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: PUBLIC_QUALITY })
    .toBuffer({ resolveWithObject: true });

  return { bytes: data, width: info.width, height: info.height, sourceFormat };
}

async function readMetadata(pipeline: Sharp): Promise<Metadata> {
  try {
    return await pipeline.metadata();
  } catch (cause) {
    throw new AppError({
      code: "photo_undecodable",
      status: 422,
      message:
        "A quarantined object could not be decoded as an image at all. Nothing was written to " +
        "the public prefix and the quarantined object is untouched.",
      userMessage: PHOTO_UNREADABLE,
      // No bytes and no filename: the object is a photograph of a person until
      // proven otherwise, and `context` reaches the log line (NFR18).
      context: {},
      cause,
    });
  }
}

/**
 * The allowlist, applied to what the **decoder** found rather than to what the
 * upload claimed.
 *
 * This is the SVG defence, and it is a `switch` over a closed set rather than a
 * denylist for the reason DD6 gives: the list of things that are not a raster
 * is open-ended and grows with every library, while the list of things a face
 * arrives as is five entries long and has not changed in a decade.
 */
function decodableFormat(format: string | undefined): DecodableFormat {
  const allowed = DECODABLE_FORMATS.find((candidate) => candidate === format);

  if (!allowed) {
    throw new AppError({
      code: "photo_format_not_allowed",
      status: 422,
      message:
        `A quarantined object decoded as "${format ?? "an unrecognised container"}", which is ` +
        `not one of ${DECODABLE_FORMATS.join(", ")}. Nothing was written. This is the check ` +
        "that closes the SVG and polyglot route to stored XSS, so widening it is a spec " +
        "decision rather than a fix.",
      userMessage: PHOTO_UNREADABLE,
      // The container's name is a property of the file, not of a person.
      context: { format: format ?? null },
    });
  }

  return allowed;
}
