/**
 * What a photo may be, as numbers — and the one module in this package a
 * browser may resolve.
 *
 * **Isomorphic by construction, exactly as `@repo/errors` is.** It imports
 * nothing, reads no environment, opens no connection and holds no credential,
 * so there is no `browser` condition on its subpath and no `assertServerOnly`
 * inside it. That is not a hole in this package's server-only guard: the guard
 * is on `./photos`, which is the only subpath that touches the object store.
 * ADR-0013's mechanism 1 is about withholding what must not cross, and three
 * numbers are not that.
 *
 * **They live here rather than in `@repo/domain/policy` because of a cycle.**
 * `PHOTO_STATES` sits in `#policy/profile-states` and this would sit beside it,
 * except that `@repo/domain` calls this package to presign and this package
 * would then have to call `@repo/domain` to read a number. These are facts about
 * what the codec and the store will accept rather than facts about a
 * CapabilityProfile, so this is also the more honest home for them.
 *
 * **Both halves of DD6 read the same numbers, which is the point.** The browser
 * downscales to them before it uploads; the server re-encode enforces them again
 * on bytes it did not produce. A client-side ceiling is a courtesy to her mobile
 * data and never a control — the upload arrives at a presigned URL and nothing
 * about the browser is trusted.
 */

/**
 * The longest edge a stored photo may have, in pixels.
 *
 * DD6's own number: _"downscales and re-encodes to ~1600 px and ≤ 2 MB in a
 * canvas"_. It is the long edge rather than the width because a photo taken in
 * portrait — which on this product's primary surface is most of them — would
 * otherwise be bounded on its short side and stay four times the intended area.
 */
export const MAX_LONG_EDGE_PX = 1600;

/**
 * The most bytes a presigned PUT may carry, and the most the re-encode will
 * decode.
 *
 * DD6 states 2 MB and the machine floor it protects is 1 GB (C34). Written in
 * binary megabytes because that is what a `Content-Length` is compared against;
 * the sentence a person reads never quotes it.
 */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

/**
 * **The decode allowlist, and it is an allowlist rather than a denylist for the
 * reason DD6 gives**: the SVG-and-polyglot route to stored XSS is closed by
 * _"decoding to a raster allowlist rather than trusting `Content-Type`"_. So
 * this list is what the decoder is permitted to produce a raster from, and the
 * `Content-Type` the browser sent is a hint used to refuse early, never to
 * decide.
 *
 * SVG is absent deliberately and is the whole reason the list is closed: it is
 * a document format that can carry script, and an image element is not the only
 * thing that will render one.
 */
export const DECODABLE_FORMATS = ["jpeg", "png", "webp", "avif", "heif"] as const;
export type DecodableFormat = (typeof DECODABLE_FORMATS)[number];

/**
 * The `accept` attribute the file input carries.
 *
 * Deliberately **not** built from {@link DECODABLE_FORMATS}. That list is what
 * the server will decode; this is a hint to a camera roll about what to show,
 * and `image/*` is what makes an Android open the gallery and the camera rather
 * than a file browser filtered to five MIME types it may spell differently.
 * Widening one has never been a reason to widen the other.
 */
export const PHOTO_INPUT_ACCEPT = "image/*";

/**
 * What the public object is encoded as, whatever arrived.
 *
 * One format out means one variant set at the edge, and it means the stored
 * bytes are always something this repository produced — which is step 4 of DD6
 * stated as a property rather than as a procedure.
 */
export const PUBLIC_FORMAT = "webp" as const;

/** The quality the re-encode targets. Chosen for a face at 1600 px, not for a landscape. */
export const PUBLIC_QUALITY = 82;

/**
 * The widths the Wall, `/profiles` and `/my-profile` request through the
 * transformation URL.
 *
 * **Three of them, and the number is a budget rather than a taste.** DD6 prices
 * Cloudflare Images' free plan at 5,000 unique transformations a month against
 * images stored outside Images, consumed by new (image × variant) pairs rather
 * than by traffic — _"at three variants per profile that is ~1,600 new profiles
 * a month"_. A fourth width would cut that to 1,250 and nothing on any surface
 * needs one.
 */
export const PUBLIC_WIDTHS = [96, 192, 384] as const;
