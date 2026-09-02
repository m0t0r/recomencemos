/**
 * The public handle, and why it takes no argument (NFR9).
 *
 * A profile's slug is _"server-generated, opaque, derived from **no** part of
 * her name, city or Skills, and stable across edits"_. The first three are one
 * property, and the signature is what enforces it: a function that takes nothing
 * cannot derive from anything. Stability is the query module's — the slug is
 * written once at publish and no edit path rewrites it.
 *
 * **`nanoid`'s `customAlphabet`, not a generator written here.** Random-id
 * generation is the kind of thing that looks right and is subtly biased — a
 * `byte % 32` over a 256-value byte is uniform only because 32 divides 256, and
 * the next person to widen the alphabet would not know that. `nanoid` handles
 * the rejection sampling, is the established package for exactly this, and
 * declares an `engines` range this repository's Node floor satisfies (NFR23).
 *
 * **Sixteen lowercase base32 characters, eighty bits.** Lowercase and digits so
 * it survives a URL, a text message and a person reading it aloud. Eighty bits
 * is far past the point where a collision is an engineering concern; the
 * `UNIQUE (slug)` constraint is the backstop that would surface one as a
 * constraint error rather than a silently shared page.
 *
 * NFR8's argument depends on this: `robots.txt` does **not** disallow
 * `/profile/*`, so a linked-but-`noindex` URL can still be indexed as a bare
 * string — and this is what makes that string harmless.
 */

import { customAlphabet } from "nanoid";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";
const LENGTH = 16;

export const mintSlug: () => string = customAlphabet(ALPHABET, LENGTH);

/** What a slug looks like, so a route can refuse the wrong shape before a query. */
export const SLUG_PATTERN = /^[a-z2-7]{16}$/;
