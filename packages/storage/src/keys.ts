/**
 * Minting a key, and reading one back.
 *
 * **The key is server-generated and opaque, and DD6 says why in one sentence:**
 * _"the client's filename never reaches it, or the upload is a path-traversal
 * and cross-Worker-overwrite primitive"_. Both halves of that are real. A
 * filename carries `../`, and a filename carries whatever another Worker's
 * filename carried — so a key built from one lets a caller write over somebody
 * else's photo by guessing what she called hers.
 *
 * The shapes themselves live in `#key-shapes`, which imports nothing and is
 * therefore reachable from the browser-side image loader; this module is the
 * half that mints and so pulls in `nanoid`.
 *
 * Pure, so seam 1 covers the whole of it: nothing here reads an environment or
 * touches a store. What a prefix *means* — which bucket the key goes in, and
 * therefore whether anybody can read it — is `bucketFor`'s and a human's step
 * (runbook §3); what this module owns is that the two are never spelled twice.
 */

import { nanoid } from "nanoid";
import {
  KEY_LENGTH,
  PUBLIC_PREFIX,
  PUBLIC_SUFFIX,
  QUARANTINE_KEY,
  QUARANTINE_PREFIX,
  wholeMatch,
} from "#key-shapes";

export { isPublicKey, isQuarantineKey, PUBLIC_PREFIX, QUARANTINE_PREFIX } from "#key-shapes";

/**
 * A fresh quarantine key.
 *
 * **It carries no Account id and no profile id**, which is deliberate and is
 * NFR18 rather than tidiness: a key ends up in a URL, in a log line's `context`
 * and in an object listing, and an identifier that resolves to a person in all
 * three is a join nobody asked for. The row is what knows whose photo this is.
 */
export function mintQuarantineKey(): string {
  return `${QUARANTINE_PREFIX}/${nanoid(KEY_LENGTH)}`;
}

/**
 * The random part of a quarantine key, or a throw.
 *
 * **It validates rather than splits**, because every caller of this is handling
 * a string that came out of a database column and is about to become part of a
 * URL. A key that does not have exactly this shape is refused here rather than
 * concatenated into a request — which is the difference between a bad row and a
 * traversal.
 */
export function randomPartOf(key: string): string {
  const random = wholeMatch(QUARANTINE_KEY, key);

  if (!random) {
    throw new Error(
      "A photo key was handed to the object store that this repository did not mint. " +
        "Keys are server-generated and opaque; a value that does not match that shape is " +
        "refused rather than used to build a request.",
    );
  }

  return random;
}

/**
 * Where the re-encoded object goes. **Independent of the quarantine key it came
 * from, and that independence is a security property rather than a style
 * choice.**
 *
 * It used to be derived — `quarantine/<R>` became `photos/<R>.webp` — on the
 * argument that an operator holding one object could then name the other
 * without a table. The argument was true and the cost was far larger: a public
 * key is rendered into an `src` on every Wall card, so deriving it made **every
 * approved photo a public oracle for its own quarantine key**. Any visitor
 * could read `<R>` out of the DOM and reconstruct the private key by string
 * manipulation.
 *
 * `/security-review` found it. That was the *reachability* half of a
 * broken-object-level-authorization defect; the *authorization* half is the
 * account binding in `@repo/domain`'s `#photos`, and both are needed — this one
 * alone would leave the hole open to any key that leaked another way.
 *
 * The traceability the old comment wanted now lives where it belongs:
 * `capability_profile.photo_key` names the current object, and `photo_upload`
 * records which Account a quarantine key was minted for.
 *
 * The suffix is fixed by `PUBLIC_FORMAT`'s argument in `#limits` — one format
 * out, whatever arrived.
 */
export function mintPublicKey(): string {
  return `${PUBLIC_PREFIX}/${nanoid(KEY_LENGTH)}${PUBLIC_SUFFIX}`;
}
