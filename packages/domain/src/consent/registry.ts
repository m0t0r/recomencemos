/**
 * What a Consent row is permitted to say, as data.
 *
 * Two registries and nothing else, kept apart from `#consent` itself so that
 * `#schema` can read the sides without importing the module that queries the
 * table it defines. `#admin/names` sits beside `#admin` for the same reason.
 *
 * **Neither set is a Spanish string.** Under
 * [ADR-0012](../../../../docs/adr/0012-spanish-is-the-interface-english-is-the-code.md)
 * every identifier is English and only what a person reads is `es-CO`; the words
 * these versions *name* live in `apps/web`, and the version is the pointer
 * between them.
 */

/**
 * The two moments a Consent row is written, named for the side it belongs to.
 *
 * The spec's Core entities fixes both: _"written for the **Worker** at publish
 * and for the **Hirer** at first Offer send"_ — and the second half is the one
 * that had to be argued for. The platform collects and then discloses a Hirer's
 * name, phone and email too, and the draft had him consenting to nothing.
 *
 * `CONTEXT.md`'s vocabulary, so the column reads the way the rest of the system
 * talks. It is `TEXT` with a `CHECK` built from this array rather than a
 * Postgres `ENUM`, which is DD2's rule: widening the set is then a constraint
 * change rather than a type alteration.
 */
export const CONSENT_SIDES = ["worker", "hirer"] as const;

export type ConsentSide = (typeof CONSENT_SIDES)[number];

/**
 * The *aviso de privacidad* currently in force, and the whole history of them.
 *
 * **A version is a date, and that is the most a version can honestly be here.**
 * The row records what she was shown; the text she was shown lives in
 * `apps/web`, under `/privacy`, published at a stable anchor precisely so that a
 * version recorded in a row can be read back. A *reclamo* asks what she agreed
 * to, and an identifier pointing at nothing readable answers it no better than
 * an empty column would.
 *
 * **The history is kept rather than only the current value**, because the two
 * questions asked of this module are different ones: `recordConsent` needs to
 * know what is current, and a *reclamo* needs to know whether a version a row
 * carries is one this product ever published. A row naming a version absent from
 * here is a row that cannot be explained, and that is worth being able to detect.
 *
 * **Editing the text under `/privacy` without appending a version here is the
 * mistake this array exists to make visible.** The copy and the version are two
 * halves of one fact; the version is the half a database row can hold.
 */
export const CURRENT_NOTICE_VERSION = "2026-08-30";

export const CONSENT_NOTICE_VERSIONS = [CURRENT_NOTICE_VERSION] as const;

/**
 * The *autorización* currently in force, and its history.
 *
 * Separate from the notice above because Ley 1581 treats them as two documents
 * and they change for different reasons: the *aviso* changes when a processor is
 * added or a purpose changes, and the *autorización* changes when what she is
 * being asked to authorize changes. Collapsing them into one version would make
 * a processor swap read as a fresh authorization, which is the more consequential
 * of the two claims to get wrong.
 */
export const CURRENT_AUTHORIZATION_VERSION = "2026-08-30";

export const CONSENT_AUTHORIZATION_VERSIONS = [CURRENT_AUTHORIZATION_VERSION] as const;

/**
 * What a form displays and what a new row records, as one object, so a caller
 * cannot pick up one half and forget the other.
 *
 * **The current value is what the history is built from**, rather than read back
 * off the end of it. Both spellings keep the two in step; this one does it in the
 * type system — `CURRENT_NOTICE_VERSION` is a string literal and the tuple
 * contains it by construction, where `at(-1)` is `string | undefined` and needs a
 * cast to be useful. Appending a version means moving the old literal into the
 * array and changing the constant, which is one deliberate edit and reads as one.
 */
export const CURRENT_CONSENT_VERSIONS = {
  notice: CURRENT_NOTICE_VERSION,
  authorization: CURRENT_AUTHORIZATION_VERSION,
} as const;

/** What a form submits back, and what a row stores. */
export interface ConsentVersions {
  readonly notice: string;
  readonly authorization: string;
}

/**
 * Whether the versions a form is submitting are the ones in force right now.
 *
 * **The failure this refuses is narrow and real.** She opens `/publish`, reads
 * the *autorización*, and leaves the tab open. The text is edited and deployed.
 * She submits. Without this check the row records the *new* version beside a
 * consent given to the old text — which is the one thing a Consent row exists
 * not to do, and it is invisible afterwards because the row looks perfectly
 * ordinary.
 *
 * Pure, so it is seam 1's.
 */
export function versionsAreCurrent(versions: ConsentVersions): boolean {
  return (
    versions.notice === CURRENT_CONSENT_VERSIONS.notice &&
    versions.authorization === CURRENT_CONSENT_VERSIONS.authorization
  );
}
